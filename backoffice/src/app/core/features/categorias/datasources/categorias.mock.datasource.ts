import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { CategoriasDataSource } from './categorias.datasource';
import { CategoriaFormValue, CategoriaVM } from '../models/categoria.vm';

const DELAY = 200;

/** Implementación mock en memoria (dev offline). Raíces + sub-categorías de ejemplo. */
@Injectable()
export class CategoriasMockDataSource extends CategoriasDataSource {
  private data: CategoriaVM[] = [
    { id: 'cat-1', parentId: null,   slug: 'automotor-transporte', nombre: 'Automotor, transporte y tránsito' },
    { id: 'cat-2', parentId: 'cat-1', slug: 'licencias-conducir',   nombre: 'Licencias de conducir' },
    { id: 'cat-3', parentId: 'cat-1', slug: 'patentes',             nombre: 'Patentes' },
    { id: 'cat-4', parentId: null,   slug: 'salud',                 nombre: 'Salud' },
    { id: 'cat-5', parentId: 'cat-4', slug: 'carnet-sanitario',     nombre: 'Carnet sanitario' },
  ];

  list(): Observable<CategoriaVM[]> {
    return of(this.data.map((c) => ({ ...c }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<CategoriaVM> {
    const c = this.data.find((x) => x.id === id);
    return c ? of({ ...c }).pipe(delay(DELAY)) : throwError(() => new Error('Categoría no encontrada'));
  }

  create(form: CategoriaFormValue): Observable<CategoriaVM> {
    const nueva: CategoriaVM = {
      id: `cat-${Date.now()}`,
      parentId: form.parentId || null,
      slug: form.slug,
      nombre: form.nombre,
    };
    this.data = [...this.data, nueva];
    return of({ ...nueva }).pipe(delay(DELAY));
  }

  update(id: string, form: CategoriaFormValue): Observable<CategoriaVM> {
    const idx = this.data.findIndex((x) => x.id === id);
    if (idx < 0) return throwError(() => new Error('Categoría no encontrada'));
    const actualizada: CategoriaVM = {
      id,
      parentId: form.parentId || null,
      slug: form.slug,
      nombre: form.nombre,
    };
    this.data = this.data.map((x) => (x.id === id ? actualizada : x));
    return of({ ...actualizada }).pipe(delay(DELAY));
  }

  delete(id: string): Observable<void> {
    this.data = this.data.filter((x) => x.id !== id);
    return of(void 0).pipe(delay(DELAY));
  }
}
