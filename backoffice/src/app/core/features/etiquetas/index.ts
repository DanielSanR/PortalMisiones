/** Superficie pública del feature etiquetas. */
export { EtiquetasFacade } from './facades/etiquetas.facade';
export { EtiquetasRepository } from './repositories/etiquetas.repository'; // consumido cross-feature (plantillas)
export type { EtiquetaVM, EtiquetaFormValue, EtiquetaFormData } from './models/etiqueta.vm';
export { provideEtiquetasFeature } from './etiquetas.providers';
