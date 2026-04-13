import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SharedTableComponent, TableCellDirective, TableColumn } from '../../../shared/components/table';
import { EventoDeVidaService } from '../../../core/services/evento-de-vida.service';
import { EventoDeVida } from '../../../core/models/tramite.model';

@Component({
  selector: 'app-eventos-de-vida-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    PageHeaderComponent,
    SharedTableComponent,
    TableCellDirective,
  ],
  templateUrl: './eventos-de-vida-list.component.html',
  styleUrls: ['./eventos-de-vida-list.component.scss'],
})
export class EventosDeVidaListComponent implements OnInit {
  eventos: EventoDeVida[] = [];
  loading = true;

  columns: TableColumn<EventoDeVida>[] = [
    { key: 'icono',        label: '',             width: '56px' },
    { key: 'nombre',       label: 'Evento de Vida' },
    { key: 'descripcion',  label: 'Descripción',  hideOnMobile: true },
    { key: 'tramitesCount', label: 'Trámites',    width: '90px' },
    { key: 'activo',       label: 'Activo',       width: '80px' },
    { key: 'acciones',     label: 'Acciones',     width: '60px' },
  ];

  constructor(
    private eventoService: EventoDeVidaService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.eventoService.getAll().subscribe({
      next: (response) => {
        this.eventos = response.data;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onCreate(): void {
    this.router.navigate(['/dashboard/eventos-de-vida/nuevo']);
  }

  onEdit(evento: EventoDeVida): void {
    this.router.navigate(['/dashboard/eventos-de-vida/editar', evento.id]);
  }

  onToggleActive(evento: EventoDeVida): void {
    this.eventoService.toggleActive(evento.id).subscribe({
      next: (updated) => {
        const idx = this.eventos.findIndex(e => e.id === updated.id);
        if (idx >= 0) this.eventos[idx] = updated;
        this.snackBar.open(
          updated.activo ? 'Evento activado' : 'Evento desactivado',
          'OK', { duration: 3000 },
        );
      },
    });
  }

  onDelete(evento: EventoDeVida): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar evento de vida',
        message: `¿Está seguro de eliminar "${evento.nombre}"?${
          evento.tramitesCount
            ? ` Este evento agrupa ${evento.tramitesCount} trámite(s).`
            : ''
        }`,
        confirmText: 'Eliminar',
      },
      panelClass: 'custom-modal-panel',
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.eventoService.delete(evento.id).subscribe({
          next: () => {
            this.snackBar.open('Evento eliminado', 'OK', { duration: 3000 });
            this.load();
          },
        });
      }
    });
  }
}
