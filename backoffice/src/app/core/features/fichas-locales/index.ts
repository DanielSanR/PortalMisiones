/** Superficie pública del feature fichas por localidad (`OrganismProcedureLocation`, "OTL") y su workflow. */
export { FichasLocalesFacade } from './facades/fichas-locales.facade';
export type { ResolverAccionesWorkflow } from './facades/fichas-locales.facade';
export type {
  EstadoFicha, FichaLocal, FichaLocalVM, FichaLocalFormValue, FichaFormData, FichaAdopcionResumen, FichaLocalidadOpcion,
  FichasDeAdopcion, MotivoNoVigente, FichaBase, FichaGuardada,
} from './models/ficha-local.vm';
export { DespublicacionFallidaError, FichaCambiadaError, FichaSinContenidoError } from './domain/ficha-errores';
export {
  MAX_SLUG, errorDeLocalidad, errorDeUrl, localidadOcupada, localidadOcupadaPorDesactivada, reactivacionDuplicada,
  slugRepetido, slugSinContenido,
} from './domain/ficha-validaciones';
export type { ErrorDeLocalidad, ErrorDeUrl, FichasOcupadas } from './domain/ficha-validaciones';
export { accionesDisponibles, transicionPermitida } from './domain/workflow';
export type { AccionWorkflow, OpcionesWorkflow, TransicionBackend } from './domain/workflow';
export { provideFichasLocalesFeature } from './fichas-locales.providers';
