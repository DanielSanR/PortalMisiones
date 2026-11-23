import { Component, Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick, flushMicrotasks } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';
import { PuntoAtencionVM, PuntosAtencionFacade } from '@features/puntos-atencion';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { RowAction, RowActionsComponent } from '@shared/components/row-actions';
import { PuntosAtencionPanelComponent } from './puntos-atencion-panel.component';

/** Gating por permiso: siempre dibuja. */
@Directive({ selector: '[appHasPermission]', standalone: true })
class HasPermissionStub {
  @Input() appHasPermission: unknown;
  constructor() {
    inject(ViewContainerRef).createEmbeddedView(inject(TemplateRef<unknown>));
  }
}

/** Acciones de fila: solo importa que haya un `.row-action` por tarjeta. */
@Component({
  selector: 'app-row-actions',
  standalone: true,
  template: '<button type="button" class="row-action">Editar</button>',
})
class RowActionsStub {
  @Input() primary?: RowAction;
  @Input() actions: RowAction[] = [];
  @Input() menuLabel = '';
}

const punto = (id: string): PuntoAtencionVM => ({
  id, fichaId: 'f-1', nombre: `Punto ${id}`, direccion: 'Calle 1', contacto: null, horarios: null,
  latitud: -27.36, longitud: -55.89, activo: true,
});

describe('PuntosAtencionPanelComponent — foco tras guardar', () => {
  let fixture: ComponentFixture<PuntosAtencionPanelComponent>;
  let lista$: BehaviorSubject<PuntoAtencionVM[]>;
  let cierre$: Subject<PuntoAtencionVM | undefined>;

  const el = (): HTMLElement => fixture.nativeElement;
  const botonDe = (id: string): HTMLElement =>
    el().querySelector<HTMLElement>(`[data-punto-id="${id}"] .row-action`)!;

  beforeEach(async () => {
    lista$ = new BehaviorSubject<PuntoAtencionVM[]>([punto('p-1')]);
    cierre$ = new Subject<PuntoAtencionVM | undefined>();
    const facade = {
      refrescar: () => undefined,
      cambios$: new BehaviorSubject<void>(undefined),
      getDeFicha: () => lista$,
    };
    const dialog = { openDialogs: [], open: () => ({ afterClosed: () => cierre$ }) };

    await TestBed.configureTestingModule({
      imports: [PuntosAtencionPanelComponent, NoopAnimationsModule],
      providers: [
        { provide: PuntosAtencionFacade, useValue: facade },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    })
      .overrideComponent(PuntosAtencionPanelComponent, {
        remove: { imports: [HasPermissionDirective, RowActionsComponent] },
        add: { imports: [HasPermissionStub, RowActionsStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PuntosAtencionPanelComponent);
    // En el documento: el foco solo existe en nodos conectados.
    document.body.append(fixture.nativeElement);
    fixture.componentRef.setInput('fichaId', 'f-1');
    fixture.detectChanges();
  });

  afterEach(() => fixture.nativeElement.remove());

  it('tras guardar la edición, el foco vuelve a la acción del mismo punto una vez re-renderizada la lista', fakeAsync(() => {
    fixture.componentInstance.editar(punto('p-1'));
    flushMicrotasks(); // el formulario se baja en diferido antes de abrirse
    (document.activeElement as HTMLElement | null)?.blur();

    // La lista se vuelve a leer y sus nodos se reemplazan: el botón que abrió el diálogo ya no existe.
    lista$.next([{ ...punto('p-1'), nombre: 'Renombrado' }, punto('p-2')]);
    cierre$.next(punto('p-1'));
    fixture.detectChanges();
    tick(50);

    expect(document.activeElement).toBe(botonDe('p-1'));
    flush();
  }));

  it('tras crear un punto, el foco va a la tarjeta nueva', fakeAsync(() => {
    el().querySelector<HTMLButtonElement>('.puntos-barra__agregar')!.click();
    flushMicrotasks(); // el formulario se baja en diferido antes de abrirse
    (document.activeElement as HTMLElement | null)?.blur();

    lista$.next([punto('p-1'), punto('p-9')]);
    cierre$.next(punto('p-9'));
    fixture.detectChanges();
    tick(50);

    expect(document.activeElement).toBe(botonDe('p-9'));
    flush();
  }));

  it('si la tarjeta no está, el foco cae en "Agregar punto"', fakeAsync(() => {
    fixture.componentInstance.agregar();
    flushMicrotasks(); // el formulario se baja en diferido antes de abrirse
    (document.activeElement as HTMLElement | null)?.blur();

    cierre$.next(punto('inexistente'));
    fixture.detectChanges();
    tick(50);

    expect(document.activeElement).toBe(el().querySelector('.puntos-barra__agregar'));
    flush();
  }));

  it('al cerrar sin guardar no toca el foco (Material lo devuelve solo)', fakeAsync(() => {
    fixture.componentInstance.agregar();
    flushMicrotasks(); // el formulario se baja en diferido antes de abrirse
    (document.activeElement as HTMLElement | null)?.blur();

    cierre$.next(undefined);
    fixture.detectChanges();
    tick(50 * 40);

    expect(document.activeElement).toBe(document.body);
  }));

  describe('tras "Desactivar" (I6, WCAG 2.4.3)', () => {
    /** Confirma el diálogo de "Desactivar" (el mock de `MatDialog` cierra con lo que emita `cierre$`). */
    const confirmar = (): void => (cierre$ as unknown as Subject<boolean>).next(true);

    it('sin "Mostrar inactivos" la tarjeta desaparece: espera a la relectura y enfoca "Agregar punto de atención"', fakeAsync(() => {
      fixture.componentInstance.desactivar(punto('p-1'));
      (document.activeElement as HTMLElement | null)?.blur();
      confirmar();
      fixture.detectChanges();
      tick(50);
      // La lista todavía es la de antes (la tarjeta sigue activa): no se enfoca un nodo que está por irse.
      expect(document.activeElement).toBe(document.body);

      lista$.next([]);
      fixture.detectChanges();
      tick(50);

      expect(document.activeElement).toBe(el().querySelector('.puntos-barra__agregar'));
      flush();
    }));

    it('con "Mostrar inactivos" el punto sigue a la vista (inactivo): el foco va a su acción', fakeAsync(() => {
      fixture.componentInstance.inactivosCtrl.setValue(true);
      fixture.detectChanges();
      fixture.componentInstance.desactivar(punto('p-1'));
      (document.activeElement as HTMLElement | null)?.blur();
      confirmar();

      lista$.next([{ ...punto('p-1'), activo: false }]);
      fixture.detectChanges();
      tick(50);

      expect(el().querySelector('[data-punto-id="p-1"]')!.classList).toContain('is-inactivo');
      expect(document.activeElement).toBe(botonDe('p-1'));
      flush();
    }));

    it('sin "Agregar punto de atención" (sin permiso de alta) el foco va al interruptor "Mostrar inactivos"', fakeAsync(() => {
      el().querySelector('.puntos-barra__agregar')!.remove();
      fixture.componentInstance.desactivar(punto('p-1'));
      (document.activeElement as HTMLElement | null)?.blur();
      confirmar();

      lista$.next([]);
      fixture.detectChanges();
      tick(50);

      expect(document.activeElement).toBe(el().querySelector('.puntos-barra mat-slide-toggle button'));
      flush();
    }));

    it('si la relectura nunca llega, igual no deja el foco en body: al agotar la espera enfoca lo que haya', fakeAsync(() => {
      fixture.componentInstance.desactivar(punto('p-1'));
      (document.activeElement as HTMLElement | null)?.blur();
      confirmar();
      fixture.detectChanges();
      tick(50 * 40);

      expect(document.activeElement).not.toBe(document.body);
      flush();
    }));

    it('si se cancela la confirmación no toca el foco', fakeAsync(() => {
      fixture.componentInstance.desactivar(punto('p-1'));
      (document.activeElement as HTMLElement | null)?.blur();
      (cierre$ as unknown as Subject<boolean>).next(false);
      fixture.detectChanges();
      tick(50 * 40);

      expect(document.activeElement).toBe(document.body);
    }));
  });

  it('sin puntos activos lo dice y remite a "Mostrar inactivos" (no se sabe si hay desactivados)', () => {
    lista$.next([]);
    fixture.detectChanges();

    const vacio = el().querySelector('.puntos-vacio.state-panel')!;
    expect(vacio.querySelector('.state-panel__title')?.textContent).toContain('No hay puntos de atención activos');
    expect(vacio.querySelector('.state-panel__text')?.textContent).toContain('Agregá dónde se hace el trámite');
    expect(vacio.querySelector('.state-panel__text')?.textContent).toContain('Mostrar inactivos');
  });

  it('con "Mostrar inactivos" y sin ningún punto, el vacío es real', () => {
    lista$.next([]);
    fixture.componentInstance.inactivosCtrl.setValue(true);
    fixture.detectChanges();

    const vacio = el().querySelector('.puntos-vacio.state-panel')!;
    expect(vacio.querySelector('.state-panel__title')?.textContent).toContain('Todavía no hay puntos de atención');
    expect(el().querySelector('.puntos-barra__inactivos')?.textContent).toContain('No hay puntos inactivos');
  });
});

describe('PuntosAtencionPanelComponent — activos por defecto, inactivos a pedido', () => {
  let fixture: ComponentFixture<PuntosAtencionPanelComponent>;
  let pedidos: Array<{ fichaId: string; conInactivos: boolean }>;

  const el = (): HTMLElement => fixture.nativeElement;
  const ACTIVO = punto('p-1');
  const INACTIVO: PuntoAtencionVM = { ...punto('p-2'), activo: false };

  beforeEach(async () => {
    pedidos = [];
    const facade = {
      fuenteSimulada: false,
      refrescar: () => undefined,
      cambios$: new BehaviorSubject<void>(undefined),
      getDeFicha: (fichaId: string, conInactivos = false) => {
        pedidos.push({ fichaId, conInactivos });
        return of(conInactivos ? [ACTIVO, INACTIVO] : [ACTIVO]);
      },
    };
    await TestBed.configureTestingModule({
      imports: [PuntosAtencionPanelComponent, NoopAnimationsModule],
      providers: [
        { provide: PuntosAtencionFacade, useValue: facade },
        { provide: MatDialog, useValue: { openDialogs: [], open: () => ({ afterClosed: () => of(undefined) }) } },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    })
      .overrideComponent(PuntosAtencionPanelComponent, {
        remove: { imports: [HasPermissionDirective, RowActionsComponent] },
        add: { imports: [HasPermissionStub, RowActionsStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PuntosAtencionPanelComponent);
    fixture.componentRef.setInput('fichaId', 'f-1');
    fixture.detectChanges();
  });

  it('al entrar pide solo los activos de la ficha y ofrece "Mostrar inactivos" sin afirmar cuántos hay', () => {
    expect(pedidos).toEqual([{ fichaId: 'f-1', conInactivos: false }]);
    expect(el().querySelectorAll('[data-punto-id]').length).toBe(1);
    expect(el().querySelector('mat-slide-toggle')?.textContent).toContain('Mostrar inactivos');
    expect(el().querySelector('.puntos-barra__inactivos')?.textContent?.trim()).toBe('');
  });

  it('con "Mostrar inactivos" vuelve a pedir con los desactivados, los marca y dice cuántos son', () => {
    fixture.componentInstance.inactivosCtrl.setValue(true);
    fixture.detectChanges();

    expect(pedidos[pedidos.length - 1]).toEqual({ fichaId: 'f-1', conInactivos: true });
    expect(el().querySelectorAll('[data-punto-id]').length).toBe(2);
    expect(el().querySelector('[data-punto-id="p-2"]')?.classList).toContain('is-inactivo');
    expect(el().querySelector('.puntos-barra__inactivos')?.textContent).toContain('1 inactivo');
  });

  it('al apagarlo vuelve a la lectura filtrada (solo activos)', () => {
    fixture.componentInstance.inactivosCtrl.setValue(true);
    fixture.componentInstance.inactivosCtrl.setValue(false);
    fixture.detectChanges();

    expect(pedidos[pedidos.length - 1]).toEqual({ fichaId: 'f-1', conInactivos: false });
    expect(el().querySelectorAll('[data-punto-id]').length).toBe(1);
  });
});

describe('PuntosAtencionPanelComponent — "Mostrar inactivos" que carga lento o falla (I1, M4)', () => {
  let fixture: ComponentFixture<PuntosAtencionPanelComponent>;
  let pedidos: boolean[];
  let cambios$: BehaviorSubject<void>;
  /** Qué responde cada lectura del test en curso. */
  let activos: () => Observable<PuntoAtencionVM[]>;
  let conInactivos: () => Observable<PuntoAtencionVM[]>;

  const el = (): HTMLElement => fixture.nativeElement;
  const ACTIVO = punto('p-1');
  const INACTIVO: PuntoAtencionVM = { ...punto('p-2'), activo: false };
  const fallo = (): Observable<PuntoAtencionVM[]> => throwError(() => ({ status: 500 }));
  const region = (): string => el().querySelector('.puntos-barra__inactivos')?.textContent?.trim() ?? '';

  beforeEach(async () => {
    pedidos = [];
    activos = () => of([ACTIVO]);
    conInactivos = () => of([ACTIVO, INACTIVO]);
    cambios$ = new BehaviorSubject<void>(undefined);
    const facade = {
      fuenteSimulada: false,
      refrescar: () => undefined,
      cambios$,
      getDeFicha: (_fichaId: string, inactivos = false) => {
        pedidos.push(inactivos);
        return inactivos ? conInactivos() : activos();
      },
    };
    await TestBed.configureTestingModule({
      imports: [PuntosAtencionPanelComponent, NoopAnimationsModule],
      providers: [
        { provide: PuntosAtencionFacade, useValue: facade },
        { provide: MatDialog, useValue: { openDialogs: [], open: () => ({ afterClosed: () => of(undefined) }) } },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    })
      .overrideComponent(PuntosAtencionPanelComponent, {
        remove: { imports: [HasPermissionDirective, RowActionsComponent] },
        add: { imports: [HasPermissionStub, RowActionsStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PuntosAtencionPanelComponent);
    fixture.componentRef.setInput('fichaId', 'f-1');
    fixture.detectChanges();
  });

  it('mientras se piden los inactivos lo anuncia en la región viva, con indicador, y los activos siguen a la vista', () => {
    const respuesta$ = new Subject<PuntoAtencionVM[]>();
    conInactivos = () => respuesta$;
    fixture.componentInstance.inactivosCtrl.setValue(true);
    fixture.detectChanges();

    const viva = el().querySelector('.puntos-barra__inactivos')!;
    expect(viva.getAttribute('aria-live')).toBe('polite');
    expect(region()).toBe('Cargando puntos inactivos…');
    expect(viva.querySelector('.ph-spinner-gap')).not.toBeNull();
    expect(el().querySelectorAll('[data-punto-id]').length).toBe(1);

    respuesta$.next([ACTIVO, INACTIVO]);
    fixture.detectChanges();
    expect(region()).toBe('1 inactivo');
    expect(el().querySelectorAll('[data-punto-id]').length).toBe(2);
  });

  it('si falla la lectura con inactivos NO se cae el panel: quedan los activos, la barra y un aviso con reintento', () => {
    conInactivos = fallo;
    fixture.componentInstance.inactivosCtrl.setValue(true);
    fixture.detectChanges();

    expect(el().querySelectorAll('[data-punto-id]').length).withContext('los activos siguen visibles').toBe(1);
    expect(el().querySelector('.puntos-barra mat-slide-toggle')).withContext('la barra sigue').not.toBeNull();
    const aviso = el().querySelector('[data-aviso="error-inactivos"]')!;
    expect(aviso.getAttribute('role')).toBe('alert');
    expect(aviso.textContent).toContain('No pudimos cargar los puntos inactivos');
    // El interruptor vuelve a apagado: dice la verdad (no se están mostrando) y prenderlo de nuevo reintenta.
    expect(fixture.componentInstance.inactivosCtrl.value).toBeFalse();
    expect(region()).toBe('');
    // No quedó en el error general (el que escondía todo).
    expect(el().textContent).not.toContain('No pudimos cargar los puntos de atención.');
    // Se pidieron los inactivos y, al fallar, los activos; ninguna lectura más.
    expect(pedidos).toEqual([false, true, false]);
  });

  it('tras el fallo, agregar o editar un punto relee SOLO los activos: no vuelve a pedir inactivos con el interruptor apagado', () => {
    conInactivos = fallo;
    fixture.componentInstance.inactivosCtrl.setValue(true);
    fixture.detectChanges();
    pedidos = [];

    // Un ABM: el facade avisa por `cambios$` y el panel vuelve a leer.
    conInactivos = () => of([ACTIVO, INACTIVO]);
    cambios$.next();
    fixture.detectChanges();

    expect(pedidos).withContext('el interruptor está apagado: no se piden inactivos').toEqual([false]);
    expect(fixture.componentInstance.inactivosCtrl.value).toBeFalse();
    expect(el().querySelectorAll('[data-punto-id]').length).toBe(1);
    expect(region()).withContext('la región viva no afirma nada de inactivos').toBe('');
    // El aviso sigue: los inactivos siguen sin poder verse hasta reintentar.
    expect(el().querySelector('[data-aviso="error-inactivos"]')).not.toBeNull();
  });

  it('tras el fallo, prender de nuevo el interruptor pide los inactivos y saca el aviso', () => {
    conInactivos = fallo;
    fixture.componentInstance.inactivosCtrl.setValue(true);
    fixture.detectChanges();

    conInactivos = () => of([ACTIVO, INACTIVO]);
    pedidos = [];
    fixture.componentInstance.inactivosCtrl.setValue(true);
    fixture.detectChanges();
    cambios$.next();
    fixture.detectChanges();

    expect(pedidos).toEqual([true, true]);
    expect(region()).toBe('1 inactivo');
    expect(el().querySelector('[data-aviso="error-inactivos"]')).toBeNull();
  });

  it('"Reintentar" del aviso vuelve a pedir los inactivos y, si anda, los muestra y saca el aviso', () => {
    conInactivos = fallo;
    fixture.componentInstance.inactivosCtrl.setValue(true);
    fixture.detectChanges();

    conInactivos = () => of([ACTIVO, INACTIVO]);
    el().querySelector<HTMLButtonElement>('[data-aviso="error-inactivos"] button')!.click();
    fixture.detectChanges();

    expect(pedidos[pedidos.length - 1]).toBeTrue();
    expect(fixture.componentInstance.inactivosCtrl.value).toBeTrue();
    expect(el().querySelector('[data-aviso="error-inactivos"]')).toBeNull();
    expect(el().querySelectorAll('[data-punto-id]').length).toBe(2);
  });

  it('si falla TODO (también los activos), la barra con el interruptor sigue visible y "Reintentar" pide los activos, no los inactivos', () => {
    conInactivos = fallo;
    activos = fallo;
    fixture.componentInstance.inactivosCtrl.setValue(true);
    fixture.detectChanges();

    expect(el().textContent).toContain('No pudimos cargar los puntos de atención.');
    expect(el().querySelector('.puntos-barra mat-slide-toggle')).withContext('la barra sigue en error').not.toBeNull();
    expect(fixture.componentInstance.inactivosCtrl.value).toBeFalse();

    activos = () => of([ACTIVO]);
    pedidos = [];
    const reintentar = Array.from(el().querySelectorAll<HTMLButtonElement>('.puntos-mensaje--error button'))
      .find((b) => b.textContent!.includes('Reintentar'))!;
    reintentar.click();
    fixture.detectChanges();

    expect(pedidos).toEqual([false]);
    expect(el().querySelectorAll('[data-punto-id]').length).toBe(1);
  });

  it('un fallo de la carga inicial (sin inactivos) también deja la barra a la vista', () => {
    activos = fallo;
    fixture.componentInstance.reintentar();
    fixture.detectChanges();

    expect(el().textContent).toContain('No pudimos cargar los puntos de atención.');
    expect(el().querySelector('.puntos-barra mat-slide-toggle')).not.toBeNull();
  });
});

describe('PuntosAtencionPanelComponent — con cabecera propia (detalle de la ficha)', () => {
  let fixture: ComponentFixture<PuntosAtencionPanelComponent>;

  let enfocados = 0;
  const el = (): HTMLElement => fixture.nativeElement;

  async function crear(puntos: PuntoAtencionVM[], enfocarTitulo: boolean, fuenteSimulada = false): Promise<void> {
    const facade = {
      fuenteSimulada,
      refrescar: () => undefined,
      cambios$: new BehaviorSubject<void>(undefined),
      getDeFicha: () => of(puntos),
    };
    await TestBed.configureTestingModule({
      imports: [PuntosAtencionPanelComponent, NoopAnimationsModule],
      providers: [
        { provide: PuntosAtencionFacade, useValue: facade },
        { provide: MatDialog, useValue: { openDialogs: [], open: () => ({ afterClosed: () => of(undefined) }) } },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    })
      .overrideComponent(PuntosAtencionPanelComponent, {
        remove: { imports: [HasPermissionDirective, RowActionsComponent] },
        add: { imports: [HasPermissionStub, RowActionsStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PuntosAtencionPanelComponent);
    document.body.append(fixture.nativeElement);
    enfocados = 0;
    fixture.componentInstance.tituloEnfocado.subscribe(() => enfocados++);
    fixture.componentRef.setInput('fichaId', 'f-1');
    fixture.componentRef.setInput('cabecera', true);
    fixture.componentRef.setInput('tituloId', 'ficha-puntos');
    fixture.componentRef.setInput('enfocarTitulo', enfocarTitulo);
    fixture.detectChanges();
  }

  afterEach(() => fixture.nativeElement.remove());

  it('dibuja el título, el total de activos y un solo "Agregar punto de atención"', async () => {
    await crear([punto('p-1'), { ...punto('p-2'), activo: false }, punto('p-3')], false);

    expect(el().querySelector('#ficha-puntos')!.textContent).toContain('Puntos de atención');
    expect(el().querySelector('.ficha-paneles__total')!.textContent).toContain('2 activos');
    const agregar = Array.from(el().querySelectorAll('button')).filter((b) => b.textContent!.includes('Agregar punto de atención'));
    expect(agregar.length).toBe(1);
    expect(el().querySelector('.puntos-barra__agregar')).toBeNull();
  });

  it('con enfocarTitulo lleva el foco al título; sin él no lo toca', async () => {
    await crear([punto('p-1')], true);
    expect(document.activeElement).toBe(el().querySelector('#ficha-puntos'));
    fixture.nativeElement.remove();
    TestBed.resetTestingModule();

    await crear([punto('p-1')], false);
    expect(document.activeElement).not.toBe(el().querySelector('#ficha-puntos'));
  });

  it('avisa al padre (tituloEnfocado) cuando enfocó el título, y no emite si no se pidió el foco', async () => {
    await crear([punto('p-1')], true);
    await fixture.whenStable();
    expect(enfocados).toBe(1);
    fixture.nativeElement.remove();
    TestBed.resetTestingModule();

    await crear([punto('p-1')], false);
    await fixture.whenStable();
    expect(enfocados).toBe(0);
  });

  it('no recuerda si ya enfocó: si el padre sigue pidiendo el foco, un panel recreado vuelve a enfocar', async () => {
    await crear([punto('p-1')], true);
    fixture.nativeElement.remove();
    TestBed.resetTestingModule();
    await crear([punto('p-1')], true);
    expect(document.activeElement).toBe(el().querySelector('#ficha-puntos'));
  });

  it('con fuente simulada avisa que los puntos no se guardan en el servidor; con fuente real no', async () => {
    await crear([punto('p-1')], false, true);
    const aviso = el().querySelector('.form-aviso[role="note"]')!;
    expect(aviso.textContent).toContain('Datos de ejemplo');
    expect(aviso.textContent).toContain('puntos de atención');
    fixture.nativeElement.remove();
    TestBed.resetTestingModule();

    await crear([punto('p-1')], false, false);
    expect(el().querySelector('.form-aviso[role="note"]')).toBeNull();
  });

  it('sin cabecera (formulario) no dibuja título propio', async () => {
    await crear([punto('p-1')], false);
    fixture.componentRef.setInput('cabecera', false);
    fixture.detectChanges();
    expect(el().querySelector('#ficha-puntos')).toBeNull();
    expect(el().querySelector('.puntos-barra__agregar')).not.toBeNull();
  });
});
