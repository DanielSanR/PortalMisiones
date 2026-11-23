import { ErrorHandler, NgZone } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { firstValueFrom, filter } from 'rxjs';
import { Coordenadas, ENCUADRE_MISIONES, EncuadreDeMapa } from '@core/models/ubicacion.model';
import { EstadoDelMapa, HOJA_DEL_MAPA, MapaUbicacionComponent, TilesDelMapa } from './mapa-ubicacion.component';
import { TILES_ROTOS, TILES_SIN_RED, proveerMapaSinRed } from './testing/mapa.testing';

const TILES_OK = TILES_SIN_RED;

const POSADAS: Coordenadas = { latitud: -27.367104, longitud: -55.896108 };
/** La localidad a zoom 14, como la entrega la geocodificación en un alta: pasar a un punto (17) es un zoom chico. */
const LOCALIDAD: EncuadreDeMapa = { centro: POSADAS, zoom: 14 };
const NOMBRE_DEL_MARCADOR = 'Marcador del punto. Usá las flechas para moverlo.';

describe('MapaUbicacionComponent (Leaflet real, tiles sin red)', () => {
  let fixture: ComponentFixture<MapaUbicacionComponent>;
  let comp: MapaUbicacionComponent;
  let emitidos: Coordenadas[];

  const el = (): HTMLElement => fixture.nativeElement;
  const lienzo = (): HTMLElement => el().querySelector<HTMLElement>('.mapa-ubicacion__lienzo')!;
  const marcador = (): HTMLElement | null => el().querySelector<HTMLElement>('.mapa-ubicacion__marcador');
  const hasta = (estado: EstadoDelMapa): Promise<EstadoDelMapa> =>
    firstValueFrom(comp.estadoChange.pipe(filter((e) => e === estado)));

  async function crear(
    opciones: { ubicacion?: Coordenadas | null; encuadre?: EncuadreDeMapa; soloLectura?: boolean; tiles?: TilesDelMapa } = {},
  ): Promise<void> {
    await TestBed.configureTestingModule({ imports: [MapaUbicacionComponent], providers: [proveerMapaSinRed()] }).compileComponents();
    fixture = TestBed.createComponent(MapaUbicacionComponent);
    comp = fixture.componentInstance;
    emitidos = [];
    comp.ubicacionChange.subscribe((p) => emitidos.push(p));
    fixture.componentRef.setInput('tiles', opciones.tiles ?? TILES_OK);
    fixture.componentRef.setInput('etiqueta', 'Mapa para ubicar el punto');
    fixture.componentRef.setInput('ubicacion', opciones.ubicacion ?? null);
    fixture.componentRef.setInput('encuadre', opciones.encuadre ?? null);
    fixture.componentRef.setInput('soloLectura', !!opciones.soloLectura);
    const listo = hasta('listo');
    fixture.detectChanges();
    await listo;
    fixture.detectChanges();
  }

  const tecla = (destino: HTMLElement, key: string, shiftKey = false): void => {
    destino.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };

  afterEach(() => fixture?.destroy());

  it('arranca "Cargando el mapa…" y, con Leaflet bajado, nombra y describe el mapa', async () => {
    await TestBed.configureTestingModule({ imports: [MapaUbicacionComponent], providers: [proveerMapaSinRed()] }).compileComponents();
    fixture = TestBed.createComponent(MapaUbicacionComponent);
    comp = fixture.componentInstance;
    fixture.componentRef.setInput('tiles', TILES_OK);
    const listo = hasta('listo');
    fixture.detectChanges();
    expect(el().querySelector('.mapa-ubicacion__estado[role="status"]')!.textContent).toContain('Cargando el mapa…');

    await listo;
    fixture.detectChanges();
    expect(el().querySelector('.mapa-ubicacion__estado')).toBeNull();
    expect(lienzo().getAttribute('role')).toBe('application');
    expect(lienzo().getAttribute('aria-roledescription')).toBe('mapa');
    expect(lienzo().getAttribute('aria-label')).toBe('Mapa');
    const ayuda = el().querySelector(`#${lienzo().getAttribute('aria-describedby')}`)!;
    expect(ayuda.textContent).toContain('Hacé clic en el mapa para marcar el punto');
    expect(ayuda.textContent).toContain('Enter marca el centro');
    expect(lienzo().tabIndex).toBe(0);
    // Atribución visible de OpenStreetMap (obligatoria).
    expect(el().querySelector('.leaflet-control-attribution')!.textContent).toContain('OpenStreetMap');
    // Botones de zoom en español (los de Leaflet dicen "Zoom in" / "Zoom out").
    const zoom = Array.from(el().querySelectorAll('.leaflet-control-zoom a')).map((b) => [b.getAttribute('aria-label'), b.getAttribute('title')]);
    expect(zoom).toEqual([['Acercar', 'Acercar'], ['Alejar', 'Alejar']]);
    expect(el().querySelector('.leaflet-control-attribution a')!.textContent).toContain('(se abre en una pestaña nueva)');
  });

  it('sin punto no hay marcador; un clic en el mapa lo coloca, emite el punto (6 decimales) y lo anuncia', async () => {
    await crear();
    expect(marcador()).toBeNull();
    expect(el().querySelector('.mapa-ubicacion__invitacion')!.textContent).toContain('Todavía no marcaste el punto');
    const caja = lienzo().getBoundingClientRect();
    lienzo().dispatchEvent(new MouseEvent('click', { clientX: caja.left + caja.width / 2, clientY: caja.top + caja.height / 2, bubbles: true }));
    fixture.detectChanges();

    expect(emitidos.length).toBe(1);
    const [punto] = emitidos;
    // El centro del encuadre por defecto (la provincia de Misiones).
    const { suroeste, noreste } = 'limites' in ENCUADRE_MISIONES ? ENCUADRE_MISIONES.limites : { suroeste: POSADAS, noreste: POSADAS };
    expect(punto.latitud).toBeGreaterThan(suroeste.latitud);
    expect(punto.latitud).toBeLessThan(noreste.latitud);
    expect(punto.longitud).toBeGreaterThan(suroeste.longitud);
    expect(punto.longitud).toBeLessThan(noreste.longitud);
    expect(String(punto.latitud).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
    expect(marcador()).not.toBeNull();
    expect(el().querySelector('[aria-live="polite"]')!.textContent).toContain('Punto marcado en latitud -');
    // La invitación se va con el primer punto (la vuelve a dibujar el padre al recibir la ubicación).
    fixture.componentRef.setInput('ubicacion', punto);
    fixture.detectChanges();
    expect(el().querySelector('.mapa-ubicacion__invitacion')).toBeNull();
  });

  it('con teclado: Enter sobre el mapa enfocado marca el centro', async () => {
    await crear();
    tecla(lienzo(), 'Enter');
    expect(emitidos.length).toBe(1);
    expect(marcador()).not.toBeNull();
  });

  it('el marcador es enfocable, con un nombre fijo, y las flechas lo mueven (Mayúscula: más lejos)', async () => {
    await crear({ ubicacion: POSADAS });
    const pin = marcador()!;
    expect(pin.tabIndex).toBe(0);
    expect(pin.getAttribute('aria-label')).toBe(NOMBRE_DEL_MARCADOR);

    tecla(pin, 'ArrowUp');
    expect(emitidos.length).toBe(1);
    expect(emitidos[0].latitud).toBeGreaterThan(POSADAS.latitud);
    expect(emitidos[0].longitud).toBe(POSADAS.longitud);
    const corto = emitidos[0].latitud - POSADAS.latitud;

    tecla(pin, 'ArrowRight', true);
    expect(emitidos[1].longitud - emitidos[0].longitud).toBeGreaterThan(corto * 3);
    // Las coordenadas las dice SOLO la región viva: si el nombre del marcador también cambiara, se oirían dos veces.
    expect(el().querySelector('[aria-live="polite"]')!.textContent).toContain(String(emitidos[1].longitud).replace('.', ','));
    expect(pin.getAttribute('aria-label')).toBe(NOMBRE_DEL_MARCADOR);

    tecla(pin, 'a');
    expect(emitidos.length).toBe(2);
  });

  it('arrastrar el marcador emite el punto donde se suelta', async () => {
    await crear({ ubicacion: POSADAS });
    const pin = marcador()!;
    const caja = pin.getBoundingClientRect();
    const x = caja.left + caja.width / 2;
    const y = caja.top + caja.height / 2;
    pin.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, button: 0, bubbles: true }));
    // Como el mouse real: los movimientos salen del propio marcador y suben hasta `document`.
    pin.dispatchEvent(new MouseEvent('mousemove', { clientX: x + 20, clientY: y + 30, bubbles: true }));
    pin.dispatchEvent(new MouseEvent('mousemove', { clientX: x + 40, clientY: y + 60, bubbles: true }));
    pin.dispatchEvent(new MouseEvent('mouseup', { clientX: x + 40, clientY: y + 60, bubbles: true }));
    fixture.detectChanges();

    expect(emitidos.length).toBe(1);
    expect(emitidos[0].latitud).toBeLessThan(POSADAS.latitud);
    expect(emitidos[0].longitud).toBeGreaterThan(POSADAS.longitud);
  });

  it('coordenadas que llegan de afuera (escritas a mano) mueven el marcador sin volver a emitir', async () => {
    await crear({ ubicacion: POSADAS });
    const pin = marcador()!;
    const antes = pin.style.transform;
    fixture.componentRef.setInput('ubicacion', { latitud: -27.4, longitud: -55.9 });
    fixture.detectChanges();
    expect(marcador()).toBe(pin);
    expect(pin.style.transform).not.toBe(antes);
    expect(pin.getAttribute('aria-label')).toBe(NOMBRE_DEL_MARCADOR);

    fixture.componentRef.setInput('ubicacion', null);
    fixture.detectChanges();
    expect(marcador()).toBeNull();
    expect(emitidos).toEqual([]);
  });

  it('solo lectura: el clic no marca nada y el marcador no se enfoca ni se mueve', async () => {
    await crear({ ubicacion: POSADAS, soloLectura: true });
    const caja = lienzo().getBoundingClientRect();
    lienzo().dispatchEvent(new MouseEvent('click', { clientX: caja.left + 10, clientY: caja.top + 10, bubbles: true }));
    tecla(lienzo(), 'Enter');
    const pin = marcador()!;
    tecla(pin, 'ArrowUp');

    expect(emitidos).toEqual([]);
    expect(pin.hasAttribute('tabindex')).toBeFalse();
    expect(pin.getAttribute('role')).toBe('img');
    expect(pin.getAttribute('aria-label')).toBe('Punto marcado en latitud -27,367104, longitud -55,896108');
    expect(el().querySelector('.mapa-ubicacion__ayuda')!.textContent).toContain('Ubicación guardada del punto');
  });

  it('si no carga ningún tile (CSP, sin red) avisa en el lugar del mapa y lo saca del tabulado', async () => {
    await TestBed.configureTestingModule({ imports: [MapaUbicacionComponent], providers: [proveerMapaSinRed()] }).compileComponents();
    fixture = TestBed.createComponent(MapaUbicacionComponent);
    comp = fixture.componentInstance;
    fixture.componentRef.setInput('tiles', TILES_ROTOS);
    fixture.componentRef.setInput('textoSinMapa', 'Podés cargar las coordenadas a mano.');
    const sinMapa = hasta('sin-mapa');
    fixture.detectChanges();
    await sinMapa;
    fixture.detectChanges();

    const aviso = el().querySelector('.mapa-ubicacion__aviso[role="alert"]')!;
    expect(aviso.textContent!.trim()).toBe('No pudimos cargar el mapa. Podés cargar las coordenadas a mano.');
    expect(lienzo().hidden).toBeTrue();
    // Las instrucciones del mapa ya no aplican: queda solo el aviso.
    expect(el().querySelector<HTMLElement>('.mapa-ubicacion__ayuda')!.hidden).toBeTrue();
  });

  it('al destruirse quita el mapa (Leaflet suelta el contenedor y sus eventos)', async () => {
    await crear({ ubicacion: POSADAS });
    const contenedor = lienzo();
    expect(contenedor.querySelector('.leaflet-pane')).not.toBeNull();
    fixture.destroy();
    expect(contenedor.querySelector('.leaflet-pane')).toBeNull();
    expect(contenedor.querySelector('.leaflet-control-zoom')).toBeNull();
  });

  it('destruido antes de que llegue Leaflet: no arma el mapa ni avisa ningún estado', async () => {
    await TestBed.configureTestingModule({ imports: [MapaUbicacionComponent], providers: [proveerMapaSinRed()] }).compileComponents();
    fixture = TestBed.createComponent(MapaUbicacionComponent);
    const estados: EstadoDelMapa[] = [];
    fixture.componentInstance.estadoChange.subscribe((e) => estados.push(e));
    fixture.componentRef.setInput('tiles', TILES_OK);
    fixture.detectChanges(); // arranca el `import('leaflet')`
    const contenedor = lienzo();
    fixture.destroy();
    // El mismo módulo: resuelve después del pedido del componente, que ya lo encuentra destruido.
    await import('leaflet');
    await Promise.resolve();

    expect(contenedor.querySelector('.leaflet-pane')).toBeNull();
    expect(estados).toEqual([]);
  });

  it('si la hoja del mapa no carga (sin red) muestra el aviso en vez de dibujar Leaflet sin estilos', async () => {
    await TestBed.configureTestingModule({
      imports: [MapaUbicacionComponent],
      providers: [proveerMapaSinRed(), { provide: HOJA_DEL_MAPA, useValue: 'hoja-del-mapa-que-no-existe.css' }],
    }).compileComponents();
    fixture = TestBed.createComponent(MapaUbicacionComponent);
    comp = fixture.componentInstance;
    fixture.componentRef.setInput('tiles', TILES_OK);
    const sinMapa = hasta('sin-mapa');
    fixture.detectChanges();
    await sinMapa;
    fixture.detectChanges();

    expect(el().querySelector('.mapa-ubicacion__aviso[role="alert"]')).not.toBeNull();
    // Se quitó el `<link>` fallido: la próxima apertura lo vuelve a pedir.
    expect(document.head.querySelector('link[data-hoja-del-mapa]')).toBeNull();
  });

  it('un clic en otra copia del mundo (zoom bajo) emite una longitud dentro de ±180', async () => {
    await crear({ encuadre: { centro: { latitud: 0, longitud: 179 }, zoom: 2 } });
    const caja = lienzo().getBoundingClientRect();
    // ~21° al este del centro: pasa el antimeridiano (sin normalizar daría ~200).
    lienzo().dispatchEvent(new MouseEvent('click', { clientX: caja.left + caja.width / 2 + 60, clientY: caja.top + caja.height / 2, bubbles: true }));
    fixture.detectChanges();

    expect(emitidos.length).toBe(1);
    expect(emitidos[0].longitud).toBeGreaterThanOrEqual(-180);
    expect(emitidos[0].longitud).toBeLessThan(0);
  });

  describe('encuadre que llega tarde (la localidad se resuelve después de abrir)', () => {
    const BUENOS_AIRES: EncuadreDeMapa = { centro: { latitud: -34.6, longitud: -58.38 }, zoom: 14 };

    it('sin que la persona haya tocado el mapa, lo centra en la localidad', async () => {
      await crear();
      fixture.componentRef.setInput('encuadre', BUENOS_AIRES);
      fixture.detectChanges();
      tecla(lienzo(), 'Enter'); // marca el centro
      expect(emitidos[0].latitud).toBeCloseTo(-34.6, 2);
    });

    it('si la persona ya empezó a mover el mapa, no se lo saca de las manos', async () => {
      await crear();
      lienzo().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      fixture.componentRef.setInput('encuadre', BUENOS_AIRES);
      fixture.detectChanges();
      tecla(lienzo(), 'Enter');
      // Sigue en Misiones (el encuadre por defecto).
      expect(emitidos[0].latitud).toBeGreaterThan(-28.2);
      expect(emitidos[0].latitud).toBeLessThan(-25.4);
    });
  });

  describe('Leaflet fuera de la zona de Angular', () => {
    let errores: unknown[];
    let manejador: jasmine.Spy;
    let consola: jasmine.Spy;

    beforeEach(async () => {
      await crear({ encuadre: LOCALIDAD });
      errores = [];
      TestBed.inject(NgZone).onError.subscribe((e: unknown) => errores.push(e));
      manejador = spyOn(TestBed.inject(ErrorHandler), 'handleError');
      consola = spyOn(console, 'error');
    });

    /**
     * Un punto que queda entre el margen y el borde de la vista a zoom 14 (al 45 % del ancho, desde el centro): el
     * marcador tiene que volver a centrarse, y el salto es lo bastante corto para que Leaflet lo anime si se le pide.
     */
    const cercaDelBorde = (): Coordenadas => {
      const gradosPorPixel = 360 / (256 * 2 ** 14);
      return { latitud: POSADAS.latitud, longitud: POSADAS.longitud + 0.45 * lienzo().clientWidth * gradosPorPixel };
    };

    const sinErrores = (): void => {
      expect(errores).toEqual([]);
      expect(manejador).not.toHaveBeenCalled();
      expect(consola).not.toHaveBeenCalled();
    };

    it('coordenadas escritas (zoom 14 → 17) y el diálogo cerrado enseguida: ningún error al vencer los temporizadores de Leaflet', fakeAsync(() => {
      fixture.componentRef.setInput('ubicacion', cercaDelBorde());
      fixture.detectChanges();
      tick(20); // el cuadro en que Leaflet arrancaría un zoom animado (y su temporizador de 250 ms)
      fixture.destroy();
      expect(() => tick(300)).not.toThrow();
      flush();
      sinErrores();
    }));

    it('un zoom de la persona («Acercar») en curso al destruir no deja errores, y el mapa se quita igual', fakeAsync(() => {
      const contenedor = lienzo();
      contenedor.querySelector<HTMLElement>('.leaflet-control-zoom-in')!.click();
      tick(20);
      fixture.destroy();
      expect(() => tick(300)).not.toThrow();
      flush();
      sinErrores();
      expect(contenedor.querySelector('.leaflet-pane')).toBeNull();
    }));

    it('los tiles y el marcador que nacen de un @Input no disparan detección de cambios al cargar ni al arrastrar', () => {
      const antes = new Set(Array.from(lienzo().querySelectorAll('img.leaflet-tile')));
      fixture.componentRef.setInput('ubicacion', cercaDelBorde());
      fixture.detectChanges();
      const nuevos = Array.from(lienzo().querySelectorAll<HTMLImageElement>('img.leaflet-tile')).filter((t) => !antes.has(t));
      expect(nuevos.length).toBeGreaterThan(0);
      let vueltas = 0;
      const sub = TestBed.inject(NgZone).onMicrotaskEmpty.subscribe(() => vueltas++);

      nuevos.forEach((t) => t.dispatchEvent(new Event('load')));
      const pin = marcador()!;
      const caja = pin.getBoundingClientRect();
      pin.dispatchEvent(new MouseEvent('mousedown', { clientX: caja.left + 5, clientY: caja.top + 5, button: 0, bubbles: true }));
      pin.dispatchEvent(new MouseEvent('mousemove', { clientX: caja.left + 25, clientY: caja.top + 35, bubbles: true }));
      pin.dispatchEvent(new MouseEvent('mousemove', { clientX: caja.left + 45, clientY: caja.top + 65, bubbles: true }));
      expect(vueltas).toBe(0);

      // Soltar sí vuelve a la zona: emite el punto (una sola vuelta).
      pin.dispatchEvent(new MouseEvent('mouseup', { clientX: caja.left + 45, clientY: caja.top + 65, bubbles: true }));
      sub.unsubscribe();
      expect(emitidos.length).toBe(1);
      expect(vueltas).toBeGreaterThan(0);
    });
  });
});
