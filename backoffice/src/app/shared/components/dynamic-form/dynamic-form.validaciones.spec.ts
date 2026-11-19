import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FieldConfig } from '../../../core/models/field.interface';
import { DynamicFormComponent } from './dynamic-form.component';

const CAMPOS: FieldConfig[] = [
  { name: 'nombre', label: 'Nombre', type: 'text', validations: { required: true, minLength: 3 } },
  { name: 'clave', label: 'Clave', type: 'password', validations: { required: true, minLength: 3 } },
  {
    name: 'codigo',
    label: 'Código',
    type: 'text',
    mono: true,
    validations: { validar: (valor) => (valor.includes(' ') ? 'Sin espacios' : null) },
  },
];

describe('DynamicFormComponent — validaciones', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;
  let component: DynamicFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('fields', CAMPOS);
    fixture.detectChanges();
  });

  it('en texto libre, solo espacios no cuenta como completado', () => {
    const nombre = component.form.get('nombre')!;
    nombre.setValue('   ');
    expect(nombre.hasError('required')).toBeTrue();
  });

  it('en texto libre, el mínimo se mide sobre el valor recortado', () => {
    const nombre = component.form.get('nombre')!;
    nombre.setValue('a   ');
    expect(nombre.getError('minlength')).toEqual({ requiredLength: 3, actualLength: 1 });

    nombre.setValue(' abc ');
    expect(nombre.valid).toBeTrue();
  });

  it('una contraseña se valida tal cual: los espacios son caracteres', () => {
    const clave = component.form.get('clave')!;
    clave.setValue('   ');
    expect(clave.valid).toBeTrue();
  });

  it('`validar` marca el campo con su propio mensaje', () => {
    const codigo = component.form.get('codigo')!;
    codigo.setValue('A B');
    expect(codigo.getError('personalizado')).toBe('Sin espacios');

    codigo.setValue('A_B');
    expect(codigo.valid).toBeTrue();
  });

  it('un campo `mono` se escribe en monoespaciada', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input#codigo');
    expect(input.classList).toContain('form-field__mono');
    expect(fixture.nativeElement.querySelector('input#nombre').classList).not.toContain('form-field__mono');
  });
});

/**
 * Un campo `readonly` no es editable: si su valor llega vacío, un `required` bloquearía el envío sin error
 * visible (la vista de solo lectura no tiene `mat-error`) ni forma de corregirlo.
 */
describe('DynamicFormComponent — un campo de solo lectura no valida', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;
  let component: DynamicFormComponent;

  const campos = (readonly: boolean): FieldConfig[] => [
    { name: 'nombre', label: 'Nombre', type: 'text', validations: { required: true } },
    {
      name: 'organismoId', label: 'Organismo', type: 'select', readonly, hint: 'Tu cuenta pertenece a este organismo.',
      options: [{ id: 'org-1', name: 'IPS' }], optionsLoaded: true,
      validations: { required: true },
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('fields', campos(true));
    fixture.detectChanges();
  });

  it('obligatorio y vacío: no invalida el formulario ni bloquea el envío', () => {
    const enviado = jasmine.createSpy('formSubmit');
    component.formSubmit.subscribe(enviado);
    component.form.get('nombre')!.setValue('Ana');

    expect(component.form.get('organismoId')!.value).toBe('');
    expect(component.form.get('organismoId')!.valid).toBeTrue();
    component.submit();

    expect(enviado).toHaveBeenCalledOnceWith({ nombre: 'Ana', organismoId: '' });
    expect(component.invalidFieldMessages()).toEqual([]);
  });

  it('los demás campos siguen validando', () => {
    const enviado = jasmine.createSpy('formSubmit');
    component.formSubmit.subscribe(enviado);

    component.submit();

    expect(enviado).not.toHaveBeenCalled();
    expect(component.form.get('nombre')!.hasError('required')).toBeTrue();
  });

  it('si deja de ser de solo lectura, sus validaciones vuelven a regir (y al revés)', () => {
    fixture.componentRef.setInput('fields', campos(false));
    fixture.detectChanges();
    expect(component.form.get('organismoId')!.hasError('required')).toBeTrue();

    fixture.componentRef.setInput('fields', campos(true));
    fixture.detectChanges();
    expect(component.form.get('organismoId')!.valid).toBeTrue();
  });
});
