import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, defer, of, tap } from 'rxjs';
import { AdopcionVM, AdopcionesFacade } from '@features/adopciones';
import { AdopcionesListComponent } from './adopciones-list.component';

function adopcion(id: string, organismoId: string, organismoNombre: string): AdopcionVM {
  return {
    id, organismoId, organismoNombre, plantillaId: 'p-1', plantillaTitulo: 'Obtener licencia',
    estadoVigencia: 'vigente', vigente: true, habilitada: true, vigenteDesde: new Date(2026, 0, 1), vigenteHasta: null,
  } as unknown as AdopcionVM;
}

/** Stub con el mismo contrato que el facade real: `loadAdopciones` vacía el stream al empezar. */
function crear(lista: AdopcionVM[]): AdopcionesListComponent {
  const adopciones$ = new BehaviorSubject<AdopcionVM[]>(lista);
  const facade = {
    adopciones$,
    puedeAdoptar: () => false,
    loadAdopciones: () => defer(() => {
      adopciones$.next([]);
      return of(lista).pipe(tap((l) => adopciones$.next(l)));
    }),
  };
  TestBed.configureTestingModule({
    imports: [AdopcionesListComponent],
    providers: [provideRouter([]), provideNoopAnimations(), { provide: AdopcionesFacade, useValue: facade }],
  });
  return TestBed.createComponent(AdopcionesListComponent).componentInstance;
}

describe('AdopcionesListComponent', () => {
  it('con búsqueda activa y sin adopciones el CTA es "Limpiar filtros"', fakeAsync(() => {
    const componente = crear([]);
    let vista: { hayFiltros: boolean; emptyActionLabel: string } | null = null;
    const sub = componente.vista$.subscribe((v) => { vista = v; });
    expect(vista!.emptyActionLabel).toBe('Adoptar trámite');
    componente.searchCtrl.setValue('licencia');
    tick(250);
    expect(vista!.hayFiltros).toBeTrue();
    expect(vista!.emptyActionLabel).toBe('Limpiar filtros');
    sub.unsubscribe();
  }));

  it('recargar no resetea el filtro por organismo (el vacío transitorio no cuenta)', () => {
    const componente = crear([adopcion('a-1', 'o-1', 'IPS'), adopcion('a-2', 'o-2', 'Min. Salud')]);
    componente.ngOnInit();
    componente.organismoCtrl.setValue('o-1');
    componente.load();
    expect(componente.organismoCtrl.value).toBe('o-1');
  });
});
