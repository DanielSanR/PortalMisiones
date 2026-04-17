import type { Etiqueta, Organismo, Tramite } from '@/models/tramite.model';

export function sanitizeText(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  return value
    .replaceAll('\u00c3\u00b3', 'o')
    .replaceAll('\u00c3\u00a9', 'e')
    .replaceAll('\u00c3\u00a1', 'a')
    .replaceAll('\u00c3\u00ad', 'i')
    .replaceAll('\u00c3\u00ba', 'u')
    .replaceAll('\u00c3\u00b1', 'n')
    .replaceAll('\u00c2\u00bf', '')
    .replaceAll('\u00c3\u0098', 'U');
}

export function sanitizeOrganismo(organismo: Organismo | undefined): Organismo | undefined {
  if (!organismo) return undefined;
  return {
    ...organismo,
    nombre: sanitizeText(organismo.nombre) ?? organismo.nombre,
  };
}

export function sanitizeEtiqueta(etiqueta: Etiqueta): Etiqueta {
  return {
    ...etiqueta,
    nombre: sanitizeText(etiqueta.nombre) ?? etiqueta.nombre,
  };
}

export function sanitizeTramite(tramite: Tramite): Tramite {
  return {
    ...tramite,
    titulo: sanitizeText(tramite.titulo) ?? tramite.titulo,
    resumen: sanitizeText(tramite.resumen),
    descripcionLarga: sanitizeText(tramite.descripcionLarga),
    organismo: sanitizeOrganismo(tramite.organismo),
    modalidad: tramite.modalidad,
    etiquetas: tramite.etiquetas.map(sanitizeEtiqueta),
  };
}
