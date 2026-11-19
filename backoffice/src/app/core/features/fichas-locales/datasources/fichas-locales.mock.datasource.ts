import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { API_CODES } from '@core/constants/api-codes.constants';
import { errorDeNegocio } from '@core/mocks/mock-errors';
import { semillaAtadaAAdopciones } from '@core/config/data-source.config';
import { FichasLocalesDataSource } from './fichas-locales.datasource';
import {
  FichasLocalesFiltro, OrganismProcedureLocationRequestDTO, OrganismProcedureLocationResponseDTO,
} from '../models/ficha-local.dto';
import { toFichaLocal, toOrganismProcedureLocationRequest } from '../mappers/fichas-locales.mapper';
import { EstadoFicha, FichaLocal, FichaLocalFormValue } from '../models/ficha-local.vm';
import { DESTINO_DE_TRANSICION, TransicionBackend, transicionPermitida } from '../models/workflow';

const DELAY = 200;

/** Texto real del `4012` (`messages.properties`). */
const TEXTO_4012 = 'Verifique los campos de los elementos enviados.';
/** Texto real del `5000` (`messages.properties`): el handler genérico no manda más detalle. */
const TEXTO_5000 = 'Ocurrió un error inesperado. Contacte al administrador.';
/** Texto real del `4077` (`messages.properties`). */
const TEXTO_4077 = 'La transición de publicación solicitada no es válida desde el estado actual.';

/** Lo que guarda el mock: el response real, tal cual. */
type FilaMock = OrganismProcedureLocationResponseDTO;

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
 * Implementación mock en memoria, fiel a `OrganismProcedureLocationService` de `dev` (`586b670`) con
 * alcance global:
 * - `list` admite el mismo filtro por adopción que `?organismProcedureId=` (activas e inactivas).
 * - POST siempre en `BORRADOR`, versión 1; PUT del contenido (el estado se conserva) y versión N+1; cada
 *   transición válida también suma una versión. El `DELETE` no genera versión.
 * - Transiciones según `isAllowedTransition`; las inválidas → 409 `4077`.
 * - Ficha inexistente → 404 `4073`; `organismProcedureId`, `locationId`, `slug` o `active` faltantes → 400 `4012`.
 * - Unicidad de `(adopción, localidad)` y de `(slug, adopción)` (`V2.27`), contando las desactivadas. El
 *   backend no la valida antes de guardar: la violación llega como el `5000` genérico, y acá igual.
 * No puede validar que la adopción exista y esté vigente, ni que la localidad exista (no conoce otros
 * datasources): el 404 de adopción no vigente solo se ve contra el backend real.
 */
@Injectable()
export class FichasLocalesMockDataSource extends FichasLocalesDataSource {
  readonly fuenteSimulada = true;
  /** Si alguien fuerza este mock con adopciones reales, las semillas (`op-*`, `loc-*`) no existen: arranca vacío. */
  private data: FilaMock[] = semillaAtadaAAdopciones(semilla);

  list(filtro?: FichasLocalesFiltro): Observable<FichaLocal[]> {
    const filas = filtro?.adopcionId
      ? this.data.filter((fila) => fila.organismProcedureId === filtro.adopcionId)
      : this.data;
    return of(filas.map((fila) => toFichaLocal({ ...fila }))).pipe(delay(DELAY));
  }

  getById(id: string): Observable<FichaLocal> {
    const fila = this.data.find((x) => x.id === id);
    return fila ? of(toFichaLocal({ ...fila })).pipe(delay(DELAY)) : this.errorInexistente(id);
  }

  create(form: FichaLocalFormValue): Observable<FichaLocal> {
    const request = toOrganismProcedureLocationRequest(form);
    if (!this.completo(request)) return this.errorDeValidacion();
    if (this.chocaUnicidad(request, null)) return this.error5000();
    const nueva: FilaMock = {
      id: crypto.randomUUID(),
      ...this.contenido(request),
      publicationStatus: 'BORRADOR',
      currentVersionNumber: 1,
    };
    this.data = [...this.data, nueva];
    return of(toFichaLocal({ ...nueva })).pipe(delay(DELAY));
  }

  update(id: string, form: FichaLocalFormValue): Observable<FichaLocal> {
    const existente = this.data.find((x) => x.id === id);
    const request = toOrganismProcedureLocationRequest(form);
    // Igual que el backend: primero valida el DTO (`@Valid`), después busca la ficha.
    if (!this.completo(request)) return this.errorDeValidacion();
    if (!existente) return this.errorInexistente(id);
    if (this.chocaUnicidad(request, id)) return this.error5000();
    // Igual que el backend: el PUT edita el contenido y conserva el estado vigente.
    const actualizada: FilaMock = {
      ...existente,
      ...this.contenido(request),
      currentVersionNumber: existente.currentVersionNumber + 1,
    };
    this.reemplazar(actualizada);
    return of(toFichaLocal({ ...actualizada })).pipe(delay(DELAY));
  }

  transicion(id: string, transicion: TransicionBackend): Observable<FichaLocal> {
    const existente = this.data.find((x) => x.id === id);
    const destino = DESTINO_DE_TRANSICION[transicion];
    if (!existente) return this.errorInexistente(id);
    if (!transicionPermitida(existente.publicationStatus, destino)) {
      return errorDeNegocio(API_CODES.PUBLICATION_TRANSITION_INVALID, TEXTO_4077, 409);
    }
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
    if (!existente) return this.errorInexistente(id);
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

  /** `@NotNull`/`@NotBlank` del DTO: si falta alguno, el backend responde 400 `4012`. */
  private completo(request: OrganismProcedureLocationRequestDTO): boolean {
    return !!request.organismProcedureId && !!request.locationId && !!request.slug.trim() && typeof request.active === 'boolean';
  }

  /** Los dos UNIQUE de `V2.27`. No miran `active`: una ficha desactivada sigue ocupando su lugar. */
  private chocaUnicidad(request: OrganismProcedureLocationRequestDTO, exceptoId: string | null): boolean {
    return this.data.some((x) => x.id !== exceptoId
      && x.organismProcedureId === request.organismProcedureId
      && (x.locationId === request.locationId || x.slug === request.slug));
  }

  private reemplazar(fila: FilaMock): void {
    this.data = this.data.map((x) => (x.id === fila.id ? fila : x));
  }

  private errorDeValidacion(): Observable<never> {
    return errorDeNegocio(API_CODES.VALIDATION, TEXTO_4012, 400);
  }

  private error5000(): Observable<never> {
    return errorDeNegocio(API_CODES.UNEXPECTED, TEXTO_5000, 500);
  }

  private errorInexistente(id: string): Observable<never> {
    return errorDeNegocio(API_CODES.ENTITY_NOT_FOUND, `El objeto OrganismProcedureLocation con el identificador ${id} no existe.`, 404);
  }
}
