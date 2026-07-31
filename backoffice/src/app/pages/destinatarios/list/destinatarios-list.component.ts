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
import { DestinatariosFacade, DestinatarioVM } from '@features/destinatarios';

@Component({
  selector: 'app-destinatarios-list',
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
  templateUrl: './destinatarios-list.component.html',
  styleUrls: ['./destinatarios-list.component.scss'],
})
export class DestinatariosListComponent implements OnInit {
  private readonly facade = inject(DestinatariosFacade);
  readonly destinatarios$ = this.facade.destinatarios$;
  loading = true;

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
