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
import { canonicalizarSlug } from '@core/utils/slug.utils';
import {
  DespublicacionFallidaError, FichaAdopcionResumen, FichaBase, FichaCambiadaError, FichaFormData, FichaLocalFormValue,
  FichaLocalVM, FichasLocalesFacade,
} from '@features/fichas-locales';
import { RUTA_DETALLE_ADOPCION, RUTA_LISTA_ADOPCIONES } from '../../adopciones/adopciones.rutas';
import { textoRecomendados } from '../../plantillas/plantilla-recomendados';
import {
  NO_DISPONIBLE, TEXTOS_FICHA_INEXISTENTE, TEXTO_DESPUBLICACION_FALLIDA, TEXTO_FICHA_SIN_CONTENIDO,
  esFichaInexistente, mensajeErrorGuardado,
} from '../ficha-save-error';
import { MOTIVO_NO_VIGENTE, QUIEN_PUBLICA, TEXTO_FUENTE_SIMULADA, motivoNoElegible, textoExito } from '../ficha-textos';
import { FRAGMENTO_PUNTOS, RUTA_DETALLE_FICHA, RUTA_LISTA_FICHAS } from '../fichas.rutas';
import { PuntosAtencionPanelComponent } from '../puntos-atencion-panel/puntos-atencion-panel.component';

/** Largo máximo del slug (la columna es VARCHAR sin largo, pero el slug va en una URL). */
const MAX_SLUG = 255;

/** Una URL absoluta http(s), sin espacios. */
const PATRON_URL = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

/** Título del banner de error del guardado cuando nada se guardó. */
const TITULO_NO_SE_GUARDO = 'No se pudo guardar';

/**
 * Campos de la ficha que se editan acá, con la etiqueta que se ve en pantalla (así los nombra el aviso de
 * conflicto). La localidad y el trámite no cambian en edición.
 */
const ETIQUETA_EDITABLE = {
  slug: 'Slug',
  url: 'URL del trámite',
  requisitos: 'Requisitos',
  costos: 'Costos',
  activa: 'Ficha activa',
} as const;

type CampoEditable = keyof typeof ETIQUETA_EDITABLE;

const CAMPOS_EDITABLES = Object.keys(ETIQUETA_EDITABLE) as CampoEditable[];

/** El valor de un campo editable tal como lo muestra el form (`null` del backend = vacío). */
function valorEditable(ficha: FichaLocalVM, campo: CampoEditable): string | boolean {
  if (campo === 'activa') return ficha.activa;
  return ficha[campo] ?? '';
}

/** Lo que el facade compara antes de guardar (ver `FichaBase`). */
function baseDe(ficha: FichaLocalVM): FichaBase {
  return { version: ficha.version, estado: ficha.estado, activa: ficha.activa };
}

/**
 * La ficha cambió en el servidor mientras se la editaba y el form ya se REBASÓ sobre lo recién leído: los campos
 * sin tocar tomaron el valor nuevo y los editados conservan lo escrito. Todavía no se guardó nada.
 */
interface ConflictoFicha {
  /** La ficha tal como está ahora en el servidor (ya es la base del próximo guardado). */
  actual: FichaLocalVM;
  /**
   * Etiquetas de los campos que cambiaron los dos (la otra persona y quien edita, con valores distintos): quedan
   * con lo escrito acá y, al guardar, reemplazan lo que cargó la otra persona.
   */
  enDisputa: string[];
}

/** Dónde va el foco cuando aparece cada cosa (WCAG 2.4.3: no dejarlo en `body`). */
const SELECTOR_AVISO_CAMBIO = '[data-aviso="ficha-cambiada"], [data-aviso="ficha-actualizada"]';
const SELECTOR_ERROR_SERVIDOR = '[data-banner="error-servidor"] .form-error-banner';
const SELECTOR_TITULO = '.fichaform-titulo';

/** Motivo por el que la pantalla no pudo dibujarse, ya traducido. */
interface ErrorCarga {
  titulo: string;
  texto: string;
  /** Reintentar no sirve (la ficha o la adopción no existe). */
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

/**
 * La URL tiene que cumplir `PATRON_URL`. Cada forma de no cumplirlo tiene su error, para que el mensaje diga
 * QUÉ corregir (también en una URL guardada de antes que hoy no pasaría): le falta el `https://`, tiene
 * espacios, o no hay un sitio después del `https://`.
 */
function urlValida(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  if (!valor) return null;
  if (!/^https?:\/\//i.test(valor)) return { urlEsquema: true };
  if (/\s/.test(valor)) return { urlEspacios: true };
  return PATRON_URL.test(valor) ? null : { urlIncompleta: true };
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
    validations: {
      mensajes: {
        urlEsquema: 'Tiene que empezar con https:// (o http://). Ej.: https://www.misiones.gob.ar',
        urlEspacios: 'No puede tener espacios: revisá la dirección',
        urlIncompleta: 'Falta el sitio después de https://. Ej.: https://www.misiones.gob.ar',
      },
    },
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
 *   ficha" de la lista) el primer campo es el trámite del organismo, con buscador, y recién al elegirlo se leen sus
 *   localidades ocupadas y se habilita la localidad. Solo se pueden elegir los VIGENTES (habilitado, ya empezó a regir
 *   y no venció): el backend responde 404 al crear una ficha de uno que no lo está. Los habilitados que todavía no
 *   rigen o ya vencieron se muestran igual, no elegibles y con el motivo. Si no hay ninguno, lo dice y remite a
 *   "Trámites del organismo".
 * - La misma regla vale al editar: si el trámite del organismo dejó de estar vigente, el backend rechaza el guardado
 *   (404). Se avisa arriba del form; si igual se intenta, el error se muestra con texto propio.
 * - Localidad solo en alta (cambiarla sería otra ficha). Las que ya tienen ficha en esta adopción, activa
 *   o desactivada, no se pueden elegir: el backend tiene UNIQUE (adopción, localidad) y lo rechaza con un
 *   500 sin detalle; la desactivada se reactiva editándola.
 * - Slug sugerido `slugBase-localidad` y editable (P-5), validado contra los slugs de las demás fichas
 *   (activas o desactivadas).
 * - Sin estado: guardar no cambia el estado de publicación (el backend lo conserva); eso es del workflow, en el detalle.
 *   Única excepción, siempre avisada (antes, con un aviso; después, en el snackbar): una ficha que figura PUBLICADA
 *   pero está desactivada se despublica al guardarla sin reactivar (lo completa el facade).
 * - El slug que no se toca viaja tal cual se leyó (`conservarSlug`): no se re-canonicaliza un slug heredado.
 * - Antes de guardar una edición el facade relee la ficha: si cambió (versión, estado o `activa`) desde que se
 *   leyó, no guarda (el backend no lo detecta: el PUT va sin versión). El form se REBASA sobre la ficha actual
 *   (`rebasar`): los campos sin tocar toman el valor nuevo y los editados conservan lo escrito; el aviso dice qué
 *   pasó y cuáles campos cambiaron los dos, y ofrece "Guardar mis cambios" o "Descartar mis cambios". Así un
 *   guardado nunca revierte en silencio lo que cambió otra persona en un campo que acá no se tocó.
 * - Editar una ficha PUBLICADA cambia el portal al guardar (P-6): se avisa.
 * - Una ficha PUBLICADA (y activa) no se desactiva desde acá: el interruptor "Ficha activa" queda bloqueado
 *   (`appUnavailable`, con el motivo; el bloqueo se recalcula cada vez que cambia la ficha leída:
 *   `sincronizarBloqueoActiva`) y remite a "Desactivar" del detalle. Ese camino (DELETE) además la despublica; el PUT del form conserva el estado
 *   y la dejaría inactiva pero PUBLICADO.
 * - Se edita sobre lo que devolvió el `GET` (adopción, localidad, slug, URL, requisitos, costos, activa): el PUT es
 *   total y viajan todos.
 *
 * Nada se dibuja hasta que `getFormData()` resolvió, para no pisar una ficha con un form vacío. Por lo mismo, si el
 * servidor entrega la ficha sin su contenido (`sinContenido`: backend anterior a `586b670`, compatibilidad temporal),
 * el form no se dibuja: se explica por qué no se puede editar.
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
  /** Título del banner de `serverError`: cambia cuando los cambios SÍ se guardaron y falló el paso siguiente. */
  serverErrorTitulo = TITULO_NO_SE_GUARDO;
  /**
   * La ficha cambió en el servidor mientras se editaba: no se guardó nada, el form ya se rebasó sobre la ficha
   * actual y se ofrece guardar los cambios propios o descartarlos. `null` = sin conflicto pendiente.
   */
  conflicto: ConflictoFicha | null = null;
  /**
   * La ficha cambió en el servidor pero acá no había cambios propios (versión actual): no hay conflicto, el form
   * ya muestra cómo quedó y se avisa. `null` = sin aviso.
   */
  fichaActualizada: number | null = null;
  /**
   * Al rebasar, la ficha resultó PUBLICADA y activa mientras acá se la quería desactivar: el interruptor volvió a
   * quedar prendido y bloqueado (ver `motivoActivaBloqueada`), y el aviso lo dice.
   */
  activaRestablecida = false;
  datos: FichaFormData | null = null;
  /** Trámites del organismo habilitados (alta sin `?adopcion=`); solo los vigentes se pueden elegir. */
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
  /** El trámite elegido se leyó, pero dejó de estar vigente desde que se armó la lista: hay que elegir otro. */
  adopcionElegidaNoVigente = false;

  /** Mientras sea false, el slug sigue a la localidad elegida (solo en alta). */
  private slugManual = false;
  private editId: string | null = null;
  /** Versión y estado con los que se leyó la ficha: el facade los compara antes de guardar. */
  private base: FichaBase | null = null;
  /** Slug tal como se leyó: es el que viaja si el campo no se toca. */
  private slugLeido = '';
  /** El trámite del que cuelga la ficha: el de `?adopcion=` o, en el alta sin él, el que se elige en el form. */
  private adopcionId: string | null = null;
  /** `?adopcion=` de la URL (adopción fija); `null` si el alta tiene que elegirla. */
  private adopcionFija: string | null = null;
  private readonly adopcionElegida$ = new Subject<string>();
  /** Carga en vuelo: reintentar la cancela, para que una respuesta vieja no pise a la nueva. */
  private carga: Subscription | null = null;
  /** La próxima carga la pidió el usuario desde un aviso que desaparece con ella: al terminar, el foco va al título. */
  private enfocarTituloAlCargar = false;

  /** Cómo se va a guardar el slug, si difiere de lo tipeado. */
  readonly slugPrevisto$: Observable<string | null> = defer(() =>
    this.form.controls.slug.valueChanges.pipe(startWith(this.form.controls.slug.value)),
  ).pipe(
    map((valor) => {
      // Sin tocar, el slug se guarda tal cual: no hay "se guardará como".
      if (this.conservaSlug) return null;
      const canonico = canonicalizarSlug(valor);
      return canonico && canonico !== valor ? canonico : null;
    }),
  );

  /** Edición sin tocar el slug: viaja tal cual se leyó, sin re-canonicalizar. */
  get conservaSlug(): boolean {
    return this.isEdit && !this.form.controls.slug.dirty;
  }

  /** El slug guardado no sigue el formato actual y todavía no se tocó: se avisa que se conserva. */
  get slugHeredado(): boolean {
    return this.conservaSlug && !!this.slugLeido && canonicalizarSlug(this.slugLeido) !== this.slugLeido;
  }

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

  /** Hay trámites del organismo, pero ninguno vigente hoy: no hay qué elegir. */
  get sinAdopcionesVigentes(): boolean {
    return this.adopciones.length > 0 && !this.adopciones.some((a) => a.vigente);
  }

  /**
   * El trámite del organismo de la ficha (fijo por `?adopcion=`, o el de la ficha que se edita) no está vigente: el
   * backend va a rechazar el guardado. Texto del aviso, o `null` si está vigente o no se pudo leer.
   */
  get avisoNoVigente(): string | null {
    const motivo = this.datos?.adopcion?.motivoNoVigente;
    if (!motivo || this.eligeAdopcion) return null;
    const accion = this.isEdit ? 'guardar cambios en esta ficha' : 'crearle fichas';
    return `El trámite del organismo ${MOTIVO_NO_VIGENTE[motivo]}: no vas a poder ${accion} hasta que vuelva a estar vigente. `
      + 'Mientras tanto sus fichas no se ven en el portal, aunque estén publicadas.';
  }

  get ficha(): FichaLocalVM | null {
    return this.datos?.ficha ?? null;
  }

  /** P-6: guardar cambia lo que ya se ve en el portal. */
  get editaPublicada(): boolean {
    return !!this.ficha && this.ficha.estado === 'PUBLICADO' && this.ficha.activa;
  }

  /**
   * La ficha figura PUBLICADA pero está desactivada, y así se va a guardar: el facade la despublica al guardar
   * (un PUT la dejaría en ese estado contradictorio). Se avisa ANTES; si se la reactiva, no aplica.
   */
  get seDespublicaAlGuardar(): boolean {
    return !!this.ficha && this.ficha.estado === 'PUBLICADO' && !this.ficha.activa && !this.form.controls.activa.value;
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
    // Nada de lo que se dijo sobre la lectura anterior vale para la nueva.
    this.conflicto = null;
    this.fichaActualizada = null;
    this.activaRestablecida = false;
    this.serverError = '';
    this.serverErrorTitulo = TITULO_NO_SE_GUARDO;
    this.submitted = false;
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
          if (datos.ficha?.sinContenido) {
            // COMPATIBILIDAD TEMPORAL (backend anterior a `586b670`): sin el contenido no hay base para el PUT.
            // No se dibuja el form: guardarlo borraría lo que está guardado.
            this.cargando = false;
            this.enfocarTituloAlCargar = false;
            this.errorCarga = {
              definitivo: true, volverA: 'fichas', titulo: 'Esta ficha todavía no se puede editar', texto: TEXTO_FICHA_SIN_CONTENIDO,
            };
            this.cdr.markForCheck();
            return;
          }
          this.datos = datos;
          this.base = datos.ficha ? baseDe(datos.ficha) : null;
          this.slugLeido = datos.ficha?.slug ?? '';
          this.adopciones = adopciones;
          this.arbolAdopciones = { ...this.arbolAdopciones, nodes: adopciones.map(aNodo), loaded: true };
          if (datos.ficha) {
            this.form.reset({
              localidadId: datos.ficha.localidadId,
              slug: datos.ficha.slug,
              url: datos.ficha.url ?? '',
              requisitos: datos.ficha.requisitos ?? '',
              costos: datos.ficha.costos ?? '',
              activa: datos.ficha.activa,
            });
            this.form.controls.localidadId.disable();
            this.sincronizarBloqueoActiva();
          }
          // Los validadores de duplicados leen `datos`, que recién llegó: se re-ejecutan en cada control.
          for (const control of [this.form.controls.localidadId, this.form.controls.slug, this.form.controls.activa]) {
            control.updateValueAndValidity({ emitEvent: false });
          }
          // Una URL guardada de antes que hoy no valida: se muestra el error de entrada (dice qué corregir),
          // en vez de aparecer recién al guardar otro campo.
          if (datos.ficha && this.form.controls.url.invalid) this.form.controls.url.markAsTouched();
          this.cargando = false;
          this.cdr.markForCheck();
          if (this.enfocarTituloAlCargar) {
            this.enfocarTituloAlCargar = false;
            this.enfocar(SELECTOR_TITULO);
          }
        },
        error: (err: unknown) => {
          this.cargando = false;
          // El error de carga es `role="alert"`: se anuncia solo.
          this.enfocarTituloAlCargar = false;
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
    this.adopcionElegidaNoVigente = false;
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
      // La lista se armó al abrir el form: si desde entonces dejó de estar vigente, no se sigue (el alta daría 404).
      this.adopcionElegidaNoVigente = !!lectura.adopcion && !lectura.adopcion.vigente;
      if (!this.adopcionElegidaNoVigente) {
        this.adopcionId = id;
        this.form.controls.localidadId.enable({ emitEvent: false });
      }
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

  /**
   * Edición sin nada que guardar. Una ficha que figura PUBLICADA pero está desactivada sí tiene algo que hacer
   * aunque no se toque ningún campo: guardarla la despublica (es lo que promete el aviso), así que no se bloquea.
   */
  get sinCambios(): boolean {
    return this.isEdit && this.form.pristine && !this.seDespublicaAlGuardar;
  }

  /** Texto del botón de envío: dice lo que va a pasar. */
  get textoGuardar(): string {
    if (!this.isEdit) return 'Crear ficha';
    return this.seDespublicaAlGuardar ? 'Guardar y despublicar' : 'Guardar cambios';
  }

  /** Ayuda del pie, coherente con el botón. */
  get ayudaDelPie(): string {
    if (!this.isEdit) return 'La ficha se crea en borrador.';
    if (this.seDespublicaAlGuardar) return 'Al guardar, la ficha se despublica.';
    return this.sinCambios ? 'Sin cambios para guardar.' : 'Guardar no cambia el estado de publicación.';
  }

  /**
   * Por qué no se puede guardar todavía aunque el formulario sea válido (la localidad deshabilitada queda fuera
   * de la validación): el trámite elegido se está leyendo o no se pudo leer. `null` = no hay bloqueo.
   */
  get motivoSinAdopcion(): string | null {
    if (!this.eligeAdopcion || this.adopcionId) return null;
    if (this.cargandoAdopcion) return 'se está leyendo, esperá un momento para guardar';
    if (this.adopcionInexistente) return 'ya no está disponible: elegí otro';
    if (this.adopcionElegidaNoVigente) return 'ya no está vigente: elegí otro';
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

    // `||` y no `??`: un `adopcionId` vacío tampoco sirve.
    const adopcionId = this.ficha?.adopcionId || this.adopcionId;
    if (!adopcionId) {
      // No debería pasar (el alta exige el trámite y una ficha sin contenido no llega a dibujar el form), pero
      // un envío que no hace nada y no dice nada es peor que cualquier mensaje.
      this.serverErrorTitulo = TITULO_NO_SE_GUARDO;
      this.serverError = 'No se pudo determinar el trámite del organismo de esta ficha. Recargá la página e intentá de nuevo.';
      this.enfocar(SELECTOR_ERROR_SERVIDOR);
      return;
    }

    this.submitted = false;
    this.saving = true;
    this.serverError = '';
    this.serverErrorTitulo = TITULO_NO_SE_GUARDO;
    // `conflicto` NO se apaga acá: su aviso (y el botón que tiene el foco) sigue hasta saber cómo terminó.
    this.fichaActualizada = null;
    const valor = this.form.getRawValue();
    const conservarSlug = this.conservaSlug;
    const form: FichaLocalFormValue = {
      adopcionId,
      localidadId: valor.localidadId,
      slug: conservarSlug ? this.slugLeido : valor.slug,
      conservarSlug,
      url: valor.url,
      requisitos: valor.requisitos,
      costos: valor.costos,
      activa: valor.activa,
    };

    // Guardado one-shot (`unaVez`), igual que en Plantilla: el único rechazo que se ignora es que la pantalla
    // ya no exista; cualquier otro apaga `saving` y se muestra en el formulario.
    let guardada: FichaLocalVM;
    let despublicada = false;
    try {
      if (this.isEdit) {
        const resultado = await unaVez(this.facade.update(this.editId!, form, this.base ?? undefined), this.destroyRef);
        guardada = resultado.ficha;
        despublicada = resultado.despublicada;
      } else {
        guardada = await unaVez(this.facade.create(form), this.destroyRef);
      }
    } catch (err: unknown) {
      if (esPantallaDestruida(err)) return; // se destruyó con el guardado en vuelo: no hay a quién avisar
      this.saving = false;
      if (err instanceof FichaCambiadaError) {
        // No se guardó nada: la ficha ya no es la que se leyó. El form se rebasa sobre la actual y se avisa.
        this.rebasar(err.actual);
        this.enfocar(SELECTOR_AVISO_CAMBIO);
        return;
      }
      if (err instanceof DespublicacionFallidaError) {
        // El PUT sí se guardó: la base pasa a ser lo guardado (si no, reintentar daría un falso "cambió").
        this.adoptar(err.ficha);
        this.serverErrorTitulo = 'Se guardó, pero la ficha no se despublicó';
        this.serverError = TEXTO_DESPUBLICACION_FALLIDA;
      } else {
        this.serverError = mensajeErrorGuardado(err, this.form);
      }
      // El banner está arriba de la tarjeta y el botón abajo: el foco (y el scroll) van al motivo.
      this.enfocar(SELECTOR_ERROR_SERVIDOR);
      return;
    }

    // El aviso de despublicación es más largo: queda más tiempo.
    this.snackBar.open(textoExito(this.textoGuardada(guardada, despublicada), this.fuenteSimulada), 'OK', {
      duration: despublicada ? 8000 : 4000, panelClass: 'snackbar-success',
    });
    // Si la navegación no ocurre (un guard la frena, o falla al resolver), el form no queda bloqueado.
    const navego = await this.router.navigate([RUTA_DETALLE_FICHA, guardada.id]).catch(() => false);
    if (navego) return;
    this.saving = false;
    this.conflicto = null;
    this.activaRestablecida = false;
    this.form.markAsPristine();
    // Un alta que no navegó deja de ser alta: la ficha ya existe, así que la pantalla pasa a editarla.
    // Sin esto, otro clic en "Crear ficha" la crearía por segunda vez.
    if (!this.isEdit) {
      this.editId = guardada.id;
      this.isEdit = true;
      this.slugManual = true;
      this.form.controls.adopcion.disable({ emitEvent: false });
      this.enfocarTituloAlCargar = true;
      this.cargar();
    } else {
      // Sigue en la pantalla: lo guardado es la nueva base del próximo guardado.
      this.adoptar(guardada);
      // El aviso de conflicto (si lo había, con el foco en su botón) ya no está.
      this.enfocar(SELECTOR_TITULO);
    }
    this.cdr.markForCheck();
  }

  /**
   * La ficha quedó así en el servidor: pasa a ser lo leído (base de la comparación, slug que se conserva, estado
   * y `activa` del membrete, bloqueo del interruptor). No toca los valores del form.
   */
  private adoptar(ficha: FichaLocalVM): void {
    if (this.datos) this.datos = { ...this.datos, ficha };
    this.base = baseDe(ficha);
    this.slugLeido = ficha.slug;
    this.sincronizarBloqueoActiva();
    // Los validadores leen `datos.ficha`; y el membrete (`vista$`) se redibuja con el `valueChanges` del grupo.
    for (const control of [this.form.controls.slug, this.form.controls.url, this.form.controls.activa]) {
      control.updateValueAndValidity({ emitEvent: false });
    }
    this.form.updateValueAndValidity();
  }

  /**
   * Publicada y activa: desactivarla es la acción "Desactivar" del detalle, así que el control queda deshabilitado
   * (su valor viaja intacto). En cualquier otro caso se habilita: una ficha que deja de estar publicada (la
   * despublicó o desactivó otra persona y se releyó) no puede quedar con el interruptor trabado.
   */
  private sincronizarBloqueoActiva(): void {
    const activa = this.form.controls.activa;
    if (this.desactivarSoloDesdeDetalle) activa.disable({ emitEvent: false });
    else activa.enable({ emitEvent: false });
  }

  /**
   * La ficha cambió en el servidor (`FichaCambiadaError`): el form se REBASA sobre `actual` en vez de guardar
   * encima. Guardar sin más mandaría, en los campos que acá no se tocaron, los valores viejos (el PUT es total):
   * revertiría en silencio lo que cambió la otra persona, o reactivaría una ficha que desactivó.
   *
   * - Campo sin tocar (pristine): toma el valor de `actual`, sin ensuciarse.
   * - Campo editado acá: conserva lo escrito. Si además lo cambió la otra persona (con otro valor), va a
   *   `enDisputa`: el aviso lo nombra, porque al guardar reemplaza lo que cargó la otra persona. Si lo escrito
   *   coincide con lo que hay ahora, deja de contar como cambio.
   * - `actual` pasa a ser la ficha leída: base del próximo guardado, slug que se conserva, estado, `activa` y
   *   bloqueo del interruptor. Si quedó PUBLICADA y activa mientras acá se la quería desactivar, el interruptor
   *   vuelve a prendido (desde acá no se desactiva una publicada) y el aviso lo dice.
   *
   * Si después de eso no queda ningún cambio propio, no hay conflicto: se avisa que la ficha se actualizó.
   */
  private rebasar(actual: FichaLocalVM): void {
    const anterior = this.ficha;
    const quedaBloqueada = actual.estado === 'PUBLICADO' && actual.activa;
    const activa = this.form.controls.activa;
    this.activaRestablecida = quedaBloqueada && activa.dirty && !activa.value;
    if (quedaBloqueada) activa.markAsPristine();

    const enDisputa: string[] = [];
    for (const campo of CAMPOS_EDITABLES) {
      const control: AbstractControl = this.form.controls[campo];
      const nuevo = valorEditable(actual, campo);
      // El slug editado se guarda canonicalizado: se compara así.
      const escrito = campo === 'slug' ? canonicalizarSlug(String(control.value)) : control.value;
      if (control.dirty && escrito !== nuevo) {
        if (anterior && valorEditable(anterior, campo) !== nuevo) enDisputa.push(ETIQUETA_EDITABLE[campo]);
        continue;
      }
      control.setValue(nuevo);
      control.markAsPristine();
    }

    this.adoptar(actual);
    if (this.form.controls.url.invalid) this.form.controls.url.markAsTouched();

    if (this.form.dirty) {
      this.conflicto = { actual, enDisputa };
      this.fichaActualizada = null;
    } else {
      this.conflicto = null;
      this.fichaActualizada = actual.version;
    }
  }

  /** Conflicto: descarta lo escrito y vuelve a leer la ficha. Al terminar, el foco va al título. */
  descartarMisCambios(): void {
    if (this.saving) return;
    this.enfocarTituloAlCargar = true;
    this.cargar();
  }

  /**
   * Conflicto: guarda lo escrito sobre la ficha actual (el form ya está rebasado, así que solo viajan como
   * cambio los campos editados acá). No toca la base: si el form no valida no se envía nada y todo queda igual;
   * y si la ficha vuelve a cambiar antes del PUT, el facade lo detecta de nuevo.
   */
  guardarMisCambios(): Promise<void> {
    return this.onSubmit();
  }

  /**
   * Dibuja lo pendiente y lleva el foco a `selector`, a la vista. Los avisos y errores salen arriba de la
   * tarjeta y el botón que los provoca está abajo (o desaparece): sin esto el foco queda en `body`.
   */
  private enfocar(selector: string): void {
    this.cdr.detectChanges();
    const destino = this.host.nativeElement.querySelector<HTMLElement>(selector);
    if (!destino) return;
    destino.focus({ preventScroll: true });
    destino.scrollIntoView({ block: 'center' });
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
      slug: this.conservaSlug ? valor.slug : canonicalizarSlug(valor.slug),
      activa: valor.activa,
      recomendadosCompletos: recomendados.every((dato) => dato.completo),
      recomendado: textoRecomendados(recomendados),
    };
  }

  private textoGuardada(guardada: FichaLocalVM, despublicada: boolean): string {
    if (!this.isEdit) return 'Ficha creada en borrador. Cuando esté lista, enviala a revisión';
    // Guardar normalmente no cambia el estado: si esta vez lo cambió, se dice.
    if (despublicada) {
      return 'Cambios guardados. Como la ficha figuraba publicada y está desactivada, además se despublicó: no se ve en el portal';
    }
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

/**
 * Un trámite del organismo como opción del buscador: título del trámite y, debajo, el organismo. Si no está vigente
 * se muestra igual, no elegible y con el motivo (esconderlo dejaría al usuario buscando algo que "debería estar").
 */
function aNodo(adopcion: FichaAdopcionResumen): TreeFieldConfig['nodes'][number] {
  return {
    disabledReason: motivoNoElegible(adopcion) ?? undefined,
    id: adopcion.id,
    label: adopcion.plantillaTitulo ?? 'Trámite sin nombre disponible',
    meta: adopcion.organismoNombre ?? undefined,
    parentId: null,
    keywords: [adopcion.organismoNombre, adopcion.plantillaSlug].filter(Boolean).join(' '),
  };
}
