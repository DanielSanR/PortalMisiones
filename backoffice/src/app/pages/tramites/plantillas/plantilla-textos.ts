import { MembreteDato } from '@shared/components/membrete/membrete.component';

/** Lo que el membrete de una plantilla muestra cuando todavía no hay título (formulario recién abierto). */
export const PLANTILLA_SIN_TITULO = 'Plantilla sin título';

/**
 * Línea meta del membrete de una plantilla: slug · modalidad · categoría principal. La comparten el detalle y
 * el formulario (que la arma en vivo con lo que se escribe). Los nombres llegan ya resueltos; vacío = "Sin …".
 */
export function membreteDePlantilla(p: { slug: string; modalidad: string; principal: string }): MembreteDato[] {
  return [
    { texto: p.slug || 'sin-slug', codigo: true },
    { texto: p.modalidad || 'Sin modalidad', icono: 'devices' },
    { texto: p.principal || 'Sin categoría principal', icono: 'folders' },
  ];
}
