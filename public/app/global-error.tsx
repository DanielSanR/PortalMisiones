"use client"

import { useEffect } from "react"

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="es-AR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f7f8fb",
          color: "#0f172a",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            padding: "48px 24px",
            textAlign: "center",
            background: "#ffffff",
            borderRadius: 24,
            boxShadow: "0 12px 40px rgba(33,72,114,0.08)",
          }}
        >
          <p style={{ color: "#4f8ed2", fontSize: 14, fontWeight: 500, margin: 0 }}>
            Error crítico
          </p>
          <h1
            style={{
              marginTop: 12,
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#0f172a",
            }}
          >
            No pudimos cargar el portal.
          </h1>
          <p style={{ marginTop: 12, color: "#64748b", fontSize: 14 }}>
            Algo salió mal. Reintentá en unos segundos.
          </p>
          {error.digest && (
            <p style={{ marginTop: 12, color: "#94a3b8", fontSize: 12 }}>
              Referencia: <code>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 32,
              padding: "12px 24px",
              borderRadius: 9999,
              border: "none",
              background: "#4f8ed2",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
