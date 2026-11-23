import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { BehaviorSubject, defer, of, tap } from 'rxjs';
import { AdopcionVM, AdopcionesFacade } from '@features/adopciones';
import {
  FuenteDePrueba, ListaPO, describeLista, desmontarLista, espiarDialogos, montarLista,
} from '@shared/utils/testing/lista.testing';
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
    const sub = componente.lista.vista$.subscribe((v) => { vista = v; });
    expect(vista!.emptyActionLabel).toBe('Adoptar trámite');
    componente.lista.searchCtrl.setValue('licencia');
    tick(250);
    expect(vista!.hayFiltros).toBeTrue();
    expect(vista!.emptyActionLabel).toBe('Limpiar filtros');
    sub.unsubscribe();
  }));

  it('recargar no resetea el filtro por organismo (el vacío transitorio no cuenta)', () => {
    const componente = crear([adopcion('a-1', 'o-1', 'IPS'), adopcion('a-2', 'o-2', 'Min. Salud')]);
    componente.ngOnInit();
    componente.organismoCtrl.setValue('o-1');
    componente.lista.cargar();
    expect(componente.organismoCtrl.value).toBe('o-1');
  });
});

// ───────────────────────────── Caracterización de la lista (arnés compartido) ─────────────────────────────

const TRAMITES = [
  'Obtener licencia de conducir', 'Inscribirse al monotributo', 'Renovar el DNI', 'Solicitar partida de nacimiento',
  'Obtener certificado de residencia', 'Inscribirse en la escuela', 'Pedir turno médico', 'Tramitar la jubilación',
  'Habilitar un comercio', 'Registrar un automotor', 'Obtener certificado de antecedentes', 'Solicitar una beca',
];
/** Del organismo "Rentas": las de índice 10 y 11; el resto, de "IPS". Programada: la de índice 11. */
const ADOPCIONES: AdopcionVM[] = TRAMITES.map((plantillaTitulo, i) => ({
  ...adopcion(`a-${i + 1}`, i >= 10 ? 'o-2' : 'o-1', i >= 10 ? 'Rentas' : 'IPS'),
  plantillaTitulo,
  estadoVigencia: i === 11 ? 'programada' : 'vigente',
}) as AdopcionVM);
const PERMISOS_ADOPCIONES = ['READ_ADOPTION', 'CREATE_ADOPTION', 'DELETE_ADOPTION', 'READ_PROCEDURE', 'READ_ORGANISM'];

const facadeDePrueba = (fuente: FuenteDePrueba<AdopcionVM>) => [{
  provide: AdopcionesFacade,
  useValue: {
    adopciones$: fuente.filas$, loadAdopciones: fuente.cargar, deshabilitar: fuente.eliminar, puedeAdoptar: () => true,
  },
}];

describeLista<AdopcionVM>({
  titulo: 'AdopcionesListComponent',
  componente: AdopcionesListComponent,
  facade: facadeDePrueba,
  filas: ADOPCIONES,
  nombre: (a) => a.plantillaTitulo ?? '',
  selectorNombre: '.adoplist-plantilla',
  permisos: PERMISOS_ADOPCIONES,
  contador: (n) => `${n} trámites`,
  errorTitulo: 'No pudimos cargar los trámites del organismo',
  vacio: { titulo: 'Todavía no hay trámites del organismo', cta: 'Adoptar trámite' },
  sinCrear: { permisos: ['READ_ADOPTION'] },
  sinResultados: { texto: 'Ningún trámite coincide con la búsqueda o los filtros aplicados.', cta: 'Limpiar filtros' },
  busqueda: { termino: 'obtener', esperadas: (a) => (a.plantillaTitulo ?? '').includes('Obtener') },
  ordenPorNombre: 'Trámite',
  acciones: { principal: 'Ver detalle', menu: ['Deshabilitar'] },
  soloLectura: { permisos: ['READ_ADOPTION'], principal: 'Ver detalle', menu: [] },
  baja: {
    opcion: 'Deshabilitar', titulo: '¿Deshabilitar el trámite del organismo?', confirmar: 'Sí, deshabilitar',
    aviso: 'Trámite del organismo deshabilitado', foco: true,
  },
});

describe('AdopcionesListComponent · filtros y adopción', () => {
  let po: ListaPO<AdopcionesListComponent>;
  let fuente: FuenteDePrueba<AdopcionVM>;

  function montar(): void {
    fuente = new FuenteDePrueba(ADOPCIONES);
    po = montarLista({ componente: AdopcionesListComponent, providers: facadeDePrueba(fuente), permisos: PERMISOS_ADOPCIONES });
    po.asentar();
  }

  afterEach(() => desmontarLista(po));

  it('los filtros por estado y organismo dejan su chip y vuelven a la primera página', fakeAsync(() => {
    montar();
    po.irAPagina('Página siguiente');
    po.fixture.componentInstance.organismoCtrl.setValue('o-1');
    po.asentar();
    expect(po.paginaActiva()).toBe('1');
    expect(po.chips()).toEqual(['Organismo: IPS']);
    expect(po.contador()).toBe('10 trámites');

    po.fixture.componentInstance.estadoCtrl.setValue('programada');
    po.asentar();
    expect(po.chips()).toEqual(['Estado: Programada', 'Organismo: IPS']);
    expect(po.vacio()!.titulo).toBe('Sin resultados');

    po.quitarChip(1);
    expect(po.chips()).toEqual(['Estado: Programada']);
    expect(po.nombres('.adoplist-plantilla')).toEqual(['Solicitar una beca']);
    flush();
  }));

  it('si el organismo elegido deja de estar en la lista (se deshabilitó su última adopción), deja de filtrar', fakeAsync(() => {
    montar();
    po.fixture.componentInstance.organismoCtrl.setValue('o-2');
    po.asentar();
    expect(po.contador()).toBe('2 trámites');

    fuente.filas$.next(ADOPCIONES.filter((a) => a.organismoId === 'o-1'));
    po.asentar();
    expect(po.chips()).toEqual([]);
    expect(po.contador()).toBe('10 trámites');
    flush();
  }));

  it('al adoptar avisa con la acción "Ver" durante 5 segundos; una adopción programada lo aclara', fakeAsync(() => {
    montar();
    const dialogos = espiarDialogos();
    void po.fixture.componentInstance.onAdoptar();
    po.asentar(); // el formulario se baja en diferido
    dialogos.cerrar(ADOPCIONES[0]);
    po.asentar();
    expect(po.avisos).toEqual([{ mensaje: 'Trámite adoptado', accion: 'Ver', duracion: 5000, clase: 'snackbar-success' }]);

    void po.fixture.componentInstance.onAdoptar();
    po.asentar();
    dialogos.cerrar(ADOPCIONES[11]);
    po.asentar();
    expect(po.mensajesDeAviso()[1]).toBe('Trámite adoptado. Va a estar vigente desde la fecha de inicio');
    flush();
  }));
});
