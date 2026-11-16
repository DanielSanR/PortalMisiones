import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormControl, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { DynamicFormComponent } from '@shared/components/dynamic-form/dynamic-form.component';
import { FormDialogComponent, FormDialogData } from '@shared/components/form-dialog';
import { CredencialDeUsuario, dialogoDeCredencial } from './usuario-credencial-dialogo';

function credencial(extra: Partial<CredencialDeUsuario> = {}): CredencialDeUsuario & { guardar: jasmine.Spy } {
  return {
    modo: 'email',
    nombre: 'María González',
    emailActual: 'maria@misiones.gob.ar',
    guardar: jasmine.createSpy('guardar').and.returnValue(of(undefined)),
    ...extra,
  } as CredencialDeUsuario & { guardar: jasmine.Spy };
}

describe('dialogoDeCredencial', () => {
  it('el texto de descarte dice qué no se cambia', () => {
    expect(dialogoDeCredencial(credencial()).mensajeDescartar)
      .toBe('Hay un email sin guardar. Si cerrás ahora no se cambia.');
    expect(dialogoDeCredencial(credencial({ modo: 'password' })).mensajeDescartar)
      .toBe('Hay una contraseña sin guardar. Si cerrás ahora no se cambia.');
  });

  describe('email', () => {
    it('abre con el email actual, dice de quién es y exige un cambio para guardar', async () => {
      const data = dialogoDeCredencial(credencial());
      const carga = await firstValueFrom(data.cargar());

      expect(data.titulo).toBe('Cambiar email');
      expect(data.subtitulo).toBe('de María González');
      expect(data.requiereCambios).toBeTrue();
      expect(carga.initialData).toEqual({ email: 'maria@misiones.gob.ar' });
      expect(carga.fields.map((campo) => campo.name)).toEqual(['email']);
    });

    it('el mismo email (sin importar mayúsculas ni espacios) no se acepta', async () => {
      const { fields } = await firstValueFrom(dialogoDeCredencial(credencial()).cargar());
      const validar = fields[0].validations!.validar!;

      expect(validar(' MARIA@misiones.gob.ar ')).toBe('Ingresá un email distinto al actual');
      expect(validar('otra@misiones.gob.ar')).toBeNull();
    });

    it('guarda el email recortado y cierra con `true`', async () => {
      const c = credencial();
      const guardado = await firstValueFrom(dialogoDeCredencial(c).guardar({ email: ' nueva@misiones.gob.ar ' }));

      expect(c.guardar).toHaveBeenCalledOnceWith('nueva@misiones.gob.ar');
      expect(guardado).toBeTrue();
    });
  });

  describe('contraseña', () => {
    const form = () => new FormGroup({ nueva: new FormControl('Clave1234'), repetida: new FormControl('Otra1234') });

    it('pide la contraseña dos veces, con la política del backend', async () => {
      const data = dialogoDeCredencial(credencial({ modo: 'password' }));
      const { fields, initialData } = await firstValueFrom(data.cargar());

      expect(data.titulo).toBe('Cambiar contraseña');
      expect(data.requiereCambios).toBeFalse();
      expect(initialData).toBeNull();
      expect(fields.map((campo) => campo.name)).toEqual(['nueva', 'repetida']);
      expect(fields[0].validations).toEqual(jasmine.objectContaining({ required: true, minLength: 8, maxLength: 20 }));
      const patron = new RegExp(fields[0].validations!.pattern!);
      expect(patron.test('Clave1234')).toBeTrue();
      expect(patron.test('clave1234')).toBeFalse();
    });

    it('si no coinciden no llama al backend y lo marca en "Repetir contraseña"', async () => {
      const c = credencial({ modo: 'password' });
      const data = dialogoDeCredencial(c);
      const f = form();

      const err = await firstValueFrom(data.guardar(f.getRawValue())).catch((e: unknown) => e);

      expect(c.guardar).not.toHaveBeenCalled();
      expect(data.errorDeGuardado!(err, f)).toBe('Revisá el campo marcado.');
      expect(f.controls.repetida.getError('server')).toBe('Las contraseñas no coinciden');
      expect(f.controls.repetida.touched).toBeTrue();
    });

    it('si coinciden guarda la nueva', async () => {
      const c = credencial({ modo: 'password' });
      await firstValueFrom(dialogoDeCredencial(c).guardar({ nueva: 'Clave1234', repetida: 'Clave1234' }));

      expect(c.guardar).toHaveBeenCalledOnceWith('Clave1234');
    });

    it('un rechazo del backend va al banner con su mensaje, o con el genérico', () => {
      const data = dialogoDeCredencial(credencial({ modo: 'password', guardar: () => throwError(() => new Error()) }));

      expect(data.errorDeGuardado!({ error: { code: 4000, message: 'La contraseña es débil' } }, form()))
        .toBe('La contraseña es débil');
      expect(data.errorDeGuardado!({}, form())).toBe('No se pudo guardar el cambio. Intentá de nuevo.');
    });
  });
});

/** Integración con el marco compartido: lo que depende de los controles reales del formulario y del cierre. */
describe('dialogoDeCredencial dentro de FormDialogComponent', () => {
  let fixture: ComponentFixture<FormDialogComponent>;
  let matDialog: jasmine.SpyObj<MatDialog>;
  let close: jasmine.Spy;
  let backdropClick: Subject<MouseEvent>;

  const form = (): DynamicFormComponent =>
    fixture.debugElement.query(By.directive(DynamicFormComponent)).componentInstance;
  const asentar = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

  async function abrir(data: FormDialogData<true>): Promise<void> {
    close = jasmine.createSpy('close');
    backdropClick = new Subject<MouseEvent>();
    matDialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    matDialog.open.and.returnValue({ afterClosed: () => of(false) } as never);
    await TestBed.configureTestingModule({
      imports: [FormDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        {
          provide: MatDialogRef,
          useValue: { close, disableClose: false, backdropClick: () => backdropClick, keydownEvents: () => new Subject<KeyboardEvent>() },
        },
      ],
    })
      .overrideProvider(MatDialog, { useValue: matDialog })
      .compileComponents();
    fixture = TestBed.createComponent(FormDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Lo que haría el usuario al tipear: el control queda dirty y el diálogo se entera. */
  function escribir(valores: Record<string, string>): void {
    for (const [nombre, valor] of Object.entries(valores)) {
      const control = form().form.get(nombre)!;
      control.setValue(valor);
      control.markAsDirty();
    }
    form().valueChanges.emit(form().form.getRawValue());
    fixture.detectChanges();
  }

  it('email: abre con el actual, "Guardar" bloqueado hasta que cambie, y cierra con `true` al guardar', async () => {
    const c = credencial();
    await abrir(dialogoDeCredencial(c));
    const guardar = (): HTMLButtonElement => fixture.nativeElement.querySelector('.dialogo-formulario__pie button:last-child');

    expect(fixture.nativeElement.querySelector('h2[mat-dialog-title]').textContent).toContain('Cambiar email');
    expect(form().form.get('email')?.value).toBe('maria@misiones.gob.ar');
    expect(guardar().getAttribute('aria-disabled')).toBe('true');

    escribir({ email: 'nueva@misiones.gob.ar' });
    expect(guardar().getAttribute('aria-disabled')).toBeNull();

    await fixture.componentInstance.onSubmit(form().form.getRawValue());
    expect(c.guardar).toHaveBeenCalledOnceWith('nueva@misiones.gob.ar');
    expect(close).toHaveBeenCalledOnceWith(true);
  });

  it('cerrar con algo escrito pregunta con el texto de credenciales; sin nada escrito cierra directo', async () => {
    await abrir(dialogoDeCredencial(credencial({ modo: 'password' })));

    await fixture.componentInstance.intentarCerrar();
    expect(matDialog.open).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);

    escribir({ nueva: 'Clave1234' });
    backdropClick.next(new MouseEvent('click'));
    await asentar();

    expect(matDialog.open.calls.mostRecent().args[1]?.data)
      .toEqual(jasmine.objectContaining({ message: 'Hay una contraseña sin guardar. Si cerrás ahora no se cambia.' }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('contraseña: si no coinciden queda abierto, marca "Repetir contraseña" y no llama al backend', async () => {
    const c = credencial({ modo: 'password' });
    await abrir(dialogoDeCredencial(c));
    escribir({ nueva: 'Clave1234', repetida: 'Otra1234' });

    await fixture.componentInstance.onSubmit(form().form.getRawValue());
    fixture.detectChanges();

    expect(c.guardar).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(form().form.get('repetida')?.getError('server')).toBe('Las contraseñas no coinciden');
    expect(fixture.nativeElement.querySelector('.dialogo-formulario__error [role="alert"]')).not.toBeNull();
  });

  it('contraseña: si coinciden guarda la nueva y cierra con `true`', async () => {
    const c = credencial({ modo: 'password' });
    await abrir(dialogoDeCredencial(c));
    escribir({ nueva: 'Clave1234', repetida: 'Clave1234' });

    await fixture.componentInstance.onSubmit(form().form.getRawValue());

    expect(c.guardar).toHaveBeenCalledOnceWith('Clave1234');
    expect(close).toHaveBeenCalledOnceWith(true);
  });
});
