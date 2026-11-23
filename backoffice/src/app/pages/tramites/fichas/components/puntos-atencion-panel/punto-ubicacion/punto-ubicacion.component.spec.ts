import { ComponentFixture, DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, FormGroup } from '@angular/forms';
import { Observable, Subject, filter, firstValueFrom, of, throwError } from 'rxjs';
import { EncuadreDeMapa } from '@core/models/ubicacion.model';
import { GeocodificacionFacade, LugarVM } from '@features/geocodificacion';
import { MapaUbicacionComponent } from '@shared/components/mapa-ubicacion/mapa-ubicacion.component';
import { proveerMapaSinRed } from '@shared/components/mapa-ubicacion/testing/mapa.testing';
import { escrituraDeVista } from '@shared/components/dynamic-form/dynamic-form.vista';
import { errorDeCoordenada } from '../coordenadas';
import { PuntoUbicacionComponent } from './punto-ubicacion.component';
import { TEXTO_SIN_MAPA } from './punto-ubicacion-textos';

const UNO: LugarVM = { id: 'a', nombre: 'Av. Uruguay 3150', detalle: 'Posadas, Misiones', coordenadas: { latitud: -27.367104, longitud: -55.896108 } };
const OTRO: LugarVM = { id: 'b', nombre: 'Av. Uruguay 3150 (barrio)', detalle: 'Garupá, Misiones', coordenadas: { latitud: -27.48, longitud: -55.83 } };

interface FacadeDePrueba {
  disponible: boolean;
  buscarDireccion: jasmine.Spy<(direccion: string, localidad: string | null) => Observable<LugarVM[]>>;
  encuadreDeLocalidad: jasmine.Spy<(localidad: string | null) => Observable<EncuadreDeMapa | null>>;
}

describe('PuntoUbicacionComponent (ubicar el punto: búsqueda + mapa)', () => {
  let fixture: ComponentFixture<PuntoUbicacionComponent>;
  let grupo: FormGroup;
  let facade: FacadeDePrueba;

  const el = (): HTMLElement => fixture.nativeElement;
  const ubicar = (): HTMLButtonElement => el().querySelector<HTMLButtonElement>('.punto-ubicacion__ubicar')!;
  const mensaje = (): string => (el().querySelector('.punto-ubicacion__mensaje')!.textContent ?? '').replace(/\s+/g, ' ').trim();
  const mapa = (): MapaUbicacionComponent => fixture.debugElement.query(By.directive(MapaUbicacionComponent)).componentInstance;

  async function crear(
    valores: { direccion?: string; latitud?: string; longitud?: string } = {}, disponible = true, deferManual = false,
  ): Promise<void> {
    const coordenada = (min: number, max: number) => (c: { value: unknown }) => (errorDeCoordenada(String(c.value ?? ''), min, max) ? { mal: true } : null);
    grupo = new FormGroup({
      direccion: new FormControl(valores.direccion ?? ''),
      latitud: new FormControl(valores.latitud ?? '', coordenada(-90, 90)),
      longitud: new FormControl(valores.longitud ?? '', coordenada(-180, 180)),
    });
    facade = {
      disponible,
      buscarDireccion: jasmine.createSpy('buscarDireccion').and.returnValue(of([UNO])),
      encuadreDeLocalidad: jasmine.createSpy('encuadreDeLocalidad').and.returnValue(of({ centro: UNO.coordenadas, zoom: 14 })),
    };
    await TestBed.configureTestingModule({
      imports: [PuntoUbicacionComponent],
      providers: [provideNoopAnimations(), { provide: GeocodificacionFacade, useValue: facade }, proveerMapaSinRed()],
      deferBlockBehavior: deferManual ? DeferBlockBehavior.Manual : DeferBlockBehavior.Playthrough,
    }).compileComponents();
    fixture = TestBed.createComponent(PuntoUbicacionComponent);
    fixture.componentRef.setInput('grupo', grupo);
    fixture.componentRef.setInput('datos', { localidad: 'Posadas' });
    fixture.componentRef.setInput('escribir', escrituraDeVista(grupo, ['latitud', 'longitud'], '_ubicacion'));
    fixture.detectChanges();
    if (deferManual) return;
    await fixture.whenStable(); // @defer del mapa
    fixture.detectChanges();
    if (mapa().estado === 'cargando') await firstValueFrom(mapa().estadoChange.pipe(filter((e) => e !== 'cargando')));
    fixture.detectChanges();
  }

  afterEach(() => fixture?.destroy());

  describe('el mapa y los campos van y vienen', () => {
    it('en un alta el mapa abre en la localidad de la ficha', async () => {
      await crear();
      expect(facade.encuadreDeLocalidad).toHaveBeenCalledOnceWith('Posadas');
      expect(mapa().encuadre).toEqual({ centro: UNO.coordenadas, zoom: 14 });
      expect(mapa().ubicacion).toBeNull();
    });

    it('en una edición abre en el punto guardado y no consulta la localidad', async () => {
      await crear({ latitud: '-27,4', longitud: '-55,9' });
      expect(facade.encuadreDeLocalidad).not.toHaveBeenCalled();
      expect(mapa().ubicacion).toEqual({ latitud: -27.4, longitud: -55.9 });
    });

    it('marcar en el mapa completa latitud y longitud (coma decimal) y las deja como cambiadas', async () => {
      await crear();
      mapa().ubicacionChange.emit({ latitud: -27.371234, longitud: -55.901234 });
      fixture.detectChanges();
      expect(grupo.getRawValue()).toEqual({ direccion: '', latitud: '-27,371234', longitud: '-55,901234' });
      expect(grupo.get('latitud')!.dirty).toBeTrue();
    });

    it('coordenadas escritas a mano y válidas mueven el marcador; inválidas lo dejan donde estaba', async () => {
      await crear({ latitud: '-27,4', longitud: '-55,9' });
      grupo.patchValue({ latitud: '-27,5', longitud: '-55,25' });
      fixture.detectChanges();
      expect(mapa().ubicacion).toEqual({ latitud: -27.5, longitud: -55.25 });

      grupo.patchValue({ longitud: '200' });
      fixture.detectChanges();
      expect(mapa().ubicacion).toEqual({ latitud: -27.5, longitud: -55.25 });
      expect(el().querySelector('.punto-ubicacion__externo')).withContext('sin enlace con una coordenada inválida').toBeNull();

      grupo.patchValue({ latitud: '', longitud: '' });
      fixture.detectChanges();
      expect(mapa().ubicacion).toBeNull();
    });

    it('"Abrir en OpenStreetMap" aparece solo con coordenadas válidas y abre en otra pestaña', async () => {
      await crear();
      expect(el().querySelector('.punto-ubicacion__externo')).toBeNull();
      grupo.patchValue({ latitud: '-27,5', longitud: '-55.25' });
      fixture.detectChanges();
      const enlace = el().querySelector<HTMLAnchorElement>('.punto-ubicacion__externo')!;
      expect(enlace.getAttribute('href')).toBe('https://www.openstreetmap.org/?mlat=-27.5&mlon=-55.25#map=17/-27.5/-55.25');
      expect(enlace.target).toBe('_blank');
      expect(enlace.rel).toBe('noopener noreferrer');
      expect(enlace.textContent).toContain('Abrir en OpenStreetMap');
      expect(enlace.textContent).toContain('(se abre en una pestaña nueva)');
    });

    it('"Cargando el mapa…" se anuncia una sola vez: el lugar reservado del @defer no es una región viva', async () => {
      await crear({}, true, true);
      const [bloque] = await fixture.getDeferBlocks();
      await bloque.render(DeferBlockState.Placeholder);
      const reservado = el().querySelector('.punto-ubicacion__cargando')!;
      expect(reservado.textContent).toContain('Cargando el mapa…');
      expect(reservado.hasAttribute('role')).toBeFalse();
      expect(reservado.hasAttribute('aria-live')).toBeFalse();

      await bloque.render(DeferBlockState.Complete);
      const estados = Array.from(el().querySelectorAll('[role="status"], [aria-live]'))
        .filter((nodo) => nodo.textContent!.includes('Cargando el mapa'));
      expect(estados.length).toBe(1);
    });

    it('sin mapa, el texto no remite a un enlace que todavía no está: lo condiciona a tener las coordenadas', async () => {
      await crear();
      expect(mapa().textoSinMapa).toBe(TEXTO_SIN_MAPA);
      expect(TEXTO_SIN_MAPA).toBe('Podés cargar las coordenadas a mano; cuando estén completas, verificalas con «Abrir en OpenStreetMap».');
      // En un alta (sin coordenadas) el enlace no está, y el texto tampoco dice que esté.
      expect(el().querySelector('.punto-ubicacion__externo')).toBeNull();
    });

    it('invita a cargar las coordenadas a mano como alternativa', async () => {
      await crear();
      expect(el().querySelector('.punto-ubicacion__alternativa')!.textContent)
        .toBe('¿Ya tenés las coordenadas? Escribilas en Latitud y Longitud: el marcador se mueve solo.');
    });
  });

  describe('"Ubicar en el mapa"', () => {
    it('busca la dirección escrita con la localidad, marca el resultado y lo dice en la región viva', async () => {
      await crear({ direccion: 'Av. Uruguay 3150' });
      expect(el().querySelector('.punto-ubicacion__mensaje')!.getAttribute('aria-live')).toBe('polite');
      expect(el().querySelector('.punto-ubicacion__nota')!.textContent!.trim())
        .toBe('Busca la dirección escrita arriba (en Posadas, si no nombrás otra localidad).');

      ubicar().click();
      fixture.detectChanges();

      expect(facade.buscarDireccion).toHaveBeenCalledOnceWith('Av. Uruguay 3150', 'Posadas');
      expect(grupo.getRawValue()).toEqual({ direccion: 'Av. Uruguay 3150', latitud: '-27,367104', longitud: '-55,896108' });
      expect(mensaje()).toBe('Ubicamos «Av. Uruguay 3150». Revisá que el marcador quede en la puerta y movelo si hace falta.');
      expect(el().querySelector('.punto-ubicacion__resultados')).toBeNull();
    });

    it('con varios resultados marca el primero y deja elegir otro', async () => {
      await crear({ direccion: 'Av. Uruguay 3150' });
      facade.buscarDireccion.and.returnValue(of([UNO, OTRO]));
      ubicar().click();
      fixture.detectChanges();

      expect(mensaje()).toBe('Encontramos 2 lugares y marcamos «Av. Uruguay 3150». Si no es ese, elegí otro de la lista.');
      const opciones = Array.from(el().querySelectorAll<HTMLButtonElement>('.punto-ubicacion__resultado'));
      expect(opciones.map((o) => o.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
      expect(opciones[1].textContent).toContain('Garupá, Misiones');

      opciones[1].click();
      fixture.detectChanges();
      expect(grupo.getRawValue().latitud).toBe('-27,48');
      expect(Array.from(el().querySelectorAll('.punto-ubicacion__resultado')).map((o) => o.getAttribute('aria-pressed')))
        .toEqual(['false', 'true']);
    });

    it('sin dirección no consulta y dice qué falta', async () => {
      await crear();
      ubicar().click();
      fixture.detectChanges();
      expect(facade.buscarDireccion).not.toHaveBeenCalled();
      expect(mensaje()).toBe('Escribí la dirección del punto para ubicarla en el mapa.');
    });

    it('sin resultados, o si el servicio falla, lo cuenta con texto propio y no toca las coordenadas', async () => {
      await crear({ direccion: 'Calle inventada 1' });
      facade.buscarDireccion.and.returnValue(of([]));
      ubicar().click();
      fixture.detectChanges();
      expect(mensaje()).toBe('No encontramos esa dirección. Ubicá el punto en el mapa o cargá las coordenadas.');

      facade.buscarDireccion.and.returnValue(throwError(() => new Error('503 detalle interno')));
      ubicar().click();
      fixture.detectChanges();
      expect(mensaje()).toBe('No pudimos buscar la dirección en este momento. Ubicá el punto en el mapa o cargá las coordenadas.');
      expect(mensaje()).not.toContain('503');
      expect(grupo.getRawValue().latitud).toBe('');
    });

    it('mientras busca dice "Buscando…", no consulta dos veces y no pierde el foco del botón', async () => {
      await crear({ direccion: 'Av. Uruguay 3150' });
      const respuesta$ = new Subject<LugarVM[]>();
      facade.buscarDireccion.and.returnValue(respuesta$);
      ubicar().focus();
      ubicar().click();
      fixture.detectChanges();
      expect(ubicar().textContent!.trim()).toBe('Buscando…');
      expect(ubicar().getAttribute('aria-busy')).toBe('true');
      ubicar().click();
      expect(facade.buscarDireccion).toHaveBeenCalledTimes(1);

      respuesta$.next([UNO]);
      fixture.detectChanges();
      expect(ubicar().textContent!.trim()).toBe('Ubicar en el mapa');
      expect(document.activeElement).toBe(ubicar());
    });

    it('sin proveedor en el entorno el botón se ve, sigue enfocable y dice por qué no anda', async () => {
      await crear({ direccion: 'Av. Uruguay 3150' }, false);
      expect(ubicar().getAttribute('aria-disabled')).toBe('true');
      expect(ubicar().disabled).toBeFalse();
      ubicar().click();
      expect(facade.buscarDireccion).not.toHaveBeenCalled();
    });
  });
});
