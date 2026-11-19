import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { EtiquetasFacade, EtiquetaVM } from '@features/etiquetas';
import { EtiquetasListComponent } from './etiquetas-list.component';

/** `EtiquetasFacade.soloEtiquetasLocales$` de la prueba en curso (sesión con organismo ⇒ `true`). */
let soloLocales$: BehaviorSubject<boolean>;

function crearFixture(etiquetas: EtiquetaVM[], soloLocales = false): ComponentFixture<EtiquetasListComponent> {
  const etiquetas$ = new BehaviorSubject<EtiquetaVM[]>(etiquetas);
  soloLocales$ = new BehaviorSubject<boolean>(soloLocales);
  TestBed.configureTestingModule({
    imports: [EtiquetasListComponent],
    providers: [
      provideRouter([]),
      provideNoopAnimations(),
      {
        provide: EtiquetasFacade,
        useValue: { etiquetas$, loadEtiquetas: () => of(etiquetas), soloEtiquetasLocales$: soloLocales$.asObservable() },
      },
    ],
  });
  return TestBed.createComponent(EtiquetasListComponent);
}

function crear(etiquetas: EtiquetaVM[], soloLocales = false): EtiquetasListComponent {
  return crearFixture(etiquetas, soloLocales).componentInstance;
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

/**
 * Con una sesión de organismo `GET /api/tag` solo devuelve las etiquetas locales de ese organismo: el
 * filtro "Todas / Globales / Locales" no tendría nada que filtrar, así que no se ofrece.
 */
describe('EtiquetasListComponent · filtro por alcance', () => {
  const LOCAL: EtiquetaVM = { id: 't-2', slug: 'jubilaciones', local: true, organismoId: 'org-1', organismoNombre: 'IPS' } as EtiquetaVM;

  const filtro = (fixture: ComponentFixture<EtiquetasListComponent>): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector('app-filter-tabs');

  it('sesión global: ofrece el filtro', async () => {
    const fixture = crearFixture([UNA, LOCAL]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((await firstValueFrom(fixture.componentInstance.vista$)).filtraPorAlcance).toBeTrue();
    expect(filtro(fixture)).not.toBeNull();
  });

  it('sesión con organismo: no lo dibuja, y la lista sigue mostrando sus etiquetas', async () => {
    const fixture = crearFixture([LOCAL], true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const vista = await firstValueFrom(fixture.componentInstance.vista$);
    expect(vista.filtraPorAlcance).toBeFalse();
    expect(vista.rows).toEqual([LOCAL]);
    expect(filtro(fixture)).toBeNull();
  });

  it('si la sesión pasa a ser de organismo con un filtro elegido, el filtro se quita solo', async () => {
    const componente = crear([LOCAL]);
    componente.filtro$.next('globales');
    expect((await firstValueFrom(componente.vista$)).rows).toEqual([]);

    soloLocales$.next(true);

    const vista = await firstValueFrom(componente.vista$);
    expect(componente.filtro$.value).toBe('todas');
    expect(vista.rows).toEqual([LOCAL]);
    expect(vista.hayFiltros).toBeFalse();
    expect(vista.filtraPorAlcance).toBeFalse();
  });
});
