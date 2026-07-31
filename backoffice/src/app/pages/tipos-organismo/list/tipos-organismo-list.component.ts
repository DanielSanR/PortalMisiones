import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
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
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { TiposOrganismoFacade, TipoOrganismoVM } from '@features/tipos-organismo';

@Component({
  selector: 'app-tipos-organismo-list',
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
  templateUrl: './tipos-organismo-list.component.html',
  styleUrls: ['./tipos-organismo-list.component.scss'],
})
export class TiposOrganismoListComponent implements OnInit {
  private readonly facade = inject(TiposOrganismoFacade);
  readonly tipos$ = this.facade.tipos$;
  loading = true;

  columns: TableColumn<TipoOrganismoVM>[] = [
    { key: 'nombre',      label: 'Nombre' },
    { key: 'descripcion', label: 'Descripción', hideOnMobile: true },
    { key: 'activo',      label: 'Activo', width: '90px' },
    { key: 'acciones',    label: 'Acciones', width: '80px' },
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
