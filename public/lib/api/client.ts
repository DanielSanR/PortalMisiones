import { API_BASE_URL, API_REVALIDATE_SECONDS, API_TIMEOUT_MS, API_TOKEN } from "@/lib/config/env"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export class ApiNotConfiguredError extends Error {
  constructor() {
    super(
      "API no configurada. Definí API_BASE_URL (o NEXT_PUBLIC_API_BASE_URL) y NEXT_PUBLIC_USE_API=true.",
    )
    this.name = "ApiNotConfiguredError"
  }
}

export interface ApiGetOptions {
  /** Tags de Next.js para `revalidateTag`. */
  tags?: string[]
  /** TTL en segundos. `0` = no-cache, `false` = usar default. */
  revalidate?: number | false
  /** Query string como objeto (valores nullish se omiten). */
  query?: Record<string, string | number | boolean | undefined | null>
  /** Header Accept. Default: application/json. */
  accept?: string
  /** AbortSignal externo. */
  signal?: AbortSignal
}

function buildUrl(path: string, query?: ApiGetOptions["query"]): string {
  if (!API_BASE_URL) throw new ApiNotConfiguredError()
  const base = path.startsWith("/") ? path : `/${path}`
  const url = new URL(`${API_BASE_URL}${base}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

/**
 * GET tipado contra la API del backoffice.
 * Devuelve el JSON parseado. Lanza `ApiError` en 4xx/5xx y `ApiNotConfiguredError`
 * si falta configuración.
 */
export async function apiGet<T>(path: string, options: ApiGetOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  options.signal?.addEventListener("abort", () => controller.abort(), { once: true })

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: options.accept ?? "application/json",
        ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
      },
      signal: controller.signal,
      next: {
        tags: options.tags,
        revalidate:
          options.revalidate === false
            ? API_REVALIDATE_SECONDS
            : (options.revalidate ?? API_REVALIDATE_SECONDS),
      },
    })

    if (!res.ok) {
      throw new ApiError(`HTTP ${res.status} ${res.statusText}`, res.status, url)
    }

    return (await res.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Igual que `apiGet` pero devuelve `undefined` ante un 404 en lugar de lanzar.
 * Útil para resources por slug/id donde "no existe" es caso esperado.
 */
export async function apiGetOptional<T>(
  path: string,
  options: ApiGetOptions = {},
): Promise<T | undefined> {
  try {
    return await apiGet<T>(path, options)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined
    throw err
  }
}
