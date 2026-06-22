import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { filter, switchMap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { EtiquetasFacade, EtiquetaVM } from '@features/etiquetas';

@Component({
  selector: 'app-etiquetas-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSnackBarModule,
    PageHeaderComponent,
    SharedTableComponent,
    TableCellDirective,
    HasPermissionDirective,
  ],
  templateUrl: './etiquetas-list.component.html',
  styleUrls: ['./etiquetas-list.component.scss'],
})
export class EtiquetasListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly etiquetas$ = this.facade.etiquetas$;
  loading = true;

  columns: TableColumn<EtiquetaVM>[] = [
    { key: 'nombre',        label: 'Nombre' },
    { key: 'tramitesCount', label: 'Trámites', width: '100px' },
    { key: 'acciones',      label: 'Acciones', width: '80px' },
  ];

  constructor(
    private facade: EtiquetasFacade,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      await firstValueFrom(this.facade.loadEtiquetas());
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/etiquetas/nuevo']);
  }

  onEdit(etiqueta: EtiquetaVM): void {
    this.router.navigate(['/dashboard/etiquetas/editar', etiqueta.id]);
  }

  onDelete(etiqueta: EtiquetaVM): void {
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
        takeUntilDestroyed(this.destroyRef),
        filter(Boolean),
        switchMap(() => this.facade.delete(etiqueta.id)),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Etiqueta eliminada', 'OK', { duration: 3000 });
          this.cdr.markForCheck();
        },
      });
  }
}
