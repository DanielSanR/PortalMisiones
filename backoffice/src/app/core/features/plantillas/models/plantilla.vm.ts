/**
 * Referencia a un catálogo (modalidad, categoría, etiqueta, destinatario, evento de vida).
 * El backend devuelve solo el id: el nombre lo resuelve el facade cruzando con el catálogo.
 * `nombre` en null = el id no está en el catálogo (borrado, o el catálogo no se pudo leer).
 */
export interface PlantillaRef {
  id: string;
  nombre: string | null;
}

/** ViewModel de la plantilla provincial (`ProcedureTemplate`), con los nombres ya resueltos. */
export interface PlantillaVM {
  id: string;
  titulo: string;
  /** Único entre todas las plantillas. */
  slug: string;
  resumen: string | null;
  descripcionLarga: string | null;
  modalidad: PlantillaRef | null;
  categoriaPrincipal: PlantillaRef | null;
  categorias: PlantillaRef[];
  etiquetas: PlantillaRef[];
  destinatarios: PlantillaRef[];
  eventosDeVida: PlantillaRef[];
  /** `false` = desactivada: el listado del backend ya no la devuelve. */
  activa: boolean;
}

/** Valor del formulario. Reemplaza la plantilla entera al guardar (el PUT es total). */
export interface PlantillaFormValue {
  titulo: string;
  slug: string;
  resumen: string;
  descripcionLarga: string;
  modalidadId: string | null;
  categoriaPrincipalId: string | null;
  categoriaIds: string[];
  etiquetaIds: string[];
  destinatarioIds: string[];
  eventoDeVidaIds: string[];
  activa: boolean;
}

/** Opción de un select del formulario. */
export interface PlantillaOpcion {
  id: string;
  nombre: string;
}

/** Catálogos para el formulario. Cada uno degrada a `[]` si falla, y queda anotado en `noDisponibles`. */
export interface PlantillaCatalogos {
  modalidades: PlantillaOpcion[];
  /** Con la ruta jerárquica en el nombre ("Padre › Hija"). */
  categorias: PlantillaOpcion[];
  etiquetas: PlantillaOpcion[];
  destinatarios: PlantillaOpcion[];
  eventosDeVida: PlantillaOpcion[];
  /** Nombres visibles de los catálogos que no se pudieron leer (ej. `['Etiquetas']`). */
  noDisponibles: string[];
}

/** Lo que necesita el formulario, resuelto en una sola llamada por el facade. */
export interface PlantillaFormData {
  plantilla: PlantillaVM | null;
  catalogos: PlantillaCatalogos;
}
