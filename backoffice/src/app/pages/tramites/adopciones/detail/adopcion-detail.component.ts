import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, combineLatest, map, of, shareReplay, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { confirmarBaja } from '@shared/utils/confirmar-baja';
import { Carga, cargaLista, conCarga } from '@shared/utils/carga';
import { formularioDePagina } from '@shared/utils/formulario-de-pagina';
import { EstadoCargaComponent } from '@shared/components/estado-carga/estado-carga.component';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { PageActionsDirective } from '@shared/directives/page-actions.directive';
import { PuedeTenerCambiosSinGuardar } from '@shared/guards/unsaved-changes.guard';
import { inicioDelDia } from '@core/utils/fecha.utils';
import { AdopcionFormValue, AdopcionVM, AdopcionesFacade } from '@features/adopciones';
import { FieldConfig } from '@core/models/field.interface';
import { DynamicFormComponent } from '@shared/components/dynamic-form/dynamic-form.component';
import { UnavailableDirective } from '@shared/directives/unavailable.directive';
import { RUTA_DETALLE_PLANTILLA } from '@pages/tramites/plantillas/plantillas.rutas';
import { RUTA_LISTA_ADOPCIONES } from '../adopciones.rutas';
import {
  CONFLICTOS_ADOPCION, FALLBACK_ADOPCION, TEXTOS_ADOPCION_INEXISTENTE, esAdopcionInexistente,
} from '../adopcion-save-error';
import { confirmDeshabilitar } from '../adopcion-textos';
import { MembreteComponent } from '@shared/components/membrete/membrete.component';
import { VigenciaBadgeComponent } from '../components/vigencia-badge/vigencia-badge.component';
import { FichasDeAdopcionComponent } from '@pages/tramites/fichas/components/de-adopcion/fichas-de-adopcion.component';
import { camposDeVigencia, rangoDeVigencia } from '../adoptar-dialogo';
import { NO_DISPONIBLE } from '@core/constants/textos.constants';

type EstadoDetalle = Carga<AdopcionVM>;

/**
 * Detalle de un trámite del organismo (adopción, habilitada o no: `GET /{id}` devuelve las dos).
 * Datos + edición de vigencia y "habilitada" (`UPDATE_ADOPTION`, PUT total que reenvía plantilla,
 * organismo y titular tal cual) + "Deshabilitar" (`DELETE_ADOPTION`) + "Fichas por localidad"
 * (`app-fichas-de-adopcion`, hijo con su propio facade, con `READ_VARIANT`).
 */
@Component({
  selector: 'app-adopcion-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe, DatePipe, RouterLink, MatButtonModule, MatSnackBarModule,
    EstadoCargaComponent, MembreteComponent, DynamicFormComponent, HasPermissionDirective, PageActionsDirective, UnavailableDirective, VigenciaBadgeComponent, FichasDeAdopcionComponent,
  ],
  templateUrl: './adopcion-detail.component.html',
  styleUrl: './adopcion-detail.component.scss',
})
export class AdopcionDetailComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly facade = inject(AdopcionesFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly noDisponible = NO_DISPONIBLE;
  readonly textosInexistente = TEXTOS_ADOPCION_INEXISTENTE;
  readonly rutaPlantilla = RUTA_DETALLE_PLANTILLA;

  /** "Vigencia y estado": las dos fechas y "Habilitado", con el aviso de lo que implica apagarlo. */
  readonly campos: FieldConfig[] = [
    ...camposDeVigencia(),
    {
      name: 'habilitada',
      label: 'Habilitado',
      type: 'checkbox',
      aviso: (valor) => (valor
        ? null
        : { tono: 'alerta', texto: 'Al guardar deja de listarse en Trámites del organismo y el trámite deja de verse en el portal.' }),
    },
  ];
  /** Valores guardados: con cada objeto nuevo el formulario vuelve a ellos y queda sin cambios. */
  inicial: Record<string, unknown> | null = null;

  /** Solo existe con `UPDATE_ADOPTION` y la adopción cargada. */
  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  /**
   * Guardado en el lugar (sin `destino`) y cambios sin guardar: el marco común de formulario de página. La carga
   * NO va por el marco: `estado$` sigue a `:id`, lo comparten dos `async` y muestra lo guardado sin volver a pedirlo.
   */
  readonly marco = formularioDePagina<never>();

  /** Adopción mostrada (la última que resolvió `estado$`): la base del PUT total. */
  private actual: AdopcionVM | null = null;
  /**
   * `null` = leer del backend; una adopción = la que devolvió el último guardado (se muestra sin
   * volver a pedirla y sin pasar por "cargando").
   */
  private readonly fuente$ = new BehaviorSubject<AdopcionVM | null>(null);

  /**
   * Compartido: lo leen el contenido y las acciones del header (dos `async`, una sola llamada).
   * Sigue a `paramMap`: si el router reutiliza el componente con otro `:id`, recarga.
   */
  readonly estado$: Observable<EstadoDetalle> = combineLatest([
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    this.fuente$,
  ]).pipe(
    switchMap(([id, guardada]) => guardada?.id === id
      ? of(cargaLista(guardada))
      : this.facade.getDetalle(id).pipe(conCarga(esAdopcionInexistente))),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  ngOnInit(): void {
    // El form sigue a la adopción mostrada (la leída o la que devolvió el último guardado). Es la primera
    // suscripción a `estado$`: el form queda cargado antes de que el template dibuje ese mismo estado.
    this.estado$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((estado) => {
        if (estado.tipo === 'ok') this.cargarEnForm(estado.valor);
      });
  }

  reintentar(): void {
    this.fuente$.next(null);
  }

  volverAlListado(): void {
    this.router.navigate([RUTA_LISTA_ADOPCIONES]);
  }

  /** Vuelve el form a los valores guardados. */
  descartar(): void {
    if (this.actual) this.cargarEnForm(this.actual);
  }

  /** Nada que guardar ni que descartar. */
  get sinCambios(): boolean {
    return this.dynamicForm?.form?.pristine ?? true;
  }

  /** `(formSubmit)` del formulario: llega solo si es válido (si no, el propio formulario lo cuenta). */
  async guardar(valor: Record<string, unknown>): Promise<void> {
    const form = this.dynamicForm?.form;
    if (this.marco.guardando || !this.actual || !form) return;
    const actual = this.actual;
    // PUT total: plantilla, organismo y titular viajan tal cual; solo cambian vigencia y habilitada.
    // Una fecha sin tocar reenvía su hora original (`rangoDeVigencia`).
    const cambios: AdopcionFormValue = {
      plantillaId: actual.plantillaId,
      organismoId: actual.organismoId,
      organismoTitularId: actual.organismoTitularId,
      habilitada: valor['habilitada'] !== false,
      ...rangoDeVigencia(valor, actual, {
        desde: !!form.get('vigenteDesde')?.pristine,
        hasta: !!form.get('vigenteHasta')?.pristine,
      }),
    };

    await this.marco.guardar({
      peticion$: this.facade.update(actual.id, cambios),
      form,
      motor: this.dynamicForm,
      conflictos: CONFLICTOS_ADOPCION,
      fallback: FALLBACK_ADOPCION,
      aviso: (guardada) => guardada.habilitada === actual.habilitada
        ? 'Cambios guardados'
        : guardada.habilitada ? 'Trámite del organismo habilitado' : 'Trámite del organismo deshabilitado',
      esAlta: false,
      // El guardado no navega: muestra lo guardado (y recarga el form con eso) sin volver a pedirlo.
      alQuedarse: (guardada) => this.fuente$.next(guardada),
    });
  }

  deshabilitar(adopcion: AdopcionVM): void {
    confirmarBaja({
      dialog: this.dialog,
      snackBar: this.snackBar,
      destroyRef: this.destroyRef,
      confirmacion: confirmDeshabilitar(adopcion, () => this.facade.deshabilitar(adopcion.id)),
      aviso: 'Trámite del organismo deshabilitado',
      alConfirmar: () => {
        // El form queda limpio: salir no tiene que preguntar por cambios sin guardar.
        this.dynamicForm?.form?.markAsPristine();
        this.volverAlListado();
      },
    });
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla. Mientras guarda no
   * pregunta: el guardado no navega, y al terminar el form queda limpio.
   */
  tieneCambiosSinGuardar(): boolean {
    return this.marco.tieneCambiosSinGuardar(this.dynamicForm?.form);
  }

  private cargarEnForm(adopcion: AdopcionVM): void {
    this.actual = adopcion;
    this.marco.limpiarErrorDeGuardado();
    this.inicial = {
      vigenteDesde: inicioDelDia(adopcion.vigenteDesde),
      vigenteHasta: adopcion.vigenteHasta ? inicioDelDia(adopcion.vigenteHasta) : null,
      habilitada: adopcion.habilitada,
    };
    this.cdr.markForCheck();
  }
}
