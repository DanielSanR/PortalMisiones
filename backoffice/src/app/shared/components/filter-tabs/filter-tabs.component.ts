import { Component, ElementRef, EventEmitter, Input, Output, QueryList, ViewChildren, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Una pestaña/chip de `FilterTabsComponent`. `count` es opcional (se omite si no aporta info). */
export interface FilterTabOption {
  value: string;
  label: string;
  count?: number;
  /** Punto rojo de alerta (ej. "Requieren revisión"), solo si hay dato real detrás. */
  alert?: boolean;
}

/**
 * Barra de chips-filtro tipo pill (ver screens-spec.md §3.3/§5, "LISTA"), una opción activa a la vez.
 * Controlado: el padre decide `active` y filtra su stream de datos al recibir `activeChange`
 * (patrón sugerido: `BehaviorSubject<string>` + `combineLatest` con los datos ya cargados).
 *
 *   <app-filter-tabs [tabs]="tabs" [active]="(filtro$ | async)!" (activeChange)="filtro$.next($event)" />
 */
@Component({
  selector: 'app-filter-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filter-tabs.component.html',
  styleUrl: './filter-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterTabsComponent {
  /**
   * Con menos de 2 opciones no hay nada que filtrar: la barra no se renderiza (un único chip
   * "Todos" sería un control sin función). La pantalla no necesita su propio `@if`, pero si el
   * contenedor deja un hueco (ej. `.list-toolbar__row`) puede condicionarlo con `tabs.length > 1`.
   */
  @Input({ required: true }) tabs: FilterTabOption[] = [];
  @Input() active = '';
  @Output() readonly activeChange = new EventEmitter<string>();

  @ViewChildren('tabBtn') private tabBtns!: QueryList<ElementRef<HTMLButtonElement>>;

  select(value: string): void {
    if (value === this.active) return;
    this.activeChange.emit(value);
  }

  /**
   * Semántica `radiogroup` y no `tablist`: los chips son filtros EXCLUYENTES de una lista, no
   * pestañas que muestran paneles distintos (no hay `tabpanel` que controlar).
   *
   * Navegación por teclado del patrón `radiogroup` (ARIA APG): las flechas mueven entre chips
   * y Home/End van a los extremos, con wrap-around. Solo el chip activo es tabbable
   * (roving tabindex en el template), así que Tab entra y sale de la barra de una vez
   * en lugar de recorrer un chip por pulsación.
   *
   * Activación automática —mover el foco cambia el filtro— porque el filtrado es
   * client-side sobre datos ya cargados y no dispara pedidos al backend.
   */
  onKeydown(event: KeyboardEvent): void {
    const navegacion = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!navegacion.includes(event.key) || this.tabs.length === 0) return;
    event.preventDefault();

    const ultimo = this.tabs.length - 1;
    const actual = Math.max(0, this.tabs.findIndex((tab) => tab.value === this.active));
    let destino: number;
    switch (event.key) {
      case 'ArrowRight': destino = actual === ultimo ? 0 : actual + 1; break;
      case 'ArrowLeft':  destino = actual === 0 ? ultimo : actual - 1; break;
      case 'Home':       destino = 0; break;
      default:           destino = ultimo;
    }

    this.tabBtns?.get(destino)?.nativeElement.focus();
    this.select(this.tabs[destino].value);
  }
}
