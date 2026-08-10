/** Superficie pública del feature destinatarios. Repository expuesto para consumo cross-feature (dashboard). */
export { DestinatariosFacade } from './facades/destinatarios.facade';
export { DestinatariosRepository } from './repositories/destinatarios.repository';
export type { DestinatarioVM, DestinatarioFormValue } from './models/destinatario.vm';
export { provideDestinatariosFeature } from './destinatarios.providers';
