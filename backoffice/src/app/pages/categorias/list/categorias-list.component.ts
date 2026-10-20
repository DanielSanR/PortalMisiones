import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, ElementRef, inject } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, filter, finalize,
  firstValueFrom, map, startWith, withLatestFrom,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { FilterTabsComponent, FilterTabOption } from '../../../shared/components/filter-tabs';
import { ListSearchComponent } from '../../../shared/components/list-search';
import { ActiveFiltersComponent, FiltroActivo } from '../../../shared/components/active-filters';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { CategoriasFacade, CategoriaNode, CategoriaVM } from '@features/categorias';
import { enfocarTrasEliminar, indiceDeFilaActiva } from '@shared/utils/foco-lista';

/** Fila del árbol (div con role=row): el selector por defecto de `foco-lista` es el de mat-table. */
const FILA_ARBOL = '.cat-table__row';

/** Cuenta recursiva de nodos (raíces + todos los descendientes), para el contador de la toolbar. */
function contarNodos(nodes: CategoriaNode[]): number {
  return nodes.reduce((total, node) => total + 1 + contarNodos(node.children), 0);
}

/** Ids de las ramas que se pueden abrir (nodos con hijos), para "Expandir todo". */
function idsExpandibles(nodes: CategoriaNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      acc.push(node.id);
      idsExpandibles(node.children, acc);
    }
  }
  return acc;
}

/** Filtro "Todas/Solo raíces/Con subcategorías", sobre las raíces del árbol (campo real `children.length`). */
type ArbolFiltro = 'todas' | 'raices' | 'con-sub';

function filtrarRaices(roots: CategoriaNode[], filtro: ArbolFiltro): CategoriaNode[] {
  if (filtro === 'raices') return roots.filter((r) => r.children.length === 0);
  if (filtro === 'con-sub') return roots.filter((r) => r.children.length > 0);
  return roots;
}

// ── Búsqueda dentro del árbol ────────────────────────────────────────────────
// `buscarEn` (list-filter.utils) filtra colecciones planas: acá hace falta decidir
// nodo por nodo y volver a armar la jerarquía, así que la comparación vive local
// pero usa el mismo criterio (minúsculas es-AR, `includes`).

function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').trim().toLocaleLowerCase('es-AR');
}

function coincide(node: CategoriaNode, q: string): boolean {
  return normalizar(node.nombre).includes(q) || normalizar(node.slug).includes(q);
}

/** ¿Coincide el nodo o alguna de sus descendientes? Define qué raíces siguen siendo relevantes. */
function ramaCoincide(node: CategoriaNode, q: string): boolean {
  return coincide(node, q) || node.children.some((hija) => ramaCoincide(hija, q));
}

/**
 * Poda el árbol dejando solo lo que aporta al resultado:
 * - el nodo que coincide se conserva con TODA su rama (sus hijas son el contexto del match);
 * - el que no coincide sobrevive únicamente si alguna descendiente coincide, y se queda solo
 *   con esas ramas. Así una hija encontrada nunca aparece huérfana: su padre sigue a la vista
 *   diciendo dónde está parada, que es la mitad de la información en una jerarquía.
 */
function podar(nodes: CategoriaNode[], q: string): CategoriaNode[] {
  if (!q) return nodes;
  const resultado: CategoriaNode[] = [];
  for (const node of nodes) {
    if (coincide(node, q)) {
      resultado.push(node);
      continue;
    }
    const hijas = podar(node.children, q);
    if (hijas.length > 0) resultado.push({ ...node, children: hijas });
  }
  return resultado;
}

/**
 * Ids de los ancestros de cada coincidencia. Sin abrirlos el match queda escondido detrás
 * de un chevron cerrado y la búsqueda parece no haber encontrado nada.
 * Devuelve si hay alguna coincidencia en el subárbol recorrido.
 */
function ramasAAbrir(nodes: CategoriaNode[], q: string, acc: Set<string>): boolean {
  let hayMatch = false;
  for (const node of nodes) {
    const enDescendientes = ramasAAbrir(node.children, q, acc);
    if (enDescendientes) acc.add(node.id);
    hayMatch = hayMatch || enDescendientes || coincide(node, q);
  }
  return hayMatch;
}

/** Textos del estado vacío: distinguen "todavía no hay nada" de "la búsqueda no matchea". */
interface EstadoVacio {
  vacioTitulo: string;
  vacioTexto: string;
  vacioAccion: string;
  /** El vacío viene de la búsqueda/filtro: el CTA limpia en vez de crear. */
  vacioPorFiltros: boolean;
}

/** ViewModel de la pantalla: árbol ya filtrado + qué ramas van abiertas + textos del vacío. */
interface CategoriasVista extends EstadoVacio {
  raices: CategoriaNode[];
  /** Ids abiertos; viaja por el contexto del template recursivo (no hay estado mutable en la vista). */
  expandidos: Set<string>;
  total: number;
  etiquetaTotal: string;
  filtrosActivos: FiltroActivo[];
}

@Component({
  selector: 'app-categorias-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    ReactiveFormsModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    LoadingComponent,
    FilterTabsComponent,
    ListSearchComponent,
    ActiveFiltersComponent,
    HasPermissionDirective,
    PageActionsDirective,
  ],
  templateUrl: './categorias-list.component.html',
  styleUrls: ['./categorias-list.component.scss'],
})
export class CategoriasListComponent implements OnInit {
  private readonly facade = inject(CategoriasFacade);
  readonly arbol$ = this.facade.arbol$;

  loading = true;
  /** La carga falló: el árbol muestra su estado de error con "Reintentar" en vez del vacío. */
  error = false;
  /** Id de la categoría con un borrado en vuelo, para bloquear su fila mientras dura. */
  deletingId: string | null = null;

  readonly searchCtrl = new FormControl('', { nonNullable: true });
  private readonly search$ = this.searchCtrl.valueChanges.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    startWith(this.searchCtrl.value),
  );

  /** Filtro "Todas/Solo raíces/Con subcategorías" sobre las categorías raíz (client-side). */
  readonly filtro$ = new BehaviorSubject<ArbolFiltro>('todas');

  /** Ramas abiertas. Por defecto todo COLAPSADO (solo raíces visibles). */
  private readonly expandidos$ = new BehaviorSubject<Set<string>>(new Set<string>());

  /** Los contadores de los chips se calculan sobre lo ya buscado, para que no mientan. */
  readonly filterTabs$ = combineLatest([this.arbol$, this.search$]).pipe(
    map(([roots, search]): FilterTabOption[] => {
      const q = normalizar(search);
      const relevantes = q ? roots.filter((r) => ramaCoincide(r, q)) : roots;
      return [
        { value: 'todas', label: 'Todas', count: contarNodos(podar(relevantes, q)) },
        { value: 'raices', label: 'Solo raíces', count: relevantes.filter((r) => r.children.length === 0).length },
        { value: 'con-sub', label: 'Con subcategorías', count: relevantes.filter((r) => r.children.length > 0).length },
      ];
    }),
  );

  /** true cuando todas las ramas abribles están abiertas (rótulo del botón del header). */
  readonly todoExpandido$ = combineLatest([this.arbol$, this.expandidos$]).pipe(
    map(([roots, expandidos]) => {
      const ids = idsExpandibles(roots);
      return ids.length > 0 && ids.every((id) => expandidos.has(id));
    }),
  );

  readonly vista$ = combineLatest([this.arbol$, this.filtro$, this.search$, this.expandidos$]).pipe(
    map(([roots, filtro, search, expandidos]): CategoriasVista => {
      const q = normalizar(search);
      // El chip filtra sobre las raíces reales (children.length del árbol completo) y recién
      // después se poda por búsqueda: al revés, "Solo raíces" contaría hijas escondidas por la poda.
      const visibles = podar(filtrarRaices(roots, filtro), q);
      const total = contarNodos(visibles);
      const filtrosActivos = this.filtrosActivos(search, filtro);
      return {
        raices: visibles,
        expandidos,
        total,
        etiquetaTotal: q ? (total === 1 ? 'resultado' : 'resultados') : 'categorías',
        filtrosActivos,
        ...this.estadoVacio(filtrosActivos.length > 0, !!q),
      };
    }),
  );

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();

    // La búsqueda siembra la expansión: abre las ramas que llevan a una coincidencia y, al
    // limpiarla, el árbol vuelve a su estado colapsado. Sembrar (en vez de unir con lo que el
    // usuario abrió) deja que el chevron siga mandando mientras se busca.
    this.search$
      .pipe(withLatestFrom(this.arbol$), takeUntilDestroyed(this.destroyRef))
      .subscribe(([search, roots]) => {
        const q = normalizar(search);
        const abrir = new Set<string>();
        if (q) ramasAAbrir(roots, q, abrir);
        this.expandidos$.next(abrir);
      });
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.facade.loadCategorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        // Sin esto el árbol quedaba mostrando "Todavía no hay categorías": una API caída
        // era indistinguible de una taxonomía sin cargar, y el usuario asumía que perdió los datos.
        error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); },
      });
  }

  toggle(id: string): void {
    const abiertos = new Set(this.expandidos$.value);
    if (!abiertos.delete(id)) abiertos.add(id);
    this.expandidos$.next(abiertos);
  }

  /** Expande/colapsa todas las ramas con hijos (acción "Expandir todo" del header). */
  async toggleExpandAll(): Promise<void> {
    const roots = await firstValueFrom(this.arbol$);
    const ids = idsExpandibles(roots);
    const todoAbierto = ids.length > 0 && ids.every((id) => this.expandidos$.value.has(id));
    this.expandidos$.next(todoAbierto ? new Set<string>() : new Set(ids));
  }

  limpiarFiltros(): void {
    this.searchCtrl.setValue('');
    this.filtro$.next('todas');
  }

  /** Quita un solo filtro desde su chip en la barra "Filtros activos". */
  quitarFiltro(clave: string): void {
    if (clave === 'search') this.searchCtrl.setValue('');
    else this.filtro$.next('todas');
  }

  hayFiltrosActivos(): boolean {
    return this.filtro$.value !== 'todas' || this.searchCtrl.value.trim().length > 0;
  }

  /** El CTA del estado vacío crea o limpia según por qué está vacío. */
  onEmptyAction(): void {
    if (this.hayFiltrosActivos()) {
      this.limpiarFiltros();
      return;
    }
    this.onCreate();
  }

  onCreate(parentId?: string): void {
    this.router.navigate(['/dashboard/categorias/nuevo'], parentId ? { queryParams: { parentId } } : {});
  }

  onEdit(categoria: CategoriaVM): void {
    this.router.navigate(['/dashboard/categorias/editar', categoria.id]);
  }

  onDelete(node: CategoriaNode): void {
    // Foco tras borrar: la fila (y su botón) desaparece; se captura la posición antes de abrir el diálogo.
    const indice = indiceDeFilaActiva(this.host, FILA_ARBOL);
    const hijas = node.children.length;
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '¿Eliminar la categoría?',
        // El copy cambia según la rama porque la consecuencia es distinta: el backend
        // rechaza el borrado de una categoría con subcategorías (4065), así que decirlo
        // antes evita que el usuario confirme algo que ya sabemos que va a fallar.
        message: hijas > 0
          ? `Se eliminaría ${node.nombre} de forma permanente, pero cuelgan ${hijas} ${hijas === 1 ? 'subcategoría' : 'subcategorías'} de ella: primero movelas a otro padre o eliminalas, porque el sistema no borra una categoría que todavía tiene subcategorías.`
          : `Se eliminará ${node.nombre} de forma permanente y dejará de estar disponible para clasificar trámites en el portal. Esta acción no se puede deshacer.`,
        highlight: node.nombre,
        danger: true,
        confirmText: 'Sí, eliminar',
        busyText: 'Eliminando...',
        // El diálogo se queda abierto con el botón en spinner hasta que el backend responde,
        // en vez de cerrar optimistamente y dejar al usuario sin señal de qué pasó.
        confirmAction: () => {
          this.deletingId = node.id;
          this.cdr.markForCheck();
          return this.facade.delete(node.id).pipe(
            finalize(() => { this.deletingId = null; this.cdr.markForCheck(); }),
          );
        },
      },
      panelClass: 'custom-modal-panel',
    })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        enfocarTrasEliminar(this.host, indice, this.destroyRef, FILA_ARBOL);
        this.snackBar.open(  'Categoría eliminada', 'OK', {
          duration: 3000,
          // Variante del design system (fondo #1A1A2E, acción en primary-200) — Kitchen Sink §07.
          panelClass: 'snackbar-success',
        });
      });
  }

  private filtrosActivos(search: string, filtro: ArbolFiltro): FiltroActivo[] {
    const activos: FiltroActivo[] = [];
    const termino = (search ?? '').trim();
    if (termino) activos.push({ clave: 'search', etiqueta: `Búsqueda: ${termino}` });
    if (filtro !== 'todas') {
      activos.push({ clave: 'jerarquia', etiqueta: `Jerarquía: ${filtro === 'raices' ? 'Solo raíces' : 'Con subcategorías'}` });
    }
    return activos;
  }

  private estadoVacio(hayFiltros: boolean, hayBusqueda: boolean): EstadoVacio {
    // Con filtros activos el CTA siempre limpia (aunque no haya categorías): "Nueva…" solo sin filtros.
    if (hayFiltros) {
      return {
        vacioTitulo: 'Sin resultados',
        vacioTexto: 'Ninguna categoría coincide con la búsqueda o el filtro aplicado. Probá con otro término o mirá la jerarquía completa.',
        vacioAccion: hayBusqueda ? 'Limpiar búsqueda' : 'Limpiar filtros',
        vacioPorFiltros: true,
      };
    }
    return {
      vacioTitulo: 'Todavía no hay categorías',
      vacioTexto: 'Creá la primera categoría raíz para armar la navegación del portal.',
      vacioAccion: 'Nueva categoría',
      vacioPorFiltros: false,
    };
  }
}
