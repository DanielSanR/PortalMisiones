import { TestBed, fakeAsync, flush } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PlantillaVM, PlantillasFacade } from '@features/plantillas';
import { FuenteDePrueba, ListaPO, describeLista, desmontarLista, montarLista } from '@shared/utils/testing/lista.testing';
import { PlantillasListComponent } from './plantillas-list.component';

const TITULOS = [
  'Obtener licencia de conducir', 'Inscribirse al monotributo', 'Renovar el DNI', 'Solicitar partida de nacimiento',
  'Obtener certificado de residencia', 'Inscribirse en la escuela', 'Pedir turno médico', 'Tramitar la jubilación',
  'Habilitar un comercio', 'Registrar un automotor', 'Obtener certificado de antecedentes', 'Solicitar una beca',
];
const SALUD = { id: 'c-1', nombre: 'Salud' };
const DIGITAL = { id: 'm-1', nombre: 'Digital' };
/** Con categoría "Salud" y modalidad "Digital": solo la de índice 6. */
const PLANTILLAS: PlantillaVM[] = TITULOS.map((titulo, i) => ({
  id: `p-${i + 1}`, titulo, slug: `tramite-${i + 1}`, resumen: null, descripcionLarga: null,
  modalidad: i === 6 ? DIGITAL : null, categoriaPrincipal: i === 6 ? SALUD : null,
  categorias: [], etiquetas: [], destinatarios: [], eventosDeVida: [], activa: true,
}));
const PERMISOS = ['READ_PROCEDURE', 'CREATE_PROCEDURE', 'UPDATE_PROCEDURE', 'DELETE_PROCEDURE'];

const facade = (fuente: FuenteDePrueba<PlantillaVM>) => [{
  provide: PlantillasFacade,
  useValue: { plantillas$: fuente.filas$, loadPlantillas: fuente.cargar, desactivar: fuente.eliminar },
}];

describeLista<PlantillaVM>({
  titulo: 'PlantillasListComponent',
  componente: PlantillasListComponent,
  facade,
  filas: PLANTILLAS,
  nombre: (p) => p.titulo,
  selectorNombre: '.plantlist-titulo__link',
  permisos: PERMISOS,
  contador: (n) => `${n} plantillas`,
  errorTitulo: 'No pudimos cargar las plantillas',
  vacio: { titulo: 'Todavía no hay plantillas provinciales', cta: 'Nueva plantilla' },
  sinCrear: { permisos: ['READ_PROCEDURE'] },
  sinResultados: { texto: 'Ninguna plantilla coincide con la búsqueda o los filtros aplicados.', cta: 'Limpiar filtros' },
  busqueda: { termino: 'obtener', esperadas: (p) => p.titulo.includes('Obtener') },
  ordenPorNombre: 'Plantilla',
  acciones: { principal: 'Editar', menu: ['Ver detalle', 'Desactivar'] },
  soloLectura: { permisos: ['READ_PROCEDURE'], principal: null, menu: ['Ver detalle'] },
  baja: {
    opcion: 'Desactivar', titulo: '¿Desactivar la plantilla?', confirmar: 'Sí, desactivar', aviso: 'Plantilla desactivada', foco: true,
  },
});

describe('PlantillasListComponent · navegación', () => {
  let po: ListaPO<PlantillasListComponent>;

  afterEach(() => desmontarLista(po));

  it('"Nueva plantilla", "Editar" y "Ver detalle" van a sus páginas', fakeAsync(() => {
    po = montarLista({ componente: PlantillasListComponent, providers: facade(new FuenteDePrueba(PLANTILLAS)), permisos: PERMISOS });
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    po.asentar();

    po.fixture.componentInstance.onCreate();
    expect(navigate.calls.mostRecent().args).toEqual([['/dashboard/tramites/plantillas/nueva']]);
    po.accionPrincipal(0)!.click();
    expect(navigate.calls.mostRecent().args).toEqual([['/dashboard/tramites/plantillas/editar', 'p-1']]);
    po.elegirDelMenu(1, 'Ver detalle');
    expect(navigate.calls.mostRecent().args).toEqual([['/dashboard/tramites/plantillas/detalle', 'p-2']]);
    flush();
  }));

  it('los filtros por categoría y modalidad dejan su chip con el nombre, y "Limpiar todo" los quita', fakeAsync(() => {
    po = montarLista({ componente: PlantillasListComponent, providers: facade(new FuenteDePrueba(PLANTILLAS)), permisos: PERMISOS });
    po.asentar();

    po.fixture.componentInstance.categoriaCtrl.setValue('c-1');
    po.fixture.componentInstance.modalidadCtrl.setValue('m-1');
    po.asentar();
    expect(po.chips()).toEqual(['Categoría: Salud', 'Modalidad: Digital']);
    expect(po.nombres('.plantlist-titulo__link')).toEqual(['Pedir turno médico']);
    expect(po.contador()).toBe('1 plantillas');

    po.limpiarTodo();
    expect(po.chips()).toEqual([]);
    expect(po.contador()).toBe('12 plantillas');
    flush();
  }));
});
