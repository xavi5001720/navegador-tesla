import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export const LIVE_INV_DIR = '/home/xavi/proyectos-antigravity/1-referidos/inventarios';
export const PUBLIC_DATA_DIR = path.join(process.cwd(), 'public', 'data');

export function isLocalServer(): boolean {
  try {
    return fs.existsSync(path.join(LIVE_INV_DIR, 'inventario_global.json'));
  } catch {
    return false;
  }
}

export function getLivePath(filename: string): string {
  const primary = path.join(LIVE_INV_DIR, filename);
  if (fs.existsSync(primary)) return primary;
  return path.join(PUBLIC_DATA_DIR, filename);
}

export const INVENTARIO_PATH = getLivePath('inventario_global.json');
export const COMENTARIOS_PATH = getLivePath('comentarios.json');
export const VOTOS_PATH = getLivePath('votos_globales.json');
export const REFERIDOS_PATH = getLivePath('referidos_tesla.json');
export const TOPICS_PATH = getLivePath('topics.json');

export interface BrandMeta {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  telegram: string;
}

export const BRAND_CONFIG: BrandMeta[] = [
  { id: '-1003731237376', slug: 'tesla', name: 'Tesla', emoji: '⚡', telegram: 'https://t.me/tesla_chuches' },
  { id: '-1003830492404', slug: 'leapmotor', name: 'Leapmotor', emoji: '🦁', telegram: 'https://t.me/leapmotorchuches' },
  { id: '-1003567148182', slug: 'byd', name: 'BYD', emoji: '🐉', telegram: 'https://t.me/bydchuches' },
  { id: '-1003762807037', slug: 'xpeng', name: 'Xpeng', emoji: '🚀', telegram: 'https://t.me/xpengchuches' },
  { id: '-1003495139384', slug: 'toyota', name: 'Toyota', emoji: '🇯🇵', telegram: 'https://t.me/toyotachuches' },
  { id: '-1003350030481', slug: 'hyundai', name: 'Hyundai', emoji: '🇰🇷', telegram: 'https://t.me/hyundaichuchesev' },
  { id: '-1003639553835', slug: 'camper', name: 'Camper', emoji: '🚐', telegram: 'https://t.me/camperchuches' },
  { id: '-1003999911242', slug: 'mg', name: 'MG', emoji: '🇬🇧', telegram: 'https://t.me/mgchuches' },
  { id: '-1003890609328', slug: 'volkswagen', name: 'Volkswagen', emoji: '🇩🇪', telegram: 'https://t.me/vwchuches' },
  { id: '-1004459119873', slug: 'geely', name: 'Geely', emoji: '🚙', telegram: 'https://t.me/geelychuches' },
  { id: '-1002517190518', slug: 'chuches_ev', name: 'Chuches EV General', emoji: '🔌', telegram: 'https://t.me/chuchesev' },
  { id: '-1003962661998', slug: 'cnc', name: 'CNC Parámetros', emoji: '📐', telegram: 'https://t.me/cncparametros' },
];

const NON_PRODUCT_TOPIC_PATTERNS = [
  /hilo borrado/i,
  /^general \(para charlar\)/i,
  /^grupo general$/i,
  /^inventario tesla$/i,
  /^referidos tesla$/i,
  /^ayudas y subvenciones/i,
  /^navegapro$/i,
  /^fsd$/i,
  /^escapadas$/i,
  /^seguros low cost$/i,
  /^c[oó]digos aliexpress$/i,
  /^cupones aliexpress$/i,
  /^cálculo de parámetros/i,
  /📐/i,
  /^true$/i,
];

export function isProductTopic(topicId: string, topicName: string, itemCount: number): boolean {
  if (topicId === 'NON_FORUM') return false;
  if (itemCount > 0) return true;
  for (const pat of NON_PRODUCT_TOPIC_PATTERNS) {
    if (pat.test(topicName.trim())) return false;
  }
  if (topicId === '1' && /^general$/i.test(topicName.trim())) return false;
  if (topicId === 'general' && itemCount === 0) return false;
  return true;
}

export function isCargarTopicName(topicName: string): boolean {
  return /cargar\s+en\s+casa/i.test((topicName || '').trim());
}

const EV_HOME_CHARGER_PAT = /(tipo\s*2|type\s*2|wallbox|iec\s*62196|evse|schuko|mennekes|3[.,]5\s*kw|3[.,]6\s*kw|3[.,]7\s*kw|7[.,]2\s*kw|7[.,]4\s*kw|7[.,]6\s*kw|11\s*kw|22\s*kw|16\s*a|32\s*a|green\s*up|feyree|trydan|masterplug|afeev|cargador\s+(de\s+)?(pared|coche\s+el[eé]ctrico|veh[ií]culo\s+el[eé]ctrico|ev\b|port[aá]til\s+ev)|cable\s+de\s+carga\s+ev|estaci[oó]n\s+de\s+carga)/i;
const PHONE_OR_MODEL_SPECIFIC_PAT = /(magsafe|inal[aá]mbric|tel[eé]fono|m[oó]vil|iphone|usb|encendedor|cigarrillo|consola|reposabrazos|ccs2|nacs|chademo|puerta\s+de\s+carga|tapa\s+de\s+puerto|cubierta\s+de\s+puerto|v2l|glovebox)/i;

/**
 * Determina si un artículo es un cargador EV doméstico universal (categoría Cargadores o Wifi de garaje)
 * apto para compartirse en la sección "Cargar en CASA" de todas las marcas.
 * Los "Organizadores" NO se comparten porque pueden llevar el logo de una marca concreta.
 */
export function isSharedCargarEnCasaItem(item: any, isFromCargarTopic: boolean): boolean {
  const cats: string[] = Array.isArray(item?.categorias) ? item.categorias : [];
  const title: string = item?.title || '';

  if (PHONE_OR_MODEL_SPECIFIC_PAT.test(title)) {
    return false;
  }

  if (isFromCargarTopic) {
    // De los topics "Cargar en CASA", compartimos los de categoría Cargadores o Wifi
    return cats.includes('Cargadores') || cats.includes('Wifi');
  }

  // De los topics de modelos (Model 3, Model Y, Atto 2, G6, B10...), compartimos los que tienen
  // categoría Cargadores y son cargadores de coche en casa (Wallbox / Tipo 2 / Schuko)
  if (cats.includes('Cargadores') && EV_HOME_CHARGER_PAT.test(title)) {
    return true;
  }

  return false;
}

export function normalizeProductTitleKey(title: string): string {
  return (title || '')
    .replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 65);
}

/**
 * Limpia referencias a otros modelos/marcas del título de un cargador universal
 * para que cada marca vea el catálogo 100% profesional y exclusivo de su marca.
 */
export function cleanUniversalChargerTitle(title: string): string {
  return (title || '')
    .replace(/\bpara\s+(tesla\s+)?model\s*[3ysx](\/[3ysx])?[^,.|]*?(y\s+otros\s+bev\/phev|y\s+veh[ií]culos\s+bev\/phev)/gi, 'para Vehículos Eléctricos (BEV/PHEV)')
    .replace(/\bpara\s+tesla\s+model\s*[3ysx][^,.|]*/gi, 'para Vehículos Eléctricos Tipo 2')
    .trim();
}

const jsonCache: Record<string, { data: any; mtime: number }> = {};

export function readJSONRaw(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    const cached = jsonCache[filePath];
    if (cached && cached.mtime === stat.mtimeMs) {
      return JSON.parse(JSON.stringify(cached.data));
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    jsonCache[filePath] = { data, mtime: stat.mtimeMs };
    return JSON.parse(JSON.stringify(data));
  } catch (err) {
    console.error(`[chuchesData] Error reading ${filePath}:`, err);
    return null;
  }
}

function createBackupIfNeeded(filePath: string) {
  try {
    if (!isLocalServer() || !fs.existsSync(filePath)) return;
    const backupDir = path.join(LIVE_INV_DIR, 'backups_web');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const baseName = path.basename(filePath, '.json');
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}`;
    const backupFile = path.join(backupDir, `${baseName}_${stamp}.json`);
    // Crear backup máximo 1 vez por hora por archivo para no saturar disco, manteniendo los últimos 20
    if (!fs.existsSync(backupFile)) {
      fs.copyFileSync(filePath, backupFile);
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith(baseName + '_') && f.endsWith('.json'))
        .sort();
      if (files.length > 20) {
        for (const old of files.slice(0, files.length - 20)) {
          try { fs.unlinkSync(path.join(backupDir, old)); } catch {}
        }
      }
    }
  } catch (e) {
    console.warn('[chuchesData] Warning creating backup:', e);
  }
}

export function writeJSONSafe(filename: string, data: any): boolean {
  try {
    const liveFile = path.join(LIVE_INV_DIR, filename);
    const publicFile = path.join(PUBLIC_DATA_DIR, filename);
    const content = JSON.stringify(data, null, 2);

    let wroteLocal = false;
    if (fs.existsSync(LIVE_INV_DIR)) {
      createBackupIfNeeded(liveFile);
      const tmpFile = `${liveFile}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, content, 'utf-8');
      fs.renameSync(tmpFile, liveFile);
      const stat = fs.statSync(liveFile);
      jsonCache[liveFile] = { data: JSON.parse(content), mtime: stat.mtimeMs };
      wroteLocal = true;
    }

    if (fs.existsSync(PUBLIC_DATA_DIR)) {
      try {
        const tmpPub = `${publicFile}.tmp.${Date.now()}`;
        fs.writeFileSync(tmpPub, content, 'utf-8');
        fs.renameSync(tmpPub, publicFile);
        const statPub = fs.statSync(publicFile);
        jsonCache[publicFile] = { data: JSON.parse(content), mtime: statPub.mtimeMs };
      } catch {
        // En Vercel public/data es de solo lectura
      }
    }

    return wroteLocal;
  } catch (err) {
    console.error(`[chuchesData] Error writing ${filename}:`, err);
    return false;
  }
}

// ── Sincronización Híbrida con Supabase Storage (para cambios hechos en Vercel) ──
const SUPABASE_BUCKET = 'chuches-sync';
const ACTIONS_FILE = 'admin_actions.json';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface AdminAction {
  id: string;
  timestamp: string;
  type:
    | 'update_product'
    | 'delete_product'
    | 'add_comment'
    | 'update_comment'
    | 'delete_comment'
    | 'manage_versions'
    | 'manage_categories'
    | 'publish_product';
  payload: any;
  appliedLocally?: boolean;
}

let actionsCache: { actions: AdminAction[]; fetchedAt: number } = { actions: [], fetchedAt: 0 };

export async function getCloudActions(forceRefresh = false): Promise<AdminAction[]> {
  const now = Date.now();
  if (!forceRefresh && now - actionsCache.fetchedAt < 4000) {
    return actionsCache.actions;
  }
  const sb = getSupabaseAdmin();
  if (!sb) return actionsCache.actions;
  try {
    const { data, error } = await sb.storage.from(SUPABASE_BUCKET).download(ACTIONS_FILE);
    if (error || !data) {
      actionsCache = { actions: [], fetchedAt: now };
      return [];
    }
    const text = await data.text();
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : [];
    actionsCache = { actions: list, fetchedAt: now };
    return list;
  } catch {
    return actionsCache.actions;
  }
}

export async function saveCloudActions(actions: AdminAction[]): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  try {
    const body = Buffer.from(JSON.stringify(actions, null, 2), 'utf-8');
    const { error } = await sb.storage.from(SUPABASE_BUCKET).upload(ACTIONS_FILE, body, {
      contentType: 'application/json',
      upsert: true,
    });
    if (!error) {
      actionsCache = { actions, fetchedAt: Date.now() };
      return true;
    }
    return false;
  } catch (e) {
    console.error('[chuchesData] Error saving cloud actions:', e);
    return false;
  }
}

export function applyActionToMemory(
  action: AdminAction,
  inventario: any,
  comentarios: Record<string, any[]>,
  topicsData?: any
): boolean {
  const p = action.payload || {};
  let changed = false;

  if (action.type === 'delete_product') {
    const { groupId, topicId, platform, productId, scope } = p;
    const matchItem = (it: any) =>
      String(it.product_id) === String(productId) && String(it.platform) === String(platform);

    if (scope === 'all') {
      for (const gid of Object.keys(inventario)) {
        if (gid === '_global') continue;
        const topics = inventario[gid]?.topics || {};
        for (const tid of Object.keys(topics)) {
          const before = (topics[tid]?.items || []).length;
          topics[tid].items = (topics[tid]?.items || []).filter((it: any) => !matchItem(it));
          if (topics[tid].items.length !== before) changed = true;
        }
      }
    } else if (scope === 'brand' && groupId && inventario[groupId]?.topics) {
      const topics = inventario[groupId].topics;
      for (const tid of Object.keys(topics)) {
        const before = (topics[tid]?.items || []).length;
        topics[tid].items = (topics[tid]?.items || []).filter((it: any) => !matchItem(it));
        if (topics[tid].items.length !== before) changed = true;
      }
    } else if (groupId && topicId && inventario[groupId]?.topics?.[topicId]) {
      const before = (inventario[groupId].topics[topicId].items || []).length;
      inventario[groupId].topics[topicId].items = (
        inventario[groupId].topics[topicId].items || []
      ).filter((it: any) => !matchItem(it));
      if (inventario[groupId].topics[topicId].items.length !== before) changed = true;
    }
  } else if (action.type === 'update_product' || action.type === 'publish_product') {
    const {
      sourceGroupId,
      sourceTopicId,
      targetGroupId,
      targetTopicId,
      TargetTopicName,
      moveMode = 'move', // 'move' | 'copy'
      platform,
      productId,
      updates = {},
    } = p;

    const matchItem = (it: any) =>
      String(it.product_id) === String(productId) && String(it.platform) === String(platform);

    const srcGroup = inventario[sourceGroupId];
    const srcTopic = srcGroup?.topics?.[sourceTopicId];

    let existingItem: any = null;
    let idx = -1;

    if (srcTopic && Array.isArray(srcTopic.items)) {
      idx = srcTopic.items.findIndex(matchItem);
      if (idx !== -1) {
        existingItem = srcTopic.items[idx];
      }
    }

    if (!existingItem) {
      if (action.type === 'publish_product') {
        existingItem = {
          product_id: productId,
          platform,
          title: updates.title || '',
          affiliate_url: updates.affiliate_url || '',
          image: updates.image || null,
          image_remote: updates.image_remote || null,
          sale_price: updates.sale_price || null,
          original_price: updates.original_price || null,
          discount: updates.discount || null,
          recommendations: 1,
          timestamp: new Date().toISOString(),
        };
      } else {
        return false;
      }
    }

    const updatedItem = {
      ...existingItem,
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.affiliate_url !== undefined ? { affiliate_url: updates.affiliate_url } : {}),
      ...(updates.image !== undefined ? { image: updates.image } : {}),
      ...(updates.image_remote !== undefined ? { image_remote: updates.image_remote } : {}),
      ...(updates.sale_price !== undefined ? { sale_price: updates.sale_price } : {}),
      ...(updates.original_price !== undefined ? { original_price: updates.original_price } : {}),
      ...(updates.discount !== undefined ? { discount: updates.discount } : {}),
      ...(updates.recommendations !== undefined ? { recommendations: Number(updates.recommendations) } : {}),
      ...(updates.categorias !== undefined ? { categorias: updates.categorias } : {}),
      ...(updates.versiones !== undefined ? { versiones: updates.versiones, version_confirmada: true } : {}),
      ...(updates.backup_links !== undefined ? { backup_links: updates.backup_links } : {}),
      ...(updates.link_status !== undefined ? { link_status: updates.link_status } : {}),
      ...(updates.bot_message_id !== undefined ? { bot_message_id: updates.bot_message_id } : {}),
      status_clasificacion: 'clasificado',
    };

    const destGid = targetGroupId || sourceGroupId;
    const destTid = targetTopicId || sourceTopicId;

    if (destGid === sourceGroupId && destTid === sourceTopicId) {
      srcTopic.items[idx] = updatedItem;
      changed = true;
    } else {
      // Mover o copiar a otro grupo/topic
      if (!inventario[destGid]) {
        const bMeta = BRAND_CONFIG.find(b => b.id === destGid);
        inventario[destGid] = {
          group_name: bMeta ? `${bMeta.name} chuches` : destGid,
          topics: {},
        };
      }
      if (!inventario[destGid].topics) inventario[destGid].topics = {};
      if (!inventario[destGid].topics[destTid]) {
        const knownTname =
          TargetTopicName ||
          topicsData?.[destGid]?.topics?.[destTid] ||
          destTid;
        inventario[destGid].topics[destTid] = {
          topic_name: knownTname,
          items: [],
        };
      }
      const destItems = inventario[destGid].topics[destTid].items || [];
      const destIdx = destItems.findIndex(matchItem);
      if (destIdx >= 0) {
        destItems[destIdx] = updatedItem;
      } else {
        destItems.push(updatedItem);
      }
      inventario[destGid].topics[destTid].items = destItems;

      if (moveMode === 'move') {
        if (srcTopic && Array.isArray(srcTopic.items) && idx >= 0) {
          srcTopic.items.splice(idx, 1);
        }
      } else {
        if (srcTopic && Array.isArray(srcTopic.items) && idx >= 0) {
          srcTopic.items[idx] = updatedItem;
        }
      }
      changed = true;
    }

    // Si se ha modificado recommendations, sincronizar esa puntuación en todas las apariciones del mismo producto
    if (updates?.recommendations !== undefined) {
      const unifiedRecs = Number(updates.recommendations);
      for (const [gid, gdata] of Object.entries(inventario)) {
        if (gid === '_global' || !gdata?.topics) continue;
        for (const tdata of Object.values(gdata.topics) as any[]) {
          for (const it of tdata?.items || []) {
            if (matchItem(it)) {
              it.recommendations = unifiedRecs;
            }
          }
        }
      }
    }

    // Asegurar que las nuevas categorías existan en _global
    if (updates?.categorias?.length) {
      if (!inventario._global) inventario._global = { categorias: {} };
      if (!inventario._global.categorias) inventario._global.categorias = {};
      const allKnownCats = new Set<string>();
      for (const arr of Object.values(inventario._global.categorias) as string[][]) {
        if (Array.isArray(arr)) arr.forEach(c => allKnownCats.add(c));
      }
      for (const c of updates.categorias) {
        if (c && !allKnownCats.has(c)) {
          inventario._global.categorias[c] = [c];
        }
      }
    }
  } else if (action.type === 'add_comment') {
    const { key, username, text, date } = p;
    if (key && text) {
      if (!comentarios[key]) comentarios[key] = [];
      comentarios[key].push({
        user_id: 0,
        username: username || 'Comunidad',
        text,
        date: date || new Date().toISOString().slice(0, 16).replace('T', ' '),
      });
      changed = true;
    }
  } else if (action.type === 'update_comment') {
    const { key, index, username, text } = p;
    if (key && comentarios[key] && comentarios[key][index] !== undefined) {
      if (username !== undefined) comentarios[key][index].username = username;
      if (text !== undefined) comentarios[key][index].text = text;
      changed = true;
    }
  } else if (action.type === 'delete_comment') {
    const { key, index } = p;
    if (key && comentarios[key] && comentarios[key][index] !== undefined) {
      comentarios[key].splice(index, 1);
      changed = true;
    }
  } else if (action.type === 'manage_versions') {
    const { groupId, topicId, op, versionName, newVersionName } = p;
    const topicObj = inventario?.[groupId]?.topics?.[topicId];
    if (topicObj && Array.isArray(topicObj.items)) {
      if (op === 'delete' && versionName) {
        for (const it of topicObj.items) {
          if (Array.isArray(it.versiones)) {
            it.versiones = it.versiones.filter((v: string) => v !== versionName);
            if (it.versiones.length === 0) it.versiones = ['__todas__'];
          }
        }
        changed = true;
      } else if (op === 'rename' && versionName && newVersionName) {
        for (const it of topicObj.items) {
          if (Array.isArray(it.versiones)) {
            it.versiones = it.versiones.map((v: string) => (v === versionName ? newVersionName : v));
          }
        }
        changed = true;
      }
    }
    if (topicsData && groupId) {
      if (!topicsData[groupId]) topicsData[groupId] = { topics: {}, versiones_disponibles: {} };
      if (!topicsData[groupId].versiones_disponibles) topicsData[groupId].versiones_disponibles = {};
      const list: string[] = topicsData[groupId].versiones_disponibles[topicId] || [];
      if (op === 'delete' && versionName) {
        topicsData[groupId].versiones_disponibles[topicId] = list.filter(v => v !== versionName);
        changed = true;
      } else if (op === 'rename' && versionName && newVersionName) {
        topicsData[groupId].versiones_disponibles[topicId] = list.map(v => (v === versionName ? newVersionName : v));
        changed = true;
      } else if (op === 'add' && versionName && !list.includes(versionName)) {
        list.push(versionName);
        topicsData[groupId].versiones_disponibles[topicId] = list;
        changed = true;
      }
    }
  } else if (action.type === 'manage_categories') {
    const { op, categoryName, newCategoryName } = p;
    if (!inventario._global) inventario._global = { categorias: {} };
    if (!inventario._global.categorias) inventario._global.categorias = {};

    if (op === 'add' && categoryName) {
      inventario._global.categorias[categoryName] = [categoryName];
      changed = true;
    } else if (op === 'delete' && categoryName) {
      delete inventario._global.categorias[categoryName];
      for (const k of Object.keys(inventario._global.categorias)) {
        if (Array.isArray(inventario._global.categorias[k])) {
          inventario._global.categorias[k] = inventario._global.categorias[k].filter(
            (c: string) => c !== categoryName
          );
        }
      }
      for (const gid of Object.keys(inventario)) {
        if (gid === '_global') continue;
        for (const tid of Object.keys(inventario[gid]?.topics || {})) {
          for (const it of inventario[gid].topics[tid]?.items || []) {
            if (Array.isArray(it.categorias)) {
              it.categorias = it.categorias.filter((c: string) => c !== categoryName);
            }
          }
        }
      }
      changed = true;
    } else if (op === 'rename' && categoryName && newCategoryName) {
      for (const k of Object.keys(inventario._global.categorias)) {
        if (Array.isArray(inventario._global.categorias[k])) {
          inventario._global.categorias[k] = inventario._global.categorias[k].map((c: string) =>
            c === categoryName ? newCategoryName : c
          );
        }
      }
      for (const gid of Object.keys(inventario)) {
        if (gid === '_global') continue;
        for (const tid of Object.keys(inventario[gid]?.topics || {})) {
          for (const it of inventario[gid].topics[tid]?.items || []) {
            if (Array.isArray(it.categorias)) {
              it.categorias = it.categorias.map((c: string) =>
                c === categoryName ? newCategoryName : c
              );
            }
          }
        }
      }
      changed = true;
    }
  }

  return changed;
}

export async function loadAllChuchesData(forceRefreshActions = false) {
  const inventario = readJSONRaw(INVENTARIO_PATH);
  const comentarios = readJSONRaw(COMENTARIOS_PATH) || {};
  const votos = readJSONRaw(VOTOS_PATH) || {};
  const referidos = readJSONRaw(REFERIDOS_PATH) || {};
  const topicsData = readJSONRaw(TOPICS_PATH) || {};

  if (!inventario) {
    return { inventario: null, comentarios, votos, referidos, topicsData };
  }

  const cloudActions = await getCloudActions(forceRefreshActions);
  if (cloudActions.length > 0) {
    const local = isLocalServer();
    let anyUnappliedLocal = false;
    let mutatedInv = false;
    let mutatedCmts = false;
    let mutatedTopics = false;

    for (const act of cloudActions) {
      if (local && act.appliedLocally) {
        continue;
      }
      const changed = applyActionToMemory(act, inventario, comentarios, topicsData);
      if (changed) {
        if (['delete_product', 'update_product', 'publish_product', 'manage_versions', 'manage_categories'].includes(act.type)) {
          mutatedInv = true;
        }
        if (['add_comment', 'update_comment', 'delete_comment'].includes(act.type)) {
          mutatedCmts = true;
        }
        if (act.type === 'manage_versions') {
          mutatedTopics = true;
        }
      }
      if (local && !act.appliedLocally) {
        act.appliedLocally = true;
        anyUnappliedLocal = true;
      }
    }

    // Si estamos en el servidor local y había acciones pendientes hechas desde Vercel, las persistimos a disco automáticamente
    if (local && anyUnappliedLocal) {
      if (mutatedInv) writeJSONSafe('inventario_global.json', inventario);
      if (mutatedCmts) writeJSONSafe('comentarios.json', comentarios);
      if (mutatedTopics) writeJSONSafe('topics.json', topicsData);
      await saveCloudActions(cloudActions);
    }
  }

  return { inventario, comentarios, votos, referidos, topicsData };
}
