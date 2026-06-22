/** Superficie pública del feature permisos. Repository expuesto para consumo cross-feature (roles). */
export { PermisosFacade } from './facades/permisos.facade';
export { PermisosRepository } from './repositories/permisos.repository';
export type { PermisoVM, PermisoFormValue } from './models/permiso.vm';
export { providePermisosFeature } from './permisos.providers';
