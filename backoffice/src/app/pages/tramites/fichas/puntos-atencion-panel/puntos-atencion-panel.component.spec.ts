import { Component, Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { PuntoAtencionVM, PuntosAtencionFacade } from '@features/puntos-atencion';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { RowAction, RowActionsComponent } from '../../../../shared/components/row-actions';
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
    (document.activeElement as HTMLElement | null)?.blur();

    cierre$.next(punto('inexistente'));
    fixture.detectChanges();
    tick(50);

    expect(document.activeElement).toBe(el().querySelector('.puntos-barra__agregar'));
    flush();
  }));

  it('al cerrar sin guardar no toca el foco (Material lo devuelve solo)', fakeAsync(() => {
    fixture.componentInstance.agregar();
    (document.activeElement as HTMLElement | null)?.blur();

    cierre$.next(undefined);
    fixture.detectChanges();
    tick(50 * 40);

    expect(document.activeElement).toBe(document.body);
  }));

  it('sin puntos muestra el estado vacío con ícono, título y una línea', () => {
    lista$.next([]);
    fixture.detectChanges();

    const vacio = el().querySelector('.puntos-vacio.state-panel')!;
    expect(vacio.querySelector('.state-panel__title')?.textContent).toContain('Todavía no hay puntos de atención');
    expect(vacio.querySelector('.state-panel__text')?.textContent).toContain('Agregá dónde se hace el trámite');
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
