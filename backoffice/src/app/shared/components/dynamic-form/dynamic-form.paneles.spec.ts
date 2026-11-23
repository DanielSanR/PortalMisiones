import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FieldConfig, PanelDeFormulario } from '@core/models/field.interface';
import { CampoPropioDirective } from '@shared/directives/campo-propio.directive';
import { DynamicFormComponent } from './dynamic-form.component';

const CAMPOS: FieldConfig[] = [
  { name: 'codigo', label: 'Código', type: 'text', mono: true, transformar: (valor) => valor.toUpperCase().replace(/\s/g, '_') },
  { name: 'descripcion', label: 'Descripción', type: 'text', validations: { required: true } },
  { name: 'activo', label: 'Rol activo', type: 'checkbox', value: true, hint: 'Un rol inactivo queda fuera de uso.' },
  { name: 'permisos', label: 'Permisos', type: 'custom', value: [] },
  { name: 'pasos', label: 'Qué sigue', type: 'vista' },
  {
    name: 'categorias', label: 'Categorías', type: 'select-multiple', value: ['a'],
    seleccion: { nombre: 'categorías', textoVacio: 'Ninguna categoría elegida.' },
    options: [{ id: 'a', name: 'Salud' }, { id: 'b', name: 'Tránsito' }], optionsLoaded: true,
  },
  {
    name: 'etiquetas', label: 'Etiquetas', type: 'select-multiple', value: [],
    options: [{ id: 'x', name: 'urgente' }], optionsLoaded: true,
  },
  { name: 'oculto', label: 'Fuera de los paneles', type: 'text', value: 'viaja igual' },
];

const PANELES: PanelDeFormulario[] = [
  {
    id: 'prueba-datos', titulo: 'Datos del rol', subtitulo: 'Los cambios se aplican al guardar',
    campos: ['codigo', 'descripcion'], opciones: ['activo'],
  },
  {
    id: 'prueba-lateral', titulo: 'Clasificación', total: '1 opción elegida', lateral: true, cuerpo: 'grupos',
    campos: [['categorias', 'pasos'], 'etiquetas', 'no-existe'],
  },
];

@Component({
  standalone: true,
  imports: [DynamicFormComponent, CampoPropioDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dynamic-form [fields]="campos" [paneles]="paneles" [panelesIguales]="iguales" [requireChanges]="true"
                      submitButtonText="Guardar cambios" helpText="" (formSubmit)="enviado = $event">
      <ng-template appCampoPropio="permisos" let-grupo>
        <button type="button" class="propio-permisos" (click)="grupo.get('permisos')?.setValue(['p1']); grupo.get('permisos')?.markAsDirty()">
          {{ grupo.get('permisos')?.value.length }} permisos
        </button>
      </ng-template>
      <ng-template appCampoPropio="pasos"><p class="propio-pasos">Después de crearla</p></ng-template>
      <div formAviso class="aviso-de-pagina">No pudimos cargar: etiquetas.</div>
      <span formActionsInfo class="indicador-de-pagina">1 permiso asignado</span>
    </app-dynamic-form>`,
})
class HostComponent {
  campos = CAMPOS;
  paneles: PanelDeFormulario[] | null = PANELES;
  iguales = false;
  enviado: Record<string, unknown> | null = null;
  @ViewChild(DynamicFormComponent) motor!: DynamicFormComponent;
}

/** Layout de paneles, campos propios en su lugar, selección múltiple y transformación mientras se escribe. */
describe('DynamicFormComponent — paneles y campos propios', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const el = (): HTMLElement => fixture.nativeElement;
  const secciones = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('section.ficha-paneles__panel'));

  async function refrescar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable(); // @defer de interruptores y selección múltiple
    fixture.detectChanges();
  }

  async function crear(cambios: Partial<HostComponent> = {}): Promise<void> {
    await TestBed.configureTestingModule({ imports: [HostComponent, NoopAnimationsModule] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    Object.assign(host, cambios);
    await refrescar();
  }

  describe('`paneles`: la tarjeta de dos paneles', () => {
    it('dibuja una sección por panel, nombrada por su título, dentro de UNA tarjeta', async () => {
      await crear();

      expect(el().querySelectorAll('.ficha-paneles').length).toBe(1);
      expect(el().querySelector('.form-fields')).toBeNull();
      expect(secciones().map((s) => s.getAttribute('aria-labelledby'))).toEqual(['prueba-datos', 'prueba-lateral']);
      expect(el().querySelector('h3#prueba-datos.ficha-paneles__titulo')!.textContent).toBe('Datos del rol');
      expect(secciones()[0].querySelector('.ficha-paneles__subtitulo')!.textContent).toBe('Los cambios se aplican al guardar');
      expect(secciones()[1].querySelector('.ficha-paneles__subtitulo')).toBeNull();
    });

    it('el panel lateral lleva su modificador y `panelesIguales` reparte el ancho por igual', async () => {
      await crear({ iguales: true });

      expect(secciones()[0].classList).not.toContain('ficha-paneles__panel--lateral');
      expect(secciones()[1].classList).toContain('ficha-paneles__panel--lateral');
      expect(el().querySelector('.ficha-paneles__grid')!.classList).toContain('ficha-paneles__grid--iguales');
    });

    it('el total del panel es una región viva; el que no lo declara no la tiene', async () => {
      await crear();

      const total = secciones()[1].querySelector('.ficha-paneles__total')!;
      expect(total.getAttribute('role')).toBe('status');
      expect(total.textContent).toBe('1 opción elegida');
      expect(secciones()[0].querySelector('.ficha-paneles__total')).toBeNull();
    });

    it('por defecto apila los campos en el cuerpo y manda las `opciones` al pie del panel', async () => {
      await crear();

      const campos = secciones()[0].querySelector('.ficha-paneles__cuerpo > .ficha-paneles__campos')!;
      expect(Array.from(campos.querySelectorAll('input')).map((i) => i.id)).toEqual(['codigo', 'descripcion']);
      const opciones = secciones()[0].querySelectorAll('.ficha-paneles__cuerpo > .ficha-paneles__opciones > .ficha-paneles__opcion');
      expect(opciones.length).toBe(1);
      expect(opciones[0].textContent).toContain('Rol activo');
      expect(opciones[0].textContent).toContain('Un rol inactivo queda fuera de uso.');
    });

    it('con `cuerpo: "grupos"` cada entrada es un grupo, que puede reunir varios campos; un nombre inexistente se ignora', async () => {
      await crear();

      const grupos = Array.from(secciones()[1].querySelectorAll<HTMLElement>(':scope > .ficha-paneles__grupo'));
      expect(grupos.length).toBe(2);
      expect(grupos[0].querySelector('app-seleccion-multiple')).not.toBeNull();
      expect(grupos[0].querySelector('.propio-pasos')!.textContent).toBe('Después de crearla');
      expect(grupos[1].textContent).toContain('Etiquetas');
      expect(secciones()[1].querySelector('.ficha-paneles__cuerpo')).toBeNull();
    });

    it('con `cuerpo: "grupos"`, un grupo que es solo una `vista` de la página va de borde a borde (sin aire ni divisor)', async () => {
      await crear({
        paneles: [
          PANELES[0],
          { id: 'prueba-lateral', titulo: 'Clasificación', lateral: true, cuerpo: 'grupos', campos: ['categorias', 'pasos'] },
        ],
      });

      const grupos = Array.from(secciones()[1].querySelectorAll<HTMLElement>(':scope > .ficha-paneles__grupo'));
      expect(grupos.map((g) => g.classList.contains('ficha-paneles__grupo--corrido'))).toEqual([false, true]);
      expect(grupos[1].querySelector('.propio-pasos')!.textContent).toBe('Después de crearla');
    });

    it('un grupo que mezcla un campo con una `vista` conserva el aire y el divisor', async () => {
      await crear();

      const grupos = Array.from(secciones()[1].querySelectorAll<HTMLElement>(':scope > .ficha-paneles__grupo'));
      expect(grupos.some((g) => g.classList.contains('ficha-paneles__grupo--corrido'))).toBeFalse();
    });

    it('con `cuerpo: "libre"` y `acotado` el contenido va sin envoltorio dentro del ajuste del panel', async () => {
      await crear({
        paneles: [
          PANELES[0],
          { id: 'prueba-permisos', titulo: 'Permisos', lateral: true, acotado: true, cuerpo: 'libre', campos: ['permisos'] },
        ],
      });

      const panel = secciones()[1];
      expect(panel.classList).toContain('ficha-paneles__panel--acotado');
      expect(panel.querySelector(':scope > .ficha-paneles__ajuste > .ficha-paneles__cabecera')).not.toBeNull();
      expect(panel.querySelector(':scope > .ficha-paneles__ajuste > .propio-permisos')).not.toBeNull();
    });

    it('el pie de guardar va integrado en la tarjeta, una sola vez, con el indicador de la página', async () => {
      await crear();

      expect(el().querySelectorAll('app-form-actions').length).toBe(1);
      const pie = el().querySelector('.ficha-paneles > app-form-actions .form-actions')!;
      expect(pie.classList).toContain('form-actions--integrada');
      expect(pie.querySelector('.form-actions__info .indicador-de-pagina')!.textContent).toBe('1 permiso asignado');
      expect(pie.querySelector('button[type="submit"]')!.textContent).toContain('Guardar cambios');
    });

    it('el aviso de la página (`formAviso`) queda sobre la tarjeta, dentro del formulario', async () => {
      await crear();

      const aviso = el().querySelector('form > .aviso-de-pagina')!;
      expect(aviso.compareDocumentPosition(el().querySelector('.ficha-paneles')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('un campo que no figura en ningún panel no se dibuja, pero su valor viaja', async () => {
      await crear();

      expect(el().querySelector('#oculto')).toBeNull();
      host.motor.form.get('descripcion')!.setValue('Editor');
      host.motor.form.markAsDirty();
      host.motor.submit();
      expect(host.enviado!['oculto']).toBe('viaja igual');
    });

    it('enviar inválido muestra el resumen con foco, igual que en la grilla', async () => {
      await crear();

      host.motor.submit();
      fixture.detectChanges();

      const resumen = el().querySelector<HTMLElement>('app-form-error-banner .form-error-banner')!;
      expect(resumen.textContent).toContain('Descripción');
      expect(el().ownerDocument.activeElement).toBe(resumen);
      expect(host.enviado).toBeNull();
    });

    it('sin `paneles` dibuja la grilla de siempre, con su pie', async () => {
      await crear({ paneles: null });

      expect(el().querySelector('.ficha-paneles')).toBeNull();
      expect(el().querySelector('.form-fields #codigo')).not.toBeNull();
      expect(el().querySelector('.form-fields #oculto')).not.toBeNull();
      expect(el().querySelector('.form-actions--integrada')).toBeNull();
    });
  });

  describe('`appCampoPropio`: el widget de la página en el lugar del campo', () => {
    it('en la grilla, un `custom` con template se dibuja en su orden entre los campos', async () => {
      await crear({ paneles: null });

      const hijos = Array.from(el().querySelector('.form-fields')!.children);
      const propio = hijos.findIndex((nodo) => nodo.classList.contains('propio-permisos'));
      expect(propio).toBeGreaterThan(hijos.findIndex((nodo) => !!nodo.querySelector('#descripcion')));
      expect(propio).toBeLessThan(hijos.findIndex((nodo) => !!nodo.querySelector('app-seleccion-multiple')));
    });

    it('recibe el grupo: lo que escribe cuenta como cambio y viaja en el envío', async () => {
      await crear({
        paneles: [{ id: 'prueba-todo', titulo: 'Todo', campos: ['descripcion', 'permisos'] }],
      });
      host.motor.form.get('descripcion')!.setValue('Editor');
      expect(host.motor.sinCambios).toBeTrue();

      el().querySelector<HTMLButtonElement>('.propio-permisos')!.click();
      fixture.detectChanges();

      expect(el().querySelector('.propio-permisos')!.textContent).toContain('1 permisos');
      expect(host.motor.sinCambios).toBeFalse();
      host.motor.submit();
      expect(host.enviado!['permisos']).toEqual(['p1']);
    });
  });

  describe('`select-multiple`: lo dibuja `app-seleccion-multiple`', () => {
    it('lleva su propia etiqueta con contador (sin label externo) y los textos de `seleccion`', async () => {
      await crear();

      const grupo = secciones()[1].querySelector('.ficha-paneles__grupo')!;
      expect(grupo.querySelector('label.form-field__label')).toBeNull();
      expect(grupo.querySelector('.perm-group__label')!.textContent).toBe('Categorías');
      expect(grupo.querySelector('.perm-group__count')!.textContent).toContain('1 de 2');
      expect(secciones()[1].textContent).toContain('Ninguna opción elegida.');
    });

    it('quitar un chip cambia el valor del control y cuenta como cambio', async () => {
      await crear();

      el().querySelector<HTMLButtonElement>('button[aria-label="Quitar Salud"]')!.click();
      fixture.detectChanges();

      expect(host.motor.form.get('categorias')!.value).toEqual([]);
      expect(host.motor.form.dirty).toBeTrue();
      expect(secciones()[1].textContent).toContain('Ninguna categoría elegida.');
    });

    it('queda abierta una sola lista a la vez', async () => {
      await crear();
      const alternar = (): HTMLButtonElement[] => Array.from(el().querySelectorAll<HTMLButtonElement>('.seleccion-multiple__alternar'));

      alternar()[0].click();
      fixture.detectChanges();
      expect(alternar().map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'false']);

      alternar()[1].click();
      fixture.detectChanges();
      expect(alternar().map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'true']);
    });
  });

  describe('`transformar`: normaliza mientras se escribe', () => {
    function tipear(valor: string, cursor = valor.length): HTMLInputElement {
      const input = el().querySelector<HTMLInputElement>('#codigo')!;
      input.value = valor;
      input.setSelectionRange(cursor, cursor);
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      return input;
    }

    it('lo escrito queda transformado en el campo y en el control, marcado como cambio', async () => {
      await crear();

      const input = tipear('editor de tramites');

      expect(input.value).toBe('EDITOR_DE_TRAMITES');
      expect(host.motor.form.get('codigo')!.value).toBe('EDITOR_DE_TRAMITES');
      expect(host.motor.form.get('codigo')!.dirty).toBeTrue();
    });

    it('conserva el cursor junto al mismo carácter, también si el texto crece', async () => {
      await crear();

      expect(tipear('ab cd', 2).selectionStart).toBe(2);
      expect(tipear('ßx', 1).selectionStart).toBe(2); // `ß` → `SS`
    });

    it('no toca el valor mientras un IME compone; lo normaliza al terminar', async () => {
      await crear();
      const input = el().querySelector<HTMLInputElement>('#codigo')!;

      input.value = 'ab';
      input.dispatchEvent(new InputEvent('input', { isComposing: true }));
      expect(input.value).toBe('ab');

      input.dispatchEvent(new Event('compositionend'));
      expect(input.value).toBe('AB');
      expect(host.motor.form.get('codigo')!.value).toBe('AB');
    });
  });
});
