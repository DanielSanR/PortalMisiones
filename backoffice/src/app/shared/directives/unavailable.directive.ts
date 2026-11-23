import { DestroyRef, Directive, ElementRef, HostBinding, HostListener, Input, booleanAttribute, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
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
 * se anulan para que no dispare nada (tampoco el `(click)` que el propio control tenga en su template) y,
 * en su lugar, MUESTRAN el motivo: en pantallas táctiles no hay
 * hover y el long-press no se descubre, así que el tap es la única forma de enterarse.
 *
 * Se ve deshabilitado con la clase global `.is-unavailable` (`_components.scss`).
 *
 * Si el motivo ya está escrito en pantalla y el host lo referencia con su propio `aria-describedby`, se
 * pasa `appUnavailableMotivoVisible`: no hay tooltip (no repite ni tapa el texto) y el lector no lo oye dos
 * veces (tooltip + descripción). El resto del comportamiento no cambia.
 *
 * **Alternar sobre el mismo elemento**: `[appUnavailable]="sinCambios ? 'No hay cambios para guardar' : false"`.
 * Con `false` o `null` el control está DISPONIBLE: sin `aria-disabled`, sin clase, sin tooltip, y el clic pasa.
 * Es la forma de bloquear y liberar un botón sin cambiarlo por otro nodo (`@if` / `@else` con dos `<button>`):
 * el nodo que tenía el foco se destruiría y el foco caería a `body` (WCAG 2.4.3). `''` y `undefined` siguen
 * siendo "no disponible, con el motivo por defecto" (es lo que entrega el atributo suelto `appUnavailable`).
 */
@Directive({
  selector: '[appUnavailable]',
  standalone: true,
  hostDirectives: [{ directive: MatTooltip }],
})
export class UnavailableDirective {
  private motivo = MOTIVO_NO_DISPONIBLE;
  private motivoEnPantalla = false;
  /** `false` / `null` en el input: el control funciona normalmente. */
  private disponible = false;

  constructor(private readonly tooltip: MatTooltip) {
    this.tooltip.message = MOTIVO_NO_DISPONIBLE;
    // El clic se escucha en fase de CAPTURA: un `@HostListener('click')` corre DESPUÉS del `(click)` que el
    // template le puso al mismo elemento, así que no llegaba a anularlo (solo evitaba la acción por defecto).
    // Capturando en el host, el `(click)` del propio control y el de sus hijos no se enteran.
    fromEvent<MouseEvent>(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement, 'click', { capture: true })
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((event) => this.bloquear(event));
  }

  /**
   * Motivo que se muestra en el tooltip; `''` o `undefined` = {@link MOTIVO_NO_DISPONIBLE}.
   * `false` o `null` = el control está disponible (la directiva no hace nada hasta que llegue un motivo).
   */
  @Input()
  set appUnavailable(motivo: string | false | null | undefined) {
    this.disponible = motivo === false || motivo === null;
    this.motivo = (typeof motivo === 'string' ? motivo.trim() : '') || MOTIVO_NO_DISPONIBLE;
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
    // Mensaje vacío: `MatTooltip` oculta el que estuviera abierto y lo saca de la descripción accesible.
    this.tooltip.message = this.disponible || this.motivoEnPantalla ? '' : this.motivo;
  }

  @HostBinding('attr.aria-disabled') get ariaDisabled(): 'true' | null {
    return this.disponible ? null : 'true';
  }

  @HostBinding('class.is-unavailable') get unavailableClass(): boolean {
    return !this.disponible;
  }

  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  bloquear(event: Event): void {
    if (this.disponible) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.tooltip.show();
  }
}
