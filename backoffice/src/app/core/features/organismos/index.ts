/** Superficie pública del feature organismos. Lo interno (datasources) NO se exporta. */
export { OrganismosFacade } from './facades/organismos.facade';
export { OrganismosRepository } from './repositories/organismos.repository'; // consumido cross-feature (usuarios)
export type { OrganismoOption, OrganismoVM, OrganismoDetalleVM, OrganismoFormValue } from './models/organismo.vm';
export { provideOrganismosFeature } from './organismos.providers';
