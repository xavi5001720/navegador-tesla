import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Providers } from "@/components/Providers";

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
  title: "Viajando en Tesla v3.0 | Navegador Premium & Detector de Radares",
  description: "Navegación inteligente optimizada para la pantalla de tu Tesla. Incluye detección de radares Pegasus en tiempo real, tráfico, cargadores y radares meteorológicos.",
  keywords: ["Tesla", "Navegador", "Radares", "Pegasus", "Cargadores Tesla", "Navegación Social"],
  authors: [{ name: "Viajando en Tesla" }],
  openGraph: {
    title: "Viajando en Tesla | Navegador Premium para tu Tesla",
    description: "La mejor experiencia de navegación con alertas en tiempo real de radares Pegasus y tráfico.",
    url: "https://www.viajandoentesla.es",
    siteName: "Viajando en Tesla",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Navegador Premium para Tesla",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Viajando en Tesla | Navegador Premium",
    description: "Navegación inteligente y radares Pegasus para tu Tesla.",
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
