import { FieldConfig, PanelDeFormulario } from '@core/models/field.interface';

/**
 * Lo que `DynamicFormComponent` deriva de su configuración sin tocar el `FormGroup`: qué tipos llevan etiqueta
 * o control, los paneles con sus campos resueltos, el ancho de cada celda, y dos chequeos chicos (ids repetidos
 * en el documento, igualdad de valores). Funciones puras, separadas del componente para que no pase de 400 líneas.
 */

/**
 * Tipos de campo sin label overline externo. Tampoco entran al resumen de validación, salvo `select-multiple`
 * (su etiqueta la dibuja `app-seleccion-multiple`, pero su error se ve bajo el grupo: ver `entraAlResumen`).
 */
const NO_EXTERNAL_LABEL_TYPES = ['tip', 'section-header', 'checkbox', 'custom', 'vista', 'select-multiple'];

/** Tipos de campo puramente visuales: no tienen control en el `FormGroup`. */
export const NO_CONTROL_TYPES = ['tip', 'section-header', 'vista'];

/** El campo lleva label overline externo (todos salvo tip/section-header/checkbox/custom/vista/select-multiple). */
export function llevaEtiquetaExterna(field: FieldConfig): boolean {
  return !NO_EXTERNAL_LABEL_TYPES.includes(field.type);
}

/**
 * El campo se lista en el banner resumen si está inválido y tocado: los de etiqueta externa y `select-multiple`
 * (un `validations.required` sobre él bloquearía el envío con un banner vacío si no se contara).
 */
export function entraAlResumen(field: FieldConfig): boolean {
  return llevaEtiquetaExterna(field) || field.type === 'select-multiple';
}

/** Un panel con sus campos ya resueltos (los `name` de `PanelDeFormulario` → `FieldConfig`). */
export interface PanelVista {
  panel: PanelDeFormulario;
  /** Una entrada por grupo de `panel.campos` (un campo suelto es un grupo de uno). */
  grupos: FieldConfig[][];
  opciones: FieldConfig[];
}

/** Resuelve los `name` de cada panel contra `fields` (un nombre que no existe se ignora). `null` sin paneles. */
export function resolverPaneles(paneles: PanelDeFormulario[] | null, fields: FieldConfig[]): PanelVista[] | null {
  if (!paneles) return null;
  const porNombre = new Map(fields.map((field) => [field.name, field]));
  const resolver = (nombres: string[]) => nombres.map((nombre) => porNombre.get(nombre)).filter((field): field is FieldConfig => !!field);
  return paneles.map((panel) => ({
    panel,
    grupos: panel.campos.map((entrada) => resolver(Array.isArray(entrada) ? entrada : [entrada])).filter((grupo) => grupo.length > 0),
    opciones: resolver(panel.opciones ?? []),
  }));
}

/**
 * Un grupo de un panel `cuerpo: 'grupos'` que es solo contenido propio de la página (campos `vista` sin
 * componente, que la página dibuja con `appCampoPropio`) va de borde a borde (`.ficha-paneles__grupo--corrido`):
 * como en `cuerpo: 'libre'`, ese contenido pone su propio padding. Ver `PanelDeFormulario.campos`.
 */
export function esGrupoCorrido(grupo: FieldConfig[]): boolean {
  return grupo.length > 0 && grupo.every((field) => field.type === 'vista' && !field.vista?.componente);
}

/** Clase de ancho de la celda de un campo en la grilla (`cssClass`, o el ancho por defecto de su tipo). */
export function claseDeCelda(field: FieldConfig): string {
  switch (field.cssClass) {
    case 'colspan-wide': return 'dynamic-form-field-wide';
    case 'colspan-third': return 'dynamic-form-field-third';
    case 'colspan-half': return 'dynamic-form-field-half';
    case 'colspan-full': return 'dynamic-form-field-full';
    default: return field.type === 'datepicker' ? 'dynamic-form-field-half' : 'dynamic-form-field-full';
  }
}

/**
 * Los ids de un campo son su `name` (`#nombre`, `#nombre-label`, `#nombre-ayuda`): de eso dependen `label for`,
 * `aria-labelledby` y los selectores de specs y e2e. Dos formularios del motor a la vez en el documento con un
 * `name` en común (un diálogo de formulario abierto sobre una página con formulario embebido) duplicarían el
 * id y la etiqueta de uno nombraría al campo del otro. No se puede prevenir sin cambiar los ids, así que en
 * desarrollo se avisa (ver `.claude/rules/formularios-dynamic-form.md`). Devuelve los `name` cuyo id ya existe
 * fuera de `host`.
 */
export function idsRepetidos(document: Document, host: HTMLElement, fields: FieldConfig[]): string[] {
  return fields.map((field) => field.name).filter((nombre) =>
    [nombre, `${nombre}-label`].some((id) =>
      Array.from(document.querySelectorAll(`[id="${CSS.escape(id)}"]`)).some((nodo) => !host.contains(nodo))));
}

/** Igualdad superficial de dos valores crudos del form (los arrays de un multi-select, por elemento). */
export function mismoValor(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const claves = Object.keys(a);
  if (claves.length !== Object.keys(b).length) return false;
  return claves.every((clave) => {
    const x = a[clave];
    const y = b[clave];
    if (Array.isArray(x) && Array.isArray(y)) {
      return x.length === y.length && x.every((item, i) => item === y[i]);
    }
    return clave in b && x === y;
  });
}
