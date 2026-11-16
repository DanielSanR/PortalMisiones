import { Component, Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { FichaFormData, FichaLocalVM, FichasLocalesFacade } from '@features/fichas-locales';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { PuntosAtencionPanelComponent } from '../puntos-atencion-panel/puntos-atencion-panel.component';
import { FichaFormComponent } from './ficha-form.component';

/** Reemplaza al panel real (que trae su propio facade): solo importa dónde se dibuja. */
@Component({ selector: 'app-puntos-atencion-panel', standalone: true, template: '<p class="puntos-stub">puntos</p>' })
class PuntosPanelStub {
  @Input() fichaId = '';
}

/** Reemplaza al gating por permiso: siempre dibuja. */
@Directive({ selector: '[appHasPermission]', standalone: true })
class HasPermissionStub {
  @Input() appHasPermission: unknown;
  constructor() {
    inject(ViewContainerRef).createEmbeddedView(inject(TemplateRef<unknown>));
  }
}

const FICHA: FichaLocalVM = {
  id: 'f-1', slug: 'obtener-licencia-posadas', estado: 'BORRADOR', activa: true, version: 1,
  adopcionId: 'a-1', localidadId: 'l-1', url: 'https://licencias.posadas.gob.ar',
  requisitos: 'DNI vigente', costos: 'Gratis', contenidoCompleto: true,
  plantillaId: 'p-1', plantillaTitulo: 'Obtener la licencia de conducir',
  organismoId: 'o-1', organismoNombre: 'Municipalidad de Posadas', localidadNombre: 'Posadas',
};

function datos(ficha: FichaLocalVM | null): FichaFormData {
  return {
    ficha,
    adopcion: null,
    localidades: [
      { id: 'l-1', nombre: 'Posadas', departamentoNombre: 'Capital' },
      { id: 'l-2', nombre: 'Oberá', departamentoNombre: 'Oberá' },
    ],
    ocupadas: { localidadIds: [], localidadesVerificables: true, slugs: [] },
  };
}

describe('FichaFormComponent', () => {
  let fixture: ComponentFixture<FichaFormComponent>;
  let facade: jasmine.SpyObj<FichasLocalesFacade>;
  let router: Router;

  const el = (): HTMLElement => fixture.nativeElement;

  async function crear(ficha: FichaLocalVM | null): Promise<void> {
    facade = jasmine.createSpyObj<FichasLocalesFacade>('FichasLocalesFacade', ['getFormData', 'update', 'create']);
    facade.getFormData.and.returnValue(of(datos(ficha)));
    facade.update.and.returnValue(of(FICHA));
    facade.create.and.returnValue(of(FICHA));

    await TestBed.configureTestingModule({
      imports: [FichaFormComponent, NoopAnimationsModule],
      providers: [
        { provide: FichasLocalesFacade, useValue: facade },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: ficha ? { id: ficha.id } : {},
              queryParamMap: convertToParamMap(ficha ? {} : { adopcion: 'a-1' }),
            },
          },
        },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
        { provide: MatSnackBar, useValue: jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']) },
      ],
    })
      .overrideComponent(FichaFormComponent, {
        remove: { imports: [PuntosAtencionPanelComponent, HasPermissionDirective] },
        add: { imports: [PuntosPanelStub, HasPermissionStub] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    (router.navigate as jasmine.Spy).and.resolveTo(true);
    fixture = TestBed.createComponent(FichaFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('edición de una ficha publicada', () => {
    beforeEach(() => crear({ ...FICHA, estado: 'PUBLICADO' }));

    it('dibuja los puntos de atención en el panel lateral de la misma tarjeta, dentro del form', () => {
      const lateral = el().querySelector('form .ficha-paneles__panel--lateral.ficha-paneles__panel--acotado');
      expect(lateral).withContext('panel lateral acotado').not.toBeNull();
      expect(lateral!.querySelector('app-puntos-atencion-panel')).not.toBeNull();
      expect(el().querySelector('.fichaform-puntos')).withContext('ya no hay tarjeta aparte').toBeNull();
    });

    it('bloquea "Ficha activa" con appUnavailable: focusable, aria-disabled y con el motivo a la vista', () => {
      const interruptor = el().querySelector<HTMLButtonElement>('button.form-toggle__interruptor')!;
      expect(interruptor).not.toBeNull();
      expect(interruptor.disabled).toBeFalse();
      expect(interruptor.getAttribute('aria-disabled')).toBe('true');
      expect(interruptor.getAttribute('aria-checked')).toBe('true');
      expect(interruptor.classList).toContain('is-unavailable');
      expect(el().querySelector('mat-slide-toggle')).toBeNull();
      expect(el().querySelector('#fichaform-activa-ayuda')!.textContent).toContain('Desactivar');
    });

    it('el motivo del bloqueo se anuncia una sola vez: sin tooltip, solo el aria-describedby del texto de ayuda', () => {
      const interruptor = el().querySelector<HTMLButtonElement>('button.form-toggle__interruptor')!;
      expect(interruptor.getAttribute('aria-describedby')).toBe('fichaform-activa-ayuda');
    });

    it('un click en el interruptor no cambia el valor y guardar manda activa = true', async () => {
      el().querySelector<HTMLButtonElement>('button.form-toggle__interruptor')!.click();
      fixture.componentInstance.form.controls.url.setValue('https://otra.gob.ar');
      fixture.componentInstance.form.markAsDirty();
      await fixture.componentInstance.onSubmit();

      expect(facade.update).toHaveBeenCalledOnceWith('f-1', jasmine.objectContaining({ activa: true, url: 'https://otra.gob.ar' }));
    });
  });

  describe('edición de una ficha en borrador', () => {
    beforeEach(() => crear(FICHA));

    it('"Ficha activa" es el slide-toggle del formulario, editable', () => {
      expect(el().querySelector('mat-slide-toggle')).not.toBeNull();
      expect(el().querySelector('button.form-toggle__interruptor')).toBeNull();
    });

    it('sin cambios el pie lo dice y Guardar queda sin habilitar', () => {
      expect(el().querySelector('.form-actions__help')!.textContent).toContain('Sin cambios para guardar');
      expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBeTrue();
    });
  });

  describe('alta', () => {
    beforeEach(() => crear(null));

    it('no hay ficha todavía: el panel lateral explica qué sigue y no dibuja los puntos', () => {
      expect(el().querySelector('app-puntos-atencion-panel')).toBeNull();
      expect(el().querySelector('#fichaform-despues')!.textContent).toContain('Después de crearla');
      expect(el().querySelectorAll('.pasos-lista__item').length).toBe(3);
    });

    it('con el form inválido no guarda y muestra el resumen de errores', async () => {
      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      expect(facade.create).not.toHaveBeenCalled();
      expect(el().querySelector('app-form-error-banner')!.textContent).toContain('Localidad');
    });

    it('elegir la localidad arma el slug y crear navega al detalle', async () => {
      fixture.componentInstance.form.controls.localidadId.setValue('l-2');
      fixture.detectChanges();
      await fixture.componentInstance.onSubmit();

      expect(facade.create).toHaveBeenCalledOnceWith(jasmine.objectContaining({ adopcionId: 'a-1', localidadId: 'l-2' }));
      expect(router.navigate).toHaveBeenCalledWith(jasmine.arrayContaining(['f-1']));
    });

    it('si tras crear no se navega, un segundo envío no vuelve a crear la ficha', async () => {
      (router.navigate as jasmine.Spy).and.resolveTo(false);
      fixture.componentInstance.form.controls.localidadId.setValue('l-2');
      fixture.detectChanges();
      await fixture.componentInstance.onSubmit();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.isEdit).toBeTrue();
      fixture.componentInstance.form.markAsDirty();
      await fixture.componentInstance.onSubmit();

      expect(facade.create).toHaveBeenCalledTimes(1);
    });
  });
});
