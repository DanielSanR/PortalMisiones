export interface TramiteFilterValues {
  search?: string;
  organismoId?: string;
  modalidadId?: number;
  destinatarioId?: number;
  localidadId?: number;
  etiquetaId?: number;
}

export interface BuildUrlOptions {
  basePath?: string;
  preserveParams?: Record<string, string | undefined>;
}

/**
 * Construye una URL de catálogo mezclando los filtros actuales con overrides.
 * Pasar `undefined` en un override elimina ese filtro.
 */
export function buildTramiteFiltersUrl(
  current: TramiteFilterValues,
  overrides: Partial<TramiteFilterValues>,
  options: BuildUrlOptions = {},
): string {
  const { basePath = '/tramites', preserveParams } = options;

  const merged: TramiteFilterValues = {
    search:         'search'         in overrides ? overrides.search         : current.search,
    modalidadId:    'modalidadId'    in overrides ? overrides.modalidadId    : current.modalidadId,
    destinatarioId: 'destinatarioId' in overrides ? overrides.destinatarioId : current.destinatarioId,
    organismoId:    'organismoId'    in overrides ? overrides.organismoId    : current.organismoId,
    localidadId:    'localidadId'    in overrides ? overrides.localidadId    : current.localidadId,
    etiquetaId:     'etiquetaId'     in overrides ? overrides.etiquetaId     : current.etiquetaId,
  };

  const params = new URLSearchParams();
  if (preserveParams) {
    for (const [key, value] of Object.entries(preserveParams)) {
      if (value) params.set(key, value);
    }
  }
  if (merged.search)         params.set('search',         merged.search);
  if (merged.modalidadId)    params.set('modalidadId',    String(merged.modalidadId));
  if (merged.destinatarioId) params.set('destinatarioId', String(merged.destinatarioId));
  if (merged.organismoId)    params.set('organismoId',    merged.organismoId);
  if (merged.localidadId)    params.set('localidadId',    String(merged.localidadId));
  if (merged.etiquetaId)     params.set('etiquetaId',     String(merged.etiquetaId));

  const qs = params.toString();
  return `${basePath}${qs ? `?${qs}` : ''}`;
}

/**
 * URL "Limpiar": basePath + preserveParams, sin filtros.
 */
export function buildCleanUrl(options: BuildUrlOptions = {}): string {
  const { basePath = '/tramites', preserveParams } = options;
  const params = new URLSearchParams();
  if (preserveParams) {
    for (const [key, value] of Object.entries(preserveParams)) {
      if (value) params.set(key, value);
    }
  }
  const qs = params.toString();
  return `${basePath}${qs ? `?${qs}` : ''}`;
}
