import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Observable, Subject, Subscription, catchError, defer, forkJoin, map, of, startWith, switchMap, tap } from 'rxjs';
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
import { TreeSelectComponent } from '../../../../shared/components/tree-select/tree-select.component';
import { EstadoBadgeComponent } from '../../../../shared/components/estado-badge/estado-badge.component';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { UnavailableDirective } from '../../../../shared/directives/unavailable.directive';
import { PuedeTenerCambiosSinGuardar } from '@core/guards';
import { FieldConfig, TreeFieldConfig } from '@core/models/field.interface';
import { esPantallaDestruida, unaVez } from '@core/utils/one-shot.utils';
import { aplicarErrorDeGuardado } from '@core/utils/save-error.utils';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import {
  FichaAdopcionResumen, FichaFormData, FichaLocalFormValue, FichaLocalVM, FichasLocalesFacade,
} from '@features/fichas-locales';
import { RUTA_DETALLE_ADOPCION, RUTA_LISTA_ADOPCIONES } from '../../adopciones/adopciones.rutas';
import { textoRecomendados } from '../../plantillas/plantilla-recomendados';
import { CONFLICTOS_FICHA, FALLBACK_FICHA, NO_DISPONIBLE, TEXTOS_FICHA_INEXISTENTE, esFichaInexistente } from '../ficha-save-error';
import { QUIEN_PUBLICA, TEXTO_FUENTE_SIMULADA, textoExito } from '../ficha-textos';
import { FRAGMENTO_PUNTOS, RUTA_DETALLE_FICHA, RUTA_LISTA_FICHAS } from '../fichas.rutas';
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

type CampoConResumen = 'adopcion' | 'localidadId' | 'slug' | 'url' | 'activa';

/**
 * Los campos que validan, descritos como los de `app-dynamic-form`: así el mensaje de cada error sale
 * de `form-error-messages.util` (un solo lugar para el `<mat-error>` del campo y el banner resumen).
 * `mensajes` trae el texto de los validadores propios de esta pantalla.
 */
const CAMPOS: Record<CampoConResumen, FieldConfig> = {
  adopcion: {
    name: 'adopcion', label: 'Trámite del organismo', type: 'tree-select',
    validations: { mensajes: { required: 'Elegí el trámite del organismo' } },
  },
  localidadId: {
    name: 'localidadId', label: 'Localidad', type: 'select',
    validations: {
      mensajes: {
        required: 'Elegí una localidad',
        localidadOcupada: 'Esa localidad ya tiene una ficha de este trámite',
        localidadDesactivada: 'Esa localidad ya tiene una ficha desactivada de este trámite: reactivala en vez de crear otra',
      },
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
  /** Alta sin trámite elegido todavía: el membrete lo pide en vez de decir "no disponible". */
  sinAdopcion: boolean;
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
 * - Alta: con `?adopcion=<id>` (desde el detalle de un trámite del organismo) la adopción es fija; sin él (desde "Nueva
 *   ficha" de la lista) el primer campo es el trámite del organismo —solo los habilitados, con buscador— y recién al
 *   elegirlo se leen sus localidades ocupadas y se habilita la localidad. Si no hay ninguno habilitado, lo dice y
 *   remite a "Trámites del organismo".
 * - Localidad solo en alta (cambiarla sería otra ficha). Las que ya tienen ficha en esta adopción, activa
 *   o desactivada, no se pueden elegir: el backend tiene UNIQUE (adopción, localidad) y lo rechaza con un
 *   500 sin detalle; la desactivada se reactiva editándola. Si la fuente no dice a qué adopción
 *   pertenece cada ficha (G-1, `ocupadas.localidadesVerificables = false`), no se afirma que estén libres:
 *   se avisa que el duplicado no se puede validar.
 * - Slug sugerido `slugBase-localidad` y editable (P-5), validado contra los slugs de las demás fichas
 *   (activas o desactivadas).
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
    TreeSelectComponent,
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly maxSlug = MAX_SLUG;
  readonly noDisponible = NO_DISPONIBLE;
  readonly rutaAdopcion = RUTA_DETALLE_ADOPCION;
  readonly rutaLista = RUTA_LISTA_FICHAS;
  readonly rutaAdopciones = RUTA_LISTA_ADOPCIONES;
  /** Del detalle de la ficha: dónde se gestionan los puntos de atención (`#puntos-atencion`). */
  readonly fragmentoPuntos = FRAGMENTO_PUNTOS;
  readonly rutaDetalle = RUTA_DETALLE_FICHA;
  readonly quienPublica = QUIEN_PUBLICA;
  /** La fuente es simulada: lo que se guarde no llega al servidor (aviso persistente). */
  readonly fuenteSimulada = this.facade.fuenteSimulada;
  readonly textoFuenteSimulada = TEXTO_FUENTE_SIMULADA;
  readonly campos = CAMPOS;
  /** Por qué el interruptor "Ficha activa" no se puede apagar acá (tooltip y texto de ayuda). */
  readonly motivoActivaBloqueada =
    'Está publicada: para desactivarla usá "Desactivar" en el detalle de la ficha, que además la quita del portal.';

  readonly form = new FormGroup({
    /** Solo en alta sin `?adopcion=`: el trámite del organismo del que cuelga la ficha. Deshabilitado en el resto. */
    adopcion: new FormControl('', { nonNullable: true, validators: Validators.required }),
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
  /** Trámites del organismo habilitados que se pueden elegir (alta sin `?adopcion=`). */
  adopciones: FichaAdopcionResumen[] = [];
  /** El buscador del trámite del organismo, con lo que ofrece `adopciones`. */
  arbolAdopciones: TreeFieldConfig = {
    nodes: [], loaded: false, emptyLabel: 'Elegí un trámite del organismo', searchLabel: 'Buscar trámite u organismo',
  };
  /** Leyendo la localidad y lo ocupado del trámite recién elegido. */
  cargandoAdopcion = false;
  /** No se pudo leer el trámite elegido (conexión u otro fallo): reintentar puede servir. */
  errorAdopcion = false;
  /** El trámite elegido ya no existe o no está disponible (404): reintentar no sirve, hay que elegir otro. */
  adopcionInexistente = false;

  /** Mientras sea false, el slug sigue a la localidad elegida (solo en alta). */
  private slugManual = false;
  private editId: string | null = null;
  /** El trámite del que cuelga la ficha: el de `?adopcion=` o, en el alta sin él, el que se elige en el form. */
  private adopcionId: string | null = null;
  /** `?adopcion=` de la URL (adopción fija); `null` si el alta tiene que elegirla. */
  private adopcionFija: string | null = null;
  private readonly adopcionElegida$ = new Subject<string>();
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

  /** Alta sin `?adopcion=`: el trámite del organismo es el primer campo del formulario. */
  get eligeAdopcion(): boolean {
    return !this.isEdit && !this.adopcionFija;
  }

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
    this.adopcionFija = this.route.snapshot.queryParamMap.get('adopcion') || null;
    this.adopcionId = this.adopcionFija;
    this.slugManual = this.isEdit;

    if (this.eligeAdopcion) {
      // Hasta elegir el trámite no se sabe qué localidades están ocupadas: la localidad espera.
      this.form.controls.localidadId.disable({ emitEvent: false });
      this.form.controls.adopcion.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((id) => this.adopcionElegida$.next(id));
      this.adopcionElegida$.pipe(
        tap(() => this.alElegirAdopcion()),
        switchMap((id): Observable<LecturaAdopcion> => (id
          ? this.facade.getFormData(null, id).pipe(
            catchError((err: unknown) => of<LecturaAdopcion>(esFichaInexistente(err) ? 'inexistente' : 'fallo')),
          )
          : of<LecturaAdopcion>(null))),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe((datos) => this.adopcionLeida(datos));
    } else {
      this.form.controls.adopcion.disable({ emitEvent: false });
    }

    this.form.controls.localidadId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.slugManual) this.form.controls.slug.setValue(this.slugSugerido());
      });

    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.errorCarga = null;
    this.cdr.markForCheck();

    this.carga?.unsubscribe();
    // Alta sin `?adopcion=`: además del formulario se leen los trámites del organismo que se pueden elegir.
    const carga$ = this.eligeAdopcion
      ? forkJoin({ datos: this.facade.getFormData(null, null), adopciones: this.facade.getAdopcionesParaFicha() })
      : this.facade.getFormData(this.editId, this.adopcionId).pipe(map((datos) => ({ datos, adopciones: [] as FichaAdopcionResumen[] })));
    this.carga = carga$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ datos, adopciones }) => {
          this.datos = datos;
          this.adopciones = adopciones;
          this.arbolAdopciones = { ...this.arbolAdopciones, nodes: adopciones.map(aNodo), loaded: true };
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

  /** Reintenta leer el trámite elegido (falló la lectura de sus localidades ocupadas). */
  reintentarAdopcion(): void {
    this.adopcionElegida$.next(this.form.controls.adopcion.value);
  }

  /**
   * Cambió el trámite elegido: lo que dependía del anterior (localidad ocupada, slug sugerido, nombres) deja de
   * valer hasta que llegue la lectura del nuevo. La localidad queda bloqueada mientras tanto.
   */
  private alElegirAdopcion(): void {
    this.adopcionId = null;
    // Lo leído del trámite anterior (nombres, localidades ocupadas) ya no vale.
    if (this.datos) {
      this.datos = {
        ...this.datos,
        adopcion: null,
        ocupadas: { ...this.datos.ocupadas, localidadIds: [], localidadIdsDesactivadas: [] },
      };
    }
    this.errorAdopcion = false;
    this.adopcionInexistente = false;
    this.cargandoAdopcion = !!this.form.controls.adopcion.value;
    const localidad = this.form.controls.localidadId;
    localidad.disable({ emitEvent: false });
    localidad.setValue('', { emitEvent: false });
    // La localidad vacía no es un error del usuario: no debe reaparecer en rojo con el estado del trámite anterior.
    localidad.markAsUntouched();
    localidad.markAsPristine();
    if (!this.slugManual) this.form.controls.slug.setValue('', { emitEvent: false });
    this.cdr.markForCheck();
  }

  private adopcionLeida(lectura: LecturaAdopcion): void {
    this.cargandoAdopcion = false;
    const id = this.form.controls.adopcion.value;
    if (lectura && lectura !== 'inexistente' && lectura !== 'fallo' && id) {
      this.datos = lectura;
      this.adopcionId = id;
      this.form.controls.localidadId.enable({ emitEvent: false });
    } else if (id) {
      this.adopcionInexistente = lectura === 'inexistente';
      this.errorAdopcion = !this.adopcionInexistente;
    }
    // Los validadores de duplicados leen `datos`; y el membrete se arma con lo que acaba de llegar.
    for (const control of [this.form.controls.localidadId, this.form.controls.slug]) {
      control.updateValueAndValidity({ emitEvent: false });
    }
    this.form.updateValueAndValidity();
    this.cdr.markForCheck();
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

  /** ¿La localidad ya tiene una ficha (activa o desactivada) en esta adopción? (para deshabilitar la opción). */
  ocupada(localidadId: string): boolean {
    return !!this.datos?.ocupadas.localidadIds.includes(localidadId);
  }

  /** ¿La ficha que ocupa la localidad está desactivada? Entonces no se crea otra: se reactiva esa. */
  ocupadaPorDesactivada(localidadId: string): boolean {
    return !!this.datos?.ocupadas.localidadIdsDesactivadas.includes(localidadId);
  }

  get sinCambios(): boolean {
    return this.isEdit && this.form.pristine;
  }

  /**
   * Por qué no se puede guardar todavía aunque el formulario sea válido (la localidad deshabilitada queda fuera
   * de la validación): el trámite elegido se está leyendo o no se pudo leer. `null` = no hay bloqueo.
   */
  get motivoSinAdopcion(): string | null {
    if (!this.eligeAdopcion || this.adopcionId) return null;
    if (this.cargandoAdopcion) return 'se está leyendo, esperá un momento para guardar';
    if (this.adopcionInexistente) return 'ya no está disponible: elegí otro';
    if (this.errorAdopcion) return 'no se pudo leer: reintentá o elegí otro';
    return null;
  }

  async onSubmit(): Promise<void> {
    if (this.saving || !this.datos) return;
    if (this.motivoSinAdopcion || this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitted = true;
      this.cdr.detectChanges();
      // El trámite es el primer campo y de él depende el resto: ahí va el foco.
      if (this.motivoSinAdopcion || this.form.controls.adopcion.invalid) this.enfocarAdopcion();
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

    this.snackBar.open(textoExito(this.textoGuardada(guardada), this.fuenteSimulada), 'OK', { duration: 4000, panelClass: 'snackbar-success' });
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
      this.form.controls.adopcion.disable({ emitEvent: false });
      this.cargar();
    }
    this.cdr.markForCheck();
  }

  cancelar(): void {
    if (this.isEdit && this.editId) {
      this.router.navigate([RUTA_DETALLE_FICHA, this.editId]);
      return;
    }
    if (this.adopcionFija) {
      this.router.navigate([RUTA_DETALLE_ADOPCION, this.adopcionFija]);
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
    const motivo = this.motivoSinAdopcion;
    const resumen = resumenDeErrores(this.form, Object.values(CAMPOS), (control, campo) => getControlErrorMessage(control, campo));
    return motivo ? [`${CAMPOS.adopcion.label} (${motivo})`, ...resumen] : resumen;
  }

  private enfocarAdopcion(): void {
    this.host.nativeElement.querySelector<HTMLElement>('#adopcion')?.focus();
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
      sinAdopcion: this.eligeAdopcion && !this.adopcionId,
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
    const localidadId = String(control.value);
    if (!this.ocupada(localidadId)) return null;
    return this.ocupadaPorDesactivada(localidadId) ? { localidadDesactivada: true } : { localidadOcupada: true };
  }

  /**
   * Reactivar (en edición) una ficha desactivada cuya localidad ya tiene otra ficha activa de la misma
   * adopción dejaría dos activas. Solo puede pasar con duplicados anteriores al UNIQUE del backend.
   */
  private reactivaDuplicada(control: AbstractControl): ValidationErrors | null {
    const ficha = this.datos?.ficha;
    if (!this.isEdit || !ficha || ficha.activa || !control.value || !ficha.localidadId) return null;
    // Si la otra también está desactivada, reactivar esta no deja dos activas.
    return this.ocupada(ficha.localidadId) && !this.ocupadaPorDesactivada(ficha.localidadId)
      ? { reactivaDuplicada: true }
      : null;
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
        volverA: this.isEdit || this.eligeAdopcion ? 'fichas' : 'adopciones',
        ...(this.isEdit
          ? TEXTOS_FICHA_INEXISTENTE
          : { titulo: 'Ese trámite del organismo no existe', texto: 'Puede que el enlace esté mal escrito o que no sea de tu organismo.' }),
      };
    }
    return {
      definitivo: false,
      volverA: this.isEdit || this.eligeAdopcion ? 'fichas' : 'adopciones',
      titulo: this.isEdit ? 'No pudimos cargar la ficha' : 'No pudimos cargar el formulario',
      texto: 'Los campos quedarían incompletos. Revisá tu conexión e intentá de nuevo. Si sigue, avisá a Soporte.',
    };
  }
}

/** Lo que devuelve leer el trámite elegido: sus datos, `null` (sin trámite), o por qué no se pudo. */
type LecturaAdopcion = FichaFormData | 'inexistente' | 'fallo' | null;

/** Un trámite del organismo como opción del buscador: título del trámite y, debajo, el organismo. */
function aNodo(adopcion: FichaAdopcionResumen): TreeFieldConfig['nodes'][number] {
  return {
    id: adopcion.id,
    label: adopcion.plantillaTitulo ?? 'Trámite sin nombre disponible',
    meta: adopcion.organismoNombre ?? undefined,
    parentId: null,
    keywords: [adopcion.organismoNombre, adopcion.plantillaSlug].filter(Boolean).join(' '),
  };
}
