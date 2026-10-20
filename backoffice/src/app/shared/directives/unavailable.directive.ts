import { Directive, HostBinding, HostListener, Input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

/** Motivo por defecto cuando la pantalla no da uno más específico. */
export const MOTIVO_NO_DISPONIBLE = 'Disponible próximamente';

/**
 * Marca un control como "todavía no disponible" (feature sin backend: Ordenar, Exportar, Más filtros,
 * CTA del Home, "Ver en el portal"…) SIN usar `disabled` nativo.
 *
 *   <button type="button" class="list-iconbtn" appUnavailable aria-label="Exportar a CSV">…</button>
 *   <button mat-stroked-button appUnavailable="Se habilita cuando exista el endpoint de exportación">…</button>
 *
 * Por qué no `disabled`: un botón deshabilitado sale del orden de tabulación, el lector de pantalla no
 * lo descubre y `matTooltip` no se dispara sobre él, así que nadie se entera del motivo. Acá el control
 * sigue siendo focusable, se anuncia como no disponible (`aria-disabled`), muestra el motivo en un
 * tooltip (hover y foco) y se lo cablea a `aria-describedby` vía MatTooltip; el click y Enter/Espacio
 * se anulan para que no dispare nada y, en su lugar, MUESTRAN el motivo: en pantallas táctiles no hay
 * hover y el long-press no se descubre, así que el tap es la única forma de enterarse.
 *
 * Se ve deshabilitado con la clase global `.is-unavailable` (`_components.scss`).
 */
@Directive({
  selector: '[appUnavailable]',
  standalone: true,
  hostDirectives: [{ directive: MatTooltip }],
})
export class UnavailableDirective {
  constructor(private readonly tooltip: MatTooltip) {
    this.tooltip.message = MOTIVO_NO_DISPONIBLE;
  }

  /** Motivo que se muestra en el tooltip; vacío = {@link MOTIVO_NO_DISPONIBLE}. */
  @Input()
  set appUnavailable(motivo: string | null | undefined) {
    this.tooltip.message = motivo?.trim() || MOTIVO_NO_DISPONIBLE;
  }

  @HostBinding('attr.aria-disabled') readonly ariaDisabled = 'true';
  @HostBinding('class.is-unavailable') readonly unavailableClass = true;

  @HostListener('click', ['$event'])
  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  bloquear(event: Event): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    this.tooltip.show();
  }
}
