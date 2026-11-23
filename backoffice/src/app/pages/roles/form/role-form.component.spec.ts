import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { EMPTY, NEVER, Observable, Subject, of, throwError } from 'rxjs';
import { FormGroup } from '@angular/forms';
import { API_CODES } from '@core/constants/api-codes.constants';
import { TEXTOS_DE_ERROR_HTTP } from '@core/utils/http-error-text.utils';
import { RolesFacade, RolFormValue, RolVM } from '@features/roles';
import { PermisoVM } from '@features/permisos';
import { RoleFormComponent } from './role-form.component';

const PERMISOS: PermisoVM[] = [
  { id: 'p-1', codigo: 'READ_USER', descripcion: 'Ver usuarios' },
  { id: 'p-2', codigo: 'CREATE_USER', descripcion: 'Crear usuarios' },
  { id: 'p-3', codigo: 'READ_ROLE', descripcion: 'Ver roles' },
];

const ROL: RolVM = {
  id: 'r-1', codigo: 'EDITOR', descripcion: 'Editor', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
  asignablePorBackoffice: false, activo: false, permisos: [PERMISOS[0]],
};

describe('RoleFormComponent', () => {
  let fixture: ComponentFixture<RoleFormComponent>;
  let facade: jasmine.SpyObj<RolesFacade>;

  const el = (): HTMLElement => fixture.nativeElement;
  const submit = (): HTMLButtonElement => el().querySelector('button[type="submit"]')!;
  const chips = (): HTMLButtonElement[] => Array.from(el().querySelectorAll('.perm-chip--toggle'));
  const grupos = (): HTMLElement[] => Array.from(el().querySelectorAll('.permisos-grilla__grupo'));
  const texto = (selector: string): string => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const botonGrupo = (nombre: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('.permisos-grilla__todos'))
      .find((b) => b.getAttribute('aria-label')?.endsWith(nombre))!;
  const buscar = (q: string): void => {
    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = q;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };
  /** El `FormGroup` del motor (para leer valor y estado; los gestos van por el DOM). */
  const form = (): FormGroup => fixture.componentInstance.motor!.form;
  /** Deja pasar las promesas del componente (carga, guardado, navegación) y los `@defer` del motor. */
  async function asentar(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  }
  async function enviar(): Promise<void> {
    submit().click();
    await asentar();
  }
  /** `mat-error` del campo Código. */
  const errorDeCodigo = (): Element | null => el().querySelector('#codigo')!.closest('mat-form-field')!.querySelector('mat-error');

  const escribirCodigo = (valor: string, evento: Event = new Event('input')): HTMLInputElement => {
    const input = el().querySelector<HTMLInputElement>('#codigo')!;
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
    await asentar(); // `cargar()` espera `getFormData`; después llegan los `@defer` del motor
  }

  describe('edición', () => {
    beforeEach(() => crear('r-1', ROL));

    it('precarga el rol (incluido su estado real) y arranca sin cambios', () => {
      expect(form().getRawValue()).toEqual({
        codigo: 'EDITOR', descripcion: 'Editor', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
        asignablePorBackoffice: false, active: false, permissionsIds: ['p-1'],
      });
      expect(submit().getAttribute('aria-disabled')).toBe('true');
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
      const f = form();
      f.controls['descripcion'].setValue('Otro nombre');
      f.controls['active'].setValue(true);
      f.controls['scopeTipo'].setValue('global');
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
      expect(form().dirty).toBeTrue();
      expect(texto('.ficha-paneles__total')).toBe('2 de 3 asignados');
      expect(texto('.detail-header__meta')).toContain('2 permisos');
      expect(submit().getAttribute('aria-disabled')).toBeNull();
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
      expect(el().querySelector('.permisos-grilla__vacio')!.textContent).toBe('');
    });

    it('guarda y, al terminar, avisa con el snackbar y vuelve a la lista', async () => {
      const snack = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
      const router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
      chips().find((c) => c.getAttribute('aria-pressed') === 'false')!.click();
      fixture.detectChanges();

      await enviar();

      expect(snack).toHaveBeenCalledWith('Rol actualizado', 'OK', jasmine.objectContaining({ panelClass: 'snackbar-success' }));
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/roles/lista']);
    });

    it('durante el guardado no hay cambios sin guardar (la navegación de éxito no pregunta), y si falla vuelve a haberlos', async () => {
      const guardado$ = new Subject<RolVM>();
      facade.update.and.returnValue(guardado$);
      chips().find((c) => c.getAttribute('aria-pressed') === 'false')!.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeTrue();

      await enviar();
      expect(fixture.componentInstance.marco.guardando).toBeTrue();
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeFalse();

      guardado$.error({ error: {} });
      await asentar();
      expect(fixture.componentInstance.marco.guardando).toBeFalse();
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeTrue();
    });

    it('un código ya existente se marca en el campo, con el mensaje en el mat-error, y se limpia al editarlo', async () => {
      facade.update.and.returnValue(throwError(() => ({ error: { code: API_CODES.ROLE_ALREADY_EXISTS } })));
      chips().find((c) => c.getAttribute('aria-pressed') === 'false')!.click();
      fixture.detectChanges();

      await enviar();
      fixture.detectChanges();

      const codigo = form().controls['codigo'];
      expect(API_CODES.ROLE_ALREADY_EXISTS).toBe(4061);
      expect(fixture.componentInstance.marco.guardando).toBeFalse();
      expect(fixture.componentInstance.marco.errorDeGuardado).toBe('Revisá el campo marcado.');
      expect(codigo.errors).toEqual({ server: 'Ya existe un rol con ese código' });
      expect(errorDeCodigo()?.textContent?.trim()).toBe('Ya existe un rol con ese código');

      escribirCodigo('OTRO');
      expect(codigo.errors).toBeNull();
      expect(errorDeCodigo()).toBeNull();
    });

    it('si el guardado completa sin responder (stream vacío), libera el formulario con un error', async () => {
      facade.update.and.returnValue(EMPTY);
      chips().find((c) => c.getAttribute('aria-pressed') === 'false')!.click();
      fixture.detectChanges();

      await enviar();

      expect(fixture.componentInstance.marco.guardando).toBeFalse();
      expect(fixture.componentInstance.marco.errorDeGuardado).toBe('No se pudo guardar el rol. Intentá de nuevo.');
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
        expect(texto('.permisos-grilla__grupo .perm-group__label')).toBe('Usuarios');
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
        const vacio = el().querySelector('.permisos-grilla__vacio')!;
        expect(vacio.getAttribute('role')).toBe('status');
        expect(vacio.textContent).toBe('');

        buscar('zzz');
        expect(grupos().length).toBe(0);
        expect(el().querySelector('.permisos-grilla__vacio')).toBe(vacio); // mismo nodo: no se reinserta
        expect(vacio.textContent?.trim()).toBe('Ningún permiso coincide con la búsqueda.');

        buscar('');
        expect(el().querySelector('.permisos-grilla__vacio')).toBe(vacio);
        expect(vacio.textContent).toBe('');
        expect(chips().length).toBe(3);
      });

      it('buscar no ensucia el form', () => {
        buscar('crear');
        expect(form().pristine).toBeTrue();
        expect(submit().getAttribute('aria-disabled')).toBe('true');
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

        expect(form().controls['permissionsIds'].value.sort()).toEqual(['p-1', 'p-2']);
        expect(botonGrupo('Usuarios').textContent?.trim()).toBe('Quitar todos');
        expect(botonGrupo('Usuarios').getAttribute('aria-label')).toBe('Quitar todos los permisos de Usuarios');
        expect(texto('.ficha-paneles__total')).toBe('2 de 3 asignados');
        expect(form().dirty).toBeTrue();
        expect(submit().getAttribute('aria-disabled')).toBeNull();
      });

      it('quita todo el grupo sin tocar los otros', () => {
        botonGrupo('Roles').click(); // otorga el de Roles
        fixture.detectChanges();
        botonGrupo('Usuarios').click();
        fixture.detectChanges();
        botonGrupo('Usuarios').click(); // ahora todos: los quita
        fixture.detectChanges();

        expect(form().controls['permissionsIds'].value).toEqual(['p-3']);
        expect(botonGrupo('Usuarios').textContent?.trim()).toBe('Marcar todos');
      });

      it('con búsqueda marca solo los visibles y lo dice en la etiqueta y el aria-label', () => {
        buscar('crear'); // Usuarios muestra solo "Crear" (p-2); "Leer" (p-1, ya otorgado) queda oculto
        const boton = botonGrupo('Usuarios');
        expect(boton.textContent?.trim()).toBe('Marcar el visible');
        expect(boton.getAttribute('aria-label')).toBe('Marcar el permiso visible de Usuarios');
        boton.click();
        fixture.detectChanges();
        expect(form().controls['permissionsIds'].value.sort()).toEqual(['p-1', 'p-2']);
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

        expect(form().controls['permissionsIds'].value).toEqual(['p-3']);
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
    /** El aviso de error de carga: la región `role="alert"` de `<app-estado-carga>`. */
    const fallo = (): Element | null => el().querySelector('app-estado-carga [role="alert"]');

    it('no dibuja el formulario, muestra el motivo y "Reintentar" vuelve a pedir los datos', async () => {
      await crear('r-1', ROL, throwError(() => ({ error: {} })));

      expect(fixture.componentInstance.marco.errorDeCarga?.texto).toBe('No pudimos cargar el rol ni sus permisos. Intentá de nuevo.');
      expect(fallo()).not.toBeNull();
      expect(el().querySelector('form')).toBeNull();
      expect(el().querySelector('.load-state__texto')?.textContent).toContain('No pudimos cargar el rol ni sus permisos');

      facade.getFormData.and.returnValue(of({ permisos: PERMISOS, rol: ROL }));
      const reintentar = Array.from(fallo()!.querySelectorAll<HTMLButtonElement>('button'))
        .find((b) => b.textContent?.includes('Reintentar'))!;
      reintentar.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(facade.getFormData).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.marco.errorDeCarga).toBeNull();
      expect(fallo()).toBeNull();
      expect(el().querySelector('form')).not.toBeNull();
      expect(form().controls['codigo'].value).toBe('EDITOR');
    });
  });

  describe('rol inexistente', () => {
    it('editar un rol que no existe (404 `4059`) lo dice con texto propio y la única salida es el listado', async () => {
      await crear('no-existe', null, throwError(() => ({ status: 404, error: { code: 4059, message: 'Rol no encontrado.' } })));

      const fallo = el().querySelector('app-estado-carga [role="alert"]')!;
      expect(fallo.querySelector('.load-state__icono i.ph-file-x')).not.toBeNull();
      expect(texto('.load-state__titulo')).toBe('Ese rol no existe');
      expect(Array.from(fallo.querySelectorAll('.load-state__texto')).map((p) => p.textContent!.trim()))
        .toEqual(['Puede que el enlace esté mal escrito. Buscalo en el listado.']);
      expect(fallo.textContent).not.toContain('Rol no encontrado.');
      expect(Array.from(fallo.querySelectorAll('button')).map((b) => b.textContent!.trim())).toEqual(['Ir al listado']);
      expect(el().querySelector('form')).toBeNull();

      fallo.querySelector('button')!.click();
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledOnceWith(['/dashboard/roles/lista']);
    });

    it('en el alta un 404 (del catálogo de permisos) es un error de carga común, con "Reintentar"', async () => {
      await crear(null, null, throwError(() => ({ status: 404, error: {} })));

      expect(texto('.load-state__titulo')).toBe('No pudimos cargar el formulario');
      expect(Array.from(el().querySelectorAll('app-estado-carga [role="alert"] button')).map((b) => b.textContent!.trim()))
        .toEqual(['Reintentar', 'Ir al listado']);
    });
  });

  describe('alta', () => {
    beforeEach(() => crear(null, null));

    it('arranca con los valores por defecto y el membrete vacío', () => {
      expect(form().getRawValue()).toEqual({
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
      expect(submit().getAttribute('aria-disabled')).toBeNull();
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
      expect(form().controls['codigo'].value).toBe('EDITOR_TRAMITES');
      expect(form().controls['codigo'].dirty).toBeTrue();
      expect(texto('.detail-header__code')).toBe('EDITOR_TRAMITES');
    });

    it('al pegar un código con espacios en los extremos, el membrete y el guardado no llevan el _ de relleno', async () => {
      escribirCodigo('  editor de tramites ');
      expect(el().querySelector<HTMLInputElement>('#codigo')!.value).toBe('__EDITOR_DE_TRAMITES_');
      expect(texto('.detail-header__code')).toBe('EDITOR_DE_TRAMITES');

      const f = form();
      f.controls['descripcion'].setValue('Editor');
      await enviar();

      expect(facade.create.calls.mostRecent().args[0].codigo).toBe('EDITOR_DE_TRAMITES');
    });

    it('un código de solo espacios no pasa la validación de obligatorio', async () => {
      escribirCodigo('   ');
      form().controls['descripcion'].setValue('Editor');
      await enviar();

      expect(facade.create).not.toHaveBeenCalled();
      expect(fixture.componentInstance.motor!.invalidFieldMessages()).toEqual(['Código (Este campo es obligatorio)']);
    });

    it('el cursor queda junto al mismo carácter aunque el texto crezca (ß → SS)', () => {
      const input = el().querySelector<HTMLInputElement>('#codigo')!;
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
      expect(form().controls['codigo'].value).toBe('ABC');
    });

    it('con el form inválido no guarda y muestra el resumen de errores', async () => {
      await enviar();
      fixture.detectChanges();

      expect(facade.create).not.toHaveBeenCalled();
      expect(fixture.componentInstance.motor!.invalidFieldMessages()).toEqual([
        'Código (Este campo es obligatorio)',
        'Descripción (Este campo es obligatorio)',
      ]);
    });

    it('crea el rol con el contrato de siempre', async () => {
      const f = form();
      f.controls['codigo'].setValue('NUEVO');
      f.controls['descripcion'].setValue('Nuevo rol');
      chips()[1].click();
      fixture.detectChanges();

      await enviar();

      expect(facade.create).toHaveBeenCalledWith({
        codigo: 'NUEVO', descripcion: 'Nuevo rol', scopeTipo: 'global', asignablePorOrgAdmin: false,
        asignablePorBackoffice: false, active: true, permissionsIds: [jasmine.any(String)],
      });
    });
  });
});

/*
 * Specs de CARACTERIZACIÓN desde el DOM: completan los de arriba fijando lo que hoy se ve y el contrato con el
 * facade, para detectar regresiones cuando el formulario pase a `app-dynamic-form`. Todo lo que depende del
 * markup está en los helpers de "Selectores y gestos": tras la migración, lo que haya que ajustar está ahí.
 */
describe('RoleFormComponent · caracterización desde el DOM', () => {
  let fixture: ComponentFixture<RoleFormComponent>;
  let facade: jasmine.SpyObj<RolesFacade>;
  let navigate: jasmine.Spy;
  let snack: jasmine.Spy;

  const RUTA_LISTA = '/dashboard/roles/lista';
  const MENSAJE_CRUDO = 'MENSAJE CRUDO DEL BACKEND';
  const errorHttp = (status: number, code?: number): HttpErrorResponse =>
    new HttpErrorResponse({ status, error: code === undefined ? { message: MENSAJE_CRUDO } : { code, message: MENSAJE_CRUDO } });
  /** Lo que el form de ROL manda al guardar sin tocar nada más que lo que cada test cambia. */
  const VALOR_DE_ROL: RolFormValue = {
    codigo: 'EDITOR', descripcion: 'Editor', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
    asignablePorBackoffice: false, active: false, permissionsIds: ['p-1'],
  };
  const EXITO = { duration: 3000, panelClass: 'snackbar-success' };

  // ───────────────────────────── Selectores y gestos ─────────────────────────────

  const el = (): HTMLElement => fixture.nativeElement;
  const limpio = (nodo: Element | null | undefined): string => (nodo?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const pantalla = (): string => limpio(el());

  /** Deja pasar las promesas del componente (carga, guardado, navegación) y refresca la vista. */
  async function asentar(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    fixture.detectChanges();
  }

  /** Un campo por su id, que con el motor es su `name` (`#codigo`, `#descripcion`, `#scopeTipo`). */
  const campo = <T extends HTMLElement = HTMLElement>(id: string): T => el().querySelector<T>(`#${id}`)!;
  const valorDe = (id: string): string => {
    const nodo = campo(id);
    return nodo instanceof HTMLInputElement || nodo instanceof HTMLTextAreaElement ? nodo.value : limpio(nodo);
  };
  const etiquetaDe = (id: string): string => limpio(el().querySelector(`label[for="${id}"]`));
  /** El envoltorio del campo (Material): de ahí salen su error y su ayuda. */
  const envoltorio = (id: string): Element | null => campo(id).closest('mat-form-field');
  const errorDe = (id: string): string => limpio(envoltorio(id)?.querySelector('mat-error'));
  const ayudaDe = (id: string): string =>
    Array.from(envoltorio(id)?.querySelectorAll('mat-hint') ?? []).map(limpio).join(' | ');
  function escribir(id: string, texto: string): void {
    const input = campo<HTMLInputElement>(id);
    input.value = texto;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  /** Opciones del panel abierto de un select de Material (vive en el overlay, fuera del fixture). */
  const opcionesAbiertas = (): HTMLElement[] => {
    const paneles = document.querySelectorAll<HTMLElement>('.cdk-overlay-container [role="listbox"]');
    return Array.from(paneles[paneles.length - 1]?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
  };
  async function abrirSelect(id: string): Promise<void> {
    (campo(id).querySelector<HTMLElement>('.mat-mdc-select-trigger') ?? campo(id)).click();
    await asentar();
  }
  async function opcionesDe(id: string): Promise<string[]> {
    await abrirSelect(id);
    const textos = opcionesAbiertas().map(limpio);
    const fondos = document.querySelectorAll<HTMLElement>('.cdk-overlay-backdrop');
    fondos[fondos.length - 1]?.click();
    await asentar();
    return textos;
  }
  async function elegir(id: string, opcion: string): Promise<void> {
    await abrirSelect(id);
    opcionesAbiertas().find((o) => limpio(o) === opcion)!.click();
    await asentar();
  }

  /** Interruptor por su etiqueta ("Rol activo", "Asignable por Administrador de Organismo"…). */
  const interruptor = (nombre: string): HTMLElement | undefined =>
    Array.from(el().querySelectorAll<HTMLElement>('[role="switch"]'))
      .find((s) => limpio(s.closest('mat-slide-toggle')).includes(nombre));
  const encendido = (nombre: string): boolean => interruptor(nombre)!.getAttribute('aria-checked') === 'true';
  function alternarInterruptor(nombre: string): void {
    interruptor(nombre)!.click();
    fixture.detectChanges();
  }
  /** Texto de ayuda asociado al interruptor (`aria-describedby`). */
  const ayudaDeInterruptor = (nombre: string): string => {
    const ids = interruptor(nombre)!.getAttribute('aria-describedby') ?? '';
    return ids.split(' ').map((id) => limpio(document.getElementById(id))).filter(Boolean).join(' ');
  };

  // Grilla de permisos
  /** Grupos de permisos, en el orden en que se ven, por su nombre accesible. */
  const gruposVisibles = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('[role="group"][aria-labelledby]'));
  const nombreDeGrupo = (g: HTMLElement): string => limpio(document.getElementById(g.getAttribute('aria-labelledby')!));
  const grupo = (nombre: string): HTMLElement => gruposVisibles().find((g) => nombreDeGrupo(g) === nombre)!;
  /** "1 / 2" del grupo. */
  const contadorDe = (nombre: string): string => /\d+ \/ \d+/.exec(limpio(grupo(nombre)))?.[0] ?? '';
  /** Permisos del grupo: etiqueta y si está otorgado (`aria-pressed`). */
  const permisosDe = (nombre: string): { texto: string; otorgado: boolean; boton: HTMLButtonElement }[] =>
    Array.from(grupo(nombre).querySelectorAll<HTMLButtonElement>('button[aria-pressed]'))
      .map((b) => ({ texto: limpio(b), otorgado: b.getAttribute('aria-pressed') === 'true', boton: b }));
  function alternarPermiso(nombreGrupo: string, permiso: string): void {
    permisosDe(nombreGrupo).find((p) => p.texto === permiso)!.boton.click();
    fixture.detectChanges();
  }
  /** Botón "Marcar todos" / "Quitar todos" (o "… los N visibles") del grupo. */
  const botonTodos = (nombre: string): HTMLButtonElement =>
    grupo(nombre).querySelector<HTMLButtonElement>(`button[aria-label$=" de ${nombre}"]`)!;
  function alternarTodos(nombre: string): void {
    botonTodos(nombre).click();
    fixture.detectChanges();
  }
  /** "N de M asignados" (región de estado del panel). */
  const total = (): string =>
    Array.from(el().querySelectorAll('[role="status"]')).map(limpio).find((t) => /asignados$/.test(t)) ?? '';
  const buscador = (): HTMLInputElement => el().querySelector<HTMLInputElement>('input[type="search"]')!;
  function buscar(texto: string): void {
    buscador().value = texto;
    buscador().dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  // Pie del formulario
  const submit = (): HTMLButtonElement => el().querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const botonesDeEnvio = (): number => el().querySelectorAll('.form-actions__submit button, button[type="submit"]').length;
  const boton = (texto: string): HTMLButtonElement =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) => limpio(b) === texto)!;
  const noDisponible = (): boolean => submit().getAttribute('aria-disabled') === 'true';
  /** El motivo que muestra el botón de envío no disponible (tooltip de `appUnavailable`). */
  const motivoDeNoDisponible = (): string =>
    fixture.debugElement.query(By.css('button[type="submit"]')).injector.get(MatTooltip).message;
  /** Indicador de permisos del pie. */
  const indicador = (): string => limpio(el().querySelector('.form-actions__info'));
  const ayudaDelPie = (): string => limpio(el().querySelector('.form-actions__help'));
  async function enviar(): Promise<void> {
    submit().click();
    await asentar();
  }

  /** Banners de error que se ven (resumen de validación y "No se pudo guardar"). */
  const banners = (): { rol: string | null; titulo: string; detalle: string }[] =>
    Array.from(el().querySelectorAll('.form-error-banner')).map((b) => ({
      rol: b.getAttribute('role'),
      titulo: limpio(b.querySelector('.form-error-banner__title')),
      detalle: limpio(b.querySelector('.form-error-banner__detail')),
    }));

  const estadoCarga = (): HTMLElement | null => el().querySelector('app-estado-carga');
  const formulario = (): HTMLFormElement | null => el().querySelector('form');

  /** Contrato con `unsavedChangesGuard` (no es DOM: es la interfaz pública `PuedeTenerCambiosSinGuardar`). */
  const cambiosSinGuardar = (): boolean => fixture.componentInstance.tieneCambiosSinGuardar();

  // ───────────────────────────── Montaje ─────────────────────────────

  async function crear(id: string | null, formData$?: Observable<{ permisos: PermisoVM[]; rol: RolVM | null }>): Promise<void> {
    facade = jasmine.createSpyObj<RolesFacade>('RolesFacade', ['getFormData', 'update', 'create']);
    facade.getFormData.and.returnValue(formData$ ?? of({ permisos: PERMISOS, rol: id ? ROL : null }));
    facade.update.and.returnValue(of(ROL));
    facade.create.and.returnValue(of(ROL));
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);

    TestBed.configureTestingModule({
      imports: [RoleFormComponent, NoopAnimationsModule],
      providers: [
        { provide: RolesFacade, useValue: facade },
        { provide: ActivatedRoute, useValue: { snapshot: { params: id ? { id } : {} } } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    fixture = TestBed.createComponent(RoleFormComponent);
    snack = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
    await asentar();
  }
  const alta = (): Promise<void> => crear(null);
  const edicion = (): Promise<void> => crear('r-1');

  /** Alta con lo mínimo para poder guardar. */
  function completarObligatorios(): void {
    escribir('codigo', 'nuevo');
    escribir('descripcion', 'Nuevo rol');
  }

  // ───────────────────────────── Carga ─────────────────────────────

  describe('carga', () => {
    it('mientras carga lo dice (rol en edición, formulario en alta) y no dibuja el formulario', async () => {
      await crear('r-1', NEVER);
      expect(limpio(estadoCarga())).toContain('Cargando el rol…');
      expect(formulario()).toBeNull();

      TestBed.resetTestingModule();
      await crear(null, NEVER);
      expect(limpio(estadoCarga())).toContain('Cargando el formulario…');
      expect(formulario()).toBeNull();
    });

    it('pide los datos una sola vez, con el id de la ruta (o null en el alta)', async () => {
      await edicion();
      expect(facade.getFormData).toHaveBeenCalledOnceWith('r-1');
      TestBed.resetTestingModule();
      await alta();
      expect(facade.getFormData).toHaveBeenCalledOnceWith(null);
    });

    it('si falla la carga del alta habla del catálogo de permisos y aclara que no se modificó nada', async () => {
      await crear(null, throwError(() => ({ error: { message: MENSAJE_CRUDO } })));

      expect(estadoCarga()!.querySelector(':scope > [role]')!.getAttribute('role')).toBe('alert');
      expect(limpio(estadoCarga()!.querySelector('h2'))).toBe('No pudimos cargar el formulario');
      expect(limpio(estadoCarga())).toContain('No pudimos cargar el catálogo de permisos. Intentá de nuevo.');
      expect(limpio(estadoCarga())).toContain('Reintentá o volvé a la lista; no se modificó nada.');
      expect(pantalla()).not.toContain(MENSAJE_CRUDO);
      expect(formulario()).toBeNull();
    });

    it('un error de carga con status conocido usa el texto compartido de ese tipo de error', async () => {
      await crear('r-1', throwError(() => errorHttp(500)));
      expect(limpio(estadoCarga())).toContain(TEXTOS_DE_ERROR_HTTP.servidor.accion);
      expect(pantalla()).not.toContain(MENSAJE_CRUDO);
    });

    it('"Ir al listado" del error de carga navega a la lista', async () => {
      await crear('r-1', throwError(() => errorHttp(500)));
      boton('Ir al listado').click();
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_LISTA]);
    });
  });

  // ───────────────────────────── Campos y valores iniciales ─────────────────────────────

  describe('alta: estado inicial', () => {
    beforeEach(alta);

    it('dibuja los campos vacíos, con alcance Global y los interruptores apagados', () => {
      expect(valorDe('codigo')).toBe('');
      expect(valorDe('descripcion')).toBe('');
      expect(valorDe('scopeTipo')).toBe('Global');
      expect(encendido('Asignable por Administrador de Organismo')).toBeFalse();
      expect(encendido('Asignable por Administrador de Backoffice')).toBeFalse();
    });

    it('cada campo tiene su etiqueta, marcada como obligatoria, y sus límites', () => {
      expect(etiquetaDe('codigo')).toBe('Código *');
      expect(etiquetaDe('descripcion')).toBe('Descripción *');
      expect(etiquetaDe('scopeTipo')).toBe('Alcance *');
      expect(campo('codigo').getAttribute('maxlength')).toBe('100');
      expect(campo('codigo').getAttribute('autocomplete')).toBe('off');
      expect(campo('descripcion').getAttribute('maxlength')).toBe('255');
    });

    it('muestra las ayudas de cada campo y de cada interruptor', () => {
      expect(ayudaDe('codigo')).toBe('Sin espacios, en mayúsculas | 0 / 100');
      expect(ayudaDe('descripcion')).toBe('Es el nombre con el que se ve el rol en Usuarios. | 0 / 255');
      expect(ayudaDe('scopeTipo')).toBe('Vale para todo el backoffice.');
      expect(ayudaDeInterruptor('Asignable por Administrador de Organismo'))
        .toBe('Un administrador de organismo puede darle este rol a sus usuarios.');
      expect(ayudaDeInterruptor('Asignable por Administrador de Backoffice'))
        .toBe('Un administrador de backoffice puede darle este rol a un usuario.');
    });

    it('en vez del interruptor "Rol activo" explica que el rol se crea activo', () => {
      expect(interruptor('Rol activo')).toBeUndefined();
      expect(el().querySelectorAll('[role="switch"]').length).toBe(2);
      expect(pantalla()).toContain('El rol se crea activo');
      expect(pantalla()).toContain('Después podés desactivarlo desde Editar.');
    });

    it('la grilla agrupa el catálogo por recurso, con nada otorgado', () => {
      expect(gruposVisibles().map(nombreDeGrupo)).toEqual(['Roles', 'Usuarios']);
      expect(permisosDe('Usuarios').map((p) => [p.texto, p.otorgado])).toEqual([['Leer', false], ['Crear', false]]);
      expect(permisosDe('Roles').map((p) => [p.texto, p.otorgado])).toEqual([['Leer', false]]);
      expect(contadorDe('Usuarios')).toBe('0 / 2');
      expect(contadorDe('Roles')).toBe('0 / 1');
      expect(total()).toBe('0 de 3 asignados');
      expect(limpio(botonTodos('Usuarios'))).toBe('Marcar todos');
    });

    it('el buscador de permisos dice entre cuántos busca', () => {
      expect(buscador().getAttribute('aria-label')).toBe('Buscar permisos');
      expect(buscador().getAttribute('placeholder')).toBe('Buscar entre 3 permisos…');
    });

    it('el pie ofrece "Crear rol" disponible, con la ayuda de obligatorios', () => {
      expect(limpio(submit())).toBe('Crear rol');
      expect(noDisponible()).toBeFalse();
      expect(submit().disabled).toBeFalse();
      expect(botonesDeEnvio()).toBe(1);
      expect(motivoDeNoDisponible()).toBe('');
      expect(ayudaDelPie()).toBe('Los campos con * son obligatorios.');
      expect(pantalla()).toContain('Completá los datos para crear el rol');
    });

    it('no hay errores, ni banners, ni cambios sin guardar', () => {
      expect(banners()).toEqual([]);
      expect(errorDe('codigo')).toBe('');
      expect(cambiosSinGuardar()).toBeFalse();
    });
  });

  describe('edición: estado inicial', () => {
    beforeEach(edicion);

    it('precarga los campos y los interruptores con el rol', () => {
      expect(valorDe('codigo')).toBe('EDITOR');
      expect(valorDe('descripcion')).toBe('Editor');
      expect(valorDe('scopeTipo')).toBe('Organismo');
      expect(ayudaDe('codigo')).toBe('Sin espacios, en mayúsculas | 6 / 100');
      expect(ayudaDe('scopeTipo')).toBe('Vale solo dentro del organismo del usuario.');
      expect(encendido('Asignable por Administrador de Organismo')).toBeTrue();
      expect(encendido('Asignable por Administrador de Backoffice')).toBeFalse();
    });

    it('muestra el interruptor "Rol activo" con el estado real, en vez de la fila del alta', () => {
      expect(encendido('Rol activo')).toBeFalse();
      expect(ayudaDeInterruptor('Rol activo')).toBe('Un rol inactivo queda guardado pero fuera de uso.');
      expect(pantalla()).not.toContain('El rol se crea activo');
    });

    it('la grilla marca lo otorgado y cuenta por grupo y en total', () => {
      expect(permisosDe('Usuarios').map((p) => [p.texto, p.otorgado])).toEqual([['Leer', true], ['Crear', false]]);
      expect(permisosDe('Roles').map((p) => [p.texto, p.otorgado])).toEqual([['Leer', false]]);
      expect(contadorDe('Usuarios')).toBe('1 / 2');
      expect(contadorDe('Roles')).toBe('0 / 1');
      expect(total()).toBe('1 de 3 asignados');
    });

    it('el pie ofrece "Guardar cambios", sin ayuda de obligatorios', () => {
      expect(limpio(submit())).toBe('Guardar cambios');
      expect(el().querySelector('.form-actions__help')).toBeNull();
      expect(pantalla()).toContain('Los cambios se aplican al guardar');
    });
  });

  // ───────────────────────────── Validaciones ─────────────────────────────

  describe('validaciones', () => {
    beforeEach(alta);

    it('enviar el alta vacía no guarda: marca código y descripción y los resume en un banner', async () => {
      await enviar();

      expect(facade.create).not.toHaveBeenCalled();
      expect(errorDe('codigo')).toBe('Este campo es obligatorio');
      expect(errorDe('descripcion')).toBe('Este campo es obligatorio');
      expect(errorDe('scopeTipo')).toBe('');
      expect(banners()).toEqual([{
        rol: 'group',
        titulo: 'Revisá 2 campos para poder guardar',
        detalle: 'Código (Este campo es obligatorio) · Descripción (Este campo es obligatorio)',
      }]);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('el resumen de errores recibe el foco al enviar (grupo con nombre, sin role="alert")', async () => {
      submit().focus();
      await enviar();

      // Lo pone el motor: los `mat-error` de cada campo ya se anuncian; el resumen no suma un anuncio asertivo.
      const nodo = el().querySelector<HTMLElement>('.form-error-banner')!;
      expect(nodo.getAttribute('tabindex')).toBe('-1');
      expect(limpio(document.getElementById(nodo.getAttribute('aria-labelledby')!))).toBe('Revisá 2 campos para poder guardar');
      expect(document.activeElement).toBe(nodo);
    });

    it('el resumen se achica al corregir un campo y desaparece al quedar todo válido', async () => {
      await enviar();

      escribir('codigo', 'editor');
      expect(banners()).toEqual([{
        rol: 'group', titulo: 'Revisá 1 campo para poder guardar', detalle: 'Descripción (Este campo es obligatorio)',
      }]);

      escribir('descripcion', 'Editor');
      expect(banners()).toEqual([]);
    });

    it('un código de solo guiones bajos o espacios cuenta como vacío', async () => {
      escribir('codigo', ' _ ');
      escribir('descripcion', 'Editor');
      await enviar();

      expect(facade.create).not.toHaveBeenCalled();
      expect(errorDe('codigo')).toBe('Este campo es obligatorio');
    });

    it('código de más de 100 y descripción de más de 255 caracteres se rechazan con su texto', async () => {
      escribir('codigo', 'A'.repeat(101));
      escribir('descripcion', 'b'.repeat(256));
      await enviar();

      expect(facade.create).not.toHaveBeenCalled();
      expect(errorDe('codigo')).toBe('No puede superar los 100 caracteres');
      expect(errorDe('descripcion')).toBe('No puede superar los 255 caracteres');
      expect(banners()[0].detalle)
        .toBe('Código (No puede superar los 100 caracteres) · Descripción (No puede superar los 255 caracteres)');
    });

    it('una descripción de solo espacios cuenta como vacía', async () => {
      escribir('codigo', 'editor');
      escribir('descripcion', '   ');
      await enviar();

      // "Obligatorio" se mide sobre el texto recortado (lo que valida el backend con `@NotBlank`).
      expect(facade.create).not.toHaveBeenCalled();
      expect(errorDe('descripcion')).toBe('Este campo es obligatorio');
    });

    it('sin permisos igual se puede guardar (el indicador solo avisa)', async () => {
      completarObligatorios();
      expect(indicador()).toBe('Sin permisos: el rol no va a poder hacer nada');
      await enviar();
      expect(facade.create).toHaveBeenCalledTimes(1);
    });
  });

  // ───────────────────────────── Código, alcance y flags ─────────────────────────────

  describe('código', () => {
    beforeEach(alta);

    it('se normaliza mientras se escribe y el contador sigue su largo', () => {
      escribir('codigo', 'editor tramites');
      expect(valorDe('codigo')).toBe('EDITOR_TRAMITES');
      expect(ayudaDe('codigo')).toBe('Sin espacios, en mayúsculas | 15 / 100');
      expect(cambiosSinGuardar()).toBeTrue();
    });

    it('los _ de los extremos se ven en el campo pero no viajan al guardar', async () => {
      escribir('codigo', ' editor de tramites ');
      escribir('descripcion', 'Editor');
      expect(valorDe('codigo')).toBe('_EDITOR_DE_TRAMITES_');

      await enviar();
      expect(facade.create.calls.mostRecent().args[0].codigo).toBe('EDITOR_DE_TRAMITES');
    });
  });

  describe('alcance', () => {
    it('ofrece Global y Organismo', async () => {
      await alta();
      expect(await opcionesDe('scopeTipo')).toEqual(['Global', 'Organismo']);
    });

    it('al cambiarlo cambia la ayuda, y viaja en el guardado', async () => {
      await alta();
      completarObligatorios();
      await elegir('scopeTipo', 'Organismo');

      expect(valorDe('scopeTipo')).toBe('Organismo');
      expect(ayudaDe('scopeTipo')).toBe('Vale solo dentro del organismo del usuario.');
      expect(pantalla()).toContain('Por organismo');

      await enviar();
      expect(facade.create.calls.mostRecent().args[0].scopeTipo).toBe('organismo');
    });

    it('en edición, volver a Global cuenta como cambio y manda "global"', async () => {
      await edicion();
      await elegir('scopeTipo', 'Global');

      expect(ayudaDe('scopeTipo')).toBe('Vale para todo el backoffice.');
      expect(noDisponible()).toBeFalse();
      await enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('r-1', { ...VALOR_DE_ROL, scopeTipo: 'global' });
    });
  });

  describe('interruptores', () => {
    it('los dos "Asignable por…" se prenden por separado y viajan en el alta', async () => {
      await alta();
      completarObligatorios();
      alternarInterruptor('Asignable por Administrador de Backoffice');
      expect(encendido('Asignable por Administrador de Backoffice')).toBeTrue();
      expect(encendido('Asignable por Administrador de Organismo')).toBeFalse();

      await enviar();
      const enviado = facade.create.calls.mostRecent().args[0];
      expect(enviado.asignablePorBackoffice).toBeTrue();
      expect(enviado.asignablePorOrgAdmin).toBeFalse();
    });

    it('en edición, apagar "Asignable por Administrador de Organismo" cuenta como cambio y viaja', async () => {
      await edicion();
      alternarInterruptor('Asignable por Administrador de Organismo');
      expect(noDisponible()).toBeFalse();

      await enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('r-1', { ...VALOR_DE_ROL, asignablePorOrgAdmin: false });
    });

    it('en edición, prender "Rol activo" lo refleja arriba y manda active=true', async () => {
      await edicion();
      expect(pantalla()).toContain('Inactivo');

      alternarInterruptor('Rol activo');
      expect(encendido('Rol activo')).toBeTrue();
      expect(pantalla()).not.toContain('Inactivo');

      await enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('r-1', { ...VALOR_DE_ROL, active: true });
    });
  });

  // ───────────────────────────── Payload ─────────────────────────────

  describe('payload', () => {
    it('alta mínima: crea con los valores por defecto', async () => {
      await alta();
      completarObligatorios();
      await enviar();

      expect(facade.create).toHaveBeenCalledOnceWith({
        codigo: 'NUEVO', descripcion: 'Nuevo rol', scopeTipo: 'global', asignablePorOrgAdmin: false,
        asignablePorBackoffice: false, active: true, permissionsIds: [],
      });
      expect(facade.update).not.toHaveBeenCalled();
    });

    it('alta completa: manda todo lo cargado; los permisos van en el orden en que se otorgaron', async () => {
      await alta();
      escribir('codigo', ' editor de tramites ');
      escribir('descripcion', '  Editor  ');
      await elegir('scopeTipo', 'Organismo');
      alternarInterruptor('Asignable por Administrador de Organismo');
      alternarInterruptor('Asignable por Administrador de Backoffice');
      alternarPermiso('Roles', 'Leer');
      alternarPermiso('Usuarios', 'Crear');
      await enviar();

      // Comportamiento actual: el código se limpia; la descripción viaja sin recortar.
      expect(facade.create).toHaveBeenCalledOnceWith({
        codigo: 'EDITOR_DE_TRAMITES', descripcion: '  Editor  ', scopeTipo: 'organismo', asignablePorOrgAdmin: true,
        asignablePorBackoffice: true, active: true, permissionsIds: ['p-3', 'p-2'],
      });
    });

    it('edición: actualiza con el id de la ruta y el rol completo', async () => {
      await edicion();
      escribir('descripcion', 'Editor jefe');
      await enviar();

      expect(facade.update).toHaveBeenCalledOnceWith('r-1', { ...VALOR_DE_ROL, descripcion: 'Editor jefe' });
      expect(facade.create).not.toHaveBeenCalled();
    });

    it('edición: quitar el único permiso manda la lista vacía', async () => {
      await edicion();
      alternarPermiso('Usuarios', 'Leer');
      expect(indicador()).toBe('Sin permisos: el rol no va a poder hacer nada');
      await enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('r-1', { ...VALOR_DE_ROL, permissionsIds: [] });
    });
  });

  // ───────────────────────────── Errores de guardado ─────────────────────────────

  describe('errores de guardado', () => {
    async function fallarAlGuardar(error: unknown): Promise<void> {
      await edicion();
      facade.update.and.returnValue(throwError(() => error));
      escribir('descripcion', 'Otro');
      await enviar();
    }

    it('código repetido (409 `4061`): se marca en el código y el banner manda a revisarlo, sin el mensaje del backend', async () => {
      await fallarAlGuardar(errorHttp(409, API_CODES.ROLE_ALREADY_EXISTS));

      expect(errorDe('codigo')).toBe('Ya existe un rol con ese código');
      expect(banners()).toEqual([{ rol: 'alert', titulo: 'No se pudo guardar', detalle: 'Revisá el campo marcado.' }]);
      expect(pantalla()).not.toContain(MENSAJE_CRUDO);
      expect(submit().disabled).toBeFalse();
      expect(limpio(submit())).toBe('Guardar cambios');
      expect(cambiosSinGuardar()).toBeTrue();
      expect(navigate).not.toHaveBeenCalled();
      expect(snack).not.toHaveBeenCalled();
    });

    it('editar otro campo no limpia el aviso; editar el código limpia el error y el banner', async () => {
      await fallarAlGuardar(errorHttp(409, API_CODES.ROLE_ALREADY_EXISTS));

      escribir('descripcion', 'Otro más');
      expect(errorDe('codigo')).toBe('Ya existe un rol con ese código');
      expect(banners().length).toBe(1);

      escribir('codigo', 'otro');
      expect(errorDe('codigo')).toBe('');
      expect(banners()).toEqual([]);
    });

    it('cambiar Alcance tras un código repetido no borra el error del Código (los campos se recalculan por la ayuda)', async () => {
      await fallarAlGuardar(errorHttp(409, API_CODES.ROLE_ALREADY_EXISTS));

      await elegir('scopeTipo', 'Global');
      expect(ayudaDe('scopeTipo')).toBe('Vale para todo el backoffice.');

      expect(errorDe('codigo')).toBe('Ya existe un rol con ese código');
      expect(campo('codigo').getAttribute('aria-invalid')).toBe('true');
      expect(banners()).toEqual([{ rol: 'alert', titulo: 'No se pudo guardar', detalle: 'Revisá el campo marcado.' }]);

      escribir('codigo', 'otro');
      expect(errorDe('codigo')).toBe('');
      expect(campo('codigo').getAttribute('aria-invalid')).toBe('false');
      expect(banners()).toEqual([]);
    });

    it('en el alta el código repetido se cuenta igual, y reintentar vuelve a llamar a create', async () => {
      await alta();
      facade.create.and.returnValue(throwError(() => errorHttp(409, API_CODES.ROLE_ALREADY_EXISTS)));
      completarObligatorios();
      await enviar();

      expect(errorDe('codigo')).toBe('Ya existe un rol con ese código');
      expect(limpio(submit())).toBe('Crear rol');
      expect(submit().disabled).toBeFalse();

      facade.create.and.returnValue(of(ROL));
      escribir('codigo', 'nuevo_2');
      await enviar();
      expect(facade.create).toHaveBeenCalledTimes(2);
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_LISTA]);
    });

    it('un error sin status ni código conocido cae en el texto de respaldo, nunca en el mensaje del backend', async () => {
      await fallarAlGuardar({ error: { code: 999999, message: MENSAJE_CRUDO } });

      expect(banners()).toEqual([{ rol: 'alert', titulo: 'No se pudo guardar', detalle: 'No se pudo guardar el rol. Intentá de nuevo.' }]);
      expect(errorDe('codigo')).toBe('');
      expect(pantalla()).not.toContain(MENSAJE_CRUDO);
    });

    ([
      ['un 500', errorHttp(500), TEXTOS_DE_ERROR_HTTP.servidor.formulario],
      ['sin conexión', errorHttp(0), TEXTOS_DE_ERROR_HTTP['sin-conexion'].formulario],
      ['un 403', errorHttp(403), TEXTOS_DE_ERROR_HTTP['sin-permiso'].formulario],
      ['un 404', errorHttp(404, API_CODES.ROLE_NOT_FOUND), TEXTOS_DE_ERROR_HTTP.inexistente.formulario],
      ['un 409 con otro código', errorHttp(409, 4091), TEXTOS_DE_ERROR_HTTP.conflicto.formulario],
    ] as const).forEach(([caso, error, texto]) => {
      it(`${caso} muestra el texto compartido de ese tipo de error en el banner`, async () => {
        await fallarAlGuardar(error);

        expect(banners()).toEqual([{ rol: 'alert', titulo: 'No se pudo guardar', detalle: texto }]);
        expect(errorDe('codigo')).toBe('');
        expect(pantalla()).not.toContain(MENSAJE_CRUDO);
      });
    });
  });

  // ───────────────────────────── Guardar sin cambios / cambios sin guardar ─────────────────────────────

  describe('"Guardar" sin cambios (edición)', () => {
    beforeEach(edicion);

    it('arranca no disponible con su motivo, enfocable y en un solo botón', () => {
      expect(botonesDeEnvio()).toBe(1);
      expect(noDisponible()).toBeTrue();
      expect(submit().disabled).toBeFalse();
      expect(motivoDeNoDisponible()).toBe('No hay cambios para guardar');
    });

    it('sin cambios, el clic no guarda', async () => {
      await enviar();
      expect(facade.update).not.toHaveBeenCalled();
      expect(banners()).toEqual([]);
    });

    it('se habilita al primer cambio de texto, sobre el mismo nodo de botón', () => {
      const antes = submit();
      escribir('descripcion', 'Editor jefe');

      expect(submit()).toBe(antes);
      expect(botonesDeEnvio()).toBe(1);
      expect(noDisponible()).toBeFalse();
      expect(motivoDeNoDisponible()).toBe('');
      expect(cambiosSinGuardar()).toBeTrue();
    });

    it('buscar permisos no cuenta como cambio', () => {
      buscar('crear');
      expect(noDisponible()).toBeTrue();
      expect(cambiosSinGuardar()).toBeFalse();
    });
  });

  describe('cambios sin guardar (unsavedChangesGuard)', () => {
    it('alta: no hay al cargar; los hay al escribir, al otorgar un permiso o al prender un interruptor', async () => {
      await alta();
      expect(cambiosSinGuardar()).toBeFalse();
      escribir('codigo', 'editor');
      expect(cambiosSinGuardar()).toBeTrue();

      TestBed.resetTestingModule();
      await alta();
      alternarPermiso('Roles', 'Leer');
      expect(cambiosSinGuardar()).toBeTrue();

      TestBed.resetTestingModule();
      await alta();
      alternarInterruptor('Asignable por Administrador de Organismo');
      expect(cambiosSinGuardar()).toBeTrue();
    });

    it('no hay durante el guardado ni después de guardar bien', async () => {
      await edicion();
      const guardado$ = new Subject<RolVM>();
      facade.update.and.returnValue(guardado$);
      escribir('descripcion', 'Otro');
      expect(cambiosSinGuardar()).toBeTrue();

      await enviar();
      expect(cambiosSinGuardar()).toBeFalse();

      guardado$.next(ROL);
      await asentar();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(cambiosSinGuardar()).toBeFalse();
    });

    it('un envío inválido no los descarta', async () => {
      await alta();
      escribir('descripcion', 'Algo');
      await enviar();
      expect(cambiosSinGuardar()).toBeTrue();
    });
  });

  // ───────────────────────────── Guardado y navegación ─────────────────────────────

  describe('guardado en curso', () => {
    it('bloquea el pie, dice "Guardando…" y marca el formulario ocupado', async () => {
      await edicion();
      facade.update.and.returnValue(NEVER);
      escribir('descripcion', 'Otro');
      expect(formulario()!.getAttribute('aria-busy')).toBe('false');
      const antes = submit();

      await enviar();

      expect(submit()).toBe(antes);
      expect(submit().disabled).toBeTrue();
      expect(limpio(submit())).toBe('Guardando…');
      expect(boton('Cancelar').disabled).toBeTrue();
      expect(formulario()!.getAttribute('aria-busy')).toBe('true');
      expect(navigate).not.toHaveBeenCalled();
      expect(snack).not.toHaveBeenCalled();
    });
  });

  describe('navegación tras guardar', () => {
    it('alta: avisa "Rol creado correctamente" y va a la lista', async () => {
      await alta();
      completarObligatorios();
      await enviar();

      expect(snack).toHaveBeenCalledOnceWith('Rol creado correctamente', 'OK', EXITO);
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_LISTA]);
    });

    it('edición: avisa "Rol actualizado" y va a la lista', async () => {
      await edicion();
      escribir('descripcion', 'Otro');
      await enviar();

      expect(snack).toHaveBeenCalledOnceWith('Rol actualizado', 'OK', EXITO);
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_LISTA]);
    });

    ([
      ['devuelve false', (): void => { navigate.and.resolveTo(false); }],
      ['rechaza', (): void => { navigate.and.rejectWith(new Error('chunk')); }],
    ] as const).forEach(([caso, preparar]) => {
      it(`alta: si la navegación ${caso}, avisa dónde encontrarlo y NO deja crear de nuevo`, async () => {
        await alta();
        preparar();
        completarObligatorios();
        await enviar();

        expect(facade.create).toHaveBeenCalledTimes(1);
        expect(snack.calls.allArgs()).toEqual([
          ['Rol creado correctamente', 'OK', EXITO],
          ['El rol ya se creó, pero no pudimos abrir la lista. Buscalo ahí.', 'OK', { duration: 8000, panelClass: 'snackbar-warning' }],
        ]);
        // Comportamiento actual: el pie queda bloqueado en "Guardando…" (habilitarlo duplicaría el rol).
        expect(submit().disabled).toBeTrue();
        expect(limpio(submit())).toBe('Guardando…');
        expect(boton('Cancelar').disabled).toBeTrue();
        expect(cambiosSinGuardar()).toBeFalse();
        expect(banners()).toEqual([]);
      });

      it(`edición: si la navegación ${caso}, el formulario queda disponible, guardado y sin cambios`, async () => {
        await edicion();
        preparar();
        escribir('descripcion', 'Otro');
        await enviar();

        expect(facade.update).toHaveBeenCalledTimes(1);
        expect(snack).toHaveBeenCalledOnceWith('Rol actualizado', 'OK', EXITO);
        expect(submit().disabled).toBeFalse();
        expect(limpio(submit())).toBe('Guardar cambios');
        expect(noDisponible()).toBeTrue();
        expect(motivoDeNoDisponible()).toBe('No hay cambios para guardar');
        expect(boton('Cancelar').disabled).toBeFalse();
        expect(cambiosSinGuardar()).toBeFalse();
        expect(valorDe('descripcion')).toBe('Otro');
        expect(banners()).toEqual([]);

        escribir('descripcion', 'Otro más');
        expect(noDisponible()).toBeFalse();
      });
    });

    it('"Cancelar" va a la lista sin guardar (alta y edición)', async () => {
      await alta();
      boton('Cancelar').click();
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_LISTA]);
      expect(facade.create).not.toHaveBeenCalled();

      TestBed.resetTestingModule();
      await edicion();
      boton('Cancelar').click();
      expect(navigate).toHaveBeenCalledOnceWith([RUTA_LISTA]);
      expect(facade.update).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────── Grilla de permisos ─────────────────────────────

  describe('grilla de permisos', () => {
    beforeEach(edicion);

    it('otorgar y quitar un permiso mueve su estado, el contador del grupo, el total y el indicador del pie', () => {
      expect(indicador()).toBe('1 permiso asignado');

      alternarPermiso('Usuarios', 'Crear');
      expect(permisosDe('Usuarios').map((p) => p.otorgado)).toEqual([true, true]);
      expect(contadorDe('Usuarios')).toBe('2 / 2');
      expect(total()).toBe('2 de 3 asignados');
      expect(indicador()).toBe('2 permisos asignados');

      alternarPermiso('Usuarios', 'Leer');
      alternarPermiso('Usuarios', 'Crear');
      expect(contadorDe('Usuarios')).toBe('0 / 2');
      expect(total()).toBe('0 de 3 asignados');
      expect(indicador()).toBe('Sin permisos: el rol no va a poder hacer nada');
    });

    it('los permisos son botones que no envían el formulario', async () => {
      permisosDe('Usuarios').forEach((p) => expect(p.boton.getAttribute('type')).toBe('button'));
      alternarPermiso('Usuarios', 'Crear');
      await asentar();
      expect(facade.update).not.toHaveBeenCalled();
    });

    it('"Marcar todos" otorga el grupo entero y pasa a "Quitar todos"; guardarlo manda los ids', async () => {
      alternarTodos('Usuarios');
      expect(permisosDe('Usuarios').map((p) => p.otorgado)).toEqual([true, true]);
      expect(contadorDe('Usuarios')).toBe('2 / 2');
      expect(limpio(botonTodos('Usuarios'))).toBe('Quitar todos');
      expect(botonTodos('Usuarios').getAttribute('aria-label')).toBe('Quitar todos los permisos de Usuarios');
      expect(total()).toBe('2 de 3 asignados');

      await enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('r-1', { ...VALOR_DE_ROL, permissionsIds: ['p-1', 'p-2'] });
    });

    it('"Quitar todos" vacía el grupo sin tocar los demás', async () => {
      alternarTodos('Roles');
      alternarTodos('Usuarios');
      alternarTodos('Usuarios');

      expect(contadorDe('Usuarios')).toBe('0 / 2');
      expect(contadorDe('Roles')).toBe('1 / 1');
      expect(total()).toBe('1 de 3 asignados');
      await enviar();
      expect(facade.update).toHaveBeenCalledOnceWith('r-1', { ...VALOR_DE_ROL, permissionsIds: ['p-3'] });
    });

    describe('con búsqueda', () => {
      it('escribir en el buscador filtra por permiso y oculta los grupos sin coincidencias', () => {
        buscar('crear');
        expect(gruposVisibles().map(nombreDeGrupo)).toEqual(['Usuarios']);
        expect(permisosDe('Usuarios').map((p) => p.texto)).toEqual(['Crear']);
      });

      it('también encuentra por el código del permiso', () => {
        buscar('read_role');
        expect(gruposVisibles().map(nombreDeGrupo)).toEqual(['Roles']);
        buscar('_user');
        expect(gruposVisibles().map(nombreDeGrupo)).toEqual(['Usuarios']);
        expect(permisosDe('Usuarios').map((p) => p.texto)).toEqual(['Leer', 'Crear']);
      });

      it('el contador del grupo y el total siguen contando todo, no solo lo visible', () => {
        buscar('crear');
        expect(contadorDe('Usuarios')).toBe('1 / 2');
        expect(total()).toBe('1 de 3 asignados');
      });

      it('"Marcar los 2 visibles" otorga solo lo que se ve y pasa a "Quitar los 2 visibles"', () => {
        buscar('usuarios');
        expect(limpio(botonTodos('Usuarios'))).toBe('Marcar los 2 visibles');

        alternarTodos('Usuarios');
        expect(limpio(botonTodos('Usuarios'))).toBe('Quitar los 2 visibles');
        expect(botonTodos('Usuarios').getAttribute('aria-label')).toBe('Quitar los 2 permisos visibles de Usuarios');
        expect(total()).toBe('2 de 3 asignados');
      });

      it('"Quitar el visible" no toca los permisos ocultos por la búsqueda', async () => {
        alternarPermiso('Usuarios', 'Crear'); // Usuarios: Leer y Crear otorgados
        buscar('crear');
        expect(limpio(botonTodos('Usuarios'))).toBe('Quitar el visible');

        alternarTodos('Usuarios');
        buscar('');
        expect(permisosDe('Usuarios').map((p) => [p.texto, p.otorgado])).toEqual([['Leer', true], ['Crear', false]]);

        await enviar();
        expect(facade.update).toHaveBeenCalledOnceWith('r-1', { ...VALOR_DE_ROL, permissionsIds: ['p-1'] });
      });

      it('sin coincidencias lo dice y no deja grupos; al limpiar vuelven todos', () => {
        buscar('zzz');
        expect(gruposVisibles()).toEqual([]);
        expect(pantalla()).toContain('Ningún permiso coincide con la búsqueda.');
        expect(total()).toBe('1 de 3 asignados');

        buscar('');
        expect(pantalla()).not.toContain('Ningún permiso coincide con la búsqueda.');
        expect(gruposVisibles().map(nombreDeGrupo)).toEqual(['Roles', 'Usuarios']);
      });

      it('lo oculto por la búsqueda igual viaja al guardar', async () => {
        buscar('roles');
        alternarTodos('Roles');
        await enviar();
        expect(facade.update).toHaveBeenCalledOnceWith('r-1', { ...VALOR_DE_ROL, permissionsIds: ['p-1', 'p-3'] });
      });
    });
  });
});
