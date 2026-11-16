import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { EMPTY, NEVER, Subject, of, throwError } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FieldConfig } from '@core/models/field.interface';
import { DynamicFormComponent } from '../dynamic-form/dynamic-form.component';
import { FormDialogComponent, FormDialogData } from './form-dialog.component';

const CAMPOS: FieldConfig[] = [
  { name: 'nombre', label: 'Nombre', type: 'text', validations: { required: true } },
  { name: 'detalle', label: 'Detalle', type: 'text' },
];

/** Configuración de prueba: nada de dominio, solo el contrato de `FormDialogData`. */
function config(extra: Partial<FormDialogData<string>> = {}): FormDialogData<string> {
  return {
    titulo: 'Nueva cosa',
    textoGuardar: 'Crear cosa',
    cargar: () => of({ fields: CAMPOS, initialData: null }),
    guardar: () => of('guardado'),
    ...extra,
  };
}

describe('FormDialogComponent', () => {
  let fixture: ComponentFixture<FormDialogComponent>;
  let close: jasmine.Spy;
  let dialogRef: { close: jasmine.Spy; disableClose: boolean; backdropClick: () => Subject<MouseEvent>; keydownEvents: () => Subject<KeyboardEvent> };
  let backdropClick: Subject<MouseEvent>;
  let keydown: Subject<KeyboardEvent>;
  let matDialog: jasmine.SpyObj<MatDialog>;

  const form = (): DynamicFormComponent =>
    fixture.debugElement.query(By.directive(DynamicFormComponent)).componentInstance;
  const texto = (): string => fixture.nativeElement.textContent;
  const el = <T extends HTMLElement = HTMLElement>(selector: string): T | null => fixture.nativeElement.querySelector(selector);
  const pieGuardar = (): HTMLButtonElement => el('.dialogo-formulario__pie button:last-child')!;

  /** Hace que el usuario "escriba" algo: el control queda dirty y el diálogo se entera por `valueChanges`. */
  function ensuciar(): void {
    const nombre = form().form.get('nombre')!;
    nombre.setValue('Cambiado');
    nombre.markAsDirty();
    form().valueChanges.emit(form().form.getRawValue());
    fixture.detectChanges();
  }

  async function abrir(data: FormDialogData<string>): Promise<void> {
    close = jasmine.createSpy('close');
    backdropClick = new Subject<MouseEvent>();
    keydown = new Subject<KeyboardEvent>();
    dialogRef = { close, disableClose: false, backdropClick: () => backdropClick, keydownEvents: () => keydown };
    matDialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    matDialog.open.and.returnValue({ afterClosed: () => of(true) } as never);

    await TestBed.configureTestingModule({
      imports: [FormDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    })
      // `overrideProvider` y no `providers`: el componente importa `MatDialogModule`, que trae su propio
      // `MatDialog` y le ganaría al del TestBed.
      .overrideProvider(MatDialog, { useValue: matDialog })
      .compileComponents();

    fixture = TestBed.createComponent(FormDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable(); // `cargar()` espera la carga
    fixture.detectChanges();
    await fixture.whenStable(); // @defer de los selects
    fixture.detectChanges();
  }

  /** Deja correr las promesas pendientes (la carga del diálogo es `async`) y repinta. */
  async function asentar(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  describe('marco', () => {
    it('titula con `titulo`, se nombra con mat-dialog-title y la X tiene nombre accesible', async () => {
      await abrir(config());

      expect(el('h2[mat-dialog-title]')!.textContent).toContain('Nueva cosa');
      expect(el('.dialogo-formulario__cerrar')!.getAttribute('aria-label')).toBe('Cerrar');
    });

    it('al terminar de cargar, el foco va al primer campo', async () => {
      await abrir(config());

      expect(document.activeElement).toBe(el('input#nombre'));
    });

    it('el botón del pie envía el <form> del motor por su id (así Enter también envía)', async () => {
      await abrir(config({ formId: 'mi-form' }));

      const enviar = el<HTMLButtonElement>('.dialogo-formulario__pie button[type="submit"]')!;
      expect(enviar.textContent).toContain('Crear cosa');
      expect(enviar.getAttribute('form')).toBe('mi-form');
      expect(el('form#mi-form.dynamic-form--compacto')).not.toBeNull();
    });

    it('entrega al formulario los campos y los iniciales de la carga', async () => {
      await abrir(config({ cargar: () => of({ fields: CAMPOS, initialData: { nombre: 'Ana' } }) }));

      expect(fixture.componentInstance.fields).toBe(CAMPOS);
      expect(form().form.get('nombre')?.value).toBe('Ana');
    });
  });

  describe('carga', () => {
    it('mientras carga muestra el estado de carga y no el formulario', async () => {
      await abrir(config({ cargar: () => NEVER }));

      expect(el('[role="status"]')).not.toBeNull();
      expect(el('app-dynamic-form')).toBeNull();
      expect(el('.dialogo-formulario__pie')).toBeNull();
    });

    it('si falla, muestra el motivo con "Reintentar" en vez del formulario, y reintentar vuelve a cargar', async () => {
      const cargar = jasmine.createSpy('cargar').and.returnValue(throwError(() => ({ error: { code: 5000 } })));
      await abrir(config({
        cargar,
        errorDeCarga: () => ({ titulo: 'No pudimos cargar el formulario', texto: 'Sin conexión con roles', reintentable: true }),
      }));

      expect(el('app-dynamic-form')).toBeNull();
      expect(texto()).toContain('No pudimos cargar el formulario');
      expect(texto()).toContain('Sin conexión con roles');
      expect(el('.dialogo-formulario__pie')).toBeNull();
      const reintentar = el<HTMLButtonElement>('.state-panel__cta')!;
      expect(reintentar.textContent).toContain('Reintentar');
      expect(document.activeElement).toBe(reintentar);

      cargar.and.returnValue(of({ fields: CAMPOS, initialData: null }));
      reintentar.click();
      await asentar();

      expect(el('app-dynamic-form')).not.toBeNull();
      expect(fixture.componentInstance.errorCarga).toBeNull();
      expect(cargar).toHaveBeenCalledTimes(2);
    });

    it('sin `errorDeCarga` usa el mensaje genérico con "Reintentar"', async () => {
      await abrir(config({ cargar: () => throwError(() => new Error('x')) }));

      expect(texto()).toContain('No pudimos cargar el formulario');
      expect(el('.state-panel__cta')!.textContent).toContain('Reintentar');
    });

    it('un error no reintentable ("no disponible") ofrece solo "Cerrar", con el foco ahí', async () => {
      await abrir(config({
        cargar: () => throwError(() => new Error('x')),
        errorDeCarga: () => ({ titulo: 'Edición no disponible', texto: 'Todavía no.', ayuda: 'Probá desde la lista.', reintentable: false }),
      }));

      expect(texto()).toContain('Edición no disponible');
      expect(texto()).toContain('Probá desde la lista.');
      expect(texto()).not.toContain('Reintentar');
      const cerrar = el<HTMLButtonElement>('.state-panel__cta')!;
      expect(cerrar.textContent).toContain('Cerrar');
      expect(document.activeElement).toBe(cerrar);

      cerrar.click();
      await fixture.whenStable();
      expect(close).toHaveBeenCalledTimes(1);
    });
  });

  describe('alCambiar', () => {
    it('con `null` no recrea los campos; con un array los reemplaza', async () => {
      const alCambiar = jasmine.createSpy('alCambiar').and.returnValue(null);
      await abrir(config({ alCambiar }));
      const antes = fixture.componentInstance.fields;

      form().valueChanges.emit({ nombre: 'a' });
      expect(alCambiar).toHaveBeenCalledOnceWith({ nombre: 'a' });
      expect(fixture.componentInstance.fields).toBe(antes);

      const nuevos: FieldConfig[] = [CAMPOS[0]];
      alCambiar.and.returnValue(nuevos);
      form().valueChanges.emit({ nombre: 'ab' });
      expect(fixture.componentInstance.fields).toBe(nuevos);
    });
  });

  describe('guardado', () => {
    it('guarda con el valor del form y cierra devolviendo lo que devolvió `guardar`', async () => {
      const guardar = jasmine.createSpy('guardar').and.returnValue(of('guardado'));
      await abrir(config({ guardar }));

      await fixture.componentInstance.onSubmit({ nombre: 'Ana' });

      expect(guardar).toHaveBeenCalledOnceWith({ nombre: 'Ana' });
      expect(close).toHaveBeenCalledOnceWith('guardado');
    });

    it('si falla: el error queda en el diálogo y en el campo, no cierra y libera el form', async () => {
      const errorDeGuardado = jasmine.createSpy('errorDeGuardado').and.callFake((_err: unknown, f: { get: (n: string) => { setErrors: (e: unknown) => void } }) => {
        f.get('nombre').setErrors({ server: 'Ya existe' });
        return 'Revisá el campo marcado.';
      });
      await abrir(config({ guardar: () => throwError(() => ({ error: { code: 4002 } })), errorDeGuardado }));

      await fixture.componentInstance.onSubmit({ nombre: 'Ana' });
      fixture.detectChanges();

      expect(errorDeGuardado).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.guardando).toBeFalse();
      expect(fixture.componentInstance.serverError).toBe('Revisá el campo marcado.');
      expect(el('.dialogo-formulario__error [role="alert"]')).not.toBeNull();
      expect(form().form.get('nombre')?.hasError('server')).toBeTrue();
      expect(close).not.toHaveBeenCalled();
    });

    it('sin `errorDeGuardado` muestra el mensaje del backend', async () => {
      await abrir(config({ guardar: () => throwError(() => ({ error: { code: 5000, message: 'Roto' } })) }));

      await fixture.componentInstance.onSubmit({ nombre: 'Ana' });

      expect(fixture.componentInstance.serverError).toBe('Roto');
    });

    it('si el guardado completa sin responder (stream vacío) con el diálogo vivo, el form no queda trabado', async () => {
      await abrir(config({ guardar: () => EMPTY }));

      await fixture.componentInstance.onSubmit({ nombre: 'Ana' });

      expect(fixture.componentInstance.guardando).toBeFalse();
      expect(fixture.componentInstance.serverError).toBe('No se pudo guardar. Intentá de nuevo.');
      expect(close).not.toHaveBeenCalled();
    });

    it('si el diálogo se destruye con el guardado en vuelo, no cierra ni avisa', async () => {
      await abrir(config({ guardar: () => NEVER }));

      const guardado = fixture.componentInstance.onSubmit({ nombre: 'Ana' });
      fixture.destroy();
      await guardado;

      expect(fixture.componentInstance.serverError).toBe('');
      expect(close).not.toHaveBeenCalled();
    });

    it('no envía dos veces mientras guarda, muestra "Guardando…" y bloquea el cierre', async () => {
      const guardar = jasmine.createSpy('guardar').and.returnValue(NEVER);
      await abrir(config({ guardar, textoGuardando: 'Creando…' }));

      void fixture.componentInstance.onSubmit({ nombre: 'Ana' });
      void fixture.componentInstance.onSubmit({ nombre: 'Ana' });
      fixture.detectChanges();

      expect(guardar).toHaveBeenCalledTimes(1);
      expect(el('.dialogo-formulario__pie button[type="submit"]')!.textContent).toContain('Creando…');
      expect(el('.dialogo-formulario__pie .ph-spinner-gap')).not.toBeNull();

      await fixture.componentInstance.intentarCerrar();
      expect(close).not.toHaveBeenCalled();
      expect(matDialog.open).not.toHaveBeenCalled();
    });
  });

  describe('requiereCambios', () => {
    it('"Guardar" queda bloqueado (aria-disabled, no `disabled`) hasta que cambie algo', async () => {
      await abrir(config({
        requiereCambios: true, textoGuardar: 'Guardar cambios',
        cargar: () => of({ fields: CAMPOS, initialData: { nombre: 'Ana' } }),
      }));

      expect(pieGuardar().getAttribute('aria-disabled')).toBe('true');
      expect(pieGuardar().type).toBe('button');

      ensuciar();

      expect(pieGuardar().getAttribute('aria-disabled')).toBeNull();
      expect(pieGuardar().type).toBe('submit');
    });
  });

  describe('cierre con confirmación (X, Cancelar, Escape y clic afuera)', () => {
    const confirmando = (): FormDialogData<string> => config({ mensajeDescartar: 'Se pierde.' });

    it('arranca con el cierre automático bloqueado: todo pasa por la confirmación', async () => {
      await abrir(confirmando());

      expect(dialogRef.disableClose).toBeTrue();
    });

    it('sin cambios, cierra directo (X, Cancelar, Escape y clic afuera) sin preguntar', async () => {
      await abrir(confirmando());

      await fixture.componentInstance.intentarCerrar();
      keydown.next(new KeyboardEvent('keydown', { key: 'Escape' }));
      backdropClick.next(new MouseEvent('click'));
      await fixture.whenStable();

      expect(matDialog.open).not.toHaveBeenCalled();
      expect(close).toHaveBeenCalledTimes(3);
    });

    it('el segundo clic de un doble clic (cae en el fondo recién creado) no cierra el diálogo', async () => {
      await abrir(confirmando());

      backdropClick.next(new MouseEvent('click', { detail: 2 }));
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
    });

    it('con cambios, pregunta con el texto configurado: "Seguir editando" no cierra y "Descartar" sí', async () => {
      await abrir(confirmando());
      ensuciar();

      matDialog.open.and.returnValue({ afterClosed: () => of(false) } as never);
      await fixture.componentInstance.intentarCerrar();
      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open.calls.mostRecent().args[1]?.data).toEqual(jasmine.objectContaining({ message: 'Se pierde.' }));
      expect(close).not.toHaveBeenCalled();

      matDialog.open.and.returnValue({ afterClosed: () => of(true) } as never);
      await fixture.componentInstance.intentarCerrar();
      expect(close).toHaveBeenCalledOnceWith();
    });

    it('Escape y el clic afuera pasan por la misma confirmación (las otras teclas no)', async () => {
      await abrir(confirmando());
      ensuciar();
      matDialog.open.and.returnValue({ afterClosed: () => of(false) } as never);

      const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      keydown.next(escape);
      keydown.next(new KeyboardEvent('keydown', { key: 'Tab' }));
      await asentar();
      backdropClick.next(new MouseEvent('click'));
      await asentar();

      expect(escape.defaultPrevented).toBeTrue();
      expect(matDialog.open).toHaveBeenCalledTimes(2);
      expect(close).not.toHaveBeenCalled();
    });

    it('no apila una segunda pregunta mientras hay una abierta', async () => {
      await abrir(confirmando());
      ensuciar();
      matDialog.open.and.returnValue({ afterClosed: () => NEVER } as never);

      void fixture.componentInstance.intentarCerrar();
      void fixture.componentInstance.intentarCerrar();

      expect(matDialog.open).toHaveBeenCalledTimes(1);
    });
  });

  describe('cierre con el texto por defecto', () => {
    it('con cambios, la X y Cancelar también preguntan (nadie cierra directo con algo sin guardar)', async () => {
      await abrir(config());
      ensuciar();
      matDialog.open.and.returnValue({ afterClosed: () => of(false) } as never);

      await fixture.componentInstance.intentarCerrar();

      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open.calls.mostRecent().args[1]?.data)
        .toEqual(jasmine.objectContaining({ message: 'Hay cambios sin guardar. Si cerrás ahora se pierden.' }));
      expect(close).not.toHaveBeenCalled();
    });

    it('Escape y el clic afuera nunca cierran solos: el cierre automático queda bloqueado desde el inicio', async () => {
      await abrir(config());

      expect(dialogRef.disableClose).toBeTrue();
    });

    it('guardando no se cierra por ningún camino', async () => {
      await abrir(config({ guardar: () => NEVER }));
      form().form.get('nombre')!.setValue('Algo');
      void fixture.componentInstance.onSubmit({ nombre: 'Algo' });

      await fixture.componentInstance.intentarCerrar();
      keydown.next(new KeyboardEvent('keydown', { key: 'Escape' }));
      backdropClick.next(new MouseEvent('click'));
      await fixture.whenStable();

      expect(close).not.toHaveBeenCalled();
      expect(matDialog.open).not.toHaveBeenCalled();
    });
  });
});
