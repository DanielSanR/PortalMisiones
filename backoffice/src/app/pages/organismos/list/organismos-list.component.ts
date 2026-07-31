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
import { OrganismosFacade, OrganismoVM } from '@features/organismos';

@Component({
  selector: 'app-organismos-list',
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
  templateUrl: './organismos-list.component.html',
  styleUrls: ['./organismos-list.component.scss'],
})
export class OrganismosListComponent implements OnInit {
  private readonly facade = inject(OrganismosFacade);
  readonly organismos$ = this.facade.organismos$;
  loading = true;

  columns: TableColumn<OrganismoVM>[] = [
    { key: 'nombre',     label: 'Nombre' },
    { key: 'acronym',    label: 'Acrónimo', width: '120px' },
    { key: 'tipoNombre', label: 'Tipo', hideOnMobile: true },
    { key: 'activo',     label: 'Activo', width: '90px' },
    { key: 'acciones',   label: 'Acciones', width: '80px' },
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
    this.facade.loadOrganismos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => { this.loading = false; this.cdr.markForCheck(); },
        error: () => { this.loading = false; this.cdr.markForCheck(); },
      });
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/organismos/nuevo']);
  }

  onEdit(organismo: OrganismoVM): void {
    this.router.navigate(['/dashboard/organismos/editar', organismo.id]);
  }

  onDelete(organismo: OrganismoVM): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar organismo',
        message: `¿Está seguro de eliminar "${organismo.nombre}"? No se puede eliminar si tiene organismos hijos activos.`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.facade.delete(organismo.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.snackBar.open('Organismo eliminado', 'OK', { duration: 3000 }),
      });
  }
}
