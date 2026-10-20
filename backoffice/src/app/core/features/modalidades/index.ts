/** Superficie pública del feature modalidades. */
export { ModalidadesFacade } from './facades/modalidades.facade';
export { ModalidadesRepository } from './repositories/modalidades.repository'; // consumido cross-feature (plantillas)
export type { ModalidadVM, ModalidadFormValue } from './models/modalidad.vm';
export { provideModalidadesFeature } from './modalidades.providers';
