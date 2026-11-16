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
