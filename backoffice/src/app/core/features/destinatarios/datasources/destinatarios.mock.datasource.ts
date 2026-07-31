import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { DestinatariosDataSource } from './destinatarios.datasource';
import { DestinatarioFormValue, DestinatarioVM } from '../models/destinatario.vm';

const DELAY = 200;

/** Implementación mock en memoria (dev offline). Seed = backend (V2.7). */
@Injectable()
export class DestinatariosMockDataSource extends DestinatariosDataSource {
  private data: DestinatarioVM[] = [
    { id: 'rec-1', nombre: 'persona_humana' },
    { id: 'rec-2', nombre: 'empresa' },
    { id: 'rec-3', nombre: 'extranjero' },
  ];

  list(): Observable<DestinatarioVM[]> {
    return of(this.data.map((d) => ({ ...d }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<DestinatarioVM> {
    const d = this.data.find((x) => x.id === id);
    return d ? of({ ...d }).pipe(delay(DELAY)) : throwError(() => new Error('Destinatario no encontrado'));
  }

  create(form: DestinatarioFormValue): Observable<DestinatarioVM> {
    const nuevo: DestinatarioVM = { id: `rec-${Date.now()}`, nombre: form.nombre };
    this.data = [...this.data, nuevo];
    return of({ ...nuevo }).pipe(delay(DELAY));
  }

  update(id: string, form: DestinatarioFormValue): Observable<DestinatarioVM> {
    const idx = this.data.findIndex((x) => x.id === id);
    if (idx < 0) return throwError(() => new Error('Destinatario no encontrado'));
    const actualizado: DestinatarioVM = { id, nombre: form.nombre };
    this.data = this.data.map((x) => (x.id === id ? actualizado : x));
    return of({ ...actualizado }).pipe(delay(DELAY));
  }

  delete(id: string): Observable<void> {
    this.data = this.data.filter((x) => x.id !== id);
    return of(void 0).pipe(delay(DELAY));
  }
}
