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
import { FormErrorBannerComponent } from '../../../../shared/components/form-error-banner/form-error-banner.component';
import { LoadingComponent } from '../../../../shared/components/loading/loading.component';
import { EstadoBadgeComponent } from '../../../../shared/components/estado-badge/estado-badge.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import { FichaFormData, FichaLocalFormValue, FichaLocalVM, FichasLocalesFacade } from '@features/fichas-locales';
import { RUTA_DETALLE_ADOPCION, RUTA_LISTA_ADOPCIONES } from '../../adopciones/adopciones.rutas';
import { CONFLICTOS_FICHA, FALLBACK_FICHA, NO_DISPONIBLE, TEXTOS_FICHA_INEXISTENTE, esFichaInexistente } from '../ficha-save-error';
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
 * Alta y edición de una ficha por localidad. Formulario reactivo propio.
 *
 * - Localidad solo en alta (cambiarla sería otra ficha). Las que ya tienen ficha activa en esta
 *   adopción no se pueden elegir (G-9: el backend no tiene UNIQUE).
 * - Slug sugerido `slugBase-localidad` y editable (P-5), validado contra los demás slugs activos.
 * - Sin estado: guardar NUNCA cambia el estado de publicación (R-1); eso es del workflow, en el detalle.
 * - Editar una ficha PUBLICADA cambia el portal al guardar (P-6): se avisa.
 * - Una ficha PUBLICADA (y activa) no se desactiva desde acá: el toggle "Activa" queda bloqueado y remite
 *   a "Desactivar" del detalle. Ese camino (DELETE) además la despublica; el PUT del form copia el estado
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
    FormErrorBannerComponent,
    LoadingComponent,
    EstadoBadgeComponent,
    HasPermissionDirective,
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

  onSubmit(): void {
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
    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (guardada) => {
          this.snackBar.open(this.textoGuardada(guardada), 'OK', { duration: 4000, panelClass: 'snackbar-success' });
          // Si la navegación no ocurre (p. ej. un guard la frena), el form no queda bloqueado.
          this.router.navigate([RUTA_DETALLE_FICHA, guardada.id]).then((ok) => {
            if (ok) return;
            this.saving = false;
            this.form.markAsPristine();
            this.cdr.markForCheck();
          });
        },
        error: (err: unknown) => {
          this.saving = false;
          this.serverError = aplicarErrorDeGuardado(err, this.form, CONFLICTOS_FICHA, FALLBACK_FICHA);
          this.cdr.markForCheck();
        },
      });
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
    const campos: { nombre: CampoConResumen; label: string }[] = [
      { nombre: 'localidadId', label: 'Localidad' },
      { nombre: 'slug', label: 'Slug' },
      { nombre: 'url', label: 'URL' },
      { nombre: 'activa', label: 'Activa' },
    ];
    return campos
      .filter(({ nombre }) => this.form.controls[nombre].invalid)
      .map(({ nombre, label }) => `${label} (${this.motivo(this.form.controls[nombre])})`);
  }

  /**
   * Lo consulta `unsavedChangesGuard`. Durante un guardado `saving` sigue en true hasta que navega,
   * así que un guardado exitoso no dispara la pregunta.
   */
  tieneCambiosSinGuardar(): boolean {
    return !this.saving && this.form.dirty;
  }

  private motivo(control: AbstractControl): string {
    if (control.hasError('required')) return 'obligatorio';
    if (control.hasError('maxlength')) return `máximo ${control.errors?.['maxlength']?.requiredLength} caracteres`;
    if (control.hasError('slugVacio')) return 'tiene que tener letras o números';
    if (control.hasError('slugRepetido')) return 'ya lo usa otra ficha';
    if (control.hasError('localidadOcupada')) return 'ya tiene una ficha de este trámite';
    if (control.hasError('reactivaDuplicada')) return 'la localidad ya tiene otra ficha activa de este trámite';
    if (control.hasError('url')) return 'tiene que empezar con http:// o https://';
    if (control.hasError('server')) return String(control.errors?.['server']);
    return 'inválido';
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
