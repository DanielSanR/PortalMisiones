import { Directive, HostBinding, HostListener, Input, booleanAttribute } from '@angular/core';
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
 *
 * Si el motivo ya está escrito en pantalla y el host lo referencia con su propio `aria-describedby`, se
 * pasa `appUnavailableMotivoVisible`: no hay tooltip (no repite ni tapa el texto) y el lector no lo oye dos
 * veces (tooltip + descripción). El resto del comportamiento no cambia.
 */
@Directive({
  selector: '[appUnavailable]',
  standalone: true,
  hostDirectives: [{ directive: MatTooltip }],
})
export class UnavailableDirective {
  private motivo = MOTIVO_NO_DISPONIBLE;
  private motivoEnPantalla = false;

  constructor(private readonly tooltip: MatTooltip) {
    this.tooltip.message = MOTIVO_NO_DISPONIBLE;
  }

  /** Motivo que se muestra en el tooltip; vacío = {@link MOTIVO_NO_DISPONIBLE}. */
  @Input()
  set appUnavailable(motivo: string | null | undefined) {
    this.motivo = motivo?.trim() || MOTIVO_NO_DISPONIBLE;
    this.sincronizarMensaje();
  }

  /**
   * El motivo ya está visible en la página y el host lo referencia con su `aria-describedby`: sin tooltip.
   * Un mensaje vacío en `MatTooltip` ni se muestra ni se suma a la descripción accesible del host.
   */
  @Input({ transform: booleanAttribute })
  set appUnavailableMotivoVisible(valor: boolean) {
    this.motivoEnPantalla = valor;
    this.sincronizarMensaje();
  }

  private sincronizarMensaje(): void {
    this.tooltip.message = this.motivoEnPantalla ? '' : this.motivo;
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
