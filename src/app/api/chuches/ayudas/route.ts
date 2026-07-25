import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const AYUDAS_PATH = fs.existsSync(path.join(process.cwd(), 'public', 'data', 'ayudas_ev.json'))
  ? path.join(process.cwd(), 'public', 'data', 'ayudas_ev.json')
  : path.join(process.cwd(), '..', '1-referidos', 'inventarios', 'ayudas_ev.json');

export async function GET(_req: NextRequest) {
  try {
    const data = JSON.parse(fs.readFileSync(AYUDAS_PATH, 'utf-8'));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Ayudas no disponibles' }, { status: 503 });
  }
}
