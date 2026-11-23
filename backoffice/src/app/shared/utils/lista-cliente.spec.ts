import { Component } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, Observable, Subject, combineLatest, map, of, throwError } from 'rxjs';
import { ListaCliente, ListaClienteConfig, TextosDeVacio, VistaDeLista, compararPorTexto, compararTexto, textosDeVacio } from './lista-cliente';

interface Fila {
  id: string;
  nombre: string;
  activo: boolean;
}

const fila = (n: number, activo = true): Fila => ({ id: `f-${n}`, nombre: `Fila ${String(n).padStart(2, '0')}`, activo });
/** 25 filas; inactivas las múltiplo de 5. */
const FILAS = Array.from({ length: 25 }, (_, i) => fila(i + 1, (i + 1) % 5 !== 0));

const TEXTOS = textosDeVacio(
  { emptyTitle: 'Todavía no hay filas', emptyMessage: 'Creá la primera.', emptyActionLabel: 'Nueva fila' },
  { emptyTitle: 'Sin resultados', emptyMessage: 'Nada coincide.', emptyActionLabel: 'Limpiar filtros' },
);

type Filtro = 'todas' | 'activas';
type Vista = VistaDeLista<Fila, Filtro> & TextosDeVacio;

/** `ListaCliente` usa `inject`: se crea dentro de un componente, como en las pantallas. */
@Component({ standalone: true, template: '' })
class AnfitrionComponent {
  static config: Partial<ListaClienteConfig<Fila, Filtro, TextosDeVacio>> = {};
  readonly fuente$ = new BehaviorSubject<Fila[]>(FILAS);
  readonly filtro$ = new BehaviorSubject<Filtro>('todas');
  respuesta: () => Observable<unknown> = () => of(FILAS);
  avisos: boolean[] = [];

  readonly lista = new ListaCliente<Fila, Filtro>({
    fuente$: this.fuente$,
    cargar: () => this.respuesta(),
    buscarEn: (f) => [f.nombre],
    comparar: compararPorTexto((f) => f.nombre),
    filtros$: this.filtro$,
    filtrar: (buscadas, filtro) => (filtro === 'activas' ? buscadas.filter((f) => f.activo) : buscadas),
    filtrosActivos: (filtro) => (filtro === 'activas' ? [{ clave: 'estado', etiqueta: 'Estado: Activas' }] : []),
    limpiarFiltros: () => this.filtro$.next('todas'),
    quitarFiltro: () => this.filtro$.next('todas'),
    extras: TEXTOS,
    alCargar: (lista) => this.avisos.push(lista),
    ...AnfitrionComponent.config,
  });
}

function crear(config: Partial<ListaClienteConfig<Fila, Filtro, TextosDeVacio>> = {}): { anfitrion: AnfitrionComponent; vista: () => Vista; destruir: () => void } {
  AnfitrionComponent.config = config;
  TestBed.configureTestingModule({ imports: [AnfitrionComponent] });
  const fixture = TestBed.createComponent(AnfitrionComponent);
  let ultima!: Vista;
  const sub = fixture.componentInstance.lista.vista$.subscribe((v) => { ultima = v; });
  return { anfitrion: fixture.componentInstance, vista: () => ultima, destruir: () => { sub.unsubscribe(); fixture.destroy(); } };
}

describe('ListaCliente', () => {
  describe('carga', () => {
    it('arranca cargando; al responder deja de cargar y avisa que la lista está lista', () => {
      const { anfitrion, vista, destruir } = crear();
      const respuesta$ = new Subject<Fila[]>();
      anfitrion.respuesta = () => respuesta$;
      expect(vista().cargando).toBeTrue();

      anfitrion.lista.cargar();
      expect(anfitrion.lista.cargando).toBeTrue();
      expect(anfitrion.avisos).toEqual([false]);

      respuesta$.next(FILAS);
      expect(vista().cargando).toBeFalse();
      expect(vista().error).toBeFalse();
      expect(anfitrion.avisos).toEqual([false, true]);
      destruir();
    });

    it('si la carga falla queda en error (no en vacío), y reintentar lo limpia', () => {
      const { anfitrion, vista, destruir } = crear();
      anfitrion.fuente$.next([]);
      anfitrion.respuesta = () => throwError(() => new Error('sin conexión'));
      anfitrion.lista.cargar();
      expect(vista().error).toBeTrue();
      expect(anfitrion.avisos).toEqual([false]);

      anfitrion.respuesta = () => of([]);
      anfitrion.lista.cargar();
      expect(vista().error).toBeFalse();
      destruir();
    });
  });

  describe('búsqueda, filtros y vacío', () => {
    it('la búsqueda espera 200 ms, filtra y deja el chip "Búsqueda: …" primero', fakeAsync(() => {
      const { anfitrion, vista, destruir } = crear();
      anfitrion.filtro$.next('activas');
      anfitrion.lista.searchCtrl.setValue('  fila 2 ');
      tick(199);
      expect(vista().total).toBe(20);
      tick(1);
      // Fila 20 a 25, sin la 20 ni la 25 (inactivas).
      expect(vista().rows.map((f) => f.nombre)).toEqual(['Fila 21', 'Fila 22', 'Fila 23', 'Fila 24']);
      expect(vista().filtrosActivos).toEqual([
        { clave: 'search', etiqueta: 'Búsqueda: fila 2' },
        { clave: 'estado', etiqueta: 'Estado: Activas' },
      ]);
      destruir();
    }));

    it('sin datos y sin filtros invita a crear; con filtros, a limpiar (aunque no haya datos)', fakeAsync(() => {
      const { anfitrion, vista, destruir } = crear();
      anfitrion.fuente$.next([]);
      anfitrion.lista.cargar();
      expect(vista().emptyActionLabel).toBe('Nueva fila');

      anfitrion.filtro$.next('activas');
      expect(vista().hayFiltros).toBeTrue();
      expect(vista().emptyTitle).toBe('Sin resultados');
      destruir();
    }));

    it('`quitar` saca un filtro por su chip y `limpiar` los saca todos', fakeAsync(() => {
      const { anfitrion, vista, destruir } = crear();
      anfitrion.filtro$.next('activas');
      anfitrion.lista.searchCtrl.setValue('fila');
      tick(200);

      anfitrion.lista.quitar('estado');
      expect(vista().filtrosActivos.map((f) => f.clave)).toEqual(['search']);

      anfitrion.filtro$.next('activas');
      anfitrion.lista.limpiar();
      tick(200);
      expect(vista().hayFiltros).toBeFalse();
      expect(anfitrion.lista.searchCtrl.value).toBe('');
      destruir();
    }));

    it('sin `quitarFiltro`, quitar el chip de un filtro propio usa `limpiarFiltros` (y no toca la búsqueda)', fakeAsync(() => {
      const { anfitrion, vista, destruir } = crear({ quitarFiltro: undefined });
      anfitrion.filtro$.next('activas');
      anfitrion.lista.searchCtrl.setValue('fila');
      tick(200);

      anfitrion.lista.quitar('estado');

      expect(anfitrion.filtro$.value).toBe('todas');
      expect(vista().filtrosActivos.map((f) => f.clave)).toEqual(['search']);
      destruir();
    }));

    it('la acción del vacío crea si no hay nada escrito ni filtrado; si no, limpia', fakeAsync(() => {
      const { anfitrion, destruir } = crear();
      const crearFila = jasmine.createSpy('crear');
      anfitrion.lista.accionDeVacio(crearFila);
      expect(crearFila).toHaveBeenCalledTimes(1);

      // Lo escrito cuenta aunque todavía no se haya buscado (dentro de los 200 ms).
      anfitrion.lista.searchCtrl.setValue('algo');
      anfitrion.lista.accionDeVacio(crearFila);
      expect(crearFila).toHaveBeenCalledTimes(1);
      expect(anfitrion.lista.searchCtrl.value).toBe('');
      tick(200);

      anfitrion.filtro$.next('activas');
      anfitrion.lista.accionDeVacio(crearFila);
      expect(crearFila).toHaveBeenCalledTimes(1);
      expect(anfitrion.filtro$.value).toBe('todas');
      destruir();
    }));

    it('`buscadas$` da lo que queda tras la búsqueda y antes de los filtros (para contar las tabs)', fakeAsync(() => {
      const { anfitrion, destruir } = crear();
      let buscadas: Fila[] = [];
      const sub = anfitrion.lista.buscadas$.subscribe((b) => { buscadas = b; });
      anfitrion.filtro$.next('activas');
      anfitrion.lista.searchCtrl.setValue('fila 2');
      tick(200);
      expect(buscadas.length).toBe(6);
      sub.unsubscribe();
      destruir();
    }));
  });

  describe('orden y paginado', () => {
    it('ordena por la columna en los dos sentidos y sin sentido vuelve al orden de la fuente', () => {
      const { anfitrion, vista, destruir } = crear();
      anfitrion.fuente$.next([fila(2), fila(3), fila(1)]);
      anfitrion.lista.ordenar({ active: 'nombre', direction: 'asc' });
      expect(vista().rows.map((f) => f.id)).toEqual(['f-1', 'f-2', 'f-3']);
      anfitrion.lista.ordenar({ active: 'nombre', direction: 'desc' });
      expect(vista().rows.map((f) => f.id)).toEqual(['f-3', 'f-2', 'f-1']);
      anfitrion.lista.ordenar({ active: 'nombre', direction: '' });
      expect(vista().rows.map((f) => f.id)).toEqual(['f-2', 'f-3', 'f-1']);
      destruir();
    });

    it('pagina de a 10 y entrega solo la página pedida', () => {
      const { anfitrion, vista, destruir } = crear();
      expect(vista().rows.length).toBe(10);
      expect(vista().total).toBe(25);
      anfitrion.lista.paginar({ pageIndex: 2, pageSize: 10 });
      expect(vista().pageIndex).toBe(2);
      expect(vista().rows.map((f) => f.id)).toEqual(['f-21', 'f-22', 'f-23', 'f-24', 'f-25']);
      destruir();
    });

    it('buscar vuelve a la primera página, y quitar la búsqueda también (no salta a la página vieja)', fakeAsync(() => {
      const { anfitrion, vista, destruir } = crear();
      anfitrion.lista.paginar({ pageIndex: 2, pageSize: 10 });
      anfitrion.lista.searchCtrl.setValue('fila 1');
      tick(200);
      expect(vista().total).toBe(10);
      expect(vista().pageIndex).toBe(0);

      anfitrion.lista.searchCtrl.setValue('fila');
      tick(200);
      anfitrion.lista.paginar({ pageIndex: 1, pageSize: 10 });
      anfitrion.lista.limpiar();
      tick(200);
      expect(vista().pageIndex).toBe(0);
      expect(vista().rows[0].id).toBe('f-1');
      destruir();
    }));

    it('cambiar un filtro propio, o quitarlo desde su chip, vuelve a la primera página', () => {
      const { anfitrion, vista, destruir } = crear();
      anfitrion.lista.paginar({ pageIndex: 1, pageSize: 10 });
      anfitrion.filtro$.next('activas');
      expect(vista().total).toBe(20);
      expect(vista().pageIndex).toBe(0);

      anfitrion.lista.paginar({ pageIndex: 1, pageSize: 10 });
      anfitrion.lista.quitar('estado');
      expect(vista().pageIndex).toBe(0);
      destruir();
    });

    it('ordenar vuelve a la primera página', () => {
      const { anfitrion, vista, destruir } = crear();
      anfitrion.lista.paginar({ pageIndex: 2, pageSize: 10 });
      anfitrion.lista.ordenar({ active: 'nombre', direction: 'desc' });
      expect(vista().pageIndex).toBe(0);
      expect(vista().rows[0].id).toBe('f-25');
      destruir();
    });

    it('cambiar de página o de tamaño de página no vuelve a la primera', () => {
      const { anfitrion, vista, destruir } = crear();
      anfitrion.lista.paginar({ pageIndex: 1, pageSize: 10 });
      expect(vista().pageIndex).toBe(1);
      anfitrion.lista.paginar({ pageIndex: 1, pageSize: 5 });
      expect(vista().pageIndex).toBe(1);
      expect(vista().rows.map((f) => f.id)).toEqual(['f-6', 'f-7', 'f-8', 'f-9', 'f-10']);
      destruir();
    });

    it('una recarga conserva la página; si esa página dejó de existir muestra la última', () => {
      const { anfitrion, vista, destruir } = crear();
      anfitrion.lista.paginar({ pageIndex: 2, pageSize: 10 });

      anfitrion.fuente$.next(FILAS.slice(0, 24));
      anfitrion.lista.cargar();
      expect(vista().pageIndex).toBe(2);
      expect(vista().rows.map((f) => f.id)).toEqual(['f-21', 'f-22', 'f-23', 'f-24']);

      anfitrion.fuente$.next(FILAS.slice(0, 20));
      expect(vista().pageIndex).toBe(1);
      expect(vista().rows[0].id).toBe('f-11');
      destruir();
    });

    it('los datos de apoyo que viajan en los filtros (un catálogo) no son criterio: que cambien conserva la página', () => {
      const catalogo$ = new BehaviorSubject<string[]>(['a']);
      const estado$ = new BehaviorSubject<Filtro>('todas');
      const filtros$ = combineLatest([estado$, catalogo$]).pipe(map(([estado, catalogo]) => ({ estado, catalogo })));
      const { anfitrion, vista, destruir } = crear({
        filtros$: filtros$ as unknown as Observable<Filtro>,
        filtrar: (buscadas) => buscadas,
        filtrosActivos: () => [],
      });
      anfitrion.lista.paginar({ pageIndex: 1, pageSize: 10 });

      catalogo$.next(['a', 'b']);
      expect(vista().pageIndex).toBe(1);

      estado$.next('activas');
      expect(vista().pageIndex).toBe(0);
      destruir();
    });

    it('con `tamanoDePagina: null` no pagina', () => {
      const { vista, destruir } = crear({ tamanoDePagina: null });
      expect(vista().rows.length).toBe(25);
      expect(vista().pageIndex).toBe(0);
      destruir();
    });
  });

  it('`ocupar` marca la fila ocupada mientras dura la acción', () => {
    const { anfitrion, vista, destruir } = crear();
    const ocupado = anfitrion.lista.ocupar('f-3');
    ocupado(true);
    expect(vista().ocupadaId).toBe('f-3');
    ocupado(false);
    expect(vista().ocupadaId).toBeNull();
    destruir();
  });

  it('`compararTexto` ordena como una persona: sin distinguir mayúsculas ni tildes, y `null` como vacío', () => {
    expect(compararTexto('árbol', 'Arbol')).toBe(0);
    expect(compararTexto(null, 'a')).toBeLessThan(0);
    expect(compararTexto('b', undefined)).toBeGreaterThan(0);
  });
});
