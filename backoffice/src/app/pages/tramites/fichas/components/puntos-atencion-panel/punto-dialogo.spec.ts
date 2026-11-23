import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, filter, firstValueFrom, of, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { GeocodificacionFacade } from '@features/geocodificacion';
import { PuntoAtencionVM, PuntosAtencionFacade } from '@features/puntos-atencion';
import { FormDialogDePrueba, montarFormDialog } from '@shared/components/form-dialog/testing/form-dialog.testing';
import { HOJA_DEL_MAPA, MapaUbicacionComponent, TILES_DEL_MAPA } from '@shared/components/mapa-ubicacion/mapa-ubicacion.component';
import { TILES_SIN_RED } from '@shared/components/mapa-ubicacion/testing/mapa.testing';
import { camposDePunto, dialogoDePunto } from './punto-dialogo';

const PUNTO: PuntoAtencionVM = {
  id: 'pa-1', fichaId: 'f-1', nombre: 'Centro de Licencias', direccion: 'Av. Uruguay 3150',
  contacto: '0376 444-0000', horarios: 'Lunes a viernes de 7 a 13', latitud: -27.367104, longitud: -55.896108, activo: true,
};

describe('diálogo de punto de atención', () => {
  let facade: jasmine.SpyObj<PuntosAtencionFacade>;
  let d: FormDialogDePrueba;

  const crearFacade = (fuenteSimulada = false): void => {
    facade = jasmine.createSpyObj<PuntosAtencionFacade>('PuntosAtencionFacade', ['create', 'update'], { fuenteSimulada });
  };
  const geocodificacion = {
    disponible: true,
    buscarDireccion: jasmine.createSpy('buscarDireccion'),
    encuadreDeLocalidad: () => of(null),
  };
  /** El diálogo real, con el mapa real (Leaflet) sin red y la geocodificación simulada. Espera a que el mapa esté listo. */
  const abrir = async (punto: PuntoAtencionVM | null, fuenteSimulada = false): Promise<void> => {
    TestBed.resetTestingModule();
    crearFacade(fuenteSimulada);
    TestBed.overrideProvider(GeocodificacionFacade, { useValue: geocodificacion });
    TestBed.overrideProvider(TILES_DEL_MAPA, { useValue: TILES_SIN_RED });
    TestBed.overrideProvider(HOJA_DEL_MAPA, { useValue: null });
    d = await montarFormDialog(dialogoDePunto(facade, 'f-1', punto, 'Posadas'));
    const m = mapa();
    if (m.estado === 'cargando') await firstValueFrom(m.estadoChange.pipe(filter((e) => e !== 'cargando')));
    d.fixture.detectChanges();
  };
  const mapa = (): MapaUbicacionComponent => d.fixture.debugElement.query(By.directive(MapaUbicacionComponent)).componentInstance;
  /** Enter sobre el mapa enfocado = marcar el centro (lo mismo que un clic). */
  const marcarCentro = (): void => {
    d.el.querySelector<HTMLElement>('.mapa-ubicacion__lienzo')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    d.fixture.detectChanges();
  };
  const marcadorAlNorte = (): void => {
    d.el.querySelector<HTMLElement>('.mapa-ubicacion__marcador')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    d.fixture.detectChanges();
  };
  const completar = (): void => {
    d.tipear('nombre', 'Delegación');
    d.tipear('direccion', 'San Martín 123');
    d.tipear('latitud', '-27,5');
    d.tipear('longitud', '-55.25');
  };
  const input = (id: string): HTMLInputElement => d.el.querySelector<HTMLInputElement>(`#${id}`)!;

  describe('configuración (funciones puras)', () => {
    beforeEach(() => crearFacade());

    it('títulos, subtítulo, botón y texto de descarte según sea alta o edición', () => {
      const alta = dialogoDePunto(facade, 'f-1', null);
      expect([alta.titulo, alta.textoGuardar, alta.requiereCambios]).toEqual(['Agregar punto de atención', 'Agregar', false]);
      expect(alta.subtitulo).toBe('Dónde se hace el trámite en esta localidad. Se muestra en la ficha del portal.');
      expect(alta.mensajeDescartar).toBe('Hay datos sin guardar. Si cerrás ahora no se agrega el punto de atención.');

      const edicion = dialogoDePunto(facade, 'f-1', PUNTO);
      expect([edicion.titulo, edicion.textoGuardar, edicion.requiereCambios]).toEqual(['Editar punto de atención', 'Guardar cambios', true]);
      expect(edicion.mensajeDescartar).toBe('Hay cambios sin guardar en este punto de atención. Si cerrás ahora se pierden.');
    });

    it('"Activo" solo existe en edición; el aviso de fuente simulada, solo con esa fuente', () => {
      const nombres = (esEdicion: boolean, simulada: boolean): string[] => camposDePunto(esEdicion, simulada).map((f) => f.name);
      expect(nombres(false, false)).toEqual([
        '_seccion_datos', 'nombre', '_seccion_ubicacion', 'direccion', '_ubicacion', 'latitud', 'longitud', '_seccion_contacto',
        'horarios', 'contacto',
      ]);
      expect(nombres(true, false)).toContain('activo');
      expect(nombres(false, true)[0]).toBe('_fuente_simulada');
    });

    it('el mapa es una vista que escribe SOLO latitud y longitud, y recibe la localidad de la ficha', () => {
      const ubicacion = camposDePunto(false, false, 'Oberá').find((f) => f.name === '_ubicacion')!;
      expect(ubicacion.type).toBe('vista');
      expect(ubicacion.vista!.escribe).toEqual(['latitud', 'longitud']);
      expect(ubicacion.vista!.datos).toEqual({ localidad: 'Oberá' });
    });
  });

  describe('dentro de FormDialogComponent', () => {
    it('alta: campos vacíos, sin "Activo", botón "Agregar" y el foco en el nombre', async () => {
      await abrir(null);

      expect(d.textoDe('h2')).toBe('Agregar punto de atención');
      expect(d.textoDe('.dialogo-formulario__subtitulo')).toBe('Dónde se hace el trámite en esta localidad. Se muestra en la ficha del portal.');
      expect(d.form().getRawValue()).toEqual({ nombre: '', direccion: '', latitud: '', longitud: '', horarios: '', contacto: '' });
      expect(d.el.querySelector('mat-slide-toggle')).toBeNull();
      expect(d.guardar().textContent!.trim()).toBe('Agregar');
      expect(d.el.querySelector('.form-aviso')).toBeNull();
      expect(document.activeElement?.id).toBe('nombre');
    });

    it('edición: carga los valores (coordenadas con coma decimal), ofrece "Activo" y bloquea "Guardar cambios" sin cambios', async () => {
      await abrir(PUNTO);

      expect(d.textoDe('h2')).toBe('Editar punto de atención');
      expect(d.form().getRawValue()).toEqual({
        nombre: 'Centro de Licencias', direccion: 'Av. Uruguay 3150', latitud: '-27,367104', longitud: '-55,896108',
        horarios: 'Lunes a viernes de 7 a 13', contacto: '0376 444-0000', activo: true,
      });
      expect(d.textoDe('mat-slide-toggle')).toContain('Activo');
      expect(d.guardar().textContent!.trim()).toBe('Guardar cambios');
      expect(d.guardar().getAttribute('aria-disabled')).toBe('true');
      expect(d.guardar().disabled).toBeFalse();
      expect(d.guardar().type).toBe('button');
    });

    it('con fuente simulada avisa que los puntos no se guardan en el servidor', async () => {
      await abrir(null, true);
      expect(d.textoDe('.form-aviso[role="note"]')).toContain('Datos de ejemplo');
    });

    it('enviar vacío marca los obligatorios con su texto y no guarda', async () => {
      await abrir(null);
      await d.enviar();

      expect(d.errores()).toEqual([
        'El nombre es obligatorio', 'La dirección es obligatoria', 'La latitud es obligatoria', 'La longitud es obligatoria',
      ]);
      expect(facade.create).not.toHaveBeenCalled();
    });

    it('nombre y dirección de solo espacios no cuentan como completados', async () => {
      await abrir(null);
      d.tipear('nombre', '   ');
      d.tipear('direccion', '  ');
      expect(d.errores()).toEqual(['El nombre es obligatorio', 'La dirección es obligatoria']);
    });

    it('coordenadas: número, rango y hasta 6 decimales, cada una con su texto', async () => {
      await abrir(null);
      const caso = (latitud: string, longitud: string): string[] => {
        d.tipear('latitud', latitud);
        d.tipear('longitud', longitud);
        return d.errores();
      };

      expect(caso('abc', 'xyz')).toEqual(['Escribí un número (ej: -27,367104)', 'Escribí un número (ej: -55,896108)']);
      expect(caso('91', '-181')).toEqual(['Tiene que estar entre -90 y 90', 'Tiene que estar entre -180 y 180']);
      expect(caso('-27,1234567', '-55.1234567')).toEqual(['Hasta 6 decimales', 'Hasta 6 decimales']);
      expect(caso('-27,5', '-55.25')).toEqual([]);
    });

    it('las ayudas de latitud y longitud dicen el rango y que se completan con el mapa; teclado decimal', async () => {
      await abrir(null);
      const ayudas = Array.from(d.el.querySelectorAll('mat-hint')).map((h) => h.textContent!.trim()).filter((t) => t.startsWith('Entre'));
      expect(ayudas).toEqual([
        'Entre -90 y 90, hasta 6 decimales. Se completa al marcar el mapa.',
        'Entre -180 y 180, hasta 6 decimales. Se completa al marcar el mapa.',
      ]);
      expect(input('latitud').getAttribute('inputmode')).toBe('decimal');
      // No son datos de quien carga: el navegador no ofrece los suyos.
      expect(input('latitud').getAttribute('autocomplete')).toBe('off');
      expect(input('longitud').getAttribute('autocomplete')).toBe('off');
      expect(input('latitud').placeholder).toBe('Ej: -27,367104');
      expect(input('longitud').placeholder).toBe('Ej: -55,896108');
    });

    it('tres secciones con guía: datos del punto, ubicación (cómo ubicarlo) y horarios y contacto', async () => {
      await abrir(null);
      const secciones = Array.from(d.el.querySelectorAll('.section-header-title')).map((t) => t.textContent!.trim());
      expect(secciones).toEqual(['Datos del punto', 'Ubicación', 'Horarios y contacto']);
      expect(d.textoDe('.section-header-description'))
        .toBe('Escribí la dirección y tocá «Ubicar en el mapa», o marcá el punto directamente en el mapa.');
      // Orden: Dirección → "Ubicar en el mapa" + mapa → Latitud y Longitud (la alternativa a mano).
      const orden = Array.from(d.el.querySelectorAll('#direccion, .punto-ubicacion__ubicar, .mapa-ubicacion__lienzo, #latitud, #longitud'));
      const clases = ['punto-ubicacion__ubicar', 'mapa-ubicacion__lienzo'];
      expect(orden.map((n) => n.id || clases.find((c) => n.classList.contains(c))))
        .toEqual(['direccion', 'punto-ubicacion__ubicar', 'mapa-ubicacion__lienzo', 'latitud', 'longitud']);
    });

    it('alta: marcar el punto en el mapa completa las coordenadas y se envían esas', async () => {
      await abrir(null);
      facade.create.and.returnValue(of(PUNTO));
      d.tipear('nombre', 'Delegación');
      d.tipear('direccion', 'San Martín 123');

      marcarCentro();
      const latitud = input('latitud').value;
      const longitud = input('longitud').value;
      expect(latitud).toMatch(/^-2\d,\d{1,6}$/);
      expect(longitud).toMatch(/^-5\d,\d{1,6}$/);
      expect(d.errores()).toEqual([]);

      await d.enviar();
      const enviado = facade.create.calls.mostRecent().args[0];
      expect(enviado.latitud).toBe(Number(latitud.replace(',', '.')));
      expect(enviado.longitud).toBe(Number(longitud.replace(',', '.')));
    });

    it('edición: abre con el marcador en el punto guardado; moverlo libera "Guardar cambios" y envía la nueva ubicación', async () => {
      await abrir(PUNTO);
      facade.update.and.returnValue(of(PUNTO));
      expect(mapa().ubicacion).toEqual({ latitud: -27.367104, longitud: -55.896108 });
      expect(d.guardar().getAttribute('aria-disabled')).toBe('true');

      marcadorAlNorte();

      expect(d.guardar().getAttribute('aria-disabled')).toBeNull();
      const nueva = Number(input('latitud').value.replace(',', '.'));
      expect(nueva).toBeGreaterThan(PUNTO.latitud!);
      await d.enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('pa-1', jasmine.objectContaining({ latitud: nueva, longitud: PUNTO.longitud! }));
    });

    it('edición: sin tocar el mapa ni los campos, "Guardar cambios" sigue bloqueado y no envía', async () => {
      await abrir(PUNTO);
      await d.enviar();
      expect(facade.update).not.toHaveBeenCalled();
    });

    it('cerrar después de mover el marcador pide confirmar el descarte', async () => {
      await abrir(PUNTO);
      marcadorAlNorte();
      await d.cerrar();
      expect(d.confirmacion).toHaveBeenCalled();
    });

    it('coordenadas escritas a mano mueven el marcador; si son inválidas, el error se ve en el campo y el mapa no se mueve', async () => {
      await abrir(null);
      d.tipear('latitud', '-27,5');
      d.tipear('longitud', '-55.25');
      expect(mapa().ubicacion).toEqual({ latitud: -27.5, longitud: -55.25 });

      d.tipear('longitud', '-181');
      expect(d.errores()).toEqual(['Tiene que estar entre -180 y 180']);
      expect(mapa().ubicacion).toEqual({ latitud: -27.5, longitud: -55.25 });
    });

    it('alta: envía el punto con las coordenadas como número, activo, y cierra con lo guardado', async () => {
      await abrir(null);
      facade.create.and.returnValue(of(PUNTO));
      completar();
      d.tipear('horarios', 'De 7 a 13');
      d.tipear('contacto', 'mesa@x.gob.ar');

      await d.enviar();

      expect(facade.create).toHaveBeenCalledOnceWith({
        fichaId: 'f-1', nombre: 'Delegación', direccion: 'San Martín 123', contacto: 'mesa@x.gob.ar', horarios: 'De 7 a 13',
        latitud: -27.5, longitud: -55.25, activo: true,
      });
      expect(d.close).toHaveBeenCalledOnceWith(PUNTO);
    });

    it('edición: al apagar "Activo" avisa y lo envía apagado', async () => {
      await abrir(PUNTO);
      facade.update.and.returnValue(of({ ...PUNTO, activo: false }));
      expect(d.el.querySelector('.form-toggle__aviso')).toBeNull();

      d.elegir('activo', false);
      expect(d.textoDe('.form-toggle__aviso')).toBe('Desactivado, deja de mostrarse en la ficha.');
      // El aviso está dentro de la ayuda que describe al interruptor.
      const ayuda = d.el.querySelector('.form-toggle__ayuda')!;
      expect(ayuda.contains(d.el.querySelector('.form-toggle__aviso'))).toBeTrue();
      // En el control con foco (`role="switch"`), no en el host de Material: ahí el lector no lo asocia.
      expect(d.el.querySelector('mat-slide-toggle [role="switch"]')!.getAttribute('aria-describedby')).toBe(ayuda.id);

      await d.enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('pa-1', {
        fichaId: 'f-1', nombre: 'Centro de Licencias', direccion: 'Av. Uruguay 3150', contacto: '0376 444-0000',
        horarios: 'Lunes a viernes de 7 a 13', latitud: -27.367104, longitud: -55.896108, activo: false,
      });
    });

    it('si el backend rechaza, el motivo va al banner con texto propio y el diálogo queda abierto', async () => {
      await abrir(null);
      completar();

      facade.create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { code: API_CODES.VALIDATION, message: 'crudo' } })));
      await d.enviar();
      expect(d.banner()).toContain('No se pudo guardar');
      expect(d.banner()).toContain('Revisá los campos obligatorios y que la latitud esté entre -90 y 90 y la longitud entre -180 y 180.');
      expect(d.banner()).not.toContain('crudo');
      expect(d.close).not.toHaveBeenCalled();
      expect(d.guardar().disabled).toBeFalse();

      facade.create.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      await d.enviar();
      expect(d.banner()).toContain('No tenés permiso para guardar puntos de atención en esta ficha.');
    });

    it('mientras guarda no envía dos veces y muestra "Guardando…"', async () => {
      await abrir(null);
      facade.create.and.returnValue(new Subject<PuntoAtencionVM>());
      completar();

      await d.enviar();
      await d.enviar();

      expect(facade.create).toHaveBeenCalledTimes(1);
      expect(d.guardar().textContent!.trim()).toBe('Guardando…');
    });

    it('cerrar con cambios pide confirmación con el texto del alta o de la edición; sin cambios cierra directo', async () => {
      await abrir(null);
      await d.cerrar();
      expect(d.confirmacion).not.toHaveBeenCalled();
      expect(d.close).toHaveBeenCalledTimes(1);

      d.tipear('nombre', 'Algo');
      await d.cerrar();
      expect(d.confirmacion.calls.mostRecent().args[1].data.message).toBe('Hay datos sin guardar. Si cerrás ahora no se agrega el punto de atención.');
      expect(d.close).toHaveBeenCalledTimes(1);

      await abrir(PUNTO);
      d.tipear('nombre', 'Otro nombre');
      await d.cerrar();
      expect(d.confirmacion.calls.mostRecent().args[1].data.message).toBe('Hay cambios sin guardar en este punto de atención. Si cerrás ahora se pierden.');
    });

    it('los opcionales lo dicen en su etiqueta', async () => {
      await abrir(null);
      expect(d.etiquetas()).toEqual(['Nombre *', 'Dirección *', 'Latitud *', 'Longitud *', 'Horarios (opcional)', 'Contacto (opcional)']);
    });
  });
});
