import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, fakeAsync, flush } from '@angular/core/testing';
import { Router } from '@angular/router';
import { API_CODES } from '@core/constants/api-codes.constants';
import { OrganismosFacade, OrganismoVM } from '@features/organismos';
import { FuenteDePrueba, ListaPO, describeLista, desmontarLista, montarLista } from '@shared/utils/testing/lista.testing';
import { OrganismosListComponent } from './organismos-list.component';

const NOMBRES = [
  'Ministerio de Salud', 'Ministerio de Educación', 'Vialidad', 'Instituto de Previsión Social', 'Rentas',
  'Registro de las Personas', 'Ministerio de Turismo', 'Catastro', 'Defensa del Consumidor', 'Ecología',
  'Deportes', 'Ministerio de Hacienda',
];
/** Inactivos: los de índice 4 y 10 (Rentas y Deportes). */
const ORGANISMOS: OrganismoVM[] = NOMBRES.map((nombre, i) => ({
  id: `o-${i + 1}`, typeId: 't-1', tipoNombre: 'Organismo', parentId: null, baseLocationId: null,
  nombre, acronym: `SG${i + 1}`, activo: i !== 4 && i !== 10,
}));
const PERMISOS = ['READ_ORGANISM', 'CREATE_ORGANISM', 'UPDATE_ORGANISM', 'DELETE_ORGANISM'];

const facade = (fuente: FuenteDePrueba<OrganismoVM>) => [{
  provide: OrganismosFacade,
  useValue: { organismos$: fuente.filas$, loadOrganismos: fuente.cargar, delete: fuente.eliminar },
}];

describeLista<OrganismoVM>({
  titulo: 'OrganismosListComponent',
  componente: OrganismosListComponent,
  facade,
  filas: ORGANISMOS,
  nombre: (o) => o.nombre,
  permisos: PERMISOS,
  contador: (n) => `${n} organismos`,
  errorTitulo: 'No pudimos cargar los organismos',
  vacio: { titulo: 'Todavía no hay organismos', cta: 'Nuevo organismo' },
  sinCrear: { permisos: ['READ_ORGANISM'] },
  sinResultados: { texto: 'Ningún organismo coincide con la búsqueda o el filtro aplicado.', cta: 'Limpiar filtros' },
  busqueda: { termino: 'ministerio', esperadas: (o) => o.nombre.includes('Ministerio') },
  ordenPorNombre: 'Nombre',
  acciones: { principal: 'Editar', menu: ['Ver detalle', 'Eliminar'] },
  soloLectura: { permisos: ['READ_ORGANISM'], principal: null, menu: ['Ver detalle'] },
  baja: { opcion: 'Eliminar', titulo: '¿Eliminar el organismo?', confirmar: 'Sí, eliminar', aviso: 'Organismo eliminado', foco: true },
});

describe('OrganismosListComponent · navegación, filtro y rechazo de la baja', () => {
  let po: ListaPO<OrganismosListComponent>;
  let fuente: FuenteDePrueba<OrganismoVM>;
  let navigate: jasmine.Spy;

  function montar(): void {
    fuente = new FuenteDePrueba(ORGANISMOS);
    po = montarLista({ componente: OrganismosListComponent, providers: facade(fuente), permisos: PERMISOS });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    po.asentar();
  }

  afterEach(() => desmontarLista(po));

  it('"Nuevo organismo" va al alta en página', fakeAsync(() => {
    montar();
    po.fixture.componentInstance.onCreate();
    expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/organismos/nuevo']);
    flush();
  }));

  it('"Editar" va a la edición recordando que se vino de la lista', fakeAsync(() => {
    montar();
    po.accionPrincipal(0)!.click();
    expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/organismos/editar', 'o-1'], { queryParams: { origen: 'lista' } });
    flush();
  }));

  it('"Ver detalle" va a la ficha', fakeAsync(() => {
    montar();
    po.elegirDelMenu(2, 'Ver detalle');
    expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/organismos/detalle', 'o-3']);
    flush();
  }));

  it('"Inactivos" filtra y deja el chip "Estado: Inactivos"', fakeAsync(() => {
    montar();
    expect(po.tabs().map((t) => t.etiqueta)).toEqual(['Todos12', 'Activos10', 'Inactivos2']);
    po.elegirTab('Inactivos');
    expect(po.nombres('.cell-name__principal')).toEqual(['Rentas', 'Deportes']);
    expect(po.chips()).toEqual(['Estado: Inactivos']);
    flush();
  }));

  it('si el backend rechaza la baja porque tiene organismos que dependen de él, la confirmación dice qué hacer', fakeAsync(() => {
    montar();
    po.elegirDelMenu(1, 'Eliminar');
    po.pulsar(po.confirmacion()!.confirmar);
    fuente.fallarBaja(new HttpErrorResponse({ status: 409, error: { code: API_CODES.ORGANISM_HAS_CHILDREN, message: 'x' } }));
    po.asentar();

    expect(po.confirmacion()!.error).toBe(
      'No se puede eliminar: tiene organismos activos que dependen de él. Asignales otro organismo superior o dalos de baja primero.',
    );
    po.pulsar(po.confirmacion()!.cancelar);
    flush();
  }));
});
