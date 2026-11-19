import { canonicalizarSlug } from './slug.utils';

/**
 * Fija la equivalencia con el backend (`dev` @ `586b670`). `ProcedureTemplateService.canonicalize` y
 * `TagService.canonicalize` son la misma función:
 *
 *   Normalizer.normalize(slug == null ? "" : slug, Normalizer.Form.NFD)
 *     .replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT)
 *     .replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "")
 *
 * Los valores esperados son los que produce esa cadena en Java, razonados paso a paso (no se ejecutó el
 * backend). Si el backend cambia la regla, este spec es el lugar a actualizar junto con `slug.utils.ts`.
 */
describe('canonicalizarSlug — misma regla que el backend', () => {
  const CASOS: [entrada: string, esperado: string, porQue: string][] = [
    ['obtener-licencia-de-conducir', 'obtener-licencia-de-conducir', 'un slug ya canónico no cambia'],
    ['Obtener la Licencia de Conducir', 'obtener-la-licencia-de-conducir', 'minúsculas y espacios → guion'],
    ['  Niños y Adolescentes! ', 'ninos-y-adolescentes', 'tildes fuera, bordes recortados'],
    ['ÁÉÍÓÚ áéíóú Ññ Üü', 'aeiou-aeiou-nn-uu', 'diacríticos del español, en mayúscula y minúscula'],
    ['a\u0301', 'a', 'tilde ya descompuesta (NFD de entrada)'],
    ['a\u20DDb', 'ab', 'marca combinante fuera de U+0300–U+036F: \\p{M} la quita, no la vuelve guion'],
    ['e\u1AB0', 'e', 'otra marca combinante extendida'],
    ['Trámite   con    espacios', 'tramite-con-espacios', 'tramos de espacios colapsan en un guion'],
    ['a--b__c..d', 'a-b-c-d', 'guiones, guiones bajos y puntos repetidos colapsan'],
    ['---hola---', 'hola', 'guiones en los extremos'],
    ['_hola_', 'hola', 'no alfanumérico en los extremos'],
    ['Ley 27.275 / Art. 3°', 'ley-27-275-art-3', 'números se conservan; signos → guion'],
    ['100%', '100', 'signo al final'],
    ['ß', '', 'sin descomposición ni minúscula ASCII: no queda nada'],
    ['Straße', 'stra-e', 'ß en el medio → guion'],
    ['Ærø', 'r', 'letras sin descomposición canónica (Æ, ø) → guion, y se recortan'],
    ['İstanbul', 'istanbul', 'İ = I + U+0307 en NFD; queda "i"'],
    ['\u212Aelvin', 'kelvin', 'signo Kelvin: NFD lo lleva a K'],
    ['日本語', '', 'sin caracteres ASCII: vacío'],
    ['trámite 😀 online', 'tramite-online', 'emoji (par subrogado) → un solo guion'],
    ['a\tb\nc', 'a-b-c', 'tabulaciones y saltos de línea'],
    ['', '', 'vacío'],
    ['   ', '', 'solo espacios'],
    ['¡¡¡', '', 'solo signos'],
    ['MAYÚSCULAS-Y-123', 'mayusculas-y-123', 'mayúsculas con números'],
    ['café.con.leche', 'cafe-con-leche', 'puntos como separador'],
    ['ﬁn', 'n', 'ligadura ﬁ: NFD (canónica, no de compatibilidad) no la separa'],
  ];

  CASOS.forEach(([entrada, esperado, porQue]) => {
    it(`${JSON.stringify(entrada)} → ${JSON.stringify(esperado)} (${porQue})`, () => {
      expect(canonicalizarSlug(entrada)).toBe(esperado);
    });
  });

  it('es idempotente: canonicalizar dos veces da lo mismo (el front puede mandar el slug ya canónico)', () => {
    CASOS.forEach(([entrada]) => {
      const una = canonicalizarSlug(entrada);
      expect(canonicalizarSlug(una)).toBe(una);
    });
  });

  it('el resultado solo tiene [a-z0-9-], sin guiones en los extremos ni repetidos', () => {
    CASOS.map(([entrada]) => canonicalizarSlug(entrada)).filter(Boolean).forEach((slug) => {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    });
  });

  it('null/undefined se tratan como vacío, igual que el `slug == null ? ""` del backend', () => {
    expect(canonicalizarSlug(null as unknown as string)).toBe('');
    expect(canonicalizarSlug(undefined as unknown as string)).toBe('');
  });
});
