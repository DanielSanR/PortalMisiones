import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { EtiquetasFacade, EtiquetaVM } from '@features/etiquetas';
import { EtiquetasListComponent } from './etiquetas-list.component';

function crear(etiquetas: EtiquetaVM[]): EtiquetasListComponent {
  const etiquetas$ = new BehaviorSubject<EtiquetaVM[]>(etiquetas);
  TestBed.configureTestingModule({
    imports: [EtiquetasListComponent],
    providers: [
      provideRouter([]),
      provideNoopAnimations(),
      { provide: EtiquetasFacade, useValue: { etiquetas$, loadEtiquetas: () => of(etiquetas) } },
    ],
  });
  return TestBed.createComponent(EtiquetasListComponent).componentInstance;
}

const UNA: EtiquetaVM = { id: 't-1', slug: 'salud', local: false, organismoId: null, organismoNombre: null } as EtiquetaVM;

describe('EtiquetasListComponent · estado vacío', () => {
  it('sin filtros y sin etiquetas invita a crear', async () => {
    const vista = await firstValueFrom(crear([]).vista$);
    expect(vista.hayFiltros).toBeFalse();
    expect(vista.emptyActionLabel).toBe('Nueva etiqueta');
  });

  it('con filtros activos el CTA limpia aunque no haya ninguna etiqueta', async () => {
    const componente = crear([]);
    componente.filtro$.next('globales');
    const vista = await firstValueFrom(componente.vista$);
    expect(vista.hayFiltros).toBeTrue();
    expect(vista.emptyTitle).toBe('Sin resultados');
    expect(vista.emptyActionLabel).toBe('Limpiar filtros');
  });

  it('con una búsqueda sin coincidencias el CTA limpia', fakeAsync(() => {
    const componente = crear([UNA]);
    let label = '';
    const sub = componente.vista$.subscribe((v) => { label = v.emptyActionLabel; });
    componente.searchCtrl.setValue('zzz');
    tick(250);
    expect(label).toBe('Limpiar filtros');
    sub.unsubscribe();
  }));
});
