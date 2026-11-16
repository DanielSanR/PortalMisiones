import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Observable, Subscription, defer, map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormActionsComponent } from '../../../../shared/components/form-actions/form-actions.component';
import { FormErrorBannerComponent } from '../../../../shared/components/form-error-banner/form-error-banner.component';
import { FormErrorMessageDirective } from '../../../../shared/components/dynamic-form-field/FormErrorMessage.directive';
import { getControlErrorMessage, resumenDeErrores } from '../../../../shared/components/dynamic-form-field/form-error-messages.util';
import { LoadingComponent } from '../../../../shared/components/loading/loading.component';
import { EstadoBadgeComponent } from '../../../../shared/components/estado-badge/estado-badge.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { UnavailableDirective } from '../../../../shared/directives/unavailable.directive';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { FieldConfig } from '@core/models/field.interface';
import { esPantallaDestruida, unaVez } from '@core/utils/one-shot.utils';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import { FichaFormData, FichaLocalFormValue, FichaLocalVM, FichasLocalesFacade } from '@features/fichas-locales';
import { RUTA_DETALLE_ADOPCION, RUTA_LISTA_ADOPCIONES } from '../../adopciones/adopciones.rutas';
import { textoRecomendados } from '../../plantillas/plantilla-recomendados';
import { CONFLICTOS_FICHA, FALLBACK_FICHA, NO_DISPONIBLE, TEXTOS_FICHA_INEXISTENTE, esFichaInexistente } from '../ficha-save-error';
import { QUIEN_PUBLICA } from '../ficha-textos';
import { RUTA_DETALLE_FICHA, RUTA_LISTA_FICHAS } from '../fichas.rutas';
import { PuntosAtencionPanelComponent } from '../puntos-atencion-panel/puntos-atencion-panel.component';

/** Largo máximo del slug (la columna es VARCHAR sin largo, pero el slug va en una URL). */
const MAX_SLUG = 255;

/** Una URL absoluta http(s), sin espacios. */
const PATRON_URL = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

/** Motivo por el que la pantalla no pudo dibujarse, ya traducido. */
interface ErrorCarga {
  titulo: string;
  texto: string;
  /** Reintentar no sirve (no existe, falta la adopción, o el backend no devuelve el contenido). */
  definitivo: boolean;
  /** A dónde lleva el botón secundario. */
  volverA: 'fichas' | 'adopciones';
}

/** El slug tiene que dejar algo después de canonicalizarlo ("¡¡¡" no sirve). */
function slugUtilizable(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '');
  if (!valor.trim()) return null; // lo cubre `required`
  return canonicalizarSlug(valor) ? null : { slugVacio: true };
}

function urlValida(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  if (!valor) return null;
  return PATRON_URL.test(valor) ? null : { url: true };
}

type CampoConResumen = 'localidadId' | 'slug' | 'url' | 'activa';

/**
 * Los campos que validan, descritos como los de `app-dynamic-form`: así el mensaje de cada error sale
 * de `form-error-messages.util` (un solo lugar para el `<mat-error>` del campo y el banner resumen).
 * `mensajes` trae el texto de los validadores propios de esta pantalla.
 */
const CAMPOS: Record<CampoConResumen, FieldConfig> = {
  localidadId: {
    name: 'localidadId', label: 'Localidad', type: 'select',
    validations: {
      mensajes: { required: 'Elegí una localidad', localidadOcupada: 'Esa localidad ya tiene una ficha de este trámite' },
    },
  },
  slug: {
    name: 'slug', label: 'Slug', type: 'text',
    validations: {
      maxLength: MAX_SLUG,
      mensajes: { required: 'El slug es obligatorio', slugRepetido: 'Ya lo usa otra ficha. Elegí otro.' },
    },
  },
  url: {
    name: 'url', label: 'URL', type: 'url',
    validations: { mensajes: { url: 'Tiene que empezar con http:// o https://' } },
  },
  activa: {
    name: 'activa', label: 'Activa', type: 'checkbox',
    validations: { mensajes: { reactivaDuplicada: 'La localidad ya tiene otra ficha activa de este trámite' } },
  },
};

/** Lo que el membrete y el pie muestran del formulario en vivo. */
interface VistaFicha {
  /** Título de la plantilla; vacío si no se pudo leer. */
  titulo: string;
  organismo: string;
  /** Nombre de la localidad elegida; vacío si todavía no hay. */
  localidad: string;
  /** Slug como se va a guardar (canónico). */
  slug: string;
  activa: boolean;
  recomendadosCompletos: boolean;
  recomendado: string;
}

/**
 * Alta y edición de una ficha por localidad. Formulario reactivo propio, con el layout de ficha del
 * design system (como Plantilla): membrete en vivo y una tarjeta de dos paneles (datos | puntos de atención,
 * o "qué sigue" en el alta) con el pie de guardar compartido. Los puntos se guardan aparte, con su propio flujo.
 *
 * - Localidad solo en alta (cambiarla sería otra ficha). Las que ya tienen ficha activa en esta
 *   adopción no se pueden elegir (G-9: el backend no tiene UNIQUE). Si la fuente no dice a qué adopción
 *   pertenece cada ficha (G-1, `ocupadas.localidadesVerificables = false`), no se afirma que estén libres:
 *   se avisa que el duplicado no se puede validar.
 * - Slug sugerido `slugBase-localidad` y editable (P-5), validado contra los demás slugs activos.
 * - Sin estado: guardar NUNCA cambia el estado de publicación (R-1); eso es del workflow, en el detalle.
 * - Editar una ficha PUBLICADA cambia el portal al guardar (P-6): se avisa.
 * - Una ficha PUBLICADA (y activa) no se desactiva desde acá: el interruptor "Ficha activa" queda bloqueado
 *   (`appUnavailable`, con el motivo) y remite a "Desactivar" del detalle. Ese camino (DELETE) además la despublica; el PUT del form copia el estado
 *   (R-1) y la dejaría inactiva pero PUBLICADO. Así "Guardar no cambia el estado" sigue siendo cierto.
 * - Con el response mínimo del backend (G-1) la ficha no se puede editar: el PUT total borraría
 *   requisitos, costos y URL. Se muestra un panel en vez del form.
 *
 * Nada se dibuja hasta que `getFormData()` resolvió, para no pisar una ficha con un form vacío.
 */
@Component({
  selector: 'app-ficha-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
    FormActionsComponent,
    FormErrorBannerComponent,
    FormErrorMessageDirective,
    LoadingComponent,
    EstadoBadgeComponent,
    HasPermissionDirective,
    UnavailableDirective,
    PuntosAtencionPanelComponent,
  ],
  templateUrl: './ficha-form.component.html',
  styleUrl: './ficha-form.component.scss',
})
export class FichaFormComponent implements OnInit, PuedeTenerCambiosSinGuardar {
  private readonly facade = inject(FichasLocalesFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly maxSlug = MAX_SLUG;
  readonly noDisponible = NO_DISPONIBLE;
  readonly rutaAdopcion = RUTA_DETALLE_ADOPCION;
  readonly rutaLista = RUTA_LISTA_FICHAS;
  readonly quienPublica = QUIEN_PUBLICA;
  readonly campos = CAMPOS;
  /** Por qué el interruptor "Ficha activa" no se puede apagar acá (tooltip y texto de ayuda). */
  readonly motivoActivaBloqueada =
    'Está publicada: para desactivarla usá "Desactivar" en el detalle de la ficha, que además la quita del portal.';

  readonly form = new FormGroup({
    localidadId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, (c) => this.localidadOcupada(c)],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_SLUG), slugUtilizable, (c) => this.slugRepetido(c)],
    }),
    url: new FormControl('', { nonNullable: true, validators: urlValida }),
    requisitos: new FormControl('', { nonNullable: true }),
    costos: new FormControl('', { nonNullable: true }),
    activa: new FormControl(true, { nonNullable: true, validators: (c) => this.reactivaDuplicada(c) }),
  });

  isEdit = false;
  cargando = true;
  errorCarga: ErrorCarga | null = null;
  saving = false;
  /** true tras un intento de envío inválido: habilita el banner resumen. */
  submitted = false;
  serverError = '';
  datos: FichaFormData | null = null;

  /** Mientras sea false, el slug sigue a la localidad elegida (solo en alta). */
  private slugManual = false;
  private editId: string | null = null;
  private adopcionId: string | null = null;
  /** Carga en vuelo: reintentar la cancela, para que una respuesta vieja no pise a la nueva. */
  private carga: Subscription | null = null;

  /** Cómo se va a guardar el slug, si difiere de lo tipeado. */
  readonly slugPrevisto$: Observable<string | null> = defer(() =>
    this.form.controls.slug.valueChanges.pipe(startWith(this.form.controls.slug.value)),
  ).pipe(
    map((valor) => {
      const canonico = canonicalizarSlug(valor);
      return canonico && canonico !== valor ? canonico : null;
    }),
  );

  /**
   * Resumen del form en vivo. Se suscribe recién cuando `datos` ya llegó (el template lo dibuja después
   * de la carga), y `startWith` le da el valor con el que abrió.
   */
  readonly vista$: Observable<VistaFicha> = defer(() => this.form.valueChanges.pipe(startWith(null))).pipe(
    map(() => this.aVista()),
  );

  get ficha(): FichaLocalVM | null {
    return this.datos?.ficha ?? null;
  }

  /** P-6: guardar cambia lo que ya se ve en el portal. */
  get editaPublicada(): boolean {
    return !!this.ficha && this.ficha.estado === 'PUBLICADO' && this.ficha.activa;
  }

  /** Publicada y activa: el toggle "Activa" se bloquea y remite a "Desactivar" (que también despublica). */
  get desactivarSoloDesdeDetalle(): boolean {
    return this.editaPublicada;
  }

  ngOnInit(): void {
    this.editId = this.route.snapshot.params['id'] ?? null;
    this.isEdit = !!this.editId;
    this.adopcionId = this.route.snapshot.queryParamMap.get('adopcion');
    this.slugManual = this.isEdit;

    this.form.controls.localidadId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.slugManual) this.form.controls.slug.setValue(this.slugSugerido());
      });

    this.cargar();
  }

  cargar(): void {
    if (!this.isEdit && !this.adopcionId) {
      this.cargando = false;
      this.errorCarga = {
        titulo: 'Elegí primero el trámite del organismo',
        texto: 'Una ficha por localidad cuelga de un trámite del organismo. Entrá a uno y usá "Agregar localidad".',
        definitivo: true,
        volverA: 'adopciones',
      };
      return;
    }

    this.cargando = true;
    this.errorCarga = null;
    this.cdr.markForCheck();

    this.carga?.unsubscribe();
    this.carga = this.facade.getFormData(this.editId, this.adopcionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => {
          this.datos = datos;
          if (datos.ficha && !datos.ficha.contenidoCompleto) {
            this.errorCarga = {
              titulo: 'Esta ficha todavía no se puede editar',
              texto: 'El servidor no devuelve su localidad, URL, requisitos ni costos: guardar los borraría. '
                + 'Se va a poder editar cuando el backend complete la respuesta de la ficha.',
              definitivo: true,
              volverA: 'fichas',
            };
          } else if (datos.ficha) {
            this.form.reset({
              localidadId: datos.ficha.localidadId ?? '',
              slug: datos.ficha.slug,
              url: datos.ficha.url ?? '',
              requisitos: datos.ficha.requisitos ?? '',
              costos: datos.ficha.costos ?? '',
              activa: datos.ficha.activa,
            });
            this.form.controls.localidadId.disable();
            // Ver la nota de la clase: desactivar una publicada es la acción "Desactivar" del detalle.
            if (this.desactivarSoloDesdeDetalle) this.form.controls.activa.disable();
          }
          // Los validadores de duplicados leen `datos`, que recién llegó: se re-ejecutan en cada control.
          for (const control of [this.form.controls.localidadId, this.form.controls.slug, this.form.controls.activa]) {
            control.updateValueAndValidity({ emitEvent: false });
          }
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

  /** El usuario tocó el slug: deja de seguir a la localidad (salvo que lo vacíe del todo). */
  onSlugEditado(): void {
    this.slugManual = this.isEdit || this.form.controls.slug.value.trim() !== '';
  }

  /** Vuelve a sugerir el slug: `slugBase-localidad` (P-5). */
  sugerirSlug(): void {
    const slug = this.form.controls.slug;
    slug.setValue(this.slugSugerido());
    slug.markAsDirty();
    slug.markAsTouched();
    this.slugManual = this.isEdit;
  }

  get puedeSugerir(): boolean {
    return !!this.slugSugerido();
  }

  /** ¿La localidad ya tiene una ficha activa en esta adopción? (para deshabilitar la opción). */
  ocupada(localidadId: string): boolean {
    return !!this.datos?.ocupadas.localidadIds.includes(localidadId);
  }

  get sinCambios(): boolean {
    return this.isEdit && this.form.pristine;
  }

  async onSubmit(): Promise<void> {
    if (this.saving || !this.datos) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitted = true;
      this.cdr.markForCheck();
      return;
    }

    const adopcionId = this.ficha?.adopcionId ?? this.adopcionId;
    if (!adopcionId) return;

    this.submitted = false;
    this.saving = true;
    this.serverError = '';
    const valor = this.form.getRawValue();
    const form: FichaLocalFormValue = {
      adopcionId,
      localidadId: valor.localidadId,
      slug: valor.slug,
      url: valor.url,
      requisitos: valor.requisitos,
      costos: valor.costos,
      activa: valor.activa,
    };

    const request$ = this.isEdit ? this.facade.update(this.editId!, form) : this.facade.create(form);
    // Guardado one-shot (`unaVez`), igual que en Plantilla: el único rechazo que se ignora es que la pantalla
    // ya no exista; cualquier otro apaga `saving` y se muestra en el formulario.
    let guardada: FichaLocalVM;
    try {
      guardada = await unaVez(request$, this.destroyRef);
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return; // se destruyó con el guardado en vuelo: no hay a quién avisar
      this.saving = false;
      this.serverError = aplicarErrorDeGuardado(err, this.form, CONFLICTOS_FICHA, FALLBACK_FICHA);
      this.cdr.markForCheck();
      return;
    }

    this.snackBar.open(this.textoGuardada(guardada), 'OK', { duration: 4000, panelClass: 'snackbar-success' });
    // Si la navegación no ocurre (un guard la frena, o falla al resolver), el form no queda bloqueado.
    const navego = await this.router.navigate([RUTA_DETALLE_FICHA, guardada.id]).catch(() => false);
    if (navego) return;
    this.saving = false;
    this.form.markAsPristine();
    // Un alta que no navegó deja de ser alta: la ficha ya existe, así que la pantalla pasa a editarla.
    // Sin esto, otro clic en "Crear ficha" la crearía por segunda vez.
    if (!this.isEdit) {
      this.editId = guardada.id;
      this.isEdit = true;
      this.slugManual = true;
      this.cargar();
    }
    this.cdr.markForCheck();
  }

  cancelar(): void {
    if (this.isEdit && this.editId) {
      this.router.navigate([RUTA_DETALLE_FICHA, this.editId]);
      return;
    }
    if (this.adopcionId) {
      this.router.navigate([RUTA_DETALLE_ADOPCION, this.adopcionId]);
      return;
    }
    this.router.navigate([RUTA_LISTA_FICHAS]);
  }

  volver(): void {
    this.router.navigate([this.errorCarga?.volverA === 'adopciones' ? RUTA_LISTA_ADOPCIONES : RUTA_LISTA_FICHAS]);
  }

  campoInvalido(nombre: CampoConResumen): boolean {
    const control = this.form.controls[nombre];
    return control.invalid && control.touched;
  }

  /** Mensajes "Campo (motivo)" para el banner resumen — solo tras un intento de envío inválido. */
  get errorSummary(): string[] {
    if (!this.submitted) return [];
    return resumenDeErrores(this.form, Object.values(CAMPOS), (control, campo) => getControlErrorMessage(control, campo));
  }

  /**
   * Lo consulta `unsavedChangesGuard`. Durante un guardado `saving` sigue en true hasta que navega,
   * así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.saving && this.form.dirty;
  }

  private aVista(): VistaFicha {
    // `getRawValue`: en edición la localidad (y a veces "activa") están deshabilitadas.
    const valor = this.form.getRawValue();
    const localidad = this.datos?.localidades.find((l) => l.id === valor.localidadId);
    // Informativo, no bloquea el guardado: lo que el ciudadano necesita encontrar en la ficha.
    const recomendados = [
      { etiqueta: 'Requisitos', completo: !!valor.requisitos.trim() },
      { etiqueta: 'Costos', completo: !!valor.costos.trim() },
      { etiqueta: 'URL', completo: !!valor.url.trim() },
    ];
    return {
      titulo: this.datos?.adopcion?.plantillaTitulo ?? this.ficha?.plantillaTitulo ?? '',
      organismo: this.datos?.adopcion?.organismoNombre ?? this.ficha?.organismoNombre ?? '',
      localidad: localidad?.nombre ?? this.ficha?.localidadNombre ?? '',
      slug: canonicalizarSlug(valor.slug),
      activa: valor.activa,
      recomendadosCompletos: recomendados.every((dato) => dato.completo),
      recomendado: textoRecomendados(recomendados),
    };
  }

  private textoGuardada(guardada: FichaLocalVM): string {
    if (!this.isEdit) return 'Ficha creada en borrador. Cuando esté lista, enviala a revisión';
    if (!guardada.activa) return 'Cambios guardados. La ficha está desactivada';
    return guardada.estado === 'PUBLICADO' ? 'Cambios guardados. Ya se ven en el portal' : 'Cambios guardados';
  }

  /** `slugBase-localidad`, canonicalizado. Vacío si todavía no hay localidad elegida. */
  private slugSugerido(): string {
    const localidad = this.datos?.localidades.find((l) => l.id === this.form.controls.localidadId.value);
    if (!localidad) return '';
    return canonicalizarSlug([this.datos?.adopcion?.plantillaSlug, localidad.nombre].filter(Boolean).join('-'));
  }

  private localidadOcupada(control: AbstractControl): ValidationErrors | null {
    if (this.isEdit || !control.value) return null;
    return this.ocupada(String(control.value)) ? { localidadOcupada: true } : null;
  }

  /**
   * Reactivar (en edición) una ficha desactivada cuya localidad ya tiene otra ficha activa de la misma
   * adopción dejaría dos activas (G-9: el backend no lo impide).
   */
  private reactivaDuplicada(control: AbstractControl): ValidationErrors | null {
    const ficha = this.datos?.ficha;
    if (!this.isEdit || !ficha || ficha.activa || !control.value || !ficha.localidadId) return null;
    return this.ocupada(ficha.localidadId) ? { reactivaDuplicada: true } : null;
  }

  private slugRepetido(control: AbstractControl): ValidationErrors | null {
    const canonico = canonicalizarSlug(String(control.value ?? ''));
    if (!canonico || !this.datos) return null;
    return this.datos.ocupadas.slugs.includes(canonico) ? { slugRepetido: true } : null;
  }

  private aErrorDeCarga(err: unknown): ErrorCarga {
    if (esFichaInexistente(err)) {
      return {
        definitivo: true,
        volverA: this.isEdit ? 'fichas' : 'adopciones',
        ...(this.isEdit
          ? TEXTOS_FICHA_INEXISTENTE
          : { titulo: 'Ese trámite del organismo no existe', texto: 'Puede que el enlace esté mal escrito o que no sea de tu organismo.' }),
      };
    }
    return {
      definitivo: false,
      volverA: this.isEdit ? 'fichas' : 'adopciones',
      titulo: this.isEdit ? 'No pudimos cargar la ficha' : 'No pudimos cargar el formulario',
      texto: 'Los campos quedarían incompletos. Revisá tu conexión e intentá de nuevo. Si sigue, avisá a Soporte.',
    };
  }
}
