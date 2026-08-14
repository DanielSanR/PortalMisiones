import { Tramite, TramiteContenidoLocalidad, TramiteCreate } from '@core/models/tramite.model';
import {
  ContenidoLocalidadFormValue,
  ContenidoLocalidadVM,
  RefVM,
  TramiteFormValue,
  TramiteVM,
} from '../models/tramite.vm';

/** Normaliza las listas de referencias, que el backend puede omitir. */
function toRefs(items: { id: string | number; nombre: string }[] | undefined): RefVM[] {
  return (items ?? []).map((item) => ({ id: item.id, nombre: item.nombre }));
}

/**
 * DTO → ViewModel.
 *
 * Aplana `organismo`/`modalidad` a su nombre y cae a un guion cuando el backend no
 * expande la relación: las pantallas mostraban `undefined` en la celda.
 */
export function toTramiteVM(dto: Tramite): TramiteVM {
  return {
    id: dto.id,
    titulo: dto.titulo,
    slug: dto.slug,
    resumen: dto.resumen,
    descripcionLarga: dto.descripcionLarga,
    requisitos: dto.requisitos,
    costos: dto.costos,
    formularios: dto.formularios,
    contacto: dto.contacto,
    sitioWebTramite: dto.sitioWebTramite,
    urlOficial: dto.urlOficial,
    organismoId: dto.organismoId,
    organismoNombre: dto.organismo?.nombre ?? '—',
    modalidadId: dto.modalidadId,
    modalidadNombre: dto.modalidad?.nombre ?? '—',
    icono: dto.icono,
    estado: dto.estado,
    destacado: dto.destacado,
    etiquetas: toRefs(dto.etiquetas),
    categorias: toRefs(dto.categorias),
    destinatarios: toRefs(dto.destinatarios),
    localidades: toRefs(dto.localidades),
    eventosDeVida: toRefs(dto.eventosDeVida),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

/** Formulario → DTO de alta/edición. */
export function toTramiteCreateDTO(form: TramiteFormValue): TramiteCreate {
  return {
    titulo: form.titulo,
    resumen: form.resumen,
    descripcionLarga: form.descripcionLarga,
    requisitos: form.requisitos,
    costos: form.costos,
    formularios: form.formularios,
    contacto: form.contacto,
    sitioWebTramite: form.sitioWebTramite,
    urlOficial: form.urlOficial,
    organismoId: form.organismoId,
    modalidadId: form.modalidadId,
    icono: form.icono,
    etiquetaIds: form.etiquetaIds ?? [],
    categoriaIds: form.categoriaIds,
    destinatarioIds: form.destinatarioIds,
    localidadIds: form.localidadIds,
    eventoDeVidaIds: form.eventoDeVidaIds,
    destacado: form.destacado,
  };
}

export function toContenidoLocalidadVM(dto: TramiteContenidoLocalidad): ContenidoLocalidadVM {
  return {
    id: dto.id,
    tramiteId: dto.tramiteId,
    localidadId: dto.localidadId,
    localidadNombre: dto.localidadNombre ?? 'Localidad sin nombre',
    costos: dto.costos,
    contacto: dto.contacto,
    sitioWeb: dto.sitioWeb,
    urlTramite: dto.urlTramite,
    horarios: dto.horarios,
    notas: dto.notas,
  };
}

/** Los campos vacíos se omiten: el backend los interpreta como "usar el valor provincial". */
export function toContenidoLocalidadDTO(form: ContenidoLocalidadFormValue) {
  return {
    localidadId: form.localidadId,
    costos: form.costos || undefined,
    contacto: form.contacto || undefined,
    sitioWeb: form.sitioWeb || undefined,
    urlTramite: form.urlTramite || undefined,
    horarios: form.horarios || undefined,
    notas: form.notas || undefined,
  };
}
