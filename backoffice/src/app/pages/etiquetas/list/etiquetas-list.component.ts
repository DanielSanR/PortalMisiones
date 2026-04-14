import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { filter, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { EtiquetaService } from '../../../core/services/etiqueta.service';
import { Etiqueta } from '../../../core/models/tramite.model';

@Component({
  selector: 'app-etiquetas-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSnackBarModule,
    PageHeaderComponent,
    SharedTableComponent,
    TableCellDirective,
  ],
  templateUrl: './etiquetas-list.component.html',
  styleUrls: ['./etiquetas-list.component.scss'],
})
export class EtiquetasListComponent implements OnInit {
  etiquetas: Etiqueta[] = [];
  loading = true;

  columns: TableColumn<Etiqueta>[] = [

    { key: 'nombre',       label: 'Nombre' },
    { key: 'tramitesCount', label: 'Trámites',   width: '100px' },
    { key: 'acciones',     label: 'Acciones',    width: '80px' },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private etiquetaService: EtiquetaService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadEtiquetas();
  }

  loadEtiquetas(): void {
    this.loading = true;
    this.etiquetaService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.etiquetas = response.data;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/etiquetas/nuevo']);
  }

  onEdit(etiqueta: Etiqueta): void {
    this.router.navigate(['/dashboard/etiquetas/editar', etiqueta.id]);
  }

  onDelete(etiqueta: Etiqueta): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar etiqueta',
        message: `¿Está seguro de eliminar "${etiqueta.nombre}"?${
          etiqueta.tramitesCount
            ? ` Esta etiqueta está asociada a ${etiqueta.tramitesCount} trámite(s).`
            : ''
        }`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.etiquetaService.delete(etiqueta.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Etiqueta eliminada', 'OK', { duration: 3000 });
          this.loadEtiquetas();
        },
      });
  }
}
