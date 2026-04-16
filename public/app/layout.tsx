import type { Metadata } from "next"
import { Montserrat } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"

const oakSans = localFont({
  src: [
    { path: "../public/fonts/oak-sans/OakSans-Light.ttf", weight: "300", style: "normal" },
    { path: "../public/fonts/oak-sans/OakSans-LightItalic.ttf", weight: "300", style: "italic" },
    { path: "../public/fonts/oak-sans/OakSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/oak-sans/OakSans-Italic.ttf", weight: "400", style: "italic" },
    { path: "../public/fonts/oak-sans/OakSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/oak-sans/OakSans-MediumItalic.ttf", weight: "500", style: "italic" },
    { path: "../public/fonts/oak-sans/OakSans-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/oak-sans/OakSans-SemiBoldItalic.ttf", weight: "600", style: "italic" },
    { path: "../public/fonts/oak-sans/OakSans-Bold.ttf", weight: "700", style: "normal" },
    { path: "../public/fonts/oak-sans/OakSans-BoldItalic.ttf", weight: "700", style: "italic" },
    { path: "../public/fonts/oak-sans/OakSans-ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "../public/fonts/oak-sans/OakSans-ExtraBoldItalic.ttf", weight: "800", style: "italic" },
    { path: "../public/fonts/oak-sans/OakSans-Black.ttf", weight: "900", style: "normal" },
    { path: "../public/fonts/oak-sans/OakSans-BlackItalic.ttf", weight: "900", style: "italic" },
  ],
  display: "swap",
  variable: "--font-oak-sans",
})

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-montserrat",
})

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
    <html lang="es" className={`${oakSans.variable} ${montserrat.variable}`}>
      <body className="min-h-screen bg-[#f7f8fb] font-sans antialiased">{children}</body>
    </html>
  )
}
