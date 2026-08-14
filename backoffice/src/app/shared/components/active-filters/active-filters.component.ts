import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgFor } from '@angular/common';

/** Un filtro aplicado, tal como se muestra en la barra "Filtros activos". */
export interface FiltroActivo {
  /** Identifica qué filtro quitar; lo interpreta la pantalla que lo emitió. */
  clave: string;
  etiqueta: string;
}

/**
 * Barra "Filtros activos": qué está filtrando ahora y cómo sacárselo de encima.
 *
 * Cubre los pasos 4 y 5 de `flows/filtering-items` — mostrar los filtros aplicados
 * y permitir quitarlos de a uno o todos juntos. Va fuera del well del toolbar,
 * pegada arriba de la tabla, para que se lea como consecuencia de lo elegido y no
 * como un control más.
 *
 * No se dibuja sola cuando no hay filtros: la pantalla la envuelve en su propio
 * `@if`, porque el margen inferior no debe existir si la barra no existe.
 */
@Component({
  selector: 'app-active-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgFor],
  templateUrl: './active-filters.component.html',
  styleUrls: ['./active-filters.component.scss'],
})
export class ActiveFiltersComponent {
  @Input({ required: true }) filtros: FiltroActivo[] = [];
  @Output() quitar = new EventEmitter<string>();
  @Output() limpiar = new EventEmitter<void>();

  trackByClave(_index: number, filtro: FiltroActivo): string {
    return filtro.clave;
  }
}
