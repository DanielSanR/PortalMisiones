import { ChangeDetectionStrategy, Component, HostBinding, Input, inject } from '@angular/core';
import { UnavailableDirective } from '@shared/directives/unavailable.directive';

/** Funciones del toolbar de una lista que el diseño dibuja y todavía no tienen backend. */
export type FuncionPendiente = 'ordenar' | 'exportar' | 'mas-filtros';

interface Presentacion {
  /** Clase global del botón (`_components.scss`). */
  clase: 'list-iconbtn' | 'list-ghost-button';
  /** `aria-label` de un botón de solo ícono; `null` si el botón ya tiene texto. */
  etiqueta: string | null;
  /** Por qué no está disponible (tooltip de `appUnavailable`). */
  motivo: string;
}

const FUNCIONES: Record<FuncionPendiente, Presentacion> = {
  ordenar: {
    clase: 'list-iconbtn',
    etiqueta: 'Ordenar',
    motivo: 'Usá los encabezados de la tabla para ordenar; el orden avanzado todavía no está disponible',
  },
  exportar: {
    clase: 'list-iconbtn',
    etiqueta: 'Exportar a CSV',
    motivo: 'La exportación a CSV se habilita cuando el backend ofrezca el endpoint',
  },
  'mas-filtros': {
    clase: 'list-ghost-button',
    etiqueta: null,
    motivo: 'Se habilita cuando haya más campos por los que filtrar',
  },
};

/**
 * Botón del toolbar de una lista para una función sin backend ("Ordenar", "Exportar a CSV", "Más filtros"):
 * visible, con `appUnavailable` (focusable, `aria-disabled`, motivo en tooltip), nunca oculto. Un solo
 * lugar para el ícono, el rótulo y el motivo, que antes se copiaban en cada lista.
 *
 *   <div class="list-toolbar__actions">
 *     <span class="list-toolbar__count" aria-live="polite">{{ vista.total }} etiquetas</span>
 *     <button type="button" appListaPendiente="ordenar"></button>
 *     <button type="button" appListaPendiente="exportar"></button>
 *   </div>
 *
 * Es un componente sobre el propio `<button>` (no un elemento que lo envuelva) para no meter un nodo
 * entre `.list-toolbar__actions` y sus botones.
 */
@Component({
  selector: 'button[appListaPendiente]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [UnavailableDirective],
  templateUrl: './lista-pendiente.component.html',
  styleUrl: './lista-pendiente.component.scss',
})
export class ListaPendienteComponent {
  private readonly unavailable = inject(UnavailableDirective, { self: true });

  funcion: FuncionPendiente = 'exportar';

  @Input({ required: true })
  set appListaPendiente(funcion: FuncionPendiente) {
    this.funcion = funcion;
    this.unavailable.appUnavailable = FUNCIONES[funcion].motivo;
  }

  @HostBinding('class.list-iconbtn') get esIcono(): boolean {
    return FUNCIONES[this.funcion].clase === 'list-iconbtn';
  }

  @HostBinding('class.list-ghost-button') get esTexto(): boolean {
    return FUNCIONES[this.funcion].clase === 'list-ghost-button';
  }

  @HostBinding('attr.aria-label') get etiqueta(): string | null {
    return FUNCIONES[this.funcion].etiqueta;
  }
}
