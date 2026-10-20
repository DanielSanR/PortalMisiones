/**
 * Etiquetas legibles para el diff del detalle de auditoría. El backend registra los datos con las claves
 * técnicas del modelo (`urlOficial`, `modalidadId`…); la persona que audita lee "URL oficial", "Modalidad".
 */
const ETIQUETAS_CAMPO: Record<string, string> = {
  titulo: 'Título',
  slug: 'Slug',
  resumen: 'Resumen',
  descripcion: 'Descripción',
  descripcionLarga: 'Descripción larga',
  estado: 'Estado',
  destacado: 'Destacado',
  activo: 'Activo',
  activa: 'Activa',
  habilitada: 'Habilitado',
  url: 'URL del trámite',
  urlOficial: 'URL oficial',
  requisitos: 'Requisitos',
  costos: 'Costos',
  version: 'Versión',
  modalidadId: 'Modalidad',
  organismoId: 'Organismo',
  localidadId: 'Localidad',
  categoriaIds: 'Categorías',
  categoriaPrincipalId: 'Categoría principal',
  etiquetaIds: 'Etiquetas',
  destinatarioIds: 'Destinatarios',
  eventoDeVidaIds: 'Eventos de vida',
  vigenteDesde: 'Vigente desde',
  vigenteHasta: 'Vigente hasta',
  nombre: 'Nombre',
};

/** Fila del diff lista para mostrar. */
export interface CampoAuditoria {
  clave: string;
  etiqueta: string;
  valor: string;
}

/** "urlOficial" → "Url oficial": último recurso para una clave que el diccionario no conoce. */
function humanizar(clave: string): string {
  const texto = clave
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatearValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (Array.isArray(valor)) return valor.length ? valor.map(formatearValor).join(', ') : '—';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

/** Convierte los datos crudos de un registro en filas legibles (etiqueta + valor). */
export function camposDeAuditoria(datos: Record<string, unknown> | null | undefined): CampoAuditoria[] {
  return Object.entries(datos ?? {}).map(([clave, valor]) => ({
    clave,
    etiqueta: ETIQUETAS_CAMPO[clave] ?? humanizar(clave),
    valor: formatearValor(valor),
  }));
}
