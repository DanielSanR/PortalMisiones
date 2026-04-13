import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { ModalidadService } from '../../../core/services/modalidad.service';
import { Modalidad } from '../../../core/models/tramite.model';

@Component({
  selector: 'app-modalidades-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSnackBarModule,
    PageHeaderComponent,
    SharedTableComponent,
    TableCellDirective,
  ],
  templateUrl: './modalidades-list.component.html',
  styleUrls: ['./modalidades-list.component.scss'],
})
export class ModalidadesListComponent implements OnInit {
  modalidades: Modalidad[] = [];
  loading = true;

  columns: TableColumn<Modalidad>[] = [
    { key: 'color',        label: '',            width: '48px' },
    { key: 'nombre',       label: 'Nombre' },
    { key: 'descripcion',  label: 'Descripción', hideOnMobile: true },
    { key: 'tramitesCount', label: 'Trámites',   width: '100px' },
    { key: 'acciones',     label: 'Acciones',    width: '80px' },
  ];

  constructor(
    private modalidadService: ModalidadService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadModalidades();
  }

  loadModalidades(): void {
    this.loading = true;
    this.modalidadService.getAll().subscribe({
      next: (response) => {
        this.modalidades = response.data;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/modalidades/nuevo']);
  }

  onEdit(modalidad: Modalidad): void {
    this.router.navigate(['/dashboard/modalidades/editar', modalidad.id]);
  }

  onDelete(modalidad: Modalidad): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar modalidad',
        message: `¿Está seguro de eliminar "${modalidad.nombre}"?${
          modalidad.tramitesCount
            ? ` Esta modalidad está asociada a ${modalidad.tramitesCount} trámite(s).`
            : ''
        }`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.modalidadService.delete(modalidad.id).subscribe({
          next: () => {
            this.snackBar.open('Modalidad eliminada', 'OK', { duration: 3000 });
            this.loadModalidades();
          },
        });
      }
    });
  }
}
