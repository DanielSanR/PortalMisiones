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
import { OrganismoService } from '../../../core/services/organismo.service';
import { Organismo } from '../../../core/models/tramite.model';

@Component({
  selector: 'app-organismos-list',
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
  templateUrl: './organismos-list.component.html',
})
export class OrganismosListComponent implements OnInit {
  organismos: Organismo[] = [];
  loading = true;

  columns: TableColumn<Organismo>[] = [
    { key: 'nombre',   label: 'Nombre' },
    { key: 'sitioWeb', label: 'Sitio web', hideOnMobile: true },
    { key: 'acciones', label: 'Acciones', width: '80px' },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor(
    private organismoService: OrganismoService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadOrganismos();
  }

  loadOrganismos(): void {
    this.loading = true;
    this.organismoService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.organismos = response.data;
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
    this.router.navigate(['/dashboard/organismos/nuevo']);
  }

  onEdit(organismo: Organismo): void {
    this.router.navigate(['/dashboard/organismos/editar', organismo.id]);
  }

  onDelete(organismo: Organismo): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar organismo',
        message: `¿Está seguro de eliminar "${organismo.nombre}"?`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => this.organismoService.delete(organismo.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Organismo eliminado', 'OK', { duration: 3000 });
          this.loadOrganismos();
        },
      });
  }
}
