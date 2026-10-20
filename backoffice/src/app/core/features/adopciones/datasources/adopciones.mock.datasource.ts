import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { errorDeNegocio } from '@core/mocks/mock-errors';
import { AdopcionesDataSource } from './adopciones.datasource';
import { OrganismProcedureRequestDTO, OrganismProcedureResponseDTO } from '../models/adopcion.dto';
import { finDelDia, inicioDelDia } from '@core/utils/fecha.utils';
import {
  parseLocalDateTime, toAdopcion, toLocalDateTime, toOrganismProcedureRequest,
} from '../mappers/adopciones.mapper';
import { Adopcion, AdopcionFormValue } from '../models/adopcion.vm';

const DELAY = 200;

/** Día a `n` días de hoy, en el borde indicado, como `LocalDateTime` (la semilla no envejece). */
function dia(n: number, borde: 'inicio' | 'fin'): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + n);
  return toLocalDateTime(borde === 'inicio' ? inicioDelDia(fecha) : finDelDia(fecha));
}

/**
 * Semilla con la forma real del response. Plantillas `pt-*` (mock de plantillas) y organismos `org-*`
 * (mock de organismos), para que los nombres se resuelvan offline. Hay una de cada estado de vigencia
 * y una deshabilitada, que el listado no devuelve (igual que el backend).
 */
function semilla(): OrganismProcedureResponseDTO[] {
  return [
    {
      // Vigente sin fin.
      id: 'op-1', procedureTemplateId: 'pt-1', organismId: 'org-2', ownerOrganismId: null,
      enabled: true, effectiveFrom: dia(-120, 'inicio'), effectiveTo: null,
    },
    {
      // Vigente con fin.
      id: 'op-2', procedureTemplateId: 'pt-3', organismId: 'org-1', ownerOrganismId: null,
      enabled: true, effectiveFrom: dia(-30, 'inicio'), effectiveTo: dia(300, 'fin'),
    },
    {
      // Programada.
      id: 'op-3', procedureTemplateId: 'pt-2', organismId: 'org-1', ownerOrganismId: null,
      enabled: true, effectiveFrom: dia(45, 'inicio'), effectiveTo: dia(410, 'fin'),
    },
    {
      // Vencida.
      id: 'op-4', procedureTemplateId: 'pt-1', organismId: 'org-3', ownerOrganismId: 'org-1',
      enabled: true, effectiveFrom: dia(-500, 'inicio'), effectiveTo: dia(-30, 'fin'),
    },
    {
      // Deshabilitada: no se lista; `GET /{id}` sí la devuelve.
      id: 'op-5', procedureTemplateId: 'pt-2', organismId: 'org-3', ownerOrganismId: null,
      enabled: false, effectiveFrom: dia(-60, 'inicio'), effectiveTo: null,
    },
  ];
}

/**
 * Implementación mock en memoria, fiel a `OrganismProcedureService` con alcance global (SA): listado
 * solo de habilitadas, `4073` si no existe, `4012` si el fin no es posterior al inicio, `4080` si se
 * solapa con otra habilitada de la misma plantilla y organismo, PUT total y DELETE lógico. No puede
 * validar que la plantilla y el organismo existan y estén activos (no conoce otros datasources).
 */
@Injectable()
export class AdopcionesMockDataSource extends AdopcionesDataSource {
  private data: OrganismProcedureResponseDTO[] = semilla();

  list(): Observable<Adopcion[]> {
    return of(this.data.filter((dto) => dto.enabled).map(toAdopcion)).pipe(delay(DELAY));
  }

  getById(id: string): Observable<Adopcion> {
    const dto = this.data.find((x) => x.id === id);
    return dto ? of(toAdopcion(dto)).pipe(delay(DELAY)) : this.noExiste();
  }

  create(form: AdopcionFormValue): Observable<Adopcion> {
    const request = toOrganismProcedureRequest(form);
    const invalido = this.validar(request, null);
    if (invalido) return invalido;

    const nueva: OrganismProcedureResponseDTO = { id: crypto.randomUUID(), ...request };
    this.data = [...this.data, nueva];
    return of(toAdopcion(nueva)).pipe(delay(DELAY));
  }

  update(id: string, form: AdopcionFormValue): Observable<Adopcion> {
    if (!this.data.some((x) => x.id === id)) return this.noExiste();

    const request = toOrganismProcedureRequest(form);
    const invalido = this.validar(request, id);
    if (invalido) return invalido;

    const actualizada: OrganismProcedureResponseDTO = { id, ...request };
    this.data = this.data.map((x) => (x.id === id ? actualizada : x));
    return of(toAdopcion(actualizada)).pipe(delay(DELAY));
  }

  deshabilitar(id: string): Observable<void> {
    if (!this.data.some((x) => x.id === id)) return this.noExiste();
    this.data = this.data.map((x) => (x.id === id ? { ...x, enabled: false } : x));
    return of(void 0).pipe(delay(DELAY));
  }

  /** `validateDates` y `ensureNoOverlap`, en el mismo orden que el servicio. */
  private validar(request: OrganismProcedureRequestDTO, exceptoId: string | null): Observable<never> | null {
    const desde = parseLocalDateTime(request.effectiveFrom).getTime();
    const hasta = request.effectiveTo ? parseLocalDateTime(request.effectiveTo).getTime() : null;
    if (hasta !== null && hasta <= desde) {
      return errorDeNegocio(API_CODES.VALIDATION, 'Verifique los campos de los elementos enviados.');
    }
    if (request.enabled && this.seSolapa(request, desde, hasta, exceptoId)) {
      // El backend no tiene texto para 4080: manda la clave cruda, igual que acá.
      return errorDeNegocio(API_CODES.ADOPTION_OVERLAP, 'response.code.4080');
    }
    return null;
  }

  /**
   * Misma consulta que `findOverlappingEnabled`: otra habilitada, misma plantilla y organismo, y
   * `(hasta == null || otra.desde < hasta) && (otra.hasta == null || otra.hasta > desde)`.
   */
  private seSolapa(request: OrganismProcedureRequestDTO, desde: number, hasta: number | null, exceptoId: string | null): boolean {
    return this.data.some((x) => {
      if (x.id === exceptoId || !x.enabled) return false;
      if (x.procedureTemplateId !== request.procedureTemplateId || x.organismId !== request.organismId) return false;
      const otraDesde = parseLocalDateTime(x.effectiveFrom).getTime();
      const otraHasta = x.effectiveTo ? parseLocalDateTime(x.effectiveTo).getTime() : null;
      return (hasta === null || otraDesde < hasta) && (otraHasta === null || otraHasta > desde);
    });
  }

  private noExiste(): Observable<never> {
    return errorDeNegocio(API_CODES.ENTITY_NOT_FOUND, 'La adopción no existe');
  }
}
