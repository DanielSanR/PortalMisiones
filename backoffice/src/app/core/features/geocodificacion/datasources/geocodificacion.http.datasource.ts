import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { NominatimLugarDTO } from '../models/lugar.dto';
import { LugarVM } from '../models/lugar.vm';
import { toLugaresVM } from '../mappers/geocodificacion.mapper';
import { GeocodificacionDataSource } from './geocodificacion.datasource';

/** Pocos resultados: alcanza para elegir entre homónimos y respeta la política de uso de Nominatim. */
export const MAX_RESULTADOS = 5;

/** Rectángulo de Misiones (oeste, norte, este, sur) para que `bounded=1` no traiga lugares de otras provincias. */
const VIEWBOX_MISIONES = '-56.07,-25.49,-53.63,-28.17';

/** Configuración por entorno: `null` = sin proveedor. */
type ConfigMapa = { mapa?: { geocodificacion?: string | null } };

/**
 * Nominatim de OpenStreetMap (`GET /search?format=jsonv2`). Política de uso (https://operations.osmfoundation.org/
 * policies/nominatim/): una búsqueda por acción explícita de la persona (nada de autocompletar), pocos resultados,
 * sin datos personales (solo la dirección de una oficina pública). El navegador manda su `Referer`, que es como
 * Nominatim identifica a una aplicación web.
 *
 * Va con un `HttpClient` sobre `HttpBackend`, es decir SIN los interceptores de la app: el de autenticación le
 * pondría el JWT del backend a un tercero, y el de errores abriría el diálogo global (el error lo cuenta la
 * pantalla con texto propio).
 */
@Injectable()
export class GeocodificacionHttpDataSource extends GeocodificacionDataSource {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly url = (environment as ConfigMapa).mapa?.geocodificacion ?? null;
  readonly disponible = !!this.url;

  buscar(consulta: string): Observable<LugarVM[]> {
    if (!this.url) return throwError(() => new Error('Sin proveedor de geocodificación configurado'));
    const params = new HttpParams()
      .set('q', consulta)
      .set('format', 'jsonv2')
      .set('countrycodes', 'ar')
      .set('viewbox', VIEWBOX_MISIONES)
      .set('bounded', '1')
      .set('limit', String(MAX_RESULTADOS))
      .set('accept-language', 'es');
    return this.http.get<NominatimLugarDTO[]>(this.url, { params }).pipe(map(toLugaresVM));
  }
}
