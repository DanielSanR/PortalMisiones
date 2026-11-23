import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NEVER, of } from 'rxjs';
import { DynamicFormComponent } from '../../dynamic-form/dynamic-form.component';
import { FormDialogComponent, FormDialogData } from '../form-dialog.component';

/** Un `FormDialogComponent` montado con la configuración real de un `<x>-dialogo.ts`, para probar lo que se ve. */
export interface FormDialogDePrueba {
  fixture: ComponentFixture<FormDialogComponent>;
  el: HTMLElement;
  /** `close` del `MatDialogRef`: con qué cerró (lo que devolvió `guardar`). */
  close: jasmine.Spy;
  /** `MatDialog.open`: la confirmación de descarte. Por defecto responde "Seguir editando". */
  confirmacion: jasmine.Spy;
  form: () => FormGroup;
  /** Escribe en un `input` o `textarea` por su `id` (el `name` del campo), como la persona: queda dirty y touched. */
  tipear: (campo: string, valor: string) => void;
  /** Cambia un control que no es de texto (select, interruptor, árbol) como si lo hubiera elegido la persona. */
  elegir: (campo: string, valor: unknown) => void;
  /** Envía el formulario (lo que hace "Guardar" o Enter) y espera el resultado. */
  enviar: () => Promise<void>;
  /** Deja correr lo pendiente (carga, `@defer`, guardado) y repinta. */
  asentar: () => Promise<void>;
  textoDe: (selector: string) => string;
  /** Errores visibles bajo los campos, en orden. */
  errores: () => string[];
  /** Etiquetas de los campos, en orden ("Nombre *", "Horarios (opcional)"). */
  etiquetas: () => string[];
  /** Botón de guardar del pie. */
  guardar: () => HTMLButtonElement;
  /** Banner de guardado rechazado (título + motivo), o `''`. */
  banner: () => string;
  cerrar: () => Promise<void>;
}

const limpio = (texto: string | null | undefined): string => (texto ?? '').replace(/\s+/g, ' ').trim();

export async function montarFormDialog<R>(data: FormDialogData<R>): Promise<FormDialogDePrueba> {
  const close = jasmine.createSpy('close');
  const confirmacion = jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(false) });

  await TestBed.configureTestingModule({
    imports: [FormDialogComponent, NoopAnimationsModule],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close, disableClose: false, backdropClick: () => NEVER, keydownEvents: () => NEVER } },
    ],
  })
    // `overrideProvider`: el componente importa `MatDialogModule`, que trae su propio `MatDialog`.
    .overrideProvider(MatDialog, { useValue: { open: confirmacion } })
    .compileComponents();

  const fixture = TestBed.createComponent(FormDialogComponent);
  const el: HTMLElement = fixture.nativeElement;
  const asentar = async (): Promise<void> => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  };
  await asentar();

  const motor = (): DynamicFormComponent => fixture.debugElement.query(By.directive(DynamicFormComponent)).componentInstance;
  const form = (): FormGroup => motor().form;

  return {
    fixture, el, close, confirmacion, form, asentar,
    tipear: (campo, valor) => {
      const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${campo}`)!;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    },
    elegir: (campo, valor) => {
      const control = form().get(campo)!;
      control.markAsDirty();
      control.markAsTouched();
      control.setValue(valor);
      fixture.detectChanges();
    },
    enviar: async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await asentar();
    },
    textoDe: (selector) => limpio(el.querySelector(selector)?.textContent),
    errores: () => Array.from(el.querySelectorAll('mat-error, .form-field__error')).map((e) => limpio(e.textContent)).filter(Boolean),
    etiquetas: () => Array.from(el.querySelectorAll('.form-field__label')).map((l) => limpio(l.textContent)),
    guardar: () => el.querySelector<HTMLButtonElement>('.dialogo-formulario__pie button:last-child')!,
    banner: () => limpio(el.querySelector('.dialogo-formulario__error')?.textContent),
    cerrar: () => fixture.componentInstance.intentarCerrar(),
  };
}
