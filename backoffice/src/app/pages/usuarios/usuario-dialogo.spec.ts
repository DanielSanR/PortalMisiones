import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NEVER, Subject, firstValueFrom, of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { UserRole } from '@core/enums/user-role.enum';
import { UsuariosFacade, UsuarioOrganismoFijo, UsuarioVM } from '@features/usuarios';
import { RolVM } from '@features/roles';
import { DynamicFormComponent } from '@shared/components/dynamic-form/dynamic-form.component';
import { FormDialogComponent, FormDialogData } from '@shared/components/form-dialog';
import { SesionDeUsuarioDialogo, UsuarioGuardado, dialogoDeUsuario } from './usuario-dialogo';
import {
  MENSAJE_ALTA_DENEGADA, MENSAJE_EDICION_DENEGADA, MENSAJE_ORGANISMO_REQUERIDO, MENSAJE_ROL_RESTRINGIDO,
  MENSAJE_SIN_PERMISO_DE_ALTA,
} from './usuario-save-error';

const rol = (id: string, codigo: string, scopeTipo: RolVM['scopeTipo']): RolVM => ({
  id, codigo, descripcion: codigo, scopeTipo, asignablePorOrgAdmin: false, asignablePorBackoffice: false,
  activo: true, permisos: [],
});

/** Los ids son UUIDs en el backend: a propósito NO coinciden con ningún código de `UserRole`. */
const ROL_GLOBAL = rol('uuid-global', 'ADMIN_BACKOFFICE', 'global');
const ROL_ORGANISMO = rol('uuid-organismo', 'AGENT', 'organismo');

const CREADO: UsuarioVM = {
  id: 'u-9', nombre: 'Ana', apellido: 'Paz', email: 'ana@example.com', rol: null, organismoId: null, activo: true,
};

const EXISTENTE: UsuarioVM = {
  id: 'u-1', nombre: 'Martín', apellido: 'Fernández', email: 'martin@example.com',
  rol: UserRole.AGENT, organismoId: 'org-1', activo: true,
};

const BASE = { nombre: 'Ana', apellido: 'Paz', email: 'ana@example.com', password: 'Clave1234', activo: true };

const SUPERADMIN: SesionDeUsuarioDialogo = { esSuperAdmin: true };
const ADMIN_DE_ORGANISMO: SesionDeUsuarioDialogo = { esSuperAdmin: false };
/** Lo que entrega el facade con una sesión de organismo (`/api/auth/me`, G-2): la única opción, sin catálogo. */
const ORGANISMO_FIJO: UsuarioOrganismoFijo = {
  id: 'org-1', nombre: 'Instituto de Previsión Social (IPS)',
  motivo: 'Tu cuenta pertenece a Instituto de Previsión Social (IPS): los usuarios que crees quedan en ese organismo.',
};

describe('dialogoDeUsuario', () => {
  let facade: jasmine.SpyObj<UsuariosFacade>;
  /** Sesión con la que se arma el facade de la prueba en curso. */
  let sesionActual: SesionDeUsuarioDialogo = SUPERADMIN;

  beforeEach(() => { sesionActual = SUPERADMIN; });

  function crearFacade(usuario: UsuarioVM | null = null, edicionDisponible = true): void {
    facade = jasmine.createSpyObj<UsuariosFacade>('UsuariosFacade', ['getFormData', 'create', 'update', 'setAccountStatus'], {
      edicionDisponible,
    });
    // Con una sesión de organismo el facade entrega solo esa opción (no pide `/api/organism`).
    const organismoFijo = sesionActual === ADMIN_DE_ORGANISMO ? ORGANISMO_FIJO : null;
    facade.getFormData.and.returnValue(of({
      organismos: organismoFijo ? [{ id: organismoFijo.id, nombre: organismoFijo.nombre }] : [{ id: 'org-1', nombre: 'IPS' }],
      organismoFijo,
      rolesAllowed: [ROL_GLOBAL, ROL_ORGANISMO],
      usuario,
    }));
    facade.create.and.returnValue(of(CREADO));
    facade.update.and.returnValue(of({ ...EXISTENTE, nombre: 'Martín R.' }));
    facade.setAccountStatus.and.returnValue(of(void 0));
  }

  /** Config con el facade ya cableado (y la carga hecha, que es lo que arma el estado interno). */
  async function configurar(
    usuario: UsuarioVM | null = null, sesion: SesionDeUsuarioDialogo = SUPERADMIN,
  ): Promise<FormDialogData<UsuarioGuardado>> {
    sesionActual = sesion;
    crearFacade(usuario);
    const data = dialogoDeUsuario(facade, usuario?.id ?? null, sesion);
    await firstValueFrom(data.cargar());
    return data;
  }

  describe('textos y modo', () => {
    it('alta: "Nuevo usuario", "Crear usuario", sin exigir cambios y con el texto de descarte de un alta', () => {
      crearFacade();
      const data = dialogoDeUsuario(facade, null, SUPERADMIN);

      expect(data.titulo).toBe('Nuevo usuario');
      expect(data.textoGuardar).toBe('Crear usuario');
      expect(data.requiereCambios).toBeFalse();
      expect(data.mensajeDescartar).toContain('no se crea el usuario');
      expect(data.formId).toBe('usuario-dialog-form');
    });

    it('edición: "Editar usuario", "Guardar cambios" y exige cambios', () => {
      crearFacade(EXISTENTE);
      const data = dialogoDeUsuario(facade, 'u-1', SUPERADMIN);

      expect(data.titulo).toBe('Editar usuario');
      expect(data.textoGuardar).toBe('Guardar cambios');
      expect(data.requiereCambios).toBeTrue();
    });
  });

  describe('carga', () => {
    it('alta: las opciones de rol llevan el UUID del catálogo y "Organismo" arranca oculto', async () => {
      const data = await configurar();
      const { fields } = await firstValueFrom(data.cargar());

      expect(fields.find((f) => f.name === 'rol')?.options)
        .toEqual([{ id: 'uuid-global', name: 'ADMIN_BACKOFFICE' }, { id: 'uuid-organismo', name: 'AGENT' }]);
      expect(fields.map((f) => f.name)).not.toContain('organismoId');
    });

    it('edición: pide al usuario por id, sin contraseña ni estado, con el email fijo y precargado', async () => {
      crearFacade(EXISTENTE);
      const data = dialogoDeUsuario(facade, 'u-1', SUPERADMIN);

      const { fields, initialData } = await firstValueFrom(data.cargar());

      expect(facade.getFormData).toHaveBeenCalledOnceWith('u-1');
      const nombres = fields.map((f) => f.name);
      expect(nombres).not.toContain('password');
      expect(nombres).not.toContain('activo');
      expect(fields.find((f) => f.name === 'email')?.readonly).toBeTrue();
      expect(initialData).toEqual({ nombre: 'Martín', apellido: 'Fernández', email: 'martin@example.com', rol: UserRole.AGENT });
      // Rol de organismo (AGENT está en el catálogo con scope organismo): "Organismo" ya viene, con su valor.
      expect(fields.find((f) => f.name === 'organismoId')?.value).toBe('org-1');
    });

    it('edición con una fuente que no la soporta: falla como "Edición no disponible" (solo Cerrar) y no pide datos', async () => {
      crearFacade(EXISTENTE, false);
      const data = dialogoDeUsuario(facade, 'u-1', SUPERADMIN);

      const err = await firstValueFrom(data.cargar()).catch((e: unknown) => e);

      expect(facade.getFormData).not.toHaveBeenCalled();
      expect(data.errorDeCarga!(err)).toEqual(jasmine.objectContaining({ titulo: 'Edición no disponible', reintentable: false }));
    });

    it('un fallo de carga se cuenta con el motivo del backend y se puede reintentar', () => {
      crearFacade();
      const data = dialogoDeUsuario(facade, null, SUPERADMIN);

      const error = data.errorDeCarga!({ error: { code: 5000, message: 'Sin conexión con roles' } });

      expect(error).toEqual(jasmine.objectContaining({
        titulo: 'No pudimos cargar el formulario', texto: 'Sin conexión con roles', reintentable: true,
      }));
      expect(data.errorDeCarga!(new Error('x')).texto).toContain('Revisá tu conexión');
    });
  });

  describe('campos según el rol (alCambiar)', () => {
    it('un rol de organismo agrega "Organismo"; uno global lo quita; el mismo rol no recrea los campos', async () => {
      const data = await configurar();

      expect(data.alCambiar!({ rol: '' })).toBeNull();

      const conOrganismo = data.alCambiar!({ rol: ROL_ORGANISMO.id });
      expect(conOrganismo?.map((f) => f.name)).toContain('organismoId');
      expect(data.alCambiar!({ rol: ROL_ORGANISMO.id })).toBeNull();

      const global = data.alCambiar!({ rol: ROL_GLOBAL.id });
      expect(global?.map((f) => f.name)).not.toContain('organismoId');
    });

    it('volver a un rol de organismo después de uno global conserva el organismo elegido', async () => {
      const data = await configurar();

      data.alCambiar!({ rol: ROL_ORGANISMO.id });
      data.alCambiar!({ rol: ROL_ORGANISMO.id, organismoId: 'org-1' });
      data.alCambiar!({ rol: ROL_GLOBAL.id });
      const vuelta = data.alCambiar!({ rol: ROL_ORGANISMO.id });

      expect(vuelta?.find((f) => f.name === 'organismoId')?.value).toBe('org-1');
    });

    it('con una sesión de organismo, "Organismo" viene con el suyo, de solo lectura y con el motivo en el hint', async () => {
      const data = await configurar(null, ADMIN_DE_ORGANISMO);

      const campo = data.alCambiar!({ rol: ROL_ORGANISMO.id })?.find((f) => f.name === 'organismoId');

      expect(campo?.value).toBe('org-1');
      // Solo lectura, no deshabilitado: sigue en el orden de tabulación y el motivo se puede leer.
      expect(campo?.readonly).toBeTrue();
      expect(campo?.disabled).toBeFalsy();
      expect(campo?.hint).toContain('Tu cuenta pertenece a Instituto de Previsión Social (IPS)');
      // La opción sale de la sesión (nombre y sigla), no del catálogo `/api/organism`.
      expect(campo?.options).toEqual([{ id: 'org-1', name: 'Instituto de Previsión Social (IPS)' }]);
    });

    it('con una sesión global (o un backend sin G-2) el organismo se elige: sin bloqueo ni hint de sesión', async () => {
      const data = await configurar();

      const campo = data.alCambiar!({ rol: ROL_ORGANISMO.id })?.find((f) => f.name === 'organismoId');

      expect(campo?.disabled).toBeFalsy();
      expect(campo?.readonly).toBeFalsy();
      expect(campo?.hint).not.toContain('Tu cuenta pertenece');
      expect(campo?.options).toEqual([{ id: 'org-1', name: 'IPS' }]);
    });

    it('en edición no se impone el organismo de la sesión: manda el del usuario editado', async () => {
      const data = await configurar({ ...EXISTENTE, organismoId: 'org-7' }, ADMIN_DE_ORGANISMO);
      const { fields } = await firstValueFrom(data.cargar());

      const campo = fields.find((f) => f.name === 'organismoId');
      expect(campo?.value).toBe('org-7');
      expect(campo?.disabled).toBeFalsy();
      expect(campo?.readonly).toBeFalsy();
    });
  });

  describe('guardar: alta', () => {
    it('manda el organismo elegido con un rol de organismo y no desactiva la cuenta si queda activa', async () => {
      const data = await configurar();

      await firstValueFrom(data.guardar({ ...BASE, rol: ROL_ORGANISMO.id, organismoId: 'org-1' }));

      expect(facade.create.calls.mostRecent().args[0].organismoId).toBe('org-1');
      expect(facade.setAccountStatus).not.toHaveBeenCalled();
    });

    it('con un rol global manda `null`, aunque el valor crudo trajera un organismo viejo', async () => {
      const data = await configurar();

      await firstValueFrom(data.guardar({ ...BASE, rol: ROL_GLOBAL.id, organismoId: 'org-1' }));

      expect(facade.create.calls.mostRecent().args[0].organismoId).toBeNull();
    });

    it('devuelve el usuario creado', async () => {
      const data = await configurar();

      expect(await firstValueFrom(data.guardar({ ...BASE, rol: ROL_GLOBAL.id })))
        .toEqual({ usuario: CREADO, desactivacionFallida: false });
    });

    it('"Activar la cuenta" en OFF desactiva la cuenta recién creada', async () => {
      const data = await configurar();

      const guardado = await firstValueFrom(data.guardar({ ...BASE, rol: ROL_GLOBAL.id, activo: false }));

      expect(facade.setAccountStatus).toHaveBeenCalledOnceWith('u-9', false);
      expect(guardado).toEqual({ usuario: CREADO, desactivacionFallida: false });
    });

    it('si el alta anda pero desactivar falla: devuelve el aviso, sin error de guardado (el usuario ya existe)', async () => {
      const data = await configurar();
      facade.setAccountStatus.and.returnValue(throwError(() => ({ error: { code: 5000, message: 'Error interno' } })));

      const guardado = await firstValueFrom(data.guardar({ ...BASE, rol: ROL_GLOBAL.id, activo: false }));

      expect(facade.create).toHaveBeenCalledTimes(1);
      expect(guardado).toEqual({ usuario: CREADO, desactivacionFallida: true });
    });

    it('si falla el alta: el error se propaga y no intenta desactivar', async () => {
      const data = await configurar();
      facade.create.and.returnValue(throwError(() => ({ error: { code: 4002 } })));

      await expectAsync(firstValueFrom(data.guardar({ ...BASE, rol: ROL_GLOBAL.id, activo: false }))).toBeRejected();

      expect(facade.setAccountStatus).not.toHaveBeenCalled();
    });

    it('sesión de organismo: con un rol de organismo viaja el suyo (aunque el form trajera otro); con uno global, `null`', async () => {
      const data = await configurar(null, ADMIN_DE_ORGANISMO);

      await firstValueFrom(data.guardar({ ...BASE, rol: ROL_ORGANISMO.id }));
      expect(facade.create.calls.mostRecent().args[0].organismoId).toBe('org-1');

      await firstValueFrom(data.guardar({ ...BASE, rol: ROL_ORGANISMO.id, organismoId: 'org-ajeno' }));
      expect(facade.create.calls.mostRecent().args[0].organismoId).toBe('org-1');

      await firstValueFrom(data.guardar({ ...BASE, rol: ROL_GLOBAL.id }));
      expect(facade.create.calls.mostRecent().args[0].organismoId).toBeNull();
    });
  });

  describe('guardar: edición', () => {
    it('guarda con el id del usuario y devuelve el actualizado', async () => {
      const data = await configurar(EXISTENTE);

      const guardado = await firstValueFrom(data.guardar({
        nombre: 'Martín R.', apellido: 'Fernández', email: 'martin@example.com', rol: UserRole.AGENT, organismoId: 'org-1',
      }));

      expect(facade.update).toHaveBeenCalledOnceWith('u-1', jasmine.objectContaining({ nombre: 'Martín R.' }));
      expect(facade.create).not.toHaveBeenCalled();
      expect(guardado).toEqual({ usuario: { ...EXISTENTE, nombre: 'Martín R.' }, desactivacionFallida: false });
    });
  });

  describe('errorDeGuardado', () => {
    it('el email repetido (409 4002) se marca en el campo y el banner remite a él', async () => {
      const data = await configurar();
      const control = { setErrors: jasmine.createSpy('setErrors'), markAsTouched: jasmine.createSpy('markAsTouched') };
      const form = { get: (nombre: string) => (nombre === 'email' ? control : null) };

      const texto = data.errorDeGuardado!({ error: { code: 4002, message: 'ya está' } }, form as never);

      expect(control.setErrors).toHaveBeenCalledWith({ server: 'Ya existe un usuario con ese email' });
      expect(texto).toBe('Revisá el campo marcado.');
    });

    /**
     * 403 `4029` del alta (`UserService.createUser`, backend `586b670`): el `message` es siempre el genérico
     * y el caso viaja en `details`. Solo el del rol se arregla eligiendo otro rol.
     */
    describe('403 4029 del alta, según `details`', () => {
      const MESSAGE = 'El usuario no tiene permisos para realizar esta acción.';
      const denegado = (details: string | null) => ({ status: 403, error: { code: 4029, message: MESSAGE, details } });

      /** Form con los controles "Rol" y "Organismo" espiados: ningún caso que no sea el del rol los toca. */
      function formEspiado() {
        const control = () => ({ setErrors: jasmine.createSpy('setErrors'), markAsTouched: jasmine.createSpy('markAsTouched') });
        const controles: Record<string, ReturnType<typeof control>> = { rol: control(), organismoId: control() };
        return { controles, form: { get: (nombre: string) => controles[nombre] ?? null } };
      }

      it('rol no asignable por quien crea: se marca en "Rol" con "Elegí otro"', async () => {
        const data = await configurar();
        const { controles, form } = formEspiado();
        const err = denegado('El rol objetivo no puede ser creado por el rol autenticado.');

        expect(data.errorDeGuardado!(err, form as never)).toBe('Revisá el campo marcado.');
        expect(controles['rol'].setErrors).toHaveBeenCalledOnceWith({ server: MENSAJE_ROL_RESTRINGIDO });
        expect(controles['rol'].markAsTouched).toHaveBeenCalled();
        expect(MENSAJE_ROL_RESTRINGIDO).toContain('Elegí otro');
        // Sin el control (form todavía sin armar) el texto propio va al banner: nunca el `message` crudo.
        expect(data.errorDeGuardado!(err, undefined)).toBe(MENSAJE_ROL_RESTRINGIDO);
      });

      it('rol no asignable, con la clave sin traducir en `details`: también se marca en "Rol"', async () => {
        const data = await configurar();
        const { controles, form } = formEspiado();

        data.errorDeGuardado!(denegado('error.user.creation.role.restricted'), form as never);

        expect(controles['rol'].setErrors).toHaveBeenCalledOnceWith({ server: MENSAJE_ROL_RESTRINGIDO });
      });

      const AL_BANNER: { caso: string; details: string | null; mensaje: string }[] = [
        {
          caso: 'falta el organismo (admin de organismo sin organismo, o rol de organismo sin `organizationId`)',
          details: 'El administrador de organización debe pertenecer a una organización.',
          mensaje: MENSAJE_ORGANISMO_REQUERIDO,
        },
        {
          caso: 'el rol de quien crea no da de alta usuarios',
          details: 'El rol autenticado no tiene permisos para crear usuarios.',
          mensaje: MENSAJE_SIN_PERMISO_DE_ALTA,
        },
        { caso: 'sin `details` (sin asignación de rol vigente)', details: null, mensaje: MENSAJE_ALTA_DENEGADA },
        { caso: 'con un `details` que no se reconoce', details: 'Texto nuevo del backend.', mensaje: MENSAJE_ALTA_DENEGADA },
      ];

      AL_BANNER.forEach(({ caso, details, mensaje }) => {
        it(`${caso}: va al banner con texto propio, sin marcar "Rol" ni sugerir otro rol`, async () => {
          const data = await configurar();
          const { controles, form } = formEspiado();

          const texto = data.errorDeGuardado!(denegado(details), form as never);

          expect(texto).toBe(mensaje);
          expect(texto).not.toContain('Elegí otro');
          expect(texto).not.toContain(MESSAGE);
          if (details) expect(texto).not.toContain(details);
          expect(controles['rol'].setErrors).not.toHaveBeenCalled();
          expect(controles['organismoId'].setErrors).not.toHaveBeenCalled();
        });
      });
    });

    /**
     * `UserService.forbiddenUserManagement()` rechaza la gestión de una cuenta existente con el `details` del
     * alta ("…no tiene permisos para crear usuarios"): en edición no se puede leer como "no podés crear".
     */
    describe('403 4029 en edición', () => {
      const MESSAGE = 'El usuario no tiene permisos para realizar esta acción.';
      const DETALLES: (string | null)[] = [
        'El rol autenticado no tiene permisos para crear usuarios.',
        'error.user.creation.permission.denied',
        'El rol objetivo no puede ser creado por el rol autenticado.',
        'El administrador de organización debe pertenecer a una organización.',
        null,
      ];

      DETALLES.forEach((details) => {
        it(`con details "${details}": habla de modificar, nunca de crear, y no marca ningún campo`, async () => {
          const data = await configurar(EXISTENTE);
          const control = { setErrors: jasmine.createSpy('setErrors'), markAsTouched: jasmine.createSpy('markAsTouched') };
          const form = { get: () => control };

          const texto = data.errorDeGuardado!({ status: 403, error: { code: 4029, message: MESSAGE, details } }, form as never);

          expect(texto).toBe(MENSAJE_EDICION_DENEGADA);
          expect(texto).toContain('modificar este usuario');
          expect(texto.toLowerCase()).not.toContain('crear');
          expect(texto).not.toContain(MESSAGE);
          expect(control.setErrors).not.toHaveBeenCalled();
        });
      });

      it('el email repetido (409 4002) se sigue marcando en su campo', async () => {
        const data = await configurar(EXISTENTE);
        const control = { setErrors: jasmine.createSpy('setErrors'), markAsTouched: jasmine.createSpy('markAsTouched') };

        data.errorDeGuardado!({ error: { code: 4002, message: 'ya está' } }, { get: () => control } as never);

        expect(control.setErrors).toHaveBeenCalledWith({ server: 'Ya existe un usuario con ese email' });
      });
    });

    it('otro rechazo muestra el mensaje del backend, o uno genérico si no hay', async () => {
      const data = await configurar();

      expect(data.errorDeGuardado!({ error: { code: 5000, message: 'Roto' } }, undefined)).toBe('Roto');
      expect(data.errorDeGuardado!(new Error('x'), undefined)).toBe('No se pudo guardar el usuario. Intentá de nuevo.');
    });
  });

  /**
   * Integración con el marco: lo que depende de los controles reales del formulario (que "Organismo"
   * nazca obligatorio, que cambiar de rol no borre lo tipeado, el nombre del email fijo en edición).
   */
  describe('dentro de FormDialogComponent', () => {
    let fixture: ComponentFixture<FormDialogComponent>;
    let matDialog: jasmine.SpyObj<MatDialog>;
    let close: jasmine.Spy;

    const form = (): DynamicFormComponent =>
      fixture.debugElement.query(By.directive(DynamicFormComponent)).componentInstance;

    async function abrir(usuario: UsuarioVM | null = null, sesion: SesionDeUsuarioDialogo = SUPERADMIN): Promise<void> {
      sesionActual = sesion;
      crearFacade(usuario);
      close = jasmine.createSpy('close');
      matDialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
      matDialog.open.and.returnValue({ afterClosed: () => of(true) } as never);
      const data = dialogoDeUsuario(facade, usuario?.id ?? null, sesion);

      await TestBed.configureTestingModule({
        imports: [FormDialogComponent, NoopAnimationsModule],
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: data },
          {
            provide: MatDialogRef,
            useValue: { close, disableClose: false, backdropClick: () => new Subject<MouseEvent>(), keydownEvents: () => new Subject<KeyboardEvent>() },
          },
        ],
      })
        .overrideProvider(MatDialog, { useValue: matDialog })
        .compileComponents();

      fixture = TestBed.createComponent(FormDialogComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    function elegirRol(id: string): void {
      form().form.get('rol')?.setValue(id);
      fixture.detectChanges();
    }

    it('un rol de organismo pide organismo (obligatorio); uno global lo vuelve a ocultar', async () => {
      await abrir();

      elegirRol(ROL_ORGANISMO.id);
      expect(form().form.get('organismoId')?.hasError('required')).toBeTrue();

      elegirRol(ROL_GLOBAL.id);
      expect(form().form.contains('organismoId')).toBeFalse();
    });

    it('cambiar de rol no borra lo ya tipeado', async () => {
      await abrir();
      form().form.get('nombre')?.setValue('Ana');

      elegirRol(ROL_ORGANISMO.id);

      expect(form().form.get('nombre')?.value).toBe('Ana');
    });

    it('volver a un rol de organismo después de uno global conserva el organismo elegido', async () => {
      await abrir();

      elegirRol(ROL_ORGANISMO.id);
      form().form.get('organismoId')?.setValue('org-1');
      fixture.detectChanges();
      elegirRol(ROL_GLOBAL.id);
      elegirRol(ROL_ORGANISMO.id);

      expect(form().form.get('organismoId')?.value).toBe('org-1');
      expect(form().form.get('organismoId')?.valid).toBeTrue();
    });

    it('con una sesión de organismo ve su organismo como dato de solo lectura enfocable, con el motivo asociado', async () => {
      await abrir(null, ADMIN_DE_ORGANISMO);

      elegirRol(ROL_ORGANISMO.id);
      await fixture.whenStable();
      fixture.detectChanges();

      // El control sigue habilitado (el id viaja en el valor del form) y el form no quedó dirty por esto.
      expect(form().form.get('organismoId')?.value).toBe('org-1');
      expect(form().form.get('organismoId')?.enabled).toBeTrue();
      expect(form().form.get('organismoId')?.valid).toBeTrue();

      const input: HTMLInputElement = fixture.nativeElement.querySelector('input#organismoId');
      expect(input.readOnly).toBeTrue();
      expect(input.disabled).toBeFalse();
      expect(input.value).toBe('Instituto de Previsión Social (IPS)');
      expect(fixture.nativeElement.querySelector('mat-select#organismoId')).toBeNull();
      const descripcion = (input.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)
        .map((id) => (fixture.nativeElement as HTMLElement).querySelector(`[id="${id}"]`)?.textContent ?? '').join(' ');
      expect(descripcion).toContain('Tu cuenta pertenece a Instituto de Previsión Social (IPS)');
    });

    it('edición: precarga al usuario y deja el email fijo, con "Guardar cambios" bloqueado', async () => {
      await abrir(EXISTENTE);

      expect(fixture.nativeElement.querySelector('h2[mat-dialog-title]').textContent).toContain('Editar usuario');
      expect(form().form.get('nombre')?.value).toBe('Martín');
      const email = fixture.nativeElement.querySelector('input[readonly]') as HTMLInputElement | null;
      expect(form().form.get('email')?.enabled).toBeTrue();
      expect(email?.value).toBe('martin@example.com');
      expect(fixture.nativeElement.querySelector('.dialogo-formulario__pie button:last-child').getAttribute('aria-disabled')).toBe('true');
    });

    it('edición no disponible: avisa y no dibuja el formulario', async () => {
      crearFacade(EXISTENTE, false);
      const data = dialogoDeUsuario(facade, 'u-1', SUPERADMIN);
      await TestBed.configureTestingModule({
        imports: [FormDialogComponent, NoopAnimationsModule],
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: data },
          { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close'), disableClose: false, backdropClick: () => NEVER, keydownEvents: () => NEVER } },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(FormDialogComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-dynamic-form')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Edición no disponible');
      expect(fixture.nativeElement.textContent).not.toContain('Reintentar');
    });
  });
});
