import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject, of, throwError } from 'rxjs';
import { PlantillaVM, PlantillasFacade } from '@features/plantillas';
import {
  confirmacionAbierta, errorDeConfirmacion, pulsarEnConfirmacion, tituloDeConfirmacion,
} from '@shared/components/confirm-dialog/testing/confirmacion.testing';
import { PlantillaDetailComponent } from './plantilla-detail.component';

const PLANTILLA: PlantillaVM = {
  id: 'p-1', titulo: 'Obtener la licencia de conducir', slug: 'obtener-licencia', resumen: 'Resumen', descripcionLarga: null,
  modalidad: null, categoriaPrincipal: null, categorias: [], etiquetas: [], destinatarios: [], eventosDeVida: [], activa: true,
};

/** Caracterización del detalle de plantilla: carga y desactivar. Sin permisos de sesión: no dibuja lo gateado. */
describe('PlantillaDetailComponent', () => {
  let fixture: ComponentFixture<PlantillaDetailComponent>;
  let facade: jasmine.SpyObj<PlantillasFacade>;
  let navigate: jasmine.Spy;
  let avisos: jasmine.Spy;

  const el = (): HTMLElement => fixture.nativeElement;
  const botones = (raiz: Element): string[] =>
    Array.from(raiz.querySelectorAll('button')).map((b) => b.textContent!.trim());
  const dialog = (): MatDialog => fixture.debugElement.injector.get(MatDialog);

  function crear(detalle$: Observable<PlantillaVM>): void {
    facade = jasmine.createSpyObj<PlantillasFacade>('PlantillasFacade', ['getDetalle', 'desactivar']);
    facade.getDetalle.and.returnValue(detalle$);
    TestBed.configureTestingModule({
      imports: [PlantillaDetailComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: PlantillasFacade, useValue: facade },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'p-1' })) } },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(PlantillaDetailComponent);
    // El componente importa `MatSnackBarModule`: su `MatSnackBar` es el de su propio injector.
    avisos = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
    fixture.detectChanges();
  }

  afterEach(() => dialog().closeAll());

  describe('carga', () => {
    it('mientras carga lo dice, sin dibujar el detalle', () => {
      crear(new Subject<PlantillaVM>());

      const cargando = el().querySelector('.loading-inline[role="status"]')!;
      expect(cargando.textContent).toContain('Cargando plantilla…');
      expect(cargando.querySelector('i.ph-spinner-gap.spin')).not.toBeNull();
      expect(el().querySelector('.plantdet')).toBeNull();
      expect(el().querySelector('.load-state')).toBeNull();
    });

    it('con la plantilla dibuja el detalle', () => {
      crear(of(PLANTILLA));

      expect(facade.getDetalle).toHaveBeenCalledOnceWith('p-1');
      expect(el().querySelector('.plantdet')!.textContent).toContain('Obtener la licencia de conducir');
      expect(el().querySelector('.loading-inline')).toBeNull();
    });

    it('si la carga falla ofrece reintentar o ir al listado', () => {
      crear(throwError(() => new HttpErrorResponse({ status: 500 })));

      const error = el().querySelector('.load-state[role="alert"]')!;
      expect(error.querySelector('.load-state__icono i.ph-cloud-slash')).not.toBeNull();
      expect(error.querySelector('h2.load-state__titulo')!.textContent).toBe('No pudimos cargar la plantilla');
      expect(error.querySelector('p.load-state__texto')!.textContent!.trim()).toBe('Revisá tu conexión e intentá de nuevo. Si sigue, avisá a Soporte.');
      expect(botones(error.querySelector('.load-state__acciones')!)).toEqual(['Reintentar', 'Ir al listado']);
    });

    it('"Reintentar" vuelve a pedirla y, si llega, dibuja el detalle', () => {
      crear(throwError(() => new HttpErrorResponse({ status: 500 })));
      facade.getDetalle.and.returnValue(of(PLANTILLA));

      el().querySelector<HTMLButtonElement>('.load-state__acciones button')!.click();
      fixture.detectChanges();

      expect(facade.getDetalle).toHaveBeenCalledTimes(2);
      expect(el().querySelector('.load-state')).toBeNull();
      expect(el().querySelector('.plantdet')).not.toBeNull();
    });

    it('si no existe lo dice con texto propio y la única salida es el listado', () => {
      crear(throwError(() => new HttpErrorResponse({ status: 404 })));

      const error = el().querySelector('.load-state[role="alert"]')!;
      expect(error.querySelector('.load-state__icono i.ph-file-x')).not.toBeNull();
      expect(error.querySelector('h2.load-state__titulo')!.textContent).toBe('Esa plantilla no existe');
      expect(botones(error.querySelector('.load-state__acciones')!)).toEqual(['Ir al listado']);

      error.querySelector<HTMLButtonElement>('.load-state__acciones button')!.click();
      expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/tramites/plantillas']);
    });
  });

  describe('desactivar', () => {
    beforeEach(() => crear(of(PLANTILLA)));

    const pedir = (): void => {
      fixture.componentInstance.desactivar(PLANTILLA);
      fixture.detectChanges();
    };

    it('pide confirmación nombrando la plantilla y no desactiva hasta confirmar', () => {
      pedir();

      expect(tituloDeConfirmacion()).toBe('¿Desactivar la plantilla?');
      expect(confirmacionAbierta()!.querySelector('b')!.textContent).toBe('Obtener la licencia de conducir');
      expect(facade.desactivar).not.toHaveBeenCalled();
    });

    it('al confirmar desactiva, avisa y vuelve al listado', fakeAsync(() => {
      facade.desactivar.and.returnValue(of(undefined));
      pedir();

      pulsarEnConfirmacion('Sí, desactivar');
      flush();

      expect(facade.desactivar).toHaveBeenCalledOnceWith('p-1');
      expect(avisos).toHaveBeenCalledOnceWith('Plantilla desactivada', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/tramites/plantillas']);
    }));

    it('al cancelar no desactiva, no avisa y se queda en el detalle', fakeAsync(() => {
      pedir();

      pulsarEnConfirmacion('Cancelar');
      flush();

      expect(facade.desactivar).not.toHaveBeenCalled();
      expect(avisos).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    }));

    it('si el backend la rechaza, el motivo queda en el diálogo y no se sale del detalle', fakeAsync(() => {
      facade.desactivar.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      pedir();

      pulsarEnConfirmacion('Sí, desactivar');
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
