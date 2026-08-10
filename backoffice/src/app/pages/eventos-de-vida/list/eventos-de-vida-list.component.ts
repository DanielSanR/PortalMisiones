import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { filter, map, switchMap } from 'rxjs';
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
import { todasOnlyTabs } from '@core/utils/list-filter.utils';
import { EventosDeVidaFacade, EventoDeVidaVM } from '@features/eventos-de-vida';

@Component({
  selector: 'app-eventos-de-vida-list',
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
  templateUrl: './eventos-de-vida-list.component.html',
  styleUrls: ['./eventos-de-vida-list.component.scss'],
})
export class EventosDeVidaListComponent implements OnInit {
  private readonly facade = inject(EventosDeVidaFacade);
  readonly eventos$ = this.facade.eventos$;
  loading = true;

  /** Sin campo real para filtrar (ver divergencias de la tarea): solo chip "Todas" + contador. */
  readonly filterTabs$ = this.eventos$.pipe(map((eventos) => todasOnlyTabs(eventos.length)));

  columns: TableColumn<EventoDeVidaVM>[] = [
    { key: 'nombre',   label: 'Evento de Vida' },
    { key: 'slug',     label: 'Slug', hideOnMobile: true },
    { key: 'acciones', label: 'Acciones', width: '140px' },
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
    this.facade.loadEventos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        error: () => { this.loading = false; this.cdr.markForCheck(); },
      });
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/eventos-de-vida/nuevo']);
  }

  onEdit(evento: EventoDeVidaVM): void {
    this.router.navigate(['/dashboard/eventos-de-vida/editar', evento.id]);
  }

  onDelete(evento: EventoDeVidaVM): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar evento de vida',
        message: `¿Está seguro de eliminar "${evento.nombre}"?`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.facade.delete(evento.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.snackBar.open('Evento eliminado', 'OK', { duration: 3000 }),
      });
  }
}
