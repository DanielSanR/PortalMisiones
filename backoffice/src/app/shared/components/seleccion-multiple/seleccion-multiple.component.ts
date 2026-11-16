import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, Output,
  SimpleChanges, ViewChild, forwardRef, inject,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';

/** Una opción del catálogo: el valor del control es la lista de `id` elegidos. */
export interface OpcionSeleccion {
  id: string;
  nombre: string;
}

/** Etiqueta de un id elegido que no figura entre las opciones (el padre debería agregarlo, pero no se da por hecho). */
const NO_DISPONIBLE = 'Opción no disponible';

let siguienteId = 0;

/**
 * Selección múltiple de un catálogo, con el patrón del panel de permisos de Roles: encabezado con
 * contador, lo elegido como chips y, al abrirlo, una lista de casillas con buscador y alto máximo
 * (el alto del formulario no depende del tamaño del catálogo ni de cuánto se elija).
 *
 * `ControlValueAccessor` de `string[]` (ids): se usa con `formControlName`. El padre decide qué grupo
 * está abierto (`abierto` + `(abiertoChange)`) para mantener uno solo a la vez. El orden de las
 * opciones no cambia al marcar o desmarcar. `<ng-content>` va al final del grupo (por ejemplo, un
 * campo que depende de lo elegido).
 */
@Component({
  selector: 'app-seleccion-multiple',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, MatCheckboxModule],
  templateUrl: './seleccion-multiple.component.html',
  styleUrl: './seleccion-multiple.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SeleccionMultipleComponent), multi: true }],
})
export class SeleccionMultipleComponent implements ControlValueAccessor, OnChanges {
  /** Título del grupo ("Categorías"). */
  @Input({ required: true }) etiqueta = '';
  /** Nombre en minúscula para los textos accesibles ("categorías"). */
  @Input({ required: true }) nombre = '';
  /** Lo que se dice cuando no hay nada elegido ("Ninguna categoría elegida."). */
  @Input() textoVacio = 'Ninguna opción elegida.';
  @Input() opciones: OpcionSeleccion[] = [];
  /** Lista abierta. Lo maneja el padre, que cierra los demás grupos al abrir éste. */
  @Input() abierto = false;
  /** Cantidad máxima de chips; el resto se resume en "+N más". */
  @Input() maxChips = 6;
  /** Con más opciones que éstas aparece el buscador. */
  @Input() umbralBuscador = 8;

  @Output() abiertoChange = new EventEmitter<boolean>();

  @ViewChild('alternar') private alternar?: ElementRef<HTMLButtonElement>;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly idBase = `seleccion-multiple-${siguienteId++}`;
  readonly idEtiqueta = `${this.idBase}-etiqueta`;
  readonly idPanel = `${this.idBase}-panel`;

  valor: string[] = [];
  disabled = false;
  consulta = '';

  elegidas: OpcionSeleccion[] = [];
  chips: OpcionSeleccion[] = [];
  ocultas = 0;
  filtradas: OpcionSeleccion[] = [];

  private onChange: (valor: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnChanges(cambios: SimpleChanges): void {
    const abrio = cambios['abierto'];
    if (abrio && !abrio.firstChange && abrio.previousValue && !abrio.currentValue) {
      // Cerrar cuenta como haber pasado por el campo; la búsqueda no sobrevive al cierre.
      this.consulta = '';
      this.onTouched();
    }
    this.recalcular();
  }

  writeValue(valor: string[] | null): void {
    this.valor = Array.isArray(valor) ? [...valor] : [];
    this.recalcular();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (valor: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.cdr.markForCheck();
  }

  get buscable(): boolean {
    return this.opciones.length > this.umbralBuscador;
  }

  get contador(): string {
    return `${this.valor.length} de ${this.opciones.length}`;
  }

  get etiquetaAlternar(): string {
    if (this.abierto) return 'Listo';
    return this.valor.length ? 'Cambiar' : 'Elegir';
  }

  get iconoAlternar(): string {
    if (this.abierto) return 'ph-check';
    return this.valor.length ? 'ph-pencil-simple' : 'ph-plus';
  }

  /** El nombre accesible empieza con el texto visible del botón (WCAG 2.5.3). */
  get ariaAlternar(): string {
    return this.abierto
      ? `Listo, cerrar la lista de ${this.nombre}`
      : `${this.etiquetaAlternar} ${this.nombre}`;
  }

  get textoSinResultados(): string {
    return this.opciones.length ? 'Ninguna opción coincide con la búsqueda.' : 'No hay opciones disponibles.';
  }

  get sinResultados(): boolean {
    return this.filtradas.length === 0;
  }

  marcada(id: string): boolean {
    return this.valor.includes(id);
  }

  onAlternar(): void {
    this.abiertoChange.emit(!this.abierto);
  }

  /**
   * Esc cierra la lista y devuelve el foco al botón que la abrió. Cerrada, no hace nada. Abierta, el
   * evento no sigue subiendo: dentro de un diálogo, ese mismo Esc no tiene que cerrarlo también.
   */
  onEscape(evento: Event): void {
    if (!this.abierto) return;
    evento.stopPropagation();
    this.abiertoChange.emit(false);
    this.alternar?.nativeElement.focus();
  }

  onBuscar(texto: string): void {
    this.consulta = texto;
    this.recalcular();
  }

  alternarOpcion(id: string): void {
    this.emitir(this.marcada(id) ? this.valor.filter((x) => x !== id) : [...this.valor, id]);
  }

  /**
   * El chip (y su botón, que tenía el foco) desaparece: el foco pasa al chip que ocupa su lugar (o al
   * anterior, si era el último) para poder quitar varios seguidos por teclado; sin chips, al botón del grupo.
   */
  quitar(id: string): void {
    const indice = this.chips.findIndex((chip) => chip.id === id);
    this.emitir(this.valor.filter((x) => x !== id));
    this.cdr.detectChanges();
    const restantes = this.host.querySelectorAll<HTMLButtonElement>('.seleccion-multiple__quitar');
    const destino = restantes[Math.min(Math.max(indice, 0), restantes.length - 1)] ?? this.alternar?.nativeElement;
    destino?.focus();
  }

  private emitir(valor: string[]): void {
    this.valor = valor;
    this.recalcular();
    this.onChange(valor);
    this.onTouched();
  }

  /** Lo elegido se muestra en el orden del catálogo (no en el de elección); lo desconocido, al final. */
  private recalcular(): void {
    const conocidas = this.opciones.filter((o) => this.valor.includes(o.id));
    const ids = new Set(this.opciones.map((o) => o.id));
    const desconocidas = this.valor.filter((id) => !ids.has(id)).map((id) => ({ id, nombre: NO_DISPONIBLE }));
    this.elegidas = [...conocidas, ...desconocidas];

    const desborda = this.elegidas.length > this.maxChips;
    this.chips = desborda ? this.elegidas.slice(0, this.maxChips) : this.elegidas;
    this.ocultas = desborda ? this.elegidas.length - this.maxChips : 0;

    const texto = this.consulta.trim().toLowerCase();
    this.filtradas = texto ? this.opciones.filter((o) => o.nombre.toLowerCase().includes(texto)) : this.opciones;
  }
}
