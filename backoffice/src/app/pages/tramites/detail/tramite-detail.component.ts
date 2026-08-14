import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject, Observable, catchError, filter, finalize, map, of, shareReplay, startWith, switchMap,
} from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EstadoBadgeComponent } from '../../../shared/components/estado-badge/estado-badge.component';
import { RowAction, RowActionsComponent } from '../../../shared/components/row-actions';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { FeedbackResumenVM, RefVM, TramitesFacade, TramiteVM } from '@features/tramites';

/** Pestañas de la ficha, en el orden en que se consultan. */
type TabDetalle = 'datos' | 'contenido' | 'feedback' | 'historial';

/**
 * Estado de la pantalla. `no-encontrado` es distinto de `error` porque la salida es otra:
 * un 404 no se reintenta, se vuelve a la lista.
 */
type EstadoPantalla = 'cargando' | 'listo' | 'error' | 'no-encontrado';

interface TramiteVista {
  estado: EstadoPantalla;
  tramite: TramiteVM | null;
}

/** El resumen viaja en `null` mientras carga o si falló: nunca hay ceros que interpretar. */
interface FeedbackVista {
  cargando: boolean;
  error: boolean;
  resumen: FeedbackResumenVM | null;
}

interface CampoFicha {
  label: string;
  valor: string | null;
}

interface BloqueTexto {
  titulo: string;
  texto: string | null;
}

interface GrupoChips {
  label: string;
  items: RefVM[];
}

/** Estados iniciales tipados: `startWith` con un literal suelto ensancharía el tipo. */
const TRAMITE_CARGANDO: TramiteVista = { estado: 'cargando', tramite: null };
const FEEDBACK_CARGANDO: FeedbackVista = { cargando: true, error: false, resumen: null };

const TABS: { clave: TabDetalle; label: string }[] = [
  { clave: 'datos', label: 'Datos' },
  { clave: 'contenido', label: 'Contenido' },
  { clave: 'feedback', label: 'Feedback' },
  { clave: 'historial', label: 'Historial' },
];

/**
 * Ficha de trámite. Sigue el patrón de la ficha de organismo: barra de identidad con
 * estado y metadatos, pestañas, y grilla de dos columnas.
 *
 * Las tres situaciones de carga son explícitas (`EstadoPantalla`): antes, si `getById`
 * fallaba, la pantalla apagaba el spinner sin marcar error y el template quedaba
 * literalmente vacío —igual para un 404 que para la API caída—.
 */
@Component({
  selector: 'app-tramite-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    DatePipe,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    EstadoBadgeComponent,
    RowActionsComponent,
    HasPermissionDirective,
    PageActionsDirective,
  ],
  templateUrl: './tramite-detail.component.html',
  styleUrls: ['./tramite-detail.component.scss'],
})
export class TramiteDetailComponent {
  private readonly facade = inject(TramitesFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly tabs = TABS;
  readonly tab$ = new BehaviorSubject<TabDetalle>('datos');

  /** Hay una operación de workflow en vuelo: bloquea las acciones del header. */
  readonly trabajando$ = new BehaviorSubject<boolean>(false);

  private readonly id: string = this.route.snapshot.params['id'] ?? '';
  private readonly recargar$ = new BehaviorSubject<void>(undefined);
  private readonly recargarFeedback$ = new BehaviorSubject<void>(undefined);

  /**
   * `shareReplay` sin `refCount` porque el trámite se consume dos veces —el template de
   * acciones del header y el cuerpo de la página—: sin esto serían dos pedidos.
   */
  readonly vista$: Observable<TramiteVista> = this.recargar$.pipe(
    switchMap(() => this.cargarTramite()),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /**
   * Stream aparte del trámite: se suscribe recién cuando se abre la pestaña y su fallo
   * no arrastra a la ficha. Un feedback caído se cuenta como tal, no como "sin valoraciones".
   */
  readonly feedback$: Observable<FeedbackVista> = this.recargarFeedback$.pipe(
    switchMap(() =>
      this.facade.getFeedbackResumen(this.id).pipe(
        map((resumen): FeedbackVista => ({ cargando: false, error: false, resumen })),
        catchError(() => of<FeedbackVista>({ cargando: false, error: true, resumen: null })),
        startWith(FEEDBACK_CARGANDO),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  private cargarTramite(): Observable<TramiteVista> {
    if (!this.id) return of<TramiteVista>({ estado: 'no-encontrado', tramite: null });

    return this.facade.getById(this.id).pipe(
      map((tramite): TramiteVista => ({ estado: 'listo', tramite })),
      catchError((error: unknown) =>
        of<TramiteVista>({ estado: this.esNoEncontrado(error) ? 'no-encontrado' : 'error', tramite: null }),
      ),
      startWith(TRAMITE_CARGANDO),
    );
  }

  /**
   * Se mira el `status` por forma y no con `HttpErrorResponse`: el componente no debe
   * conocer el transporte, y a esta capa el error llega igual desde cualquier DataSource.
   */
  private esNoEncontrado(error: unknown): boolean {
    return (error as { status?: number } | null)?.status === 404;
  }

  reintentar(): void {
    this.recargar$.next();
  }

  reintentarFeedback(): void {
    this.recargarFeedback$.next();
  }

  seleccionarTab(clave: TabDetalle): void {
    this.tab$.next(clave);
  }

  // ── Ficha ───────────────────────────────────────────────────────────────

  /** Campos de la grilla, en el orden del diseño. `null` se dibuja como guion. */
  camposDe(tramite: TramiteVM): CampoFicha[] {
    return [
      { label: 'Organismo responsable', valor: tramite.organismoNombre },
      { label: 'Modalidad', valor: tramite.modalidadNombre },
      { label: 'Destacado en el portal', valor: tramite.destacado ? 'Sí' : 'No' },
      { label: 'Identificador (slug)', valor: tramite.slug },
    ];
  }

  /** Bloques de texto largo. Los vacíos se muestran igual, marcados como sin dato. */
  bloquesDe(tramite: TramiteVM): BloqueTexto[] {
    return [
      { titulo: 'Resumen', texto: tramite.resumen },
      { titulo: 'Descripción completa', texto: tramite.descripcionLarga },
      { titulo: 'Requisitos', texto: tramite.requisitos },
      { titulo: 'Costos', texto: tramite.costos },
      { titulo: 'Formularios', texto: tramite.formularios },
      { titulo: 'Contacto', texto: tramite.contacto },
    ];
  }

  /** Clasificación del trámite. La disponibilidad va aparte: su vacío significa "toda la provincia". */
  gruposDe(tramite: TramiteVM): GrupoChips[] {
    return [
      { label: 'Categorías', items: tramite.categorias },
      { label: 'Destinatarios', items: tramite.destinatarios },
      { label: 'Etiquetas', items: tramite.etiquetas },
      { label: 'Eventos de vida', items: tramite.eventosDeVida },
    ];
  }

  // ── Navegación ──────────────────────────────────────────────────────────

  volver(): void {
    this.router.navigate(['/dashboard/tramites/lista']);
  }

  editar(tramite: TramiteVM): void {
    this.router.navigate(['/dashboard/tramites/editar', tramite.id]);
  }

  verTodoElFeedback(): void {
    this.router.navigate(['/dashboard/feedback'], { queryParams: { tramiteId: this.id } });
  }

  // ── Acciones ────────────────────────────────────────────────────────────

  /**
   * Eliminar vive en la barra de identidad y no junto a Editar y las de workflow: es la
   * única irreversible, así que se mantiene fuera del alcance del click de uso diario
   * (mismo criterio que la ficha de organismo y la lista).
   */
  accionesDestructivas(tramite: TramiteVM): RowAction[] {
    return [
      {
        label: 'Eliminar',
        icon: 'trash',
        permission: 'DELETE_PROCEDURE',
        danger: true,
        ariaLabel: `Eliminar trámite ${tramite.titulo}`,
        run: () => this.eliminar(tramite),
      },
    ];
  }

  /** Interna y reversible: no pide confirmación, pero sí avisa cómo salió. */
  enviarARevision(tramite: TramiteVM): void {
    this.trabajando$.next(true);
    this.facade.sendToReview(tramite.id)
      .pipe(
        finalize(() => this.trabajando$.next(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.avisar('Trámite enviado a revisión');
          this.recargar$.next();
        },
        error: () => this.avisarError('No se pudo enviar a revisión.'),
      });
  }

  /** De cara al ciudadano: se confirma antes, contando qué implica. */
  publicar(tramite: TramiteVM): void {
    this.confirmarYEjecutar(tramite, {
      title: '¿Publicar el trámite?',
      message: `Se publicará ${tramite.titulo} y quedará visible para la ciudadanía en el portal público.`,
      confirmText: 'Sí, publicar',
      busyText: 'Publicando...',
      exito: 'Trámite publicado',
      accion: () => this.facade.publish(tramite.id),
    });
  }

  despublicar(tramite: TramiteVM): void {
    this.confirmarYEjecutar(tramite, {
      title: '¿Despublicar el trámite?',
      message: `Se despublicará ${tramite.titulo} y dejará de verse en el portal público. Podés volver a publicarlo cuando quieras.`,
      confirmText: 'Sí, despublicar',
      busyText: 'Despublicando...',
      exito: 'Trámite despublicado',
      accion: () => this.facade.unpublish(tramite.id),
    });
  }

  private eliminar(tramite: TramiteVM): void {
    this.confirmarYEjecutar(tramite, {
      title: '¿Eliminar el trámite?',
      message: `Se eliminará ${tramite.titulo} con toda su información, incluido el contenido por localidad. Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar',
      busyText: 'Eliminando...',
      danger: true,
      exito: 'Trámite eliminado',
      accion: () => this.facade.delete(tramite.id),
      // Ya no hay ficha que mostrar: quedarse acá dejaría la pantalla apuntando a un 404.
      alTerminar: () => this.volver(),
    });
  }

  private confirmarYEjecutar(tramite: TramiteVM, opciones: {
    title: string; message: string; confirmText: string; busyText: string;
    danger?: boolean; exito: string; accion: () => Observable<unknown>; alTerminar?: () => void;
  }): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: opciones.title,
        message: opciones.message,
        highlight: tramite.titulo,
        danger: opciones.danger ?? false,
        confirmText: opciones.confirmText,
        busyText: opciones.busyText,
        // El diálogo se queda abierto con el botón en spinner hasta que el backend
        // responde: si falla, sigue ahí para contarlo en vez de haber cerrado ya.
        confirmAction: () => {
          this.trabajando$.next(true);
          return opciones.accion().pipe(finalize(() => this.trabajando$.next(false)));
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.avisar(opciones.exito);
        if (opciones.alTerminar) {
          opciones.alTerminar();
          return;
        }
        this.recargar$.next();
      });
  }

  private avisar(mensaje: string): void {
    this.snackBar.open(mensaje, 'OK', { duration: 3000, panelClass: 'snackbar-success' });
  }

  private avisarError(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', { duration: 6000, panelClass: 'snackbar-error' });
  }
}
