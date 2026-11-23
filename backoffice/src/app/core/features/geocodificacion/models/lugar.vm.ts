import { Coordenadas } from '@core/models/ubicacion.model';

/** Un lugar encontrado por la geocodificación: nombre legible y dónde queda. */
export interface LugarVM {
  id: string;
  /** Lo primero del nombre (la calle y el número, o el lugar). */
  nombre: string;
  /** El resto, para distinguir resultados parecidos ("Posadas, Capital, Misiones"). */
  detalle: string;
  coordenadas: Coordenadas;
}
