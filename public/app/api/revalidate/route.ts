import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

/**
 * Webhook de invalidación de cache.
 *
 * Llamado por el backoffice (o cualquier sistema autorizado) cuando se publica,
 * modifica o despublica contenido. Recibe `{ tag: string }` y dispara
 * `revalidateTag(tag)` para que la próxima request regenere la página.
 *
 * Autenticación: header `x-revalidate-secret` que debe coincidir con
 * la env `REVALIDATE_SECRET`. Si no está definida, el endpoint responde 503.
 *
 * Uso desde el backoffice:
 *   POST /api/revalidate
 *   Headers: x-revalidate-secret: <secret>
 *   Body: { "tag": "tramite:mi-slug" }
 *
 * Tags disponibles: ver `lib/api/tags.ts`.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "REVALIDATE_SECRET no configurado" },
      { status: 503 },
    )
  }

  const provided = request.headers.get("x-revalidate-secret")
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido (debe ser JSON)" }, { status: 400 })
  }

  const tag =
    typeof payload === "object" && payload !== null && "tag" in payload
      ? (payload as { tag: unknown }).tag
      : undefined

  if (typeof tag !== "string" || tag.length === 0) {
    return NextResponse.json({ ok: false, error: "Falta el campo 'tag' (string)" }, { status: 400 })
  }

  revalidateTag(tag)

  return NextResponse.json({ ok: true, tag, revalidatedAt: new Date().toISOString() })
}
