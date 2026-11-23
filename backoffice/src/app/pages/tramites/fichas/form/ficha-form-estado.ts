import { Observable, defer, map, startWith } from 'rxjs';
import { NO_DISPONIBLE } from '@core/constants/textos.constants';
import {
  FichaAdopcionResumen, FichaBase, FichaFormData, FichaLocalFormValue, FichaLocalVM, MAX_SLUG, localidadOcupada,
  localidadOcupadaPorDesactivada,
} from '@features/fichas-locales';
import { RUTA_DETALLE_ADOPCION, RUTA_LISTA_ADOPCIONES } from '@pages/tramites/adopciones/adopciones.rutas';
import { QUIEN_PUBLICA, TEXTO_FUENTE_SIMULADA } from '../ficha-textos';
import { FRAGMENTO_PUNTOS, RUTA_DETALLE_FICHA } from '../fichas.rutas';
import {
  EleccionDeAdopcion, LecturaAdopcion, SIN_ELECCION, arbolDeAdopciones, eleccionTrasLeer, motivoSinAdopcion, sinTramite,
  sinVigentes, soltarLocalidad,
} from './ficha-form-adopciones';
import {
  CAMPOS, CampoConResumen, ContextoDeValidacion, FichaForm, MOTIVO_ACTIVA_BLOQUEADA, aValorDeFicha, revalidar, volcarFicha,
} from './ficha-form-campos';
import { ConflictoFicha, baseDe, rebasar } from './ficha-form-conflicto';
import { VistaFicha, aVista, avisoDeNoVigente, ayudaDelPie, esSlugHeredado, slugPrevisto, slugSugerido, textoDeGuardar } from './ficha-form-vista';

/**
 * Estado del formulario de ficha: lo LEÍDO del servidor (ficha, catálogos, base de la comparación por versión), lo
 * que de ahí y del form se deriva para el template, y los pasos que lo cambian. Sin inyección, sin llamadas y sin
 * detección de cambios: de eso se ocupa `FichaFormComponent`, que la extiende y arma el `FormGroup` (el template
 * lee estos miembros tal cual). Después de un paso `protected`, el componente marca la vista para redibujar.
 */
export abstract class FichaFormEstado implements ContextoDeValidacion {
  /** Lo arma el componente con `controlesDeFicha(() => this)`. */
  abstract readonly form: FichaForm;

  readonly maxSlug = MAX_SLUG;
  readonly noDisponible = NO_DISPONIBLE;
  readonly rutaAdopcion = RUTA_DETALLE_ADOPCION;
  readonly rutaAdopciones = RUTA_LISTA_ADOPCIONES;
  /** Del detalle de la ficha: dónde se gestionan los puntos de atención (`#puntos-atencion`). */
  readonly fragmentoPuntos = FRAGMENTO_PUNTOS;
  readonly rutaDetalle = RUTA_DETALLE_FICHA;
  readonly quienPublica = QUIEN_PUBLICA;
  readonly textoFuenteSimulada = TEXTO_FUENTE_SIMULADA;
  readonly campos = CAMPOS;
  /** Por qué el interruptor "Ficha activa" no se puede apagar acá (tooltip y texto de ayuda). */
  readonly motivoActivaBloqueada = MOTIVO_ACTIVA_BLOQUEADA;

  isEdit = false;
  datos: FichaFormData | null = null;
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
  /** Trámites del organismo habilitados (alta sin `?adopcion=`); solo los vigentes se pueden elegir. */
  adopciones: FichaAdopcionResumen[] = [];
  /** El buscador del trámite del organismo, con lo que ofrece `adopciones`. */
  arbolAdopciones = arbolDeAdopciones(null);

  protected editId: string | null = null;
  /** El trámite del que cuelga la ficha: el de `?adopcion=` o, en el alta sin él, el que se elige en el form. */
  protected adopcionId: string | null = null;
  /** `?adopcion=` de la URL (adopción fija); `null` si el alta tiene que elegirla. */
  protected adopcionFija: string | null = null;
  /** Versión y estado con los que se leyó la ficha: el facade los compara antes de guardar. */
  protected base: FichaBase | null = null;
  /** En qué quedó la lectura del trámite elegido (alta sin `?adopcion=`). */
  private eleccion: EleccionDeAdopcion = SIN_ELECCION;
  /** Mientras sea false, el slug sigue a la localidad elegida (solo en alta). */
  private slugManual = false;
  /** Slug tal como se leyó: es el que viaja si el campo no se toca. */
  private slugLeido = '';

  /** Cómo se va a guardar el slug, si difiere de lo tipeado. */
  readonly slugPrevisto$: Observable<string | null> = defer(() =>
    this.form.controls.slug.valueChanges.pipe(startWith(this.form.controls.slug.value)),
  ).pipe(map((valor) => slugPrevisto(valor, this.conservaSlug)));

  /**
   * Resumen del form en vivo. Se suscribe recién cuando `datos` ya llegó (el template lo dibuja después
   * de la carga), y `startWith` le da el valor con el que abrió.
   */
  readonly vista$: Observable<VistaFicha> = defer(() => this.form.valueChanges.pipe(startWith(null))).pipe(
    map(() => aVista(this.form.getRawValue(), this.datos, this.eligeAdopcion && !this.adopcionId, this.conservaSlug)),
  );

  /** Edición sin tocar el slug: viaja tal cual se leyó, sin re-canonicalizar. */
  get conservaSlug(): boolean { return this.isEdit && !this.form.controls.slug.dirty; }

  /** El slug guardado no sigue el formato actual y todavía no se tocó: se avisa que se conserva. */
  get slugHeredado(): boolean { return this.conservaSlug && esSlugHeredado(this.slugLeido); }

  get puedeSugerir(): boolean { return !!this.slugSugerido(); }

  /** Alta sin `?adopcion=`: el trámite del organismo es el primer campo del formulario. */
  get eligeAdopcion(): boolean { return !this.isEdit && !this.adopcionFija; }

  /** Hay trámites del organismo, pero ninguno vigente hoy: no hay qué elegir. */
  get sinAdopcionesVigentes(): boolean { return sinVigentes(this.adopciones); }

  // La lectura del trámite elegido, como la nombra el template (ver `EleccionDeAdopcion`).
  get cargandoAdopcion(): boolean { return this.eleccion.cargando; }
  get errorAdopcion(): boolean { return this.eleccion.fallo; }
  get adopcionInexistente(): boolean { return this.eleccion.inexistente; }
  get adopcionElegidaNoVigente(): boolean { return this.eleccion.noVigente; }

  /** Por qué no se puede guardar todavía aunque el form valide: el trámite elegido no está leído. `null` = sin bloqueo. */
  get motivoSinAdopcion(): string | null {
    return this.eligeAdopcion && !this.adopcionId ? motivoSinAdopcion(this.eleccion) : null;
  }

  /**
   * El trámite del organismo de la ficha (fijo por `?adopcion=`, o el de la ficha que se edita) no está vigente: el
   * backend va a rechazar el guardado. Texto del aviso, o `null` si está vigente o no se pudo leer.
   */
  get avisoNoVigente(): string | null {
    const motivo = this.datos?.adopcion?.motivoNoVigente;
    return motivo && !this.eligeAdopcion ? avisoDeNoVigente(motivo, this.isEdit) : null;
  }

  get ficha(): FichaLocalVM | null { return this.datos?.ficha ?? null; }

  /** P-6: guardar cambia lo que ya se ve en el portal. */
  get editaPublicada(): boolean { return !!this.ficha && this.ficha.estado === 'PUBLICADO' && this.ficha.activa; }

  /**
   * La ficha figura PUBLICADA pero está desactivada, y así se va a guardar: el facade la despublica al guardar
   * (un PUT la dejaría en ese estado contradictorio). Se avisa ANTES; si se la reactiva, no aplica.
   */
  get seDespublicaAlGuardar(): boolean {
    return !!this.ficha && this.ficha.estado === 'PUBLICADO' && !this.ficha.activa && !this.form.controls.activa.value;
  }

  /** Publicada y activa: el toggle "Activa" se bloquea y remite a "Desactivar" (que también despublica). */
  get desactivarSoloDesdeDetalle(): boolean { return this.editaPublicada; }

  /**
   * Edición sin nada que guardar. Una ficha que figura PUBLICADA pero está desactivada sí tiene algo que hacer
   * aunque no se toque ningún campo: guardarla la despublica (es lo que promete el aviso), así que no se bloquea.
   */
  get sinCambios(): boolean { return this.isEdit && this.form.pristine && !this.seDespublicaAlGuardar; }

  /** Texto del botón de envío: dice lo que va a pasar. */
  get textoGuardar(): string { return textoDeGuardar(this.isEdit, this.seDespublicaAlGuardar); }

  /** Ayuda del pie, coherente con el botón. */
  get ayudaDelPie(): string { return ayudaDelPie(this.isEdit, this.seDespublicaAlGuardar, this.sinCambios); }

  /** ¿La localidad ya tiene una ficha (activa o desactivada) en esta adopción? (para deshabilitar la opción). */
  ocupada(localidadId: string): boolean {
    return !!this.datos && localidadOcupada(localidadId, this.datos.ocupadas);
  }

  /** ¿La ficha que ocupa la localidad está desactivada? Entonces no se crea otra: se reactiva esa. */
  ocupadaPorDesactivada(localidadId: string): boolean {
    return !!this.datos && localidadOcupadaPorDesactivada(localidadId, this.datos.ocupadas);
  }

  campoInvalido(nombre: CampoConResumen): boolean {
    const control = this.form.controls[nombre];
    return control.invalid && control.touched;
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

  /** La localidad cambió: mientras el slug no se haya tocado a mano, la sigue. */
  protected seguirLocalidad(): void {
    if (!this.slugManual) this.form.controls.slug.setValue(this.slugSugerido());
  }

  /** Edición de `editId`, o alta (`null`) con el trámite fijo de `?adopcion=` o a elegir en el form. */
  protected iniciar(editId: string | null, adopcionFija: string | null): void {
    this.editId = editId;
    this.isEdit = !!editId;
    this.adopcionFija = adopcionFija;
    this.adopcionId = adopcionFija;
    this.slugManual = this.isEdit;
  }

  /** Un alta ya guardada deja de ser alta: la pantalla pasa a editar la ficha `id`. */
  protected pasarAEdicion(id: string): void {
    this.editId = id;
    this.isEdit = true;
    this.slugManual = true;
    this.form.controls.adopcion.disable({ emitEvent: false });
  }

  /** Nada de lo que se dijo sobre la lectura anterior de la ficha vale para la nueva. */
  protected olvidarCambioAjeno(): void {
    this.conflicto = null;
    this.fichaActualizada = null;
    this.activaRestablecida = false;
  }

  /** Llegó lo que la pantalla necesita: pasa a ser lo leído y, en edición, la ficha se vuelca en el form. */
  protected recibir(datos: FichaFormData, adopciones: FichaAdopcionResumen[]): void {
    this.datos = datos;
    this.base = datos.ficha ? baseDe(datos.ficha) : null;
    this.slugLeido = datos.ficha?.slug ?? '';
    this.adopciones = adopciones;
    this.arbolAdopciones = arbolDeAdopciones(adopciones);
    if (datos.ficha) {
      volcarFicha(this.form, datos.ficha);
      this.sincronizarBloqueoActiva();
    }
    // Los validadores de duplicados leen `datos`, que recién llegó.
    revalidar(this.form, 'localidadId', 'slug', 'activa');
    // Una URL guardada de antes que hoy no valida: se muestra el error de entrada (dice qué corregir),
    // en vez de aparecer recién al guardar otro campo.
    if (datos.ficha && this.form.controls.url.invalid) this.form.controls.url.markAsTouched();
  }

  /**
   * Cambió el trámite elegido: lo que dependía del anterior (localidad ocupada, slug sugerido, nombres) deja de
   * valer hasta que llegue la lectura del nuevo. La localidad queda bloqueada mientras tanto.
   */
  protected soltarTramite(): void {
    this.adopcionId = null;
    if (this.datos) this.datos = sinTramite(this.datos);
    this.eleccion = { ...SIN_ELECCION, cargando: !!this.form.controls.adopcion.value };
    soltarLocalidad(this.form, this.slugManual);
  }

  /** Terminó la lectura del trámite elegido: si se leyó y está vigente, se habilita la localidad. */
  protected tramiteLeido(lectura: LecturaAdopcion): void {
    const id = this.form.controls.adopcion.value;
    const { datos, eleccion } = eleccionTrasLeer(lectura, id);
    this.eleccion = eleccion;
    if (datos) {
      this.datos = datos;
      if (!eleccion.noVigente) {
        this.adopcionId = id;
        this.form.controls.localidadId.enable({ emitEvent: false });
      }
    }
    // Los validadores de duplicados leen `datos`; y el membrete se arma con lo que acaba de llegar.
    revalidar(this.form, 'localidadId', 'slug');
    this.form.updateValueAndValidity();
  }

  /**
   * La ficha quedó así en el servidor: pasa a ser lo leído (base de la comparación, slug que se conserva, estado
   * y `activa` del membrete, bloqueo del interruptor). No toca los valores del form.
   */
  protected adoptar(ficha: FichaLocalVM): void {
    if (this.datos) this.datos = { ...this.datos, ficha };
    this.base = baseDe(ficha);
    this.slugLeido = ficha.slug;
    this.sincronizarBloqueoActiva();
    // Los validadores leen `datos.ficha`; y el membrete (`vista$`) se redibuja con el `valueChanges` del grupo.
    revalidar(this.form, 'slug', 'url', 'activa');
    this.form.updateValueAndValidity();
  }

  /** La ficha cambió en el servidor: el form se rebasa sobre `actual` (ver `rebasar`) y queda dicho qué pasó. */
  protected rebasarSobre(actual: FichaLocalVM): void {
    const rebase = rebasar(this.form, this.ficha, actual, (ficha) => this.adoptar(ficha));
    this.conflicto = rebase.conflicto;
    this.fichaActualizada = rebase.fichaActualizada;
    this.activaRestablecida = rebase.activaRestablecida;
  }

  /** Lo que se guarda (ver `aValorDeFicha`): el slug que no se tocó en edición viaja tal cual se leyó. */
  protected valorAGuardar(adopcionId: string): FichaLocalFormValue {
    return aValorDeFicha(this.form, adopcionId, this.conservaSlug ? this.slugLeido : null);
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

  private slugSugerido(): string {
    return slugSugerido(this.datos, this.form.controls.localidadId.value);
  }
}
