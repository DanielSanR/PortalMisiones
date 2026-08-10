/** Superficie pública del feature modalidades. Repository expuesto para consumo cross-feature (dashboard). */
export { ModalidadesFacade } from './facades/modalidades.facade';
export { ModalidadesRepository } from './repositories/modalidades.repository';
export type { ModalidadVM, ModalidadFormValue } from './models/modalidad.vm';
export { provideModalidadesFeature } from './modalidades.providers';
