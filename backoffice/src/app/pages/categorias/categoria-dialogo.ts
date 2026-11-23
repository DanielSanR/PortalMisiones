import { FieldConfig, TreeFieldConfig, TreeOption } from '@core/models/field.interface';
import { canonicalizarSlug } from '@core/utils/slug.utils';
import { CategoriaFormValue, CategoriaVM, CategoriasFacade } from '@features/categorias';
import { FormDialogData } from '@shared/components/form-dialog';
import { formDialogEstatico } from '@shared/components/form-dialog/form-dialog-estatico';
import { CONFLICTOS_CATEGORIA, FALLBACK_CATEGORIA } from './categoria-save-error';
import { CategoriaUbicacionComponent, DatosDeUbicacion } from './components/ubicacion/categoria-ubicacion.component';

const MIN = 3;
const MAX = 100;
const MUY_CORTO = `Tiene que tener al menos ${MIN} caracteres`;

/** Tramos de minúsculas y números separados por UN guion: sin guion al principio, al final ni doble. */
const SLUG_BIEN_FORMADO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Regla del slug, con un mensaje por causa para poder decir qué corregir: caracteres que no van
 * (mayúsculas, espacios, acentos), un guion que sobra (`-abc`, `abc-`, `a--b`) o muy corto. El slug
 * sugerido desde el nombre nunca cae en los dos primeros.
 *
 * El slug con el que ya venía la categoría (`original`) se acepta tal cual: uno viejo que no cumpla la
 * regla no debe impedir cambiarle el nombre o el padre. La regla aplica recién si se lo modifica.
 */
export function motivoDeSlug(slug: string, original: string): string | null {
  if (!slug) return null; // vacío: lo informa `required`
  if (slug !== original && !SLUG_BIEN_FORMADO.test(slug)) {
    return /^[a-z0-9-]+$/.test(slug)
      ? 'Los guiones van solo entre palabras: ni al principio, ni al final, ni dos seguidos'
      : 'Solo minúsculas, números y guiones';
  }
  return slug.length < MIN ? MUY_CORTO : null;
}

/**
 * La propia categoría como padre (dato roto) se trata como "sin padre". Un padre que no está en el
 * listado se conserva tal cual: el desplegable lo muestra como "Opción no disponible" y no se manda a la
 * raíz una categoría por editarle solo el nombre.
 */
function padreValido(parentId: string | null | undefined, categoria: CategoriaVM | null): string {
  return !parentId || parentId === categoria?.id ? '' : parentId;
}

/** Recorre en oleadas y marca cada id una sola vez: un ciclo en los datos no cuelga el bucle. */
function descendientesDe(categorias: CategoriaVM[], id: string | null): Set<string> {
  const descendientes = new Set<string>();
  if (!id) return descendientes;
  const alcanzados = new Set<string>([id]);
  let huboCambios = true;
  while (huboCambios) {
    huboCambios = false;
    for (const c of categorias) {
      if (c.parentId && alcanzados.has(c.parentId) && !alcanzados.has(c.id)) {
        alcanzados.add(c.id);
        descendientes.add(c.id);
        huboCambios = true;
      }
    }
  }
  return descendientes;
}

/**
 * Árbol de "Categoría padre". La que se edita queda afuera (el árbol la dibuja aparte, como "Esta
 * categoría") y su descendencia se muestra pero no se puede elegir: el backend rechaza un padre
 * descendiente con `4075`.
 */
export function arbolDeCategorias(categorias: CategoriaVM[], categoria: CategoriaVM | null): TreeFieldConfig {
  const propia = categoria?.id ?? null;
  const dependientes = descendientesDe(categorias, propia);
  const nodes: TreeOption[] = categorias
    .filter((c) => c.id !== propia)
    .map((c) => ({
      id: c.id,
      label: c.nombre,
      meta: `/${c.slug}`,
      parentId: c.parentId,
      keywords: c.slug,
      disabledReason: dependientes.has(c.id) ? 'Depende de esta' : undefined,
    }));
  return {
    nodes,
    loaded: true,
    emptyLabel: 'Sin categoría padre',
    emptyMeta: 'Queda como categoría de primer nivel',
    searchLabel: 'Buscar por nombre o slug',
    self: { id: propia, label: categoria?.nombre ?? 'Nueva categoría', tag: 'Esta categoría', icon: 'folder-simple' },
  };
}

/**
 * Los tres campos de `CategoryRequestDTO` (nombre, slug y categoría padre) más la franja "dónde queda".
 * En un alta el slug sigue al nombre hasta que la persona lo edita (`derivado.seguir`); "Usar el del
 * nombre" lo vuelve a derivar.
 */
export function camposDeCategoria(categorias: CategoriaVM[], categoria: CategoriaVM | null): FieldConfig[] {
  const esEdicion = !!categoria;
  const original = categoria?.slug ?? '';
  const ubicacion: DatosDeUbicacion = { categorias, esEdicion };
  return [
    { name: '_ubicacion', label: 'Ubicación', type: 'vista', vista: { componente: CategoriaUbicacionComponent, datos: ubicacion } },
    {
      name: 'nombre',
      label: 'Nombre',
      type: 'text',
      placeholder: 'Ej: Automotor, transporte y tránsito',
      // `@NotBlank @Size(min = 3)` del backend sobre el nombre recortado (lo mide así el motor en un `text`).
      validations: {
        required: true, minLength: MIN, maxLength: MAX,
        mensajes: { required: 'El nombre es obligatorio', minlength: MUY_CORTO },
      },
    },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      mono: true,
      placeholder: 'Ej: automotor-transporte',
      hint: esEdicion
        ? 'Minúsculas, números y guiones. No puede repetirse entre categorías.'
        : 'Se arma solo con el nombre. Podés cambiarlo: minúsculas, números y guiones, sin repetir.',
      derivado: { de: 'nombre', transform: canonicalizarSlug, seguir: !esEdicion, accion: 'Usar el del nombre' },
      validations: {
        required: true, maxLength: MAX,
        mensajes: { required: 'El slug es obligatorio' },
        validar: (slug) => motivoDeSlug(slug, original),
      },
    },
    {
      name: 'parentId',
      label: 'Categoría padre',
      type: 'tree-select',
      opcional: true,
      hint: 'Sin padre queda como categoría de primer nivel.',
      tree: arbolDeCategorias(categorias, categoria),
    },
  ];
}

/**
 * Configuración del diálogo de alta/edición de categoría (`FormDialogComponent`). `categoria` null = alta;
 * `parentId` es el padre preseleccionado al agregar una subcategoría desde una fila. `categorias` es el
 * listado plano completo que ya tiene la lista: arma el árbol y la ruta, sin volver a pedir nada.
 *
 * Va en diálogo y no en página porque la categoría no tiene ficha propia y conviene no perder de vista el
 * árbol. `afterClosed()` emite la categoría guardada, o `undefined` si se canceló.
 */
export function dialogoDeCategoria(
  facade: CategoriasFacade,
  categorias: CategoriaVM[],
  categoria: CategoriaVM | null,
  parentId: string | null = null,
): FormDialogData<CategoriaVM> {
  const esEdicion = !!categoria;
  /** Padre con el que abre: el de la categoría en edición, o el de la fila desde la que se agregó. */
  const padreInicial = padreValido(categoria?.parentId ?? parentId, categoria);
  /** Subcategoría agregada desde una fila: el subtítulo dice dentro de cuál cae. */
  const nombreDelPadre = !esEdicion && padreInicial ? categorias.find((c) => c.id === padreInicial)?.nombre ?? '' : '';

  return formDialogEstatico<CategoriaVM>({
    titulo: esEdicion ? 'Editar categoría' : nombreDelPadre ? 'Nueva subcategoría' : 'Nueva categoría',
    subtitulo: esEdicion
      ? 'Los cambios se aplican al guardar.'
      : nombreDelPadre
        ? `Se agrega dentro de «${nombreDelPadre}». Podés cambiarlo abajo.`
        : 'Completá los datos para crearla.',
    textoGuardar: esEdicion ? 'Guardar cambios' : 'Crear categoría',
    requiereCambios: esEdicion,
    mensajeDescartar: esEdicion
      ? 'Hay cambios sin guardar en esta categoría. Si cerrás ahora se pierden.'
      : 'Hay datos sin guardar. Si cerrás ahora no se crea la categoría.',
    formId: 'categoria-dialog-form',
    fields: camposDeCategoria(categorias, categoria),
    initialData: { nombre: categoria?.nombre ?? '', slug: categoria?.slug ?? '', parentId: padreInicial },
    guardar: (valor) => {
      const form: CategoriaFormValue = {
        nombre: String(valor['nombre'] ?? '').trim(),
        slug: String(valor['slug'] ?? ''),
        parentId: String(valor['parentId'] ?? '') || null,
      };
      return categoria ? facade.update(categoria.id, form) : facade.create(form);
    },
    conflictos: CONFLICTOS_CATEGORIA,
    fallback: FALLBACK_CATEGORIA,
  });
}
