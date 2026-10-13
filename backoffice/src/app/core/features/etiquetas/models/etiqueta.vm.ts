import type { OrganismoOption } from '@features/organismos';

/**
 * ViewModel de etiqueta, alineado al `Tag` real del backend (BACKEND_API_SPEC.md §5.5):
 * `{ id: UUID, organism: FK nullable, slug, local }`. Global ⇔ sin organismo (`local=false`);
 * local ⇔ con organismo (`local=true`). Contrato real `/api/tag` (PPDT-5.8).
 */
export interface EtiquetaVM {
  id: string;
  /** Canónico: minúsculas, sin tildes, `[a-z0-9-]`. Es el "nombre" visible de la etiqueta. */
  slug: string;
  organismoId: string | null;
  /** Lo resuelve el facade cruzando con las opciones de organismos (null si es global o no se pudo resolver). */
  organismoNombre: string | null;
  local: boolean;
}

/** Valor del formulario. `local` no se edita: se deriva de `organismoId != null`. */
export interface EtiquetaFormValue {
  slug: string;
  organismoId: string | null;
}

/** Lo que necesita el formulario, resuelto en una sola llamada por el facade. */
export interface EtiquetaFormData {
  etiqueta: EtiquetaVM | null;
  /** Vacío si el usuario no puede leer organismos: el form sigue permitiendo etiquetas globales. */
  organismos: OrganismoOption[];
}

