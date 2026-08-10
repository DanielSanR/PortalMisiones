/** Superficie pública del feature categorias. Repository expuesto para consumo cross-feature (dashboard). */
export { CategoriasFacade } from './facades/categorias.facade';
export { CategoriasRepository } from './repositories/categorias.repository';
export type { CategoriaVM, CategoriaNode, CategoriaFormValue } from './models/categoria.vm';
export { provideCategoriasFeature } from './categorias.providers';
