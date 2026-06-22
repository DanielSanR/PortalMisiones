import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { filter, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PermisosFacade, PermisoVM } from '@features/permisos';

@Component({
  selector: 'app-permisos-list',
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
  ],
  templateUrl: './permisos-list.component.html',
  styleUrl: './permisos-list.component.scss',
})
export class PermisosListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly permisos$ = this.facade.permisos$;
  loading = true;

  columns: TableColumn<PermisoVM>[] = [
    { key: 'codigo',      label: 'Código',      width: '30%' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'acciones',    label: 'Acciones',    width: '80px' },
  ];

  constructor(
    private facade: PermisosFacade,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      await firstValueFrom(this.facade.loadPermisos());
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/permisos/nuevo']);
  }

  onEdit(permiso: PermisoVM): void {
    this.router.navigate(['/dashboard/permisos/editar', permiso.id]);
  }

  onDelete(permiso: PermisoVM): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar permiso',
        message: `¿Está seguro de eliminar el permiso "${permiso.codigo}"?`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(Boolean),
        switchMap(() => this.facade.delete(permiso.id)),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Permiso eliminado', 'OK', { duration: 3000 });
          this.cdr.markForCheck();
        },
      });
  }
}
