/** Superficie pública del feature organismos. Lo interno (datasources) NO se exporta. */
export { OrganismosRepository } from './repositories/organismos.repository';
export type { OrganismoOption } from './models/organismo.vm';
export { provideOrganismosFeature } from './organismos.providers';
