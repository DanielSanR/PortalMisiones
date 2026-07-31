/** Superficie pública del feature localidades (Geografía: departamentos + localidades, referencia cacheada). */
export { LocalidadesFacade } from './facades/localidades.facade';
export { LocalidadesRepository } from './repositories/localidades.repository';
export type { DepartamentoVM, LocalidadVM } from './models/localidad.vm';
export { provideLocalidadesFeature } from './localidades.providers';
