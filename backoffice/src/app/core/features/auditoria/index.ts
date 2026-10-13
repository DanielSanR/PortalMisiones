/** Superficie pública del feature auditoría. */
export { AuditoriaFacade } from './facades/auditoria.facade';
export type {
  AuditoriaAccion,
  AuditoriaRegistroVM,
  AuditoriaQuery,
  AuditoriaPaginaVM,
} from './models/auditoria.vm';
export { provideAuditoriaFeature } from './auditoria.providers';
