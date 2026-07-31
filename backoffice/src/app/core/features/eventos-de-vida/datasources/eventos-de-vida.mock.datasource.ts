import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { EventosDeVidaDataSource } from './eventos-de-vida.datasource';
import { EventoDeVidaFormValue, EventoDeVidaVM } from '../models/evento-de-vida.vm';

const DELAY = 200;

/** Deriva el slug desde el nombre (espeja el `generateSlug` del backend). */
function slugify(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-)|(-$)/g, '');
}

/** Implementación mock en memoria (dev offline). */
@Injectable()
export class EventosDeVidaMockDataSource extends EventosDeVidaDataSource {
  private data: EventoDeVidaVM[] = [
    { id: 'lev-1', slug: 'nacimiento-hijo',       nombre: 'Nacimiento de un hijo' },
    { id: 'lev-2', slug: 'iniciar-emprendimiento', nombre: 'Iniciar un emprendimiento' },
    { id: 'lev-3', slug: 'comprar-vehiculo',       nombre: 'Comprar un vehículo' },
  ];

  list(): Observable<EventoDeVidaVM[]> {
    return of(this.data.map((e) => ({ ...e }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<EventoDeVidaVM> {
    const e = this.data.find((x) => x.id === id);
    return e ? of({ ...e }).pipe(delay(DELAY)) : throwError(() => new Error('Evento no encontrado'));
  }

  create(form: EventoDeVidaFormValue): Observable<EventoDeVidaVM> {
    const nuevo: EventoDeVidaVM = { id: `lev-${Date.now()}`, slug: slugify(form.nombre), nombre: form.nombre };
    this.data = [...this.data, nuevo];
    return of({ ...nuevo }).pipe(delay(DELAY));
  }

  update(id: string, form: EventoDeVidaFormValue): Observable<EventoDeVidaVM> {
    const idx = this.data.findIndex((x) => x.id === id);
    if (idx < 0) return throwError(() => new Error('Evento no encontrado'));
    const actualizado: EventoDeVidaVM = { id, slug: slugify(form.nombre), nombre: form.nombre };
    this.data = this.data.map((x) => (x.id === id ? actualizado : x));
    return of({ ...actualizado }).pipe(delay(DELAY));
  }

  delete(id: string): Observable<void> {
    this.data = this.data.filter((x) => x.id !== id);
    return of(void 0).pipe(delay(DELAY));
  }
}
