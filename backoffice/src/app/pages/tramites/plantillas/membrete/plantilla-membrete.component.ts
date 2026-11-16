import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Membrete de una plantilla provincial: tile, título, estado y línea meta (slug · modalidad · categoría
 * principal). Lo comparten el detalle y el formulario (que lo arma en vivo con lo que se escribe).
 * El contenido proyectado va a la derecha: acciones del detalle o el indicador de modo del form.
 */
@Component({
  selector: 'app-plantilla-membrete',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plantilla-membrete.component.html',
  styleUrl: './plantilla-membrete.component.scss',
})
export class PlantillaMembreteComponent {
  /** Vacío: se muestra "Plantilla sin título", atenuado (form recién abierto). */
  @Input() titulo = '';
  /** Vacío: se muestra "sin-slug". */
  @Input() slug = '';
  @Input() activa = true;
  /** Nombre ya resuelto; vacío = "Sin modalidad". */
  @Input() modalidad = '';
  /** Nombre ya resuelto; vacío = "Sin categoría principal". */
  @Input() principal = '';
  /** Muestra el aviso de impacto cuando está desactivada (el detalle sí; el form tiene el suyo). */
  @Input() avisoDesactivada = false;
}
