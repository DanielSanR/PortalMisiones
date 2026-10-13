import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { EstadoFicha, FichaLocal, FichaLocalFormValue } from '../models/ficha-local.vm';
import { TransicionBackend } from '../models/workflow';

/**
 * Fuente de datos de las fichas por localidad (`/api/organism-procedure-location`, "OTL"): HTTP real
 * o mock en memoria, según `featureOverrides`. Devuelve los nombres solo si la fuente los trae; si
 * no, los resuelve el facade.
 *
 * Casi todos los errores del backend llegan como 500 `5000` (transición inválida, ficha/adopción/
 * localidad inexistente o fuera del alcance, campo NOT NULL faltante): ver G-4.
 */
export abstract class FichasLocalesDataSource {
  /** Todas las fichas del alcance (activas e inactivas). El backend no filtra por adopción (G-1). */
  abstract list(): Observable<FichaLocal[]>;
  abstract getById(id: string): Observable<FichaLocal>;
  /** Alta: siempre queda en `BORRADOR`, versión 1. */
  abstract create(form: FichaLocalFormValue): Observable<FichaLocal>;
  /**
   * Reemplazo total. `estadoActual` viaja tal cual en `publicationStatus` (R-1): el estado solo
   * cambia con `transicion`.
   */
  abstract update(id: string, form: FichaLocalFormValue, estadoActual: EstadoFicha): Observable<FichaLocal>;
  /** `POST /{id}/submit-review | publish | unpublish`. Inválida → 500 `5000`. */
  abstract transicion(id: string, transicion: TransicionBackend): Observable<FichaLocal>;
  /** `DELETE` lógico: `active=false`; si estaba `PUBLICADO` queda `DESPUBLICADO`. */
  abstract desactivar(id: string): Observable<void>;
  /**
   * Dirección pública de la ficha publicada (`GET /api/procedure/{slug}`), o `null` si la fuente no
   * tiene una (el mock: sus slugs no existen en el backend).
   */
  abstract urlPublica(slug: string): string | null;
}

export const FICHAS_LOCALES_DS = new InjectionToken<FichasLocalesDataSource>('FICHAS_LOCALES_DS');
