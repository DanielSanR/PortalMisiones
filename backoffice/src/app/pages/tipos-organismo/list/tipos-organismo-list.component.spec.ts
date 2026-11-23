import { fakeAsync, flush } from '@angular/core/testing';
import { TiposOrganismoFacade, TipoOrganismoVM } from '@features/tipos-organismo';
import {
  FuenteDePrueba, ListaPO, describeDialogoDeLista, describeLista, desmontarLista, montarLista,
} from '@shared/utils/testing/lista.testing';
import { TiposOrganismoListComponent } from './tipos-organismo-list.component';

const NOMBRES = [
  'Ministerio', 'Secretaría', 'Subsecretaría', 'Ente autárquico', 'Dirección', 'Instituto', 'Municipio',
  'Empresa del Estado', 'Agencia', 'Consejo', 'Subdirección', 'Tribunal',
];
/** Inactivos: los de índice 2 y 7 (Subsecretaría y Empresa del Estado). */
const TIPOS: TipoOrganismoVM[] = NOMBRES.map((nombre, i) => ({
  id: `t-${i + 1}`, code: `COD${i + 1}`, nombre, descripcion: `Descripción ${i + 1}`, activo: i !== 2 && i !== 7,
}));
const PERMISOS = ['READ_ORGANISM_TYPE', 'CREATE_ORGANISM_TYPE', 'UPDATE_ORGANISM_TYPE', 'DELETE_ORGANISM_TYPE'];

const facade = (fuente: FuenteDePrueba<TipoOrganismoVM>) => [{
  provide: TiposOrganismoFacade,
  useValue: { tipos$: fuente.filas$, loadTipos: fuente.cargar, delete: fuente.eliminar },
}];

describeLista<TipoOrganismoVM>({
  titulo: 'TiposOrganismoListComponent',
  componente: TiposOrganismoListComponent,
  facade,
  filas: TIPOS,
  nombre: (t) => t.nombre,
  permisos: PERMISOS,
  contador: (n) => `${n} tipos de organismo`,
  errorTitulo: 'No pudimos cargar los tipos de organismo',
  vacio: { titulo: 'Todavía no hay tipos de organismo', cta: 'Nuevo tipo' },
  sinCrear: { permisos: ['READ_ORGANISM_TYPE'] },
  sinResultados: { texto: 'Ningún tipo de organismo coincide con la búsqueda o el filtro aplicado.', cta: 'Limpiar filtros' },
  busqueda: { termino: 'sub', esperadas: (t) => t.nombre.toLowerCase().includes('sub') },
  ordenPorNombre: 'Nombre',
  acciones: { principal: 'Editar', menu: ['Eliminar'] },
  soloLectura: { permisos: ['READ_ORGANISM_TYPE'], principal: null, menu: [] },
  baja: {
    opcion: 'Eliminar', titulo: '¿Eliminar el tipo de organismo?', confirmar: 'Sí, eliminar',
    aviso: 'Tipo de organismo eliminado', foco: true,
  },
});

describeDialogoDeLista<TipoOrganismoVM, TiposOrganismoListComponent>({
  titulo: 'TiposOrganismoListComponent',
  componente: TiposOrganismoListComponent,
  facade,
  filas: TIPOS,
  permisos: PERMISOS,
  crear: (componente) => componente.onCreate(),
  nuevo: { titulo: 'Nuevo tipo de organismo', aviso: 'Tipo de organismo creado' },
  editar: { titulo: 'Editar tipo de organismo', aviso: 'Tipo de organismo actualizado' },
});

describe('TiposOrganismoListComponent · filtro por estado', () => {
  let po: ListaPO<TiposOrganismoListComponent>;

  function montar(): void {
    po = montarLista({ componente: TiposOrganismoListComponent, providers: facade(new FuenteDePrueba(TIPOS)), permisos: PERMISOS });
    po.asentar();
  }

  afterEach(() => desmontarLista(po));

  it('las tabs cuentan sobre lo ya buscado', fakeAsync(() => {
    montar();
    expect(po.tabs().map((t) => t.etiqueta)).toEqual(['Todos12', 'Activos10', 'Inactivos2']);
    po.buscar('sub');
    expect(po.tabs().map((t) => t.etiqueta)).toEqual(['Todos2', 'Activos1', 'Inactivos1']);
    flush();
  }));

  it('"Inactivos" filtra, deja el chip "Estado: Inactivos" y "Limpiar todo" vuelve a "Todos"', fakeAsync(() => {
    montar();
    po.elegirTab('Inactivos');
    expect(po.nombres('.cell-name__principal')).toEqual(['Subsecretaría', 'Empresa del Estado']);
    expect(po.contador()).toBe('2 tipos de organismo');
    expect(po.chips()).toEqual(['Estado: Inactivos']);

    po.limpiarTodo();
    expect(po.tabs().find((t) => t.activa)!.etiqueta).toBe('Todos12');
    expect(po.contador()).toBe('12 tipos de organismo');
    flush();
  }));

  it('con el filtro elegido y sin coincidencias, el vacío ofrece limpiar y limpia búsqueda y filtro', fakeAsync(() => {
    montar();
    po.elegirTab('Inactivos');
    po.buscar('ministerio');
    expect(po.chips()).toEqual(['Búsqueda: ministerio', 'Estado: Inactivos']);
    const vacio = po.vacio()!;
    expect(vacio.titulo).toBe('Sin resultados');

    vacio.cta!.click();
    po.asentar(250);
    expect(po.chips()).toEqual([]);
    expect(po.contador()).toBe('12 tipos de organismo');
    flush();
  }));

  it('quitar el chip del estado deja la búsqueda', fakeAsync(() => {
    montar();
    po.elegirTab('Activos');
    po.buscar('sub');
    po.quitarChip(1);
    expect(po.chips()).toEqual(['Búsqueda: sub']);
    expect(po.contador()).toBe('2 tipos de organismo');
    flush();
  }));

  it('elegir una tab estando en la segunda página vuelve a la primera', fakeAsync(() => {
    montar();
    po.irAPagina('Página siguiente');
    po.elegirTab('Activos');
    expect(po.paginaActiva()).toBe('1');
    expect(po.filas().length).toBe(10);
    flush();
  }));
});
