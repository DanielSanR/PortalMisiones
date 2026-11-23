import { Observable, Subject, firstValueFrom, of, throwError } from 'rxjs';
import { CONCURRENCIA_DE_LECTURAS, leerDeAUno } from './lecturas-de-a-una.utils';

describe('leerDeAUno', () => {
  const esDefinitivo = (err: unknown): boolean => [403, 404].includes((err as { status?: number }).status ?? 0);

  it('sin ids completa enseguida sin leer nada', async () => {
    const leer = jasmine.createSpy('leer');
    await expectAsync(firstValueFrom(leerDeAUno([], leer, { recordar: () => undefined, esDefinitivo }))).toBeResolvedTo(undefined);
    expect(leer).not.toHaveBeenCalled();
  });

  it('recuerda cada lectura; un fallo definitivo se recuerda como null y otro fallo no se recuerda', async () => {
    const recordados = new Map<string, string | null>();
    const leer = (id: string) => {
      if (id === 'borrada') return throwError(() => ({ status: 404 }));
      if (id === 'ajena') return throwError(() => ({ status: 403 }));
      if (id === 'caida') return throwError(() => ({ status: 503 }));
      return of(`nombre de ${id}`);
    };

    await firstValueFrom(leerDeAUno(['a', 'borrada', 'ajena', 'caida'], leer, {
      recordar: (id, valor) => recordados.set(id, valor), esDefinitivo,
    }));

    expect(Array.from(recordados.entries())).toEqual([
      ['a', 'nombre de a'], ['borrada', null], ['ajena', null],
    ]);
  });

  it(`no tiene más de ${CONCURRENCIA_DE_LECTURAS} lecturas en vuelo a la vez, y completa una sola vez al final`, () => {
    const pendientes = new Map<string, Subject<string>>();
    const leer = (id: string): Observable<string> => {
      const s = new Subject<string>();
      pendientes.set(id, s);
      return s;
    };
    const ids = ['1', '2', '3', '4', '5', '6'];
    const emisiones: unknown[] = [];
    let completo = false;
    leerDeAUno(ids, leer, { recordar: () => undefined, esDefinitivo }).subscribe({
      next: (v) => emisiones.push(v), complete: () => { completo = true; },
    });

    expect(Array.from(pendientes.keys())).toEqual(['1', '2', '3', '4']);
    ids.forEach((id) => {
      const s = pendientes.get(id)!;
      s.next(id);
      s.complete();
    });

    expect(pendientes.size).toBe(6);
    expect(emisiones).toEqual([undefined]);
    expect(completo).toBeTrue();
  });
});
