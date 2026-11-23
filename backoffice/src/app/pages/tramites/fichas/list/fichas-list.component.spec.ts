import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, of } from 'rxjs';
import { FichaLocalVM, FichasLocalesFacade } from '@features/fichas-locales';
import { FuenteDePrueba, ListaPO, describeLista, desmontarLista, montarLista } from '@shared/utils/testing/lista.testing';
import { FichasListComponent } from './fichas-list.component';

const FICHA: FichaLocalVM = {
  id: 'f-1', slug: 'licencia-posadas', estado: 'BORRADOR', activa: true, version: 1,
  adopcionId: 'a-1', localidadId: 'l-1', url: null, requisitos: null, costos: null,
  plantillaId: 'p-1', plantillaTitulo: 'Obtener licencia', organismoId: 'o-1', organismoNombre: 'Posadas', localidadNombre: 'Posadas',
};

function crear(lista: FichaLocalVM[], fuenteSimulada = false): FichasListComponent {
  const fichas$ = new BehaviorSubject<FichaLocalVM[]>(lista);
  const facade = {
    fichas$,
    fuenteSimulada,
    puedePublicar$: of(false),
    accionesWorkflow$: of(() => []),
    loadFichas: () => of(lista),
  };
  TestBed.configureTestingModule({
    imports: [FichasListComponent],
    providers: [provideRouter([]), provideNoopAnimations(), { provide: FichasLocalesFacade, useValue: facade }],
  });
  return TestBed.createComponent(FichasListComponent).componentInstance;
}

describe('FichasListComponent', () => {
  it('con fuente simulada muestra el aviso persistente (también con la lista vacía y su "Nueva ficha")', () => {
    crear([], true);
    const fixture = TestBed.createComponent(FichasListComponent);
    fixture.detectChanges();
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('.form-aviso[role="note"]')!;
    expect(aviso.textContent).toContain('Datos de ejemplo');
    expect(aviso.textContent).toContain('se pierde al recargar');
    expect(fixture.componentInstance.fuenteSimulada).toBeTrue();
  });

  it('con fuente real no muestra el aviso', () => {
    crear([]);
    const fixture = TestBed.createComponent(FichasListComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.form-aviso[role="note"]')).toBeNull();
  });

  it('sin fichas el estado vacío ofrece "Nueva ficha"; con búsqueda activa, "Limpiar filtros"', fakeAsync(() => {
    const componente = crear([]);
    let vista: { hayFiltros: boolean; emptyAccion: string | null } | null = null;
    const sub = componente.vista$.subscribe((v) => { vista = v; });
    expect(vista!.emptyAccion).toBe('nueva');
    componente.lista.searchCtrl.setValue('licencia');
    tick(250);
    expect(vista!.hayFiltros).toBeTrue();
    expect(vista!.emptyAccion).toBe('limpiar');
    sub.unsubscribe();
  }));

  it('"Nueva ficha" abre el alta sin trámite preelegido (se elige en el formulario)', () => {
    const componente = crear([]);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    componente.onEmptyAction('nueva');
    expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/tramites/fichas/nueva']);
  });

  it('el menú de cada fila trae "Puntos de atención" (con READ_ATTENTION_POINT) y abre el detalle en ese panel', () => {
    const componente = crear([FICHA]);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);

    const puntos = componente.accionesDe(FICHA, () => []).find((a) => a.label === 'Puntos de atención')!;
    expect(puntos).toBeDefined();
    expect(puntos.permission).toBe('READ_ATTENTION_POINT');
    puntos.run();
    expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/tramites/fichas/detalle', 'f-1'], { fragment: 'puntos-atencion' });
  });
});

// ───────────────────────────── Caracterización de la lista (arnés compartido) ─────────────────────────────

const TRAMITES = [
  'Obtener licencia de conducir', 'Inscribirse al monotributo', 'Renovar el DNI', 'Solicitar partida de nacimiento',
  'Obtener certificado de residencia', 'Inscribirse en la escuela', 'Pedir turno médico', 'Tramitar la jubilación',
  'Habilitar un comercio', 'Registrar un automotor', 'Obtener certificado de antecedentes', 'Solicitar una beca',
];
/** En Oberá: las de índice 10 y 11 (el resto, en Posadas). En revisión: la de índice 4. Publicada: la de índice 11. */
const FICHAS: FichaLocalVM[] = TRAMITES.map((plantillaTitulo, i) => ({
  ...FICHA,
  id: `f-${i + 1}`, slug: `ficha-${i + 1}`, plantillaTitulo,
  estado: i === 4 ? 'EN_REVISION' : i === 11 ? 'PUBLICADO' : 'BORRADOR',
  localidadId: i >= 10 ? 'l-2' : 'l-1', localidadNombre: i >= 10 ? 'Oberá' : 'Posadas',
}));
/** Además de las anteriores, una desactivada (no se lista salvo con "Mostrar desactivadas"). */
const DESACTIVADA: FichaLocalVM = { ...FICHA, id: 'f-99', slug: 'ficha-99', plantillaTitulo: 'Trámite dado de baja', activa: false };
const PERMISOS_FICHAS = ['READ_VARIANT', 'CREATE_VARIANT', 'UPDATE_VARIANT', 'PUBLISH_VARIANT', 'READ_ADOPTION', 'READ_ATTENTION_POINT'];

/** Acciones de workflow pedidas (`ejecutar`). */
let ejecutadas: [string, string][] = [];

const facadeDePrueba = (puedePublicar: boolean) => (fuente: FuenteDePrueba<FichaLocalVM>) => {
  ejecutadas = [];
  return [{
    provide: FichasLocalesFacade,
    useValue: {
      fichas$: fuente.filas$,
      fuenteSimulada: false,
      puedePublicar$: of(puedePublicar),
      accionesWorkflow$: of((ficha: FichaLocalVM) => (puedePublicar && ficha.estado === 'EN_REVISION' ? ['publicar'] : [])),
      loadFichas: fuente.cargar,
      desactivar: fuente.eliminar,
      ejecutar: (id: string, accion: string) => {
        ejecutadas.push([id, accion]);
        return fuente.eliminar(id);
      },
    },
  }];
};

describeLista<FichaLocalVM>({
  titulo: 'FichasListComponent',
  componente: FichasListComponent,
  facade: facadeDePrueba(false),
  filas: FICHAS,
  nombre: (f) => f.plantillaTitulo ?? '',
  selectorNombre: '.fichalist-tramite__titulo',
  permisos: PERMISOS_FICHAS,
  contador: (n) => `${n} fichas`,
  errorTitulo: 'No pudimos cargar las fichas por localidad',
  vacio: { titulo: 'Todavía no hay fichas por localidad', cta: 'Nueva ficha' },
  sinCrear: { permisos: ['READ_VARIANT'] },
  sinResultados: { texto: 'Ninguna ficha coincide con la búsqueda o los filtros aplicados.', cta: 'Limpiar filtros' },
  busqueda: { termino: 'obtener', esperadas: (f) => (f.plantillaTitulo ?? '').includes('Obtener') },
  ordenPorNombre: 'Trámite',
  acciones: { principal: 'Ver detalle', menu: ['Puntos de atención', 'Editar', 'Desactivar'] },
  soloLectura: { permisos: ['READ_VARIANT'], principal: 'Ver detalle', menu: [] },
  baja: { opcion: 'Desactivar', titulo: '¿Desactivar la ficha?', confirmar: 'Sí, desactivar', aviso: 'Ficha desactivada', foco: true },
});

describe('FichasListComponent · bandeja de revisión, filtros y workflow', () => {
  let po: ListaPO<FichasListComponent>;
  let fuente: FuenteDePrueba<FichaLocalVM>;

  function montar(datos: FichaLocalVM[] = FICHAS): void {
    fuente = new FuenteDePrueba(datos);
    po = montarLista({ componente: FichasListComponent, providers: facadeDePrueba(true)(fuente), permisos: PERMISOS_FICHAS });
    po.asentar();
  }

  const titulos = (): string[] => po.nombres('.fichalist-tramite__titulo');

  afterEach(() => desmontarLista(po));

  it('quien puede publicar ve la tab "En revisión" con su contador; elegirla filtra sin dejar chip y vuelve a la primera página', fakeAsync(() => {
    montar();
    expect(po.tabs().map((t) => t.etiqueta)).toEqual(['Todas', 'En revisión1']);
    po.irAPagina('Página siguiente');

    po.elegirTab('En revisión');
    expect(po.paginaActiva()).toBe('1');
    expect(titulos()).toEqual(['Obtener certificado de residencia']);
    expect(po.chips()).toEqual([]);
    flush();
  }));

  it('la bandeja de revisión vacía lo dice sin ofrecer ninguna acción', fakeAsync(() => {
    montar(FICHAS.filter((f) => f.estado !== 'EN_REVISION'));
    po.elegirTab('En revisión');
    const vacio = po.vacio()!;
    expect(vacio.titulo).toBe('No hay fichas en revisión');
    expect(vacio.cta).toBeNull();
    flush();
  }));

  it('las desactivadas no se listan salvo con "Mostrar desactivadas", que deja su chip', fakeAsync(() => {
    montar([...FICHAS, DESACTIVADA]);
    expect(po.contador()).toBe('12 fichas');

    po.fixture.componentInstance.inactivasCtrl.setValue(true);
    po.asentar();
    expect(po.contador()).toBe('13 fichas');
    expect(po.chips()).toEqual(['Incluye desactivadas']);

    po.quitarChip(0);
    expect(po.contador()).toBe('12 fichas');
    flush();
  }));

  it('los filtros por estado y localidad dejan su chip con el nombre y vuelven a la primera página', fakeAsync(() => {
    montar();
    po.irAPagina('Página siguiente');
    po.fixture.componentInstance.localidadCtrl.setValue('l-1');
    po.asentar();
    expect(po.paginaActiva()).toBe('1');
    expect(po.chips()).toEqual(['Localidad: Posadas']);

    po.fixture.componentInstance.estadoCtrl.setValue('EN_REVISION');
    po.asentar();
    expect(po.chips()).toEqual(['Estado: En revisión', 'Localidad: Posadas']);
    expect(titulos()).toEqual(['Obtener certificado de residencia']);

    po.limpiarTodo();
    expect(po.chips()).toEqual([]);
    expect(po.contador()).toBe('12 fichas');
    flush();
  }));

  it('una localidad elegida que deja de estar en la lista deja de filtrar', fakeAsync(() => {
    montar();
    po.fixture.componentInstance.localidadCtrl.setValue('l-2');
    po.asentar();
    expect(po.contador()).toBe('2 fichas');

    fuente.filas$.next(FICHAS.filter((f) => f.localidadId === 'l-1'));
    po.asentar();
    expect(po.chips()).toEqual([]);
    expect(po.contador()).toBe('10 fichas');
    flush();
  }));

  it('una acción de workflow del menú pide confirmación, se ejecuta con la fila bloqueada y avisa', fakeAsync(() => {
    montar();
    expect(po.opcionesDelMenu(4)).toEqual(['Puntos de atención', 'Editar', 'Publicar', 'Desactivar']);

    po.elegirDelMenu(4, 'Publicar');
    expect(po.confirmacion()!.titulo).toBe('¿Publicar la ficha?');
    po.pulsar(po.confirmacion()!.confirmar);
    expect(ejecutadas).toEqual([['f-5', 'publicar']]);
    expect(po.filaOcupada(4)).toBeTrue();

    fuente.terminarBaja(true);
    po.asentar();
    flush();
    po.render();
    expect(po.avisos).toEqual([{ mensaje: 'Ficha publicada', accion: 'OK', duracion: 3000, clase: 'snackbar-success' }]);
    expect(po.filaOcupada(4)).toBeFalse();
    flush();
  }));
});
