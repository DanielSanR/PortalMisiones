import { NO_DISPONIBLE } from '@core/constants/textos.constants';
import { FieldConfig, PanelDeFormulario } from '@core/models/field.interface';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import { PlantillaCatalogos, PlantillaFormValue, PlantillaOpcion, PlantillaRef, PlantillaVM } from '@features/plantillas';
import { MembreteDato } from '@shared/components/membrete/membrete.component';
import { datosRecomendados, textoRecomendados } from '../plantilla-recomendados-textos';
import { membreteDePlantilla } from '../plantilla-textos';

/** Largo máximo de `title_base` / `slug_base` (VARCHAR(255) en el backend). */
export const MAX_TEXTO_CORTO = 255;

const SLUG_SIN_LETRAS = 'Tiene que tener letras o números';
const PRINCIPAL_FUERA = 'Tiene que ser una de las categorías elegidas';

/**
 * Valor del formulario de plantilla, con los `name` de sus campos (de ahí salen los ids `#titulo`, `#slug`,
 * `#resumen`, `#descripcion`, `#modalidad`, `#principal`). Sin elegir: `''` en los select y `[]` en los catálogos.
 */
export type ValorDePlantilla = {
  titulo: string;
  slug: string;
  resumen: string;
  descripcion: string;
  modalidad: string;
  categoriaIds: string[];
  principal: string;
  etiquetaIds: string[];
  destinatarioIds: string[];
  eventoDeVidaIds: string[];
  activa: boolean;
};

/** Lo que el membrete y el pie muestran del formulario en vivo. */
export interface ResumenDePlantilla {
  titulo: string;
  activa: boolean;
  /** Línea meta del membrete: slug · modalidad · categoría principal. */
  membrete: MembreteDato[];
  /** Resumen, modalidad y categoría principal cargados (informativo: no bloquea el guardado). */
  recomendadosCompletos: boolean;
  recomendado: string;
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor : '');
const lista = (valor: unknown): string[] => (Array.isArray(valor) ? valor.map(String) : []);
const opciones = (catalogo: PlantillaOpcion[]): { id: string; name: string }[] =>
  catalogo.map((opcion) => ({ id: opcion.id, name: opcion.nombre }));

/** Valor con el que se abre el formulario: el de la plantilla, o el de un alta (todo vacío y activa). */
export function valorInicialDePlantilla(plantilla: PlantillaVM | null): ValorDePlantilla {
  const ids = (refs: PlantillaRef[] | undefined): string[] => (refs ?? []).map((ref) => ref.id);
  return {
    titulo: plantilla?.titulo ?? '',
    slug: plantilla?.slug ?? '',
    resumen: plantilla?.resumen ?? '',
    descripcion: plantilla?.descripcionLarga ?? '',
    modalidad: plantilla?.modalidad?.id ?? '',
    categoriaIds: ids(plantilla?.categorias),
    principal: plantilla?.categoriaPrincipal?.id ?? '',
    etiquetaIds: ids(plantilla?.etiquetas),
    destinatarioIds: ids(plantilla?.destinatarios),
    eventoDeVidaIds: ids(plantilla?.eventosDeVida),
    activa: plantilla?.activa ?? true,
  };
}

/** El valor crudo que entrega el motor (`formSubmit` / `valueChanges`), ya tipado. */
export function leerValorDePlantilla(crudo: Record<string, unknown>): ValorDePlantilla {
  return {
    titulo: texto(crudo['titulo']),
    slug: texto(crudo['slug']),
    resumen: texto(crudo['resumen']),
    descripcion: texto(crudo['descripcion']),
    modalidad: texto(crudo['modalidad']),
    categoriaIds: lista(crudo['categoriaIds']),
    principal: texto(crudo['principal']),
    etiquetaIds: lista(crudo['etiquetaIds']),
    destinatarioIds: lista(crudo['destinatarioIds']),
    eventoDeVidaIds: lista(crudo['eventoDeVidaIds']),
    activa: crudo['activa'] !== false,
  };
}

/**
 * Lo que viaja al facade. No recorta ni canonicaliza (eso es del mapper): solo renombra los campos y pasa
 * a `null` la modalidad y la categoría principal sin elegir.
 */
export function aPlantillaFormValue(crudo: Record<string, unknown>): PlantillaFormValue {
  const valor = leerValorDePlantilla(crudo);
  return {
    titulo: valor.titulo,
    slug: valor.slug,
    resumen: valor.resumen,
    descripcionLarga: valor.descripcion,
    modalidadId: valor.modalidad || null,
    categoriaPrincipalId: valor.principal || null,
    categoriaIds: valor.categoriaIds,
    etiquetaIds: valor.etiquetaIds,
    destinatarioIds: valor.destinatarioIds,
    eventoDeVidaIds: valor.eventoDeVidaIds,
    activa: valor.activa,
  };
}

/**
 * Agrega a cada catálogo los ids que la plantilla tiene y el catálogo no (borrados o catálogo sin leer).
 * Sin esto se mostrarían vacíos y no se podrían quitar; igual se conservan al guardar, porque el valor del
 * formulario los incluye.
 */
export function conSeleccionados(catalogos: PlantillaCatalogos, plantilla: PlantillaVM): PlantillaCatalogos {
  const sumar = (catalogo: PlantillaOpcion[], refs: PlantillaRef[]): PlantillaOpcion[] => {
    const conocidos = new Set(catalogo.map((opcion) => opcion.id));
    const faltantes: PlantillaOpcion[] = [];
    for (const ref of refs) {
      if (conocidos.has(ref.id)) continue;
      conocidos.add(ref.id);
      faltantes.push({ id: ref.id, nombre: `${NO_DISPONIBLE} (${ref.id.slice(0, 8)})` });
    }
    return [...catalogo, ...faltantes];
  };
  return {
    ...catalogos,
    modalidades: sumar(catalogos.modalidades, plantilla.modalidad ? [plantilla.modalidad] : []),
    categorias: sumar(catalogos.categorias, [...plantilla.categorias, ...(plantilla.categoriaPrincipal ? [plantilla.categoriaPrincipal] : [])]),
    etiquetas: sumar(catalogos.etiquetas, plantilla.etiquetas),
    destinatarios: sumar(catalogos.destinatarios, plantilla.destinatarios),
    eventosDeVida: sumar(catalogos.eventosDeVida, plantilla.eventosDeVida),
  };
}

/** Lo único del valor de lo que dependen los campos: las categorías elegidas y la principal. */
export type OrigenDePrincipal = Pick<ValorDePlantilla, 'categoriaIds' | 'principal'>;

/** Cambia cuando hay que volver a armar los campos (`camposDePlantilla`): la página los recalcula solo entonces. */
export function claveDeCampos(valor: OrigenDePrincipal): string {
  return `${valor.categoriaIds.join(',')}|${valor.principal}`;
}

/**
 * La categoría principal se elige entre las categorías elegidas. La principal actual se sigue listando
 * aunque le hayan quitado su categoría: así el select la muestra junto a su error, en vez de verse vacío
 * con un valor escondido. Sin categorías ni principal no hay de dónde elegir: va deshabilitada. Si todavía
 * guarda una queda habilitada, porque deshabilitada no valida y viajaría igual.
 *
 * Que sea una de las elegidas no lo valida el backend (`ProcedureTemplateService` acepta cualquiera): la
 * regla vive acá.
 */
function campoPrincipal(categorias: PlantillaOpcion[], valor: OrigenDePrincipal): FieldConfig {
  const sinOrigen = !valor.categoriaIds.length && !valor.principal;
  const elegibles = categorias.filter((opcion) => valor.categoriaIds.includes(opcion.id) || opcion.id === valor.principal);
  return {
    name: 'principal',
    label: 'Categoría principal',
    type: 'select',
    opcional: true,
    disabled: sinOrigen,
    options: [{ id: '', name: 'Sin categoría principal' }, ...opciones(elegibles)],
    optionsLoaded: true,
    hint: sinOrigen ? 'Elegí primero al menos una categoría.' : 'Se elige entre las categorías de la plantilla.',
    validations: {
      validarCon: {
        campos: ['categoriaIds'],
        validar: (principal, valores) => (!principal || lista(valores['categoriaIds']).includes(String(principal)) ? null : PRINCIPAL_FUERA),
      },
    },
  };
}

function campoDeCatalogo(name: string, label: string, nombre: string, textoVacio: string, catalogo: PlantillaOpcion[]): FieldConfig {
  return { name, label, type: 'select-multiple', value: [], options: opciones(catalogo), optionsLoaded: true, seleccion: { nombre, textoVacio } };
}

/**
 * Campos del formulario de plantilla. En el alta el slug sigue al título hasta que la persona lo edita
 * (`derivado.seguir`); en edición no: cambiar el slug de una plantilla existente tiene que ser deliberado.
 * `catalogos` llega con lo elegido que ya no está en el catálogo agregado (`conSeleccionados`).
 */
export function camposDePlantilla(catalogos: PlantillaCatalogos, valor: OrigenDePrincipal, esEdicion: boolean): FieldConfig[] {
  const campos: FieldConfig[] = [
    {
      name: 'titulo',
      label: 'Título',
      type: 'text',
      placeholder: 'Ej: Obtener la licencia de conducir',
      hint: 'Empezá con un verbo en infinitivo: Obtener, Inscribirse…',
      validations: { required: true, maxLength: MAX_TEXTO_CORTO },
    },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      mono: true,
      placeholder: 'obtener-licencia-de-conducir',
      hint: `${esEdicion ? 'Cambiarlo cambia la dirección pública del trámite.' : 'Se arma solo desde el título; podés editarlo.'} Es único entre todas las plantillas.`,
      derivado: { de: 'titulo', transform: canonicalizarSlug, seguir: !esEdicion, accion: 'Desde el título' },
      preview: { label: 'Se guardará como:', transform: canonicalizarSlug },
      validations: {
        required: true,
        maxLength: MAX_TEXTO_CORTO,
        // Tiene que quedar algo después de canonicalizarlo ("¡¡¡" no sirve). Vacío: lo informa `required`.
        validar: (slug) => (!slug.trim() || canonicalizarSlug(slug) ? null : SLUG_SIN_LETRAS),
      },
    },
    { name: 'resumen', label: 'Resumen', type: 'textarea', opcional: true, filas: 2, placeholder: 'Una o dos oraciones: qué es y para quién.' },
    {
      name: 'descripcion',
      label: 'Descripción larga',
      type: 'textarea',
      opcional: true,
      filas: 5,
      hint: 'Requisitos, costos y URL no van acá: son de cada ficha por localidad.',
    },
    {
      name: 'modalidad',
      label: 'Modalidad',
      type: 'select',
      opcional: true,
      options: [{ id: '', name: 'Sin modalidad' }, ...opciones(catalogos.modalidades)],
      optionsLoaded: true,
    },
    {
      name: 'activa',
      label: 'Activa',
      type: 'checkbox',
      value: true,
      aviso: (activa) => (activa ? null : { texto: 'Desactivada, deja de aparecer en el listado de plantillas y no se puede adoptar.' }),
    },
    campoDeCatalogo('categoriaIds', 'Categorías', 'categorías', 'Ninguna categoría elegida.', catalogos.categorias),
    campoPrincipal(catalogos.categorias, valor),
    campoDeCatalogo('etiquetaIds', 'Etiquetas', 'etiquetas', 'Ninguna etiqueta elegida.', catalogos.etiquetas),
    campoDeCatalogo('destinatarioIds', 'Destinatarios', 'destinatarios', 'Ningún destinatario elegido.', catalogos.destinatarios),
    campoDeCatalogo('eventoDeVidaIds', 'Eventos de vida', 'eventos de vida', 'Ningún evento de vida elegido.', catalogos.eventosDeVida),
  ];
  // Alta: el bloque "Después de crearla" lo dibuja la página (`appCampoPropio="despues"`).
  return esEdicion ? campos : [...campos, { name: 'despues', label: 'Después de crearla', type: 'vista' }];
}

/** "N opciones elegidas" entre los cuatro catálogos de Clasificación (la categoría principal no cuenta). */
export function totalElegidas(valor: Pick<ValorDePlantilla, 'categoriaIds' | 'etiquetaIds' | 'destinatarioIds' | 'eventoDeVidaIds'>): string {
  const total = valor.categoriaIds.length + valor.etiquetaIds.length + valor.destinatarioIds.length + valor.eventoDeVidaIds.length;
  return total === 1 ? '1 opción elegida' : `${total} opciones elegidas`;
}

/** Los dos paneles de la tarjeta: datos (con "Activa" al pie) y Clasificación (un grupo por catálogo). */
export function panelesDePlantilla(esEdicion: boolean, total: string): PanelDeFormulario[] {
  return [
    {
      id: 'plantform-datos',
      titulo: 'Datos de la plantilla',
      subtitulo: esEdicion ? 'Guardar reemplaza la plantilla completa' : 'Completá los datos para crear la plantilla',
      campos: ['titulo', 'slug', 'resumen', 'descripcion', 'modalidad'],
      opciones: ['activa'],
    },
    {
      id: 'plantform-clasificacion',
      titulo: 'Clasificación',
      subtitulo: 'Opcional. Cómo se encuentra el trámite en el portal.',
      total,
      lateral: true,
      cuerpo: 'grupos',
      // La principal depende de las categorías elegidas: va pegada a ese grupo.
      campos: [['categoriaIds', 'principal'], 'etiquetaIds', 'destinatarioIds', 'eventoDeVidaIds', ...(esEdicion ? [] : ['despues'])],
    },
  ];
}

/** El formulario en vivo, resumido para el membrete y el indicador de datos recomendados del pie. */
export function resumenDePlantilla(valor: ValorDePlantilla, catalogos: PlantillaCatalogos): ResumenDePlantilla {
  const nombre = (catalogo: PlantillaOpcion[], id: string): string => catalogo.find((opcion) => opcion.id === id)?.nombre ?? '';
  const recomendados = datosRecomendados({
    resumen: valor.resumen,
    tieneModalidad: !!valor.modalidad,
    tieneCategoriaPrincipal: !!valor.principal,
  });
  return {
    titulo: valor.titulo.trim(),
    activa: valor.activa,
    membrete: membreteDePlantilla({
      slug: valor.slug,
      modalidad: nombre(catalogos.modalidades, valor.modalidad),
      principal: nombre(catalogos.categorias, valor.principal),
    }),
    recomendadosCompletos: recomendados.every((dato) => dato.completo),
    recomendado: textoRecomendados(recomendados),
  };
}
