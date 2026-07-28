import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Política de Privacidad | Viajando en Tesla y Tesla Chuches',
  description: 'Política de privacidad y protección de datos de la aplicación y sitio web Viajando en Tesla / Tesla Chuches.',
};

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-gray-200 px-4 py-12 max-w-4xl mx-auto font-sans leading-relaxed">
      <div className="mb-8 border-b border-white/10 pb-6">
        <Link 
          href="/" 
          className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-wider mb-4 inline-block"
        >
          ← Volver a Viajando en Tesla
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Política de Privacidad</h1>
        <p className="text-xs text-gray-400 mt-2">Última actualización: 26 de julio de 2026</p>
      </div>

      <div className="space-y-6 text-sm text-gray-300">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. Responsable del Tratamiento</h2>
          <p>
            Esta Política de Privacidad se aplica a la aplicación móvil <strong>Tesla Chuches</strong> y al sitio web <strong>Viajando en Tesla</strong> (accessible en <a href="https://www.viajandoentesla.es" className="text-red-400 underline">https://www.viajandoentesla.es</a>), gestionados por la comunidad de usuarios independientes.
          </p>
          <p>Email de contacto: <a href="mailto:nenacoco50017@gmail.com" className="text-red-400 underline">nenacoco50017@gmail.com</a></p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. Datos Recopilados y Finalidad</h2>
          <p>
            <strong>Tesla Chuches</strong> es un escaparate e índice informativo de accesorios para vehículos Tesla. Nuestra aplicación y sitio web están diseñados respetando al máximo la privacidad del usuario:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-300">
            <li><strong>No solicitamos registro:</strong> No es necesario crear una cuenta ni proporcionar datos personales para usar la aplicación o navegar por el catálogo.</li>
            <li><strong>Ubicación local en el navegador:</strong> Si utilizas la función de navegador/mapa en vivo, la ubicación GPS se procesa exclusivamente de forma local en tu dispositivo para centrar el mapa. En ningún momento se rastrea, guarda o comparte tu ubicación con terceros ni con nuestros servidores.</li>
            <li><strong>Métricas de uso anónimas:</strong> Recopilamos datos estadísticos agregados e inidentificables (número de visitas y dispositivo) para conocer la afluencia al sitio y mejorar el servicio.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">3. Enlaces a Terceros y Afiliación</h2>
          <p>
            Nuestra plataforma contiene enlaces a tiendas de terceros (como AliExpress y Amazon) donde se comercializan los accesorios recomendados. Al hacer clic en un enlace de producto, serás redirigido al sitio web o aplicación oficial del vendedor.
          </p>
          <p>
            Los sitios web de terceros tienen sus propias políticas de privacidad y cookies, de las cuales no nos hacemos responsables. Te recomendamos revisar sus políticas al visitarlos.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">4. Cookies y Almacenamiento Local</h2>
          <p>
            Utilizamos almacenamiento local (<code>localStorage</code>) en tu navegador para guardar preferencias de interfaz (como el modo de visualización o filtros seleccionados). No utilizamos cookies publicitarias ni identificadores de seguimiento entre sitios.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">5. Derechos del Usuario (RGPD)</h2>
          <p>
            Al no recopilar datos personales identificables, no almacenamos perfiles de usuario. No obstante, conforme al Reglamento General de Protección de Datos (RGPD), puedes contactar en cualquier momento a <a href="mailto:nenacoco50017@gmail.com" className="text-red-400 underline">nenacoco50017@gmail.com</a> para resolver cualquier duda relativa a la privacidad de la aplicación.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">6. Cambios en la Política de Privacidad</h2>
          <p>
            Nos reservamos el derecho de actualizar esta Política de Privacidad para adaptarla a novedades legislativas o mejoras en la aplicación. Cualquier cambio será publicado en esta misma página.
          </p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-white/10 text-center text-xs text-gray-500">
        © 2026 Viajando en Tesla / Tesla Chuches. Comunidad independiente no afiliada a Tesla, Inc.
      </div>
    </main>
  );
}
