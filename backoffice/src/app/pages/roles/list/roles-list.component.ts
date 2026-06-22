import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { filter, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { RolesFacade, RolVM } from '@features/roles';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatChipsModule,
    MatSnackBarModule,
    PageHeaderComponent,
    SharedTableComponent,
    TableCellDirective,
    HasPermissionDirective,
  ],
  templateUrl: './roles-list.component.html',
  styleUrl: './roles-list.component.scss',
})
export class RolesListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly roles$ = this.facade.roles$;
  loading = true;

  columns: TableColumn<RolVM>[] = [
    { key: 'codigo',               label: 'Código',              width: '20%' },
    { key: 'descripcion',          label: 'Descripción',         width: '25%', hideOnMobile: true },
    { key: 'scopeTipo',            label: 'Scope',               width: '120px' },
    { key: 'asignable',           label: 'Asig. Org Admin',     width: '140px', hideOnMobile: true },
    { key: 'permisos',             label: 'Nº Permisos',         width: '110px', hideOnMobile: true },
    { key: 'acciones',             label: 'Acciones',            width: '80px' },
  ];

  constructor(
    private facade: RolesFacade,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    try {
      await firstValueFrom(this.facade.loadRoles());
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/roles/nuevo']);
  }

  onEdit(rol: RolVM): void {
    this.router.navigate(['/dashboard/roles/editar', rol.id]);
  }

  onDelete(rol: RolVM): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar rol',
        message: `¿Está seguro de eliminar el rol "${rol.codigo}"?`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(Boolean),
        switchMap(() => this.facade.delete(rol.id)),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Rol eliminado', 'OK', { duration: 3000 });
          this.cdr.markForCheck();
        },
      });
  }
}
