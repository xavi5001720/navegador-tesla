import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/gestion-chuches', '/api/chuches/admin'],
    },
    sitemap: 'https://www.viajandoentesla.es/sitemap.xml',
  };
}
