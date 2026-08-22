import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getCodigosPath() {
  const primary = '/home/xavi/proyectos-antigravity/6-Codigosaliexpress/ultimos_codigos.txt';
  if (fs.existsSync(primary)) return primary;
  const secondary = path.join(process.cwd(), 'public', 'data', 'ultimos_codigos.txt');
  if (fs.existsSync(secondary)) return secondary;
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
    const filePath = getCodigosPath();
    if (!filePath) {
      return NextResponse.json({ codigos: [], mensaje: 'Sin códigos activos en este momento' });
    }
    const txt = fs.readFileSync(filePath, 'utf-8');
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
