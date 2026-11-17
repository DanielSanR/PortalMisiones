import { Component, Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of, throwError } from 'rxjs';
import { FichaAdopcionResumen, FichaFormData, FichaLocalVM, FichasLocalesFacade } from '@features/fichas-locales';
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

const LIBRE: FichaFormData['ocupadas'] = {
  localidadIds: [], localidadIdsDesactivadas: [], localidadesVerificables: true, slugs: [],
};

const ADOPCION: FichaAdopcionResumen = {
  id: 'a-1', plantillaTitulo: 'Obtener la licencia de conducir', plantillaSlug: 'licencia', organismoNombre: 'Municipalidad de Posadas',
  habilitada: true,
};

function datos(ficha: FichaLocalVM | null, ocupadas = LIBRE, adopcion: FichaAdopcionResumen | null = null): FichaFormData {
  return {
    ficha,
    adopcion,
    localidades: [
      { id: 'l-1', nombre: 'Posadas', departamentoNombre: 'Capital' },
      { id: 'l-2', nombre: 'Oberá', departamentoNombre: 'Oberá' },
    ],
    ocupadas,
  };
}

/** `FichasLocalesFacade.fuenteSimulada` del test en curso. */
let SIMULADA = false;

describe('FichaFormComponent', () => {
  beforeEach(() => { SIMULADA = false; });

  let fixture: ComponentFixture<FichaFormComponent>;
  let facade: jasmine.SpyObj<FichasLocalesFacade>;
  let router: Router;

  const el = (): HTMLElement => fixture.nativeElement;

  async function crear(ficha: FichaLocalVM | null, ocupadas = LIBRE, queryAdopcion: string | null = ficha ? null : 'a-1'): Promise<void> {
    facade = jasmine.createSpyObj<FichasLocalesFacade>('FichasLocalesFacade', ['getFormData', 'update', 'create', 'getAdopcionesParaFicha']);
    facade.getAdopcionesParaFicha.and.returnValue(of([ADOPCION]));
    facade.getFormData.and.returnValue(of(datos(ficha, ocupadas)));
    facade.update.and.returnValue(of(FICHA));
    facade.create.and.returnValue(of(FICHA));
    Object.assign(facade, { fuenteSimulada: SIMULADA });

    await TestBed.configureTestingModule({
      imports: [FichaFormComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: FichasLocalesFacade, useValue: facade },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: ficha ? { id: ficha.id } : {},
              queryParamMap: convertToParamMap(queryAdopcion ? { adopcion: queryAdopcion } : {}),
            },
          },
        },
        { provide: MatSnackBar, useValue: jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']) },
      ],
    })
      .overrideComponent(FichaFormComponent, {
        remove: { imports: [PuntosAtencionPanelComponent, HasPermissionDirective] },
        add: { imports: [PuntosPanelStub, HasPermissionStub] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
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

    it('la nota de puntos enlaza al detalle de la ficha, en el panel de puntos', () => {
      const enlace = el().querySelector<HTMLAnchorElement>('.ficha-paneles__nota a')!;
      expect(enlace.getAttribute('href')).toBe('/dashboard/tramites/fichas/detalle/f-1#puntos-atencion');
    });

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

  describe('alta sin ?adopcion= (desde "Nueva ficha" de la lista)', () => {
    beforeEach(async () => {
      await crear(null, LIBRE, null);
      facade.getFormData.and.callFake((_ficha, adopcionId) => of(datos(null, LIBRE, adopcionId ? ADOPCION : null)));
    });

    it('el primer campo es el trámite del organismo y la localidad espera a que se lo elija', () => {
      expect(el().querySelector('app-tree-select')).not.toBeNull();
      expect(el().querySelector('#adopcion-label')!.textContent).toContain('Trámite del organismo');
      expect(fixture.componentInstance.form.controls.localidadId.disabled).toBeTrue();
      expect(facade.getAdopcionesParaFicha).toHaveBeenCalledTimes(1);
      expect(facade.getFormData).toHaveBeenCalledOnceWith(null, null);
      expect(el().querySelector('.detail-header__title')!.textContent).toContain('Elegí el trámite del organismo');
    });

    it('sin elegir el trámite no guarda y lo pide en el resumen', async () => {
      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();
      expect(facade.create).not.toHaveBeenCalled();
      expect(el().querySelector('app-form-error-banner')!.textContent).toContain('Trámite del organismo');
    });

    it('al elegirlo lee sus localidades ocupadas, habilita la localidad y crea con ese trámite', async () => {
      fixture.componentInstance.form.controls.adopcion.setValue('a-1');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(facade.getFormData).toHaveBeenCalledWith(null, 'a-1');
      expect(fixture.componentInstance.form.controls.localidadId.enabled).toBeTrue();
      expect(el().querySelector('.detail-header__title')!.textContent).toContain('Obtener la licencia de conducir');

      fixture.componentInstance.form.controls.localidadId.setValue('l-2');
      fixture.detectChanges();
      await fixture.componentInstance.onSubmit();
      expect(facade.create).toHaveBeenCalledOnceWith(jasmine.objectContaining({ adopcionId: 'a-1', localidadId: 'l-2' }));
    });

    it('un doble envío mientras guarda no crea dos fichas', async () => {
      fixture.componentInstance.form.controls.adopcion.setValue('a-1');
      await fixture.whenStable();
      fixture.componentInstance.form.controls.localidadId.setValue('l-2');
      const primero = fixture.componentInstance.onSubmit();
      const segundo = fixture.componentInstance.onSubmit();
      await Promise.all([primero, segundo]);
      expect(facade.create).toHaveBeenCalledTimes(1);
    });

    it('si falla la lectura del trámite avisa y deja reintentar, con la localidad bloqueada', async () => {
      facade.getFormData.and.returnValue(throwError(() => new Error('boom')));
      fixture.componentInstance.form.controls.adopcion.setValue('a-1');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.errorAdopcion).toBeTrue();
      expect(fixture.componentInstance.form.controls.localidadId.disabled).toBeTrue();
      expect(el().querySelector('.form-aviso[role="alert"]')!.textContent).toContain('Reintentar');
    });
  });

  describe('alta sin ?adopcion=: guardar con el trámite sin leer', () => {
    beforeEach(async () => {
      await crear(null, LIBRE, null);
    });

    /** Elige el trámite y deja la lectura en el estado pedido. */
    function elegir(lectura: Subject<FichaFormData>): void {
      facade.getFormData.and.returnValue(lectura);
      fixture.componentInstance.form.controls.adopcion.setValue('a-1');
      fixture.detectChanges();
    }

    it('mientras se lee el trámite no guarda, lo dice en el resumen y lleva el foco al campo del trámite', async () => {
      elegir(new Subject<FichaFormData>());
      fixture.componentInstance.form.controls.slug.setValue('obtener-licencia');
      expect(fixture.componentInstance.form.valid).withContext('la localidad deshabilitada no cuenta').toBeTrue();

      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      expect(facade.create).not.toHaveBeenCalled();
      expect(el().querySelector('app-form-error-banner')!.textContent).toContain('Trámite del organismo (se está leyendo');
      expect(el().querySelector('#adopcion-ayuda')!.parentElement!.querySelector('.form-field__error[role="alert"]')!.textContent)
        .toContain('Todavía se está leyendo');
      expect(el().contains(document.activeElement)).toBeTrue();
      expect(document.activeElement!.id).toBe('adopcion');
    });

    it('tras un error de lectura no guarda y el resumen manda a reintentar o elegir otro', async () => {
      facade.getFormData.and.returnValue(throwError(() => new Error('boom')));
      fixture.componentInstance.form.controls.adopcion.setValue('a-1');
      fixture.detectChanges();
      await fixture.whenStable();

      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      expect(facade.create).not.toHaveBeenCalled();
      expect(el().querySelector('app-form-error-banner')!.textContent).toContain('reintentá o elegí otro');
    });

    it('un trámite que ya no existe (404) tiene texto propio y no ofrece Reintentar', async () => {
      facade.getFormData.and.returnValue(throwError(() => ({ status: 404 })));
      fixture.componentInstance.form.controls.adopcion.setValue('a-1');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.adopcionInexistente).toBeTrue();
      expect(fixture.componentInstance.errorAdopcion).toBeFalse();
      const aviso = el().querySelector('.form-aviso[role="alert"]')!;
      expect(aviso.textContent).toContain('ya no está disponible');
      expect(aviso.textContent).not.toContain('conexión');
      expect(aviso.querySelector('button')).toBeNull();

      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();
      expect(facade.create).not.toHaveBeenCalled();
      expect(el().querySelector('app-form-error-banner')!.textContent).toContain('ya no está disponible: elegí otro');
    });

    it('al cambiar de trámite la localidad vuelve a quedar intacta (sin touched ni dirty)', async () => {
      facade.getFormData.and.callFake((_f, id) => of(datos(null, LIBRE, id ? ADOPCION : null)));
      const { adopcion, localidadId } = fixture.componentInstance.form.controls;
      adopcion.setValue('a-1');
      await fixture.whenStable();
      localidadId.setValue('l-1');
      localidadId.markAsTouched();
      localidadId.markAsDirty();

      adopcion.setValue('a-2');

      expect(localidadId.value).toBe('');
      expect(localidadId.touched).toBeFalse();
      expect(localidadId.dirty).toBeFalse();
    });
  });

  describe('fuente simulada', () => {
    it('avisa de forma persistente y el snackbar de alta aclara que no se guardó en el servidor', async () => {
      SIMULADA = true;
      await crear(null);
      const snack = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
      const aviso = el().querySelector('.form-aviso[role="note"]')!;
      expect(aviso.textContent).toContain('Datos de ejemplo');
      expect(aviso.textContent).toContain('se pierde al recargar');

      fixture.componentInstance.form.controls.localidadId.setValue('l-2');
      fixture.detectChanges();
      await fixture.componentInstance.onSubmit();
      expect(snack.calls.mostRecent().args[0]).toContain('(datos de ejemplo, no se guardó en el servidor)');
    });

    it('con fuente real no muestra el aviso ni cambia el snackbar', async () => {
      await crear(null);
      const snack = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
      expect(el().querySelector('.form-aviso[role="note"]')).toBeNull();
      fixture.componentInstance.form.controls.localidadId.setValue('l-2');
      fixture.detectChanges();
      await fixture.componentInstance.onSubmit();
      expect(snack.calls.mostRecent().args[0]).not.toContain('datos de ejemplo');
    });

    it('también avisa al editar', async () => {
      SIMULADA = true;
      await crear(FICHA);
      expect(el().querySelector('.form-aviso[role="note"]')!.textContent).toContain('Datos de ejemplo');
    });
  });

  describe('alta sin ?adopcion= y sin trámites habilitados', () => {
    beforeEach(async () => {
      await crear(null, LIBRE, null);
    });

    it('lo dice en el formulario y enlaza a Trámites del organismo', async () => {
      facade.getAdopcionesParaFicha.and.returnValue(of([]));
      fixture.componentInstance.cargar();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const aviso = el().querySelector('#adopcion-ayuda')!;
      expect(aviso.textContent).toContain('No hay trámites del organismo habilitados');
      expect(aviso.querySelector('a')!.getAttribute('href')).toContain('/dashboard/tramites/adopciones');
      expect(el().querySelector('app-tree-select')).toBeNull();
    });
  });

  describe('alta con ?adopcion= (adopción fija)', () => {
    beforeEach(() => crear(null));

    it('no ofrece el selector del trámite y no pide leer los trámites', () => {
      expect(el().querySelector('app-tree-select')).toBeNull();
      expect(facade.getAdopcionesParaFicha).not.toHaveBeenCalled();
      expect(facade.getFormData).toHaveBeenCalledOnceWith(null, 'a-1');
    });
  });

  describe('alta con localidades que ya tienen ficha', () => {
    beforeEach(() => crear(null, {
      localidadIds: ['l-1', 'l-2'], localidadIdsDesactivadas: ['l-2'], localidadesVerificables: true,
      slugs: ['slug-en-uso'],
    }));

    it('una localidad con ficha activa no se puede elegir', async () => {
      const localidad = fixture.componentInstance.form.controls.localidadId;
      localidad.setValue('l-1');
      expect(localidad.hasError('localidadOcupada')).toBeTrue();
      await fixture.componentInstance.onSubmit();
      expect(facade.create).not.toHaveBeenCalled();
    });

    it('si la ficha de la localidad está desactivada, pide reactivarla en vez de crear otra', async () => {
      const localidad = fixture.componentInstance.form.controls.localidadId;
      localidad.setValue('l-2');
      expect(localidad.hasError('localidadDesactivada')).toBeTrue();
      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      expect(facade.create).not.toHaveBeenCalled();
      expect(el().querySelector('app-form-error-banner')!.textContent).toContain('reactivala');
    });

    it('un slug que ya usa otra ficha (activa o desactivada) no se acepta', () => {
      const slug = fixture.componentInstance.form.controls.slug;
      slug.setValue('Slug en uso');
      expect(slug.hasError('slugRepetido')).toBeTrue();
    });
  });
});
