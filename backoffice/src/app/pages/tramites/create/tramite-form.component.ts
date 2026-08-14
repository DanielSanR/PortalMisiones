import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  BehaviorSubject, Observable, catchError, combineLatest, finalize, map, of, shareReplay,
  startWith, switchMap, throwError,
} from 'rxjs';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { FormErrorBannerComponent } from '../../../shared/components/form-error-banner/form-error-banner.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { getFormConfig, updateFormConfigOptions } from '../../../shared/components/dynamic-form/dynamic-form.config';
import { FormConfig } from '../../../core/models/field.interface';
import { extractErrorMessage } from '../../../core/models/api-response.model';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import {
  ContenidoLocalidadFormValue, ContenidoLocalidadVM, RefVM, TramiteCatalogos,
  TramiteFormValue, TramiteVM, TramitesFacade,
} from '@features/tramites';

const RUTA_LISTA = '/dashboard/tramites/lista';

/** Motivo por el que la pantalla no pudo dibujarse, ya traducido a lo que ve el usuario. */
interface ErrorCarga {
  titulo: string;
  texto: string;
  /** El trámite no existe (404): reintentar no sirve, el camino es volver al listado. */
  noExiste: boolean;
}

/**
 * Estado del panel de contenido por localidad. Viaja dentro del stream para que el
 * template lea un objeto coherente en vez de tres campos mutados por separado.
 */
interface VistaLocalidades {
  cargando: boolean;
  error: boolean;
  items: ContenidoLocalidadVM[];
  disponibles: RefVM[];
}

const LOCALIDADES_VACIO: VistaLocalidades = { cargando: false, error: false, items: [], disponibles: [] };

/** Campos del sub-formulario de contenido por localidad. */
type CampoLocalidad = 'localidadId' | 'costos' | 'contacto' | 'horarios' | 'urlTramite' | 'sitioWeb' | 'notas';

/** URL absoluta con esquema y dominio: es lo que el portal público necesita para linkear. */
const URL_ABSOLUTA = /^https?:\/\/\S+\.\S+$/i;

/** Los campos de URL del sub-formulario son opcionales; si hay texto, tiene que ser una URL. */
function urlAbsoluta(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  if (!valor) return null;
  return URL_ABSOLUTA.test(valor) ? null : { url: true };
}

/**
 * Alta y edición de un trámite: la ficha provincial (formulario dinámico) y, solo en
 * edición, el contenido específico por localidad.
 *
 * Nada se dibuja hasta que `getFormData()` resolvió: mientras cargan los catálogos el
 * formulario no existe, así que no se puede escribir en él ni perder lo escrito cuando
 * llegan los datos. Si la carga falla, la pantalla lo dice en vez de mostrar un
 * formulario vacío que en edición parecería un alta.
 */
@Component({
  selector: 'app-tramite-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTabsModule,
    MatTooltipModule,
    DynamicFormComponent,
    FormErrorBannerComponent,
    LoadingComponent,
  ],
  templateUrl: './tramite-form.component.html',
  styleUrls: ['./tramite-form.component.scss'],
})
export class TramiteFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly facade = inject(TramitesFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild(DynamicFormComponent) private dynamicForm?: DynamicFormComponent;

  config: FormConfig = getFormConfig('TRAMITE');
  isEdit = false;
  cargando = true;
  errorCarga: ErrorCarga | null = null;
  saving = false;
  /** Motivo del último fallo de guardado, para mostrarlo dentro del formulario. */
  serverError = '';
  tramite: TramiteVM | null = null;
  initialData: Record<string, unknown> | null = null;

  // ── Contenido por localidad ───────────────────────────────────────────────

  agregandoLocalidad = false;
  localidadEnEdicion: ContenidoLocalidadVM | null = null;
  guardandoLocalidad = false;
  /** Motivo del último fallo del sub-formulario (alta o edición). */
  errorLocalidad = '';
  /** Localidad con un borrado en vuelo: bloquea sus acciones mientras dura. */
  localidadTrabajandoId: number | null = null;

  readonly localidadForm = new FormGroup({
    localidadId: new FormControl<number | string | null>(null, Validators.required),
    costos: new FormControl('', { nonNullable: true }),
    contacto: new FormControl('', { nonNullable: true }),
    horarios: new FormControl('', { nonNullable: true }),
    urlTramite: new FormControl('', { nonNullable: true, validators: urlAbsoluta }),
    sitioWeb: new FormControl('', { nonNullable: true, validators: urlAbsoluta }),
    notas: new FormControl('', { nonNullable: true }),
  });

  private editId: string | null = null;
  /** Se emite después de cada alta, edición o borrado para volver a pedir la lista. */
  private readonly recargarLocalidades$ = new BehaviorSubject<void>(undefined);

  /**
   * Listado + localidades todavía sin contenido propio. Las dos fuentes se piden juntas
   * porque el select del alta depende de la lista: si una falla, el panel entero lo dice
   * (antes las dos operaciones fallaban sin rama `error` y el panel quedaba vacío).
   */
  readonly localidades$: Observable<VistaLocalidades> = this.recargarLocalidades$.pipe(
    switchMap(() => {
      if (!this.editId) return of(LOCALIDADES_VACIO);
      return combineLatest([
        this.facade.listContenidoLocalidad(this.editId),
        this.facade.localidadesDisponibles(this.editId),
      ]).pipe(
        map(([items, disponibles]): VistaLocalidades => ({ cargando: false, error: false, items, disponibles })),
        catchError(() => of({ ...LOCALIDADES_VACIO, error: true })),
        startWith({ ...LOCALIDADES_VACIO, cargando: true }),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;
    this.cargar();
  }

  /** Catálogos + trámite en una sola suscripción: un estado de carga y uno de error. */
  cargar(): void {
    this.cargando = true;
    this.errorCarga = null;
    this.cdr.markForCheck();

    this.facade.getFormData(this.editId ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ catalogos, tramite, organismoIdSugerido }) => {
          this.aplicarCatalogos(catalogos);
          this.tramite = tramite;
          // En alta, quien pertenece a un organismo arranca con el suyo puesto: es el
          // único que puede elegir, y dejarlo vacío lo obligaba a buscarse en una lista
          // completa con riesgo de elegir otro.
          this.initialData = tramite
            ? this.aDatosIniciales(tramite)
            : (organismoIdSugerido ? { organismoId: organismoIdSugerido } : null);
          this.cargando = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.cargando = false;
          this.errorCarga = this.aErrorDeCarga(err);
          this.cdr.markForCheck();
        },
      });
  }

  private aplicarCatalogos(catalogos: TramiteCatalogos): void {
    const opciones = (refs: RefVM[]) => refs.map((ref) => ({ id: ref.id, name: ref.nombre }));
    this.config = updateFormConfigOptions(this.config, 'organismoId', opciones(catalogos.organismos));
    this.config = updateFormConfigOptions(this.config, 'modalidadId', opciones(catalogos.modalidades));
    this.config = updateFormConfigOptions(this.config, 'etiquetaIds', opciones(catalogos.etiquetas));
    this.config = updateFormConfigOptions(this.config, 'categoriaIds', opciones(catalogos.categorias));
    this.config = updateFormConfigOptions(this.config, 'destinatarioIds', opciones(catalogos.destinatarios));
    this.config = updateFormConfigOptions(this.config, 'localidadIds', opciones(catalogos.localidades));
    this.config = updateFormConfigOptions(this.config, 'eventoDeVidaIds', opciones(catalogos.eventosDeVida));
  }

  private aDatosIniciales(tramite: TramiteVM): Record<string, unknown> {
    return {
      titulo: tramite.titulo,
      resumen: tramite.resumen ?? '',
      descripcionLarga: tramite.descripcionLarga ?? '',
      requisitos: tramite.requisitos ?? '',
      costos: tramite.costos ?? '',
      formularios: tramite.formularios ?? '',
      contacto: tramite.contacto ?? '',
      sitioWebTramite: tramite.sitioWebTramite ?? '',
      urlOficial: tramite.urlOficial,
      organismoId: tramite.organismoId,
      modalidadId: tramite.modalidadId,
      icono: tramite.icono,
      categoriaIds: tramite.categorias.map((c) => c.id),
      etiquetaIds: tramite.etiquetas.map((e) => e.id),
      destinatarioIds: tramite.destinatarios.map((d) => d.id),
      localidadIds: tramite.localidades.map((l) => l.id),
      eventoDeVidaIds: tramite.eventosDeVida.map((e) => e.id),
      destacado: tramite.destacado,
    };
  }

  /**
   * `status` se lee por forma y no por `HttpErrorResponse`: la pantalla no tiene por qué
   * conocer el transporte, solo distinguir "no existe" de "no se pudo traer".
   */
  private aErrorDeCarga(err: unknown): ErrorCarga {
    const status = (err as { status?: number } | null)?.status;
    if (this.isEdit && status === 404) {
      return {
        noExiste: true,
        titulo: 'Ese trámite no existe',
        texto: 'Puede que lo hayan eliminado o que el enlace esté mal escrito. Buscalo en el listado.',
      };
    }
    return {
      noExiste: false,
      titulo: this.isEdit ? 'No pudimos cargar el trámite' : 'No pudimos cargar el formulario',
      texto: 'Falló la carga de los datos y los campos quedarían incompletos. Revisá tu conexión e intentá de nuevo. Si sigue, avisá a Soporte.',
    };
  }

  // ── Guardado de la ficha ──────────────────────────────────────────────────

  onSubmit(data: Record<string, unknown>): void {
    this.saving = true;
    this.serverError = '';

    const form: TramiteFormValue = {
      titulo: String(data['titulo'] ?? ''),
      resumen: String(data['resumen'] ?? ''),
      descripcionLarga: this.texto(data['descripcionLarga']),
      requisitos: this.texto(data['requisitos']),
      costos: this.texto(data['costos']),
      formularios: this.texto(data['formularios']),
      contacto: this.texto(data['contacto']),
      sitioWebTramite: this.texto(data['sitioWebTramite']),
      urlOficial: String(data['urlOficial'] ?? ''),
      organismoId: String(data['organismoId'] ?? ''),
      modalidadId: Number(data['modalidadId'] ?? 0),
      icono: String(data['icono'] ?? ''),
      etiquetaIds: this.ids(data['etiquetaIds']),
      categoriaIds: this.ids(data['categoriaIds']),
      destinatarioIds: this.ids(data['destinatarioIds']),
      localidadIds: this.ids(data['localidadIds']),
      eventoDeVidaIds: this.ids(data['eventoDeVidaIds']),
      destacado: data['destacado'] === true,
    };

    const request$ = this.isEdit ? this.facade.update(this.editId!, form) : this.facade.create(form);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'Trámite actualizado' : 'Trámite creado correctamente',
            'OK',
            { duration: 3000, panelClass: 'snackbar-success' },
          );
          this.router.navigate([RUTA_LISTA]);
        },
        // Sin esta rama el botón volvía a habilitarse y no había forma de saber qué pasó.
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = extractErrorMessage((err as { error?: unknown })?.error)
            || 'No se pudo guardar el trámite. Revisá los datos e intentá de nuevo.';
          this.cdr.markForCheck();
        },
      });
  }

  private texto(valor: unknown): string | undefined {
    const texto = String(valor ?? '').trim();
    return texto || undefined;
  }

  private ids(valor: unknown): number[] {
    return Array.isArray(valor) ? valor.map(Number) : [];
  }

  volverAlListado(): void {
    this.router.navigate([RUTA_LISTA]);
  }

  /**
   * Lo consulta `unsavedChangesGuard` antes de dejar salir de la pantalla.
   * Durante un guardado en curso `saving` sigue en true hasta que la navegación de
   * éxito ocurre, así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    if (this.saving || this.guardandoLocalidad) return false;
    const subformAbierto = this.agregandoLocalidad || !!this.localidadEnEdicion;
    return !!this.dynamicForm?.form?.dirty || (subformAbierto && this.localidadForm.dirty);
  }

  // ── Contenido por localidad ───────────────────────────────────────────────

  recargarLocalidades(): void {
    this.recargarLocalidades$.next();
  }

  empezarAlta(): void {
    this.localidadEnEdicion = null;
    this.agregandoLocalidad = true;
    this.errorLocalidad = '';
    this.localidadForm.reset({ costos: '', contacto: '', horarios: '', urlTramite: '', sitioWeb: '', notas: '' });
    this.localidadForm.controls.localidadId.enable();
  }

  empezarEdicion(item: ContenidoLocalidadVM): void {
    this.agregandoLocalidad = false;
    this.localidadEnEdicion = item;
    this.errorLocalidad = '';
    this.localidadForm.reset({
      localidadId: item.localidadId,
      costos: item.costos ?? '',
      contacto: item.contacto ?? '',
      horarios: item.horarios ?? '',
      urlTramite: item.urlTramite ?? '',
      sitioWeb: item.sitioWeb ?? '',
      notas: item.notas ?? '',
    });
    // Cambiar de localidad sería otro registro: se edita el contenido, no a quién pertenece.
    this.localidadForm.controls.localidadId.disable();
  }

  cerrarSubformulario(): void {
    this.agregandoLocalidad = false;
    this.localidadEnEdicion = null;
    this.errorLocalidad = '';
    this.localidadForm.reset();
    this.localidadForm.controls.localidadId.enable();
  }

  /**
   * El campo se evalúa recién cuando el usuario lo dejó (`touched`), no mientras escribe;
   * un intento de guardado inválido marca todo como tocado y ahí sí se señalan todos.
   */
  campoInvalido(nombre: CampoLocalidad): boolean {
    const control = this.localidadForm.controls[nombre];
    return control.invalid && control.touched;
  }

  guardarLocalidad(): void {
    if (this.guardandoLocalidad || !this.editId) return;

    if (this.localidadForm.invalid) {
      this.localidadForm.markAllAsTouched();
      this.errorLocalidad = 'Revisá los campos marcados para poder guardar.';
      this.cdr.markForCheck();
      return;
    }

    const valor = this.localidadForm.getRawValue();
    const form: ContenidoLocalidadFormValue = {
      localidadId: Number(valor.localidadId),
      costos: valor.costos.trim() || undefined,
      contacto: valor.contacto.trim() || undefined,
      horarios: valor.horarios.trim() || undefined,
      urlTramite: valor.urlTramite.trim() || undefined,
      sitioWeb: valor.sitioWeb.trim() || undefined,
      notas: valor.notas.trim() || undefined,
    };

    const editando = !!this.localidadEnEdicion;
    const accion$ = editando
      ? this.facade.updateContenidoLocalidad(this.editId, form.localidadId, form)
      : this.facade.addContenidoLocalidad(this.editId, form);

    this.guardandoLocalidad = true;
    this.errorLocalidad = '';
    this.cdr.markForCheck();

    accion$
      .pipe(
        finalize(() => { this.guardandoLocalidad = false; this.cdr.markForCheck(); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open(
            editando ? 'Contenido de la localidad actualizado' : 'Localidad agregada',
            'OK',
            { duration: 3000, panelClass: 'snackbar-success' },
          );
          this.cerrarSubformulario();
          this.recargarLocalidades();
        },
        error: (err: unknown) => {
          this.errorLocalidad = extractErrorMessage((err as { error?: unknown })?.error)
            || (editando
              ? 'No se pudo actualizar el contenido de la localidad. Intentá de nuevo.'
              : 'No se pudo agregar la localidad. Intentá de nuevo.');
          this.cdr.markForCheck();
        },
      });
  }

  eliminarLocalidad(item: ContenidoLocalidadVM): void {
    if (!this.editId) return;

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar el contenido de la localidad?',
        message: `Se eliminará el contenido específico de ${item.localidadNombre} y el trámite volverá a mostrar los valores provinciales. Esta acción no se puede deshacer.`,
        highlight: item.localidadNombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando...',
        // El diálogo se queda abierto con el botón en spinner hasta que el backend responde:
        // si falla, el aviso sale acá en vez de perderse con el diálogo ya cerrado.
        confirmAction: () => {
          this.localidadTrabajandoId = item.localidadId;
          this.cdr.markForCheck();
          return this.facade.removeContenidoLocalidad(this.editId!, item.localidadId).pipe(
            catchError((err: unknown) => {
              this.snackBar.open(
                extractErrorMessage((err as { error?: unknown })?.error)
                  || `No se pudo eliminar el contenido de ${item.localidadNombre}.`,
                'Cerrar',
                { duration: 6000, panelClass: 'snackbar-error' },
              );
              return throwError(() => err);
            }),
            finalize(() => { this.localidadTrabajandoId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((eliminado) => {
        if (!eliminado) return;
        this.snackBar.open('Contenido de localidad eliminado', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
        if (this.localidadEnEdicion?.id === item.id) this.cerrarSubformulario();
        this.recargarLocalidades();
      });
  }
}
