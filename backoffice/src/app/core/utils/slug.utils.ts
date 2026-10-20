/**
 * Canonicaliza un slug con la misma regla que el backend (`TagService.createTag`, y el
 * `generateSlug` de eventos de vida): descompone (NFD), quita diacríticos, pasa a
 * minúsculas, colapsa todo tramo no alfanumérico en un guion y recorta los guiones de
 * los bordes. Ej.: "  Niños y Adolescentes! " → "ninos-y-adolescentes".
 */
export function canonicalizarSlug(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+)|(-+$)/g, '');
}
