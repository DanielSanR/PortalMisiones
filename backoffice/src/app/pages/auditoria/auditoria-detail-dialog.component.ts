import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, LowerCasePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AuditoriaRegistroVM } from '@features/auditoria';
import { AccionLabelPipe } from './accion-label.pipe';
import { CampoAuditoria, camposDeAuditoria } from './auditoria-campos';

@Component({
  selector: 'app-auditoria-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LowerCasePipe, MatDialogModule, MatButtonModule, AccionLabelPipe],
  templateUrl: './auditoria-detail-dialog.component.html',
  styleUrl: './auditoria-detail-dialog.component.scss',
})
export class AuditoriaDetailDialogComponent {
  /** Datos antes / después con etiquetas legibles (vacíos si el registro no guardó ese lado). */
  readonly antes: CampoAuditoria[];
  readonly despues: CampoAuditoria[];

  constructor(
    public dialogRef: MatDialogRef<AuditoriaDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AuditoriaRegistroVM,
  ) {
    this.antes = camposDeAuditoria(data.datosAnteriores);
    this.despues = camposDeAuditoria(data.datosNuevos);
  }
}
