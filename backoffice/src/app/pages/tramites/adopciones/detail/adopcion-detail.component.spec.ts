import { Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AdopcionVM, AdopcionesFacade } from '@features/adopciones';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { pulsarEnConfirmacion, tituloDeConfirmacion } from '@shared/components/confirm-dialog/testing/confirmacion.testing';
import { DynamicFormComponent } from '@shared/components/dynamic-form/dynamic-form.component';
import { AdopcionDetailComponent } from './adopcion-detail.component';

/** Gating por permiso: dibuja solo si el permiso está en `PERMISOS`. */
let PERMISOS: string[] = [];
@Directive({ selector: '[appHasPermission]', standalone: true })
class HasPermissionStub {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vc = inject(ViewContainerRef);
  @Input() set appHasPermission(valor: string | string[]) {
    const lista = Array.isArray(valor) ? valor : [valor];
    this.vc.clear();
    if (lista.some((p) => PERMISOS.includes(p))) this.vc.createEmbeddedView(this.tpl);
  }
}

const ADOPCION: AdopcionVM = {
  id: 'a-1', plantillaId: 'p-1', organismoId: 'o-1', organismoTitularId: null, habilitada: true,
  vigenteDesde: new Date(2026, 0, 10, 8, 30), vigenteHasta: null,
  plantillaTitulo: 'Obtener la licencia de conducir', organismoNombre: 'Municipalidad de Posadas',
  vigente: true, estadoVigencia: 'vigente',
};

/** Caracterización del detalle de un trámite del organismo: carga, guardado y deshabilitar. */
describe('AdopcionDetailComponent', () => {
  let fixture: ComponentFixture<AdopcionDetailComponent>;
  let facade: jasmine.SpyObj<AdopcionesFacade>;
  let navigate: jasmine.Spy;
  let avisos: jasmine.Spy;

  const el = (): HTMLElement => fixture.nativeElement;
  const componente = (): AdopcionDetailComponent => fixture.componentInstance;
  const botones = (raiz: Element): string[] =>
    Array.from(raiz.querySelectorAll('button')).map((b) => b.textContent!.trim());
  const dialog = (): MatDialog => fixture.debugElement.injector.get(MatDialog);
  /** El `FormGroup` de "Vigencia y estado" (lo arma `app-dynamic-form`). */
  const form = (): FormGroup => fixture.debugElement.query(By.directive(DynamicFormComponent)).componentInstance.form;
  /** Cambia un campo como lo haría la persona: queda dirty. */
  const cambiar = (campo: string, valor: unknown): void => {
    const control = form().get(campo)!;
    control.markAsDirty();
    control.setValue(valor);
    fixture.detectChanges();
  };
  /** Espera a los campos que el formulario dibuja en diferido (fechas e interruptor) y repinta. */
  const asentar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  /** Lo que hace "Guardar cambios" (o Enter): envía el `<form>`. */
  const enviar = (): void => {
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
  };

  function crear(detalle$: Observable<AdopcionVM>, permisos = ['UPDATE_ADOPTION']): void {
    PERMISOS = permisos;
    facade = jasmine.createSpyObj<AdopcionesFacade>('AdopcionesFacade', ['getDetalle', 'update', 'deshabilitar']);
    facade.getDetalle.and.returnValue(detalle$);
    TestBed.configureTestingModule({
      imports: [AdopcionDetailComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: AdopcionesFacade, useValue: facade },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'a-1' })) } },
      ],
    }).overrideComponent(AdopcionDetailComponent, {
      remove: { imports: [HasPermissionDirective] },
      add: { imports: [HasPermissionStub] },
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(AdopcionDetailComponent);
    // El componente importa `MatSnackBarModule`: su `MatSnackBar` es el de su propio injector.
    avisos = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
    fixture.detectChanges();
  }

  afterEach(() => dialog().closeAll());

  describe('carga', () => {
    it('mientras carga lo dice, sin dibujar el detalle', () => {
      crear(new Subject<AdopcionVM>());

      const cargando = el().querySelector('.loading-inline[role="status"]')!;
      expect(cargando.textContent).toContain('Cargando el trámite del organismo…');
      expect(cargando.querySelector('i.ph-spinner-gap.spin')).not.toBeNull();
      expect(el().querySelector('app-membrete')).toBeNull();
      expect(el().querySelector('.load-state')).toBeNull();
    });

    it('con la adopción dibuja el detalle y carga el formulario con sus valores, sin cambios pendientes', () => {
      crear(of(ADOPCION));

      expect(facade.getDetalle).toHaveBeenCalledOnceWith('a-1');
      expect(el().querySelector('app-membrete')!.textContent).toContain('Obtener la licencia de conducir');
      // Sin fecha de fin el campo abre vacío (`''`); al guardar viaja `null`.
      expect(form().getRawValue()).toEqual({ vigenteDesde: new Date(2026, 0, 10), vigenteHasta: '', habilitada: true });
      expect(form().pristine).toBeTrue();
      expect(componente().tieneCambiosSinGuardar()).toBeFalse();
    });

    it('si la carga falla ofrece reintentar o ir al listado', () => {
      crear(throwError(() => new HttpErrorResponse({ status: 500 })));

      const error = el().querySelector('.load-state[role="alert"]')!;
      expect(error.querySelector('.load-state__icono i.ph-cloud-slash')).not.toBeNull();
      expect(error.querySelector('h2.load-state__titulo')!.textContent).toBe('No pudimos cargar el trámite del organismo');
      expect(error.querySelector('p.load-state__texto')!.textContent!.trim()).toBe('Revisá tu conexión e intentá de nuevo. Si sigue, avisá a Soporte.');
      expect(botones(error.querySelector('.load-state__acciones')!)).toEqual(['Reintentar', 'Ir al listado']);
    });

    it('"Reintentar" vuelve a pedirla y, si llega, dibuja el detalle', () => {
      crear(throwError(() => new HttpErrorResponse({ status: 500 })));
      facade.getDetalle.and.returnValue(of(ADOPCION));

      el().querySelector<HTMLButtonElement>('.load-state__acciones button')!.click();
      fixture.detectChanges();

      expect(facade.getDetalle).toHaveBeenCalledTimes(2);
      expect(el().querySelector('.load-state')).toBeNull();
      expect(el().querySelector('app-membrete')).not.toBeNull();
    });

    it('si no existe lo dice con texto propio y la única salida es el listado', () => {
      crear(throwError(() => new HttpErrorResponse({ status: 404 })));

      const error = el().querySelector('.load-state[role="alert"]')!;
      expect(error.querySelector('.load-state__icono i.ph-file-x')).not.toBeNull();
      expect(error.querySelector('h2.load-state__titulo')!.textContent).toBe('Ese trámite del organismo no existe');
      expect(error.querySelector('p.load-state__texto')!.textContent).toContain('Buscalo en el listado.');
      expect(botones(error.querySelector('.load-state__acciones')!)).toEqual(['Ir al listado']);

      error.querySelector<HTMLButtonElement>('.load-state__acciones button')!.click();
      expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/tramites/adopciones']);
    });
  });

  describe('guardado', () => {
    beforeEach(() => crear(of(ADOPCION)));

    it('un formulario inválido no se envía', () => {
      cambiar('vigenteDesde', null);

      enviar();
      fixture.detectChanges();

      expect(facade.update).not.toHaveBeenCalled();
      // El formulario lo cuenta: resumen con el campo a revisar.
      expect(el().querySelector('.form-error-banner[role="group"]')!.textContent).toContain('Vigente desde (Es obligatoria)');
    });

    it('guarda con PUT total, avisa y muestra lo guardado sin volver a pedirlo', fakeAsync(() => {
      const guardada: AdopcionVM = { ...ADOPCION, vigenteHasta: new Date(2026, 5, 30, 23, 59, 59) };
      facade.update.and.returnValue(of(guardada));
      cambiar('vigenteHasta', new Date(2026, 5, 30));

      enviar();
      flush();
      fixture.detectChanges();

      expect(facade.update).toHaveBeenCalledOnceWith('a-1', {
        plantillaId: 'p-1', organismoId: 'o-1', organismoTitularId: null, habilitada: true,
        // Lo que no se tocó viaja con su hora original; lo editado, al borde de su día.
        vigenteDesde: new Date(2026, 0, 10, 8, 30), vigenteHasta: new Date(2026, 5, 30, 23, 59, 59),
      });
      expect(avisos).toHaveBeenCalledOnceWith('Cambios guardados', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      expect(facade.getDetalle).toHaveBeenCalledTimes(1);
      expect(componente().marco.guardando).toBeFalse();
      // El form vuelve a quedar cargado con lo guardado, y limpio.
      expect(form().pristine).toBeTrue();
      expect(form().get('vigenteHasta')!.value).toEqual(new Date(2026, 5, 30));
      expect(el().querySelector('.ficha-paneles')!.textContent).toContain('30/06/2026');
      expect(navigate).not.toHaveBeenCalled();
    }));

    it('si el guardado deshabilita el trámite, el aviso lo dice', fakeAsync(() => {
      facade.update.and.returnValue(of({ ...ADOPCION, habilitada: false }));
      cambiar('habilitada', false);

      enviar();
      flush();

      expect(avisos).toHaveBeenCalledOnceWith('Trámite del organismo deshabilitado', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
    }));

    it('mientras guarda no envía dos veces', fakeAsync(() => {
      const respuesta$ = new Subject<AdopcionVM>();
      facade.update.and.returnValue(respuesta$);

      enviar();
      enviar();
      tick();

      expect(facade.update).toHaveBeenCalledTimes(1);
      expect(componente().marco.guardando).toBeTrue();
      respuesta$.next(ADOPCION);
      respuesta$.complete();
      flush();
      expect(componente().marco.guardando).toBeFalse();
    }));

    it('si el guardado falla muestra el motivo en el formulario, sin aviso, y deja reintentar', fakeAsync(() => {
      facade.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      cambiar('habilitada', false);

      enviar();
      flush();
      fixture.detectChanges();

      expect(componente().marco.guardando).toBeFalse();
      expect(componente().marco.errorDeGuardado).not.toBe('');
      expect(el().querySelector('app-form-error-banner')!.textContent).toContain(componente().marco.errorDeGuardado);
      expect(avisos).not.toHaveBeenCalled();
      // Lo escrito no se pierde.
      expect(form().dirty).toBeTrue();

      facade.update.and.returnValue(of(ADOPCION));
      enviar();
      flush();
      expect(componente().marco.errorDeGuardado).toBe('');
      expect(avisos).toHaveBeenCalledTimes(1);
    }));
  });

  describe('deshabilitar', () => {
    beforeEach(async () => {
      crear(of(ADOPCION));
      await asentar();
    });

    const pedir = (): void => {
      componente().deshabilitar(ADOPCION);
      fixture.detectChanges();
    };

    it('pide confirmación y no deshabilita hasta confirmar', () => {
      pedir();

      expect(tituloDeConfirmacion()).toBe('¿Deshabilitar el trámite del organismo?');
      expect(facade.deshabilitar).not.toHaveBeenCalled();
    });

    it('al confirmar deshabilita, avisa y vuelve al listado sin preguntar por cambios', fakeAsync(() => {
      facade.deshabilitar.and.returnValue(of(undefined));
      cambiar('habilitada', false);
      pedir();

      pulsarEnConfirmacion('Sí, deshabilitar');
      flush();

      expect(facade.deshabilitar).toHaveBeenCalledOnceWith('a-1');
      expect(avisos).toHaveBeenCalledOnceWith('Trámite del organismo deshabilitado', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      expect(form().pristine).toBeTrue();
      expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/tramites/adopciones']);
    }));

    it('al cancelar no deshabilita, no avisa y se queda en el detalle', fakeAsync(() => {
      pedir();

      pulsarEnConfirmacion('Cancelar');
      flush();

      expect(facade.deshabilitar).not.toHaveBeenCalled();
      expect(avisos).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    }));
  });
  describe('vigencia y estado', () => {
    const boton = (texto: string): HTMLButtonElement =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('.adopdet-acciones button')).find((b) => b.textContent!.trim() === texto)!;

    it('sin `UPDATE_ADOPTION` no hay formulario', () => {
      crear(of(ADOPCION), []);
      expect(el().querySelector('#adopdet-editar')).toBeNull();
      expect(el().querySelector('form')).toBeNull();
      expect(componente().tieneCambiosSinGuardar()).toBeFalse();
    });

    it('titula "Vigencia y estado" y ofrece "Descartar" y "Guardar cambios", bloqueados sin cambios', async () => {
      crear(of(ADOPCION));
      await asentar();
      expect(el().querySelector('#adopdet-editar')!.textContent).toBe('Vigencia y estado');
      // Sin cambios ninguno es un `disabled` mudo: siguen enfocables y dicen por qué (accesibilidad.md).
      expect(boton('Descartar').getAttribute('aria-disabled')).toBe('true');
      expect(boton('Descartar').disabled).toBeFalse();
      expect(fixture.debugElement.queryAll(By.css('.adopdet-acciones button')).map((b) => b.injector.get(MatTooltip).message))
        .toEqual(['No hay cambios para descartar', 'No hay cambios para guardar']);
      expect(boton('Guardar cambios').getAttribute('aria-disabled')).toBe('true');
      expect(boton('Guardar cambios').disabled).toBeFalse();
      expect(el().querySelector('mat-slide-toggle')!.textContent).toContain('Habilitado');
    });

    it('con un cambio habilita los dos, y el guard de salida pregunta', () => {
      crear(of(ADOPCION));
      cambiar('habilitada', false);
      fixture.detectChanges();

      expect(boton('Descartar').disabled).toBeFalse();
      expect(boton('Descartar').getAttribute('aria-disabled')).toBeNull();
      expect(boton('Guardar cambios').disabled).toBeFalse();
      expect(boton('Guardar cambios').getAttribute('aria-disabled')).toBeNull();
      expect(componente().tieneCambiosSinGuardar()).toBeTrue();
    });

    it('al apagar "Habilitado" avisa la consecuencia antes de guardar', async () => {
      crear(of(ADOPCION));
      await asentar();
      expect(el().querySelector('.form-toggle__aviso')).toBeNull();

      cambiar('habilitada', false);
      fixture.detectChanges();

      const aviso = el().querySelector('.form-toggle__aviso--alerta')!;
      expect(aviso.textContent!.trim())
        .toBe('Al guardar deja de listarse en Trámites del organismo y el trámite deja de verse en el portal.');
    });

    it('"Descartar" vuelve a los valores guardados y deja el formulario sin cambios', async () => {
      crear(of(ADOPCION));
      await asentar();
      cambiar('habilitada', false);
      fixture.detectChanges();

      boton('Descartar').click();
      fixture.detectChanges();

      expect(form().get('habilitada')!.value).toBeTrue();
      expect(form().pristine).toBeTrue();
      expect(componente().tieneCambiosSinGuardar()).toBeFalse();
      expect(el().querySelector('.form-toggle__aviso')).toBeNull();
    });

    it('sin cambios, "Descartar" no hace nada (ni vuelve a cargar el formulario)', async () => {
      crear(of(ADOPCION));
      await asentar();
      const inicial = componente().inicial;

      boton('Descartar').click();
      fixture.detectChanges();

      expect(componente().inicial).toBe(inicial);
    });

    describe('foco: los botones no se reemplazan al cambiar de estado (WCAG 2.4.3)', () => {
      beforeEach(async () => {
        crear(of(ADOPCION));
        document.body.append(el());
        await asentar();
      });
      afterEach(() => el().remove());

      it('tras guardar y quedarse en la página, el foco sigue en "Guardar cambios" (ahora sin cambios)', async () => {
        facade.update.and.returnValue(of({ ...ADOPCION, habilitada: false }));
        cambiar('habilitada', false);
        const guardar = boton('Guardar cambios');
        guardar.focus();

        guardar.click();
        await asentar();
        await asentar();

        expect(facade.update).toHaveBeenCalledTimes(1);
        expect(form().pristine).toBeTrue();
        expect(boton('Guardar cambios')).toBe(guardar);
        expect(document.activeElement).toBe(guardar);
        expect(guardar.getAttribute('aria-disabled')).toBe('true');
      });

      it('tras descartar, el foco queda en "Descartar" (ahora no disponible, con su motivo)', () => {
        cambiar('habilitada', false);
        const descartar = boton('Descartar');
        descartar.focus();

        descartar.click();
        fixture.detectChanges();

        expect(form().pristine).toBeTrue();
        expect(boton('Descartar')).toBe(descartar);
        expect(document.activeElement).toBe(descartar);
        expect(descartar.getAttribute('aria-disabled')).toBe('true');
      });

      it('con el foco en "Guardar cambios" no disponible, el primer cambio lo habilita sin sacarle el foco', () => {
        const guardar = boton('Guardar cambios');
        guardar.focus();

        cambiar('habilitada', false);

        expect(boton('Guardar cambios')).toBe(guardar);
        expect(document.activeElement).toBe(guardar);
        expect(guardar.getAttribute('aria-disabled')).toBeNull();
      });
    });

    it('guardar solo "Habilitado" reenvía la vigencia con sus horas originales', fakeAsync(() => {
      const conFin: AdopcionVM = { ...ADOPCION, vigenteHasta: new Date(2027, 0, 1, 0, 0) };
      crear(of(conFin));
      facade.update.and.returnValue(of({ ...conFin, habilitada: false }));
      cambiar('habilitada', false);

      enviar();
      flush();

      expect(facade.update).toHaveBeenCalledOnceWith('a-1', {
        plantillaId: 'p-1', organismoId: 'o-1', organismoTitularId: null, habilitada: false,
        vigenteDesde: new Date(2026, 0, 10, 8, 30), vigenteHasta: new Date(2027, 0, 1, 0, 0),
      });
    }));

    it('el solapamiento (4080) se cuenta en el formulario con texto propio', fakeAsync(() => {
      crear(of(ADOPCION));
      facade.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { code: 4080, message: 'crudo' } })));
      cambiar('habilitada', false);

      enviar();
      flush();
      fixture.detectChanges();

      const banner = el().querySelector('app-form-error-banner')!.textContent!;
      expect(banner).toContain('No se pudo guardar');
      expect(banner).toContain('Ya hay una adopción vigente de este trámite en el organismo para ese período.');
      expect(banner).not.toContain('crudo');
    }));

    it('mientras guarda, el guard de salida no pregunta', fakeAsync(() => {
      crear(of(ADOPCION));
      const respuesta$ = new Subject<AdopcionVM>();
      facade.update.and.returnValue(respuesta$);
      cambiar('habilitada', false);

      enviar();
      tick();
      expect(componente().tieneCambiosSinGuardar()).toBeFalse();
      respuesta$.complete();
      flush();
    }));
  });
});
