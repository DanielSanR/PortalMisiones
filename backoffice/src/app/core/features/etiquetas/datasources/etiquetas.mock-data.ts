import { TagResponseDTO } from '../models/etiqueta.dto';

/**
 * Semilla del mock con la forma real de `/api/tag` (todas globales). Los slugs vienen del mock
 * legado de trámites (chips transversales del Figma), que se retiró en la fase 5.
 */
const SLUGS = [
  'personas', 'ninos', 'dni', 'salud', 'educacion', 'alimentos', 'adultos-mayores', 'discapacidad',
  'reciclaje', 'seguridad', 'medio-ambiente', 'jubilaciones', 'cultura', 'deportes', 'turismo',
];

export const MOCK_TAGS: TagResponseDTO[] = SLUGS.map((slug, i) => ({
  id: `tag-${i + 1}`,
  slug,
  local: false,
  organismId: null,
}));
