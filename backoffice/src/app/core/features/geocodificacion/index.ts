/** Superficie pública del feature geocodificación (dirección → lugar en el mapa; servicio externo Nominatim). */
export { GeocodificacionFacade } from './facades/geocodificacion.facade';
export type { LugarVM } from './models/lugar.vm';
export { provideGeocodificacionFeature } from './geocodificacion.providers';
