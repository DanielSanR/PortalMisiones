import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { TiposOrganismoDataSource } from './tipos-organismo.datasource';
import { TipoOrganismoFormValue, TipoOrganismoVM } from '../models/tipo-organismo.vm';

const DELAY = 200;

/** Implementación mock en memoria (dev offline). */
@Injectable()
export class TiposOrganismoMockDataSource extends TiposOrganismoDataSource {
  private data: TipoOrganismoVM[] = [
    { id: 'tor-1', code: 'MINISTERIO',  nombre: 'Ministerio',        descripcion: '', activo: true },
    { id: 'tor-2', code: 'SECRETARIA',  nombre: 'Secretaría',        descripcion: '', activo: true },
    { id: 'tor-3', code: 'ORGANISMO_DESCENTRALIZADO', nombre: 'Organismo descentralizado', descripcion: '', activo: true },
  ];

  list(): Observable<TipoOrganismoVM[]> {
    return of(this.data.map((t) => ({ ...t }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<TipoOrganismoVM> {
    const t = this.data.find((x) => x.id === id);
    return t ? of({ ...t }).pipe(delay(DELAY)) : throwError(() => new Error('Tipo no encontrado'));
  }

  create(form: TipoOrganismoFormValue): Observable<TipoOrganismoVM> {
    const nuevo: TipoOrganismoVM = {
      id: `tor-${Date.now()}`,
      code: form.nombre.toUpperCase().replace(/\s+/g, '_'),
      nombre: form.nombre,
      descripcion: form.descripcion,
      activo: form.activo,
    };
    this.data = [...this.data, nuevo];
    return of({ ...nuevo }).pipe(delay(DELAY));
  }

  update(id: string, form: TipoOrganismoFormValue): Observable<TipoOrganismoVM> {
    const idx = this.data.findIndex((x) => x.id === id);
    if (idx < 0) return throwError(() => new Error('Tipo no encontrado'));
    const actualizado: TipoOrganismoVM = {
      ...this.data[idx],
      nombre: form.nombre,
      descripcion: form.descripcion,
      activo: form.activo,
    };
    this.data = this.data.map((x) => (x.id === id ? actualizado : x));
    return of({ ...actualizado }).pipe(delay(DELAY));
  }

  delete(id: string): Observable<void> {
    this.data = this.data.filter((x) => x.id !== id);
    return of(void 0).pipe(delay(DELAY));
  }
}
