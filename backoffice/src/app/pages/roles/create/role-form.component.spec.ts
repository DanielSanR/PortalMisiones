import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { RolesFacade, RolVM } from '@features/roles';
import { PermisoVM } from '@features/permisos';
import { DynamicFormComponent } from '../../../shared/components/dynamic-form/dynamic-form.component';
import { RoleFormComponent } from './role-form.component';

const PERMISOS: PermisoVM[] = [
  { id: 'p-1', codigo: 'READ_USER', descripcion: 'Ver usuarios' },
  { id: 'p-2', codigo: 'CREATE_USER', descripcion: 'Crear usuarios' },
  { id: 'p-3', codigo: 'READ_ROLE', descripcion: 'Ver roles' },
];

const ROL: RolVM = {
  id: 'r-1', codigo: 'EDITOR', descripcion: 'Editor', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
  asignablePorBackoffice: false, activo: false, permisos: [PERMISOS[0]],
};

describe('RoleFormComponent — edición', () => {
  let fixture: ComponentFixture<RoleFormComponent>;
  let facade: jasmine.SpyObj<RolesFacade>;

  const form = (): DynamicFormComponent =>
    fixture.debugElement.query(By.directive(DynamicFormComponent)).componentInstance;
  const submit = (): HTMLButtonElement => fixture.nativeElement.querySelector('button[type="submit"]');
  const chips = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('.perm-chip--toggle'));

  beforeEach(async () => {
    facade = jasmine.createSpyObj<RolesFacade>('RolesFacade', ['getFormData', 'update', 'create']);
    facade.getFormData.and.returnValue(of({ permisos: PERMISOS, rol: ROL }));
    facade.update.and.returnValue(of(ROL));

    await TestBed.configureTestingModule({
      imports: [RoleFormComponent, NoopAnimationsModule],
      providers: [
        { provide: RolesFacade, useValue: facade },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: 'r-1' } } } },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoleFormComponent);
    fixture.detectChanges();
    await fixture.whenStable(); // `cargar()` espera `getFormData`
    fixture.detectChanges();
    await fixture.whenStable(); // @defer del select y los toggles
    fixture.detectChanges();
  });

  it('precarga el rol (incluido su estado real) y arranca sin cambios', () => {
    expect(form().form.getRawValue()).toEqual({
      codigo: 'EDITOR', descripcion: 'Editor', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
      asignablePorBackoffice: false, active: false, permissionsIds: ['p-1'],
    });
    expect(submit().disabled).toBeTrue();
    expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeFalse();
  });

  it('la grilla marca con aria-pressed los permisos otorgados y cuenta por grupo y en total', () => {
    expect(chips().length).toBe(3);
    expect(chips().filter((c) => c.getAttribute('aria-pressed') === 'true').length).toBe(1);
    const contadores = Array.from(fixture.nativeElement.querySelectorAll('.perm-group__count'))
      .map((e) => (e as HTMLElement).textContent?.trim());
    expect(contadores).toContain('1 / 2');
    expect(contadores).toContain('0 / 1');
    expect(fixture.nativeElement.querySelector('.permiso-picker__hint').textContent).toContain('1 seleccionados');
  });

  it('otorgar un permiso habilita "Guardar" y lo ve el guard de cambios sin guardar', () => {
    const sinOtorgar = chips().find((c) => c.getAttribute('aria-pressed') === 'false')!;
    sinOtorgar.click();
    fixture.detectChanges();

    expect(sinOtorgar.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('.permiso-picker__hint').textContent).toContain('2 seleccionados');
    // El total es la única región viva de la grilla: un anuncio por toggle, sin los contadores por grupo.
    const vivas = fixture.nativeElement.querySelectorAll('.permiso-picker [role="status"], .permiso-picker [aria-live]');
    expect(vivas.length).toBe(1);
    expect(vivas[0].textContent.trim()).toBe('2 seleccionados');
    expect(submit().disabled).toBeFalse();
    expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeTrue();
  });

  it('si el guardado completa sin responder (stream vacío), libera el formulario con un error', async () => {
    facade.update.and.returnValue(EMPTY);
    chips().find((c) => c.getAttribute('aria-pressed') === 'false')!.click();
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit(form().form.getRawValue());

    expect(fixture.componentInstance.saving).toBeFalse();
    expect(fixture.componentInstance.serverError).toBe('No se pudo guardar el rol. Intentá de nuevo.');
  });

  it('guarda los permisos de la grilla junto con el resto del formulario', () => {
    chips().filter((c) => c.getAttribute('aria-pressed') === 'false').forEach((c) => c.click());
    fixture.detectChanges();
    submit().click();

    const [id, enviado] = facade.update.calls.mostRecent().args;
    expect(id).toBe('r-1');
    expect(enviado.active).toBeFalse();
    expect([...enviado.permissionsIds].sort()).toEqual(['p-1', 'p-2', 'p-3']);
  });
});
