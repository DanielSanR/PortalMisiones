import { TestBed, fakeAsync, flush } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, Subject, defer, of, tap } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { ESCRIBIR_ROLES_PERMISOS_ACCESS } from '@core/constants/policy-overrides.constants';
import { UserRole } from '@core/enums/user-role.enum';
import { AuthTokenService } from '@core/services/auth-token.service';
import { RolesFacade, RolVM } from '@features/roles';
import { FuenteDePrueba, ListaPO, describeLista, desmontarLista, montarLista } from '@shared/utils/testing/lista.testing';
import { RolesListComponent } from './roles-list.component';

const CODIGOS = [
  'MESA_DE_ENTRADA', 'AUDITOR', 'EDITOR_DE_FICHAS', 'REVISOR', 'OPERADOR', 'CONSULTA', 'EDITOR_DE_PLANTILLAS',
  'SOPORTE', 'CARGA', 'PUBLICADOR', 'ANALISTA', 'TESORERIA',
];
const PERMISO = { id: 'p-1', codigo: 'READ_USER', descripcion: 'Ver usuarios' };
/** Por organismo: los de índice impar. Todos activos. */
const ROLES: RolVM[] = CODIGOS.map((codigo, i) => ({
  id: `r-${i + 1}`, codigo, descripcion: `Rol ${i + 1}`, scopeTipo: i % 2 ? 'organismo' : 'global',
  asignablePorOrgAdmin: false, asignablePorBackoffice: true, activo: true, permisos: i === 0 ? [PERMISO] : [],
}));

const facade = (fuente: FuenteDePrueba<RolVM>) => [{
  provide: RolesFacade,
  useValue: {
    roles$: fuente.filas$,
    loadRoles: fuente.cargar,
    getFormData: () => of({ permisos: [PERMISO], rol: null }),
    delete: fuente.eliminar,
    puedeEscribir$: defer(() => of(TestBed.inject(AuthTokenService).canAccess(ESCRIBIR_ROLES_PERMISOS_ACCESS))),
  },
}];

describeLista<RolVM>({
  titulo: 'RolesListComponent',
  componente: RolesListComponent,
  facade,
  filas: ROLES,
  nombre: (r) => r.codigo,
  selectorNombre: '.rol-cell__name',
  permisos: [],
  rol: UserRole.SUPERADMIN,
  contador: (n) => `${n} roles`,
  errorTitulo: 'No pudimos cargar los roles',
  vacio: { titulo: 'Todavía no hay roles', cta: 'Nuevo rol' },
  sinCrear: { permisos: [], rol: UserRole.ADMIN_BACKOFFICE },
  sinResultados: { texto: 'Ningún rol coincide con la búsqueda o el filtro aplicado.', cta: 'Limpiar filtros' },
  busqueda: { termino: 'editor', esperadas: (r) => r.codigo.includes('EDITOR') },
  ordenPorNombre: 'Rol',
  sinPaginado: true,
  acciones: { principal: 'Editar', menu: ['Desactivar'] },
  soloLectura: { permisos: [], rol: UserRole.ADMIN_BACKOFFICE, principal: null, menu: [] },
  baja: {
    opcion: 'Desactivar', titulo: '¿Desactivar el rol?', confirmar: 'Sí, desactivar', aviso: 'Rol desactivado',
    foco: true, conservaFila: true,
  },
});

describe('RolesListComponent · detalle, filtro y navegación', () => {
  let po: ListaPO<RolesListComponent>;
  let fuente: FuenteDePrueba<RolVM>;

  function montar(modo: FuenteDePrueba<RolVM>['modo'] = 'ok'): void {
    fuente = new FuenteDePrueba(ROLES);
    fuente.modo = modo;
    po = montarLista({ componente: RolesListComponent, providers: facade(fuente), rol: UserRole.SUPERADMIN });
    po.asentar();
  }

  const detalle = (): HTMLElement => po.host.querySelector<HTMLElement>('.roles-layout__detail')!;

  afterEach(() => desmontarLista(po));

  it('mientras carga, el panel de detalle dice "Cargando los permisos…"', fakeAsync(() => {
    montar('pendiente');
    expect(detalle().textContent).toContain('Cargando los permisos…');
    flush();
  }));

  it('si la carga falla, el panel de detalle queda vacío (el error lo cuenta la tabla)', fakeAsync(() => {
    montar('error');
    expect(detalle().querySelector('.rol-detail')).toBeNull();
    flush();
  }));

  it('al cargar selecciona el primer rol y muestra sus permisos; tocar otra fila cambia el detalle', fakeAsync(() => {
    montar();
    expect(detalle().querySelector('.rol-detail__title')!.textContent).toContain('Rol 1');
    expect(detalle().textContent).toContain('1 permisos asignados');

    po.filas()[2].click();
    po.asentar();
    expect(detalle().querySelector('.rol-detail__title')!.textContent).toContain('Rol 3');
    expect(detalle().textContent).toContain('0 permisos asignados');
    flush();
  }));

  it('si el filtro deja afuera al rol seleccionado, el detalle pasa al primero visible', fakeAsync(() => {
    montar();
    expect(po.tabs().map((t) => t.etiqueta)).toEqual(['Todos12', 'Global6', 'Organismo6']);
    po.elegirTab('Organismo');
    expect(po.chips()).toEqual(['Alcance: Organismo']);
    expect(po.filas().length).toBe(6);
    expect(detalle().querySelector('.rol-detail__title')!.textContent).toContain('Rol 2');
    flush();
  }));

  it('"Nuevo rol" y "Editar" van a las páginas del formulario', fakeAsync(() => {
    montar();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    po.fixture.componentInstance.onCreate();
    expect(navigate.calls.mostRecent().args).toEqual([['/dashboard/roles/nuevo']]);
    po.accionPrincipal(1)!.click();
    expect(navigate.calls.mostRecent().args).toEqual([['/dashboard/roles/editar', 'r-2']]);
    flush();
  }));
});

describe('RolesListComponent · activar un rol inactivo', () => {
  /** TEST_1, como el de staging: global, inactivo y con permisos. */
  const INACTIVO: RolVM = {
    id: 'r-inactivo', codigo: 'TEST_1', descripcion: 'Test', scopeTipo: 'global',
    asignablePorOrgAdmin: false, asignablePorBackoffice: true, activo: false, permisos: [PERMISO],
  };
  const FILAS = [ROLES[0], INACTIVO];
  const FILA_INACTIVA = 1;

  let po: ListaPO<RolesListComponent>;
  let fuente: FuenteDePrueba<RolVM>;
  let activacion$: Subject<RolVM>;
  let activate: jasmine.Spy<(id: string) => Observable<RolVM>>;

  function montar(rol: UserRole = UserRole.SUPERADMIN): void {
    fuente = new FuenteDePrueba(FILAS);
    activate = jasmine.createSpy('activate').and.callFake((id: string) => defer(() => {
      activacion$ = new Subject<RolVM>();
      return activacion$.pipe(tap((activado) => fuente.filas$.next(fuente.filas$.value.map((f) => (f.id === id ? activado : f)))));
    }));
    const [proveedor] = facade(fuente);
    po = montarLista({
      componente: RolesListComponent,
      providers: [{ ...proveedor, useValue: { ...proveedor.useValue, activate } }],
      rol,
    });
    po.asentar();
  }

  /** El backend respondió: la fila queda activa. */
  function responder(): void {
    activacion$.next({ ...INACTIVO, activo: true });
    activacion$.complete();
    po.asentar();
  }

  const estado = (fila: number): string => po.filas()[fila].querySelector('.bool-badge')!.textContent!.trim();

  afterEach(() => desmontarLista(po));

  it('la fila inactiva conserva "Editar" y su menú ofrece "Activar" (no "Desactivar"), con un nombre que dice qué rol', fakeAsync(() => {
    montar();
    expect(po.accionPrincipal(FILA_INACTIVA)!.textContent).toContain('Editar');
    expect(po.disparadorDelMenu(FILA_INACTIVA)).not.toBeNull();

    const items = po.abrirMenu(FILA_INACTIVA);
    expect(items.map((i) => i.textContent!.trim())).toEqual(['Activar']);
    expect(items[0].getAttribute('aria-label')).toBe('Activar rol TEST_1');
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
    po.asentar();
    flush();
  }));

  it('confirmar llama al facade solo con el id (el facade relee el rol antes del PUT), avisa "Rol activado", deja la fila activa y el foco en ella', fakeAsync(() => {
    montar();
    po.elegirDelMenu(FILA_INACTIVA, 'Activar');

    const conf = po.confirmacion()!;
    expect(conf.titulo).toBe('¿Activar el rol?');
    expect(conf.texto).toContain('TEST_1 volverá a estar activo');
    expect(conf.confirmar.textContent!.trim()).toBe('Sí, activar');
    // No es destructiva: el botón de confirmar no va en rojo.
    expect(conf.confirmar.classList).not.toContain('mat-warn');
    expect(conf.confirmar.classList).toContain('mat-primary');

    po.pulsar(conf.confirmar);
    expect(activate).toHaveBeenCalledOnceWith(INACTIVO.id);
    expect(po.filaOcupada(FILA_INACTIVA)).toBeTrue();

    responder();
    expect(po.confirmacion()).toBeNull();
    expect(po.mensajesDeAviso()).toEqual(['Rol activado']);
    expect(po.filas().length).toBe(2);
    expect(estado(FILA_INACTIVA)).toBe('Activo');
    expect(po.filaOcupada(FILA_INACTIVA)).toBeFalse();
    expect(po.filas()[FILA_INACTIVA].contains(document.activeElement)).toBeTrue();
    // Ya activo, el menú vuelve a ofrecer "Desactivar".
    expect(po.opcionesDelMenu(FILA_INACTIVA)).toEqual(['Desactivar']);
    flush();
  }));

  it('cancelar no llama al facade ni cambia la fila', fakeAsync(() => {
    montar();
    po.elegirDelMenu(FILA_INACTIVA, 'Activar');
    po.pulsar(po.confirmacion()!.cancelar);
    flush();

    expect(activate).not.toHaveBeenCalled();
    expect(po.confirmacion()).toBeNull();
    expect(po.mensajesDeAviso()).toEqual([]);
    expect(estado(FILA_INACTIVA)).toBe('Inactivo');
  }));

  it('sin permiso de escritura (ADMIN_BACKOFFICE) la fila inactiva no ofrece "Activar"', fakeAsync(() => {
    montar(UserRole.ADMIN_BACKOFFICE);
    expect(po.disparadorDelMenu(FILA_INACTIVA)).toBeNull();
    expect(po.accionPrincipal(FILA_INACTIVA)).toBeNull();
    flush();
  }));

  it('si el backend rechaza (404 `4059`), el diálogo muestra el texto propio y la fila sigue inactiva', fakeAsync(() => {
    montar();
    po.elegirDelMenu(FILA_INACTIVA, 'Activar');
    po.pulsar(po.confirmacion()!.confirmar);
    activacion$.error({ status: 404, error: { code: API_CODES.ROLE_NOT_FOUND, message: 'Rol no encontrado.' } });
    po.asentar();

    const conf = po.confirmacion()!;
    expect(conf.error).toBe('Ese rol ya no existe. Recargá la página para ver la lista actualizada.');
    expect(conf.error).not.toContain('Rol no encontrado.');
    expect(po.mensajesDeAviso()).toEqual([]);
    expect(estado(FILA_INACTIVA)).toBe('Inactivo');
    flush();
  }));
});
