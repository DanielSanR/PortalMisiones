/** Superficie pública del feature roles. Repository expuesto para consumo cross-feature (usuarios). */
export { RolesFacade } from './facades/roles.facade';
export { RolesRepository } from './repositories/roles.repository';
export type { RolVM, RolFormValue, RolFormData } from './models/role.vm';
// Tipo de dominio del scope de rol, re-exportado como parte de la superficie pública del feature.
export type { RoleScopeType } from '@core/models/role.model';
export { provideRolesFeature } from './roles.providers';
