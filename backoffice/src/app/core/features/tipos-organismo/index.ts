/** Superficie pública del feature tipos-organismo. */
export { TiposOrganismoFacade } from './facades/tipos-organismo.facade';
export { TiposOrganismoRepository } from './repositories/tipos-organismo.repository'; // consumido cross-feature (form de organismos)
export type { TipoOrganismoVM, TipoOrganismoOption, TipoOrganismoFormValue } from './models/tipo-organismo.vm';
export { provideTiposOrganismoFeature } from './tipos-organismo.providers';
