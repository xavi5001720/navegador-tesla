import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const IMG_BASE = fs.existsSync(path.join(process.cwd(), 'public', 'img'))
  ? path.join(process.cwd(), 'public')
  : path.join(process.cwd(), '..', '1-referidos', 'inventarios');

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imgPath = searchParams.get('path') || '';

  if (!imgPath) {
    return new NextResponse('No path', { status: 400 });
  }

  // Seguridad: evitar path traversal
  const normalized = path.normalize(imgPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(IMG_BASE, normalized);

  if (!fullPath.startsWith(IMG_BASE)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType =
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      ext === '.png' ? 'image/png' :
      ext === '.webp' ? 'image/webp' :
      'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
