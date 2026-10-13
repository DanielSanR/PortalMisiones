import { AttentionPointRequestDTO, AttentionPointResponseDTO } from '../models/punto-atencion.dto';
import { PuntoAtencionFormValue, PuntoAtencionVM } from '../models/punto-atencion.vm';

/** Decimales de `NUMERIC(9,6)`. */
export const DECIMALES_COORDENADA = 6;

/** Redondea a 6 decimales (lo que guarda la base), sin arrastrar el error de coma flotante. */
export function redondearCoordenada(valor: number): number {
  return Number(valor.toFixed(DECIMALES_COORDENADA));
}

function aNumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

function textoONull(valor: string | null | undefined): string | null {
  const limpio = (valor ?? '').trim();
  return limpio ? limpio : null;
}

export function toPuntoAtencionVM(dto: AttentionPointResponseDTO): PuntoAtencionVM {
  return {
    id: dto.id,
    fichaId: dto.organismProcedureLocationId,
    nombre: dto.name,
    direccion: dto.address,
    contacto: textoONull(dto.contactInfo),
    horarios: textoONull(dto.openingHours),
    latitud: aNumero(dto.latitude),
    longitud: aNumero(dto.longitude),
    activo: dto.active,
  };
}

/** Form → request: textos recortados, opcionales vacíos como `null`, coordenadas redondeadas a 6 decimales. */
export function toAttentionPointRequest(form: PuntoAtencionFormValue): AttentionPointRequestDTO {
  return {
    organismProcedureLocationId: form.fichaId,
    name: form.nombre.trim(),
    address: form.direccion.trim(),
    contactInfo: textoONull(form.contacto),
    openingHours: textoONull(form.horarios),
    latitude: redondearCoordenada(form.latitud),
    longitude: redondearCoordenada(form.longitud),
    active: form.activo,
  };
}
