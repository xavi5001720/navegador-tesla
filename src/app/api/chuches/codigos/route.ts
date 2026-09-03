import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getRawText(): Promise<string | null> {
  // 1. Intentar obtener los códigos desde Supabase (funciona en tiempo real en Vercel)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uoejbgifzstyugjsnwkc.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_LcxIB1UQ7fRvYlLMCbQsDg_ESjWuQwd';

    const res = await fetch(
      `${supabaseUrl}/rest/v1/estado_bot?id_destino=eq.GLOBAL_ULTIMOS_CODIGOS&select=email_id`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0]?.email_id) {
        return data[0].email_id;
      }
    }
  } catch (e) {
    console.error('Error al obtener códigos desde Supabase:', e);
  }

  // 2. Fallback a archivos locales
  const paths = [
    '/home/xavi/proyectos-antigravity/6-Codigosaliexpress/ultimos_codigos.txt',
    path.join(process.cwd(), 'public', 'data', 'ultimos_codigos.txt'),
    path.resolve('./public/data/ultimos_codigos.txt'),
    path.join(__dirname, '../../../../public/data/ultimos_codigos.txt'),
  ];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        if (content && content.trim()) return content;
      }
    } catch {}
  }
  return null;
}

function parseCodigos(txt: string) {
  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean);

  let inicio = '';
  let fin = '';
  let enlace = '';
  let publicado = '';
  const codigos: { codigo: string; descuento: string }[] = [];

  for (const line of lines) {
    if (line.includes('Inicio:')) inicio = line.replace(/.*Inicio:\s*/, '').trim();
    else if (line.includes('Fin:')) fin = line.replace(/.*Fin:\s*/, '').trim();
    else if (line.includes('Enlace a la promo')) {
      const match = line.match(/\((.+?)\)/);
      if (match) enlace = match[1];
    } else if (line.includes('Publicado:')) publicado = line.replace(/.*Publicado:\s*/, '').trim();
    else if (line.startsWith('👉')) {
      const clean = line.replace('👉', '').replace(/`/g, '').trim();
      const parts = clean.split('->');
      if (parts.length === 2) {
        codigos.push({ codigo: parts[0].trim(), descuento: parts[1].trim() });
      }
    }
  }

  return { inicio, fin, enlace, publicado, codigos };
}

export async function GET(_req: NextRequest) {
  try {
    const txt = await getRawText();
    if (!txt) {
      return NextResponse.json({ codigos: [], mensaje: 'Sin códigos activos en este momento' });
    }
    const data = parseCodigos(txt);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch {
    return NextResponse.json({ codigos: [], mensaje: 'Sin códigos activos en este momento' });
  }
}
