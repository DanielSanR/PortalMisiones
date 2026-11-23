import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, InjectionToken, Input, NgZone,
  OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type * as Leaflet from 'leaflet';
import { environment } from '@env/environment';
import {
  Coordenadas, ENCUADRE_MISIONES, EncuadreDeMapa, mismasCoordenadas, redondearCoordenadas,
} from '@core/models/ubicacion.model';
import {
  ERRORES_TILES_MAX, ESPERA_TILES_MS, HOJA_DEL_MAPA_POR_DEFECTO, LeafletModulo, PREFIJO_DE_ATRIBUCION, ZOOM_DE_PUNTO, aCoordenadas,
  aLatLng, aplicarEncuadre, cargarHojaDelMapa, controlDeZoom, desplazamientoDeTecla, iconoDelMarcador, moduloDeLeaflet,
  moverEnPixeles, quitarMapa,
} from './mapa-ubicacion.leaflet';

/** Servidor de tiles y su atribución (obligatoria y visible). Por defecto, `environment.mapa.tiles`. */
export interface TilesDelMapa {
  url: string;
  atribucion: string;
}

type ConfigMapa = { mapa?: { tiles?: TilesDelMapa } };

/**
 * Tiles de todos los mapas: los del entorno. Un spec lo reemplaza por tiles sin red
 * (`proveerMapaSinRed()` de `./testing/mapa.testing`), también cuando el mapa está dentro de otra pantalla.
 */
export const TILES_DEL_MAPA = new InjectionToken<TilesDelMapa>('TILES_DEL_MAPA', {
  providedIn: 'root',
  factory: () => (environment as ConfigMapa).mapa?.tiles ?? { url: '', atribucion: '' },
});

/** URL de la hoja del mapa (CSS de Leaflet + marcador, bundle `mapa.css`). `null` en specs: no se agrega. */
export const HOJA_DEL_MAPA = new InjectionToken<string | null>('HOJA_DEL_MAPA', {
  providedIn: 'root',
  factory: () => HOJA_DEL_MAPA_POR_DEFECTO,
});

/** `cargando`: se baja Leaflet · `listo`: mapa dibujado · `sin-mapa`: no se pudo (librería o tiles). */
export type EstadoDelMapa = 'cargando' | 'listo' | 'sin-mapa';

let secuencia = 0;

/** Fracción del mapa que se deja de margen: un marcador que se acerca al borde (y se cortaría) vuelve a centrarse. */
const MARGEN_VISIBLE = 0.1;

/**
 * Nombre del marcador editable: fijo. Las coordenadas de cada movimiento las dice la región viva; si el nombre
 * también cambiara, con las flechas se oirían dos veces.
 */
const NOMBRE_DEL_MARCADOR = 'Marcador del punto. Usá las flechas para moverlo.';

/** Eventos del contenedor que indican que la persona empezó a mover el mapa (un encuadre que llega tarde no la pisa). */
const EVENTOS_DE_LA_PERSONA = ['pointerdown', 'wheel', 'keydown'] as const;

/** Coordenadas con coma decimal (es-AR), para anunciarlas. */
function decir(n: number): string {
  return String(n).replace('.', ',');
}

/**
 * Mapa interactivo para marcar UN punto (Leaflet + tiles de OpenStreetMap). No sabe qué se ubica: recibe
 * `ubicacion` (el punto marcado, o `null`) y `encuadre` (dónde abrir sin punto), y emite `ubicacionChange` con
 * el punto que marca la persona, redondeado a 6 decimales. Con `soloLectura` solo muestra.
 *
 * - **Carga diferida**: Leaflet (~150 kB) se baja con `import()` recién al dibujarse el componente, y su CSS (con
 *   el del marcador) es un bundle aparte, `mapa.css` (`shared-styles/mapa-leaflet.scss`), que se agrega con un
 *   `<link>` en ese momento: los nodos que crea Leaflet no llevan el atributo de encapsulación. Quien lo usa lo pone
 *   dentro de un `@defer`, así tampoco el componente viaja con la pantalla.
 * - **Marcar**: clic en el mapa, arrastrar el marcador, o teclado: con el mapa enfocado las flechas lo mueven
 *   (Leaflet) y Enter marca el centro; con el marcador enfocado, las flechas lo mueven (Mayúscula: paso largo).
 *   Cada punto marcado se anuncia en una región `aria-live` que está siempre montada.
 * - **No atrapa**: la rueda hace zoom solo con el mapa enfocado; en un teléfono un dedo desplaza la pantalla
 *   (no arrastra el mapa): se acerca con los botones o con dos dedos, y se marca tocando.
 * - **Sin animaciones de vuelo** con `prefers-reduced-motion`. Los cambios de zoom que hace el componente (un punto
 *   escrito, un encuadre) nunca se animan; solo el paneo, cuando el zoom no cambia.
 * - **Encuadre tardío**: si la localidad llega cuando la persona ya empezó a mover el mapa (o ya hay un punto), se
 *   ignora.
 * - **Degrada**: si Leaflet o su hoja de estilos no cargan, o no carga ningún tile (CSP que no permite el servidor, sin red), muestra
 *   `textoSinMapa` en su lugar; el resto de la pantalla sigue andando.
 *
 * Fuera de la zona de Angular: TODO lo de Leaflet (armarlo en `ngAfterViewInit` y lo que nace de un `@Input` en
 * `ngOnChanges`) corre con `runOutsideAngular`, así sus tiles, sus temporizadores y los oyentes del marcador no
 * disparan detección de cambios; solo `marcar` y `cambiarEstado` vuelven a la zona para emitir o cambiar lo que se
 * ve. `ngOnDestroy` destruye el mapa con `quitarMapa` (que no puede lanzar, ni siquiera con un zoom en curso).
 */
@Component({
  selector: 'app-mapa-ubicacion',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mapa-ubicacion.component.html',
  styleUrl: './mapa-ubicacion.component.scss',
})
export class MapaUbicacionComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Punto marcado (`null` = todavía no hay). Si cambia desde afuera (coordenadas escritas), el marcador lo sigue. */
  @Input() ubicacion: Coordenadas | null = null;
  /** Dónde abrir cuando no hay punto. Sin esto, la provincia de Misiones. */
  @Input() encuadre: EncuadreDeMapa | null = null;
  @Input() soloLectura = false;
  /** Nombre accesible del mapa. */
  @Input() etiqueta = 'Mapa';
  /** Qué hacer si el mapa no carga (después de "No pudimos cargar el mapa."). */
  @Input() textoSinMapa = 'Podés cargar las coordenadas a mano.';
  @Input() tiles: TilesDelMapa = inject(TILES_DEL_MAPA);

  @Output() readonly ubicacionChange = new EventEmitter<Coordenadas>();
  /** Para quien quiera adaptar sus textos (p. ej. ofrecer el enlace externo si no hay mapa). */
  @Output() readonly estadoChange = new EventEmitter<EstadoDelMapa>();

  @ViewChild('lienzo', { static: true }) private lienzo!: ElementRef<HTMLDivElement>;

  estado: EstadoDelMapa = 'cargando';
  /** Último punto marcado por la persona, dicho en palabras (región viva). */
  anuncio = '';
  readonly idAyuda = `mapa-ubicacion-ayuda-${++secuencia}`;

  private readonly zone = inject(NgZone);
  private readonly documento = inject(DOCUMENT);
  private readonly hoja = inject(HOJA_DEL_MAPA);
  private readonly cdr = inject(ChangeDetectorRef);

  private L: LeafletModulo | null = null;
  private mapa: Leaflet.Map | null = null;
  private marcador: Leaflet.Marker | null = null;
  private observador: ResizeObserver | null = null;
  private esperaTiles: ReturnType<typeof setTimeout> | null = null;
  private tilesCargados = 0;
  private tilesFallidos = 0;
  private destruido = false;
  /** La persona ya tocó el mapa (puntero, rueda o teclado): un encuadre que llega tarde no se le impone. */
  private movidoPorLaPersona = false;
  /** Hay un zoom animado de Leaflet en curso (del `zoomanim` al `zoomend`): ver `quitarMapa`. */
  private zoomEnCurso = false;
  private readonly animar = !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  ngAfterViewInit(): void {
    // Cualquier falla al bajar o armar el mapa (chunk que no llega, librería incompatible) deja el aviso, nunca
    // "Cargando el mapa…" para siempre.
    void this.zone.runOutsideAngular(() => this.iniciar().catch(() => this.sinMapa()));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.mapa || !this.L) return;
    // `ngOnChanges` corre en la zona: lo que Leaflet arme acá (tiles, marcador, temporizadores) tiene que nacer afuera.
    this.zone.runOutsideAngular(() => {
      if (changes['ubicacion']) this.seguirUbicacion();
      if (changes['encuadre']) this.encuadrar();
    });
  }

  ngOnDestroy(): void {
    this.destruido = true;
    if (this.esperaTiles) clearTimeout(this.esperaTiles);
    this.observador?.disconnect();
    const mapa = this.mapa;
    this.mapa = null;
    this.marcador = null;
    if (mapa) this.zone.runOutsideAngular(() => quitarMapa(mapa, this.zoomEnCurso));
  }

  private async iniciar(): Promise<void> {
    const [modulo] = await Promise.all([import('leaflet'), cargarHojaDelMapa(this.documento, this.hoja)]);
    if (this.destruido) return;
    const L = moduloDeLeaflet(modulo);
    this.L = L;
    const el = this.lienzo.nativeElement;
    const mapa = L.map(el, {
      keyboard: true,
      keyboardPanDelta: 80,
      // La rueda solo con el mapa enfocado: si no, al desplazar el diálogo se "engancha" en el mapa.
      scrollWheelZoom: false,
      // Teléfono: un dedo desplaza el diálogo; se acerca con los botones o con dos dedos.
      dragging: !L.Browser.mobile,
      zoomAnimation: this.animar,
      fadeAnimation: this.animar,
      markerZoomAnimation: this.animar,
      inertia: this.animar,
      // El de Leaflet se nombra en inglés: va el propio, con "Acercar" / "Alejar".
      zoomControl: false,
    });
    this.mapa = mapa;
    controlDeZoom(L).addTo(mapa);
    mapa.attributionControl.setPrefix(PREFIJO_DE_ATRIBUCION);
    mapa.on('zoomanim', () => { this.zoomEnCurso = true; });
    mapa.on('zoomend', () => { this.zoomEnCurso = false; });
    this.prepararContenedor(el);

    L.tileLayer(this.tiles.url, { attribution: this.tiles.atribucion, maxZoom: 19 })
      .on('tileload', () => this.tilesCargados++)
      .on('tileerror', () => this.alFallarTile())
      .addTo(mapa);
    this.esperaTiles = setTimeout(() => { if (!this.tilesCargados) this.sinMapa(); }, ESPERA_TILES_MS);

    if (this.ubicacion) mapa.setView(aLatLng(L, this.ubicacion), ZOOM_DE_PUNTO, { animate: false });
    else aplicarEncuadre(L, mapa, this.encuadre ?? ENCUADRE_MISIONES);
    this.seguirUbicacion();

    mapa.on('click', (e: Leaflet.LeafletMouseEvent) => { if (!this.soloLectura) this.marcar(e.latlng); });
    mapa.on('focus', () => mapa.scrollWheelZoom.enable());
    mapa.on('blur', () => mapa.scrollWheelZoom.disable());
    // El diálogo puede cambiar de ancho (abre animado, rota el teléfono): Leaflet tiene que volver a medir.
    this.observador = new ResizeObserver(() => this.mapa?.invalidateSize({ animate: false }));
    this.observador.observe(el);
    this.cambiarEstado('listo');
  }

  /** Nombre, descripción y rol del contenedor (Leaflet ya lo hace enfocable), y Enter = marcar el centro. */
  private prepararContenedor(el: HTMLElement): void {
    el.setAttribute('role', 'application');
    el.setAttribute('aria-roledescription', 'mapa');
    el.setAttribute('aria-label', this.etiqueta);
    el.setAttribute('aria-describedby', this.idAyuda);
    for (const tipo of EVENTOS_DE_LA_PERSONA) el.addEventListener(tipo, () => { this.movidoPorLaPersona = true; }, { passive: true });
    el.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Enter' || evento.target !== el || this.soloLectura || !this.mapa) return;
      evento.preventDefault();
      this.marcar(this.mapa.getCenter());
    });
  }

  /** El encuadre de la localidad, si todavía sirve: sin punto marcado y sin que la persona haya movido el mapa. */
  private encuadrar(): void {
    const { L, mapa } = this;
    if (!L || !mapa || !this.encuadre || this.ubicacion || this.marcador || this.movidoPorLaPersona) return;
    aplicarEncuadre(L, mapa, this.encuadre);
  }

  /** Lleva el marcador (y la vista, si queda afuera) a `ubicacion`; sin ubicación, lo quita. */
  private seguirUbicacion(): void {
    const { L, mapa } = this;
    if (!L || !mapa) return;
    if (!this.ubicacion) {
      this.marcador?.remove();
      this.marcador = null;
      return;
    }
    if (this.marcador && mismasCoordenadas(aCoordenadas(this.marcador.getLatLng()), this.ubicacion)) return;
    const latlng = aLatLng(L, this.ubicacion);
    if (this.marcador) this.moverMarcador(this.marcador, latlng);
    else this.marcador = this.crearMarcador(L, mapa, latlng);
    if (mapa.getBounds().pad(-MARGEN_VISIBLE).contains(latlng)) return;
    // Un cambio de zoom va sin animar: el zoom animado de Leaflet deja un temporizador que `remove()` no cancela.
    const zoom = Math.max(mapa.getZoom(), ZOOM_DE_PUNTO);
    mapa.setView(latlng, zoom, { animate: this.animar && zoom === mapa.getZoom() });
  }

  private crearMarcador(L: LeafletModulo, mapa: Leaflet.Map, latlng: Leaflet.LatLng): Leaflet.Marker {
    const editable = !this.soloLectura;
    const marcador = L.marker(latlng, { icon: iconoDelMarcador(L, !editable), draggable: editable, keyboard: editable, autoPan: true })
      .addTo(mapa);
    marcador.on('dragend', () => this.marcar(marcador.getLatLng()));
    const el = marcador.getElement();
    if (el && editable) {
      el.addEventListener('keydown', (evento) => {
        const delta = desplazamientoDeTecla(evento);
        if (!delta || !this.mapa) return;
        evento.preventDefault();
        evento.stopPropagation();
        const destino = moverEnPixeles(this.mapa, marcador.getLatLng(), delta);
        marcador.setLatLng(destino);
        if (!this.mapa.getBounds().pad(-MARGEN_VISIBLE).contains(destino)) this.mapa.panTo(destino, { animate: this.animar });
        this.marcar(destino);
      });
    }
    if (el && !editable) el.setAttribute('role', 'img');
    // Editable: nombre fijo (las coordenadas las anuncia la región viva). De solo lectura no se mueve: dice dónde está.
    el?.setAttribute('aria-label', editable ? NOMBRE_DEL_MARCADOR : `Punto marcado en ${this.dondeEsta(latlng)}`);
    return marcador;
  }

  /** De solo lectura, el nombre dice dónde está: se actualiza con él. El editable conserva su nombre fijo. */
  private moverMarcador(marcador: Leaflet.Marker, latlng: Leaflet.LatLng): void {
    marcador.setLatLng(latlng);
    if (this.soloLectura) marcador.getElement()?.setAttribute('aria-label', `Punto marcado en ${this.dondeEsta(latlng)}`);
  }

  private dondeEsta(latlng: Leaflet.LatLng): string {
    const punto = redondearCoordenadas(aCoordenadas(latlng));
    return `latitud ${decir(punto.latitud)}, longitud ${decir(punto.longitud)}`;
  }

  /**
   * La persona marcó un punto: se normaliza (un clic en otra copia del mundo, a zoom bajo, da una longitud fuera
   * de ±180), se redondea, se mueve el marcador, se anuncia y se emite (dentro de la zona).
   */
  private marcar(latlng: Leaflet.LatLng): void {
    const punto = redondearCoordenadas(aCoordenadas(latlng.wrap()));
    this.ubicacion = punto;
    this.seguirUbicacion();
    this.zone.run(() => {
      this.anuncio = `Punto marcado en latitud ${decir(punto.latitud)}, longitud ${decir(punto.longitud)}.`;
      this.ubicacionChange.emit(punto);
      this.cdr.markForCheck();
    });
  }

  private alFallarTile(): void {
    this.tilesFallidos++;
    if (!this.tilesCargados && this.tilesFallidos >= ERRORES_TILES_MAX) this.sinMapa();
  }

  private sinMapa(): void {
    if (this.destruido || this.estado === 'sin-mapa') return;
    if (this.esperaTiles) clearTimeout(this.esperaTiles);
    this.cambiarEstado('sin-mapa');
  }

  private cambiarEstado(estado: EstadoDelMapa): void {
    this.zone.run(() => {
      this.estado = estado;
      this.estadoChange.emit(estado);
      this.cdr.markForCheck();
    });
  }
}
