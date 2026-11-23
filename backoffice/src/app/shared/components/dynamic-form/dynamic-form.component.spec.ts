import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule, NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FieldConfig, FormConfig } from '@core/models/field.interface';
import { DynamicFormComponent } from './dynamic-form.component';
import { updateFormConfigOptions } from './dynamic-form.config';

/** Config de prueba local: dos textos y un select cuyas opciones llegan después del primer render. */
function configDePrueba(): FormConfig {
  return {
    fields: [
      { name: '_section_datos', label: 'Datos', type: 'section-header' },
      { name: 'nombre', label: 'Nombre', type: 'text', cssClass: 'colspan-half', validations: { required: true, minLength: 3, maxLength: 100 } },
      {
        name: 'slug',
        label: 'Slug',
        type: 'text',
        cssClass: 'colspan-half',
        validations: { required: true, minLength: 3, maxLength: 100, pattern: '^[a-z0-9-]+$', patternErrorMessage: 'Solo minúsculas, números y guiones' },
      },
      { name: 'parentId', label: 'Padre', type: 'select', placeholder: 'Seleccioná un padre', cssClass: 'colspan-half', options: [] },
    ],
    submitButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
  };
}

/**
 * B-2: las pantallas cargan los catálogos de los selects después del primer render
 * (`updateFormConfigOptions` → `fields` nuevo). Eso no puede borrar lo ya tipeado.
 */
describe('DynamicFormComponent — cambio de fields después del primer render', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;
  let component: DynamicFormComponent;
  let config = configDePrueba();

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
    config = configDePrueba();
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

/**
 * Regresión (E2E): enviar el form inválido y después corregir un campo colgaba la pestaña. El mensaje
 * se borraba con `while (host.firstChild) renderer.removeChild(...)` y, con las animaciones reales de
 * `mat-form-field`, el renderer difiere esa baja: el bucle no terminaba. Por eso acá van las
 * animaciones de verdad (`BrowserAnimationsModule`), no las `Noop`.
 */
describe('DynamicFormComponent — corregir un campo después de un envío inválido', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;

  const mensajeDe = (nombre: string): string => {
    const error: HTMLElement | null = fixture.nativeElement.querySelector(`#${nombre}`)
      ?.closest('mat-form-field')?.querySelector('mat-error') ?? null;
    if (!error) return '';
    // Lo que se ve: los nodos ocultos (`display: none`) no cuentan.
    return Array.from(error.children)
      .filter((nodo) => (nodo as HTMLElement).style.display !== 'none')
      .map((nodo) => nodo.textContent ?? '').join('').trim();
  };

  function tipear(nombre: string, valor: string): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(`input#${nombre}`);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicFormComponent, BrowserAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFormComponent);
    fixture.componentRef.setInput('fields', [
      { name: 'codigo', label: 'Código', type: 'text', hint: 'Ayuda', validations: { required: true, maxLength: 5 } },
      { name: 'descripcion', label: 'Descripción', type: 'text', validations: { required: true } },
    ] as FieldConfig[]);
    fixture.detectChanges();
  });

  it('el mensaje desaparece al corregir, cambia con el error y vuelve si el campo se vacía', () => {
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(mensajeDe('codigo')).toBe('Este campo es obligatorio');
    expect(mensajeDe('descripcion')).toBe('Este campo es obligatorio');

    tipear('codigo', 'ABC');
    expect(mensajeDe('codigo')).toBe('');
    expect(mensajeDe('descripcion')).toBe('Este campo es obligatorio');

    tipear('codigo', 'ABCDEFG');
    expect(mensajeDe('codigo')).toBe('No puede superar los 5 caracteres');

    tipear('codigo', '');
    expect(mensajeDe('codigo')).toBe('Este campo es obligatorio');
  });
});

/**
 * E1: `(valueChanges)` le avisa a la página que cambió un valor, para que recalcule `fields`
 * (campo condicional). Re-entregar `fields` o `initialData` no puede reemitir: sería un loop.
 */
describe('DynamicFormComponent — valueChanges', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;
  let component: DynamicFormComponent;
  let emitidos: Record<string, unknown>[];

  const base: FieldConfig[] = [
    { name: 'nombre', label: 'Nombre', type: 'text' },
    { name: 'bloqueado', label: 'Bloqueado', type: 'text', value: 'fijo', disabled: true },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFormComponent);
    component = fixture.componentInstance;
    emitidos = [];
    component.valueChanges.subscribe((valor) => emitidos.push(valor));
    fixture.componentRef.setInput('fields', base);
    fixture.detectChanges();
  });

  it('no emite al crear el formulario', () => {
    expect(emitidos).toEqual([]);
  });

  it('emite el valor completo (con deshabilitados) al tipear', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input#nombre');
    input.value = 'Ana';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(emitidos).toEqual([{ nombre: 'Ana', bloqueado: 'fijo' }]);
  });

  it('emite cuando la página setea un control', () => {
    component.form.get('nombre')?.setValue('Juan');

    expect(emitidos).toEqual([{ nombre: 'Juan', bloqueado: 'fijo' }]);
  });

  it('NO emite al re-entregar fields (agregar, quitar, cambiar validadores o disabled)', () => {
    fixture.componentRef.setInput('fields', [
      { name: 'nombre', label: 'Nombre', type: 'text', validations: { required: true }, disabled: true },
      { name: 'extra', label: 'Extra', type: 'text', value: 'x' },
    ]);
    fixture.detectChanges();

    expect(component.form.contains('bloqueado')).toBeFalse();
    expect(component.form.get('extra')?.value).toBe('x');
    expect(emitidos).toEqual([]);
  });

  it('NO emite al aplicar initialData', () => {
    fixture.componentRef.setInput('initialData', { nombre: 'Precargado' });
    fixture.detectChanges();

    expect(component.form.get('nombre')?.value).toBe('Precargado');
    expect(emitidos).toEqual([]);
  });
});

/**
 * E4: un campo `custom` tiene control pero no se dibuja; la página proyecta su widget y escribe el
 * valor. Tiene que contar para `requireChanges` aunque el cambio no nazca en un input del formulario.
 */
@Component({
  standalone: true,
  imports: [DynamicFormComponent],
  template: `
    <app-dynamic-form [fields]="fields" [initialData]="initialData" [requireChanges]="true">
      <button type="button" class="widget" (click)="elegir()">Elegir</button>
    </app-dynamic-form>`,
})
class HostConCustomComponent {
  @ViewChild(DynamicFormComponent) dynamicForm!: DynamicFormComponent;
  fields: FieldConfig[] = [
    { name: 'nombre', label: 'Nombre', type: 'text' },
    { name: 'ids', label: 'Elegidos', type: 'custom', value: [], validations: { required: true } },
  ];
  initialData = { nombre: 'Rol', ids: ['a'] };

  elegir(): void {
    const control = this.dynamicForm.form.get('ids')!;
    control.setValue([...(control.value as string[]), 'b']);
    control.markAsDirty();
  }
}

describe('DynamicFormComponent — campo custom con widget proyectado', () => {
  let fixture: ComponentFixture<HostConCustomComponent>;
  let form: DynamicFormComponent;

  const submit = (): HTMLButtonElement => fixture.nativeElement.querySelector('button[type="submit"]');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostConCustomComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(HostConCustomComponent);
    fixture.detectChanges();
    form = fixture.componentInstance.dynamicForm;
  });

  it('crea el control con su valor inicial y no dibuja celda ni label para él', () => {
    expect(form.form.get('ids')?.value).toEqual(['a']);
    expect(fixture.nativeElement.querySelectorAll('.form-field').length).toBe(1);
    expect(fixture.nativeElement.querySelector('#ids-label')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Tipo de campo no soportado');
  });

  it('proyecta el widget dentro del <form>, antes de los botones', () => {
    const widget: HTMLElement = fixture.nativeElement.querySelector('form .widget');
    expect(widget).not.toBeNull();
    expect(widget.compareDocumentPosition(submit()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('un cambio hecho por el widget habilita "Guardar" (requireChanges) y viaja en el submit', () => {
    expect(submit().getAttribute('aria-disabled')).toBe('true');

    (fixture.nativeElement.querySelector('.widget') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(form.form.dirty).toBeTrue();
    expect(submit().getAttribute('aria-disabled')).toBeNull();
    expect(submit().disabled).toBeFalse();

    let enviado: Record<string, unknown> | undefined;
    form.formSubmit.subscribe((valor) => (enviado = valor));
    submit().click();
    expect(enviado).toEqual({ nombre: 'Rol', ids: ['a', 'b'] });
  });
});

/**
 * E3: `hint` se pinta en todos los tipos con `mat-form-field`, no solo en `text`/`textarea`
 * (antes un select o un email con `hint` declarado lo perdían en silencio).
 */
describe('DynamicFormComponent — hint por tipo de campo', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;

  const fields: FieldConfig[] = [
    { name: 'correo', label: 'Email', type: 'email', hint: 'Ayuda de email' },
    { name: 'clave', label: 'Contraseña', type: 'password', hint: 'Ayuda de contraseña' },
    { name: 'sitio', label: 'Sitio', type: 'url', hint: 'Ayuda de url' },
    {
      name: 'tipo', label: 'Tipo', type: 'select', hint: 'Ayuda de select',
      options: [{ id: 'a', name: 'A' }], optionsLoaded: true,
    },
    { name: 'desde', label: 'Desde', type: 'datepicker', hint: 'Ayuda de fecha' },
    { name: 'sinAyuda', label: 'Sin ayuda', type: 'email' },
  ];

  const hintDe = (nombre: string): string => {
    const campo: HTMLElement | null = fixture.nativeElement.querySelector(`#${nombre}`)
      ?.closest('mat-form-field');
    return campo?.querySelector('mat-hint')?.textContent?.trim() ?? '';
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFormComponent);
    fixture.componentRef.setInput('fields', fields);
    fixture.detectChanges();
    await fixture.whenStable(); // resuelve los @defer (select, datepicker)
    fixture.detectChanges();
  });

  it('pinta el hint en email, password, url, select y datepicker', () => {
    expect(hintDe('correo')).toBe('Ayuda de email');
    expect(hintDe('clave')).toBe('Ayuda de contraseña');
    expect(hintDe('sitio')).toBe('Ayuda de url');
    expect(hintDe('tipo')).toBe('Ayuda de select');
    expect(hintDe('desde')).toBe('Ayuda de fecha');
  });

  it('sin `hint` declarado no deja un mat-hint vacío', () => {
    expect(hintDe('sinAyuda')).toBe('');
  });
});

/** Jerarquía de títulos: en página el rótulo de sección es `h2`; en un diálogo (`compacto`) es un `h3` real. */
describe('DynamicFormComponent — nivel del encabezado de sección', () => {
  const fields: FieldConfig[] = [
    { name: 'datos', label: 'Datos personales', type: 'section-header' },
    { name: 'correo', label: 'Email', type: 'email' },
  ];

  async function pintar(compacto: boolean): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [DynamicFormComponent, NoopAnimationsModule],
    }).compileComponents();
    const fixture = TestBed.createComponent(DynamicFormComponent);
    fixture.componentRef.setInput('fields', fields);
    fixture.componentRef.setInput('compacto', compacto);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('en un formulario de página el rótulo es un h2', async () => {
    const el = await pintar(false);

    expect(el.querySelector('h2.section-header-title')?.textContent).toContain('Datos personales');
    expect(el.querySelector('h3.section-header-title')).toBeNull();
  });

  it('en un formulario compacto (diálogo) el rótulo es un h3 real, sin aria-level', async () => {
    const el = await pintar(true);

    const titulo = el.querySelector('h3.section-header-title');
    expect(titulo?.textContent).toContain('Datos personales');
    expect(titulo?.hasAttribute('aria-level')).toBeFalse();
    expect(el.querySelector('h2.section-header-title')).toBeNull();
  });
});

/**
 * `readonly`: un dato fijado (p. ej. el organismo que impone la sesión) se muestra como `<input readonly>`
 * y no como un control deshabilitado, que sale del orden de tabulación y deja el motivo sin leer.
 */
describe('DynamicFormComponent — campo de solo lectura (`readonly`)', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;
  let component: DynamicFormComponent;

  const MOTIVO = 'Tu cuenta pertenece a IPS: no se puede elegir otro.';
  const fields: FieldConfig[] = [
    { name: 'nombre', label: 'Nombre', type: 'text', validations: { required: true } },
    {
      name: 'organismoId', label: 'Organismo', type: 'select', readonly: true, value: 'org-1', hint: MOTIVO,
      options: [{ id: 'org-1', name: 'Instituto de Previsión Social (IPS)' }, { id: 'org-2', name: 'Rentas' }],
      optionsLoaded: true, validations: { required: true },
    },
    { name: 'codigo', label: 'Código', type: 'text', readonly: true, value: 'CREATE_USER', mono: true },
    {
      name: 'alcance', label: 'Alcance', type: 'select', readonly: true, value: 'uuid-que-no-esta',
      placeholder: 'Ninguno', options: [{ id: 'a', name: 'A' }], optionsLoaded: true,
    },
  ];

  const input = (nombre: string): HTMLInputElement => fixture.nativeElement.querySelector(`input#${nombre}`);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('fields', fields);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
  });

  afterEach(() => (fixture.nativeElement as HTMLElement).remove());

  it('un select fijado se dibuja como input `readonly` con el nombre de la opción, no como mat-select', () => {
    expect(input('organismoId').readOnly).toBeTrue();
    expect(input('organismoId').disabled).toBeFalse();
    expect(input('organismoId').value).toBe('Instituto de Previsión Social (IPS)');
    expect(fixture.nativeElement.querySelector('mat-select#organismoId')).toBeNull();
  });

  it('sigue en el orden de tabulación: se puede enfocar', () => {
    input('organismoId').focus();

    expect(document.activeElement).toBe(input('organismoId'));
    expect(input('organismoId').tabIndex).toBe(0);
  });

  it('tiene nombre accesible (su label) y el motivo asociado por `aria-describedby`', () => {
    const etiqueta: HTMLElement = fixture.nativeElement.querySelector('#organismoId-label');
    expect(input('organismoId').getAttribute('aria-labelledby')).toBe('organismoId-label');
    expect(etiqueta.textContent).toContain('Organismo');

    const descritoPor = (input('organismoId').getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
    const descripcion = descritoPor.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    expect(descripcion).toContain(MOTIVO);
  });

  it('no lleva la marca de obligatorio: no hay nada que completar', () => {
    const etiqueta = (nombre: string): HTMLElement => fixture.nativeElement.querySelector(`#${nombre}-label`);

    expect(etiqueta('organismoId').querySelector('.form-field__required')).toBeNull();
    expect(etiqueta('nombre').querySelector('.form-field__required')).not.toBeNull();
  });

  it('el control sigue habilitado y su valor (el id, no el texto) viaja en el envío', () => {
    const enviado = jasmine.createSpy('formSubmit');
    component.formSubmit.subscribe(enviado);
    component.form.get('nombre')?.setValue('Ana');

    component.submit();

    expect(component.form.get('organismoId')?.enabled).toBeTrue();
    expect(component.form.value.organismoId).toBe('org-1');
    expect(enviado).toHaveBeenCalledOnceWith(jasmine.objectContaining({ organismoId: 'org-1', codigo: 'CREATE_USER' }));
  });

  it('no deja el formulario dirty ni se puede editar tipeando', () => {
    expect(component.form.pristine).toBeTrue();

    input('organismoId').value = 'Otro';
    input('organismoId').dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.form.get('organismoId')?.value).toBe('org-1');
    expect(component.form.pristine).toBeTrue();
  });

  it('un campo de texto muestra su valor tal cual (y en mono si lo pide)', () => {
    expect(input('codigo').value).toBe('CREATE_USER');
    expect(input('codigo').readOnly).toBeTrue();
    expect(input('codigo').classList).toContain('form-field__mono');
  });

  it('un id que no está entre las opciones no se muestra crudo: queda el placeholder', () => {
    expect(input('alcance').value).toBe('Ninguno');
  });
});

/**
 * B1: con un error de guardado a la vista, enviar el formulario inválido tiene que llevar el foco al RESUMEN de
 * validación. Antes `@ViewChild(FormErrorBannerComponent)` tomaba el primer banner (el del servidor,
 * `role="alert"` sin `tabindex`): `focus()` caía en un div no enfocable y el resumen no se leía.
 */
describe('DynamicFormComponent — resumen de validación con un error de guardado previo', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;
  let component: DynamicFormComponent;
  const ERROR_DE_GUARDADO = 'El servidor tuvo un error y no pudo completar la operación.';

  const banners = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('.form-error-banner'));
  const enviar = (): void => {
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DynamicFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('fields', [
      { name: 'nombre', label: 'Nombre', type: 'text', validations: { required: true } },
    ] as FieldConfig[]);
    fixture.componentRef.setInput('initialData', { nombre: 'Salud' });
    fixture.detectChanges();
  });

  it('el error de guardado se muestra como alerta mientras el formulario no se reenvía', () => {
    fixture.componentRef.setInput('serverError', ERROR_DE_GUARDADO);
    fixture.detectChanges();

    expect(banners().length).toBe(1);
    expect(banners()[0].getAttribute('role')).toBe('alert');
    expect(banners()[0].textContent).toContain(ERROR_DE_GUARDADO);
  });

  it('falla el guardado, se vacía un obligatorio y se envía: el foco va al resumen de validación, no al banner del servidor', () => {
    fixture.componentRef.setInput('serverError', ERROR_DE_GUARDADO);
    fixture.detectChanges();
    const emitido = jasmine.createSpy('formSubmit');
    component.formSubmit.subscribe(emitido);

    component.form.get('nombre')?.setValue('');
    fixture.detectChanges();
    enviar();

    expect(emitido).not.toHaveBeenCalled();
    const resumen = banners().find((banner) => banner.getAttribute('role') === 'group');
    expect(resumen).withContext('el resumen de validación está en pantalla').toBeDefined();
    expect(resumen?.getAttribute('tabindex')).toBe('-1');
    expect(resumen?.textContent).toContain('Revisá 1 campo para poder guardar');
    expect(resumen?.textContent).toContain('Nombre');
    expect(document.activeElement).withContext('el foco queda en el resumen').toBe(resumen ?? null);
    // El error del guardado anterior ya no describe este intento: no queda una alerta vieja arriba del resumen.
    expect(banners().some((banner) => banner.getAttribute('role') === 'alert')).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain(ERROR_DE_GUARDADO);
  });

  it('sin error de guardado previo el resumen también recibe el foco', () => {
    component.form.get('nombre')?.setValue('');
    enviar();

    const resumen = banners()[0];
    expect(banners().length).toBe(1);
    expect(resumen.getAttribute('role')).toBe('group');
    expect(document.activeElement).toBe(resumen);
  });

  it('al corregir y enviar de nuevo se emite el valor y el resumen se va', () => {
    fixture.componentRef.setInput('serverError', ERROR_DE_GUARDADO);
    component.form.get('nombre')?.setValue('');
    enviar();
    const emitido = jasmine.createSpy('formSubmit');
    component.formSubmit.subscribe(emitido);

    component.form.get('nombre')?.setValue('Educación');
    enviar();

    expect(emitido).toHaveBeenCalledOnceWith({ nombre: 'Educación' });
    expect(banners().some((banner) => banner.getAttribute('role') === 'group')).toBeFalse();
  });
});
