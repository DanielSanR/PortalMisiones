import { normalize } from '@/lib/format/normalize';

/**
 * Convierte un nombre humano en un slug URL-safe:
 * - normaliza acentos (NFD)
 * - minúsculas
 * - reemplaza cualquier secuencia no alfanumérica por "-"
 * - recorta "-" inicial/final
 *
 * "Instituto Provincial de Salud (IPS)" → "instituto-provincial-de-salud-ips"
 */
export function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
