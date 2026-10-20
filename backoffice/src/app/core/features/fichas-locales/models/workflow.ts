import { EstadoFicha } from './ficha-local.vm';

/**
 * Workflow de publicación de una ficha por localidad (PLAN_TRAMITES_API.md §1.4 y §4.2). Funciones
 * puras (hoja): las usan el mock (transiciones del backend) y las pantallas (botones por estado).
 */

/** Endpoint de transición del backend (`POST /{id}/<transición>`). */
export type TransicionBackend = 'submit-review' | 'publish' | 'unpublish';

/**
 * Acción que ofrece la UI. `republicar` usa el mismo endpoint que `publicar` (`DESPUBLICADO →
 * PUBLICADO`, sin revisión). `enviar-y-publicar` es el atajo de P-3 (apagado por
 * `PUBLICACION_POLICY.permitirEnviarYPublicar`): `submit-review` seguido de `publish`.
 */
export type AccionWorkflow = 'enviar-a-revision' | 'publicar' | 'despublicar' | 'republicar' | 'enviar-y-publicar';

/** Permiso que exige cada endpoint (`OrganismProcedureLocationController`). */
export const PERMISO_DE_TRANSICION: Record<TransicionBackend, string> = {
  'submit-review': 'UPDATE_VARIANT',
  publish: 'PUBLISH_VARIANT',
  unpublish: 'PUBLISH_VARIANT',
};

/** Endpoints que dispara cada acción, en orden. */
export const TRANSICIONES_DE_ACCION: Record<AccionWorkflow, readonly TransicionBackend[]> = {
  'enviar-a-revision': ['submit-review'],
  publicar: ['publish'],
  despublicar: ['unpublish'],
  republicar: ['publish'],
  'enviar-y-publicar': ['submit-review', 'publish'],
};

/** Estado destino de cada endpoint. */
export const DESTINO_DE_TRANSICION: Record<TransicionBackend, EstadoFicha> = {
  'submit-review': 'EN_REVISION',
  publish: 'PUBLICADO',
  unpublish: 'DESPUBLICADO',
};

/**
 * `isAllowedTransition` del backend, verbatim. Incluye transiciones sin endpoint (`→ BORRADOR`, G-4)
 * y `BORRADOR → DESPUBLICADO` (vía `unpublish`), que la UI no ofrece.
 */
export const TRANSICIONES_PERMITIDAS: Record<EstadoFicha, readonly EstadoFicha[]> = {
  BORRADOR: ['EN_REVISION', 'DESPUBLICADO'],
  EN_REVISION: ['BORRADOR', 'PUBLICADO'],
  PUBLICADO: ['DESPUBLICADO'],
  DESPUBLICADO: ['PUBLICADO', 'BORRADOR'],
};

export function transicionPermitida(actual: EstadoFicha, destino: EstadoFicha): boolean {
  return TRANSICIONES_PERMITIDAS[actual].includes(destino);
}

/** Acción de la UI para cada estado (tabla "Botones por estado" de §4.2). */
const ACCION_POR_ESTADO: Record<EstadoFicha, AccionWorkflow> = {
  BORRADOR: 'enviar-a-revision',
  EN_REVISION: 'publicar',
  PUBLICADO: 'despublicar',
  DESPUBLICADO: 'republicar',
};

export interface OpcionesWorkflow {
  /** Una ficha desactivada no ofrece workflow: primero hay que reactivarla (editándola). */
  activa?: boolean;
  /** `PUBLICACION_POLICY.permitirEnviarYPublicar` (P-3). */
  permitirEnviarYPublicar?: boolean;
}

/**
 * Acciones de workflow que se ofrecen para una ficha, según su estado y los permisos del usuario
 * (`puede`, normalmente `AuthTokenService.can`). Se decide SOLO por permiso, nunca por rol (D-3).
 * Cada acción exige el permiso de TODOS los endpoints que dispara.
 */
export function accionesDisponibles(
  estado: EstadoFicha,
  puede: (permiso: string) => boolean,
  opciones: OpcionesWorkflow = {},
): AccionWorkflow[] {
  if (opciones.activa === false) return [];
  const candidatas: AccionWorkflow[] = [ACCION_POR_ESTADO[estado]];
  if (estado === 'BORRADOR' && opciones.permitirEnviarYPublicar) candidatas.push('enviar-y-publicar');
  return candidatas.filter((accion) =>
    TRANSICIONES_DE_ACCION[accion].every((t) => puede(PERMISO_DE_TRANSICION[t])));
}
