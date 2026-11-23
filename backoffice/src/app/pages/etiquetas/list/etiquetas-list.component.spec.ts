import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { EtiquetasFacade, EtiquetaVM } from '@features/etiquetas';
import {
  FuenteDePrueba, ListaPO, describeDialogoDeLista, describeLista, desmontarLista, montarLista,
} from '@shared/utils/testing/lista.testing';
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
    const vista = await firstValueFrom(crear([]).lista.vista$);
    expect(vista.hayFiltros).toBeFalse();
    expect(vista.emptyActionLabel).toBe('Nueva etiqueta');
  });

  it('con filtros activos el CTA limpia aunque no haya ninguna etiqueta', async () => {
    const componente = crear([]);
    componente.filtro$.next('globales');
    const vista = await firstValueFrom(componente.lista.vista$);
    expect(vista.hayFiltros).toBeTrue();
    expect(vista.emptyTitle).toBe('Sin resultados');
    expect(vista.emptyActionLabel).toBe('Limpiar filtros');
  });

  it('con una búsqueda sin coincidencias el CTA limpia', fakeAsync(() => {
    const componente = crear([UNA]);
    let label = '';
    const sub = componente.lista.vista$.subscribe((v) => { label = v.emptyActionLabel; });
    componente.lista.searchCtrl.setValue('zzz');
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

    expect((await firstValueFrom(fixture.componentInstance.lista.vista$)).filtraPorAlcance).toBeTrue();
    expect(filtro(fixture)).not.toBeNull();
  });

  it('sesión con organismo: no lo dibuja, y la lista sigue mostrando sus etiquetas', async () => {
    const fixture = crearFixture([LOCAL], true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const vista = await firstValueFrom(fixture.componentInstance.lista.vista$);
    expect(vista.filtraPorAlcance).toBeFalse();
    expect(vista.rows).toEqual([LOCAL]);
    expect(filtro(fixture)).toBeNull();
  });

  it('si la sesión pasa a ser de organismo con un filtro elegido, el filtro se quita solo', async () => {
    const componente = crear([LOCAL]);
    componente.filtro$.next('globales');
    expect((await firstValueFrom(componente.lista.vista$)).rows).toEqual([]);

    soloLocales$.next(true);

    const vista = await firstValueFrom(componente.lista.vista$);
    expect(componente.filtro$.value).toBe('todas');
    expect(vista.rows).toEqual([LOCAL]);
    expect(vista.hayFiltros).toBeFalse();
    expect(vista.filtraPorAlcance).toBeFalse();
  });
});

// ───────────────────────────── Caracterización de la lista (arnés compartido) ─────────────────────────────

const SLUGS = [
  'salud', 'educacion', 'transporte', 'vivienda', 'empleo', 'impuestos', 'turismo', 'salud-mental',
  'seguridad', 'cultura', 'salud-animal', 'ambiente',
];
/** Locales (del organismo IPS): las de índice 3 y 9. */
const ETIQUETAS: EtiquetaVM[] = SLUGS.map((slug, i) => {
  const local = i === 3 || i === 9;
  return { id: `t-${i + 1}`, slug, local, organismoId: local ? 'org-1' : null, organismoNombre: local ? 'IPS' : null };
});
const PERMISOS_ETIQUETAS = ['READ_TAG', 'CREATE_TAG', 'UPDATE_TAG', 'DELETE_TAG', 'READ_ORGANISM'];

const facadeDePrueba = (fuente: FuenteDePrueba<EtiquetaVM>) => [{
  provide: EtiquetasFacade,
  useValue: {
    etiquetas$: fuente.filas$, loadEtiquetas: fuente.cargar, delete: fuente.eliminar, soloEtiquetasLocales$: of(false),
  },
}];

describeLista<EtiquetaVM>({
  titulo: 'EtiquetasListComponent',
  componente: EtiquetasListComponent,
  facade: facadeDePrueba,
  filas: ETIQUETAS,
  nombre: (e) => e.slug,
  permisos: PERMISOS_ETIQUETAS,
  contador: (n) => `${n} etiquetas`,
  errorTitulo: 'No pudimos cargar las etiquetas',
  vacio: { titulo: 'Todavía no hay etiquetas', cta: 'Nueva etiqueta' },
  sinCrear: { permisos: ['READ_TAG'] },
  sinResultados: { texto: 'Ninguna etiqueta coincide con la búsqueda o el filtro aplicado.', cta: 'Limpiar filtros' },
  busqueda: { termino: 'salud', esperadas: (e) => e.slug.includes('salud') },
  ordenPorNombre: 'Etiqueta',
  acciones: { principal: 'Editar', menu: ['Eliminar'] },
  soloLectura: { permisos: ['READ_TAG'], principal: null, menu: [] },
  baja: { opcion: 'Eliminar', titulo: '¿Eliminar la etiqueta?', confirmar: 'Sí, eliminar', aviso: 'Etiqueta eliminada', foco: true },
});

describeDialogoDeLista<EtiquetaVM, EtiquetasListComponent>({
  titulo: 'EtiquetasListComponent',
  componente: EtiquetasListComponent,
  facade: facadeDePrueba,
  filas: ETIQUETAS,
  permisos: PERMISOS_ETIQUETAS,
  crear: (componente) => componente.onCreate(),
  nuevo: { titulo: 'Nueva etiqueta', aviso: 'Etiqueta creada' },
  editar: { titulo: 'Editar etiqueta', aviso: 'Etiqueta actualizada' },
});

describe('EtiquetasListComponent · filtro por alcance en pantalla', () => {
  let po: ListaPO<EtiquetasListComponent>;

  afterEach(() => desmontarLista(po));

  it('"Locales" filtra, deja el chip "Alcance: Locales" y quitarlo vuelve a "Todas"', fakeAsync(() => {
    po = montarLista({
      componente: EtiquetasListComponent, providers: facadeDePrueba(new FuenteDePrueba(ETIQUETAS)), permisos: PERMISOS_ETIQUETAS,
    });
    po.asentar();
    expect(po.tabs().map((t) => t.etiqueta)).toEqual(['Todas12', 'Globales10', 'Locales2']);

    po.elegirTab('Locales');
    expect(po.nombres('.cell-name__principal')).toEqual(['vivienda', 'cultura']);
    expect(po.chips()).toEqual(['Alcance: Locales']);

    po.quitarChip(0);
    expect(po.tabs().find((t) => t.activa)!.etiqueta).toBe('Todas12');
    expect(po.contador()).toBe('12 etiquetas');
    flush();
  }));
});
