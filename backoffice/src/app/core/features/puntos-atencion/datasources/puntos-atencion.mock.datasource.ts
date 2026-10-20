import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { errorDeNegocio } from '@core/mocks/mock-errors';
import { PuntosAtencionDataSource } from './puntos-atencion.datasource';
import { AttentionPointRequestDTO, AttentionPointResponseDTO } from '../models/punto-atencion.dto';
import { toAttentionPointRequest, toPuntoAtencionVM } from '../mappers/puntos-atencion.mapper';
import { PuntoAtencionFormValue, PuntoAtencionVM } from '../models/punto-atencion.vm';

const DELAY = 200;

/**
 * Semilla con la forma real del response, atada a las fichas mock (`fl-*`, feature fichas-locales).
 * Hay un punto desactivado, que el backend igual lista.
 */
function semilla(): AttentionPointResponseDTO[] {
  return [
    {
      id: 'pa-1', organismProcedureLocationId: 'fl-1', name: 'Centro de Emisión de Licencias',
      address: 'Av. Uruguay 3150, Posadas', contactInfo: '(0376) 444-1234 · licencias@posadas.gob.ar',
      openingHours: 'Lunes a viernes de 7 a 13', latitude: -27.381234, longitude: -55.918765, active: true,
    },
    {
      id: 'pa-2', organismProcedureLocationId: 'fl-1', name: 'Delegación Itaembé Miní',
      address: 'Av. Tomás Guido 4200, Posadas', contactInfo: null,
      openingHours: 'Martes y jueves de 8 a 12', latitude: -27.425501, longitude: -55.946022, active: false,
    },
    {
      id: 'pa-3', organismProcedureLocationId: 'fl-2', name: 'Municipalidad de Oberá — Tránsito',
      address: 'Bv. Libertad 1200, Oberá', contactInfo: '(03755) 42-1234',
      openingHours: 'Lunes a viernes de 7 a 12', latitude: -27.487113, longitude: -55.119917, active: true,
    },
    {
      id: 'pa-4', organismProcedureLocationId: 'fl-4', name: 'Sede central IPS',
      address: 'Bolívar 2152, Posadas', contactInfo: 'emprendedores@ips.gob.ar',
      openingHours: null, latitude: -27.367104, longitude: -55.896108, active: true,
    },
    {
      id: 'pa-5', organismProcedureLocationId: 'fl-5', name: 'Delegación Puerto Iguazú',
      address: 'Av. Victoria Aguirre 450, Puerto Iguazú', contactInfo: null,
      openingHours: 'Lunes a viernes de 8 a 13', latitude: -25.597195, longitude: -54.578636, active: true,
    },
    {
      id: 'pa-6', organismProcedureLocationId: 'fl-7', name: 'Delegación Apóstoles',
      address: 'San Martín 350, Apóstoles', contactInfo: '(03758) 42-2222',
      openingHours: 'Lunes a viernes de 7 a 12', latitude: -27.914912, longitude: -55.753912, active: true,
    },
  ];
}

/**
 * Implementación mock en memoria, fiel a `AttentionPointService` con alcance global: lista activos e
 * inactivos, `4012` por campos obligatorios vacíos o coordenadas fuera de rango, `4073` si el punto no
 * existe, PUT total y `DELETE` lógico. No puede validar que la ficha exista (no conoce otros datasources).
 */
@Injectable()
export class PuntosAtencionMockDataSource extends PuntosAtencionDataSource {
  private data: AttentionPointResponseDTO[] = semilla();

  list(): Observable<PuntoAtencionVM[]> {
    return of(this.data.map(toPuntoAtencionVM)).pipe(delay(DELAY));
  }

  getById(id: string): Observable<PuntoAtencionVM> {
    const dto = this.data.find((x) => x.id === id);
    return dto ? of(toPuntoAtencionVM(dto)).pipe(delay(DELAY)) : this.noExiste(id);
  }

  create(form: PuntoAtencionFormValue): Observable<PuntoAtencionVM> {
    const request = toAttentionPointRequest(form);
    if (!this.valido(request)) return this.invalido();
    const nuevo: AttentionPointResponseDTO = { id: crypto.randomUUID(), ...request };
    this.data = [...this.data, nuevo];
    return of(toPuntoAtencionVM(nuevo)).pipe(delay(DELAY));
  }

  update(id: string, form: PuntoAtencionFormValue): Observable<PuntoAtencionVM> {
    const request = toAttentionPointRequest(form);
    // Igual que el servicio: primero valida coordenadas, después busca el punto.
    if (!this.valido(request)) return this.invalido();
    if (!this.data.some((x) => x.id === id)) return this.noExiste(id);
    const actualizado: AttentionPointResponseDTO = { id, ...request };
    this.data = this.data.map((x) => (x.id === id ? actualizado : x));
    return of(toPuntoAtencionVM(actualizado)).pipe(delay(DELAY));
  }

  desactivar(id: string): Observable<void> {
    if (!this.data.some((x) => x.id === id)) return this.noExiste(id);
    this.data = this.data.map((x) => (x.id === id ? { ...x, active: false } : x));
    return of(void 0).pipe(delay(DELAY));
  }

  /** `@NotBlank`/`@NotNull` del DTO + `validateCoordinates`. */
  private valido(r: AttentionPointRequestDTO): boolean {
    return !!r.organismProcedureLocationId && !!r.name && !!r.address
      && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)
      && r.latitude >= -90 && r.latitude <= 90 && r.longitude >= -180 && r.longitude <= 180;
  }

  private invalido(): Observable<never> {
    return errorDeNegocio(API_CODES.VALIDATION, 'Verifique los campos de los elementos enviados.');
  }

  private noExiste(id: string): Observable<never> {
    return errorDeNegocio(API_CODES.ENTITY_NOT_FOUND, `El objeto AttentionPoint con el identificador ${id} no existe.`);
  }
}
