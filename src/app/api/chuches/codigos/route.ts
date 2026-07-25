import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CODIGOS_PATH = fs.existsSync('/home/xavi/proyectos-antigravity/6-Codigosaliexpress/ultimos_codigos.txt')
  ? '/home/xavi/proyectos-antigravity/6-Codigosaliexpress/ultimos_codigos.txt'
  : path.join(process.cwd(), 'public', 'data', 'ultimos_codigos.txt');

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
    const txt = fs.readFileSync(CODIGOS_PATH, 'utf-8');
    const data = parseCodigos(txt);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ codigos: [], mensaje: 'Sin códigos activos en este momento' });
  }
}
