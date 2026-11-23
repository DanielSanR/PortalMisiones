/** Un dato recomendado de la plantilla (informativo: no bloquea el guardado). */
export interface DatoRecomendado {
  etiqueta: string;
  completo: boolean;
}

/** Lo que hace falta saber de una plantilla (o del form en vivo) para evaluar sus datos recomendados. */
export interface EntradaRecomendados {
  resumen: string | null | undefined;
  tieneModalidad: boolean;
  tieneCategoriaPrincipal: boolean;
}

/** Resumen, modalidad y categoría principal: se usa en el formulario y en el detalle. */
export function datosRecomendados(entrada: EntradaRecomendados): DatoRecomendado[] {
  return [
    { etiqueta: 'Resumen', completo: !!entrada.resumen?.trim() },
    { etiqueta: 'Modalidad', completo: entrada.tieneModalidad },
    { etiqueta: 'Categoría principal', completo: entrada.tieneCategoriaPrincipal },
  ];
}

/** "a", "a y b", "a, b y c". */
export function unirLista(items: string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** Línea de una sola frase: "Datos recomendados: completos" o "Recomendado: falta resumen y modalidad". */
export function textoRecomendados(datos: DatoRecomendado[]): string {
  const faltan = datos.filter((d) => !d.completo).map((d) => d.etiqueta.toLowerCase());
  return faltan.length ? `Recomendado: falta ${unirLista(faltan)}` : 'Datos recomendados: completos';
}
