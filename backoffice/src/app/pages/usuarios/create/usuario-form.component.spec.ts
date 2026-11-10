import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, NEVER, of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthTokenService } from '@core/services/auth-token.service';
import { UserRole } from '@core/enums/user-role.enum';
import { UsuariosFacade, UsuarioVM } from '@features/usuarios';
import { RolVM } from '@features/roles';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { UsuarioFormComponent } from './usuario-form.component';

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

describe('UsuarioFormComponent — alta', () => {
  let fixture: ComponentFixture<UsuarioFormComponent>;
  let facade: jasmine.SpyObj<UsuariosFacade>;
  let router: jasmine.SpyObj<Router>;
  let snackBar: jasmine.SpyObj<MatSnackBar>;

  const form = (): DynamicFormComponent =>
    fixture.debugElement.query(By.directive(DynamicFormComponent)).componentInstance;
  const nombresDeCampos = (): string[] => fixture.componentInstance.fields.map((f) => f.name);

  async function crear(sesion: { rol: UserRole; organismoId: string | null }): Promise<void> {
    facade = jasmine.createSpyObj<UsuariosFacade>('UsuariosFacade', ['getFormData', 'create', 'setAccountStatus'], {
      edicionDisponible: false,
    });
    facade.getFormData.and.returnValue(of({
      organismos: [{ id: 'org-1', nombre: 'IPS' }],
      rolesAllowed: [ROL_GLOBAL, ROL_ORGANISMO],
      usuario: null,
    }));
    facade.create.and.returnValue(of(CREADO));
    facade.setAccountStatus.and.returnValue(of(void 0));
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [UsuarioFormComponent, NoopAnimationsModule],
      providers: [
        { provide: UsuariosFacade, useValue: facade },
        { provide: AuthTokenService, useValue: { getUserRole: () => sesion.rol, getUserOrganismoId: () => sesion.organismoId } },
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} } } },
        { provide: Router, useValue: router },
      ],
    })
      // `overrideProvider` y no `providers`: el componente importa `MatSnackBarModule`, que trae su
      // propio `MatSnackBar` y le ganaría al del TestBed.
      .overrideProvider(MatSnackBar, { useValue: snackBar })
      .compileComponents();

    fixture = TestBed.createComponent(UsuarioFormComponent);
    fixture.detectChanges();
    await fixture.whenStable(); // `cargar()` espera `getFormData`
    fixture.detectChanges();
    await fixture.whenStable(); // @defer de los selects
    fixture.detectChanges();
  }

  function elegirRol(id: string): void {
    form().form.get('rol')?.setValue(id);
    fixture.detectChanges();
  }

  it('las opciones de rol llevan el UUID del catálogo y "Organismo" arranca oculto', async () => {
    await crear({ rol: UserRole.SUPERADMIN, organismoId: null });

    expect(fixture.componentInstance.fields.find((f) => f.name === 'rol')?.options)
      .toEqual([{ id: 'uuid-global', name: 'ADMIN_BACKOFFICE' }, { id: 'uuid-organismo', name: 'AGENT' }]);
    expect(nombresDeCampos()).not.toContain('organismoId');
  });

  it('un rol de scope organismo pide organismo (obligatorio); uno global lo vuelve a ocultar', async () => {
    await crear({ rol: UserRole.SUPERADMIN, organismoId: null });

    elegirRol(ROL_ORGANISMO.id);
    expect(nombresDeCampos()).toContain('organismoId');
    expect(form().form.get('organismoId')?.hasError('required')).toBeTrue();

    elegirRol(ROL_GLOBAL.id);
    expect(nombresDeCampos()).not.toContain('organismoId');
    expect(form().form.contains('organismoId')).toBeFalse();
  });

  it('cambiar de rol no borra lo ya tipeado', async () => {
    await crear({ rol: UserRole.SUPERADMIN, organismoId: null });
    form().form.get('nombre')?.setValue('Ana');

    elegirRol(ROL_ORGANISMO.id);

    expect(form().form.get('nombre')?.value).toBe('Ana');
  });

  it('manda el organismo elegido con un rol de organismo y `null` con uno global', async () => {
    await crear({ rol: UserRole.SUPERADMIN, organismoId: null });
    const base = { nombre: 'Ana', apellido: 'Paz', email: 'ana@example.com', password: 'Clave1234', activo: true };

    await fixture.componentInstance.onSubmit({ ...base, rol: ROL_ORGANISMO.id, organismoId: 'org-1' });
    expect(facade.create.calls.mostRecent().args[0].organismoId).toBe('org-1');

    // Aunque el valor crudo trajera un organismo viejo, con un rol global no viaja.
    await fixture.componentInstance.onSubmit({ ...base, rol: ROL_GLOBAL.id, organismoId: 'org-1' });
    expect(facade.create.calls.mostRecent().args[0].organismoId).toBeNull();
    expect(facade.setAccountStatus).not.toHaveBeenCalled();
  });

  it('volver a un rol de organismo después de uno global conserva el organismo elegido', async () => {
    await crear({ rol: UserRole.SUPERADMIN, organismoId: null });

    elegirRol(ROL_ORGANISMO.id);
    form().form.get('organismoId')?.setValue('org-1');
    fixture.detectChanges();

    elegirRol(ROL_GLOBAL.id);
    expect(form().form.contains('organismoId')).toBeFalse();

    elegirRol(ROL_ORGANISMO.id);
    expect(form().form.get('organismoId')?.value).toBe('org-1');
    expect(form().form.get('organismoId')?.valid).toBeTrue();
  });

  it('"Activar la cuenta" en OFF desactiva la cuenta recién creada y vuelve a la lista', async () => {
    await crear({ rol: UserRole.SUPERADMIN, organismoId: null });

    await fixture.componentInstance.onSubmit({
      nombre: 'Ana', apellido: 'Paz', email: 'ana@example.com', password: 'Clave1234', rol: ROL_GLOBAL.id, activo: false,
    });

    expect(facade.setAccountStatus).toHaveBeenCalledOnceWith('u-9', false);
    expect(snackBar.open.calls.mostRecent().args[0]).toBe('Usuario creado');
    expect(router.navigate).toHaveBeenCalledOnceWith(['/dashboard/usuarios/lista']);
  });

  it('si el alta anda pero desactivar falla: avisa y vuelve a la lista, sin dejar el form para reintentar', async () => {
    await crear({ rol: UserRole.SUPERADMIN, organismoId: null });
    facade.setAccountStatus.and.returnValue(throwError(() => ({ error: { code: 5000, message: 'Error interno' } })));

    await fixture.componentInstance.onSubmit({
      nombre: 'Ana', apellido: 'Paz', email: 'ana@example.com', password: 'Clave1234', rol: ROL_GLOBAL.id, activo: false,
    });

    expect(facade.create).toHaveBeenCalledTimes(1);
    // No es un "no se pudo guardar": el usuario existe, y reintentar chocaría con su email (409 4002).
    expect(fixture.componentInstance.serverError).toBe('');
    const [mensaje, , opciones] = snackBar.open.calls.mostRecent().args;
    expect(mensaje).toBe('Usuario creado, pero no se pudo desactivar la cuenta. Desactivala desde la lista.');
    expect(opciones?.panelClass).toBe('snackbar-warning');
    expect(router.navigate).toHaveBeenCalledOnceWith(['/dashboard/usuarios/lista']);
    // `saving` sigue en true hasta navegar: el guard de cambios sin guardar no frena la salida.
    expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeFalse();
  });

  it('si falla el alta: el error queda en el form, no navega y no intenta desactivar', async () => {
    await crear({ rol: UserRole.SUPERADMIN, organismoId: null });
    facade.create.and.returnValue(throwError(() => ({ error: { code: 4002, message: 'El usuario ya está registrado' } })));

    await fixture.componentInstance.onSubmit({
      nombre: 'Ana', apellido: 'Paz', email: 'ana@example.com', password: 'Clave1234', rol: ROL_GLOBAL.id, activo: false,
    });

    expect(fixture.componentInstance.saving).toBeFalse();
    expect(fixture.componentInstance.serverError).not.toBe('');
    expect(form().form.get('email')?.hasError('server')).toBeTrue();
    expect(facade.setAccountStatus).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('si el alta completa sin responder (stream vacío) con la pantalla viva, el form no queda trabado', async () => {
    await crear({ rol: UserRole.SUPERADMIN, organismoId: null });
    facade.create.and.returnValue(EMPTY);

    await fixture.componentInstance.onSubmit({
      nombre: 'Ana', apellido: 'Paz', email: 'ana@example.com', password: 'Clave1234', rol: ROL_GLOBAL.id, activo: true,
    });

    expect(fixture.componentInstance.saving).toBeFalse();
    expect(fixture.componentInstance.serverError).toBe('No se pudo guardar el usuario. Intentá de nuevo.');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('si la pantalla se destruye con el alta en vuelo, no avisa ni navega', async () => {
    await crear({ rol: UserRole.SUPERADMIN, organismoId: null });
    facade.create.and.returnValue(NEVER);

    const guardado = fixture.componentInstance.onSubmit({
      nombre: 'Ana', apellido: 'Paz', email: 'ana@example.com', password: 'Clave1234', rol: ROL_GLOBAL.id, activo: true,
    });
    fixture.destroy();
    await guardado;

    expect(fixture.componentInstance.serverError).toBe('');
    expect(snackBar.open).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('quien no es superadmin ve su organismo elegido y bloqueado, y es el que se manda', async () => {
    await crear({ rol: UserRole.ADMIN_ORGANIZATION, organismoId: 'org-1' });

    elegirRol(ROL_ORGANISMO.id);
    const organismo = form().form.get('organismoId');
    expect(organismo?.value).toBe('org-1');
    expect(organismo?.disabled).toBeTrue();

    // Fallback: aunque el valor del form no lo traiga, con un rol de organismo viaja el de quien crea.
    const base = { nombre: 'Ana', apellido: 'Paz', email: 'ana@example.com', password: 'Clave1234', activo: true };
    await fixture.componentInstance.onSubmit({ ...base, rol: ROL_ORGANISMO.id });
    expect(facade.create.calls.mostRecent().args[0].organismoId).toBe('org-1');
  });

  it('el fallback al organismo propio NO aplica a un rol global', async () => {
    await crear({ rol: UserRole.ADMIN_ORGANIZATION, organismoId: 'org-1' });

    await fixture.componentInstance.onSubmit({
      nombre: 'Ana', apellido: 'Paz', email: 'ana@example.com', password: 'Clave1234', rol: ROL_GLOBAL.id, activo: true,
    });

    expect(facade.create.calls.mostRecent().args[0].organismoId).toBeNull();
  });
});

describe('UsuarioFormComponent — edición con una fuente que no la soporta', () => {
  it('avisa "edición no disponible" y no pide datos ni dibuja el formulario', async () => {
    const facade = jasmine.createSpyObj<UsuariosFacade>('UsuariosFacade', ['getFormData'], { edicionDisponible: false });
    await TestBed.configureTestingModule({
      imports: [UsuarioFormComponent, NoopAnimationsModule],
      providers: [
        { provide: UsuariosFacade, useValue: facade },
        { provide: AuthTokenService, useValue: { getUserRole: () => UserRole.SUPERADMIN, getUserOrganismoId: () => null } },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: 'u-1' } } } },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(UsuarioFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.edicionNoDisponible).toBeTrue();
    expect(facade.getFormData).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-dynamic-form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Edición no disponible');
  });
});
