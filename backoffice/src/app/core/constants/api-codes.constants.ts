/**
 * Catálogo de códigos de NEGOCIO del backend (messages.properties, verbatim).
 * Ver BACKEND_API_SPEC.md §1.6. Estos NO son HTTP status: viajan en `code` de
 * ResponseDTO / MessageDTO / ErrorDTO.
 */
export const API_CODES = {
  // Éxito
  CREATED: 2001,
  UPDATED: 2002,
  DELETED: 2003,
  REGISTERED: 2004,
  PASSWORD_CHANGED: 2005,
  RECOVERY_SENT: 2007,
  STATUS_UPDATED: 2012,
  QUERY_OK: 2013,

  // Negocio / validación
  ACCESS_DENIED: 403,
  ACCOUNT_INACTIVE: 4001,
  USER_ALREADY_REGISTERED: 4002,
  EMAIL_SEND_FAILED: 4003,
  TOKEN_EXPIRED_OR_INVALID: 4004,
  // "Verifique el elemento enviado…": en la asignación de rol, `effectiveTo` no posterior a `effectiveFrom` (400).
  INVALID_ELEMENT: 4011,
  VALIDATION: 4012,
  WRONG_PASSWORD: 4016,
  PASSWORD_MISMATCH_OR_ROLE: 4018,
  USER_NOT_REGISTERED: 4019,
  // Seguridad (capa de filtros → ErrorDTO)
  JWT_INVALID_SIGNATURE: 4005,
  JWT_MALFORMED: 4006,
  JWT_EXPIRED: 4007,
  JWT_UNSUPPORTED: 4008,
  JWT_EMPTY_CLAIMS: 4009,
  RELOGIN_REQUIRED: 4025,
  // 403. También la protección de cuentas privilegiadas (PPDT-5.1, `586b670`): un ADMIN_BACKOFFICE no
  // gestiona cuentas SUPERADMIN/ADMIN_BACKOFFICE ni asigna roles que no sean `assignableByBackoffice`.
  NO_PERMISSION: 4029,
  ACCOUNT_DELETED: 4030,
  WEAK_PASSWORD: 4034,
  USER_NOT_FOUND: 4050,
  // Organismo inexistente al crear un usuario o asignarle un rol (404, `UserService.resolveOrganism`).
  ORGANISM_NOT_FOUND: 4058,
  ROLE_NOT_FOUND: 4059,
  PERMISSION_NOT_FOUND: 4060,
  ROLE_ALREADY_EXISTS: 4061,
  PERMISSION_ALREADY_EXISTS: 4062,
  // Tipo de organismo: el `code` derivado del nombre ya existe (409) / tiene organismos activos y no
  // se puede desactivar ni eliminar (409).
  ORGANISM_TYPE_CODE_TAKEN: 4063,
  REFRESH_INVALID: 4064,
  ORGANISM_TYPE_IN_USE: 4066,
  ORGANISM_ACRONYM_TAKEN: 4069,
  // Taxonomía (genéricos): conflicto de unicidad (ej. slug repetido en el alcance) / entidad inexistente.
  // El duplicado (`4072`) viaja con HTTP 409 desde el backend `586b670` (antes 400). El front decide SIEMPRE
  // por este código, nunca por el status.
  TAXONOMY_CONFLICT: 4072,
  TAXONOMY_NOT_FOUND: 4073,
  // Los mismos 4072/4073, con nombre genérico: ya no son solo de taxonomía (plantillas, adopciones,
  // fichas y puntos de atención los usan para "ya existe" / "no existe o está fuera de tu alcance").
  ENTITY_CONFLICT: 4072,
  ENTITY_NOT_FOUND: 4073,
  // Evento de vida asignado a un trámite: no se puede renombrar (409).
  LIFE_EVENT_ASSIGNED: 4076,
  // Transición de publicación de la ficha no permitida desde el estado actual (409, backend `dev` 5186ab1).
  PUBLICATION_TRANSITION_INVALID: 4077,
  // Adopción solapada: misma plantilla, mismo organismo, vigencias que se pisan (409). El backend de `dev`
  // ya trae el mensaje (en staging desde el 2026-11-16); un backend anterior manda la clave cruda
  // `"response.code.4080"`. El front lo traduce siempre.
  ADOPTION_OVERLAP: 4080,
  // Asignación de rol que se superpone en vigencia con otra del mismo usuario (409).
  ROLE_ASSIGNMENT_OVERLAP: 4081,
  // Edición concurrente: otro usuario guardó el recurso antes (409, `@Version` de la ficha).
  CONCURRENT_MODIFICATION: 4091,

  // Sistema
  UNEXPECTED: 5000,
  DB_ERROR: 5001,
} as const;
