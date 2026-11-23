import { Component, Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of, throwError } from 'rxjs';
import {
  DespublicacionFallidaError, FichaAdopcionResumen, FichaCambiadaError, FichaFormData, FichaLocalVM, FichasLocalesFacade,
} from '@features/fichas-locales';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { PuntosAtencionPanelComponent } from '../components/puntos-atencion-panel/puntos-atencion-panel.component';
import { FichaFormComponent } from './ficha-form.component';

/** Reemplaza al panel real (que trae su propio facade): solo importa dónde se dibuja. */
@Component({ selector: 'app-puntos-atencion-panel', standalone: true, template: '<p class="puntos-stub">puntos</p>' })
class PuntosPanelStub {
  @Input() fichaId = '';
  @Input() localidad: string | null = null;
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
  requisitos: 'DNI vigente', costos: 'Gratis',
  plantillaId: 'p-1', plantillaTitulo: 'Obtener la licencia de conducir',
  organismoId: 'o-1', organismoNombre: 'Municipalidad de Posadas', localidadNombre: 'Posadas',
};

const LIBRE: FichaFormData['ocupadas'] = {
  localidadIds: [], localidadIdsDesactivadas: [], slugs: [],
};

const ADOPCION: FichaAdopcionResumen = {
  id: 'a-1', plantillaTitulo: 'Obtener la licencia de conducir', plantillaSlug: 'licencia', organismoNombre: 'Municipalidad de Posadas',
  habilitada: true, vigente: true, motivoNoVigente: null, vigenteDesde: new Date(2026, 0, 1), vigenteHasta: null,
};

/** Habilitada, pero todavía no empezó a regir: el backend respondería 404 al crearle una ficha. */
const PROGRAMADA: FichaAdopcionResumen = {
  ...ADOPCION, id: 'a-2', plantillaTitulo: 'Inscribirse al registro', vigente: false, motivoNoVigente: 'programada',
  vigenteDesde: new Date(2027, 2, 1),
};

/** Habilitada, pero ya venció. */
const VENCIDA: FichaAdopcionResumen = {
  ...ADOPCION, id: 'a-3', plantillaTitulo: 'Obtener el carnet', vigente: false, motivoNoVigente: 'vencida',
  vigenteHasta: new Date(2026, 5, 30),
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
    facade.update.and.returnValue(of({ ficha: FICHA, despublicada: false }));
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

      expect(facade.update).toHaveBeenCalledOnceWith(
        'f-1', jasmine.objectContaining({ activa: true, url: 'https://otra.gob.ar' }), { version: 1, estado: 'PUBLICADO', activa: true },
      );
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
      expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.getAttribute('aria-disabled')).toBe('true');
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

  describe('vigencia del trámite del organismo', () => {
    it('en el selector, los no vigentes figuran no elegibles y con el motivo y la fecha; los vigentes, elegibles', async () => {
      await crear(null, LIBRE, null);
      facade.getAdopcionesParaFicha.and.returnValue(of([ADOPCION, PROGRAMADA, VENCIDA]));
      fixture.componentInstance.cargar();
      await fixture.whenStable();

      const nodos = fixture.componentInstance.arbolAdopciones.nodes;
      expect(nodos.find((n) => n.id === 'a-1')!.disabledReason).toBeUndefined();
      expect(nodos.find((n) => n.id === 'a-2')!.disabledReason).toBe('Empieza a regir el 01/03/2027');
      expect(nodos.find((n) => n.id === 'a-3')!.disabledReason).toBe('Venció el 30/06/2026');
      expect(fixture.componentInstance.sinAdopcionesVigentes).toBeFalse();
    });

    it('si ninguno está vigente lo avisa y remite a Trámites del organismo', async () => {
      await crear(null, LIBRE, null);
      facade.getAdopcionesParaFicha.and.returnValue(of([PROGRAMADA, VENCIDA]));
      fixture.componentInstance.cargar();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const aviso = el().querySelector('.form-aviso[role="status"]')!;
      expect(aviso.textContent).toContain('no hay ningún trámite del organismo vigente');
      expect(aviso.querySelector('a')!.getAttribute('href')).toContain('/dashboard/tramites/adopciones');
    });

    it('si el trámite elegido dejó de estar vigente no habilita la localidad ni deja guardar', async () => {
      await crear(null, LIBRE, null);
      facade.getFormData.and.returnValue(of(datos(null, LIBRE, VENCIDA)));
      fixture.componentInstance.form.controls.adopcion.setValue('a-3');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.adopcionElegidaNoVigente).toBeTrue();
      expect(fixture.componentInstance.form.controls.localidadId.disabled).toBeTrue();
      expect(el().querySelector('.form-aviso[role="alert"]')!.textContent).toContain('ya no está vigente');

      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();
      expect(facade.create).not.toHaveBeenCalled();
      expect(el().querySelector('app-form-error-banner')!.textContent).toContain('ya no está vigente: elegí otro');
    });

    it('con ?adopcion= de un trámite no vigente avisa arriba del form que no se le pueden crear fichas', async () => {
      await crear(null);
      facade.getFormData.and.returnValue(of(datos(null, LIBRE, VENCIDA)));
      fixture.componentInstance.cargar();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const aviso = el().querySelector('[data-aviso="no-vigente"]')!;
      expect(aviso.textContent).toContain('El trámite del organismo ya venció');
      expect(aviso.textContent).toContain('no vas a poder crearle fichas');
    });

    it('al editar una ficha de un trámite no vigente avisa que no se van a poder guardar cambios', async () => {
      await crear(FICHA);
      facade.getFormData.and.returnValue(of(datos(FICHA, LIBRE, { ...ADOPCION, habilitada: false, vigente: false, motivoNoVigente: 'deshabilitada' })));
      fixture.componentInstance.cargar();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const aviso = el().querySelector('[data-aviso="no-vigente"]')!;
      expect(aviso.textContent).toContain('El trámite del organismo está deshabilitado');
      expect(aviso.textContent).toContain('no vas a poder guardar cambios en esta ficha');
    });

    it('con el trámite vigente no hay aviso', async () => {
      await crear(FICHA);
      facade.getFormData.and.returnValue(of(datos(FICHA, LIBRE, ADOPCION)));
      fixture.componentInstance.cargar();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el().querySelector('[data-aviso="no-vigente"]')).toBeNull();
    });

    it('si igual llega el 404 de la adopción al crear, muestra el mensaje propio y no el del backend', async () => {
      await crear(null);
      facade.create.and.returnValue(throwError(() => ({
        status: 404,
        error: { code: 4073, message: 'El objeto OrganismProcedure con el identificador a-1 no existe.' },
      })));
      fixture.componentInstance.form.controls.localidadId.setValue('l-2');
      fixture.detectChanges();
      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      expect(fixture.componentInstance.marco.guardando).toBeFalse();
      expect(fixture.componentInstance.marco.errorDeGuardado).toContain('El trámite del organismo ya no está vigente');
      expect(el().textContent).not.toContain('OrganismProcedure');
      expect(el().textContent).not.toContain('identificador');
    });
  });

  describe('edición: el PUT lleva la ficha completa', () => {
    it('sin tocar más que los costos, viajan adopción, localidad, slug, URL y requisitos tal como se leyeron', async () => {
      await crear(FICHA);
      const { costos } = fixture.componentInstance.form.controls;
      costos.setValue('$30.000');
      costos.markAsDirty();
      await fixture.componentInstance.onSubmit();

      expect(facade.update).toHaveBeenCalledOnceWith('f-1', {
        adopcionId: FICHA.adopcionId,
        localidadId: FICHA.localidadId,
        slug: FICHA.slug,
        conservarSlug: true,
        url: FICHA.url!,
        requisitos: FICHA.requisitos!,
        costos: '$30.000',
        activa: true,
      }, { version: FICHA.version, estado: FICHA.estado, activa: FICHA.activa });
    });

    it('una ficha sin URL, requisitos ni costos se puede editar (ya no se bloquea)', async () => {
      await crear({ ...FICHA, url: null, requisitos: null, costos: null });
      expect(fixture.componentInstance.errorCarga).toBeNull();
      expect(el().querySelector('form')).not.toBeNull();
      expect(fixture.componentInstance.form.getRawValue().localidadId).toBe('l-1');
    });
  });

  describe('slug heredado no canónico (M2)', () => {
    const HEREDADO = 'Obtener_Licencia.POSADAS';

    beforeEach(() => crear({ ...FICHA, slug: HEREDADO }));

    it('sin tocarlo, guardar otro campo lo manda tal cual: la dirección pública no cambia', async () => {
      const { costos } = fixture.componentInstance.form.controls;
      costos.setValue('$30.000');
      costos.markAsDirty();
      await fixture.componentInstance.onSubmit();

      expect(facade.update.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ slug: HEREDADO, conservarSlug: true }));
    });

    it('no anuncia "Se guardará como" (sería falso) y avisa que se conserva; el membrete lo muestra tal cual', () => {
      expect(el().querySelector('.field-preview__valor')).toBeNull();
      expect(el().querySelector('.field-preview')!.textContent).toContain('se guarda tal cual mientras no lo edites');
      expect(el().querySelector('.detail-header__code')!.textContent).toBe(HEREDADO);
    });

    it('si se lo edita, ahí sí se canonicaliza (deja de conservarse)', async () => {
      const { slug } = fixture.componentInstance.form.controls;
      slug.setValue('Otro Slug');
      slug.markAsDirty();
      await fixture.componentInstance.onSubmit();

      expect(facade.update.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ slug: 'Otro Slug', conservarSlug: false }));
    });
  });

  describe('URL que no pasa el patrón (M3)', () => {
    const mensajeDe = (valor: string): string => {
      const { url } = fixture.componentInstance.form.controls;
      url.setValue(valor);
      url.markAsTouched();
      fixture.detectChanges();
      return el().querySelector('#url')!.closest('mat-form-field')!.querySelector('mat-error')?.textContent?.trim() ?? '';
    };

    it('cada problema dice qué corregir: falta el https://, hay espacios, o falta el sitio', async () => {
      await crear(FICHA);
      expect(mensajeDe('www.posadas.gob.ar')).toContain('Tiene que empezar con https://');
      expect(mensajeDe('https://posadas.gob.ar/mis tramites')).toContain('No puede tener espacios');
      expect(mensajeDe('https://')).toContain('Falta el sitio después de https://');
      expect(mensajeDe('https://www.posadas.gob.ar/licencias')).toBe('');
    });

    it('una URL guardada que hoy no valida muestra el error al abrir, sin esperar a un guardado fallido', async () => {
      await crear({ ...FICHA, url: 'posadas.gob.ar/licencias' });
      const error = el().querySelector('#url')!.closest('mat-form-field')!.querySelector('mat-error');
      expect(error?.textContent).toContain('Tiene que empezar con https://');
    });
  });

  describe('ficha que figura publicada pero está desactivada (I4)', () => {
    beforeEach(() => crear({ ...FICHA, estado: 'PUBLICADO', activa: false }));

    it('avisa ANTES de guardar que se va a despublicar, y el pie deja de decir que guardar no cambia el estado', () => {
      const aviso = el().querySelector('[data-aviso="se-despublica"]')!;
      expect(aviso.textContent).toContain('Al guardar se va a despublicar');
      expect(el().textContent).not.toContain('Guardar no cambia el estado de publicación');
    });

    it('sin tocar nada se puede guardar igual (es lo que promete el aviso): el botón dice "Guardar y despublicar"', async () => {
      const c = fixture.componentInstance;
      expect(c.form.pristine).toBeTrue();
      expect(c.sinCambios).toBeFalse();
      const enviar = el().querySelector<HTMLButtonElement>('button[type="submit"]')!;
      expect(enviar.getAttribute('aria-disabled')).toBeNull();
      expect(enviar.textContent).toContain('Guardar y despublicar');
      expect(el().querySelector('[data-aviso="se-despublica"]')!.textContent).toContain('usá "Guardar y despublicar"');
      expect(el().querySelector('.form-actions__help')!.textContent).toContain('Al guardar, la ficha se despublica.');

      facade.update.and.returnValue(of({ ficha: { ...FICHA, estado: 'DESPUBLICADO', activa: false }, despublicada: true }));
      await c.onSubmit();
      expect(facade.update).toHaveBeenCalledTimes(1);
    });

    it('si se la reactiva y se vuelve atrás sin más cambios, el botón vuelve a "Guardar cambios" solo al reactivar', () => {
      fixture.componentInstance.form.controls.activa.setValue(true);
      fixture.componentInstance.form.controls.activa.markAsDirty();
      fixture.detectChanges();
      expect(el().querySelector<HTMLButtonElement>('button[type="submit"]')!.textContent).toContain('Guardar cambios');
    });

    it('un guardado común no menciona ninguna despublicación', async () => {
      facade.update.and.returnValue(of({ ficha: { ...FICHA, estado: 'PUBLICADO', activa: true }, despublicada: false }));
      const snack = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
      fixture.componentInstance.form.controls.activa.setValue(true);
      fixture.componentInstance.form.markAsDirty();
      await fixture.componentInstance.onSubmit();

      expect(snack.calls.mostRecent().args[0]).not.toContain('despublicó');
    });

    it('si se la reactiva, el aviso se va (ahí guardar conserva el estado)', () => {
      fixture.componentInstance.form.controls.activa.setValue(true);
      fixture.detectChanges();
      expect(el().querySelector('[data-aviso="se-despublica"]')).toBeNull();
    });

    it('el snackbar dice que además se despublicó', async () => {
      facade.update.and.returnValue(of({ ficha: { ...FICHA, estado: 'DESPUBLICADO', activa: false }, despublicada: true }));
      const snack = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
      fixture.componentInstance.form.controls.costos.setValue('$1');
      fixture.componentInstance.form.markAsDirty();
      await fixture.componentInstance.onSubmit();

      expect(snack.calls.mostRecent().args[0]).toContain('además se despublicó');
    });

    it('si falla el segundo paso NO dice "No se pudo guardar": los cambios se guardaron y falta despublicar', async () => {
      const guardada: FichaLocalVM = { ...FICHA, estado: 'PUBLICADO', activa: false, version: 9 };
      facade.update.and.returnValue(throwError(() => new DespublicacionFallidaError(guardada)));
      fixture.componentInstance.form.controls.costos.setValue('$1');
      fixture.componentInstance.form.markAsDirty();
      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();

      const banner = el().querySelector('app-form-error-banner')!.textContent!;
      expect(banner).toContain('Los cambios se guardaron, pero no se pudo despublicar la ficha');
      expect(banner).not.toContain('No se pudo guardar');
      expect(fixture.componentInstance.marco.guardando).toBeFalse();
      expect((TestBed.inject(Router).navigate as jasmine.Spy)).not.toHaveBeenCalled();

      // Reintentar parte de lo que quedó guardado: si no, la relectura daría un falso "la ficha cambió".
      await fixture.componentInstance.onSubmit();
      expect(facade.update.calls.mostRecent().args[2]).toEqual({ version: 9, estado: 'PUBLICADO', activa: false });
    });
  });

  describe('la ficha cambió en el servidor desde que se abrió el form (I5): el form se rebasa', () => {
    const ACTUAL: FichaLocalVM = { ...FICHA, version: 4, requisitos: 'Lo que cargó otra persona' };

    /** Como lo hace una persona: cambia el valor y el control queda dirty. */
    function editar(campo: 'slug' | 'url' | 'requisitos' | 'costos' | 'activa', valor: string | boolean): void {
      const control = fixture.componentInstance.form.controls[campo];
      (control as { setValue(v: unknown): void }).setValue(valor);
      control.markAsDirty();
    }

    /** Guarda y el facade responde que la ficha cambió (está como `actual`). */
    async function guardarConCambioAjeno(actual: FichaLocalVM): Promise<void> {
      facade.update.and.returnValue(throwError(() => new FichaCambiadaError(actual)));
      await fixture.componentInstance.onSubmit();
      fixture.detectChanges();
    }

    const aviso = (): HTMLElement | null => el().querySelector<HTMLElement>('[data-aviso="ficha-cambiada"]');
    const valores = () => fixture.componentInstance.form.getRawValue();
    const botones = (): HTMLButtonElement[] => Array.from(aviso()!.querySelectorAll('button'));

    describe('con cambios propios en otro campo que el que cambió la otra persona', () => {
      beforeEach(async () => {
        await crear(FICHA);
        document.body.append(fixture.nativeElement);
        editar('costos', '$30.000');
        await guardarConCambioAjeno(ACTUAL);
      });

      afterEach(() => fixture.nativeElement.remove());

      it('no navega ni da por guardado: dice qué pasó y ofrece "Guardar mis cambios" o "Descartar mis cambios"', () => {
        expect(aviso()!.textContent).toContain('Todavía no se guardó: otra persona modificó esta ficha mientras la editabas.');
        expect(aviso()!.textContent).toContain('Actualizamos los campos que no habías tocado con lo que hay ahora en el servidor (versión 4)');
        expect(aviso()!.textContent).toContain('Ninguno de tus cambios pisa lo que cambió la otra persona.');
        expect(aviso()!.querySelector('[data-conflicto="en-disputa"]')).toBeNull();
        expect(botones().map((b) => b.textContent!.trim())).toEqual(['Guardar mis cambios', 'Descartar mis cambios']);
        expect((TestBed.inject(Router).navigate as jasmine.Spy)).not.toHaveBeenCalled();
        expect(fixture.componentInstance.marco.guardando).toBeFalse();
      });

      it('el campo que no se tocó toma el valor nuevo sin ensuciarse; el editado conserva lo escrito', () => {
        expect(valores().requisitos).toBe('Lo que cargó otra persona');
        expect(fixture.componentInstance.form.controls.requisitos.pristine).toBeTrue();
        expect(valores().costos).toBe('$30.000');
        expect(fixture.componentInstance.form.controls.costos.dirty).toBeTrue();
        // Lo que se ve en el campo, no solo en el modelo.
        expect(el().querySelector<HTMLTextAreaElement>('#requisitos')!.value).toBe('Lo que cargó otra persona');
      });

      it('el foco va al aviso (está arriba de la tarjeta y el botón de guardar, abajo)', () => {
        expect(aviso()!.getAttribute('tabindex')).toBe('-1');
        expect(aviso()!.getAttribute('role')).toBe('group');
        expect(document.activeElement).toBe(aviso());
      });

      it('"Guardar mis cambios" guarda sobre la base nueva y NO revierte lo que cambió la otra persona', async () => {
        facade.update.and.returnValue(of({ ficha: { ...ACTUAL, version: 5, costos: '$30.000' }, despublicada: false }));
        const guardar = spyOn(fixture.componentInstance, 'guardarMisCambios').and.callThrough();
        botones()[0].click();
        await guardar.calls.mostRecent().returnValue;

        const [, form, base] = facade.update.calls.mostRecent().args;
        expect(base).toEqual({ version: 4, estado: 'BORRADOR', activa: true });
        expect(form).toEqual(jasmine.objectContaining({ costos: '$30.000', requisitos: 'Lo que cargó otra persona' }));
        expect((TestBed.inject(Router).navigate as jasmine.Spy)).toHaveBeenCalled();
      });

      it('"Guardar mis cambios" con el form inválido no envía nada y el conflicto sigue a la vista (la base no se tocó antes de validar)', async () => {
        editar('url', 'sin-esquema');
        facade.update.calls.reset();
        await fixture.componentInstance.guardarMisCambios();
        fixture.detectChanges();

        expect(facade.update).not.toHaveBeenCalled();
        expect(aviso()).not.toBeNull();

        // Corregido, guarda con la base de la ficha actual; y un cambio POSTERIOR se sigue detectando.
        editar('url', 'https://ok.gob.ar');
        await guardarConCambioAjeno({ ...ACTUAL, version: 7, requisitos: 'Tercera versión' });
        expect(facade.update.calls.mostRecent().args[2]).toEqual({ version: 4, estado: 'BORRADOR', activa: true });
        expect(valores().requisitos).toBe('Tercera versión');
        expect(aviso()!.textContent).toContain('versión 7');
      });

      it('mientras guarda, los botones del aviso no usan `disabled` nativo (no sueltan el foco) y no repiten el envío', async () => {
        const respuesta$ = new Subject<{ ficha: FichaLocalVM; despublicada: boolean }>();
        facade.update.and.returnValue(respuesta$);
        facade.update.calls.reset();
        const guardar = spyOn(fixture.componentInstance, 'guardarMisCambios').and.callThrough();
        botones()[0].focus();
        botones()[0].click();
        fixture.detectChanges();

        expect(aviso()).withContext('el aviso sigue mientras guarda').not.toBeNull();
        expect(botones()[0].disabled).toBeFalse();
        expect(botones()[0].getAttribute('aria-disabled')).toBe('true');
        expect(document.activeElement).toBe(botones()[0]);
        botones()[0].click();
        botones()[1].click();
        expect(facade.update).toHaveBeenCalledTimes(1);
        expect(facade.getFormData).toHaveBeenCalledTimes(1);

        respuesta$.next({ ficha: { ...ACTUAL, version: 5 }, despublicada: false });
        respuesta$.complete();
        await guardar.calls.first().returnValue;
      });

      it('"Descartar mis cambios" vuelve a leer la ficha, descarta lo escrito, saca el aviso y lleva el foco al título', async () => {
        facade.getFormData.and.returnValue(of(datos(ACTUAL)));
        botones()[1].click();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(aviso()).toBeNull();
        expect(valores().requisitos).toBe('Lo que cargó otra persona');
        expect(valores().costos).toBe('Gratis');
        expect(fixture.componentInstance.form.pristine).toBeTrue();
        const titulo = el().querySelector<HTMLElement>('.membrete__titulo')!;
        expect(titulo.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(titulo);
      });
    });

    it('si los dos cambiaron el mismo campo, lo nombra por su etiqueta y avisa que tu valor reemplaza al del otro', async () => {
      await crear(FICHA);
      editar('requisitos', 'Mis requisitos');
      editar('costos', '$30.000');
      await guardarConCambioAjeno({ ...ACTUAL, costos: '$99', url: 'https://nueva.gob.ar' });

      const disputa = aviso()!.querySelector('[data-conflicto="en-disputa"]')!.textContent!.replace(/\s+/g, ' ');
      expect(disputa).toContain('Estos campos los cambiaron los dos: Requisitos, Costos.');
      expect(disputa).toContain('Quedaron con tu valor: si guardás, va a reemplazar lo que cargó la otra persona.');
      expect(valores().requisitos).toBe('Mis requisitos');
      expect(valores().costos).toBe('$30.000');
      // El que solo cambió la otra persona se actualizó.
      expect(valores().url).toBe('https://nueva.gob.ar');
    });

    it('un solo campo en disputa va en singular', async () => {
      await crear(FICHA);
      editar('requisitos', 'Mis requisitos');
      await guardarConCambioAjeno(ACTUAL);

      const disputa = aviso()!.querySelector('[data-conflicto="en-disputa"]')!.textContent!.replace(/\s+/g, ' ');
      expect(disputa).toContain('Este campo lo cambiaron los dos: Requisitos.');
      expect(disputa).toContain('Quedó con tu valor');
    });

    it('el slug que no se tocó pasa a ser el que hay ahora: es el que viaja (no el que se leyó al abrir)', async () => {
      await crear(FICHA);
      editar('costos', '$30.000');
      await guardarConCambioAjeno({ ...ACTUAL, slug: 'slug-que-puso-otro' });
      expect(valores().slug).toBe('slug-que-puso-otro');

      facade.update.and.returnValue(of({ ficha: ACTUAL, despublicada: false }));
      await fixture.componentInstance.guardarMisCambios();

      expect(facade.update.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ slug: 'slug-que-puso-otro', conservarSlug: true }));
    });

    it('si otra persona la DESACTIVÓ (sin tocar "Ficha activa" acá), guardar no la reactiva', async () => {
      await crear(FICHA);
      editar('costos', '$30.000');
      await guardarConCambioAjeno({ ...FICHA, activa: false });

      expect(valores().activa).toBeFalse();
      expect(el().querySelector('.pill--inactive')).withContext('el membrete lo muestra').not.toBeNull();

      facade.update.and.returnValue(of({ ficha: { ...FICHA, activa: false }, despublicada: false }));
      await fixture.componentInstance.guardarMisCambios();
      const [, form, base] = facade.update.calls.mostRecent().args;
      expect(form.activa).toBeFalse();
      expect(base).toEqual({ version: 1, estado: 'BORRADOR', activa: false });
    });

    it('publicada y activa (interruptor bloqueado) que otro desactivó: tras el conflicto el interruptor vuelve a ser editable y apagado', async () => {
      await crear({ ...FICHA, estado: 'PUBLICADO' });
      expect(fixture.componentInstance.form.controls.activa.disabled).toBeTrue();
      editar('costos', '$30.000');
      await guardarConCambioAjeno({ ...FICHA, estado: 'DESPUBLICADO', activa: false, version: 2 });

      const activa = fixture.componentInstance.form.controls.activa;
      expect(activa.enabled).toBeTrue();
      expect(activa.value).toBeFalse();
      expect(el().querySelector('button.form-toggle__interruptor')).toBeNull();
      expect(el().querySelector('mat-slide-toggle')).not.toBeNull();

      // Y se puede reactivar desde acá.
      activa.setValue(true);
      activa.markAsDirty();
      facade.update.and.returnValue(of({ ficha: FICHA, despublicada: false }));
      await fixture.componentInstance.guardarMisCambios();
      expect(facade.update.calls.mostRecent().args[1].activa).toBeTrue();
    });

    it('si acá se la quería desactivar y otro la PUBLICÓ: el interruptor vuelve a prendido y bloqueado, y se avisa', async () => {
      await crear(FICHA);
      editar('activa', false);
      editar('costos', '$30.000');
      await guardarConCambioAjeno({ ...FICHA, estado: 'PUBLICADO', version: 3 });

      expect(valores().activa).toBeTrue();
      expect(fixture.componentInstance.form.controls.activa.disabled).toBeTrue();
      expect(aviso()!.querySelector('[data-conflicto="activa-restablecida"]')!.textContent)
        .toContain('"Ficha activa" volvió a quedar prendido');
    });

    it('sin cambios propios reales no hay conflicto: actualiza el form y avisa, sin ofrecer guardar ni descartar', async () => {
      await crear(FICHA);
      // Lo que escribió coincide con lo que ya hay en el servidor.
      editar('requisitos', 'Lo que cargó otra persona');
      await guardarConCambioAjeno(ACTUAL);

      expect(aviso()).toBeNull();
      const actualizada = el().querySelector('[data-aviso="ficha-actualizada"]')!;
      expect(actualizada.textContent).toContain('Otra persona modificó esta ficha mientras la tenías abierta.');
      expect(actualizada.textContent).toContain('No tenías cambios propios, así que no se guardó nada: ya estás viendo cómo quedó (versión 4).');
      expect(actualizada.querySelector('button')).toBeNull();
      expect(fixture.componentInstance.form.pristine).toBeTrue();
      expect(fixture.componentInstance.sinCambios).toBeTrue();
    });
  });

  describe('"Recargar" tras un conflicto o un error (limpieza y bloqueo del interruptor)', () => {
    it('publicada y activa → recargada como despublicada e inactiva: el interruptor queda habilitado', async () => {
      await crear({ ...FICHA, estado: 'PUBLICADO' });
      expect(fixture.componentInstance.form.controls.activa.disabled).toBeTrue();

      facade.getFormData.and.returnValue(of(datos({ ...FICHA, estado: 'DESPUBLICADO', activa: false })));
      fixture.componentInstance.descartarMisCambios();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.form.controls.activa.enabled).toBeTrue();
      expect(el().querySelector('mat-slide-toggle')).not.toBeNull();
    });

    it('y al revés: si al recargar está publicada y activa, se bloquea', async () => {
      await crear(FICHA);
      facade.getFormData.and.returnValue(of(datos({ ...FICHA, estado: 'PUBLICADO' })));
      fixture.componentInstance.cargar();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.form.controls.activa.disabled).toBeTrue();
    });

    it('recargar limpia el error del servidor y el resumen de un envío inválido anterior', async () => {
      await crear(FICHA);
      const c = fixture.componentInstance;
      facade.update.and.returnValue(throwError(() => ({ status: 500, error: { code: 5000 } })));
      c.form.controls.costos.setValue('$1');
      c.form.controls.costos.markAsDirty();
      await c.onSubmit();
      c.form.controls.slug.setValue('');
      await c.onSubmit();
      fixture.detectChanges();
      expect(c.marco.errorDeGuardado).not.toBe('');
      expect(c.submitted).toBeTrue();

      c.cargar();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(c.marco.errorDeGuardado).toBe('');
      expect(c.serverErrorTitulo).toBe('No se pudo guardar');
      expect(c.submitted).toBeFalse();
      expect(el().querySelector('.form-error-banner')).toBeNull();
    });
  });

  describe('foco en el error del servidor', () => {
    it('un guardado rechazado lleva el foco al banner del error, que queda descrito por su detalle', async () => {
      await crear(FICHA);
      document.body.append(fixture.nativeElement);
      facade.update.and.returnValue(throwError(() => ({ status: 500, error: { code: 5000 } })));
      fixture.componentInstance.form.controls.costos.setValue('$1');
      fixture.componentInstance.form.controls.costos.markAsDirty();
      await fixture.componentInstance.onSubmit();

      const banner = el().querySelector<HTMLElement>('[data-banner="error-servidor"] .form-error-banner')!;
      expect(banner.getAttribute('tabindex')).toBe('-1');
      expect(document.activeElement).toBe(banner);
      expect(document.getElementById(banner.getAttribute('aria-describedby')!)!.textContent).toContain('slug ya esté en uso');
      fixture.nativeElement.remove();
    });
  });

  describe('compatibilidad con un backend anterior a 586b670: la ficha llega sin contenido (B1)', () => {
    beforeEach(() => crear({ ...FICHA, adopcionId: '', localidadId: '', url: null, requisitos: null, costos: null, sinContenido: true }));

    it('no dibuja el formulario: explica que no se puede editar hasta que el servidor se actualice', () => {
      expect(el().querySelector('form')).toBeNull();
      const estado = el().querySelector('.load-state')!;
      expect(estado.getAttribute('role')).toBe('alert');
      expect(estado.textContent).toContain('El servidor todavía no entrega el contenido de la ficha; no se puede editar hasta que se actualice.');
      // Reintentar no sirve: solo queda volver al listado.
      expect(Array.from(estado.querySelectorAll('button')).map((b) => b.textContent!.trim())).toEqual(['Ir al listado']);
    });

    it('aunque se fuerce el envío, jamás manda un PUT', async () => {
      await fixture.componentInstance.onSubmit();
      expect(facade.update).not.toHaveBeenCalled();
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
      localidadIds: ['l-1', 'l-2'], localidadIdsDesactivadas: ['l-2'],
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
