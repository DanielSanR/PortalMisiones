import { fakeAsync, flush } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { UserRole } from '@core/enums/user-role.enum';
import { SesionUsuariosVM, UsuariosFacade, UsuarioVM } from '@features/usuarios';
import {
  FuenteDePrueba, ListaPO, describeLista, desmontarLista, espiarDialogos, montarLista,
} from '@shared/utils/testing/lista.testing';
import { UsuariosListComponent } from './usuarios-list.component';

const PERSONAS: [string, string][] = [
  ['Ana', 'Benítez'], ['Bruno', 'Acosta'], ['Carla', 'Duarte'], ['Diego', 'Franco'], ['Elena', 'Gómez'],
  ['Fabián', 'Ibarra'], ['Gisela', 'Benítez'], ['Hugo', 'Krause'], ['Inés', 'López'], ['Julio', 'Méndez'],
  ['Karina', 'Núñez'], ['Luis', 'Benítez'],
];
/** Inactivos: los de índice 5 y 8 (Fabián e Inés). El de índice 0 es la cuenta de la sesión. */
const USUARIOS: UsuarioVM[] = PERSONAS.map(([nombre, apellido], i) => ({
  id: `u-${i + 1}`, nombre, apellido, email: `${nombre.toLowerCase()}@misiones.gob.ar`, rol: null,
  organismoId: null, activo: i !== 5 && i !== 8,
}));
const PERMISOS = ['READ_USER', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'READ_ORGANISM'];
const SESION: SesionUsuariosVM = {
  usuarioId: 'u-1', email: 'ana@misiones.gob.ar', esSuperAdmin: true, rol: UserRole.SUPERADMIN, organismoId: null,
};

/** Cambios de estado de cuenta pedidos (`setAccountStatus`), para los casos de activar y desactivar. */
let estados: [string, boolean][] = [];

const facade = (fuente: FuenteDePrueba<UsuarioVM>) => {
  estados = [];
  return [{
    provide: UsuariosFacade,
    useValue: {
      usuarios$: fuente.filas$,
      loadUsuarios: fuente.cargar,
      sesion$: new BehaviorSubject(SESION),
      edicionDisponible: true,
      accionesDeCuentaDisponibles: true,
      borradoDefinitivoDisponible: true,
      deleteDefinitive: fuente.eliminar,
      setAccountStatus: (id: string, activo: boolean) => {
        estados.push([id, activo]);
        return fuente.eliminar(id);
      },
    },
  }];
};

describeLista<UsuarioVM>({
  titulo: 'UsuariosListComponent',
  componente: UsuariosListComponent,
  facade,
  filas: USUARIOS,
  nombre: (u) => `${u.nombre} ${u.apellido}`,
  permisos: PERMISOS,
  contador: (n) => `${n} usuarios`,
  errorTitulo: 'No pudimos cargar los usuarios',
  vacio: { titulo: 'Todavía no hay usuarios', cta: 'Nuevo usuario' },
  sinCrear: { permisos: ['READ_USER'] },
  sinResultados: { texto: 'Ningún usuario coincide con la búsqueda o el filtro aplicado.', cta: 'Limpiar filtros' },
  busqueda: { termino: 'benítez', esperadas: (u) => u.apellido === 'Benítez' },
  ordenPorNombre: 'Usuario',
  // Fila 0 = la cuenta de la sesión: no se ofrece desactivarla ni eliminarla.
  acciones: { principal: 'Editar', menu: ['Cambiar email', 'Cambiar contraseña'] },
  soloLectura: { permisos: ['READ_USER'], principal: null, menu: [] },
  baja: {
    opcion: 'Eliminar definitivamente', titulo: '¿Eliminar el usuario definitivamente?', confirmar: 'Sí, eliminar',
    aviso: 'Usuario eliminado', foco: true,
  },
});

describe('UsuariosListComponent · cuenta, filtro y alta', () => {
  let po: ListaPO<UsuariosListComponent>;
  let fuente: FuenteDePrueba<UsuarioVM>;

  beforeAll(async () => {
    await import('@shared/components/form-dialog/form-dialog.component');
  });

  function montar(): void {
    fuente = new FuenteDePrueba(USUARIOS);
    po = montarLista({ componente: UsuariosListComponent, providers: facade(fuente), permisos: PERMISOS });
    po.asentar();
  }

  afterEach(() => desmontarLista(po));

  it('una cuenta ajena activa ofrece desactivarla y eliminarla; una inactiva, activarla', fakeAsync(() => {
    montar();
    expect(po.opcionesDelMenu(1)).toEqual(['Cambiar email', 'Cambiar contraseña', 'Desactivar cuenta', 'Eliminar definitivamente']);
    expect(po.opcionesDelMenu(5)).toEqual(['Cambiar email', 'Cambiar contraseña', 'Activar cuenta', 'Eliminar definitivamente']);
    flush();
  }));

  it('"Desactivar cuenta" pide confirmación, pide el estado inactivo y avisa "Cuenta desactivada"', fakeAsync(() => {
    montar();
    po.elegirDelMenu(1, 'Desactivar cuenta');
    const confirmacion = po.confirmacion()!;
    expect(confirmacion.titulo).toBe('¿Desactivar la cuenta?');
    expect(confirmacion.confirmar.textContent!.trim()).toBe('Sí, desactivar');

    po.pulsar(confirmacion.confirmar);
    expect(estados).toEqual([['u-2', false]]);
    expect(po.filaOcupada(1)).toBeTrue();

    fuente.terminarBaja(true);
    po.asentar();
    flush();
    po.render();
    expect(po.avisos).toEqual([{ mensaje: 'Cuenta desactivada', accion: 'OK', duracion: 3000, clase: 'snackbar-success' }]);
    expect(po.filaOcupada(1)).toBeFalse();
    flush();
  }));

  it('"Activar cuenta" pide el estado activo y avisa "Cuenta activada"; cancelar no pide nada', fakeAsync(() => {
    montar();
    po.elegirDelMenu(5, 'Activar cuenta');
    expect(po.confirmacion()!.titulo).toBe('¿Activar la cuenta?');
    po.pulsar(po.confirmacion()!.cancelar);
    flush();
    expect(estados).toEqual([]);

    po.elegirDelMenu(5, 'Activar cuenta');
    po.pulsar(po.confirmacion()!.confirmar);
    fuente.terminarBaja(true);
    po.asentar();
    flush();
    expect(estados).toEqual([['u-6', true]]);
    expect(po.mensajesDeAviso()).toEqual(['Cuenta activada']);
    flush();
  }));

  it('"Inactivos" filtra y deja el chip "Cuenta: Inactivas"', fakeAsync(() => {
    montar();
    expect(po.tabs().map((t) => t.etiqueta)).toEqual(['Todos12', 'Activos10', 'Inactivos2']);
    po.elegirTab('Inactivos');
    expect(po.nombres('.cell-name__principal')).toEqual(['Fabián Ibarra', 'Inés López']);
    expect(po.chips()).toEqual(['Cuenta: Inactivas']);
    flush();
  }));

  it('el alta abre "Nuevo usuario"; al guardar vuelve a pedir la lista y avisa "Usuario creado"', fakeAsync(() => {
    montar();
    const dialogos = espiarDialogos();
    po.fixture.componentInstance.onCreate();
    po.asentar();
    expect(dialogos.abiertos.map((d) => (d.data as { titulo: string }).titulo)).toEqual(['Nuevo usuario']);

    dialogos.cerrar({ usuario: USUARIOS[0], desactivacionFallida: false });
    po.asentar();
    expect(fuente.cargas).toBe(2);
    expect(po.avisos).toEqual([{ mensaje: 'Usuario creado', accion: 'OK', duracion: 3000, clase: 'snackbar-success' }]);
    flush();
  }));

  it('si el alta no pudo desactivar la cuenta, avisa con una advertencia que queda 10 segundos', fakeAsync(() => {
    montar();
    const dialogos = espiarDialogos();
    po.fixture.componentInstance.onCreate();
    po.asentar();
    dialogos.cerrar({ usuario: USUARIOS[0], desactivacionFallida: true });
    po.asentar();
    expect(po.avisos).toEqual([{
      mensaje: 'Usuario creado, pero no se pudo desactivar la cuenta. Desactivala desde la lista.',
      accion: 'OK', duracion: 10000, clase: 'snackbar-warning',
    }]);
    flush();
  }));

  it('"Editar" abre "Editar usuario" y, al guardar, avisa "Usuario actualizado"', fakeAsync(() => {
    montar();
    const dialogos = espiarDialogos();
    po.accionPrincipal(0)!.click();
    po.asentar();
    expect(dialogos.abiertos.map((d) => (d.data as { titulo: string }).titulo)).toEqual(['Editar usuario']);

    dialogos.cerrar({ usuario: USUARIOS[0], desactivacionFallida: false });
    po.asentar();
    expect(po.mensajesDeAviso()).toEqual(['Usuario actualizado']);
    flush();
  }));

  it('"Cambiar email" abre su diálogo y, al guardar, avisa "Email actualizado"', fakeAsync(() => {
    montar();
    const dialogos = espiarDialogos();
    po.elegirDelMenu(1, 'Cambiar email');
    po.asentar();
    expect(dialogos.abiertos.map((d) => (d.data as { titulo: string }).titulo)).toEqual(['Cambiar email']);

    dialogos.cerrar(true);
    po.asentar();
    expect(po.avisos).toEqual([{ mensaje: 'Email actualizado', accion: 'OK', duracion: 3000, clase: 'snackbar-success' }]);
    flush();
  }));
});
