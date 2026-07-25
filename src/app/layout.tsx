import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Providers } from "@/components/Providers";
import AnalyticsTracker from "@/components/AnalyticsTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Accesorios Tesla España | Tesla Chuches — Viajando en Tesla",
  description: "Los mejores accesorios para Tesla Model 3 y Model Y seleccionados por la comunidad. Más de 1.000 productos con enlaces de Amazon y AliExpress. Ayudas EV 2026, códigos AliExpress y referidos Tesla.",
  keywords: ["accesorios Tesla", "Tesla Model 3", "Tesla Model Y", "cargador Tesla", "alfombrillas Tesla", "referidos Tesla", "ayudas coche eléctrico 2026", "Plan Auto+", "wallbox Tesla"],
  authors: [{ name: "Viajando en Tesla" }],
  openGraph: {
    title: "Accesorios Tesla España | Tesla Chuches — Viajando en Tesla",
    description: "Más de 1.000 accesorios para Tesla Model 3 y Model Y, seleccionados y valorados por la comunidad Tesla en Telegram.",
    url: "https://www.viajandoentesla.es",
    siteName: "Viajando en Tesla",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Accesorios Tesla España - Tesla Chuches",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Accesorios Tesla España | Tesla Chuches",
    description: "Los mejores accesorios para tu Tesla, seleccionados por la comunidad.",
    images: ["/og-image.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AnalyticsTracker />
        {/* ErrorBoundary global: captura renders rotos sin blanquear toda la app */}
        <ErrorBoundary>
          <Providers>
            {children}
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
