/**
 * Canonicaliza un slug con la MISMA regla que el backend (`dev` @ `586b670`): `TagService.canonicalize`,
 * `ProcedureTemplateService.canonicalize` y el `generateSlug` de eventos de vida. En Java:
 *
 *   Normalizer.normalize(slug, NFD).replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT)
 *     .replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "")
 *
 * Es decir: descompone (NFD), quita TODAS las marcas combinantes (`\p{M}`, no solo U+0300–U+036F), pasa a
 * minúsculas sin locale, colapsa todo tramo no alfanumérico ASCII en un guion y recorta los guiones de
 * los bordes. Ej.: "  Niños y Adolescentes! " → "ninos-y-adolescentes". La equivalencia con casos borde
 * está fijada en `slug.utils.spec.ts`.
 */
export function canonicalizarSlug(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+)|(-+$)/g, '');
}
