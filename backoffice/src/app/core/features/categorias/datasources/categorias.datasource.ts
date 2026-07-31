import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CategoriaFormValue, CategoriaVM } from '../models/categoria.vm';

/** Fuente de datos de Categorías. Reads públicos; escrituras SUPERADMIN/ADMIN_BACKOFFICE (§5.3). */
export abstract class CategoriasDataSource {
  abstract list(): Observable<CategoriaVM[]>;
  abstract getById(id: string): Observable<CategoriaVM>;
  abstract create(form: CategoriaFormValue): Observable<CategoriaVM>;
  abstract update(id: string, form: CategoriaFormValue): Observable<CategoriaVM>;
  abstract delete(id: string): Observable<void>;
}

export const CATEGORIAS_DS = new InjectionToken<CategoriasDataSource>('CATEGORIAS_DS');
