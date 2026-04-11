import { TemplateRef } from '@angular/core';


 //texto simple = key y label
 //badges, toggles, menus, etc =  cellTemplate
 
export interface TableColumn<T = any> {
  key: string;
  label: string; // th
  sortable?: boolean;
  width?: string;
  cellTemplate?: TemplateRef<any>; // custom, recibe context { $implicit: row, column: TableColumn }
  headerTemplate?: TemplateRef<any>;
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
