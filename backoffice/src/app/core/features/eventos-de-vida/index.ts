/** Superficie pública del feature eventos-de-vida. Repository expuesto para consumo cross-feature (dashboard). */
export { EventosDeVidaFacade } from './facades/eventos-de-vida.facade';
export { EventosDeVidaRepository } from './repositories/eventos-de-vida.repository';
export type { EventoDeVidaVM, EventoDeVidaFormValue } from './models/evento-de-vida.vm';
export { provideEventosDeVidaFeature } from './eventos-de-vida.providers';
