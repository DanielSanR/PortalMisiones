import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Portal de Trámites de Misiones",
  description: "Punto único de acceso digital a trámites y servicios provinciales.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#f7f8fb] font-sans antialiased">{children}</body>
    </html>
  )
}
