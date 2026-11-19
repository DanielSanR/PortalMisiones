import { UserRole } from '../enums/user-role.enum';
import { AccessRule } from '../models/access-rule.model';

/**
 * Prerrequisitos de una acción en el FRONT, además del permiso atómico que exige el backend.
 * No endurecen la política del backend: modelan lo que la pantalla necesita leer para funcionar.
 */
export interface Prerrequisito {
  /** Permisos que también hay que tener (todos). */
  permissions?: string[];
  /** Roles de los que hay que tener al menos uno. */
  roles?: UserRole[];
  /** Además, debe cumplirse al menos una de estas alternativas (misma semántica que `AccessRule.anyOf`). */
  anyOf?: AccessRule[];
}

/**
 * De dónde sale el organismo de un formulario con alcance de organismo: o el usuario puede leer el
 * catálogo (`GET /api/organism` → `READ_ORGANISM`) y lo elige en el select, o su sesión ya está atada a
 * uno (`scope: "organismo"` de `/api/auth/me`, backend `586b670`, G-2) y el campo viene preseleccionado y
 * bloqueado con ese, sin pedir el catálogo. Con un backend anterior (sin esos campos en `/me`) la segunda
 * alternativa nunca se cumple y todo queda como antes: hace falta `READ_ORGANISM`.
 */
const ORGANISMO_ELEGIBLE: AccessRule[] = [
  { permissions: ['READ_ORGANISM'] },
  { organismoPropio: true },
];

/**
 * El formulario de usuario necesita el organismo (ver `ORGANISMO_ELEGIBLE`) y el catálogo de roles
 * (`GET /api/role/allowed` → `hasRole` SUPERADMIN, ADMIN_BACKOFFICE o ADMIN_ORGANIZATION).
 * Sin eso el form no puede armarse, aunque el backend acepte `CREATE_USER`/`UPDATE_USER`.
 *
 * Antes de G-2 exigía `READ_ORGANISM` a secas. Ahora un usuario de organismo (ADMIN_ORGANIZATION) no lo
 * necesita: el backend le pisa el organismo con el suyo (`UserService.validateUserCreationPermissions`) y
 * el form lo muestra fijo. Un rol global (SA/AB) sigue necesitándolo para poder elegir.
 */
const FORM_USUARIO: Prerrequisito = {
  roles: [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE, UserRole.ADMIN_ORGANIZATION],
  anyOf: ORGANISMO_ELEGIBLE,
};

/**
 * Prerrequisitos por permiso. Fuente de verdad única: los aplica `canPerform`, así que nav, guard,
 * directiva y acciones de fila quedan alineados. Solo va acá un permiso cuyo ÚNICO uso en la UI
 * requiere el prerrequisito (crear usuario = abrir el form).
 */
export const PERMISSION_PREREQUISITES: Record<string, Prerrequisito> = {
  CREATE_USER: FORM_USUARIO,
};

/**
 * Editar un usuario abre el mismo form, pero `UPDATE_USER` también habilita acciones que no lo
 * necesitan (email, contraseña, activar/desactivar). Por eso el prerrequisito va solo en la ruta de
 * edición y en la acción "Editar", no en el permiso.
 */
export const EDITAR_USUARIO_ACCESS: AccessRule = {
  permissions: ['UPDATE_USER'],
  requireRoles: FORM_USUARIO.roles,
  anyOf: FORM_USUARIO.anyOf,
};

/**
 * Roles y Permisos (`/api/role`, `/api/permission`) se autorizan por ROL, no por permiso atómico.
 * Desde PPDT-5.1 (`0ea13a0`): leer = SUPERADMIN o ADMIN_BACKOFFICE; crear/editar/eliminar = solo
 * SUPERADMIN. Las usan ruta, nav, buscador de comandos, botón "Nuevo", CTA del vacío y acciones de fila.
 */
export const LEER_ROLES_PERMISOS_ACCESS: AccessRule = {
  requireRoles: [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE],
};

export const ESCRIBIR_ROLES_PERMISOS_ACCESS: AccessRule = {
  requireRoles: [UserRole.SUPERADMIN],
};

/**
 * "Adoptar trámite" (`POST /api/organism-procedure` → `CREATE_ADOPTION`). El diálogo lista las
 * plantillas activas (`GET /api/procedure-template` → `READ_PROCEDURE`) y necesita un organismo
 * (`ORGANISMO_ELEGIBLE`): el del select (`READ_ORGANISM`) o el de la sesión. Decisión P-2
 * (PLAN_TRAMITES_API.md §8), actualizada con G-2 resuelto (backend `586b670`): quien no puede leer
 * organismos ni tiene uno propio en la sesión sigue sin ver "Adoptar", porque el front no tendría qué
 * mandar en `organismId`. `CREATE_ADOPTION` está asignado a SA, AB y AO (R-3: `V2.28`; AGENT no, `V2.30`)
 * y `READ_PROCEDURE` a AO desde `V2.31`: con el organismo en la sesión, AO ya puede adoptar para el suyo.
 * Va en el botón del header, el CTA del vacío y el buscador de comandos.
 */
export const ADOPTAR_ACCESS: AccessRule = {
  permissions: ['CREATE_ADOPTION', 'READ_PROCEDURE'],
  mode: 'all',
  anyOf: ORGANISMO_ELEGIBLE,
};

/**
 * "Nueva etiqueta" (`POST /api/tag` → `CREATE_TAG`; seed: SA, AB, AO, AGENT). El backend acota el
 * alcance: SA/AB crean globales o locales de cualquier organismo; el resto (AO/AGENT) solo locales de
 * SU organismo (global u otro organismo → `4073`). El alcance sale de `ORGANISMO_ELEGIBLE`: el select
 * (`READ_ORGANISM`) o el organismo de la sesión (BO-20/G-2, backend `586b670`), que el form preselecciona
 * y bloquea como alcance local. Quien no es SA/AB, no tiene `READ_ORGANISM` y tampoco trae organismo en
 * la sesión (backend anterior a G-2) no tiene ningún alcance válido para elegir: se le oculta "Crear"
 * (botón del header, CTA del vacío, ruta `etiquetas/nuevo` y buscador de comandos).
 * Listar, editar y borrar sus etiquetas locales siguen con `READ_TAG`/`UPDATE_TAG`/`DELETE_TAG`.
 *
 * No vuelve a ser solo `{ permissions: ['CREATE_TAG'] }` mientras haya algún entorno sin G-2 desplegado.
 */
export const CREAR_ETIQUETA_ACCESS: AccessRule = {
  permissions: ['CREATE_TAG'],
  anyOf: [
    ...ORGANISMO_ELEGIBLE,
    { requireRoles: [UserRole.SUPERADMIN, UserRole.ADMIN_BACKOFFICE] },
  ],
};

/**
 * "Agregar localidad" / alta de ficha por localidad (`POST /api/organism-procedure-location` →
 * `CREATE_VARIANT`). La ficha cuelga de una adopción: el form la lee (`GET /api/organism-procedure/{id}`
 * → `READ_ADOPTION`) para mostrar el trámite y sugerir el slug (P-5). Hoy: SA y AO (AGENT no crea).
 * Va en la ruta `tramites/fichas/nueva`, en el botón del detalle del trámite del organismo y en su vacío.
 */
export const CREAR_FICHA_ACCESS: AccessRule = {
  permissions: ['CREATE_VARIANT', 'READ_ADOPTION'],
  mode: 'all',
};

/** Política de publicación de fichas (D-3). Ver `PUBLICACION_POLICY`. */
export interface PoliticaPublicacion {
  /**
   * Quién aprueba la publicación. SOLO cambia textos ("la revisa y publica tu organismo" / "…la
   * Subsecretaría"): quién puede publicar lo decide siempre el permiso `PUBLISH_VARIANT`, nunca el rol.
   */
  aprobador: 'organismo' | 'provincial';
  /** Atajo "Enviar y publicar" (`submit-review` + `publish`) para quien tiene los dos permisos (P-3). */
  permitirEnviarYPublicar: boolean;
}

/**
 * D-3 configurable (PLAN_TRAMITES_API.md §4.3, decisión P-3 de §8): workflow explícito, sin atajo,
 * mientras D-3/G-5 sigan abiertas. Si producto cambia D-3, el backend reasigna `PUBLISH_VARIANT` en el
 * seed y acá solo cambian los textos. Prohibido usar `requireRoles` en el workflow.
 */
export const PUBLICACION_POLICY: PoliticaPublicacion = {
  aprobador: 'organismo',
  permitirEnviarYPublicar: false,
};
