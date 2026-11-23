import { MembreteDato } from '@shared/components/membrete/membrete.component';
import { OrganismoVM } from '@features/organismos';

/**
 * Lo que la ficha de organismo MUESTRA, derivado de lo cargado o de lo que se está escribiendo: el membrete y
 * los campos de la tarjeta de lectura. Funciones puras; los nombres de los catálogos se resuelven por id.
 */

/** Un ítem de catálogo tal como lo entrega `getFormData` (tipo, localidad u organismo). */
interface ConNombre {
  id: string;
  nombre: string;
}

/** Nombres de los catálogos por id, para el membrete y la tarjeta de lectura. */
export interface CatalogosDeOrganismo {
  tipos: Map<string, string>;
  organismos: Map<string, string>;
  localidades: Map<string, string>;
}

/** Antes de la carga: no hay nombres que resolver. */
export const SIN_CATALOGOS: CatalogosDeOrganismo = { tipos: new Map(), organismos: new Map(), localidades: new Map() };

export function catalogosDe(datos: { tipos: ConNombre[]; organismos: ConNombre[]; localidades: ConNombre[] }): CatalogosDeOrganismo {
  const porId = (items: ConNombre[]): Map<string, string> => new Map(items.map((i) => [i.id, i.nombre]));
  return { tipos: porId(datos.tipos), organismos: porId(datos.organismos), localidades: porId(datos.localidades) };
}

/**
 * Lo que muestra el membrete. En lectura sale del organismo guardado; editando o dando de alta
 * sale del formulario, así se actualiza mientras el usuario escribe.
 */
export interface Membrete {
  nombre: string;
  /** Sigla o iniciales del nombre; vacío cuando todavía no hay nada escrito (se dibuja un ícono). */
  iniciales: string;
  activo: boolean;
  /** Línea meta: tipo (si hay) · "Depende de X" u "Organismo raíz" · localidad base (si hay). */
  datos: MembreteDato[];
}

/** Valores (del organismo o del formulario) que alimentan el membrete. */
export interface DatosMembrete {
  nombre: string;
  acronym: string;
  typeId: string;
  parentId: string | null;
  baseLocationId: string | null;
  activo: boolean;
}

/** Un campo de la tarjeta de datos en modo lectura. */
export interface CampoFicha {
  label: string;
  valor: string | null;
}

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para']);

export function membreteDesde(datos: DatosMembrete | null, catalogos: CatalogosDeOrganismo): Membrete {
  const padre = datos?.parentId ? catalogos.organismos.get(datos.parentId) : undefined;
  const tipo = (datos?.typeId && catalogos.tipos.get(datos.typeId)) || null;
  const localidad = (datos?.baseLocationId && catalogos.localidades.get(datos.baseLocationId)) || null;
  return {
    nombre: datos?.nombre.trim() ?? '',
    iniciales: inicialesDe(datos?.acronym ?? '', datos?.nombre ?? ''),
    activo: datos?.activo ?? true,
    datos: [
      ...(tipo ? [{ texto: tipo, icono: 'buildings' }] : []),
      { texto: padre ? `Depende de ${padre}` : 'Organismo raíz', icono: 'tree-structure' },
      ...(localidad ? [{ texto: localidad, icono: 'map-pin' }] : []),
    ],
  };
}

/** Del valor del formulario a lo que lee el membrete (acompaña lo que se está escribiendo). */
export function datosDeMembrete(valor: Record<string, unknown>): DatosMembrete {
  return {
    nombre: String(valor['nombre'] ?? ''),
    acronym: String(valor['acronym'] ?? ''),
    typeId: String(valor['typeId'] ?? ''),
    parentId: (valor['parentId'] as string) || null,
    baseLocationId: (valor['baseLocationId'] as string) || null,
    activo: valor['activo'] !== false,
  };
}

/** Campos de la tarjeta de datos en modo lectura: solo lo que el backend guarda. */
export function camposDeLectura(o: OrganismoVM | null, catalogos: CatalogosDeOrganismo): CampoFicha[] {
  return [
    { label: 'Sigla', valor: o?.acronym || null },
    { label: 'Tipo de organismo', valor: o ? catalogos.tipos.get(o.typeId) ?? null : null },
    { label: 'Organismo superior', valor: (o?.parentId && catalogos.organismos.get(o.parentId)) || 'Sin organismo superior' },
    { label: 'Localidad base', valor: (o?.baseLocationId && catalogos.localidades.get(o.baseLocationId)) || null },
  ];
}

/** Iniciales del membrete: la sigla si existe, si no las del nombre; vacío si no hay ninguna. */
export function inicialesDe(acronym: string, nombre: string): string {
  const sigla = acronym.replace(/[^\p{L}]/gu, '');
  if (sigla.length >= 2) return sigla.slice(0, 3).toLocaleUpperCase('es-AR');

  const palabras = nombre
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p) && !CONECTORES.has(p.toLocaleLowerCase('es-AR')));
  if (palabras.length === 0) return '';
  const letras = palabras.length === 1 ? palabras[0].slice(0, 2) : palabras.slice(0, 2).map((p) => p[0]).join('');
  return letras.toLocaleUpperCase('es-AR');
}
