import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, OnChanges, ViewChild, forwardRef, inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { TreeFieldConfig, TreeOption } from '@core/models/field.interface';

/** Una fila ya aplanada del árbol, en el orden en que se dibuja. */
export interface TreeRow {
  /** `option` = nodo de la jerarquía; `empty` = "ninguno"; `self` = la entidad que se edita. */
  kind: 'option' | 'empty' | 'self';
  id: string;
  label: string;
  meta: string;
  depth: number;
  selected: boolean;
  disabledReason: string;
}

/**
 * Desplegable para elegir un nodo de una jerarquía (p. ej. el organismo superior).
 *
 * Cerrado ocupa lo mismo que cualquier select. Abierto muestra el árbol con buscador: se ve de
 * quién depende cada nodo, los no elegibles aparecen con su motivo en vez de desaparecer, y la
 * entidad que se está editando se dibuja debajo del nodo elegido.
 *
 * Valor: el `id` del nodo, o `''` si no hay ninguno (igual que los `select` del form dinámico).
 * Teclado (patrón listbox): ↑/↓, Inicio/Fin mueven el foco; Enter o Espacio eligen; Esc cierra.
 */
@Component({
  selector: 'app-tree-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkConnectedOverlay, CdkOverlayOrigin],
  templateUrl: './tree-select.component.html',
  styleUrl: './tree-select.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TreeSelectComponent), multi: true }],
})
export class TreeSelectComponent implements ControlValueAccessor, OnChanges {
  @Input({ required: true }) config!: TreeFieldConfig;
  /** Id del botón que abre el desplegable (para el `for` del label externo). */
  @Input({ required: true }) inputId!: string;
  /** Id del label visible del campo. */
  @Input() labelledBy = '';
  @Input() describedBy = '';
  @Input() invalid = false;

  @ViewChild('trigger', { static: true }) private trigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('busqueda') private busqueda?: ElementRef<HTMLInputElement>;
  @ViewChild('lista') private lista?: ElementRef<HTMLElement>;

  private readonly cdr = inject(ChangeDetectorRef);

  value = '';
  disabled = false;
  open = false;
  query = '';
  rows: TreeRow[] = [];
  /** Ancho del botón, para que el panel no sea más angosto que el campo. */
  panelMinWidth = 0;

  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnChanges(): void {
    this.rows = this.buildRows();
  }

  /** Texto del botón: el nodo elegido, o el de "ninguno". */
  get valueLabel(): string {
    const elegido = this.config.nodes.find((n) => n.id === this.value);
    if (elegido) return elegido.label;
    // Hay un valor guardado que no está en la lista (dato roto o catálogo incompleto): decirlo,
    // en vez de mostrar "ninguno" mientras el formulario sigue enviando ese id.
    return this.value ? 'Opción no disponible' : this.config.emptyLabel;
  }

  get hasValue(): boolean {
    return this.config.nodes.some((n) => n.id === this.value);
  }

  /** Hay búsqueda y ningún nodo coincide (la opción "ninguno" y la propia entidad no cuentan). */
  get sinResultados(): boolean {
    return !!this.query.trim() && !this.rows.some((r) => r.kind === 'option' && !r.selected);
  }

  // ControlValueAccessor ------------------------------------------------------
  writeValue(value: string | null): void {
    this.value = value ?? '';
    this.rows = this.buildRows();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.cdr.markForCheck();
  }

  // Apertura ------------------------------------------------------------------
  toggle(): void {
    if (this.open) {
      this.close();
    } else {
      this.panelMinWidth = this.trigger.nativeElement.offsetWidth;
      this.query = '';
      this.rows = this.buildRows();
      this.open = true;
    }
  }

  /** El overlay ya está en el DOM: el foco va al buscador. */
  onAttach(): void {
    queueMicrotask(() => this.busqueda?.nativeElement.focus());
  }

  /** Cierra y devuelve el foco al botón, venga el cierre de donde venga (elección, Esc, Tab, clic afuera). */
  close(): void {
    if (!this.open) return;
    this.open = false;
    this.onTouched();
    this.trigger.nativeElement.focus();
    this.cdr.markForCheck();
  }

  onSearch(event: Event): void {
    this.query = (event.target as HTMLInputElement).value;
    this.rows = this.buildRows();
  }

  pick(row: TreeRow): void {
    if (row.kind === 'self' || row.disabledReason) return;
    if (row.id !== this.value) {
      this.value = row.id;
      this.rows = this.buildRows();
      this.onChange(row.id);
    }
    this.close();
  }

  /** Teclado del panel: Esc cierra; desde el buscador ↓ entra a la lista; en la lista ↑/↓/Inicio/Fin. */
  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // que no cierre también un diálogo que contenga el formulario
      this.close();
      return;
    }
    // Tab cierra y devuelve el foco al botón ANTES de la acción por defecto: así el foco sigue al
    // campo siguiente (o al anterior, con Shift) en vez de irse detrás del panel, que vive en `body`.
    if (event.key === 'Tab') {
      this.close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    const opciones = Array.from(this.lista?.nativeElement.querySelectorAll<HTMLElement>('[data-opcion]') ?? []);
    if (opciones.length === 0) return;
    const enBuscador = event.target === this.busqueda?.nativeElement;
    // Inicio/Fin dentro del buscador mueven el cursor del texto: no se interceptan.
    if (enBuscador && (event.key === 'Home' || event.key === 'End')) return;

    const actual = opciones.indexOf(event.target as HTMLElement);
    let destino: number;
    switch (event.key) {
      case 'ArrowDown': destino = enBuscador ? 0 : Math.min(actual + 1, opciones.length - 1); break;
      case 'ArrowUp': destino = actual - 1; break;
      case 'Home': destino = 0; break;
      default: destino = opciones.length - 1;
    }
    event.preventDefault();
    if (destino < 0) {
      this.busqueda?.nativeElement.focus();
    } else {
      opciones[destino].focus();
    }
  }

  // Árbol → filas -------------------------------------------------------------
  /**
   * Aplana la jerarquía en el orden de dibujo. La entidad en edición (`config.self`) se inserta
   * debajo del nodo elegido —o arriba de todo si no hay ninguno— y arrastra a sus propios hijos.
   * Cada id se visita una sola vez: datos viejos con ciclos no cuelgan el recorrido.
   */
  private buildRows(): TreeRow[] {
    const config = this.config;
    if (!config) return [];

    const self = config.self;
    const ids = new Set(config.nodes.map((n) => n.id));
    const esRaiz = (n: TreeOption) => !n.parentId || (!ids.has(n.parentId) && n.parentId !== self?.id);
    const hijosDe = (parentId: string) => config.nodes.filter((n) => n.parentId === parentId);
    const q = this.query.trim().toLocaleLowerCase('es-AR');
    const coincide = (n: TreeOption) =>
      !q || `${n.label} ${n.keywords ?? ''}`.toLocaleLowerCase('es-AR').includes(q);

    const seleccionado = this.hasValue ? this.value : '';
    const visitados = new Set<string>();
    const rows: TreeRow[] = [];

    const emitirSelf = (depth: number) => {
      if (!self) return;
      rows.push({ kind: 'self', id: '', label: self.label, meta: self.tag, depth, selected: false, disabledReason: '' });
      if (self.id) hijosDe(self.id).forEach((hijo) => emitir(hijo, depth + 1));
    };

    const emitir = (nodo: TreeOption, depth: number) => {
      if (visitados.has(nodo.id)) return;
      visitados.add(nodo.id);
      const selected = nodo.id === seleccionado;
      // El elegido se muestra siempre, aunque la búsqueda no lo alcance: es el contexto de la entidad.
      if (coincide(nodo) || selected) {
        rows.push({
          kind: 'option', id: nodo.id, label: nodo.label, meta: nodo.meta ?? '', depth, selected,
          disabledReason: nodo.disabledReason ?? '',
        });
      }
      if (selected) emitirSelf(depth + 1);
      hijosDe(nodo.id).forEach((hijo) => emitir(hijo, depth + 1));
    };

    rows.push({
      kind: 'empty', id: '', label: config.emptyLabel, meta: config.emptyMeta ?? '', depth: 0,
      selected: !this.value, disabledReason: '',
    });
    if (!seleccionado) emitirSelf(0);
    config.nodes.filter(esRaiz).forEach((nodo) => emitir(nodo, 0));
    // Lo que quede sin visitar está en un ciclo (nadie es raíz): se muestra igual, desde el nivel 0,
    // para que un dato roto no haga desaparecer organismos del desplegable.
    config.nodes.forEach((nodo) => emitir(nodo, 0));
    return rows;
  }
}
