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
  NO_PERMISSION: 4029,
  ACCOUNT_DELETED: 4030,
  WEAK_PASSWORD: 4034,
  USER_NOT_FOUND: 4050,
  ROLE_NOT_FOUND: 4059,
  PERMISSION_NOT_FOUND: 4060,
  ROLE_ALREADY_EXISTS: 4061,
  PERMISSION_ALREADY_EXISTS: 4062,
  REFRESH_INVALID: 4064,
  ORGANISM_ACRONYM_TAKEN: 4069,
  // Taxonomía (genéricos): conflicto de unicidad (ej. slug repetido en el alcance) / entidad inexistente.
  TAXONOMY_CONFLICT: 4072,
  TAXONOMY_NOT_FOUND: 4073,
  // Los mismos 4072/4073, con nombre genérico: ya no son solo de taxonomía (plantillas, adopciones,
  // fichas y puntos de atención los usan para "ya existe" / "no existe o está fuera de tu alcance").
  ENTITY_CONFLICT: 4072,
  ENTITY_NOT_FOUND: 4073,
  // Adopción solapada: misma plantilla, mismo organismo, vigencias que se pisan (409). Sin mensaje en
  // `messages.properties`: llega `"response.code.4080"` y el front lo traduce.
  ADOPTION_OVERLAP: 4080,

  // Sistema
  UNEXPECTED: 5000,
  DB_ERROR: 5001,
} as const;
