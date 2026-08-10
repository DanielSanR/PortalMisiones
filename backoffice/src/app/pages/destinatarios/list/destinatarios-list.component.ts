import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { filter, map, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { FilterTabsComponent } from '../../../shared/components/filter-tabs';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { todasOnlyTabs } from '@core/utils/list-filter.utils';
import { DestinatariosFacade, DestinatarioVM } from '@features/destinatarios';

@Component({
  selector: 'app-destinatarios-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatMenuModule,
    MatSnackBarModule,
    SharedTableComponent,
    TableCellDirective,
    FilterTabsComponent,
    HasPermissionDirective,
    PageActionsDirective,
  ],
  templateUrl: './destinatarios-list.component.html',
  styleUrls: ['./destinatarios-list.component.scss'],
})
export class DestinatariosListComponent implements OnInit {
  private readonly facade = inject(DestinatariosFacade);
  readonly destinatarios$ = this.facade.destinatarios$;
  loading = true;

  /** Sin campo real para filtrar (ver divergencias de la tarea): solo chip "Todas" + contador. */
  readonly filterTabs$ = this.destinatarios$.pipe(map((destinatarios) => todasOnlyTabs(destinatarios.length)));

  columns: TableColumn<DestinatarioVM>[] = [
    { key: 'nombre',   label: 'Nombre' },
    { key: 'acciones', label: 'Acciones', width: '80px' },
  ];

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
    this.facade.loadDestinatarios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        error: () => { this.loading = false; this.cdr.markForCheck(); },
      });
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/destinatarios/nuevo']);
  }

  onEdit(destinatario: DestinatarioVM): void {
    this.router.navigate(['/dashboard/destinatarios/editar', destinatario.id]);
  }

  onDelete(destinatario: DestinatarioVM): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar destinatario',
        message: `¿Está seguro de eliminar "${destinatario.nombre}"?`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.facade.delete(destinatario.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.snackBar.open('Destinatario eliminado', 'OK', { duration: 3000 }),
      });
  }
}
