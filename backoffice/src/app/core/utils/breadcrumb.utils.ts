/**
 * Breadcrumb del shell, declarado en `route.data.breadcrumb`.
 *
 * Cada segmento puede ser:
 * - un `string` (forma corta, la que usan todas las rutas hoy): si coincide con el label
 *   de un ítem del nav, enlaza a la ruta de ese ítem —que es la lista de la sección—;
 * - un `{ label, link }` explícito, para un tramo intermedio que no sea una sección del nav
 *   (o que deba apuntar a otro lado).
 *
 * El ÚLTIMO segmento es la página actual: nunca enlaza, aunque declare `link`.
 */
export interface BreadcrumbSegmento {
  label: string;
  link?: string;
}

export type BreadcrumbDeclarado = string | BreadcrumbSegmento;

/** Segmento listo para dibujar: `link` en null = texto (página actual o tramo sin destino). */
export interface BreadcrumbItem {
  label: string;
  link: string | null;
}

/**
 * Lo mínimo del nav que hace falta para resolver los links por label. Pasar SOLO las secciones visibles
 * para el usuario: un label sin sección visible queda sin link (no se enlaza a algo que el guard rechaza).
 */
export interface SeccionNav {
  label: string;
  route: string;
}

export function resolverBreadcrumb(
  declarado: readonly BreadcrumbDeclarado[] | undefined,
  secciones: readonly SeccionNav[],
): BreadcrumbItem[] {
  const segmentos = declarado ?? [];
  return segmentos.map((segmento, i) => {
    const label = typeof segmento === 'string' ? segmento : segmento.label;
    if (i === segmentos.length - 1) return { label, link: null };

    const linkExplicito = typeof segmento === 'string' ? undefined : segmento.link;
    const link = linkExplicito ?? secciones.find((s) => s.label === label)?.route ?? null;
    return { label, link };
  });
}
