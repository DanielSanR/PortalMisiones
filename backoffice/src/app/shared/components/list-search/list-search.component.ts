import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

/**
 * Caja de búsqueda de los listados, según la fila A del toolbar del diseño
 * (pantalla LISTA).
 *
 * NO es un `mat-form-field`: el diseño especifica una caja plana de 34px con
 * ícono y placeholder, sin label flotante ni subscript — que son justamente los
 * que descentraban la fila cuando se intentó con Material.
 *
 * El estado vive en el `FormControl` que le pasa la pantalla, así el debounce y
 * el stream de búsqueda quedan donde están los datos.
 */
@Component({
  selector: 'app-list-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './list-search.component.html',
  styleUrls: ['./list-search.component.scss'],
})
export class ListSearchComponent {
  @Input({ required: true }) control!: FormControl<string>;
  @Input() placeholder = 'Buscar…';
  /** Qué campos busca de verdad; el placeholder no alcanza para un lector de pantalla. */
  @Input({ required: true }) ariaLabel!: string;
}
