import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { PREFERENCIAS_DE_FABRICA, Preferencias } from '@core/models/preferencias.model';
import { ATAJOS_STORAGE_KEY, AtajosService } from './atajos.service';
import {
  CLAVE_EMAIL_RECORDADO,
  PREFERENCIAS_STORAGE_KEY,
  PreferenciasService,
  leerPreferencias,
} from './preferencias.service';

/** Storage mínimo que solo responde `getItem` de las preferencias. */
function storageCon(valor: string | null): Storage {
  return { getItem: (clave: string) => (clave === PREFERENCIAS_STORAGE_KEY ? valor : null) } as Storage;
}

describe('leerPreferencias', () => {
  it('sin storage devuelve los valores de fábrica', () => {
    expect(leerPreferencias(null)).toEqual(PREFERENCIAS_DE_FABRICA);
    expect(leerPreferencias(undefined)).toEqual(PREFERENCIAS_DE_FABRICA);
  });

  it('con JSON roto devuelve los valores de fábrica', () => {
    expect(leerPreferencias(storageCon('{no json'))).toEqual(PREFERENCIAS_DE_FABRICA);
  });

  it('si getItem tira devuelve los valores de fábrica', () => {
    const storage = {
      getItem: () => {
        throw new Error('bloqueado');
      },
    } as unknown as Storage;
    expect(leerPreferencias(storage)).toEqual(PREFERENCIAS_DE_FABRICA);
  });

  it('descarta solo el campo inválido', () => {
    const storage = storageCon(JSON.stringify({ filasPorPagina: 37, densidad: 'compacta', avisos: 'xx' }));
    expect(leerPreferencias(storage)).toEqual({ ...PREFERENCIAS_DE_FABRICA, densidad: 'compacta' });
  });

  it('conserva todos los campos válidos guardados', () => {
    const guardadas: Preferencias = {
      filasPorPagina: 50,
      densidad: 'compacta',
      avisos: 'fijo',
      recordarMenuContraido: true,
      menuContraido: true,
    };
    expect(leerPreferencias(storageCon(JSON.stringify(guardadas)))).toEqual(guardadas);
  });
});

describe('PreferenciasService', () => {
  const limpiarStorage = (): void => {
    localStorage.removeItem(PREFERENCIAS_STORAGE_KEY);
    localStorage.removeItem(ATAJOS_STORAGE_KEY);
    localStorage.removeItem(CLAVE_EMAIL_RECORDADO);
  };

  const crear = (): PreferenciasService => {
    TestBed.configureTestingModule({
      providers: [{ provide: MatDialog, useValue: { openDialogs: [] } }],
    });
    return TestBed.inject(PreferenciasService);
  };

  beforeEach(limpiarStorage);

  afterEach(() => {
    limpiarStorage();
    document.documentElement.classList.remove('densidad-compacta');
  });

  it('arranca con lo guardado en localStorage', () => {
    localStorage.setItem(PREFERENCIAS_STORAGE_KEY, JSON.stringify({ filasPorPagina: 20 }));
    expect(crear().actual).toEqual({ ...PREFERENCIAS_DE_FABRICA, filasPorPagina: 20 });
  });

  it('actualizar emite, guarda en localStorage y conserva lo demás', async () => {
    const service = crear();
    service.actualizar({ densidad: 'compacta' });
    service.actualizar({ filasPorPagina: 50 });

    const esperadas: Preferencias = { ...PREFERENCIAS_DE_FABRICA, densidad: 'compacta', filasPorPagina: 50 };
    expect(await firstValueFrom(service.preferencias$)).toEqual(esperadas);
    expect(JSON.parse(localStorage.getItem(PREFERENCIAS_STORAGE_KEY) ?? '{}')).toEqual(esperadas);
  });

  it('restablecer vuelve a fábrica y enciende los atajos (AtajosService.habilitados === true)', async () => {
    const service = crear();
    const atajos = TestBed.inject(AtajosService);
    service.actualizar({ avisos: 'fijo', recordarMenuContraido: true });
    atajos.setHabilitados(false);

    service.restablecer();

    expect(service.actual).toEqual(PREFERENCIAS_DE_FABRICA);
    expect(atajos.habilitados).toBeTrue();
    expect(await firstValueFrom(service.esDeFabrica$)).toBeTrue();
  });

  it('esDeFabrica$ es false con los atajos apagados aunque lo demás sea de fábrica', async () => {
    const service = crear();
    TestBed.inject(AtajosService).setHabilitados(false);
    expect(await firstValueFrom(service.esDeFabrica$)).toBeFalse();
  });

  it('esDeFabrica$ es false con una preferencia cambiada', async () => {
    const service = crear();
    service.actualizar({ avisos: 'largo' });
    expect(await firstValueFrom(service.esDeFabrica$)).toBeFalse();
  });

  it('densidad compacta agrega la clase densidad-compacta a <html> y comoda la quita', () => {
    const service = crear();
    const clases = document.documentElement.classList;
    expect(clases.contains('densidad-compacta')).toBeFalse();

    service.actualizar({ densidad: 'compacta' });
    expect(clases.contains('densidad-compacta')).toBeTrue();

    service.actualizar({ densidad: 'comoda' });
    expect(clases.contains('densidad-compacta')).toBeFalse();
  });

  it('olvidarCorreo borra CLAVE_EMAIL_RECORDADO y correoRecordado$ emite ""', async () => {
    localStorage.setItem(CLAVE_EMAIL_RECORDADO, 'ana@misiones.gob.ar');
    const service = crear();
    expect(await firstValueFrom(service.correoRecordado$)).toBe('ana@misiones.gob.ar');

    service.olvidarCorreo();

    expect(localStorage.getItem(CLAVE_EMAIL_RECORDADO)).toBeNull();
    expect(await firstValueFrom(service.correoRecordado$)).toBe('');
  });

  it('correoRecordado$ relee el storage al suscribirse (otro login con "Recordarme" después de crear el servicio)', async () => {
    localStorage.setItem(CLAVE_EMAIL_RECORDADO, 'ana@misiones.gob.ar');
    const service = crear();
    expect(await firstValueFrom(service.correoRecordado$)).toBe('ana@misiones.gob.ar');

    localStorage.setItem(CLAVE_EMAIL_RECORDADO, 'eva@misiones.gob.ar');
    expect(await firstValueFrom(service.correoRecordado$)).toBe('eva@misiones.gob.ar');

    localStorage.removeItem(CLAVE_EMAIL_RECORDADO);
    expect(await firstValueFrom(service.correoRecordado$)).toBe('');
  });

  it('esDeFabrica$ no cuenta el estado del menú (menuContraido es un registro, no una elección)', async () => {
    const service = crear();
    service.actualizar({ menuContraido: true });
    expect(await firstValueFrom(service.esDeFabrica$)).toBeTrue();
  });

  it('restablecer conserva menuContraido: sigue registrando cómo está el menú ahora', () => {
    const service = crear();
    service.actualizar({ recordarMenuContraido: true, menuContraido: true, densidad: 'compacta' });

    service.restablecer();

    expect(service.actual).toEqual({ ...PREFERENCIAS_DE_FABRICA, menuContraido: true });
  });

  it('si setItem tira, la preferencia rige igual en memoria', async () => {
    const service = crear();
    spyOn(Storage.prototype, 'setItem').and.throwError('lleno');

    service.actualizar({ filasPorPagina: 20 });

    expect(service.actual.filasPorPagina).toBe(20);
    expect((await firstValueFrom(service.preferencias$)).filasPorPagina).toBe(20);
  });
});
