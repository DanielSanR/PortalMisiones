import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, of } from 'rxjs';
import { FichaLocalVM, FichasLocalesFacade } from '@features/fichas-locales';
import { FichasListComponent } from './fichas-list.component';

const FICHA: FichaLocalVM = {
  id: 'f-1', slug: 'licencia-posadas', estado: 'BORRADOR', activa: true, version: 1,
  adopcionId: 'a-1', localidadId: 'l-1', url: null, requisitos: null, costos: null,
  plantillaId: 'p-1', plantillaTitulo: 'Obtener licencia', organismoId: 'o-1', organismoNombre: 'Posadas', localidadNombre: 'Posadas',
};

function crear(lista: FichaLocalVM[], fuenteSimulada = false): FichasListComponent {
  const fichas$ = new BehaviorSubject<FichaLocalVM[]>(lista);
  const facade = {
    fichas$,
    fuenteSimulada,
    puedePublicar$: of(false),
    accionesWorkflow$: of(() => []),
    loadFichas: () => of(lista),
  };
  TestBed.configureTestingModule({
    imports: [FichasListComponent],
    providers: [provideRouter([]), provideNoopAnimations(), { provide: FichasLocalesFacade, useValue: facade }],
  });
  return TestBed.createComponent(FichasListComponent).componentInstance;
}

describe('FichasListComponent', () => {
  it('con fuente simulada muestra el aviso persistente (también con la lista vacía y su "Nueva ficha")', () => {
    crear([], true);
    const fixture = TestBed.createComponent(FichasListComponent);
    fixture.detectChanges();
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('.form-aviso[role="note"]')!;
    expect(aviso.textContent).toContain('Datos de ejemplo');
    expect(aviso.textContent).toContain('se pierde al recargar');
    expect(fixture.componentInstance.fuenteSimulada).toBeTrue();
  });

  it('con fuente real no muestra el aviso', () => {
    crear([]);
    const fixture = TestBed.createComponent(FichasListComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.form-aviso[role="note"]')).toBeNull();
  });

  it('sin fichas el estado vacío ofrece "Nueva ficha"; con búsqueda activa, "Limpiar filtros"', fakeAsync(() => {
    const componente = crear([]);
    let vista: { hayFiltros: boolean; emptyAccion: string | null } | null = null;
    const sub = componente.vista$.subscribe((v) => { vista = v; });
    expect(vista!.emptyAccion).toBe('nueva');
    componente.searchCtrl.setValue('licencia');
    tick(250);
    expect(vista!.hayFiltros).toBeTrue();
    expect(vista!.emptyAccion).toBe('limpiar');
    sub.unsubscribe();
  }));

  it('"Nueva ficha" abre el alta sin trámite preelegido (se elige en el formulario)', () => {
    const componente = crear([]);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    componente.onEmptyAction('nueva');
    expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/tramites/fichas/nueva']);
  });

  it('el menú de cada fila trae "Puntos de atención" (con READ_ATTENTION_POINT) y abre el detalle en ese panel', () => {
    const componente = crear([FICHA]);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);

    const puntos = componente.accionesDe(FICHA, () => []).find((a) => a.label === 'Puntos de atención')!;
    expect(puntos).toBeDefined();
    expect(puntos.permission).toBe('READ_ATTENTION_POINT');
    puntos.run();
    expect(navigate).toHaveBeenCalledOnceWith(['/dashboard/tramites/fichas/detalle', 'f-1'], { fragment: 'puntos-atencion' });
  });
});
