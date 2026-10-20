/** Superficie pública del feature destinatarios. */
export { DestinatariosFacade } from './facades/destinatarios.facade';
export { DestinatariosRepository } from './repositories/destinatarios.repository'; // consumido cross-feature (plantillas)
export type { DestinatarioVM, DestinatarioFormValue } from './models/destinatario.vm';
export { provideDestinatariosFeature } from './destinatarios.providers';
