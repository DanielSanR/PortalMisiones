import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CategoriaService } from '../../../core/services/categoria.service';
import { Categoria } from '../../../core/models/tramite.model';

@Component({
  selector: 'app-categorias-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatExpansionModule,
    MatChipsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './categorias-list.component.html',
  styleUrls: ['./categorias-list.component.scss'],
})
export class CategoriasListComponent implements OnInit {
  categorias: Categoria[] = [];
  loading = true;

  constructor(
    private categoriaService: CategoriaService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadCategorias();
  }

  loadCategorias(): void {
    this.loading = true;
    this.categoriaService.getAll().subscribe({
      next: (response) => {
        this.categorias = response.data;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onCreate(parentId?: number): void {
    if (parentId) {
      this.router.navigate(['/dashboard/categorias/nuevo'], { queryParams: { parentId } });
    } else {
      this.router.navigate(['/dashboard/categorias/nuevo']);
    }
  }

  onEdit(categoria: Categoria): void {
    this.router.navigate(['/dashboard/categorias/editar', categoria.id]);
  }

  onDelete(categoria: Categoria): void {
    const hasChildren = categoria.children && categoria.children.length > 0;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar categoría',
        message: `¿Está seguro de eliminar "${categoria.nombre}"?${
          hasChildren ? ' Se eliminarán también todas las sub-categorías.' : ''
        }${
          categoria.tramitesCount
            ? ` Tiene ${categoria.tramitesCount} trámite(s) asociados.`
            : ''
        }`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.categoriaService.delete(categoria.id).subscribe({
          next: () => {
            this.snackBar.open('Categoría eliminada', 'OK', { duration: 3000 });
            this.loadCategorias();
          },
        });
      }
    });
  }
}
