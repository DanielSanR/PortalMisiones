import { OrganismProcedureRequestDTO, OrganismProcedureResponseDTO } from '../models/adopcion.dto';
import { Adopcion, AdopcionFormValue } from '../models/adopcion.vm';

/** `LocalDateTime` de Jackson: `yyyy-MM-ddTHH:mm`, con segundos y fracción opcionales. */
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

/**
 * `LocalDateTime` del backend → `Date` en hora local. No se usa `new Date(texto)` a ciegas: un ISO
 * sin zona se interpreta distinto según el formato (solo fecha = UTC), y acá la hora es siempre local.
 */
export function parseLocalDateTime(valor: string): Date {
  const partes = LOCAL_DATE_TIME.exec(valor.trim());
  if (!partes) return new Date(valor);
  const [, anio, mes, dia, hora, minuto, segundo] = partes;
  return new Date(Number(anio), Number(mes) - 1, Number(dia), Number(hora), Number(minuto), Number(segundo ?? 0));
}

/** `Date` → `yyyy-MM-ddTHH:mm:ss` en hora local, SIN zona ni milisegundos (lo que espera `LocalDateTime`). */
export function toLocalDateTime(fecha: Date): string {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`
    + `T${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}:${dosDigitos(fecha.getSeconds())}`;
}

/** `OrganismProcedureResponseDTO` → adopción (sin nombres ni estado de vigencia: los pone el facade). */
export function toAdopcion(dto: OrganismProcedureResponseDTO): Adopcion {
  return {
    id: dto.id,
    plantillaId: dto.procedureTemplateId,
    organismoId: dto.organismId,
    organismoTitularId: dto.ownerOrganismId ?? null,
    habilitada: dto.enabled,
    vigenteDesde: parseLocalDateTime(dto.effectiveFrom),
    vigenteHasta: dto.effectiveTo ? parseLocalDateTime(dto.effectiveTo) : null,
  };
}

/**
 * Form → request. Las fechas se mandan TAL CUAL, como `LocalDateTime` sin zona: decidir los bordes
 * del día (00:00:00 / 23:59:59) es de quien arma el form, para poder reenviar sin tocar las horas
 * originales de una vigencia que no se editó (el PUT es total). `enabled` y `ownerOrganismId` van
 * siempre.
 */
export function toOrganismProcedureRequest(form: AdopcionFormValue): OrganismProcedureRequestDTO {
  return {
    procedureTemplateId: form.plantillaId,
    organismId: form.organismoId,
    ownerOrganismId: form.organismoTitularId || null,
    enabled: form.habilitada,
    effectiveFrom: toLocalDateTime(form.vigenteDesde),
    effectiveTo: form.vigenteHasta ? toLocalDateTime(form.vigenteHasta) : null,
  };
}
