import { Component, Inject } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuditoriaTramite } from '../../core/models/dashboard.model';

@Component({
  selector: 'app-auditoria-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, KeyValuePipe],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="title-icon">{{ accionIcon }}</mat-icon>
      Detalle de {{ data.accion | titlecase }}
    </h2>

    <mat-dialog-content>
      <div class="meta-row">
        <div class="meta-item">
          <span class="meta-label">Trámite</span>
          <span class="meta-value">{{ data.tramiteTitulo }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Usuario</span>
          <span class="meta-value">{{ data.usuarioNombre }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Fecha</span>
          <span class="meta-value">{{ data.fechaAccion | date:'dd/MM/yyyy HH:mm' }}</span>
        </div>
      </div>

      <div class="diff-container" *ngIf="data.datosAnteriores || data.datosNuevos">
        <div class="diff-panel diff-old" *ngIf="data.datosAnteriores">
          <h4><mat-icon>remove_circle_outline</mat-icon> Antes</h4>
          <div class="diff-content">
            <div *ngFor="let item of data.datosAnteriores | keyvalue" class="diff-row">
              <span class="diff-key">{{ item.key }}</span>
              <span class="diff-value diff-removed">{{ item.value }}</span>
            </div>
          </div>
        </div>

        <div class="diff-panel diff-new" *ngIf="data.datosNuevos">
          <h4><mat-icon>add_circle_outline</mat-icon> Después</h4>
          <div class="diff-content">
            <div *ngFor="let item of data.datosNuevos | keyvalue" class="diff-row">
              <span class="diff-key">{{ item.key }}</span>
              <span class="diff-value diff-added">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="no-diff" *ngIf="!data.datosAnteriores && !data.datosNuevos">
        <mat-icon>info_outline</mat-icon>
        <p>No se registraron cambios de datos para esta acción.</p>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .title-icon {
      vertical-align: middle;
      margin-right: 8px;
    }

    .meta-row {
      display: flex;
      gap: var(--theme-space-lg, 24px);
      margin-bottom: var(--theme-space-lg, 24px);
      flex-wrap: wrap;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .meta-label {
      font-size: var(--theme-font-size-xs, 12px);
      color: var(--theme-text-secondary, #666);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .meta-value {
      font-weight: var(--theme-font-weight-medium, 500);
    }

    .diff-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--theme-space-md, 16px);
    }

    .diff-panel {
      border-radius: var(--theme-radius-md, 8px);
      padding: var(--theme-space-md, 16px);
      overflow: auto;

      h4 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 12px;
        font-size: var(--theme-font-size-sm, 14px);
      }
    }

    .diff-old {
      background: #FFF3F3;
      border: 1px solid #FFCDD2;

      h4 { color: #C62828; }
    }

    .diff-new {
      background: #F1F8E9;
      border: 1px solid #C5E1A5;

      h4 { color: #2E7D32; }
    }

    .diff-row {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);

      &:last-child { border-bottom: none; }
    }

    .diff-key {
      font-size: var(--theme-font-size-xs, 12px);
      color: var(--theme-text-secondary, #666);
      font-family: monospace;
    }

    .diff-value {
      font-size: var(--theme-font-size-sm, 14px);
      word-break: break-word;
    }

    .diff-removed { color: #C62828; }
    .diff-added { color: #2E7D32; }

    .no-diff {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--theme-space-xl, 32px);
      color: var(--theme-text-secondary, #666);

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        opacity: 0.5;
        margin-bottom: 8px;
      }
    }
  `],
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
