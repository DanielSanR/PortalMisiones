import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, filter, map, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { FilterTabsComponent } from '../../../shared/components/filter-tabs';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { PageActionsDirective } from '../../../shared/directives/page-actions.directive';
import { ActivoFiltro, activoFilterTabs, filterByActivo } from '@core/utils/list-filter.utils';
import { TiposOrganismoFacade, TipoOrganismoVM } from '@features/tipos-organismo';

@Component({
  selector: 'app-tipos-organismo-list',
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
    HasPermissionDirective,
    PageActionsDirective,
  ],
  templateUrl: './tipos-organismo-list.component.html',
  styleUrls: ['./tipos-organismo-list.component.scss'],
})
export class TiposOrganismoListComponent implements OnInit {
  private readonly facade = inject(TiposOrganismoFacade);
  readonly tipos$ = this.facade.tipos$;
  loading = true;

  /** Filtro "Todos/Activos/Inactivos" (campo real `activo`), client-side sobre el stream ya cargado. */
  readonly filtro$ = new BehaviorSubject<ActivoFiltro>('todos');
  readonly filterTabs$ = this.tipos$.pipe(map((tipos) => activoFilterTabs(tipos)));
  readonly tiposFiltrados$ = combineLatest([this.tipos$, this.filtro$]).pipe(
    map(([tipos, filtro]) => filterByActivo(tipos, filtro)),
  );

  columns: TableColumn<TipoOrganismoVM>[] = [
    { key: 'nombre',      label: 'Nombre' },
    { key: 'descripcion', label: 'Descripción', hideOnMobile: true },
    { key: 'activo',      label: 'Activo', width: '110px' },
    { key: 'acciones',    label: 'Acciones', width: '140px' },
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
    this.facade.loadTipos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        error: () => { this.loading = false; this.cdr.markForCheck(); },
      });
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/tipos-organismo/nuevo']);
  }

  onEdit(tipo: TipoOrganismoVM): void {
    this.router.navigate(['/dashboard/tipos-organismo/editar', tipo.id]);
  }

  onDelete(tipo: TipoOrganismoVM): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar tipo de organismo',
        message: `¿Está seguro de eliminar "${tipo.nombre}"? No se puede desactivar si tiene organismos activos asociados.`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.facade.delete(tipo.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.snackBar.open('Tipo eliminado', 'OK', { duration: 3000 }),
      });
  }
}
