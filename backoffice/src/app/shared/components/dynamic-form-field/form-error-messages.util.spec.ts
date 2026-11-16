import { FormControl, FormGroup, Validators } from '@angular/forms';
import { FieldConfig } from '../../../core/models/field.interface';
import { getControlErrorMessage, resumenDeErrores } from './form-error-messages.util';

const CAMPO: FieldConfig = { name: 'slug', label: 'Slug', type: 'text', validations: { maxLength: 255 } };

describe('form-error-messages.util', () => {
  it('sin errores no devuelve mensaje', () => {
    expect(getControlErrorMessage(new FormControl('ok'), CAMPO)).toBeNull();
  });

  it('resuelve los validadores propios de los formularios a mano', () => {
    const slug = new FormControl('¡¡¡');
    slug.setErrors({ slugVacio: true });
    expect(getControlErrorMessage(slug, CAMPO)).toBe('Tiene que tener letras o números');

    const principal = new FormControl('x');
    principal.setErrors({ principalFuera: true });
    expect(getControlErrorMessage(principal, CAMPO)).toBe('Tiene que ser una de las categorías elegidas');
  });

  it('`required` gana sobre `slugVacio`, y el error del servidor gana sobre todos', () => {
    const control = new FormControl('');
    control.setErrors({ slugVacio: true, required: true });
    expect(getControlErrorMessage(control, CAMPO)).toBe('Este campo es obligatorio');

    control.setErrors({ required: true, server: 'Ya existe una plantilla con ese slug' });
    expect(getControlErrorMessage(control, CAMPO)).toBe('Ya existe una plantilla con ese slug');
  });

  it('una regla propia del campo (`validar`) muestra su mensaje, después de los errores estándar', () => {
    const control = new FormControl('x');
    control.setErrors({ personalizado: 'Usá al menos 3 letras o números' });
    expect(getControlErrorMessage(control, CAMPO)).toBe('Usá al menos 3 letras o números');

    control.setErrors({ personalizado: 'Usá al menos 3 letras o números', required: true });
    expect(getControlErrorMessage(control, CAMPO)).toBe('Este campo es obligatorio');
  });

  it('el campo puede declarar su propio texto por error (`mensajes`); el resto usa el común', () => {
    const campo: FieldConfig = {
      name: 'nombre',
      label: 'Nombre',
      type: 'text',
      validations: { required: true, maxLength: 100, mensajes: { required: 'El nombre es obligatorio' } },
    };
    const control = new FormControl('');

    control.setErrors({ required: true });
    expect(getControlErrorMessage(control, campo)).toBe('El nombre es obligatorio');

    control.setErrors({ maxlength: { requiredLength: 100, actualLength: 120 } });
    expect(getControlErrorMessage(control, campo)).toBe('No puede superar los 100 caracteres');

    // El motivo que devolvió el backend sigue ganando.
    control.setErrors({ required: true, server: 'Ya existe' });
    expect(getControlErrorMessage(control, campo)).toBe('Ya existe');
  });

  it('un validador propio de la pantalla muestra el texto que el campo le declara en `mensajes`', () => {
    const campo: FieldConfig = {
      name: 'latitud',
      label: 'Latitud',
      type: 'text',
      validations: { mensajes: { rango: 'Tiene que estar entre -90 y 90' } },
    };
    const control = new FormControl('95');

    control.setErrors({ rango: { min: -90, max: 90 } });
    expect(getControlErrorMessage(control, campo)).toBe('Tiene que estar entre -90 y 90');

    // Un error conocido sigue ganando; uno sin texto declarado cae en el genérico.
    control.setErrors({ rango: { min: -90, max: 90 }, required: true });
    expect(getControlErrorMessage(control, campo)).toBe('Este campo es obligatorio');
    control.setErrors({ decimales: true });
    expect(getControlErrorMessage(control, campo)).toBe('Este campo tiene un error');
  });

  it('el largo máximo usa el límite declarado en el campo', () => {
    const control = new FormControl('x');
    control.setErrors({ maxlength: { requiredLength: 255, actualLength: 300 } });
    expect(getControlErrorMessage(control, CAMPO)).toBe('No puede superar los 255 caracteres');
  });

  it('el resumen lista solo los campos inválidos y tocados, como "Label (motivo)"', () => {
    const form = new FormGroup({
      titulo: new FormControl('', Validators.required),
      slug: new FormControl('', Validators.required),
    });
    form.controls.slug.markAsTouched();
    const campos: FieldConfig[] = [{ name: 'titulo', label: 'Título', type: 'text' }, CAMPO];

    expect(resumenDeErrores(form, campos, (control, campo) => getControlErrorMessage(control, campo)))
      .toEqual(['Slug (Este campo es obligatorio)']);
  });
});
