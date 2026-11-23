import { TemplateRef } from '@angular/core';


 //texto simple = key y label
 //badges, toggles, menus, etc =  cellTemplate
 
/** Contexto que recibe la plantilla de una celda: la fila y su columna. */
export interface TableCellContext<T = unknown> {
  $implicit: T;
  column: TableColumn<T>;
}

/** Contexto que recibe la plantilla de un encabezado: la columna. */
export interface TableHeaderContext<T = unknown> {
  $implicit: TableColumn<T>;
}

export interface TableColumn<T = unknown> {
  key: string;
  label: string; // th
  sortable?: boolean;
  width?: string;
  cellTemplate?: TemplateRef<TableCellContext<T>>; // custom, recibe context { $implicit: row, column: TableColumn }
  headerTemplate?: TemplateRef<TableHeaderContext<T>>;
  cellClass?: string;
  headerClass?: string;
  hideOnMobile?: boolean;
}

// al cambiar de pagina se dispara el evento
export interface TablePageEvent {
  pageIndex: number;
  pageSize: number;
}

//Evento emitido al cambiar el ordenamiento.
export interface TableSortEvent {
  active: string;
  direction: 'asc' | 'desc' | '';
}
