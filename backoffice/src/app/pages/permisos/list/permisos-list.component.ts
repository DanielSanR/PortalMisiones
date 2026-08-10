import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { filter, firstValueFrom, map, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { FilterTabsComponent } from '../../../shared/components/filter-tabs';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { todasOnlyTabs } from '@core/utils/list-filter.utils';
import { PermisosFacade, PermisoVM } from '@features/permisos';

@Component({
  selector: 'app-permisos-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    PageActionsDirective,
  ],
  templateUrl: './permisos-list.component.html',
  styleUrl: './permisos-list.component.scss',
})
export class PermisosListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly permisos$ = this.facade.permisos$;
  loading = true;

  /** Sin campo real para filtrar (ver divergencias de la tarea): solo chip "Todas" + contador. */
  readonly filterTabs$ = this.permisos$.pipe(map((permisos) => todasOnlyTabs(permisos.length)));

  columns: TableColumn<PermisoVM>[] = [
    { key: 'codigo',      label: 'Código',      width: '30%' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'acciones',    label: 'Acciones',    width: '140px' },
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
