/** Superficie pública del feature eventos-de-vida. */
export { EventosDeVidaFacade } from './facades/eventos-de-vida.facade';
export { EventosDeVidaRepository } from './repositories/eventos-de-vida.repository'; // consumido cross-feature (plantillas)
export type { EventoDeVidaVM, EventoDeVidaFormValue } from './models/evento-de-vida.vm';
export { provideEventosDeVidaFeature } from './eventos-de-vida.providers';
