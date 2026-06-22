import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, TitleCasePipe, KeyValuePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuditoriaTramite } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-auditoria-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TitleCasePipe, KeyValuePipe, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './auditoria-detail-dialog.component.html',
  styleUrl: './auditoria-detail-dialog.component.scss',
})
export class AuditoriaDetailDialogComponent {
  get accionIcon(): string {
    const icons: Record<string, string> = {
      crear: 'add_circle', editar: 'edit', publicar: 'publish',
      despublicar: 'unpublished', enviar_revision: 'rate_review', eliminar: 'delete',
    };
    return icons[this.data.accion] || 'info';
  }

  constructor(
    public dialogRef: MatDialogRef<AuditoriaDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AuditoriaTramite,
  ) {}
}
