import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, filter, firstValueFrom, map, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { FilterTabsComponent, FilterTabOption } from '../../../shared/components/filter-tabs';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { CategoriasFacade, CategoriaNode, CategoriaVM } from '@features/categorias';

/** Cuenta recursiva de nodos (raíces + todos los descendientes), para el contador de la toolbar. */
function countNodes(nodes: CategoriaNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

/** Filtro "Todas/Solo raíces/Con subcategorías", sobre las raíces del árbol (campo real `children.length`). */
type ArbolFiltro = 'todas' | 'raices' | 'con-sub';

function filterRoots(roots: CategoriaNode[], filtro: ArbolFiltro): CategoriaNode[] {
  if (filtro === 'raices') return roots.filter((r) => r.children.length === 0);
  if (filtro === 'con-sub') return roots.filter((r) => r.children.length > 0);
  return roots;
}

@Component({
  selector: 'app-categorias-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    LoadingComponent,
    FilterTabsComponent,
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

  /** Filtro "Todas/Solo raíces/Con subcategorías" sobre las categorías raíz (client-side). */
  readonly filtro$ = new BehaviorSubject<ArbolFiltro>('todas');
  readonly filterTabs$ = this.arbol$.pipe(map((roots): FilterTabOption[] => [
    { value: 'todas', label: 'Todas', count: countNodes(roots) },
    { value: 'raices', label: 'Solo raíces', count: roots.filter((r) => r.children.length === 0).length },
    { value: 'con-sub', label: 'Con subcategorías', count: roots.filter((r) => r.children.length > 0).length },
  ]));
  readonly arbolFiltrado$ = combineLatest([this.arbol$, this.filtro$]).pipe(
    map(([roots, filtro]) => filterRoots(roots, filtro)),
  );
  readonly total$ = this.arbolFiltrado$.pipe(map(countNodes));

  /** Ids expandidos. Por defecto todo COLAPSADO (solo raíces visibles). */
  private readonly expanded = new Set<string>();
  allExpanded = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.facade.loadCategorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        error: () => { this.loading = false; this.cdr.markForCheck(); },
      });
  }

  isExpanded(id: string): boolean {
    return this.expanded.has(id);
  }

  toggle(id: string): void {
    if (this.expanded.has(id)) {
      this.expanded.delete(id);
    } else {
      this.expanded.add(id);
    }
    this.cdr.markForCheck();
  }

  /** Expande/colapsa todas las ramas con hijos (acción "Expandir todo" del header). */
  async toggleExpandAll(): Promise<void> {
    if (this.allExpanded) {
      this.expanded.clear();
      this.allExpanded = false;
    } else {
      const rows = await firstValueFrom(this.arbol$);
      this.collectExpandableIds(rows);
      this.allExpanded = true;
    }
    this.cdr.markForCheck();
  }

  private collectExpandableIds(nodes: CategoriaNode[]): void {
    for (const node of nodes) {
      if (node.children.length > 0) {
        this.expanded.add(node.id);
        this.collectExpandableIds(node.children);
      }
    }
  }

  onCreate(parentId?: string): void {
    this.router.navigate(['/dashboard/categorias/nuevo'], parentId ? { queryParams: { parentId } } : {});
  }

  onEdit(categoria: CategoriaVM): void {
    this.router.navigate(['/dashboard/categorias/editar', categoria.id]);
  }

  onDelete(categoria: CategoriaVM, hasChildren = false): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar categoría',
        message: `¿Está seguro de eliminar "${categoria.nombre}"?${
          hasChildren ? ' No se puede eliminar si tiene sub-categorías asociadas.' : ''
        }`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.facade.delete(categoria.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.snackBar.open('Categoría eliminada', 'OK', { duration: 3000 }),
      });
  }
}
