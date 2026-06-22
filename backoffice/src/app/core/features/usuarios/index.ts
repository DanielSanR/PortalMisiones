/** Superficie pública del feature usuarios. Lo interno (datasources, repository) NO se exporta. */
export { UsuariosFacade } from './facades/usuarios.facade';
export type { UsuarioVM, UsuarioFormValue, UsuarioFormData } from './models/usuario.vm';
export { provideUsuariosFeature } from './usuarios.providers';
