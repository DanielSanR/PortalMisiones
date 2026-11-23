import { TestBed, fakeAsync, flush } from '@angular/core/testing';
import { defer, of } from 'rxjs';
import { ESCRIBIR_ROLES_PERMISOS_ACCESS } from '@core/constants/policy-overrides.constants';
import { UserRole } from '@core/enums/user-role.enum';
import { AuthTokenService } from '@core/services/auth-token.service';
import { PermisosFacade, PermisoVM } from '@features/permisos';
import {
  FuenteDePrueba, ListaPO, describeDialogoDeLista, describeLista, desmontarLista, montarLista,
} from '@shared/utils/testing/lista.testing';
import { PermisosListComponent } from './permisos-list.component';

const CODIGOS = [
  'READ_USER', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'READ_TAG', 'CREATE_TAG', 'UPDATE_TAG', 'DELETE_TAG',
  'READ_MODALITY', 'CREATE_MODALITY', 'READ_CATEGORY', 'CREATE_CATEGORY',
];
const PERMISOS_VM: PermisoVM[] = CODIGOS.map((codigo, i) => ({ id: `p-${i + 1}`, codigo, descripcion: `Regla ${i + 1}` }));

/** `puedeEscribir$` como lo resuelve el facade real: con la sesión y la regla de escritura de Roles y Permisos. */
const facade = (fuente: FuenteDePrueba<PermisoVM>) => [{
  provide: PermisosFacade,
  useValue: {
    permisos$: fuente.filas$,
    loadPermisos: fuente.cargar,
    delete: fuente.eliminar,
    puedeEscribir$: defer(() => of(TestBed.inject(AuthTokenService).canAccess(ESCRIBIR_ROLES_PERMISOS_ACCESS))),
  },
}];

describeLista<PermisoVM>({
  titulo: 'PermisosListComponent',
  componente: PermisosListComponent,
  facade,
  filas: PERMISOS_VM,
  nombre: (p) => p.codigo,
  permisos: [],
  rol: UserRole.SUPERADMIN,
  contador: (n) => `${n} permisos`,
  errorTitulo: 'No pudimos cargar los permisos',
  vacio: { titulo: 'Todavía no hay permisos', cta: 'Nuevo permiso' },
  sinCrear: { permisos: [], rol: UserRole.ADMIN_BACKOFFICE },
  sinResultados: { texto: 'Ningún permiso coincide con la búsqueda o los filtros aplicados.', cta: 'Limpiar filtros' },
  busqueda: { termino: 'modality', esperadas: (p) => p.codigo.includes('MODALITY') },
  ordenPorNombre: 'Código',
  acciones: { principal: 'Editar', menu: ['Eliminar'] },
  soloLectura: { permisos: [], rol: UserRole.ADMIN_BACKOFFICE, principal: null, menu: [] },
  baja: { opcion: 'Eliminar', titulo: '¿Eliminar el permiso?', confirmar: 'Sí, eliminar', aviso: 'Permiso eliminado', foco: true },
});

describeDialogoDeLista<PermisoVM, PermisosListComponent>({
  titulo: 'PermisosListComponent',
  componente: PermisosListComponent,
  facade,
  filas: PERMISOS_VM,
  permisos: [],
  rol: UserRole.SUPERADMIN,
  crear: (componente) => componente.onCreate(),
  nuevo: { titulo: 'Nuevo permiso', aviso: 'Permiso creado' },
  editar: { titulo: 'Editar permiso', aviso: 'Permiso actualizado' },
});

describe('PermisosListComponent · filtro por acción', () => {
  let po: ListaPO<PermisosListComponent>;

  afterEach(() => desmontarLista(po));

  it('las tabs son las acciones del catálogo, con su cantidad; elegir una filtra y deja su chip', fakeAsync(() => {
    po = montarLista({ componente: PermisosListComponent, providers: facade(new FuenteDePrueba(PERMISOS_VM)), rol: UserRole.SUPERADMIN });
    po.asentar();
    const tabs = po.tabs();
    expect(tabs[0].etiqueta).toBe('Todas12');
    expect(tabs.length).toBe(5);

    // La primera acción con dos permisos en el catálogo de la prueba es UPDATE (usuario y etiqueta).
    const deDos = tabs.find((t) => t.etiqueta.endsWith('2') && !t.etiqueta.endsWith('12'))!;
    deDos.boton.click();
    po.asentar();
    expect(po.nombres('.cell-name__principal')).toEqual(['UPDATE_USER', 'UPDATE_TAG']);
    expect(po.chips().length).toBe(1);
    expect(po.chips()[0]).toMatch(/^Acción: /);
    expect(po.contador()).toBe('2 permisos');

    po.limpiarTodo();
    expect(po.contador()).toBe('12 permisos');
    expect(po.tabs()[0].activa).toBeTrue();
    flush();
  }));
});
