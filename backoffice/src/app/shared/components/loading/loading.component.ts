import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Loader genérico: spinner (por defecto, secciones/formularios) o skeleton
// (filas 56px con shimmer, para bloques tipo listado fuera de SharedTable,
// que ya trae su propio skeleton integrado).
@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingComponent {
  @Input() loading = false;
  @Input() message = '';
  @Input() diameter = 40;
  @Input() variant: 'spinner' | 'skeleton' = 'spinner';
  @Input() rows = 3;

  get rowsArray(): number[] {
    return Array.from({ length: this.rows });
  }
}
