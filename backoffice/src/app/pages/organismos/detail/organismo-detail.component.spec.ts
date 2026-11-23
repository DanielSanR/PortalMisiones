import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { FormGroup } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject, of, throwError } from 'rxjs';
import { OrganismoVM, OrganismosFacade } from '@features/organismos';
import {
  confirmacionAbierta, errorDeConfirmacion, pulsarEnConfirmacion, tituloDeConfirmacion,
} from '@shared/components/confirm-dialog/testing/confirmacion.testing';
import { DynamicFormComponent } from '@shared/components/dynamic-form/dynamic-form.component';
import { OrganismoDetailComponent } from './organismo-detail.component';

const ORGANISMO: OrganismoVM = {
  id: 'o-1', typeId: 't-1', parentId: null, baseLocationId: null, nombre: 'Ministerio de Salud', acronym: 'MSP', activo: true,
};

const DATOS = {
  tipos: [{ id: 't-1', nombre: 'Ministerio' }],
  localidades: [{ id: 'l-1', nombre: 'Posadas' }],
  organismos: [ORGANISMO],
  organismo: ORGANISMO,
};

/** Lo que resuelve `OrganismosFacade.getFormData` (el barrel no exporta el tipo). */
type OrganismoFormData = ReturnType<OrganismosFacade['getFormData']> extends Observable<infer D> ? D : never;

const VALOR = { nombre: 'Ministerio de Salud', acronym: 'MSP', typeId: 't-1', parentId: '', baseLocationId: '', activo: true };

type Modo = 'ver' | 'editar' | 'nuevo';

/** Caracterización de la ficha de organismo: carga, guardado y baja. */
describe('OrganismoDetailComponent', () => {
  let fixture: ComponentFixture<OrganismoDetailComponent>;
  let facade: jasmine.SpyObj<OrganismosFacade>;
  let navigate: jasmine.Spy;
  let avisos: jasmine.Spy;

  const el = (): HTMLElement => fixture.nativeElement;
  const botones = (raiz: Element): string[] =>
    Array.from(raiz.querySelectorAll('button')).map((b) => b.textContent!.trim());

  function crear(modo: Modo, datos$: Observable<OrganismoFormData>, origen: string | null = null): void {
    facade = jasmine.createSpyObj<OrganismosFacade>('OrganismosFacade', ['getFormData', 'create', 'update', 'delete']);
    facade.getFormData.and.returnValue(datos$);
    TestBed.configureTestingModule({
      imports: [OrganismoDetailComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: OrganismosFacade, useValue: facade },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: modo === 'nuevo' ? {} : { id: 'o-1' },
              data: { modo },
              queryParamMap: convertToParamMap(origen ? { origen } : {}),
            },
          },
        },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(OrganismoDetailComponent);
    // El componente importa `MatSnackBarModule`: su `MatSnackBar` es el de su propio injector.
    avisos = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
    fixture.detectChanges();
  }

  const dialog = (): MatDialog => fixture.debugElement.injector.get(MatDialog);
  /** El `FormGroup` de "Datos institucionales" (lo arma `app-dynamic-form`). */
  const formulario = (): FormGroup => fixture.debugElement.query(By.directive(DynamicFormComponent)).componentInstance.form;
  /** Abre la confirmación de baja y la deja dibujada. */
  const pedirBaja = (): void => {
    fixture.componentInstance.onDelete();
    fixture.detectChanges();
  };

  afterEach(() => dialog().closeAll());

  describe('carga', () => {
    it('mientras carga la ficha lo dice, sin dibujar el contenido', () => {
      crear('ver', new Subject<OrganismoFormData>());

      const cargando = el().querySelector('.loading-inline[role="status"]')!;
      expect(cargando.textContent).toContain('Cargando organismo…');
      expect(cargando.querySelector('i.ph-spinner-gap.spin')).not.toBeNull();
      expect(el().querySelector('.orgdet')).toBeNull();
      expect(el().querySelector('.load-state')).toBeNull();
    });

    it('en el alta el texto de carga habla del formulario', () => {
      crear('nuevo', new Subject<OrganismoFormData>());
      expect(el().querySelector('.loading-inline[role="status"]')!.textContent).toContain('Cargando formulario…');
    });

    it('con los datos dibuja la ficha y pide todo en una sola llamada', () => {
      crear('ver', of(DATOS));

      expect(facade.getFormData).toHaveBeenCalledOnceWith('o-1');
      expect(el().querySelector('.orgdet')).not.toBeNull();
      expect(el().querySelector('.loading-inline')).toBeNull();
      expect(el().textContent).toContain('Ministerio de Salud');
    });

    it('si la carga falla muestra el error con "Reintentar" como única salida', () => {
      crear('ver', throwError(() => new Error('sin red')));

      const error = el().querySelector('.load-state[role="alert"]')!;
      expect(error.querySelector('.load-state__icono i.ph-cloud-slash')).not.toBeNull();
      expect(error.querySelector('h2.load-state__titulo')!.textContent).toBe('No pudimos cargar el organismo');
      expect(error.querySelector('p.load-state__texto')!.textContent).toBe('Revisá tu conexión e intentá de nuevo. Si sigue, avisá a Soporte.');
      expect(botones(error.querySelector('.load-state__acciones')!)).toEqual(['Reintentar']);
      expect(el().querySelector('.orgdet')).toBeNull();
    });

    it('si el organismo no existe (404) lo dice con texto propio y la única salida es el listado', () => {
      crear('ver', throwError(() => new HttpErrorResponse({ status: 404, error: { code: 4058, message: 'crudo del backend' } })));

      const error = el().querySelector('.load-state[role="alert"]')!;
      expect(error.querySelector('.load-state__icono i.ph-file-x')).not.toBeNull();
      expect(error.querySelector('h2.load-state__titulo')!.textContent).toBe('Ese organismo no existe');
      expect(error.querySelector('p.load-state__texto')!.textContent)
        .toBe('Puede que el enlace esté mal escrito o que lo hayan eliminado. Buscalo en el listado.');
      expect(error.textContent).not.toContain('crudo del backend');
      expect(botones(error.querySelector('.load-state__acciones')!)).toEqual(['Ir al listado']);

      error.querySelector<HTMLButtonElement>('.load-state__acciones button')!.click();
      expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/organismos/lista']);
    });

    it('al editar un organismo que no existe tampoco ofrece reintentar', () => {
      crear('editar', throwError(() => ({ status: 404, error: { code: 4058 } })));

      expect(el().querySelector('.load-state__titulo')!.textContent).toBe('Ese organismo no existe');
      expect(botones(el().querySelector('.load-state__acciones')!)).toEqual(['Ir al listado']);
    });

    it('en el alta un 404 (de un catálogo) es un error de carga común: no hay organismo que "no exista"', () => {
      crear('nuevo', throwError(() => new HttpErrorResponse({ status: 404 })));

      expect(el().querySelector('.load-state__titulo')!.textContent).toBe('No pudimos cargar el formulario');
      expect(botones(el().querySelector('.load-state__acciones')!)).toEqual(['Reintentar']);
    });

    it('en el alta el error habla del formulario', () => {
      crear('nuevo', throwError(() => new Error('sin red')));
      expect(el().querySelector('.load-state__titulo')!.textContent).toBe('No pudimos cargar el formulario');
    });

    it('"Reintentar" vuelve a pedir los datos y, si llegan, dibuja la ficha', () => {
      crear('ver', throwError(() => new Error('sin red')));
      facade.getFormData.and.returnValue(of(DATOS));

      el().querySelector<HTMLButtonElement>('.load-state__acciones button')!.click();
      fixture.detectChanges();

      expect(facade.getFormData).toHaveBeenCalledTimes(2);
      expect(el().querySelector('.load-state')).toBeNull();
      expect(el().querySelector('.orgdet')).not.toBeNull();
    });
  });

  describe('guardado', () => {
    it('alta: crea, avisa y vuelve a la lista', fakeAsync(() => {
      crear('nuevo', of({ ...DATOS, organismo: null }));
      facade.create.and.returnValue(of(ORGANISMO));

      fixture.componentInstance.onSubmit(VALOR);
      flush();

      expect(facade.create).toHaveBeenCalledOnceWith({
        typeId: 't-1', parentId: null, baseLocationId: null, nombre: 'Ministerio de Salud', acronym: 'MSP', activo: true,
      });
      expect(avisos).toHaveBeenCalledOnceWith('Organismo creado correctamente', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/organismos/lista']);
      // Sigue "guardando" hasta que la navegación ocurre: el guard no pregunta por cambios.
      expect(fixture.componentInstance.marco.guardando).toBeTrue();
    }));

    it('edición abierta desde la ficha: actualiza, avisa y vuelve a la ficha', fakeAsync(() => {
      crear('editar', of(DATOS));
      facade.update.and.returnValue(of(ORGANISMO));

      fixture.componentInstance.onSubmit(VALOR);
      flush();

      expect(facade.update).toHaveBeenCalledTimes(1);
      expect(facade.update.calls.mostRecent().args[0]).toBe('o-1');
      expect(avisos).toHaveBeenCalledOnceWith('Organismo actualizado', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/organismos/detalle', 'o-1']);
    }));

    it('edición abierta desde la lista: vuelve a la lista', fakeAsync(() => {
      crear('editar', of(DATOS), 'lista');
      facade.update.and.returnValue(of(ORGANISMO));

      fixture.componentInstance.onSubmit(VALOR);
      flush();

      expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/organismos/lista']);
    }));

    it('mientras guarda no envía dos veces', fakeAsync(() => {
      crear('nuevo', of({ ...DATOS, organismo: null }));
      const respuesta$ = new Subject<OrganismoVM>();
      facade.create.and.returnValue(respuesta$);

      fixture.componentInstance.onSubmit(VALOR);
      fixture.componentInstance.onSubmit(VALOR);
      tick();

      expect(facade.create).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.marco.guardando).toBeTrue();
      respuesta$.complete();
      flush();
    }));

    it('si el guardado falla lo cuenta en el formulario, sin aviso ni navegación, y deja reintentar', fakeAsync(() => {
      crear('editar', of(DATOS));
      facade.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      fixture.componentInstance.onSubmit(VALOR);
      flush();
      fixture.detectChanges();

      expect(fixture.componentInstance.marco.guardando).toBeFalse();
      expect(fixture.componentInstance.marco.errorDeGuardado).not.toBe('');
      expect(el().textContent).toContain(fixture.componentInstance.marco.errorDeGuardado);
      expect(avisos).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();

      facade.update.and.returnValue(of(ORGANISMO));
      fixture.componentInstance.onSubmit(VALOR);
      flush();
      expect(fixture.componentInstance.marco.errorDeGuardado).toBe('');
      expect(avisos).toHaveBeenCalledTimes(1);
    }));

    it('edición guardada cuya navegación no ocurre: el formulario vuelve a quedar disponible y sin cambios', fakeAsync(() => {
      crear('editar', of(DATOS));
      facade.update.and.returnValue(of(ORGANISMO));
      navigate.and.resolveTo(false);
      formulario().markAsDirty();

      fixture.componentInstance.onSubmit(VALOR);
      flush();

      expect(avisos).toHaveBeenCalledOnceWith('Organismo actualizado', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      expect(fixture.componentInstance.marco.guardando).toBeFalse();
      expect(formulario().pristine).toBeTrue();
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeFalse();
    }));

    it('alta guardada cuya navegación falla: no deja crear de nuevo y dice dónde encontrar el organismo', fakeAsync(() => {
      crear('nuevo', of({ ...DATOS, organismo: null }));
      facade.create.and.returnValue(of(ORGANISMO));
      navigate.and.rejectWith(new Error('no se pudo cargar la lista'));

      fixture.componentInstance.onSubmit(VALOR);
      flush();
      fixture.componentInstance.onSubmit(VALOR);
      flush();

      expect(facade.create).toHaveBeenCalledTimes(1);
      expect(avisos.calls.allArgs()).toEqual([
        ['Organismo creado correctamente', 'OK', { duration: 3000, panelClass: 'snackbar-success' }],
        ['El organismo ya se creó, pero no pudimos abrir la lista. Buscalo ahí.', 'OK', { duration: 8000, panelClass: 'snackbar-warning' }],
      ]);
    }));

    it('el guard de salida pregunta solo con el formulario tocado, y nunca en la ficha de lectura', () => {
      crear('editar', of(DATOS));
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeFalse();
      formulario().markAsDirty();
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeTrue();

      TestBed.resetTestingModule();
      crear('ver', of(DATOS));
      expect(fixture.componentInstance.tieneCambiosSinGuardar()).toBeFalse();
    });
  });

  describe('eliminar', () => {
    beforeEach(() => crear('ver', of(DATOS)));

    it('pide confirmación nombrando el organismo y no elimina hasta confirmar', () => {
      pedirBaja();

      expect(tituloDeConfirmacion()).toBe('¿Eliminar el organismo?');
      expect(confirmacionAbierta()!.querySelector('b')!.textContent).toBe('Ministerio de Salud');
      expect(facade.delete).not.toHaveBeenCalled();
    });

    it('al confirmar elimina, avisa y vuelve a la lista', fakeAsync(() => {
      facade.delete.and.returnValue(of(undefined));
      pedirBaja();

      pulsarEnConfirmacion('Sí, eliminar');
      flush();

      expect(facade.delete).toHaveBeenCalledOnceWith('o-1');
      expect(avisos).toHaveBeenCalledOnceWith('Organismo eliminado', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/organismos/lista']);
    }));

    it('al cancelar no elimina, no avisa y se queda en la ficha', fakeAsync(() => {
      pedirBaja();

      pulsarEnConfirmacion('Cancelar');
      flush();

      expect(facade.delete).not.toHaveBeenCalled();
      expect(avisos).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    }));

    it('si el backend la rechaza, el motivo queda en el diálogo y no se sale de la ficha', fakeAsync(() => {
      facade.delete.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      pedirBaja();

      pulsarEnConfirmacion('Sí, eliminar');
      tick();
      fixture.detectChanges();

      expect(confirmacionAbierta()).not.toBeNull();
      expect(errorDeConfirmacion()).not.toBe('');
      expect(avisos).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      pulsarEnConfirmacion('Cancelar');
      flush();
    }));
  });
});
