/** Superficie pública del feature fichas por localidad (`OrganismProcedureLocation`, "OTL") y su workflow. */
export { FichasLocalesFacade } from './facades/fichas-locales.facade';
export type { ResolverAccionesWorkflow } from './facades/fichas-locales.facade';
export type {
  EstadoFicha, FichaLocal, FichaLocalVM, FichaLocalFormValue, FichaFormData, FichaAdopcionResumen, FichaLocalidadOpcion,
  FichasDeAdopcion, MotivoNoVigente, FichaBase, FichaGuardada,
} from './models/ficha-local.vm';
export { DespublicacionFallidaError, FichaCambiadaError, FichaSinContenidoError } from './models/ficha-errores';
export { accionesDisponibles, transicionPermitida } from './models/workflow';
export type { AccionWorkflow, OpcionesWorkflow, TransicionBackend } from './models/workflow';
export { provideFichasLocalesFeature } from './fichas-locales.providers';
