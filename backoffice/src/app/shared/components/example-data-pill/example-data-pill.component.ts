import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

/**
 * Pill "Datos de ejemplo" — marca honesta de placeholder (HOME_REDISENO.md §3/§7, design-delta.md #1).
 * Obligatoria en cualquier widget que muestre datos que todavía no vienen de un backend real.
 *
 *   <app-example-data-pill></app-example-data-pill>
 *   <app-example-data-pill label="Vista de ejemplo"></app-example-data-pill>
 */
@Component({
  selector: 'app-example-data-pill',
  standalone: true,
  templateUrl: './example-data-pill.component.html',
  styleUrl: './example-data-pill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExampleDataPillComponent {
  @Input() label = 'Datos de ejemplo';
}
