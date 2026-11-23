import { Subject, firstValueFrom, of, throwError, toArray } from 'rxjs';
import { Carga, cargaLista, conCarga } from './carga';

describe('conCarga', () => {
  it('emite "cargando" al suscribirse y después el valor', async () => {
    const estados = await firstValueFrom(of('dato').pipe(conCarga(), toArray()));
    expect(estados).toEqual([{ tipo: 'cargando' }, { tipo: 'ok', valor: 'dato' }]);
  });

  it('mientras la lectura no responde se queda en "cargando"', () => {
    const estados: Carga<string>[] = [];
    const sub = new Subject<string>().pipe(conCarga()).subscribe((estado) => estados.push(estado));
    expect(estados).toEqual([{ tipo: 'cargando' }]);
    sub.unsubscribe();
  });

  it('un error se convierte en estado (reintentable por defecto) en vez de romper el stream', async () => {
    const estados = await firstValueFrom(throwError(() => new Error('sin red')).pipe(conCarga(), toArray()));
    expect(estados).toEqual([{ tipo: 'cargando' }, { tipo: 'error', noExiste: false }]);
  });

  it('`esInexistente` distingue "no existe" de un fallo reintentable', async () => {
    const esInexistente = (err: unknown): boolean => (err as { status?: number }).status === 404;
    const con = (status: number): Promise<Carga<never>[]> =>
      firstValueFrom(throwError(() => ({ status })).pipe(conCarga<never>(esInexistente), toArray()));

    expect((await con(404))[1]).toEqual({ tipo: 'error', noExiste: true });
    expect((await con(500))[1]).toEqual({ tipo: 'error', noExiste: false });
  });

  it('`cargaLista` arma el estado de un valor que ya se tiene', () => {
    expect(cargaLista(7)).toEqual({ tipo: 'ok', valor: 7 });
  });
});
