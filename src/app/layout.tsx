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
  metadataBase: new URL("https://www.viajandoentesla.es"),
  title: "Viajando en Tesla | Accesorios Tesla España y Navegador Inteligente",
  description: "Comunidad oficial Tesla España. Descubre más de 1.000 accesorios recomendados para Model 3 y Model Y, navegador con avisador de radares, cargadores y descuentos.",
  keywords: [
    "Viajando en Tesla", 
    "Tesla Chuches", 
    "accesorios Tesla España", 
    "accesorios Tesla Model 3", 
    "accesorios Tesla Model Y", 
    "navegador Tesla", 
    "radares Tesla", 
    "cargadores Tesla", 
    "códigos AliExpress Tesla"
  ],
  authors: [{ name: "Comunidad Viajando en Tesla" }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: "Viajando en Tesla | Comunidad y Accesorios Tesla España",
    description: "El mejor escaparate de accesorios, chuches recomendadas y navegador inteligente con avisador de radares para tu Tesla Model 3 y Model Y.",
    url: "https://www.viajandoentesla.es",
    siteName: "Viajando en Tesla",
    images: [
      {
        url: "/logo-teslachuches.png",
        width: 800,
        height: 800,
        alt: "Comunidad Tesla Chuches - Viajando en Tesla",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Viajando en Tesla | Accesorios y Navegador Tesla",
    description: "Accesorios recomendados por la comunidad para tu Tesla y navegador inteligente con aviso de radares.",
    images: ["/logo-teslachuches.png"],
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Viajando en Tesla",
    "alternateName": ["Tesla Chuches", "Viajando en Tesla España"],
    "url": "https://www.viajandoentesla.es",
    "description": "Escaparate de la comunidad con más de 1.000 accesorios recomendados para Tesla Model 3, Model Y y navegador inteligente con aviso de radares en tiempo real."
  };

  return (
    <html lang="es">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
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
