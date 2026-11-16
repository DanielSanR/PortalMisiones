import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, NEVER, Observable, of, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { RolesFacade, RolVM } from '@features/roles';
import { PermisoVM } from '@features/permisos';
import { codigoRolFinal, normalizarCodigoRol, RoleFormComponent } from './role-form.component';

const PERMISOS: PermisoVM[] = [
  { id: 'p-1', codigo: 'READ_USER', descripcion: 'Ver usuarios' },
  { id: 'p-2', codigo: 'CREATE_USER', descripcion: 'Crear usuarios' },
  { id: 'p-3', codigo: 'READ_ROLE', descripcion: 'Ver roles' },
];

const ROL: RolVM = {
  id: 'r-1', codigo: 'EDITOR', descripcion: 'Editor', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
  asignablePorBackoffice: false, activo: false, permisos: [PERMISOS[0]],
};

describe('normalizarCodigoRol', () => {
  it('pasa a mayúsculas y cambia cada espacio por _', () => {
    expect(normalizarCodigoRol('editor de  trámites')).toBe('EDITOR_DE__TRÁMITES');
    expect(normalizarCodigoRol('ya_ok')).toBe('YA_OK');
  });

  it('el largo puede crecer: ß pasa a SS', () => {
    expect(normalizarCodigoRol('straße')).toBe('STRASSE');
  });
});

describe('codigoRolFinal', () => {
  it('recorta los espacios y los _ de los extremos, pero no los del medio', () => {
    expect(codigoRolFinal('editor ')).toBe('EDITOR');
    expect(codigoRolFinal('  editor de  tramites _')).toBe('EDITOR_DE__TRAMITES');
    expect(codigoRolFinal('__EDITOR__')).toBe('EDITOR');
  });

  it('un código de solo espacios o guiones queda vacío', () => {
    expect(codigoRolFinal('   ')).toBe('');
    expect(codigoRolFinal('___')).toBe('');
  });
});

describe('RoleFormComponent', () => {
  let fixture: ComponentFixture<RoleFormComponent>;
  let facade: jasmine.SpyObj<RolesFacade>;

  const el = (): HTMLElement => fixture.nativeElement;
  const submit = (): HTMLButtonElement => el().querySelector('button[type="submit"]')!;
  const chips = (): HTMLButtonElement[] => Array.from(el().querySelectorAll('.perm-chip--toggle'));
  const grupos = (): HTMLElement[] => Array.from(el().querySelectorAll('.rolform-grupo'));
  const texto = (selector: string): string => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const botonGrupo = (nombre: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('.rolform-grupo__todos'))
      .find((b) => b.getAttribute('aria-label')?.endsWith(nombre))!;
  const buscar = (q: string): void => {
    fixture.componentInstance.busqueda.setValue(q);
    fixture.detectChanges();
  };

  const escribirCodigo = (valor: string, evento: Event = new Event('input')): HTMLInputElement => {
    const input = el().querySelector<HTMLInputElement>('#rol-codigo')!;
    input.value = valor;
    input.dispatchEvent(evento);
    fixture.detectChanges();
    return input;
  };

  async function crear(id: string | null, rol: RolVM | null,
                       formData$: Observable<{ permisos: PermisoVM[]; rol: RolVM | null }> = of({ permisos: PERMISOS, rol })): Promise<void> {
    facade = jasmine.createSpyObj<RolesFacade>('RolesFacade', ['getFormData', 'update', 'create']);
    facade.getFormData.and.returnValue(formData$);
    facade.update.and.returnValue(of(ROL));
    facade.create.and.returnValue(of(ROL));

    await TestBed.configureTestingModule({
      imports: [RoleFormComponent, NoopAnimationsModule],
      providers: [
        { provide: RolesFacade, useValue: facade },
        { provide: ActivatedRoute, useValue: { snapshot: { params: id ? { id } : {} } } },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RoleFormComponent);
    fixture.detectChanges();
    await fixture.whenStable(); // `cargar()` espera `getFormData`
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('edición', () => {
    beforeEach(() => crear('r-1', ROL));

    it('precarga el rol (incluido su estado real) y arranca sin cambios', () => {
      expect(fixture.componentInstance.form.getRawValue()).toEqual({
        codigo: 'EDITOR', descripcion: 'Editor', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
        asignablePorBackoffice: false, active: false, permissionsIds: ['p-1'],
      });
      expect(submit().disabled).toBeTrue();
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeFalse();
    });

    it('el membrete refleja el rol, sin región viva', () => {
      expect(texto('.detail-header__title')).toBe('Editor');
      expect(texto('.detail-header .pill--inactive')).toBe('Inactivo');
      expect(texto('.detail-header__meta')).toContain('EDITOR');
      expect(texto('.detail-header__meta')).toContain('Por organismo');
      expect(texto('.detail-header__meta')).toContain('1 permiso');
      expect(texto('.detail-header__actions')).toBe('Editando');
      expect(el().querySelector('.detail-header [aria-live], .detail-header [role="status"]')).toBeNull();
    });

    it('el membrete sigue lo que se escribe', () => {
      const f = fixture.componentInstance.form;
      f.controls.descripcion.setValue('Otro nombre');
      f.controls.active.setValue(true);
      f.controls.scopeTipo.setValue('global');
      fixture.detectChanges();

      expect(texto('.detail-header__title')).toBe('Otro nombre');
      expect(texto('.detail-header .pill--active')).toBe('Activo');
      expect(texto('.detail-header__meta')).toContain('Alcance global');
    });

    it('la grilla marca con aria-pressed los permisos otorgados y cuenta por grupo y en total', () => {
      expect(chips().length).toBe(3);
      expect(chips().filter((c) => c.getAttribute('aria-pressed') === 'true').length).toBe(1);
      const contadores = Array.from(el().querySelectorAll('.perm-group__count')).map((e) => e.textContent?.trim());
      expect(contadores).toContain('1 / 2');
      expect(contadores).toContain('0 / 1');
      expect(texto('.ficha-paneles__total')).toBe('1 de 3 asignados');
      expect(texto('.ficha-paneles__indicador')).toBe('1 permiso asignado');
    });

    it('otorgar un permiso ensucia el form: habilita "Guardar" y lo ve el guard de cambios sin guardar', () => {
      const sinOtorgar = chips().find((c) => c.getAttribute('aria-pressed') === 'false')!;
      sinOtorgar.click();
      fixture.detectChanges();

      expect(sinOtorgar.getAttribute('aria-pressed')).toBe('true');
      expect(fixture.componentInstance.form.dirty).toBeTrue();
      expect(texto('.ficha-paneles__total')).toBe('2 de 3 asignados');
      expect(texto('.detail-header__meta')).toContain('2 permisos');
      expect(submit().disabled).toBeFalse();
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeTrue();
    });

    it('alternar un permiso no cambia el orden de los chips', () => {
      const antes = chips().map((c) => c.textContent?.trim());
      chips()[0].click();
      fixture.detectChanges();
      chips()[2].click();
      fixture.detectChanges();
      expect(chips().map((c) => c.textContent?.trim())).toEqual(antes);
    });

    it('el panel tiene dos regiones vivas: el total y el aviso de "sin coincidencias" (vacío, siempre montado)', () => {
      const vivas = el().querySelectorAll('.ficha-paneles__panel--lateral [role="status"], .ficha-paneles__panel--lateral [aria-live]');
      expect(vivas.length).toBe(2);
      expect(el().querySelector('.rolform-vacio')!.textContent).toBe('');
    });

    it('guarda y, al terminar, avisa con el snackbar y vuelve a la lista', async () => {
      const snack = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
      const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      chips().find((c) => c.getAttribute('aria-pressed') === 'false')!.click();
      fixture.detectChanges();

      await fixture.componentInstance.onSubmit();

      expect(snack).toHaveBeenCalledWith('Rol actualizado', 'OK', jasmine.objectContaining({ panelClass: 'snackbar-success' }));
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/roles/lista']);
    });

    it('durante el guardado no hay cambios sin guardar (la navegación de éxito no pregunta), y si falla vuelve a haberlos', async () => {
      facade.update.and.returnValue(NEVER);
      chips().find((c) => c.getAttribute('aria-pressed') === 'false')!.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeTrue();

      void fixture.componentInstance.onSubmit();
      expect(fixture.componentInstance.saving).toBeTrue();
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeFalse();

      facade.update.and.returnValue(throwError(() => ({ error: {} })));
      fixture.componentInstance.saving = false;
      await fixture.componentInstance.onSubmit();
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeTrue();
    });

    it('un código ya existente se marca en el campo, con el mensaje en el mat-error, y se limpia al editarlo', async () => {
      facade.update.and.returnValue(throwError(() => ({ error: { code: API_CODES.ROLE_ALREADY_EXISTS } })));
      chips().find((c) => c.getAttribute('aria-pressed') === 'false')!.click();
      fixture.detectChanges();

      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      const codigo = fixture.componentInstance.form.controls.codigo;
      expect(API_CODES.ROLE_ALREADY_EXISTS).toBe(4061);
      expect(fixture.componentInstance.saving).toBeFalse();
      expect(fixture.componentInstance.serverError).toBe('Revisá el campo marcado.');
      expect(codigo.errors).toEqual({ server: 'Ya existe un rol con ese código' });
      expect(texto('.form-field.is-invalid mat-error')).toBe('Ya existe un rol con ese código');

      escribirCodigo('OTRO');
      expect(codigo.errors).toBeNull();
      expect(el().querySelector('.form-field.is-invalid mat-error')).toBeNull();
    });

    it('si el guardado completa sin responder (stream vacío), libera el formulario con un error', async () => {
      facade.update.and.returnValue(EMPTY);
      chips().find((c) => c.getAttribute('aria-pressed') === 'false')!.click();
      fixture.detectChanges();

      await fixture.componentInstance.onSubmit();

      expect(fixture.componentInstance.saving).toBeFalse();
      expect(fixture.componentInstance.serverError).toBe('No se pudo guardar el rol. Intentá de nuevo.');
    });

    it('guarda los permisos de la grilla junto con el resto del formulario', () => {
      chips().filter((c) => c.getAttribute('aria-pressed') === 'false').forEach((c) => c.click());
      fixture.detectChanges();
      submit().click();

      const [id, enviado] = facade.update.calls.mostRecent().args;
      expect(id).toBe('r-1');
      expect(enviado.active).toBeFalse();
      expect([...enviado.permissionsIds].sort()).toEqual(['p-1', 'p-2', 'p-3']);
    });

    describe('búsqueda de permisos', () => {
      it('filtra por permiso y oculta los grupos sin coincidencias', () => {
        buscar('crear');
        expect(grupos().length).toBe(1);
        expect(texto('.rolform-grupo .perm-group__label')).toBe('Usuarios');
        expect(chips().map((c) => c.textContent?.trim())).toEqual(['Crear']);
      });

      it('ignora mayúsculas y tildes, y coincidir con el nombre del grupo muestra todos sus permisos', () => {
        buscar('  ROLES ');
        expect(grupos().length).toBe(1);
        expect(chips().length).toBe(1);
        buscar('usuários');
        expect(chips().length).toBe(2);
        buscar('usuariosx');
        expect(chips().length).toBe(0);
      });

      it('sin coincidencias avisa en una región de estado ya montada (cambia solo el texto), y al limpiar vuelve todo', () => {
        const vacio = el().querySelector('.rolform-vacio')!;
        expect(vacio.getAttribute('role')).toBe('status');
        expect(vacio.textContent).toBe('');

        buscar('zzz');
        expect(grupos().length).toBe(0);
        expect(el().querySelector('.rolform-vacio')).toBe(vacio); // mismo nodo: no se reinserta
        expect(vacio.textContent?.trim()).toBe('Ningún permiso coincide con la búsqueda.');

        buscar('');
        expect(el().querySelector('.rolform-vacio')).toBe(vacio);
        expect(vacio.textContent).toBe('');
        expect(chips().length).toBe(3);
      });

      it('buscar no ensucia el form', () => {
        buscar('crear');
        expect(fixture.componentInstance.form.pristine).toBeTrue();
        expect(submit().disabled).toBeTrue();
      });

      it('Enter en el buscador no envía el formulario', () => {
        const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
        const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        input.dispatchEvent(evento);
        expect(evento.defaultPrevented).toBeTrue();
      });
    });

    describe('marcar / quitar todos', () => {
      it('marca todo el grupo, cambia el botón y ensucia el form', () => {
        botonGrupo('Usuarios').click();
        fixture.detectChanges();

        expect(fixture.componentInstance.form.controls.permissionsIds.value.sort()).toEqual(['p-1', 'p-2']);
        expect(botonGrupo('Usuarios').textContent?.trim()).toBe('Quitar todos');
        expect(botonGrupo('Usuarios').getAttribute('aria-label')).toBe('Quitar todos los permisos de Usuarios');
        expect(texto('.ficha-paneles__total')).toBe('2 de 3 asignados');
        expect(fixture.componentInstance.form.dirty).toBeTrue();
        expect(submit().disabled).toBeFalse();
      });

      it('quita todo el grupo sin tocar los otros', () => {
        botonGrupo('Roles').click(); // otorga el de Roles
        fixture.detectChanges();
        botonGrupo('Usuarios').click();
        fixture.detectChanges();
        botonGrupo('Usuarios').click(); // ahora todos: los quita
        fixture.detectChanges();

        expect(fixture.componentInstance.form.controls.permissionsIds.value).toEqual(['p-3']);
        expect(botonGrupo('Usuarios').textContent?.trim()).toBe('Marcar todos');
      });

      it('con búsqueda marca solo los visibles y lo dice en la etiqueta y el aria-label', () => {
        buscar('crear'); // Usuarios muestra solo "Crear" (p-2); "Leer" (p-1, ya otorgado) queda oculto
        const boton = botonGrupo('Usuarios');
        expect(boton.textContent?.trim()).toBe('Marcar el visible');
        expect(boton.getAttribute('aria-label')).toBe('Marcar el permiso visible de Usuarios');
        boton.click();
        fixture.detectChanges();
        expect(fixture.componentInstance.form.controls.permissionsIds.value.sort()).toEqual(['p-1', 'p-2']);
      });

      it('con búsqueda quita solo los visibles y deja los ocultos como estaban', () => {
        buscar('leer'); // Usuarios: "Leer" (p-1, otorgado); Roles: "Leer" (p-3). Oculto en Usuarios: "Crear" (p-2)
        botonGrupo('Roles').click(); // otorga p-3, el único visible de Roles
        fixture.detectChanges();
        expect(botonGrupo('Roles').textContent?.trim()).toBe('Quitar el visible');

        const usuarios = botonGrupo('Usuarios');
        expect(usuarios.textContent?.trim()).toBe('Quitar el visible'); // p-1 ya está otorgado: no ofrece marcar el oculto
        usuarios.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.form.controls.permissionsIds.value).toEqual(['p-3']);
      });

      it('con varios visibles, la etiqueta cuenta cuántos y el aria-label también', () => {
        buscar('usuarios'); // coincide el nombre del grupo: se muestran sus 2 permisos
        const boton = botonGrupo('Usuarios');
        expect(boton.textContent?.trim()).toBe('Marcar los 2 visibles');
        expect(boton.getAttribute('aria-label')).toBe('Marcar los 2 permisos visibles de Usuarios');
      });

      it('al limpiar la búsqueda vuelven las etiquetas de siempre', () => {
        buscar('crear');
        buscar('');
        expect(botonGrupo('Usuarios').textContent?.trim()).toBe('Marcar todos');
        expect(botonGrupo('Usuarios').getAttribute('aria-label')).toBe('Marcar todos los permisos de Usuarios');
      });
    });
  });

  describe('error de carga', () => {
    it('no dibuja el formulario, muestra el motivo y "Reintentar" vuelve a pedir los datos', async () => {
      await crear('r-1', ROL, throwError(() => ({ error: {} })));

      expect(fixture.componentInstance.loadError).toBe('No pudimos cargar el rol ni sus permisos. Intentá de nuevo.');
      expect(el().querySelector('.rolform-fallo')).not.toBeNull();
      expect(el().querySelector('form')).toBeNull();
      expect(el().querySelector('.load-state__texto')?.textContent).toContain('No pudimos cargar el rol ni sus permisos');

      facade.getFormData.and.returnValue(of({ permisos: PERMISOS, rol: ROL }));
      const reintentar = Array.from(el().querySelectorAll<HTMLButtonElement>('.rolform-fallo button'))
        .find((b) => b.textContent?.includes('Reintentar'))!;
      reintentar.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(facade.getFormData).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.loadError).toBe('');
      expect(el().querySelector('.rolform-fallo')).toBeNull();
      expect(el().querySelector('form')).not.toBeNull();
      expect(fixture.componentInstance.form.controls.codigo.value).toBe('EDITOR');
    });
  });

  describe('alta', () => {
    beforeEach(() => crear(null, null));

    it('arranca con los valores por defecto y el membrete vacío', () => {
      expect(fixture.componentInstance.form.getRawValue()).toEqual({
        codigo: '', descripcion: '', scopeTipo: 'global', asignablePorOrgAdmin: false,
        asignablePorBackoffice: false, active: true, permissionsIds: [],
      });
      expect(texto('.detail-header__title')).toBe('Rol sin descripción');
      expect(el().querySelector('.detail-header__title--muted')).not.toBeNull();
      expect(texto('.detail-header__code')).toBe('SIN_CODIGO');
      expect(texto('.detail-header__actions')).toBe('Nuevo');
      expect(texto('.ficha-paneles__total')).toBe('0 de 3 asignados');
    });

    it('sin permisos avisa en ámbar pero no bloquea', () => {
      expect(texto('.ficha-paneles__indicador')).toBe('Sin permisos: el rol no va a poder hacer nada');
      expect(el().querySelector('.ficha-paneles__indicador')!.classList).toContain('pill--warning');
      expect(submit().disabled).toBeFalse();
      expect(submit().textContent).toContain('Crear rol');
    });

    it('con permisos, el indicador pasa a informativo', () => {
      chips()[0].click();
      fixture.detectChanges();
      expect(texto('.ficha-paneles__indicador')).toBe('1 permiso asignado');
      expect(el().querySelector('.ficha-paneles__indicador')!.classList).toContain('pill--info');
    });

    it('el código se normaliza mientras se escribe y ensucia el control', () => {
      const input = escribirCodigo('editor tramites');

      expect(input.value).toBe('EDITOR_TRAMITES');
      expect(fixture.componentInstance.form.controls.codigo.value).toBe('EDITOR_TRAMITES');
      expect(fixture.componentInstance.form.controls.codigo.dirty).toBeTrue();
      expect(texto('.detail-header__code')).toBe('EDITOR_TRAMITES');
    });

    it('al pegar un código con espacios en los extremos, el membrete y el guardado no llevan el _ de relleno', async () => {
      escribirCodigo('  editor de tramites ');
      expect(el().querySelector<HTMLInputElement>('#rol-codigo')!.value).toBe('__EDITOR_DE_TRAMITES_');
      expect(texto('.detail-header__code')).toBe('EDITOR_DE_TRAMITES');

      const f = fixture.componentInstance.form;
      f.controls.descripcion.setValue('Editor');
      await fixture.componentInstance.onSubmit();

      expect(facade.create.calls.mostRecent().args[0].codigo).toBe('EDITOR_DE_TRAMITES');
    });

    it('un código de solo espacios no pasa la validación de obligatorio', async () => {
      escribirCodigo('   ');
      fixture.componentInstance.form.controls.descripcion.setValue('Editor');
      await fixture.componentInstance.onSubmit();

      expect(facade.create).not.toHaveBeenCalled();
      expect(fixture.componentInstance.errorSummary).toEqual(['Código (Este campo es obligatorio)']);
    });

    it('el cursor queda junto al mismo carácter aunque el texto crezca (ß → SS)', () => {
      const input = el().querySelector<HTMLInputElement>('#rol-codigo')!;
      input.value = 'straße x';
      input.setSelectionRange(6, 6); // justo después de la "e"
      input.dispatchEvent(new Event('input'));

      expect(input.value).toBe('STRASSE_X');
      expect(input.selectionStart).toBe(7);
    });

    it('mientras un IME compone no toca el texto; al terminar (compositionend) lo normaliza', () => {
      const input = escribirCodigo('abc', new InputEvent('input', { isComposing: true }));
      expect(input.value).toBe('abc');

      input.dispatchEvent(new CompositionEvent('compositionend'));
      expect(input.value).toBe('ABC');
      expect(fixture.componentInstance.form.controls.codigo.value).toBe('ABC');
    });

    it('con el form inválido no guarda y muestra el resumen de errores', async () => {
      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      expect(facade.create).not.toHaveBeenCalled();
      expect(fixture.componentInstance.errorSummary).toEqual([
        'Código (Este campo es obligatorio)',
        'Descripción (Este campo es obligatorio)',
      ]);
    });

    it('crea el rol con el contrato de siempre', async () => {
      const f = fixture.componentInstance.form;
      f.controls.codigo.setValue('NUEVO');
      f.controls.descripcion.setValue('Nuevo rol');
      chips()[1].click();
      fixture.detectChanges();

      await fixture.componentInstance.onSubmit();

      expect(facade.create).toHaveBeenCalledWith({
        codigo: 'NUEVO', descripcion: 'Nuevo rol', scopeTipo: 'global', asignablePorOrgAdmin: false,
        asignablePorBackoffice: false, active: true, permissionsIds: [jasmine.any(String)],
      });
    });
  });
});
