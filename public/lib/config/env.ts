/**
 * Configuración tipada de variables de entorno.
 *
 * El portal soporta dos fuentes de datos:
 *   - mocks (default, en `mocks/mock-data.ts`)
 *   - API REST real (cuando `NEXT_PUBLIC_USE_API=true` y `API_BASE_URL` está definido)
 *
 * Para activar la API real, definir en `.env.local`:
 *   NEXT_PUBLIC_USE_API=true
 *   API_BASE_URL=https://api.tramites.misiones.gob.ar
 *   API_TOKEN=...   # opcional, solo server-side
 */

const truthy = (v: string | undefined): boolean => v === "true" || v === "1" || v === "yes"

export const USE_API: boolean = truthy(process.env.NEXT_PUBLIC_USE_API)

export const API_BASE_URL: string =
  process.env.API_BASE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  ""

/** Token de autenticación server-to-server. No exponer al cliente. */
export const API_TOKEN: string | undefined = process.env.API_TOKEN

/** Timeout para requests HTTP (ms). */
export const API_TIMEOUT_MS: number = Number(process.env.API_TIMEOUT_MS ?? 10_000)

/** TTL por defecto para `fetch` ISR (segundos). */
export const API_REVALIDATE_SECONDS: number = Number(process.env.API_REVALIDATE_SECONDS ?? 300)
