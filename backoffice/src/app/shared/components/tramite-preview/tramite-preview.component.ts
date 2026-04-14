import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Tramite, TramiteContenidoLocalidad } from '../../../core/models/tramite.model';
import { TramiteService } from '../../../core/services/tramite.service';

@Component({
  selector: 'app-tramite-preview',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatExpansionModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  templateUrl: './tramite-preview.component.html',
  styleUrls: ['./tramite-preview.component.scss'],
})
export class TramitePreviewComponent implements OnInit {
  viewMode: 'desktop' | 'mobile' = 'desktop';
  contenidoLocalidades: TramiteContenidoLocalidad[] = [];
  selectedLocalidadId: number | null = null;
  contenidoActual: TramiteContenidoLocalidad | null = null;

  constructor(
    public dialogRef: MatDialogRef<TramitePreviewComponent>,
    @Inject(MAT_DIALOG_DATA) public tramite: Tramite,
    private tramiteService: TramiteService,
  ) {}

  ngOnInit(): void {
    this.tramiteService.getContenidoLocalidades(this.tramite.id).subscribe({
      next: (data) => {
        this.contenidoLocalidades = data;
        if (data.length > 0) {
          this.selectedLocalidadId = data[0].localidadId;
          this.contenidoActual = data[0];
        }
      },
    });
  }

  onLocalidadChange(localidadId: number): void {
    this.selectedLocalidadId = localidadId;
    this.contenidoActual = this.contenidoLocalidades.find(c => c.localidadId === localidadId) || null;
  }

  /** Resuelve un campo con fallback: override local > base provincial */
  resolve(campo: 'costos' | 'contacto' | 'sitioWeb' | 'horarios'): string | null {
    if (this.contenidoActual) {
      const override = this.contenidoActual[campo];
      if (override) return override;
    }
    // Fallback a valor provincial
    if (campo === 'costos') return this.tramite.costos;
    if (campo === 'contacto') return this.tramite.contacto;
    if (campo === 'sitioWeb') return this.tramite.sitioWebTramite;
    return null;
  }

  get destinatarioNames(): string {
    return this.tramite.destinatarios?.map(d => d.nombre).join(', ') || 'Ciudadanos';
  }

  get urlTramiteResuelto(): string {
    return this.contenidoActual?.urlTramite || this.tramite.urlOficial;
  }
}
