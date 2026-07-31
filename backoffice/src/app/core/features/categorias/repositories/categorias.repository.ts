import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CATEGORIAS_DS, CategoriasDataSource } from '../datasources/categorias.datasource';
import { CategoriaFormValue, CategoriaVM } from '../models/categoria.vm';

/** Repositorio de Categorías. Inyecta el DataSource vía token. */
@Injectable({ providedIn: 'root' })
export class CategoriasRepository {
  constructor(@Inject(CATEGORIAS_DS) private ds: CategoriasDataSource) {}

  list(): Observable<CategoriaVM[]> {
    return this.ds.list();
  }

  getById(id: string): Observable<CategoriaVM> {
    return this.ds.getById(id);
  }

  create(form: CategoriaFormValue): Observable<CategoriaVM> {
    return this.ds.create(form);
  }

  update(id: string, form: CategoriaFormValue): Observable<CategoriaVM> {
    return this.ds.update(id, form);
  }

  delete(id: string): Observable<void> {
    return this.ds.delete(id);
  }
}
