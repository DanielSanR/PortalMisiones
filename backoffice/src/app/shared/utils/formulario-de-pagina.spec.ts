import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NEVER, Subject, defer, of, throwError } from 'rxjs';
import { ConflictoDeCampo } from '@core/utils/save-error.utils';
import { ErrorDeCargaDePagina, FormularioDePagina, GuardadoDePagina, formularioDePagina } from './formulario-de-pagina';

interface Datos { nombre: string }

@Component({ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class PaginaComponent {
  readonly marco = formularioDePagina<Datos>();
}

const DUPLICADO = 4072;
const CONFLICTOS: ConflictoDeCampo[] = [{ code: DUPLICADO, control: 'codigo', mensaje: 'Ya existe un rol con ese código.' }];
const FALLBACK = 'No pudimos guardar el rol. Intentá de nuevo.';
const rechazo = (code: number) => ({ status: 409, error: { code, message: 'duplicate key value violates unique constraint' } });
const A_ERROR = (): ErrorDeCargaDePagina => ({ titulo: 'No pudimos cargar el formulario', texto: 'Intentá de nuevo.', noExiste: false });

describe('FormularioDePagina (marco de formulario de página)', () => {
  let fixture: ComponentFixture<PaginaComponent>;
  let marco: FormularioDePagina<Datos>;
  let router: jasmine.SpyObj<Router>;
  let snackBar: jasmine.SpyObj<MatSnackBar>;
  let form: FormGroup;

  const guardado = (cambios: Partial<GuardadoDePagina<Datos>> = {}): GuardadoDePagina<Datos> => ({
    peticion$: of({ nombre: 'Editor' }),
    form,
    conflictos: CONFLICTOS,
    fallback: FALLBACK,
    aviso: () => 'Rol actualizado',
    destino: () => ['/roles'],
    esAlta: false,
    siNoNavega: 'El rol ya se creó, pero no pudimos abrir la lista. Buscalo ahí.',
    ...cambios,
  });
  const avisos = (): string[] => snackBar.open.calls.allArgs().map((args) => String(args[0]));

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    TestBed.configureTestingModule({
      imports: [PaginaComponent],
      providers: [{ provide: Router, useValue: router }, { provide: MatSnackBar, useValue: snackBar }],
    });
    fixture = TestBed.createComponent(PaginaComponent);
    marco = fixture.componentInstance.marco;
    form = new FormGroup({ codigo: new FormControl('EDITOR') });
    form.markAsDirty();
  });

  describe('cargar', () => {
    it('arranca cargando y, al resolver, entrega los datos y deja de estar pendiente', async () => {
      expect(marco.pendiente).toBe('cargando');

      const datos = await marco.cargar(of({ nombre: 'Editor' }), A_ERROR);

      expect(datos).toEqual({ nombre: 'Editor' });
      expect(marco.datos).toEqual({ nombre: 'Editor' });
      expect(marco.pendiente).toBeNull();
    });

    it('si falla, queda el error traducido por la pantalla y no hay datos', async () => {
      const datos = await marco.cargar(throwError(() => ({ status: 500 })), () => ({ ...A_ERROR(), noExiste: true }));

      expect(datos).toBeUndefined();
      expect(marco.pendiente).toBe('error');
      expect(marco.errorDeCarga).toEqual({ titulo: 'No pudimos cargar el formulario', texto: 'Intentá de nuevo.', noExiste: true });
    });

    it('reintentar limpia el error anterior mientras vuelve a cargar', async () => {
      await marco.cargar(throwError(() => ({ status: 500 })), A_ERROR);
      const fuente$ = new Subject<Datos>();

      const carga = marco.cargar(fuente$, A_ERROR);
      expect(marco.pendiente).toBe('cargando');
      expect(marco.errorDeCarga).toBeNull();

      fuente$.next({ nombre: 'Editor' });
      await carga;
      expect(marco.pendiente).toBeNull();
    });

    it('si la pantalla se destruye antes, no deja error ni datos', async () => {
      const carga = marco.cargar(NEVER, A_ERROR);
      fixture.destroy();

      expect(await carga).toBeUndefined();
      expect(marco.errorDeCarga).toBeNull();
    });
  });

  describe('guardar y salir', () => {
    it('avisa, navega al destino y sigue "guardando" (el guard no pregunta por cambios)', async () => {
      const resultado = await marco.guardar(guardado());

      expect(resultado).toEqual({ nombre: 'Editor' });
      expect(avisos()).toEqual(['Rol actualizado']);
      // Sin extras, la llamada es la de siempre (`navigate(comandos)`), sin un segundo argumento vacío.
      expect(router.navigate).toHaveBeenCalledOnceWith(['/roles']);
      expect(marco.guardando).toBeTrue();
      expect(marco.tieneCambiosSinGuardar(form)).toBeFalse();
    });

    it('el destino puede llevar extras de navegación y el aviso, su duración', async () => {
      await marco.guardar(guardado({
        destino: () => ({ comandos: ['/organismos', 'o1'], extras: { queryParams: { origen: 'ficha' } } }),
        aviso: (rol) => ({ texto: `${rol.nombre} guardado`, opciones: { duracion: 4000 } }),
      }));

      expect(router.navigate).toHaveBeenCalledOnceWith(['/organismos', 'o1'], { queryParams: { origen: 'ficha' } });
      expect(avisos()).toEqual(['Editor guardado']);
    });

    it('un segundo envío con el guardado en curso no vuelve a pedir nada', async () => {
      const peticion$ = new Subject<Datos>();
      let suscripciones = 0;
      const contada$ = of(null).pipe(() => { suscripciones++; return peticion$; });

      const primero = marco.guardar(guardado({ peticion$: contada$ }));
      expect(await marco.guardar(guardado({ peticion$: contada$ }))).toBeUndefined();
      peticion$.next({ nombre: 'Editor' });
      peticion$.complete();
      await primero;

      expect(suscripciones).toBe(1);
    });

    it('rechazo por código de negocio: marca el campo con el texto propio, el banner lo señala y vuelve a habilitar', async () => {
      const motor = jasmine.createSpyObj('motor', ['refrescarErrores']);

      const resultado = await marco.guardar(guardado({ peticion$: throwError(() => rechazo(DUPLICADO)), motor }));

      expect(resultado).toBeUndefined();
      expect(marco.guardando).toBeFalse();
      expect(marco.errorDeGuardado).toBe('Revisá el campo marcado.');
      expect(form.get('codigo')!.getError('server')).toBe('Ya existe un rol con ese código.');
      expect(motor.refrescarErrores).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(avisos()).toEqual([]);
    });

    it('rechazo no previsto: el texto de respaldo, nunca el mensaje del backend', async () => {
      await marco.guardar(guardado({ peticion$: throwError(() => rechazo(9999)) }));

      expect(marco.errorDeGuardado).not.toContain('duplicate key');
      expect(marco.errorDeGuardado.length).toBeGreaterThan(0);
    });

    it('`limpiarErrorDeGuardado` saca el banner del intento anterior; un nuevo guardado también', async () => {
      await marco.guardar(guardado({ peticion$: throwError(() => rechazo(DUPLICADO)) }));
      marco.limpiarErrorDeGuardado();
      expect(marco.errorDeGuardado).toBe('');

      await marco.guardar(guardado({ peticion$: throwError(() => rechazo(DUPLICADO)) }));
      const pendiente = marco.guardar(guardado({ peticion$: NEVER }));
      expect(marco.errorDeGuardado).toBe('');
      fixture.destroy();
      await pendiente;
    });

    it('edición cuya navegación no ocurre: queda disponible y sin cambios', async () => {
      router.navigate.and.resolveTo(false);

      await marco.guardar(guardado());

      expect(marco.guardando).toBeFalse();
      expect(form.pristine).toBeTrue();
      expect(avisos()).toEqual(['Rol actualizado']);
    });

    it('alta cuya navegación falla: NO vuelve a quedar disponible y dice dónde encontrar lo creado', async () => {
      router.navigate.and.rejectWith(new Error('chunk'));

      await marco.guardar(guardado({ esAlta: true, aviso: () => 'Rol creado correctamente' }));

      expect(marco.guardando).toBeTrue();
      expect(avisos()).toEqual(['Rol creado correctamente', 'El rol ya se creó, pero no pudimos abrir la lista. Buscalo ahí.']);
    });

    it('si la pantalla se destruye con el guardado en vuelo, no avisa ni navega', async () => {
      const pendiente = marco.guardar(guardado({ peticion$: NEVER }));
      fixture.destroy();

      expect(await pendiente).toBeUndefined();
      expect(avisos()).toEqual([]);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('guardado propio (`empezarGuardado` / `fallo` / `terminarGuardado`)', () => {
    it('empezar bloquea y borra el error anterior; fallar lo deja en el banner; terminar libera', () => {
      marco.fallo('Error del intento anterior');
      expect(marco.errorDeGuardado).toBe('Error del intento anterior');

      marco.empezarGuardado();
      expect(marco.guardando).toBeTrue();
      expect(marco.errorDeGuardado).toBe('');
      expect(marco.tieneCambiosSinGuardar(form)).toBeFalse();

      marco.terminarGuardado();
      marco.fallo('No se pudo guardar la ficha.');
      expect(marco.guardando).toBeFalse();
      expect(marco.errorDeGuardado).toBe('No se pudo guardar la ficha.');

      marco.limpiarErrorDeGuardado();
      expect(marco.errorDeGuardado).toBe('');
    });

    it('`guardar` no arranca mientras hay un guardado propio en curso', async () => {
      marco.empezarGuardado();
      const peticion = jasmine.createSpy('peticion');

      expect(await marco.guardar(guardado({ peticion$: defer(() => { peticion(); return of({ nombre: 'x' }); }) }))).toBeUndefined();
      expect(peticion).not.toHaveBeenCalled();
    });
  });

  describe('salir (pantalla que guarda por su cuenta: `empezarGuardado` / `terminarGuardado`)', () => {
    beforeEach(() => { marco.empezarGuardado(); });

    it('si navega devuelve true y sigue "guardando" hasta que la pantalla se va', async () => {
      expect(await marco.salir(['/fichas', 'f-1'], { esAlta: false, form })).toBeTrue();

      expect(router.navigate).toHaveBeenCalledOnceWith(['/fichas', 'f-1']);
      expect(marco.guardando).toBeTrue();
      expect(form.dirty).toBeTrue();
    });

    it('edición que no navega: devuelve false, queda disponible y sin cambios', async () => {
      router.navigate.and.resolveTo(false);

      expect(await marco.salir(['/fichas', 'f-1'], { esAlta: false, form })).toBeFalse();

      expect(marco.guardando).toBeFalse();
      expect(form.pristine).toBeTrue();
      expect(avisos()).toEqual([]);
    });

    it('alta que no navega: devuelve false sin volver a habilitar; sin `siNoNavega` no avisa (decide la pantalla)', async () => {
      router.navigate.and.rejectWith(new Error('chunk'));

      expect(await marco.salir(['/fichas', 'f-1'], { esAlta: true, form })).toBeFalse();

      expect(marco.guardando).toBeTrue();
      expect(avisos()).toEqual([]);
    });
  });

  describe('guardar y quedarse (sin `destino`)', () => {
    it('avisa, entrega lo guardado a la pantalla y vuelve a quedar disponible sin navegar', async () => {
      const alQuedarse = jasmine.createSpy('alQuedarse');

      await marco.guardar(guardado({ destino: undefined, alQuedarse, aviso: () => 'Cambios guardados' }));

      expect(alQuedarse).toHaveBeenCalledOnceWith({ nombre: 'Editor' });
      expect(marco.guardando).toBeFalse();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(avisos()).toEqual(['Cambios guardados']);
    });
  });

  describe('cambios sin guardar', () => {
    it('hay cambios con el formulario sucio; no los hay sin formulario o sin tocar', () => {
      expect(marco.tieneCambiosSinGuardar(form)).toBeTrue();
      form.markAsPristine();
      expect(marco.tieneCambiosSinGuardar(form)).toBeFalse();
      expect(marco.tieneCambiosSinGuardar(undefined)).toBeFalse();
    });
  });
});
