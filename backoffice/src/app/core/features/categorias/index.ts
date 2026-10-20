/** Superficie pública del feature categorias. */
export { CategoriasFacade } from './facades/categorias.facade';
export { CategoriasRepository } from './repositories/categorias.repository'; // consumido cross-feature (plantillas)
export type { CategoriaVM, CategoriaNode, CategoriaFormValue } from './models/categoria.vm';
export { provideCategoriasFeature } from './categorias.providers';
