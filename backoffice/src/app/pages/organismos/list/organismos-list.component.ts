import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LoadingComponent } from '../../../shared/components/loading/loading.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { OrganismoService } from '../../../core/services/organismo.service';
import { Organismo } from '../../../core/models/tramite.model';

@Component({
  selector: 'app-organismos-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSnackBarModule,
    PageHeaderComponent,
    LoadingComponent,
  ],
  templateUrl: './organismos-list.component.html',
  styleUrls: ['./organismos-list.component.scss'],
})
export class OrganismosListComponent implements OnInit {
  organismos: Organismo[] = [];
  loading = true;

  constructor(
    private organismoService: OrganismoService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadOrganismos();
  }

  loadOrganismos(): void {
    this.loading = true;
    this.organismoService.getAll().subscribe({
      next: (response) => {
        this.organismos = response.data;
        this.loading = false;
      },
      error: () => { this.loading = false; },
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

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.organismoService.delete(organismo.id).subscribe({
          next: () => {
            this.snackBar.open('Organismo eliminado', 'OK', { duration: 3000 });
            this.loadOrganismos();
          },
        });
      }
    });
  }
}
