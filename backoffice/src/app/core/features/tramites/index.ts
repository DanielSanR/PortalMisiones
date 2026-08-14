/** Superficie pública del feature trámites. Lo interno (datasources, repository) NO se exporta. */
export { TramitesFacade } from './facades/tramites.facade';
export type {
  ContenidoLocalidadFormValue,
  ContenidoLocalidadVM,
  RefVM,
  TramiteCatalogos,
  TramiteConteos,
  TramiteEstado,
  TramiteFormData,
  TramiteFormValue,
  TramiteListQuery,
  TramitePage,
  TramiteVM,
} from './models/tramite.vm';
export { provideTramitesFeature } from './tramites.providers';
