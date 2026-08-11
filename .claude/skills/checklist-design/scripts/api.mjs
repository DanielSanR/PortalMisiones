// Único módulo que toca la red. La API de checklist.design es pública y sin auth,
// pero no está documentada ni versionada: validamos la forma y fallamos fuerte.
import { BASE_URL } from './render.mjs';

export class ApiError extends Error {
  constructor(message, { url, status }) {
    super(message);
    this.name = 'ApiError';
    this.url = url;
    this.status = status;
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url) {
  let res;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (cause) {
    throw new ApiError(`Fallo de red en ${url}: ${cause.message}`, { url, status: 0 });
  }
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status} en ${url}`, { url, status: res.status });
  }
  let body;
  try {
    body = await res.json();
  } catch (cause) {
    throw new ApiError(`Respuesta no es JSON válido en ${url}: ${cause.message}`, { url, status: res.status });
  }
  if (body?.success !== true) {
    throw new ApiError(
      `Respuesta sin success:true en ${url} — ${body?.error ?? 'sin detalle'}`,
      { url, status: res.status },
    );
  }
  return body;
}

/** Índice completo: categorías con sus checklists. Una sola petición. */
export async function fetchGrouped() {
  const url = `${BASE_URL}/api/checklists/grouped`;
  const body = await getJson(url);
  if (!Array.isArray(body.grouped) || body.grouped.length === 0) {
    throw new ApiError('`grouped` vacío o ausente: cambió la forma de la API', { url, status: 200 });
  }
  for (const cat of body.grouped) {
    if (!cat.slug || !Array.isArray(cat.checklists)) {
      throw new ApiError(`Categoría malformada en ${url}: ${JSON.stringify(cat).slice(0, 120)}`, { url, status: 200 });
    }
  }
  return body.grouped;
}

/**
 * Un checklist completo. `category` NO es opcional: 9 slugs viven en más de una
 * categoría (login, billing, pricing, cart, search, onboarding, account, chat, settings)
 * y sin él la API responde 404.
 */
export async function fetchChecklist(slug, category) {
  const params = new URLSearchParams({ slug, category });
  const url = `${BASE_URL}/api/checklists/by-slug?${params}`;
  const body = await getJson(url);
  if (!body.checklist?.slug) {
    throw new ApiError(`Respuesta sin checklist.slug en ${url}`, { url, status: 200 });
  }
  for (const campo of ['items', 'tabs', 'related']) {
    if (body[campo] != null && !Array.isArray(body[campo])) {
      throw new ApiError(`Campo \`${campo}\` no es un array en ${url}: cambió la forma de la API`, { url, status: 200 });
    }
  }
  return {
    checklist: body.checklist,
    items: body.items ?? [],
    tabs: body.tabs ?? [],
    related: body.related ?? [],
  };
}
