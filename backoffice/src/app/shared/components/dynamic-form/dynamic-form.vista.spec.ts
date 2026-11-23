import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { EscrituraDeVista, FieldConfig, VistaDeCampo } from '@core/models/field.interface';
import { DynamicFormComponent } from './dynamic-form.component';
import { entradasDeVista } from './dynamic-form.vista';

/** Vista que escribe: un botón que completa las coordenadas (lo que hace el mapa del punto de atención). */
@Component({
  selector: 'app-vista-que-escribe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" class="vista-que-escribe" (click)="marcar()">Marcar</button>
             <button type="button" class="vista-que-escribe__ajena" (click)="escribir?.({ nombre: 'otro' })">Ajena</button>`,
})
class VistaQueEscribeComponent implements VistaDeCampo {
  @Input({ required: true }) grupo!: FormGroup;
  @Input() escribir?: EscrituraDeVista;

  marcar(): void {
    this.escribir?.({ latitud: '-27,5', longitud: '-55,25' });
  }
}

/** Vista de solo lectura: NO declara `escribir` (el motor no se lo tiene que pasar). */
@Component({
  selector: 'app-vista-que-lee',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p class="vista-que-lee">{{ grupo.get("latitud")?.value }}</p>',
})
class VistaQueLeeComponent implements VistaDeCampo {
  @Input({ required: true }) grupo!: FormGroup;
}

describe('DynamicFormComponent — `vista` que escribe (`vista.escribe` + `escribir`)', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;
  let component: DynamicFormComponent;
  const el = (): HTMLElement => fixture.nativeElement;

  const campos = (escribe?: string[]): FieldConfig[] => [
    { name: 'nombre', label: 'Nombre', type: 'text' },
    { name: '_mapa', label: 'Mapa', type: 'vista', vista: { componente: VistaQueEscribeComponent, escribe } },
    {
      name: 'latitud', label: 'Latitud', type: 'text',
      validations: { validar: (v) => (v === 'mal' ? 'Escribí un número' : null) },
    },
    { name: 'longitud', label: 'Longitud', type: 'text' },
  ];

  async function crear(fields: FieldConfig[], requireChanges = false): Promise<void> {
    await TestBed.configureTestingModule({ imports: [DynamicFormComponent, NoopAnimationsModule] }).compileComponents();
    fixture = TestBed.createComponent(DynamicFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('fields', fields);
    fixture.componentRef.setInput('requireChanges', requireChanges);
    fixture.componentRef.setInput('initialData', { nombre: 'Delegación', latitud: '', longitud: '' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const clic = (selector: string): void => {
    el().querySelector<HTMLButtonElement>(selector)!.click();
    fixture.detectChanges();
  };

  it('escribe los controles declarados: valor nuevo en los inputs, dirty y touched', async () => {
    await crear(campos(['latitud', 'longitud']));
    clic('.vista-que-escribe');

    expect(component.form.getRawValue()).toEqual({ nombre: 'Delegación', latitud: '-27,5', longitud: '-55,25' });
    expect(el().querySelector<HTMLInputElement>('#latitud')!.value).toBe('-27,5');
    expect(component.form.get('latitud')!.dirty).toBeTrue();
    expect(component.form.get('latitud')!.touched).toBeTrue();
    expect(component.form.get('nombre')!.dirty).toBeFalse();
  });

  it('en una edición (`requireChanges`) libera "Guardar" y emite el valor una vez por control cambiado', async () => {
    await crear(campos(['latitud', 'longitud']), true);
    const emitidos: Record<string, unknown>[] = [];
    component.valueChanges.subscribe((v) => emitidos.push(v));
    expect(component.sinCambios).toBeTrue();

    clic('.vista-que-escribe');

    expect(component.sinCambios).toBeFalse();
    expect(emitidos.length).toBe(2);
    expect(emitidos[1]).toEqual({ nombre: 'Delegación', latitud: '-27,5', longitud: '-55,25' });
  });

  it('un valor igual al actual no ensucia el formulario', async () => {
    await crear(campos(['latitud', 'longitud']), true);
    clic('.vista-que-escribe');
    component.form.markAsPristine();

    clic('.vista-que-escribe');

    expect(component.form.pristine).toBeTrue();
  });

  it('ignora un control fuera de `escribe` (y lo avisa en desarrollo)', async () => {
    await crear(campos(['latitud', 'longitud']));
    const aviso = spyOn(console, 'warn');

    clic('.vista-que-escribe__ajena');

    expect(component.form.get('nombre')!.value).toBe('Delegación');
    expect(component.form.get('nombre')!.dirty).toBeFalse();
    expect(aviso).toHaveBeenCalledWith(jasmine.stringContaining('no puede escribir "nombre"'));
  });

  it('no escribe un campo fijado (`readonly` o `disabled`), aunque esté en `escribe`, y lo avisa en desarrollo', async () => {
    await crear([
      { name: '_mapa', label: 'Mapa', type: 'vista', vista: { componente: VistaQueEscribeComponent, escribe: ['latitud', 'longitud'] } },
      { name: 'latitud', label: 'Latitud', type: 'text', readonly: true, hint: 'La fija el organismo' },
      { name: 'longitud', label: 'Longitud', type: 'text', disabled: true },
    ]);
    const aviso = spyOn(console, 'warn');

    clic('.vista-que-escribe');

    expect(component.form.getRawValue()).toEqual(jasmine.objectContaining({ latitud: '', longitud: '' }));
    expect(component.form.get('latitud')!.dirty).toBeFalse();
    expect(component.form.get('longitud')!.dirty).toBeFalse();
    expect(aviso).toHaveBeenCalledWith(jasmine.stringContaining('no puede escribir "latitud": el campo está fijado'));
    expect(aviso).toHaveBeenCalledWith(jasmine.stringContaining('no puede escribir "longitud": el campo está fijado'));
  });

  it('un campo que deja de ser `readonly` al recalcular `fields` vuelve a aceptar lo que escribe la vista', async () => {
    const fijo = (readonly: boolean): FieldConfig[] => [
      { name: '_mapa', label: 'Mapa', type: 'vista', vista: { componente: VistaQueEscribeComponent, escribe: ['latitud', 'longitud'] } },
      { name: 'latitud', label: 'Latitud', type: 'text', readonly, hint: readonly ? 'Fijada' : undefined },
      { name: 'longitud', label: 'Longitud', type: 'text' },
    ];
    await crear(fijo(true));
    spyOn(console, 'warn');
    fixture.componentRef.setInput('fields', fijo(false));
    fixture.detectChanges();

    clic('.vista-que-escribe');

    expect(component.form.get('latitud')!.value).toBe('-27,5');
  });

  it('sin `escribe` la vista no recibe `escribir`: sigue siendo de solo lectura', async () => {
    await crear(campos());
    clic('.vista-que-escribe');
    expect(component.form.get('latitud')!.value).toBe('');
  });

  it('el valor escrito pasa por la validación del campo, que muestra su error', async () => {
    await crear([
      { name: '_mapa', label: 'Mapa', type: 'vista', vista: { componente: VistaQueEscribeComponent, escribe: ['latitud'] } },
      { name: 'latitud', label: 'Latitud', type: 'text', validations: { validar: () => 'Escribí un número' } },
    ]);
    spyOn(console, 'warn'); // la vista también intenta escribir `longitud`, que acá no existe
    clic('.vista-que-escribe');
    expect(Array.from(el().querySelectorAll('mat-error')).map((e) => e.textContent!.trim())).toEqual(['Escribí un número']);
  });

  describe('entradasDeVista (función pura)', () => {
    const grupo = new FormGroup({});

    it('solo `grupo` para una vista de solo lectura sin datos', () => {
      const field: FieldConfig = { name: '_v', label: '', type: 'vista', vista: { componente: VistaQueLeeComponent } };
      expect(Object.keys(entradasDeVista(field, grupo)!)).toEqual(['grupo']);
    });

    it('`datos` si se declaran y `escribir` solo con `escribe` no vacío', () => {
      const conTodo: FieldConfig = {
        name: '_v', label: '', type: 'vista', vista: { componente: VistaQueEscribeComponent, datos: { a: 1 }, escribe: ['x'] },
      };
      const vacio: FieldConfig = { name: '_v', label: '', type: 'vista', vista: { componente: VistaQueEscribeComponent, escribe: [] } };
      expect(Object.keys(entradasDeVista(conTodo, grupo)!)).toEqual(['grupo', 'datos', 'escribir']);
      expect(Object.keys(entradasDeVista(vacio, grupo)!)).toEqual(['grupo']);
    });

    it('`null` para un campo que no es `vista`', () => {
      expect(entradasDeVista({ name: 'x', label: 'X', type: 'text' }, grupo)).toBeNull();
    });
  });
});
