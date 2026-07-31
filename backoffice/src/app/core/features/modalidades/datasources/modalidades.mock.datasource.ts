import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { ModalidadesDataSource } from './modalidades.datasource';
import { ModalidadFormValue, ModalidadVM } from '../models/modalidad.vm';

const DELAY = 200;

/** Implementación mock en memoria (dev offline). */
@Injectable()
export class ModalidadesMockDataSource extends ModalidadesDataSource {
  private data: ModalidadVM[] = [
    { id: 'mod-1', nombre: 'Presencial', activo: true },
    { id: 'mod-2', nombre: 'Digital de punta a punta', activo: true },
    { id: 'mod-3', nombre: 'Mixta (inicio online, cierre presencial)', activo: true },
  ];

  list(): Observable<ModalidadVM[]> {
    return of(this.data.map((m) => ({ ...m }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<ModalidadVM> {
    const m = this.data.find((x) => x.id === id);
    return m ? of({ ...m }).pipe(delay(DELAY)) : throwError(() => new Error('Modalidad no encontrada'));
  }

  create(form: ModalidadFormValue): Observable<ModalidadVM> {
    const nueva: ModalidadVM = { id: `mod-${Date.now()}`, nombre: form.nombre, activo: true };
    this.data = [...this.data, nueva];
    return of({ ...nueva }).pipe(delay(DELAY));
  }

  update(id: string, form: ModalidadFormValue): Observable<ModalidadVM> {
    const idx = this.data.findIndex((x) => x.id === id);
    if (idx < 0) return throwError(() => new Error('Modalidad no encontrada'));
    const actualizada: ModalidadVM = { ...this.data[idx], nombre: form.nombre };
    this.data = this.data.map((x) => (x.id === id ? actualizada : x));
    return of({ ...actualizada }).pipe(delay(DELAY));
  }

  delete(id: string): Observable<void> {
    this.data = this.data.filter((x) => x.id !== id);
    return of(void 0).pipe(delay(DELAY));
  }
}
