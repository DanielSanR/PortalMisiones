/**
 * Cache tags centralizados para `fetch({ next: { tags } })` y `revalidateTag`.
 *
 * El backoffice (o webhooks del CMS) llaman `revalidateTag(tags.tramite(slug))`
 * vía route handler para invalidar una ficha puntual sin purgar todo.
 */

export const tags = {
  tramites: () => "tramites:list",
  tramite: (slug: string) => `tramite:${slug}`,
  tramitesByCategoria: (categoriaId: number) => `tramites:categoria:${categoriaId}`,
  tramitesByOrganismo: (organismoId: string) => `tramites:organismo:${organismoId}`,
  tramitesByEvento: (eventoId: number) => `tramites:evento:${eventoId}`,
  contenidoLocalidad: (tramiteId: string, localidadId: number) =>
    `contenido:${tramiteId}:${localidadId}`,

  categorias: () => "categorias:list",
  categoria: (slug: string) => `categoria:${slug}`,
  subcategorias: (parentId: number) => `subcategorias:${parentId}`,

  organismos: () => "organismos:list",
  organismo: (slug: string) => `organismo:${slug}`,
  modalidades: () => "modalidades:list",
  etiquetas: () => "etiquetas:list",
  destinatarios: () => "destinatarios:list",
  localidades: () => "localidades:list",
  eventosDeVida: () => "eventos:list",
  eventoDeVida: (slug: string) => `evento:${slug}`,
}
