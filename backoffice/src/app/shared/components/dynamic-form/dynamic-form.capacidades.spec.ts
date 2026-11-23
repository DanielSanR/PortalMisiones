import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { FieldConfig, VistaDeCampo } from '@core/models/field.interface';
import { DynamicFormComponent } from './dynamic-form.component';

/** Vista de prueba: muestra lo que recibe, para comprobar que el motor le entrega el grupo y los datos. */
@Component({
  selector: 'app-vista-de-prueba',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p class="vista-de-prueba">{{ datos }}: {{ grupo.get("nombre")?.value }}</p>',
})
class VistaDePruebaComponent implements VistaDeCampo {
  @Input({ required: true }) grupo!: FormGroup;
  @Input() datos?: unknown;
}

/**
 * Capacidades del motor que relacionan un campo con otros o con su propio valor: `derivado`, `validarCon`,
 * `vista`, `aviso`, `fecha`, y las marcas `opcional` / `filas` / `inputMode` / `tip` de alerta.
 */
describe('DynamicFormComponent — capacidades entre campos', () => {
  let fixture: ComponentFixture<DynamicFormComponent>;
  let component: DynamicFormComponent;

  const el = (): HTMLElement => fixture.nativeElement;
  const control = (nombre: string) => component.form.get(nombre)!;
  const errores = (): string[] => Array.from(el().querySelectorAll('mat-error')).map((e) => e.textContent!.trim()).filter(Boolean);

  async function crear(fields: FieldConfig[], initialData?: Record<string, unknown>): Promise<void> {
    await TestBed.configureTestingModule({ imports: [DynamicFormComponent, NoopAnimationsModule] }).compileComponents();
    fixture = TestBed.createComponent(DynamicFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('fields', fields);
    if (initialData) fixture.componentRef.setInput('initialData', initialData);
    fixture.detectChanges();
    await fixture.whenStable(); // @defer de fechas e interruptores
    fixture.detectChanges();
  }

  function tipear(nombre: string, valor: string): void {
    const input = el().querySelector<HTMLInputElement>(`#${nombre}`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  describe('`derivado`: el valor sale de otro campo', () => {
    const campos = (seguir: boolean): FieldConfig[] => [
      { name: 'nombre', label: 'Nombre', type: 'text' },
      {
        name: 'slug', label: 'Slug', type: 'text',
        derivado: { de: 'nombre', transform: (nombre) => nombre.trim().toLowerCase().replace(/\s+/g, '-'), seguir, accion: 'Usar el del nombre' },
      },
    ];
    const accion = (): HTMLButtonElement | null => el().querySelector<HTMLButtonElement>('.form-field__fila button');

    it('con `seguir`, acompaña al origen sin quedar marcado como editado', async () => {
      await crear(campos(true));
      tipear('nombre', 'Salud Pública');

      expect(control('slug').value).toBe('salud-pública');
      expect(control('slug').pristine).toBeTrue();
      expect(accion()).toBeNull();
    });

    it('con `seguir`, deja de acompañar cuando la persona lo edita, y la acción lo vuelve a derivar y a seguir', async () => {
      await crear(campos(true));
      tipear('nombre', 'Salud');
      tipear('slug', 'otro');
      tipear('nombre', 'Salud mental');
      expect(control('slug').value).toBe('otro');
      expect(accion()!.textContent!.trim()).toBe('Usar el del nombre');
      expect(accion()!.type).toBe('button');

      accion()!.click();
      fixture.detectChanges();

      expect(control('slug').value).toBe('salud-mental');
      expect(control('slug').pristine).toBeTrue();
      expect(accion()).toBeNull();
      expect(document.activeElement?.id).toBe('slug');
      tipear('nombre', 'Salud bucal');
      expect(control('slug').value).toBe('salud-bucal');
    });

    it('sin `seguir` (edición) no lo toca; la acción aparece al cambiar el origen y deja un cambio a guardar', async () => {
      await crear(campos(false), { nombre: 'Salud', slug: 'salud-vieja' });
      // Abrir una edición no invita a cambiar nada, aunque el slug no coincida con el del nombre.
      expect(accion()).toBeNull();

      tipear('nombre', 'Salud mental');
      expect(control('slug').value).toBe('salud-vieja');

      accion()!.click();
      fixture.detectChanges();
      expect(control('slug').value).toBe('salud-mental');
      expect(control('slug').dirty).toBeTrue();
    });

    it('la acción no se ofrece si del origen no sale nada', async () => {
      await crear(campos(true));
      tipear('slug', 'algo');
      expect(accion()).toBeNull();
    });

    it('con `seguir`, vaciarlo a mano lo deja sin tocar: ofrece la acción y vuelve a acompañar al origen', async () => {
      await crear(campos(true));
      tipear('nombre', 'Salud');
      tipear('slug', 'otro');
      tipear('slug', '');

      expect(control('slug').pristine).toBeTrue();
      expect(accion()!.textContent!.trim()).toBe('Usar el del nombre');
      tipear('nombre', 'Salud mental');
      expect(control('slug').value).toBe('salud-mental');
      expect(accion()).toBeNull();
    });

    it('sin `seguir` (edición), vaciarlo a mano es un cambio más: no vuelve a acompañar al origen', async () => {
      await crear(campos(false), { nombre: 'Salud', slug: 'salud-vieja' });
      tipear('slug', '');
      tipear('nombre', 'Salud mental');

      expect(control('slug').value).toBe('');
      expect(control('slug').dirty).toBeTrue();
    });

    it('si `fields` se vuelve a entregar, sigue acompañando una sola vez por cambio', async () => {
      await crear(campos(true));
      const transform = jasmine.createSpy('transform').and.callFake((nombre: string) => nombre.toLowerCase());
      const nuevos = campos(true);
      nuevos[1] = { ...nuevos[1], derivado: { ...nuevos[1].derivado!, transform, accion: undefined } };
      fixture.componentRef.setInput('fields', nuevos);
      fixture.detectChanges();

      tipear('nombre', 'Hola');

      expect(control('slug').value).toBe('hola');
      expect(transform).toHaveBeenCalledTimes(1);
    });
  });

  describe('`validarCon`: una regla que mira otros campos', () => {
    const campos: FieldConfig[] = [
      { name: 'minimo', label: 'Mínimo', type: 'text' },
      {
        name: 'maximo', label: 'Máximo', type: 'text',
        validations: {
          validarCon: {
            campos: ['minimo'],
            validar: (maximo, valores) => (maximo && Number(maximo) < Number(valores['minimo']) ? 'No puede ser menor al mínimo' : null),
          },
        },
      },
    ];

    it('marca el campo con su mensaje y bloquea el envío', async () => {
      await crear(campos);
      const enviado = jasmine.createSpy('enviado');
      component.formSubmit.subscribe(enviado);
      tipear('minimo', '10');
      tipear('maximo', '5');

      expect(errores()).toEqual(['No puede ser menor al mínimo']);
      component.submit();
      expect(enviado).not.toHaveBeenCalled();
    });

    it('se vuelve a evaluar al cambiar el otro campo, y con valor cargado el error se ve sin tocar este', async () => {
      await crear(campos, { minimo: '1', maximo: '5' });
      expect(control('maximo').valid).toBeTrue();
      expect(control('maximo').touched).toBeFalse();

      tipear('minimo', '10');
      expect(errores()).toEqual(['No puede ser menor al mínimo']);

      tipear('minimo', '2');
      expect(errores()).toEqual([]);
      expect(component.form.valid).toBeTrue();
    });

    it('si también falla la regla del propio campo (`validar`), se ve esa: primero el valor, después la relación', async () => {
      const conLasDos: FieldConfig[] = [campos[0], {
        ...campos[1],
        validations: { ...campos[1].validations, validar: (valor) => (/^\d*$/.test(valor) ? null : 'Solo números') },
      }];
      await crear(conLasDos);
      tipear('minimo', '10');
      tipear('maximo', '-5');

      // Las dos reglas fallan y conviven, cada una en su clave.
      expect(control('maximo').errors).toEqual({ personalizado: 'Solo números', entreCampos: 'No puede ser menor al mínimo' });
      expect(errores()).toEqual(['Solo números']);

      tipear('maximo', '5');
      expect(errores()).toEqual(['No puede ser menor al mínimo']);
    });

    it('al cambiar el otro campo se revalida: un error de servidor puesto en este se pierde', async () => {
      await crear(campos, { minimo: '1', maximo: '5' });
      control('maximo').setErrors({ server: 'Se superpone con otro rango' });
      control('maximo').markAsTouched();
      component.refrescarErrores();
      fixture.detectChanges();
      expect(errores()).toEqual(['Se superpone con otro rango']);

      tipear('minimo', '2');

      expect(control('maximo').errors).toBeNull();
      expect(errores()).toEqual([]);
    });

    it('sin valor en este campo, cambiar el otro no lo marca como tocado', async () => {
      await crear(campos);
      tipear('minimo', '10');
      expect(control('maximo').touched).toBeFalse();
      expect(control('maximo').pristine).toBeTrue();
    });
  });

  describe('error de servidor al re-entregar `fields`', () => {
    const campos = (ayuda: string): FieldConfig[] => [
      { name: 'codigo', label: 'Código', type: 'text', validations: { required: true } },
      { name: 'alcance', label: 'Alcance', type: 'text', hint: ayuda },
    ];
    const marcarServidor = (nombre: string, mensaje: string): void => {
      control(nombre).setErrors({ server: mensaje });
      control(nombre).markAsTouched();
      component.refrescarErrores();
      fixture.detectChanges();
    };
    const entregar = (fields: FieldConfig[]): void => {
      fixture.componentRef.setInput('fields', fields);
      fixture.detectChanges();
    };

    it('un campo cuyo valor no cambió conserva su error de servidor (texto, `aria-invalid` y envío bloqueado)', async () => {
      await crear(campos('Global'), { codigo: 'ADMIN', alcance: 'g' });
      marcarServidor('codigo', 'Ya existe un rol con ese código');

      tipear('alcance', 'o');
      entregar(campos('De organismo'));

      expect(control('codigo').errors).toEqual({ server: 'Ya existe un rol con ese código' });
      expect(errores()).toEqual(['Ya existe un rol con ese código']);
      expect(el().querySelector('#codigo')!.getAttribute('aria-invalid')).toBe('true');
      expect(component.form.valid).toBeFalse();
    });

    it('también si los campos nuevos agregan o quitan un control (eso revalida todo el formulario)', async () => {
      await crear(campos('Global'), { codigo: 'ADMIN', alcance: 'g' });
      marcarServidor('codigo', 'Ya existe un rol con ese código');

      entregar([...campos('De organismo'), { name: 'organismo', label: 'Organismo', type: 'text' }]);
      expect(component.form.contains('organismo')).toBeTrue();
      expect(control('codigo').errors).toEqual({ server: 'Ya existe un rol con ese código' });

      entregar(campos('Global'));
      expect(component.form.contains('organismo')).toBeFalse();
      expect(control('codigo').errors).toEqual({ server: 'Ya existe un rol con ese código' });
      expect(errores()).toEqual(['Ya existe un rol con ese código']);
    });

    it('editar el campo marcado sí limpia el error de servidor', async () => {
      await crear(campos('Global'), { codigo: 'ADMIN', alcance: 'g' });
      marcarServidor('codigo', 'Ya existe un rol con ese código');
      entregar(campos('De organismo'));

      tipear('codigo', 'ADMIN2');

      expect(control('codigo').errors).toBeNull();
      expect(errores()).toEqual([]);
      expect(el().querySelector('#codigo')!.getAttribute('aria-invalid')).toBe('false');
    });

    it('convive con el error de un validador nuevo del mismo campo', async () => {
      await crear(campos('Global'), { codigo: 'AB', alcance: 'g' });
      marcarServidor('codigo', 'Ya existe un rol con ese código');

      const conMinimo = campos('Global');
      conMinimo[0] = { ...conMinimo[0], validations: { required: true, minLength: 3 } };
      entregar(conMinimo);

      expect(control('codigo').hasError('server')).toBeTrue();
      expect(control('codigo').hasError('minlength')).toBeTrue();
    });

    it('no se repone si el campo pasó a ser de solo lectura: no habría forma de corregirlo', async () => {
      await crear(campos('Global'), { codigo: 'ADMIN', alcance: 'g' });
      marcarServidor('codigo', 'Ya existe un rol con ese código');

      const fijo = campos('Global');
      fijo[0] = { ...fijo[0], readonly: true, hint: 'No se puede cambiar' };
      entregar(fijo);

      expect(control('codigo').errors).toBeNull();
      expect(component.form.valid).toBeTrue();
    });
  });

  describe('`select-multiple` obligatorio', () => {
    const campos: FieldConfig[] = [
      {
        name: 'categorias', label: 'Categorías', type: 'select-multiple', value: [],
        seleccion: { nombre: 'categorías', textoVacio: 'Ninguna categoría elegida.' },
        options: [{ id: 'a', name: 'Salud' }, { id: 'b', name: 'Tránsito' }], optionsLoaded: true,
        validations: { required: true, mensajes: { required: 'Elegí al menos una categoría' } },
      },
    ];
    const grupo = (): HTMLElement => el().querySelector<HTMLElement>('.seleccion-multiple[role="group"]')!;
    const alternar = (): HTMLButtonElement => el().querySelector<HTMLButtonElement>('.seleccion-multiple__alternar')!;
    const errorDelGrupo = (): HTMLElement | null => grupo().querySelector<HTMLElement>('#categorias-error');

    it('sin tocarlo no muestra error ni descripción', async () => {
      await crear(campos);
      expect(errorDelGrupo()).toBeNull();
      expect(grupo().hasAttribute('aria-describedby')).toBeFalse();
    });

    it('enviar vacío no envía: error bajo el grupo, asociado por `aria-describedby`, y listado en el resumen', async () => {
      await crear(campos);
      const enviado = jasmine.createSpy('enviado');
      component.formSubmit.subscribe(enviado);

      component.submit();
      fixture.detectChanges();

      expect(enviado).not.toHaveBeenCalled();
      expect(errorDelGrupo()!.textContent!.trim()).toBe('Elegí al menos una categoría');
      expect(grupo().getAttribute('aria-describedby')).toBe('categorias-error');
      expect(alternar().getAttribute('aria-describedby')).toBe('categorias-error');
      expect(component.invalidFieldMessages()).toEqual(['Categorías (Elegí al menos una categoría)']);
      expect(el().querySelector('.form-error-banner')!.textContent).toContain('Categorías (Elegí al menos una categoría)');
    });

    it('al elegir una opción el error y la descripción se van, y el formulario se envía', async () => {
      await crear(campos);
      const enviado = jasmine.createSpy('enviado');
      component.formSubmit.subscribe(enviado);
      component.submit();
      fixture.detectChanges();

      alternar().click();
      fixture.detectChanges();
      el().querySelector<HTMLInputElement>('.seleccion-multiple__opcion input[type="checkbox"]')!.click();
      fixture.detectChanges();

      expect(errorDelGrupo()).toBeNull();
      expect(grupo().hasAttribute('aria-describedby')).toBeFalse();
      component.submit();
      expect(enviado).toHaveBeenCalledWith({ categorias: ['a'] });
    });
  });

  describe('`vista`: contenido derivado dibujado por un componente', () => {
    const campos: FieldConfig[] = [
      { name: '_vista', label: 'Resumen', type: 'vista', vista: { componente: VistaDePruebaComponent, datos: 'Hola' } },
      { name: 'nombre', label: 'Nombre', type: 'text' },
    ];

    it('no tiene control ni etiqueta, y recibe el grupo y sus datos', async () => {
      await crear(campos, { nombre: 'Ana' });

      expect(component.form.get('_vista')).toBeNull();
      expect(Object.keys(component.form.getRawValue())).toEqual(['nombre']);
      expect(el().querySelector('#_vista-label')).toBeNull();
      expect(el().querySelector('.vista-de-prueba')!.textContent).toBe('Hola: Ana');
    });

    it('ocupa su lugar en la grilla, en el orden de `fields`', async () => {
      await crear(campos);
      const celdas = Array.from(el().querySelectorAll('.form-fields > .form-field'));
      expect(celdas[0].querySelector('.vista-de-prueba')).not.toBeNull();
      expect(celdas[1].querySelector('input#nombre')).not.toBeNull();
    });
  });

  describe('`aviso` de un interruptor', () => {
    const campos: FieldConfig[] = [{
      name: 'activo', label: 'Activo', type: 'checkbox', value: true,
      aviso: (valor) => (valor ? null : { texto: 'Deja de mostrarse.', tono: 'alerta' }),
    }];
    const aviso = (): HTMLElement | null => el().querySelector('.form-toggle__aviso');

    it('aparece según el valor, dentro de la ayuda que describe al interruptor', async () => {
      await crear(campos);
      const ayuda = el().querySelector('.form-toggle__ayuda')!;
      // En el control con foco (`role="switch"`), no en el host: ahí el lector no lo asocia.
      expect(el().querySelector('mat-slide-toggle [role="switch"]')!.getAttribute('aria-describedby')).toBe(ayuda.id);
      expect(aviso()).toBeNull();

      control('activo').setValue(false);
      fixture.detectChanges();

      expect(aviso()!.textContent!.trim()).toBe('Deja de mostrarse.');
      expect(aviso()!.classList).toContain('form-toggle__aviso--alerta');
      expect(aviso()!.querySelector('i.ph-warning')).not.toBeNull();
      expect(ayuda.contains(aviso())).toBeTrue();
    });

    it('la ayuda es una región viva montada desde antes del aviso: el lector anuncia la consecuencia al aparecer', async () => {
      await crear(campos);
      const ayuda = el().querySelector('.form-toggle__ayuda')!;
      expect(aviso()).toBeNull();
      expect(ayuda.getAttribute('aria-live')).toBe('polite');

      control('activo').setValue(false);
      fixture.detectChanges();

      // El aviso entra en el MISMO nodo que ya estaba (una región creada junto con su texto no se anuncia).
      expect(el().querySelector('.form-toggle__ayuda')).toBe(ayuda);
      expect(ayuda.contains(aviso())).toBeTrue();
    });

    it('también se actualiza cuando el valor lo cambia la página (`initialData`)', async () => {
      await crear(campos, { activo: false });
      expect(aviso()).not.toBeNull();

      fixture.componentRef.setInput('initialData', { activo: true });
      fixture.detectChanges();
      expect(aviso()).toBeNull();
    });

    it('con solo `hint` el interruptor también se describe con su ayuda; sin `hint` ni `aviso` no apunta a nada', async () => {
      await crear([
        { name: 'conAyuda', label: 'Con ayuda', type: 'checkbox', value: true, hint: 'Se ve en el portal.' },
        { name: 'sinAyuda', label: 'Sin ayuda', type: 'checkbox', value: true },
      ]);
      const [conAyuda, sinAyuda] = Array.from(el().querySelectorAll('mat-slide-toggle [role="switch"]'));
      expect(conAyuda.getAttribute('aria-describedby')).toBe('conAyuda-ayuda');
      expect(el().querySelector('#conAyuda-ayuda')!.textContent!.trim()).toBe('Se ve en el portal.');
      expect(sinAyuda.getAttribute('aria-describedby') ?? '').toBe('');
      expect(el().querySelector('#sinAyuda-ayuda')).toBeNull();
    });

    it('sin tono es informativo', async () => {
      await crear([{ ...campos[0], aviso: (valor) => (valor ? null : { texto: 'Apagado.' }) }], { activo: false });
      expect(aviso()!.classList).not.toContain('form-toggle__aviso--alerta');
      expect(aviso()!.querySelector('i.ph-info')).not.toBeNull();
    });
  });

  describe('`fecha`: opciones de un datepicker', () => {
    const campos: FieldConfig[] = [
      {
        name: 'desde', label: 'Desde', type: 'datepicker', fecha: { botonCalendario: 'Elegir el inicio' },
        validations: { required: true, mensajes: { required: 'Es obligatoria', matDatepickerParse: 'Escribí la fecha como DD/MM/AAAA' } },
      },
      { name: 'hasta', label: 'Hasta', type: 'datepicker', opcional: true, fecha: { minDe: 'desde', quitar: 'Quitar la fecha' } },
    ];
    const quitar = (): HTMLButtonElement | null => el().querySelector<HTMLButtonElement>('.date-field__quitar');

    it('se escribe como DD/MM/AAAA y cada calendario lleva su nombre (o "Elegir fecha")', async () => {
      await crear(campos);
      tipear('desde', '05/03/2026');

      expect(control('desde').value).toEqual(new Date(2026, 2, 5));
      expect(el().querySelector<HTMLInputElement>('#desde')!.placeholder).toBe('DD/MM/AAAA');
      expect(el().querySelector<HTMLInputElement>('#desde')!.getAttribute('autocomplete')).toBe('off');
      const nombres = Array.from(el().querySelectorAll('mat-datepicker-toggle')).map((t) => t.getAttribute('aria-label'));
      expect(nombres).toEqual(['Elegir el inicio', 'Elegir fecha']);
    });

    it('una fecha mal escrita dice cómo escribirla, antes que "es obligatoria"', async () => {
      await crear(campos);
      tipear('desde', '31/02/2026');
      expect(errores()).toEqual(['Escribí la fecha como DD/MM/AAAA']);
      tipear('desde', '');
      expect(errores()).toEqual(['Es obligatoria']);
    });

    it('`quitar` se ofrece solo con una fecha cargada, la vacía como un cambio de la persona y deja el foco en el campo', async () => {
      await crear(campos, { desde: new Date(2026, 2, 5), hasta: new Date(2026, 2, 9) });
      expect(quitar()!.textContent!.trim()).toBe('Quitar la fecha');
      expect(quitar()!.type).toBe('button');

      quitar()!.click();
      fixture.detectChanges();

      expect(control('hasta').value).toBeNull();
      expect(control('hasta').dirty).toBeTrue();
      expect(quitar()).toBeNull();
      expect(document.activeElement?.id).toBe('hasta');
    });

    it('`minDe`: un día anterior al del otro campo queda fuera del calendario', async () => {
      await crear(campos, { desde: new Date(2026, 2, 10) });
      tipear('hasta', '09/03/2026');
      expect(control('hasta').hasError('matDatepickerMin')).toBeTrue();
      tipear('hasta', '10/03/2026');
      expect(control('hasta').valid).toBeTrue();
    });
  });

  describe('marcas de un campo', () => {
    it('`opcional` lo dice en la etiqueta; `filas` e `inputMode` llegan al control', async () => {
      await crear([
        { name: 'notas', label: 'Notas', type: 'textarea', opcional: true, filas: 2 },
        { name: 'latitud', label: 'Latitud', type: 'text', inputMode: 'decimal' },
        { name: 'nombre', label: 'Nombre', type: 'text', validations: { required: true } },
      ]);
      const etiquetas = Array.from(el().querySelectorAll('.form-field__label')).map((l) => l.textContent!.replace(/\s+/g, ' ').trim());
      expect(etiquetas).toEqual(['Notas (opcional)', 'Latitud', 'Nombre *']);
      expect(el().querySelector('.form-field__optional')!.textContent).toBe(' (opcional)');
      expect(el().querySelector<HTMLInputElement>('#latitud')!.getAttribute('inputmode')).toBe('decimal');
      expect(el().querySelector<HTMLInputElement>('#nombre')!.hasAttribute('inputmode')).toBeFalse();
      expect(el().querySelector('textarea#notas')).not.toBeNull();
    });

    it('`autocomplete` llega al control; sin declararlo no se emite (salvo `mono`, que va con "off")', async () => {
      await crear([
        { name: 'latitud', label: 'Latitud', type: 'text', autocomplete: 'off' },
        { name: 'correo', label: 'Correo', type: 'email', autocomplete: 'email' },
        { name: 'clave', label: 'Clave', type: 'password', autocomplete: 'new-password' },
        { name: 'notas', label: 'Notas', type: 'textarea', autocomplete: 'off' },
        { name: 'nombre', label: 'Nombre', type: 'text' },
        { name: 'codigo', label: 'Código', type: 'text', mono: true },
        { name: 'usuario', label: 'Usuario', type: 'text', mono: true, autocomplete: 'username' },
      ]);
      const autocomplete = (id: string): string | null => el().querySelector(`#${id}`)!.getAttribute('autocomplete');

      expect(autocomplete('latitud')).toBe('off');
      expect(autocomplete('correo')).toBe('email');
      expect(autocomplete('clave')).toBe('new-password');
      expect(autocomplete('notas')).toBe('off');
      expect(autocomplete('nombre')).toBeNull();
      expect(autocomplete('codigo')).toBe('off');
      expect(autocomplete('usuario')).toBe('username');
    });

    it('un `tip` con tono de alerta se dibuja como advertencia; sin tono, como nota informativa', async () => {
      await crear([
        { name: '_alerta', label: '', type: 'tip', tono: 'alerta', placeholder: 'Esto no se guarda.' },
        { name: '_nota', label: 'Dato', type: 'tip', placeholder: 'Para saber.' },
      ]);
      const alerta = el().querySelector('.form-aviso[role="note"]')!;
      expect(alerta.textContent!.trim()).toBe('Esto no se guarda.');
      expect(alerta.querySelector('i.ph-warning')).not.toBeNull();
      expect(el().querySelectorAll('.tip-field').length).toBe(1);
      expect(el().querySelector('.tip-field')!.textContent).toContain('Para saber.');
    });
  });

  describe('ids de los campos (son su `name`)', () => {
    const campos: FieldConfig[] = [
      { name: 'nombre', label: 'Nombre', type: 'text' },
      { name: 'detalle', label: 'Detalle', type: 'text' },
    ];
    let ajeno: HTMLElement | undefined;
    afterEach(() => ajeno?.remove());

    it('en desarrollo avisa si un id suyo ya existe en el documento fuera del formulario', async () => {
      const aviso = spyOn(console, 'warn');
      ajeno = document.createElement('input');
      ajeno.id = 'nombre';
      document.body.append(ajeno);

      await crear(campos);

      expect(aviso).toHaveBeenCalledTimes(1);
      expect(aviso.calls.mostRecent().args[0]).toContain('Ids repetidos en el documento: nombre.');
    });

    it('sin ids repetidos no avisa (los propios no cuentan)', async () => {
      const aviso = spyOn(console, 'warn');

      await crear(campos);

      expect(aviso).not.toHaveBeenCalled();
    });
  });
});
