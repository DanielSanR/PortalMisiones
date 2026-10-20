import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FieldConfig } from '../../../core/models/field.interface';
import { DynamicFormComponent } from './dynamic-form.component';
import { getFormConfig, updateFormConfigOptions } from './dynamic-form.config';

/**
 * B-2: las pantallas cargan los catálogos de los selects después del primer render
 * (`updateFormConfigOptions` → `fields` nuevo). Eso no puede borrar lo ya tipeado.
 */
describe('DynamicFormComponent — cambio de fields después del primer render', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;
  let component: DynamicFormComponent;
  let config = getFormConfig('CATEGORIA');

  function tipear(nombre: string, valor: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(`input#${nombre}`);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function cargarOpcionesDePadre(): void {
    config = updateFormConfigOptions(config, 'parentId', [
      { id: '', name: '— Ninguno —' },
      { id: 'cat-1', name: 'Automotor' },
    ]);
    fixture.componentRef.setInput('fields', config.fields as FieldConfig[]);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    config = getFormConfig('CATEGORIA');
    await TestBed.configureTestingModule({
      imports: [DynamicFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('fields', config.fields as FieldConfig[]);
    fixture.detectChanges();
  });

  it('conserva lo tipeado y el estado dirty/touched al llegar las opciones', () => {
    const formAntes = component.form;
    tipear('nombre', 'Transporte');

    cargarOpcionesDePadre();

    expect(component.form).toBe(formAntes);
    expect(component.form.get('nombre')?.value).toBe('Transporte');
    expect(component.form.get('nombre')?.dirty).toBeTrue();
    expect(component.form.get('nombre')?.touched).toBeTrue();
    expect(component.form.dirty).toBeTrue();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input#nombre');
    expect(input.value).toBe('Transporte');
  });

  it('cargar opciones en un form intacto no lo marca dirty', () => {
    cargarOpcionesDePadre();

    expect(component.form.pristine).toBeTrue();
    expect(component.fields.find((f) => f.name === 'parentId')?.options?.length).toBe(2);
  });

  it('edición: initialData junto con las opciones precarga y deja el form pristine', () => {
    config = updateFormConfigOptions(config, 'parentId', [{ id: 'cat-1', name: 'Automotor' }]);
    fixture.componentRef.setInput('fields', config.fields as FieldConfig[]);
    fixture.componentRef.setInput('initialData', { nombre: 'Salud', slug: 'salud', parentId: 'cat-1' });
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({ nombre: 'Salud', slug: 'salud', parentId: 'cat-1' });
    expect(component.form.pristine).toBeTrue();
  });

  it('initialData parcial (alta con padre preseleccionado) no pisa lo tipeado en otros campos', () => {
    tipear('nombre', 'Transporte');

    config = updateFormConfigOptions(config, 'parentId', [{ id: 'cat-1', name: 'Automotor' }]);
    fixture.componentRef.setInput('fields', config.fields as FieldConfig[]);
    fixture.componentRef.setInput('initialData', { parentId: 'cat-1' });
    fixture.detectChanges();

    expect(component.form.get('nombre')?.value).toBe('Transporte');
    expect(component.form.get('nombre')?.dirty).toBeTrue();
    expect(component.form.get('parentId')?.value).toBe('cat-1');
    expect(component.form.get('parentId')?.pristine).toBeTrue();
  });

  it('agrega controles de campos nuevos y quita los de campos que ya no están', () => {
    const sinSlug = (config.fields as FieldConfig[]).filter((f) => f.name !== 'slug');
    fixture.componentRef.setInput('fields', [
      ...sinSlug,
      { name: 'extra', label: 'Extra', type: 'text', value: 'x', validations: { required: true } },
    ]);
    fixture.detectChanges();

    expect(component.form.contains('slug')).toBeFalse();
    expect(component.form.get('extra')?.value).toBe('x');
  });
});

/**
 * Al enviar un formulario inválido, cada campo obligatorio vacío tiene que mostrar el TEXTO del
 * error (no solo el borde rojo), también los campos diferidos (`@defer`) como el select, que son
 * OnPush: `markAllAsTouched()` no emite `statusChanges` ni toca sus inputs.
 */
describe('DynamicFormComponent — errores al enviar', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;

  const fields: FieldConfig[] = [
    { name: 'nombre', label: 'Nombre', type: 'text', validations: { required: true } },
    {
      name: 'tipo', label: 'Tipo', type: 'select', validations: { required: true },
      options: [{ id: 'a', name: 'A' }], optionsLoaded: true,
    },
  ];

  const textoDeError = (nombre: string): string => {
    const campo: HTMLElement | null = fixture.nativeElement.querySelector(`#${nombre}`)
      ?.closest('mat-form-field');
    return campo?.querySelector('mat-error')?.textContent?.trim() ?? '';
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFormComponent);
    fixture.componentRef.setInput('fields', fields);
    fixture.detectChanges();
    await fixture.whenStable(); // resuelve los @defer (on immediate)
    fixture.detectChanges();
  });

  it('muestra el mensaje en el input y en el select diferido', () => {
    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(textoDeError('nombre')).not.toBe('');
    expect(textoDeError('tipo')).not.toBe('');
  });
});
