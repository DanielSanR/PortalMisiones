import { AuthMeResponseDTO, AuthUser, OrganismoDeSesion, SessionScope } from '../models/auth.model';

/** Los campos de alcance de la sesión (`AuthUser`), tal como se persisten. */
export type AlcanceDeSesion = Required<Pick<AuthUser, 'scope' | 'organismoId' | 'organismoNombre' | 'organismoSigla'>>;

/** Sesión sin alcance conocido ni organismo: lo que queda cuando el backend dice que ya no lo tiene. */
export const SIN_ALCANCE: AlcanceDeSesion = Object.freeze({
  scope: null, organismoId: null, organismoNombre: null, organismoSigla: null,
});

const SIN_TEXTO = /^\s*$/;

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && !SIN_TEXTO.test(valor) ? valor.trim() : null;
}

/** `"global"` | `"organismo"` (sin distinguir mayúsculas); cualquier otra cosa = no informado. */
function aScope(valor: unknown): SessionScope | null {
  const scope = texto(valor)?.toLowerCase();
  return scope === 'global' || scope === 'organismo' ? scope : null;
}

/**
 * Alcance y organismo de la sesión a partir de `GET /api/auth/me` (backend `dev` @ `586b670`, G-2).
 *
 * - Backend nuevo: `scope` + `organismId`/`organismName`/`organismAcronym` (los tres `null` si es global).
 * - Backend anterior (no manda `scope`) o `/me` caído: `scope` queda `null` y el organismo sale, como
 *   antes, del claim `organismoId` del JWT (que el backend real nunca emitió): todo se comporta como hoy.
 * - Un `scope: "global"` nunca lleva organismo, aunque viniera uno.
 * - Un `organismId` sin `scope` se toma como alcance de organismo (el dato manda sobre la etiqueta).
 */
export function alcanceDeSesion(me: AuthMeResponseDTO | null, claimOrganismoId?: string | null): AlcanceDeSesion {
  const scopeInformado = aScope(me?.scope);
  const organismoId = scopeInformado === 'global' ? null : texto(me?.organismId) ?? texto(claimOrganismoId);
  const deMe = !!texto(me?.organismId) && scopeInformado !== 'global';
  return {
    scope: scopeInformado ?? (deMe ? 'organismo' : null),
    organismoId,
    organismoNombre: deMe ? texto(me?.organismName) : null,
    organismoSigla: deMe ? texto(me?.organismAcronym) : null,
  };
}

/** Nombre genérico cuando la sesión trae el id del organismo pero no su nombre ni su sigla. */
export const ORGANISMO_SIN_NOMBRE = 'Tu organismo';

/**
 * Organismo al que pertenece la sesión, o `null` si es global o no se sabe (backend anterior a G-2).
 * Con él se arma la opción del select "Organismo" sin pedir `GET /api/organism`.
 */
export function organismoDeSesion(user: AuthUser | null | undefined): OrganismoDeSesion | null {
  if (!user?.organismoId || user.scope === 'global') return null;
  const sigla = texto(user.organismoSigla);
  return { id: user.organismoId, nombre: texto(user.organismoNombre) ?? sigla ?? ORGANISMO_SIN_NOMBRE, sigla };
}

/** "Instituto de Previsión Social (IPS)"; sin sigla (o si el nombre ya es la sigla), solo el nombre. */
export function etiquetaDeOrganismo(organismo: OrganismoDeSesion): string {
  return organismo.sigla && organismo.sigla !== organismo.nombre
    ? `${organismo.nombre} (${organismo.sigla})`
    : organismo.nombre;
}

/** Inicio común del hint de un campo "Organismo" fijado (solo lectura) por el alcance de la sesión. */
export function hintDeOrganismoPropio(organismo: OrganismoDeSesion): string {
  return `Tu cuenta pertenece a ${etiquetaDeOrganismo(organismo)}`;
}
