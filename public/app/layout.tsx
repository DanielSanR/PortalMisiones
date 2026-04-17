import type { Metadata } from "next"
import { Montserrat } from "next/font/google"
import localFont from "next/font/local"
import { JsonLd } from "@/components/seo/json-ld"
import { organizationSchema } from "@/lib/seo/jsonld"
import { SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, SITE_URL } from "@/lib/seo/site"
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
    {
      path: "../public/fonts/oak-sans/OakSans-ExtraBoldItalic.ttf",
      weight: "800",
      style: "italic",
    },
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${oakSans.variable} ${montserrat.variable}`}>
      <body className="bg-background min-h-screen font-sans antialiased">
        <JsonLd data={organizationSchema()} />
        {children}
      </body>
    </html>
  )
}
