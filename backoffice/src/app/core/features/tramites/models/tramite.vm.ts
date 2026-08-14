/** Estados del workflow de trámites: borrador → revisión → publicado ↔ despublicado. */
export type TramiteEstado = 'borrador' | 'revision' | 'publicado' | 'despublicado';

/** Referencia mínima a otra entidad (etiqueta, categoría, localidad…) para chips y listados. */
export interface RefVM {
  id: string | number;
  nombre: string;
}

/** ViewModel de Trámite. Aplana `organismo`/`modalidad` a nombre, que es lo que muestran las pantallas. */
export interface TramiteVM {
  id: string;
  titulo: string;
  slug: string;
  resumen: string | null;
  descripcionLarga: string | null;
  requisitos: string | null;
  costos: string | null;
  formularios: string | null;
  contacto: string | null;
  sitioWebTramite: string | null;
  urlOficial: string;
  organismoId: string;
  organismoNombre: string;
  modalidadId: number;
  modalidadNombre: string;
  icono: string;
  estado: TramiteEstado;
  destacado: boolean;
  etiquetas: RefVM[];
  categorias: RefVM[];
  destinatarios: RefVM[];
  localidades: RefVM[];
  eventosDeVida: RefVM[];
  createdAt: string;
  updatedAt: string;
}

/** Valor del formulario de trámite (la ficha provincial). */
export interface TramiteFormValue {
  titulo: string;
  resumen: string;
  descripcionLarga?: string;
  requisitos?: string;
  costos?: string;
  formularios?: string;
  contacto?: string;
  sitioWebTramite?: string;
  urlOficial: string;
  organismoId: string;
  modalidadId: number;
  icono: string;
  etiquetaIds: number[];
  categoriaIds?: number[];
  destinatarioIds?: number[];
  localidadIds?: number[];
  eventoDeVidaIds?: number[];
  destacado?: boolean;
}

/**
 * Consulta del listado. Incluye orden: la lista declaraba `[sortable]` pero el filtro
 * viejo (`TramiteFilter`) no tenía dónde ponerlo, así que los encabezados dibujaban la
 * flecha y no ordenaban nada.
 */
export interface TramiteListQuery {
  search?: string;
  organismoId?: string;
  estado?: TramiteEstado | '';
  localidadId?: number | '';
  sortBy?: string;
  sortDir?: 'asc' | 'desc' | '';
  page: number;
  pageSize: number;
}

/** Una página del listado + el total ya filtrado (lo que alimenta contador y paginador). */
export interface TramitePage {
  rows: TramiteVM[];
  total: number;
}

/** Contenido específico de un trámite para una localidad; lo vacío cae al valor provincial. */
export interface ContenidoLocalidadVM {
  id: number;
  tramiteId: string;
  localidadId: number;
  localidadNombre: string;
  costos: string | null;
  contacto: string | null;
  sitioWeb: string | null;
  urlTramite: string | null;
  horarios: string | null;
  notas: string | null;
}

/** Valor del sub-formulario de contenido por localidad. */
export interface ContenidoLocalidadFormValue {
  localidadId: number;
  costos?: string;
  contacto?: string;
  sitioWeb?: string;
  urlTramite?: string;
  horarios?: string;
  notas?: string;
}

/** Conteos por estado para los chips de filtro. Se piden aparte del listado
 *  porque el total que devuelve una consulta filtrada solo cuenta lo filtrado. */
export interface TramiteConteos {
  todos: number;
  publicado: number;
  revision: number;
}

/** Opciones de los selects del formulario, ya resueltas por el DataSource. */
export interface TramiteCatalogos {
  organismos: RefVM[];
  modalidades: RefVM[];
  etiquetas: RefVM[];
  /** Aplanadas como "Padre > Hija": el formulario elige hojas, no ramas. */
  categorias: RefVM[];
  destinatarios: RefVM[];
  localidades: RefVM[];
  eventosDeVida: RefVM[];
}

/** Todo lo que el formulario necesita para dibujarse: catálogos + el trámite en edición. */
export interface TramiteFormData {
  catalogos: TramiteCatalogos;
  tramite: TramiteVM | null;
}
