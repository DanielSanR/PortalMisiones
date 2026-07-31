import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { filter, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { CategoriasFacade, CategoriaVM } from '@features/categorias';

@Component({
  selector: 'app-categorias-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
    HasPermissionDirective,
  ],
  templateUrl: './categorias-list.component.html',
  styleUrls: ['./categorias-list.component.scss'],
})
export class CategoriasListComponent implements OnInit {
  private readonly facade = inject(CategoriasFacade);
  readonly arbol$ = this.facade.arbol$;
  loading = true;

  /** Ids expandidos. Por defecto todo COLAPSADO (solo raíces visibles). */
  private readonly expanded = new Set<string>();

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
