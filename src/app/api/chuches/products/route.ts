import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getLivePath(primaryPath: string, fallbackPath: string) {
  if (fs.existsSync(primaryPath)) return primaryPath;
  return fallbackPath;
}

const INVENTARIO_PATH = getLivePath(
  '/home/xavi/proyectos-antigravity/1-referidos/inventarios/inventario_global.json',
  path.join(process.cwd(), 'public', 'data', 'inventario_global.json')
);
const COMENTARIOS_PATH = getLivePath(
  '/home/xavi/proyectos-antigravity/1-referidos/inventarios/comentarios.json',
  path.join(process.cwd(), 'public', 'data', 'comentarios.json')
);
const VOTOS_PATH = getLivePath(
  '/home/xavi/proyectos-antigravity/1-referidos/inventarios/votos_globales.json',
  path.join(process.cwd(), 'public', 'data', 'votos_globales.json')
);

const TESLA_GROUP_ID = '-1003731237376';
const TOPIC_MODEL3 = '7';
const TOPIC_MODELY = '8';
const TOPIC_CARGAR = '9';
const TOPIC_MANTENIMIENTO = '12';
const TOPIC_MERCHANDISING = '625';

const CAT_CARGADORES = 'Cargadores';

function readJSON(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function getVotos(votos: Record<string, Record<string, number>>, key: string): number {
  const entry = votos?.[key];
  if (!entry) return 0;
  return Object.values(entry).reduce((sum, v) => sum + v, 0);
}

function buildProductList(items: any[], comentarios: Record<string, any[]>, votos: Record<string, any>, section: string) {
  return items.map((item: any) => {
    const key = `${item.platform}_${item.product_id}`;
    const cmts = comentarios?.[key] || [];
    const totalVotos = getVotos(votos, key);
    const imgPath = item.image || '';
    return {
      id: item.product_id,
      platform: item.platform,
      title: item.title,
      affiliate_url: item.affiliate_url || item.link || null,
      image: imgPath ? `/${imgPath}` : null,
      image_remote: item.image_remote || null,
      recommendations: (item.recommendations || 0) + totalVotos,
      votes: totalVotos,
      categorias: item.categorias || [],
      versiones: item.versiones || [],
      num_comentarios: cmts.length,
      comentarios: cmts.slice(0, 3).map((c: any) => ({
        username: c.username,
        text: c.text,
        date: c.date,
      })),
      sale_price: item.sale_price || null,
      original_price: item.original_price || null,
      discount: item.discount || null,
      timestamp: item.timestamp || null,
      section,
    };
  }).sort((a: any, b: any) => b.recommendations - a.recommendations);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section') || 'model3';
  const categoria = searchParams.get('cat') || '';
  const version = searchParams.get('ver') || '';
  const busqueda = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '48');

  const inventario = readJSON(INVENTARIO_PATH);
  const comentarios = readJSON(COMENTARIOS_PATH) || {};
  const votos = readJSON(VOTOS_PATH) || {};

  if (!inventario) {
    return NextResponse.json({ error: 'Inventario no disponible' }, { status: 503 });
  }

  const teslaData = inventario[TESLA_GROUP_ID]?.topics || {};
  let items: any[] = [];

  if (section === 'model3') {
    items = teslaData[TOPIC_MODEL3]?.items || [];
  } else if (section === 'modely') {
    items = teslaData[TOPIC_MODELY]?.items || [];
  } else if (section === 'cargar') {
    const cargarItems = teslaData[TOPIC_CARGAR]?.items || [];
    const m3Cargadores = (teslaData[TOPIC_MODEL3]?.items || []).filter((i: any) =>
      (i.categorias || []).includes(CAT_CARGADORES)
    );
    const myCargas = (teslaData[TOPIC_MODELY]?.items || []).filter((i: any) =>
      (i.categorias || []).includes(CAT_CARGADORES)
    );
    const seen = new Set<string>();
    for (const item of [...cargarItems, ...m3Cargadores, ...myCargas]) {
      const k = `${item.platform}_${item.product_id}`;
      if (!seen.has(k)) {
        seen.add(k);
        items.push(item);
      }
    }
  } else if (section === 'mantenimiento') {
    items = teslaData[TOPIC_MANTENIMIENTO]?.items || [];
  } else if (section === 'lifestyle') {
    items = teslaData[TOPIC_MERCHANDISING]?.items || [];
  }

  let productos = buildProductList(items, comentarios, votos, section);

  // Filtro por categoría
  if (categoria) {
    productos = productos.filter((p: any) =>
      p.categorias.some((c: string) => c.toLowerCase() === categoria.toLowerCase())
    );
  }

  // Filtro por versión
  if (version) {
    productos = productos.filter((p: any) =>
      p.versiones.some((v: string) => v.toLowerCase() === version.toLowerCase())
    );
  }

  // Filtro por búsqueda
  if (busqueda) {
    const q = busqueda.toLowerCase();
    productos = productos.filter((p: any) =>
      p.title.toLowerCase().includes(q)
    );
  }

  // Obtener categorías únicas con su contador exacto
  const allItems = buildProductList(items, {}, {}, section);
  const categoriasMap: Record<string, number> = {};
  const versionesMap: Record<string, number> = {};

  for (const p of allItems) {
    for (const c of p.categorias) {
      if (c) categoriasMap[c] = (categoriasMap[c] || 0) + 1;
    }
    for (const v of p.versiones) {
      if (v && v !== '__todas__') versionesMap[v] = (versionesMap[v] || 0) + 1;
    }
  }

  const categorias = Object.entries(categoriasMap)
    .sort((a, b) => a[0].localeCompare(b[0])) // Orden alfabético para encontrar fácil
    .map(([nombre, count]) => ({ nombre, count }));

  const versiones = Object.entries(versionesMap)
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, count]) => ({ nombre, count }));

  // Paginación
  const total = productos.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginated = productos.slice(offset, offset + limit);

  return NextResponse.json({
    section,
    total,
    page,
    totalPages,
    categorias,
    versiones,
    productos: paginated,
  });
}
