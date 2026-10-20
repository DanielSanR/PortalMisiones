/** Superficie pública del feature adopciones ("Trámites del organismo", `OrganismProcedure`). */
export { AdopcionesFacade } from './facades/adopciones.facade';
// Consumido cross-feature por fichas por localidad (fase 3): de qué adopción es cada ficha.
export { AdopcionesRepository } from './repositories/adopciones.repository';
export type {
  Adopcion, AdopcionVM, AdopcionFormValue, AdopcionOpcion, AdopcionOpciones, EstadoVigencia,
} from './models/adopcion.vm';
export { provideAdopcionesFeature } from './adopciones.providers';
