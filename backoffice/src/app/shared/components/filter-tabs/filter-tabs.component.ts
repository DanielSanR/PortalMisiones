import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
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
  @Input({ required: true }) tabs: FilterTabOption[] = [];
  @Input() active = '';
  @Output() readonly activeChange = new EventEmitter<string>();

  select(value: string): void {
    if (value === this.active) return;
    this.activeChange.emit(value);
  }
}
