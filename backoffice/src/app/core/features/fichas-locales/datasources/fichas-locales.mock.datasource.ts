import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { errorDeNegocio } from '@core/mocks/mock-errors';
import { FichasLocalesDataSource } from './fichas-locales.datasource';
import {
  OrganismProcedureLocationExtendedResponseDTO, OrganismProcedureLocationRequestDTO,
} from '../models/ficha-local.dto';
import { toFichaLocal, toOrganismProcedureLocationRequest } from '../mappers/fichas-locales.mapper';
import { EstadoFicha, FichaLocal, FichaLocalFormValue } from '../models/ficha-local.vm';
import { DESTINO_DE_TRANSICION, TransicionBackend, transicionPermitida } from '../models/workflow';

const DELAY = 200;

/** Texto real del `5000` (`messages.properties`): el handler genérico no manda más detalle. */
const TEXTO_5000 = 'Ocurrió un error inesperado. Contacte al administrador.';

/** Lo que guarda el mock: el response extendido con los obligatorios de G-1, sin nombres. */
type FilaMock = Required<Pick<OrganismProcedureLocationExtendedResponseDTO,
  'id' | 'slug' | 'publicationStatus' | 'active' | 'currentVersionNumber'
  | 'organismProcedureId' | 'locationId' | 'url' | 'requirements' | 'costs'>>;

/**
 * Semilla atada a las adopciones mock (`op-*`, feature adopciones) y a las localidades mock (`loc-*`),
 * para que los nombres se resuelvan offline. Hay de los cuatro estados, una desactivada y una
 * publicada de una adopción vencida (R-5: el backend no cascadea la vigencia).
 */
function semilla(): FilaMock[] {
  const ficha = (
    id: string, adopcion: string, localidad: string, slug: string, estado: EstadoFicha, version: number,
    extra: Partial<FilaMock> = {},
  ): FilaMock => ({
    id,
    organismProcedureId: adopcion,
    locationId: localidad,
    slug,
    url: null,
    requirements: null,
    costs: null,
    publicationStatus: estado,
    active: true,
    currentVersionNumber: version,
    ...extra,
  });
  return [
    ficha('fl-1', 'op-1', 'loc-posadas', 'obtener-licencia-de-conducir-posadas', 'PUBLICADO', 3, {
      url: 'https://www.posadas.gob.ar/licencias',
      requirements: 'DNI vigente.\nCertificado de grupo sanguíneo.\nLibre deuda de infracciones.',
      costs: 'Licencia nueva: $25.000.\nRenovación: $18.000.',
    }),
    ficha('fl-2', 'op-1', 'loc-obera', 'obtener-licencia-de-conducir-obera', 'EN_REVISION', 2, {
      requirements: 'DNI vigente.\nCertificado de domicilio en Oberá.',
      costs: 'Licencia nueva: $22.000.',
    }),
    ficha('fl-3', 'op-1', 'loc-eldorado', 'obtener-licencia-de-conducir-eldorado', 'BORRADOR', 1),
    ficha('fl-4', 'op-2', 'loc-posadas', 'inscribirse-en-el-registro-de-emprendedores-posadas', 'DESPUBLICADO', 4, {
      url: 'https://www.ips.gob.ar/emprendedores',
      requirements: 'CUIT.\nConstancia de inscripción en Rentas.',
      costs: 'Sin costo.',
    }),
    ficha('fl-5', 'op-2', 'loc-iguazu', 'inscribirse-en-el-registro-de-emprendedores-puerto-iguazu', 'PUBLICADO', 2, {
      requirements: 'CUIT.',
      costs: 'Sin costo.',
    }),
    ficha('fl-6', 'op-2', 'loc-garupa', 'inscribirse-en-el-registro-de-emprendedores-garupa', 'DESPUBLICADO', 2, {
      active: false,
    }),
    ficha('fl-7', 'op-4', 'loc-apostoles', 'obtener-licencia-de-conducir-apostoles', 'PUBLICADO', 5, {
      requirements: 'DNI vigente.',
      costs: '$20.000.',
    }),
    ficha('fl-8', 'op-3', 'loc-lnalem', 'obtener-carnet-sanitario-leandro-n-alem', 'EN_REVISION', 2, {
      requirements: 'DNI.\nLibreta sanitaria anterior, si tiene.',
    }),
  ];
}

/**
 * Implementación mock en memoria, con la forma COMPLETA del response (como si G-1 estuviera
 * resuelto) y fiel a `OrganismProcedureLocationService` con alcance global:
 * - POST siempre en `BORRADOR`, versión 1; PUT total (incluido el estado que manda el front) y
 *   versión N+1; cada transición válida también suma una versión. El `DELETE` no genera versión.
 * - Transiciones según `isAllowedTransition`; las inválidas → 500 `5000`, igual que el backend.
 * - Ficha inexistente o campos NOT NULL faltantes → `5000` (el backend tira `IllegalArgumentException`).
 * - Sin unicidad de `(adopción, localidad)` ni de slug (G-9): la valida el form en el cliente.
 * No puede validar que la adopción y la localidad existan (no conoce otros datasources).
 */
@Injectable()
export class FichasLocalesMockDataSource extends FichasLocalesDataSource {
  private data: FilaMock[] = semilla();

  list(): Observable<FichaLocal[]> {
    return of(this.data.map((fila) => toFichaLocal({ ...fila }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<FichaLocal> {
    const fila = this.data.find((x) => x.id === id);
    return fila ? of(toFichaLocal({ ...fila })).pipe(delay(DELAY)) : this.error5000();
  }

  create(form: FichaLocalFormValue): Observable<FichaLocal> {
    const request = toOrganismProcedureLocationRequest(form, 'BORRADOR');
    if (!this.completo(request)) return this.error5000();
    const nueva: FilaMock = {
      id: crypto.randomUUID(),
      ...this.contenido(request),
      publicationStatus: 'BORRADOR',
      currentVersionNumber: 1,
    };
    this.data = [...this.data, nueva];
    return of(toFichaLocal({ ...nueva })).pipe(delay(DELAY));
  }

  update(id: string, form: FichaLocalFormValue, estadoActual: EstadoFicha): Observable<FichaLocal> {
    const existente = this.data.find((x) => x.id === id);
    const request = toOrganismProcedureLocationRequest(form, estadoActual);
    if (!existente || !this.completo(request)) return this.error5000();
    // Igual que el backend (R-1): copia el estado del request sin validar la transición.
    const actualizada: FilaMock = {
      ...existente,
      ...this.contenido(request),
      publicationStatus: request.publicationStatus,
      currentVersionNumber: existente.currentVersionNumber + 1,
    };
    this.reemplazar(actualizada);
    return of(toFichaLocal({ ...actualizada })).pipe(delay(DELAY));
  }

  transicion(id: string, transicion: TransicionBackend): Observable<FichaLocal> {
    const existente = this.data.find((x) => x.id === id);
    const destino = DESTINO_DE_TRANSICION[transicion];
    if (!existente || !transicionPermitida(existente.publicationStatus, destino)) return this.error5000();
    const actualizada: FilaMock = {
      ...existente,
      publicationStatus: destino,
      currentVersionNumber: existente.currentVersionNumber + 1,
    };
    this.reemplazar(actualizada);
    return of(toFichaLocal({ ...actualizada })).pipe(delay(DELAY));
  }

  desactivar(id: string): Observable<void> {
    const existente = this.data.find((x) => x.id === id);
    if (!existente) return this.error5000();
    this.reemplazar({
      ...existente,
      active: false,
      publicationStatus: existente.publicationStatus === 'PUBLICADO' ? 'DESPUBLICADO' : existente.publicationStatus,
    });
    return of(void 0).pipe(delay(DELAY));
  }

  /** Los slugs del mock no existen en el backend: no hay dirección pública a la que llevar. */
  urlPublica(): string | null {
    return null;
  }

  private contenido(request: OrganismProcedureLocationRequestDTO): Omit<FilaMock, 'id' | 'publicationStatus' | 'currentVersionNumber'> {
    return {
      organismProcedureId: request.organismProcedureId,
      locationId: request.locationId,
      slug: request.slug,
      url: request.url,
      requirements: request.requirements,
      costs: request.costs,
      active: request.active,
    };
  }

  /** Columnas NOT NULL sin validación en el DTO: si faltan, el backend responde 500. */
  private completo(request: OrganismProcedureLocationRequestDTO): boolean {
    return !!request.organismProcedureId && !!request.locationId && !!request.slug && typeof request.active === 'boolean';
  }

  private reemplazar(fila: FilaMock): void {
    this.data = this.data.map((x) => (x.id === fila.id ? fila : x));
  }

  private error5000(): Observable<never> {
    return errorDeNegocio(API_CODES.UNEXPECTED, TEXTO_5000);
  }
}
