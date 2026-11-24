import { Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { CategoriaNode, CategoriasFacade } from '@features/categorias';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import {
  confirmacionAbierta, dibujarDialogos, errorDeConfirmacion, pulsarEnConfirmacion, tituloDeConfirmacion,
} from '@shared/components/confirm-dialog/testing/confirmacion.testing';
import { VentanaEscritorio, abrirVentanaEscritorio } from '@shared/utils/testing/ventana-escritorio.testing';
import { CategoriasListComponent } from './categorias-list.component';

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

const TODOS = ['CREATE_CATEGORY', 'UPDATE_CATEGORY', 'DELETE_CATEGORY'];

const hoja = (id: string, nombre: string, parentId: string | null = null): CategoriaNode =>
  ({ id, parentId, slug: nombre.toLowerCase(), nombre, children: [] });

const SALUD = hoja('c-1', 'Salud');
const TRANSPORTE: CategoriaNode = { ...hoja('c-2', 'Transporte'), children: [hoja('c-3', 'Licencias', 'c-2')] };
const VIVIENDA = hoja('c-4', 'Vivienda');

/** Caracterización del árbol de categorías: carga, vacíos, filtros y baja. */
describe('CategoriasListComponent', () => {
  let fixture: ComponentFixture<CategoriasListComponent>;
  let arbol$: BehaviorSubject<CategoriaNode[]>;
  let facade: { arbol$: Observable<CategoriaNode[]>; categorias$: Observable<unknown[]>; loadCategorias: jasmine.Spy; delete: jasmine.Spy };
  let avisos: jasmine.Spy;

  const el = (): HTMLElement => fixture.nativeElement;
  const filas = (): string[] =>
    Array.from(el().querySelectorAll('.cat-table__row .cat-table__name')).map((n) => n.firstChild!.textContent!.trim());
  const panel = (): HTMLElement | null => el().querySelector('.state-panel');
  const boton = (aria: string): HTMLButtonElement => el().querySelector<HTMLButtonElement>(`button[aria-label="${aria}"]`)!;
  const dialog = (): MatDialog => fixture.debugElement.injector.get(MatDialog);

  function crear(arbol: CategoriaNode[], carga$: Observable<unknown> = of(arbol), permisos = TODOS): void {
    PERMISOS = permisos;
    arbol$ = new BehaviorSubject<CategoriaNode[]>(arbol);
    facade = {
      arbol$,
      categorias$: of([]),
      loadCategorias: jasmine.createSpy('loadCategorias').and.returnValue(carga$),
      delete: jasmine.createSpy('delete'),
    };
    TestBed.configureTestingModule({
      imports: [CategoriasListComponent, NoopAnimationsModule],
      providers: [provideRouter([]), { provide: CategoriasFacade, useValue: facade }],
    }).overrideComponent(CategoriasListComponent, {
      remove: { imports: [HasPermissionDirective] },
      add: { imports: [HasPermissionStub] },
    });
    fixture = TestBed.createComponent(CategoriasListComponent);
    // El componente importa `MatSnackBarModule`: su `MatSnackBar` es el de su propio injector.
    avisos = spyOn(fixture.debugElement.injector.get(MatSnackBar), 'open');
    // En el documento: el foco solo existe en nodos conectados.
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
  }

  function buscar(termino: string): void {
    fixture.componentInstance.searchCtrl.setValue(termino);
    tick(250);
    fixture.detectChanges();
  }

  afterEach(() => {
    dialog().closeAll();
    fixture.nativeElement.remove();
  });

  describe('carga', () => {
    it('mientras carga muestra el esqueleto, no el vacío', () => {
      crear([], new Subject<unknown>());

      expect(el().querySelector('app-loading .loading-skeleton')).not.toBeNull();
      expect(panel()).toBeNull();
    });

    it('con datos dibuja las raíces colapsadas y cuenta todos los nodos', () => {
      crear([SALUD, TRANSPORTE]);

      expect(filas()).toEqual(['Salud', 'Transporte']);
      expect(el().querySelector('.list-toolbar__count')!.textContent!.trim()).toBe('3 categorías');
      expect(el().querySelector('app-loading .loading-skeleton')).toBeNull();
    });

    it('si la carga falla muestra el error con "Reintentar", no el vacío', () => {
      crear([], throwError(() => new Error('sin red')));

      expect(panel()!.getAttribute('role')).toBe('alert');
      expect(panel()!.querySelector('.state-panel__title')!.textContent).toBe('No pudimos cargar las categorías');
      expect(panel()!.querySelector('.state-panel__cta')!.textContent).toContain('Reintentar');
    });

    it('"Reintentar" vuelve a pedir las categorías', () => {
      crear([SALUD], throwError(() => new Error('sin red')));
      facade.loadCategorias.and.returnValue(of([SALUD]));

      panel()!.querySelector<HTMLButtonElement>('.state-panel__cta')!.click();
      fixture.detectChanges();

      expect(facade.loadCategorias).toHaveBeenCalledTimes(2);
      expect(panel()).toBeNull();
      expect(filas()).toEqual(['Salud']);
    });
  });

  describe('densidad (Preferencias)', () => {
    let ventana: VentanaEscritorio;
    const fila = (): HTMLElement => el().querySelector<HTMLElement>('.cat-table__row')!;

    beforeEach(async () => {
      crear([SALUD]);
      ventana = await abrirVentanaEscritorio(fixture.nativeElement);
    });

    afterEach(() => ventana.cerrar());

    // La fila lleva nombre + slug en dos líneas: con la letra de Karma el contenido ya supera el mínimo, así que la
    // densidad se ve en el mínimo y en el padding vertical de las celdas (9px → 6px arriba y abajo).
    it('en cómoda la fila del árbol mantiene el mínimo de 52px y el padding de 9px', () => {
      expect(getComputedStyle(fila()).minHeight).toBe('52px');
      expect(getComputedStyle(fila().querySelector('.cat-table__cell')!).paddingTop).toBe('9px');
      expect(fila().getBoundingClientRect().height).toBeGreaterThanOrEqual(52);
    });

    it('en compacta la fila del árbol baja el mínimo a 44px y pierde 6px de padding vertical', () => {
      const comoda = fila().getBoundingClientRect().height;

      ventana.densidadCompacta(true);

      expect(getComputedStyle(fila()).minHeight).toBe('44px');
      expect(fila().getBoundingClientRect().height).toBe(Math.max(44, comoda - 6));
    });
  });

  describe('vacío', () => {
    it('sin categorías invita a crear la primera (con permiso)', () => {
      crear([]);

      expect(panel()!.getAttribute('role')).toBe('status');
      expect(panel()!.querySelector('.state-panel__title')!.textContent).toBe('Todavía no hay categorías');
      expect(panel()!.querySelector('.state-panel__cta')!.textContent).toContain('Nueva categoría');
    });

    it('sin permiso para crear no ofrece el CTA', () => {
      crear([], of([]), []);
      expect(panel()!.querySelector('.state-panel__cta')).toBeNull();
    });

    it('con una búsqueda sin coincidencias dice "Sin resultados" y el CTA la limpia', fakeAsync(() => {
      crear([SALUD, TRANSPORTE]);

      buscar('zzz');

      expect(panel()!.querySelector('.state-panel__title')!.textContent).toBe('Sin resultados');
      expect(el().querySelector('.active-filters__chip')!.textContent).toContain('Búsqueda: zzz');
      const cta = panel()!.querySelector<HTMLButtonElement>('.state-panel__cta')!;
      expect(cta.textContent).toContain('Limpiar búsqueda');

      cta.click();
      tick(250);
      fixture.detectChanges();

      expect(fixture.componentInstance.searchCtrl.value).toBe('');
      expect(filas()).toEqual(['Salud', 'Transporte']);
    }));

    it('las tabs dicen lo que filtran: las raíces se parten en "Sin subcategorías" y "Con subcategorías"', () => {
      crear([SALUD, TRANSPORTE]);
      const tabs = (): string[] => Array.from(el().querySelectorAll('.filter-tabs__tab'))
        .map((t) => `${t.querySelector('span')!.textContent!.trim()} ${t.querySelector('.filter-tabs__tab-count')!.textContent!.trim()}`);

      // "Todas" cuenta el árbol entero (2 raíces + 1 hija); las otras dos, raíces: 1 sin hijas + 1 con hijas.
      expect(tabs()).toEqual(['Todas 3', 'Sin subcategorías 1', 'Con subcategorías 1']);

      fixture.componentInstance.filtro$.next('raices');
      fixture.detectChanges();

      // Lo que queda en pantalla es lo que cuenta la tab: solo la raíz sin subcategorías.
      expect(filas()).toEqual(['Salud']);
      expect(el().querySelector('.active-filters__chip')!.textContent).toContain('Jerarquía: Sin subcategorías');
    });

    it('con un filtro de jerarquía sin coincidencias el CTA dice "Limpiar filtros" y lo quita', () => {
      crear([SALUD]);

      fixture.componentInstance.filtro$.next('con-sub');
      fixture.detectChanges();

      expect(panel()!.querySelector('.state-panel__title')!.textContent).toBe('Sin resultados');
      expect(el().querySelector('.active-filters__chip')!.textContent).toContain('Jerarquía: Con subcategorías');
      const cta = panel()!.querySelector<HTMLButtonElement>('.state-panel__cta')!;
      expect(cta.textContent).toContain('Limpiar filtros');

      cta.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.filtro$.value).toBe('todas');
      expect(filas()).toEqual(['Salud']);
    });

    it('buscar abre la rama que lleva a la coincidencia y cuenta resultados', fakeAsync(() => {
      crear([SALUD, TRANSPORTE]);

      buscar('licen');

      expect(filas()).toEqual(['Transporte', 'Licencias']);
      expect(el().querySelector('.list-toolbar__count')!.textContent!.trim()).toBe('2 resultados');
    }));
  });

  describe('acciones de fila según permisos', () => {
    it('con los tres permisos ofrece agregar, editar y eliminar', () => {
      crear([SALUD]);
      expect(Array.from(el().querySelectorAll('.cat-table__row .row-action')).map((b) => b.getAttribute('aria-label'))).toEqual([
        'Agregar subcategoría dentro de Salud', 'Editar categoría Salud', 'Eliminar categoría Salud',
      ]);
    });

    it('sin permisos no ofrece ninguna', () => {
      crear([SALUD], of([SALUD]), []);
      expect(el().querySelectorAll('.cat-table__row .row-action').length).toBe(0);
    });
  });

  describe('eliminar', () => {
    function pedirBaja(nombre: string): void {
      const eliminar = boton(`Eliminar categoría ${nombre}`);
      eliminar.focus();
      eliminar.click();
      fixture.detectChanges();
      dibujarDialogos(dialog());
    }

    it('pide confirmación nombrando la categoría y no elimina hasta confirmar', () => {
      crear([SALUD, VIVIENDA]);
      pedirBaja('Salud');

      expect(tituloDeConfirmacion()).toBe('¿Eliminar la categoría?');
      expect(confirmacionAbierta()!.querySelector('b')!.textContent).toBe('Salud');
      expect(confirmacionAbierta()!.textContent).toContain('Esta acción no se puede deshacer.');
      expect(facade.delete).not.toHaveBeenCalled();
    });

    it('si tiene subcategorías la confirmación lo advierte', () => {
      crear([TRANSPORTE]);
      pedirBaja('Transporte');

      expect(confirmacionAbierta()!.textContent).toContain('cuelgan 1 subcategoría de ella');
    });

    it('al confirmar bloquea la fila mientras elimina; después avisa y deja el foco en la fila que ocupa su lugar', fakeAsync(() => {
      crear([SALUD, VIVIENDA]);
      const respuesta$ = new Subject<void>();
      facade.delete.and.returnValue(respuesta$);
      pedirBaja('Salud');

      pulsarEnConfirmacion('Sí, eliminar');
      fixture.detectChanges();

      expect(facade.delete).toHaveBeenCalledOnceWith('c-1');
      expect(boton('Eliminar categoría Salud').disabled).toBeTrue();
      expect(boton('Eliminar categoría Salud').querySelector('i.ph-spinner-gap')).not.toBeNull();
      expect(boton('Eliminar categoría Vivienda').disabled).toBeFalse();
      expect(avisos).not.toHaveBeenCalled();

      arbol$.next([VIVIENDA]);
      respuesta$.next();
      respuesta$.complete();
      fixture.detectChanges();
      flush();
      fixture.detectChanges();

      expect(avisos).toHaveBeenCalledOnceWith('Categoría eliminada', 'OK', { duration: 3000, panelClass: 'snackbar-success' });
      expect(filas()).toEqual(['Vivienda']);
      expect(document.activeElement).toBe(boton('Agregar subcategoría dentro de Vivienda'));
      expect(boton('Eliminar categoría Vivienda').disabled).toBeFalse();
    }));

    it('si era la última, el foco va al buscador', fakeAsync(() => {
      crear([SALUD]);
      facade.delete.and.callFake(() => {
        arbol$.next([]);
        return of(undefined);
      });
      pedirBaja('Salud');

      pulsarEnConfirmacion('Sí, eliminar');
      fixture.detectChanges();
      flush();
      fixture.detectChanges();

      expect(document.activeElement).toBe(el().querySelector('.list-search__input'));
    }));

    it('al cancelar no elimina ni avisa', fakeAsync(() => {
      crear([SALUD, VIVIENDA]);
      pedirBaja('Salud');

      pulsarEnConfirmacion('Cancelar');
      flush();
      fixture.detectChanges();

      expect(facade.delete).not.toHaveBeenCalled();
      expect(avisos).not.toHaveBeenCalled();
      expect(filas()).toEqual(['Salud', 'Vivienda']);
    }));

    it('si el backend la rechaza por tener subcategorías, el motivo queda en el diálogo y la fila se libera', fakeAsync(() => {
      crear([TRANSPORTE]);
      facade.delete.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 400, error: { code: API_CODES.CATEGORY_HAS_CHILDREN },
      })));
      pedirBaja('Transporte');

      pulsarEnConfirmacion('Sí, eliminar');
      tick();
      fixture.detectChanges();
      dibujarDialogos(dialog());

      expect(errorDeConfirmacion()).toBe('No se puede eliminar: tiene subcategorías. Movelas a otra categoría padre o eliminalas primero.');
      expect(avisos).not.toHaveBeenCalled();
      expect(boton('Eliminar categoría Transporte').disabled).toBeFalse();
      pulsarEnConfirmacion('Cancelar');
      flush();
    }));
  });
});
