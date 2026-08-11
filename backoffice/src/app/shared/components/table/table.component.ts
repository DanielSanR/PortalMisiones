import { AfterContentInit, Component, Input, Output, EventEmitter, ViewChild, ContentChildren, QueryList, TemplateRef, Directive, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
import { TableColumn, TablePageEvent, TableSortEvent } from './table-column.model';

// Directiva para registrar cell templates por nombre desde el consumidor.
@Directive({
  selector: '[appTableCell]',
  standalone: true,
})
export class TableCellDirective {
  @Input('appTableCell') columnKey = '';
  constructor(public templateRef: TemplateRef<any>) { }
}

// Directiva para registrar header templates personalizados.
@Directive({
  selector: '[appTableHeader]',
  standalone: true,
})
export class TableHeaderDirective {
  @Input('appTableHeader') columnKey = '';
  constructor(public templateRef: TemplateRef<any>) { }
}

@Component({
  selector: 'app-shared-table',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatProgressBarModule,
    MatButtonModule,
    TableCellDirective,
    TableHeaderDirective,
  ],
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedTableComponent<T = any> implements AfterContentInit {
  // Inputs — Datos
  @Input() data: T[] = [];

  //Columnas
  @Input()
  set columns(value: TableColumn<T>[]) {
    this._columns = value;
    this._displayedColumns = value.map(c => c.key);
  }
  get columns(): TableColumn<T>[] { return this._columns; }
  private _columns: TableColumn<T>[] = [];

  //Progress bar / skeleton
  @Input() loading = false;

  // Estado vacío — círculo + icono Phosphor + título/texto + CTA opcional.
  @Input() emptyIcon = 'inbox'; // nombre Phosphor sin prefijo (ej. "buildings")
  @Input() emptyTitle = '';
  @Input() emptyMessage = 'No se encontraron resultados';
  @Input() emptyImage = ''; // fallback legado: si se define, reemplaza al icono
  @Input() emptyActionLabel = '';
  @Input() emptyActionIcon = 'plus';
  @Output() emptyAction = new EventEmitter<void>();

  // Estado de error — círculo rojo + cloud-slash + CTA "Reintentar".
  @Input() error = false;
  @Input() errorTitle = 'No pudimos cargar los datos';
  @Input() errorMessage = 'Revisá tu conexión e intentá de nuevo.';
  @Input() errorRetryLabel = 'Reintentar';
  @Output() retry = new EventEmitter<void>();

  // Skeleton — cantidad de filas fantasma mientras carga sin datos previos.
  @Input() skeletonRows = 5;

  @Input() paginated = false;
  @Input() totalItems = 0;
  @Input() pageSize = 10;
  @Input() pageIndex = 0;
  @Input() sortable = false;
  @Input() striped = false; // alternar fondo de filas para mejorar legibilidad

  // Selección de fila (opcional) — ej. layouts master-detail (Roles). El consumidor decide qué fila
  // está activa; la tabla solo pinta el estado (barra de acento + fondo) vía `shared-table__row--selected`.
  @Input() isRowSelected?: (row: T) => boolean;

  @Output() pageChange = new EventEmitter<TablePageEvent>();
  @Output() sortChange = new EventEmitter<TableSortEvent>();
  @Output() rowClick = new EventEmitter<T>();
  @ViewChild(MatSort) sort?: MatSort;
  @ContentChildren(TableCellDirective) cellTemplates!: QueryList<TableCellDirective>;
  @ContentChildren(TableHeaderDirective) headerTemplates!: QueryList<TableHeaderDirective>;
  _displayedColumns: string[] = [];
  private cellTemplateMap = new Map<string, TemplateRef<any>>();
  private headerTemplateMap = new Map<string, TemplateRef<any>>();

  get displayedColumns(): string[] {
    return this._displayedColumns;
  }

  // ---------------------------------------------------------------------
  // Estados de la vista — mutuamente excluyentes.
  // ---------------------------------------------------------------------
  get showError(): boolean {
    return this.error && !this.loading;
  }

  get showEmpty(): boolean {
    return !this.error && !this.loading && (!this.data || this.data.length === 0);
  }

  get showSkeleton(): boolean {
    // Loading manda sobre error: mientras hay un reintento en curso, se
    // prioriza el skeleton por sobre el estado de error previo.
    return this.loading && (!this.data || this.data.length === 0);
  }

  get showTable(): boolean {
    return !this.showError && !this.showEmpty;
  }

  get skeletonRowsArray(): number[] {
    return Array.from({ length: this.skeletonRows });
  }

  ngAfterContentInit(): void {
    this.cellTemplates.forEach(d => this.cellTemplateMap.set(d.columnKey, d.templateRef));
    this.headerTemplates.forEach(d => this.headerTemplateMap.set(d.columnKey, d.templateRef));
  }

  //Helpers

  getCellTemplate(column: TableColumn<T>): TemplateRef<any> | null {
    return column.cellTemplate || this.cellTemplateMap.get(column.key) || null;
  }

  getHeaderTemplate(column: TableColumn<T>): TemplateRef<any> | null {
    return column.headerTemplate || this.headerTemplateMap.get(column.key) || null;
  }

  getCellValue(row: T, key: string): any {
    return key.split('.').reduce((obj: any, k) => obj?.[k], row);
  }

//Event Handlers

  onSortChange(sortState: Sort): void {
    this.sortChange.emit({
      active: sortState.active,
      direction: sortState.direction,
    });
  }

  // ---------------------------------------------------------------------
  // Paginador propio — Kitchen Sink §05.
  // ---------------------------------------------------------------------
  get ultimaPagina(): number {
    return Math.max(0, Math.ceil(this.totalItems / Math.max(1, this.pageSize)) - 1);
  }

  /** "1–7 de 68". */
  get rangoTexto(): string {
    if (this.totalItems === 0) return '0 de 0';
    const desde = this.pageIndex * this.pageSize + 1;
    const hasta = Math.min(desde + this.pageSize - 1, this.totalItems);
    return `${desde}–${hasta} de ${this.totalItems}`;
  }

  /**
   * Páginas a mostrar. Con muchas, se colapsan con elipsis (`null`) manteniendo
   * siempre la primera, la última y la actual con sus vecinas.
   */
  get paginas(): (number | null)[] {
    const total = this.ultimaPagina + 1;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i);

    const visibles = new Set<number>([0, total - 1, this.pageIndex]);
    if (this.pageIndex - 1 > 0) visibles.add(this.pageIndex - 1);
    if (this.pageIndex + 1 < total - 1) visibles.add(this.pageIndex + 1);

    const salida: (number | null)[] = [];
    let previa = -1;
    for (const pagina of [...visibles].sort((a, b) => a - b)) {
      if (previa !== -1 && pagina - previa > 1) salida.push(null);
      salida.push(pagina);
      previa = pagina;
    }
    return salida;
  }

  irAPagina(indice: number): void {
    const destino = Math.min(Math.max(indice, 0), this.ultimaPagina);
    if (destino === this.pageIndex) return;
    this.pageChange.emit({ pageIndex: destino, pageSize: this.pageSize });
  }

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  rowIsSelected(row: T): boolean {
    return !!this.isRowSelected && this.isRowSelected(row);
  }
}
