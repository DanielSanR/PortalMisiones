import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, EventEmitter, Input, NgZone, Output, PLATFORM_ID, inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fromEvent } from 'rxjs';

/** Aire entre el campo enfocado y el pie pegado (deja ver entero el anillo de foco). */
const MARGEN_FOCO_PX = 12;

/** El ancestro que desplaza verticalmente a `elemento` (el contenido del shell, o la página). */
function contenedorConScroll(elemento: HTMLElement): HTMLElement | null {
  const vista = elemento.ownerDocument.defaultView;
  for (let actual = elemento.parentElement; actual; actual = actual.parentElement) {
    const desborde = vista?.getComputedStyle(actual).overflowY;
    if ((desborde === 'auto' || desborde === 'scroll') && actual.scrollHeight > actual.clientHeight) return actual;
  }
  const raiz = elemento.ownerDocument.scrollingElement;
  return raiz instanceof HTMLElement ? raiz : null;
}

/**
 * Barra de acciones al pie de un formulario (patrón FORM): ayuda a la izquierda, "Cancelar" y el
 * botón de envío (plano, como en los diálogos) a la derecha. Va DENTRO del `<form>` de quien la usa: el botón es `type="submit"`,
 * así que dispara el `(ngSubmit)` de ese formulario (el envío es del DOM, no del componente).
 *
 * `sinCambios` bloquea el envío de una edición sin cambios y lo explica en un tooltip. El tooltip
 * no puede colgar de un `disabled` nativo (no recibe foco ni hover): va en un envoltorio que solo
 * es focusable mientras el botón está bloqueado por ese motivo.
 *
 * Contenido proyectado con el atributo `formActionsInfo` (p. ej. un indicador): va a la izquierda,
 * antes de la ayuda, y a diferencia de ésta se conserva en mobile.
 *
 * Presentacional puro: no conoce el `FormGroup`. Los estilos de `.form-actions*` son globales
 * (`shared-styles/_components.scss`).
 */
@Component({
  selector: 'app-form-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatTooltipModule],
  templateUrl: './form-actions.component.html',
  styleUrl: './form-actions.component.scss',
})
export class FormActionsComponent {
  @Input() helpText = '';
  @Input() cancelText = 'Cancelar';
  @Input() submitText = 'Guardar';
  /** Texto del botón mientras `saving`: se conserva junto al spinner para que no pierda su nombre accesible. */
  @Input() savingText = 'Guardando…';
  @Input() saving = false;
  /** Edición sin nada que guardar: el botón queda deshabilitado, con el motivo en el tooltip. */
  @Input() sinCambios = false;
  /**
   * Pie de una tarjeta sin padding propio: deja de ser sticky y de sangrar con margen negativo, y toma
   * el fondo y las esquinas de la tarjeta. Sin esto es la barra flotante de siempre.
   */
  @Input() integrada = false;

  @Output() cancelar = new EventEmitter<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const destroyRef = inject(DestroyRef);
    // Fuera de la zona: mirar dónde quedó el foco no cambia nada de la vista.
    inject(NgZone).runOutsideAngular(() => {
      fromEvent<FocusEvent>(this.document, 'focusin')
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe((evento) => this.despejarFoco(evento.target));
    });
  }

  /**
   * El pie integrado va pegado abajo de la ventana: un campo del mismo formulario que recibe el foco puede
   * quedar detrás (WCAG 2.4.11, foco no tapado). `scroll-padding` no alcanza —el navegador no desplaza lo
   * que ya considera visible, y el pie cambia de alto según el ancho—, así que se desplaza lo justo.
   */
  private despejarFoco(destino: EventTarget | null): void {
    if (!this.integrada || !(destino instanceof HTMLElement)) return;
    const pie = this.host.firstElementChild;
    if (!(pie instanceof HTMLElement) || pie.contains(destino)) return;
    const form = pie.closest('form');
    if (form && !form.contains(destino)) return;

    // Después del desplazamiento propio del navegador al enfocar.
    this.document.defaultView?.requestAnimationFrame(() => {
      if (!destino.isConnected) return;
      const cajaPie = pie.getBoundingClientRect();
      const caja = destino.getBoundingClientRect();
      const tapado = caja.bottom + MARGEN_FOCO_PX - cajaPie.top;
      if (tapado <= 0 || caja.top >= cajaPie.bottom) return;
      const contenedor = contenedorConScroll(pie);
      if (!contenedor) return;
      // Sin sacar por arriba el comienzo de un campo más alto que el espacio libre.
      const techo = contenedor.getBoundingClientRect().top;
      contenedor.scrollBy({ top: Math.min(tapado, Math.max(caja.top - techo, 0)) });
    });
  }

  /** El bloqueo que explica el tooltip: sin cambios y sin un guardado en curso. */
  get bloqueadoSinCambios(): boolean {
    return this.sinCambios && !this.saving;
  }
}
