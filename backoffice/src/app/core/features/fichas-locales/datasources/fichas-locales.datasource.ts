import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { EstadoFicha, FichaLocal, FichaLocalFormValue } from '../models/ficha-local.vm';
import { TransicionBackend } from '../models/workflow';

/**
 * Fuente de datos de las fichas por localidad (`/api/organism-procedure-location`, "OTL"): HTTP real
 * o mock en memoria, según `featureOverrides`. Devuelve los nombres solo si la fuente los trae; si
 * no, los resuelve el facade.
 *
 * Errores del backend de `dev`: transición inválida → 409 `4077`; ficha inexistente o fuera del alcance →
 * 404 `4073`; edición concurrente → 409 `4091`. Siguen llegando como 500 `5000` un campo NOT NULL
 * faltante y un duplicado de (adopción, localidad) o de (slug, adopción). Staging, hasta OPS-1, responde
 * 500 `5000` a casi todo (G-4).
 */
export abstract class FichasLocalesDataSource {
  /**
   * Capacidad de la fuente: `true` si los datos son simulados (mock en memoria) y no se guardan en el
   * servidor. La UI lo avisa de forma persistente, sin saber qué fuente es.
   */
  abstract readonly fuenteSimulada: boolean;
  /** Todas las fichas del alcance (activas e inactivas). El backend no filtra por adopción (G-1). */
  abstract list(): Observable<FichaLocal[]>;
  abstract getById(id: string): Observable<FichaLocal>;
  /** Alta: siempre queda en `BORRADOR`, versión 1. */
  abstract create(form: FichaLocalFormValue): Observable<FichaLocal>;
  /**
   * Reemplazo total del contenido. `estadoActual` viaja tal cual en `publicationStatus`: `dev` ya lo
   * ignora (R-1 resuelto), pero el backend de staging todavía lo aplica. El estado solo cambia con
   * `transicion`.
   */
  abstract update(id: string, form: FichaLocalFormValue, estadoActual: EstadoFicha): Observable<FichaLocal>;
  /** `POST /{id}/submit-review | publish | unpublish`. Inválida → 409 `4077` (500 `5000` en staging hasta OPS-1). */
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
