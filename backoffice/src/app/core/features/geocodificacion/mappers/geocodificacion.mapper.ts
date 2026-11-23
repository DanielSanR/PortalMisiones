import { redondearCoordenadas } from '@core/models/ubicacion.model';
import { NominatimLugarDTO } from '../models/lugar.dto';
import { LugarVM } from '../models/lugar.vm';

/** Partes del detalle que no ayudan a distinguir un resultado de otro: el país y el código postal (CPA o viejo). */
const SIN_VALOR = /^(argentina|[a-z]?\d{4}[a-z]{0,3})$/i;

/**
 * DTO de Nominatim → lugar. `display_name` es "número, calle, barrio, ciudad, departamento, provincia, CP, país":
 * el nombre es la calle con su número (o el primer tramo) y el detalle, el resto sin el país ni el código postal.
 * Un resultado sin coordenadas numéricas se descarta (`null`).
 */
export function toLugarVM(dto: NominatimLugarDTO): LugarVM | null {
  const latitud = Number(dto.lat);
  const longitud = Number(dto.lon);
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  const partes = (dto.display_name ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  // "Avenida Uruguay 3150" llega como "3150, Avenida Uruguay": se reúne número y calle.
  const conNumero = /^\d+[a-z]?$/i.test(partes[0] ?? '') && partes.length > 1;
  const nombre = conNumero ? `${partes[1]} ${partes[0]}` : partes[0];
  const resto = partes.slice(conNumero ? 2 : 1).filter((p) => !SIN_VALOR.test(p));
  return {
    id: String(dto.place_id),
    nombre: nombre || 'Lugar sin nombre',
    detalle: resto.join(', '),
    coordenadas: redondearCoordenadas({ latitud, longitud }),
  };
}

export function toLugaresVM(dtos: NominatimLugarDTO[] | null | undefined): LugarVM[] {
  return (dtos ?? []).map(toLugarVM).filter((l): l is LugarVM => l !== null);
}
