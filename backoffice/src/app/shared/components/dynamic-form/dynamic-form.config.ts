import { FieldConfig, FormConfig, TreeFieldConfig } from '@core/models/field.interface';

/**
 * Copia profunda que preserva funciones por referencia.
 *
 * Los FormConfig se clonan para que un formulario no mute la config que recibe
 * (p. ej. al cargar `options`). `structuredClone` no sirve: tira
 * `DataCloneError` ante funciones, y la config las lleva (`FieldConfig.preview.transform`).
 * Las funciones son puras e inmutables, así que compartirlas no rompe el aislamiento;
 * todo lo demás (arrays y objetos planos) se copia en profundidad.
 */
function clonarConfig<T>(valor: T): T {
  if (valor === null || typeof valor !== 'object') {
    // primitivos y funciones: se devuelven tal cual
    return valor;
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => clonarConfig(item)) as T;
  }
  const proto = Object.getPrototypeOf(valor);
  if (proto !== Object.prototype && proto !== null) {
    // Date, Map, etc.: no llevan funciones adentro, structuredClone los copia bien
    return structuredClone(valor);
  }
  const copia: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    copia[clave] = clonarConfig(v);
  }
  return copia as T;
}

/**
 * Devuelve un nuevo FormConfig con las options del campo indicado actualizadas.
 */
/**
 * Devuelve una copia del FormConfig con la jerarquía de un campo `tree-select` resuelta
 * (nodos + la entidad en edición). Los textos del campo se conservan de la config base.
 */
export function updateFormConfigTree(
  config: FormConfig,
  fieldName: string,
  tree: Pick<TreeFieldConfig, 'nodes' | 'self'>,
): FormConfig {
  const clone = clonarConfig(config);
  const field = clone.fields?.find((f: FieldConfig) => f.name === fieldName);
  if (field?.tree) {
    field.tree = { ...field.tree, ...tree, loaded: true };
  }
  return clone;
}

export function updateFormConfigOptions(
  config: FormConfig,
  fieldName: string,
  options: { id: string | number; name: string }[],
): FormConfig {
  const clone = clonarConfig(config);
  const field = clone.fields?.find((f: FieldConfig) => f.name === fieldName);
  if (field) {
    field.options = options;
    // Aunque `options` venga vacío: el catálogo se resolvió, y el select debe decir
    // "no hay opciones" en vez de quedarse en "Cargando opciones…".
    field.optionsLoaded = true;
  }
  return clone;
}
