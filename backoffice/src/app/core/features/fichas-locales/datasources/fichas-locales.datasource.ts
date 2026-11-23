import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { FichasLocalesFiltro } from '../models/ficha-local.dto';
import { FichaLocal, FichaLocalFormValue } from '../models/ficha-local.vm';
import { TransicionBackend } from '../domain/workflow';

/**
 * Fuente de datos de las fichas por localidad (`/api/organism-procedure-location`, "OTL"): HTTP real
 * o mock en memoria, según `featureOverrides`. Devuelve ids, no nombres: los resuelve el facade.
 *
 * Errores del backend (`dev` @ `586b670`): campo obligatorio faltante → 400 `4012`; ficha, adopción o
 * localidad inexistente o fuera del alcance, y también adopción NO vigente en alta/edición → 404 `4073`;
 * transición inválida → 409 `4077`; dos escrituras SIMULTÁNEAS de la misma ficha → 409 `4091` (el PUT no lleva
 * versión: un formulario viejo que pisa lo que otro guardó NO se rechaza; lo mitiga el facade releyendo antes). Un duplicado de (adopción, localidad)
 * o de (slug, adopción) sigue llegando como 500 `5000` (el servicio no lo valida antes de guardar).
 */
export abstract class FichasLocalesDataSource {
  /**
   * Capacidad de la fuente: `true` si los datos son simulados (mock en memoria) y no se guardan en el
   * servidor. La UI lo avisa de forma persistente, sin saber qué fuente es.
   */
  abstract readonly fuenteSimulada: boolean;
  /**
   * Fichas del alcance (activas e inactivas). Con `filtro.adopcionId` (`?organismProcedureId=`), solo las
   * de esa adopción.
   */
  abstract list(filtro?: FichasLocalesFiltro): Observable<FichaLocal[]>;
  abstract getById(id: string): Observable<FichaLocal>;
  /** Alta: siempre queda en `BORRADOR`, versión 1. La adopción tiene que estar vigente. */
  abstract create(form: FichaLocalFormValue): Observable<FichaLocal>;
  /**
   * Reemplazo total del contenido; el estado de publicación se conserva (solo cambia con `transicion`).
   * La adopción tiene que estar vigente.
   */
  abstract update(id: string, form: FichaLocalFormValue): Observable<FichaLocal>;
  /** `POST /{id}/submit-review | publish | unpublish`. Inválida → 409 `4077`. */
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
