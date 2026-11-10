import { DestroyRef, EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EMPTY, EmptyError, Observable, Subject, of, throwError } from 'rxjs';
import { esPantallaDestruida, unaVez } from './one-shot.utils';

describe('unaVez (llamada one-shot atada a la vida de la pantalla)', () => {
  let pantalla: EnvironmentInjector;
  let destroyRef: DestroyRef;

  /** Ejecuta la promesa y devuelve con qué rechazó (falla si resolvió). */
  async function rechazoDe(promesa: Promise<unknown>): Promise<unknown> {
    try {
      await promesa;
    } catch (err: unknown) {
      return err;
    }
    return fail('la promesa resolvió y tenía que rechazar');
  }

  beforeEach(() => {
    pantalla = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    destroyRef = pantalla.get(DestroyRef);
  });

  it('resuelve con el primer valor', async () => {
    expect(await unaVez(of('a', 'b'), destroyRef)).toBe('a');
  });

  it('un error del stream llega tal cual (no se confunde con "pantalla destruida")', async () => {
    const original = { error: { code: 4002 } };
    const err = await rechazoDe(unaVez(throwError(() => original), destroyRef));

    expect(err).toBe(original);
    expect(esPantallaDestruida(err)).toBeFalse();
  });

  it('un stream que completa vacío con la pantalla VIVA es un error de verdad', async () => {
    const err = await rechazoDe(unaVez(EMPTY, destroyRef));

    expect(err).toBeInstanceOf(EmptyError);
    expect(esPantallaDestruida(err)).toBeFalse();
  });

  it('si la pantalla se destruye con la llamada en vuelo: cancela el request y lo informa aparte', async () => {
    let cancelado = false;
    const enVuelo = new Observable<string>(() => () => {
      cancelado = true;
    });
    const promesa = unaVez(enVuelo, destroyRef);

    pantalla.destroy();
    const err = await rechazoDe(promesa);

    expect(cancelado).toBeTrue();
    expect(esPantallaDestruida(err)).toBeTrue();
  });

  it('con la pantalla ya destruida no llega a suscribirse', async () => {
    pantalla.destroy();
    const fuente = new Subject<string>();

    const err = await rechazoDe(unaVez(fuente, destroyRef));

    expect(esPantallaDestruida(err)).toBeTrue();
    expect(fuente.observed).toBeFalse();
  });

  it('una llamada ya resuelta no se ve afectada por la destrucción posterior de la pantalla', async () => {
    const valor = await unaVez(of(1), destroyRef);

    expect(() => pantalla.destroy()).not.toThrow();
    expect(valor).toBe(1);
  });
});
