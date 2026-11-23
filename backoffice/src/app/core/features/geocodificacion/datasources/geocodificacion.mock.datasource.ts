import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';
import { LugarVM } from '../models/lugar.vm';
import { GeocodificacionDataSource } from './geocodificacion.datasource';

const DELAY = 300;

/** Centro de las localidades del mock de `localidades` (y alguna más). */
const LOCALIDADES: { nombre: string; latitud: number; longitud: number }[] = [
  { nombre: 'Posadas', latitud: -27.367104, longitud: -55.896108 },
  { nombre: 'Garupá', latitud: -27.481944, longitud: -55.829167 },
  { nombre: 'Oberá', latitud: -27.487058, longitud: -55.119898 },
  { nombre: 'Eldorado', latitud: -26.408513, longitud: -54.694316 },
  { nombre: 'Puerto Iguazú', latitud: -25.597211, longitud: -54.578599 },
  { nombre: 'Apóstoles', latitud: -27.914362, longitud: -55.753866 },
  { nombre: 'Leandro N. Alem', latitud: -27.601667, longitud: -55.325278 },
];

const normalizar = (texto: string): string => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Geocodificación simulada (`ng serve` y specs): no consulta ningún servicio. Reconoce las localidades de la
 * lista; si la consulta trae además una calle, devuelve dos lugares cerca del centro (para probar la elección
 * entre varios). Casos para probar a mano: una consulta que contiene "falla" responde como un servicio caído
 * (status 0, sin conexión); una sin localidad conocida no encuentra nada.
 */
@Injectable()
export class GeocodificacionMockDataSource extends GeocodificacionDataSource {
  readonly disponible = true;

  buscar(consulta: string): Observable<LugarVM[]> {
    const texto = normalizar(consulta);
    if (texto.includes('falla')) {
      return throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' })).pipe(delay(DELAY));
    }
    const localidad = LOCALIDADES.find((l) => texto.includes(normalizar(l.nombre)));
    if (!localidad) return of<LugarVM[]>([]).pipe(delay(DELAY));
    const calle = consulta.split(',')[0].trim();
    const esSoloLocalidad = normalizar(calle) === normalizar(localidad.nombre);
    const centro: LugarVM = {
      id: `mock-${normalizar(localidad.nombre)}`,
      nombre: localidad.nombre,
      detalle: 'Misiones',
      coordenadas: { latitud: localidad.latitud, longitud: localidad.longitud },
    };
    if (esSoloLocalidad) return of([centro]).pipe(delay(DELAY));
    return of<LugarVM[]>([
      { ...centro, id: `${centro.id}-1`, nombre: calle, detalle: `${localidad.nombre}, Misiones`,
        coordenadas: { latitud: localidad.latitud + 0.0021, longitud: localidad.longitud - 0.0034 } },
      { ...centro, id: `${centro.id}-2`, nombre: `${calle} (barrio)`, detalle: `${localidad.nombre}, Misiones`,
        coordenadas: { latitud: localidad.latitud - 0.0105, longitud: localidad.longitud + 0.0062 } },
    ]).pipe(delay(DELAY));
  }
}
