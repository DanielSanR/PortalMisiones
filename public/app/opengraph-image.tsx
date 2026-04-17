import { ImageResponse } from "next/og"
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/site"

export const alt = SITE_NAME
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "80px",
        background: "linear-gradient(135deg, #2f6eb1 0%, #264f82 60%, #1a3b64 100%)",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -120,
          bottom: -160,
          fontSize: 720,
          fontWeight: 800,
          color: "rgba(255,255,255,0.08)",
          lineHeight: 1,
        }}
      >
        M
      </div>

      <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, opacity: 0.85 }}>
        GOBIERNO DE LA PROVINCIA DE MISIONES
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            maxWidth: 960,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            fontWeight: 400,
            lineHeight: 1.3,
            color: "rgba(255,255,255,0.85)",
            maxWidth: 900,
          }}
        >
          {SITE_DESCRIPTION}
        </div>
      </div>
    </div>,
    { ...size },
  )
}
