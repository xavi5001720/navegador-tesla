import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import {
  BRAND_CONFIG,
  isProductTopic,
  isCargarTopicName,
  isSharedCargarEnCasaItem,
  normalizeProductTitleKey,
  cleanUniversalChargerTitle,
  isLocalServer,
  loadAllChuchesData,
  writeJSONSafe,
  getCloudActions,
  saveCloudActions,
  applyActionToMemory,
  AdminAction,
  LIVE_INV_DIR,
} from '@/lib/chuchesData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMIN_USER = 'xavi';
const ADMIN_PASS = '5001720';
const CHUCHES_BOT_TOKEN = '8461047506:AAGDD8YUf7Oomf8h0arKfkShoklhMSTjBA4';

function checkAuth(req: NextRequest): boolean {
  const user = req.headers.get('x-admin-user') || '';
  const pass = req.headers.get('x-admin-pass') || '';
  return user === ADMIN_USER && pass === ADMIN_PASS;
}

function getVotos(votos: Record<string, Record<string, number>>, key: string): number {
  const entry = votos?.[key];
  if (!entry) return 0;
  return Object.values(entry).reduce((sum, v) => sum + v, 0);
}

function normalizeImg(imgPath?: string | null): string | null {
  if (!imgPath) return null;
  if (imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('/')) {
    return imgPath;
  }
  return `/${imgPath}`;
}

function sanitizeName(name: string): string {
  if (!name) return 'Desconocido';
  let s = name.replace(/[^\w\s-]/g, '');
  s = s.replace(/[-\s]+/g, '_').replace(/^[-_]+|[-_]+$/g, '');
  return s || 'Desconocido';
}

const ALI_APPKEY = '519542';
const ALI_SECRET = 'cnmApzONeHosQ1F2GtynyUKK8IsgmbsI';
const ALI_API_URL = 'https://api-sg.aliexpress.com/sync';

async function fetchAliExpressProduct(productId: string) {
  try {
    const params: Record<string, string> = {
      app_key: ALI_APPKEY,
      method: 'aliexpress.affiliate.productdetail.get',
      sign_method: 'sha256',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      product_ids: productId,
      target_currency: 'EUR',
      target_language: 'ES',
      ship_to_country: 'ES',
    };
    const sorted = Object.keys(params).sort();
    let base = '';
    for (const k of sorted) base += k + params[k];
    const sign = crypto.createHmac('sha256', ALI_SECRET).update(base).digest('hex').toUpperCase();
    params.sign = sign;

    const url = `${ALI_API_URL}?${new URLSearchParams(params).toString()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const prod = data?.aliexpress_affiliate_productdetail_get_response?.resp_result?.result?.products?.product?.[0];
    if (!prod) return null;

    const priceVal = prod.target_sale_price || prod.sale_price || null;
    const priceStr = priceVal ? `${parseFloat(priceVal).toFixed(2).replace('.', ',')} €` : null;
    const origPriceVal = prod.target_original_price || prod.original_price || null;
    const origPriceStr = origPriceVal ? `${parseFloat(origPriceVal).toFixed(2).replace('.', ',')} €` : null;

    return {
      title: prod.product_title || null,
      image: prod.product_main_image_url || null,
      sale_price: priceStr,
      original_price: origPriceStr,
      discount: prod.discount || null,
      affiliate_url: prod.promotion_link || prod.product_detail_url || null,
    };
  } catch (err) {
    console.warn('[AdminAPI] Error consultando AliExpress Affiliate API:', err);
    return null;
  }
}

function scrapeAmazonWithPython(asin: string, rawUrl?: string) {
  if (!isLocalServer()) return null;
  try {
    const { execSync } = require('child_process');
    const py = `
import sys, json
sys.path.append('/home/xavi/proyectos-antigravity/1-referidos')
try:
    from importlib.machinery import SourceFileLoader
    mod = SourceFileLoader('three', '/home/xavi/proyectos-antigravity/1-referidos/3.py').load_module()
    u = """${(rawUrl || '').replace(/"""/g, '')}"""
    a = """${(asin || '').replace(/"""/g, '')}"""
    if u and any(x in u for x in ['amzn.to', 'amzn.eu', 'a.co', 'link.amazon', 'amzlinks.in']):
        resolved = mod.resolve_amazon_redirect(u)
        if resolved:
            u = resolved
    extracted_asin = mod.get_amazon_asin(u) or a
    res = mod.scrape_amazon_html(extracted_asin, u)
    if res:
        print('JSON_RES:' + json.dumps(res))
    else:
        print('JSON_RES:null')
except Exception as e:
    print('JSON_RES:null')
`;
    const out = execSync('/home/xavi/teslabot-env/bin/python3', { input: py, encoding: 'utf-8', timeout: 15000 });
    const match = out.match(/JSON_RES:(.*)/);
    if (match && match[1]) {
      const data = JSON.parse(match[1].trim());
      if (data && data.title) {
        return {
          title: data.title,
          image: data.image,
          sale_price: data.sale_price ? `${String(data.sale_price).replace('.', ',')} €` : null,
          affiliate_url: data.link || null,
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('[AdminAPI] Error scraping Amazon with Python:', err);
    return null;
  }
}

let cachedAmazonSpanishCookie: string | null = null;
let lastGlowTime = 0;

async function getAmazonSpanishSessionCookie(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedAmazonSpanishCookie && (now - lastGlowTime < 15 * 60 * 1000)) {
    return cachedAmazonSpanishCookie;
  }

  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const cookieJar = new Map<string, string>();

  function parseCookies(res: Response) {
    let rawHeaders: string[] = [];
    if (typeof (res.headers as any).getSetCookie === 'function') {
      rawHeaders = (res.headers as any).getSetCookie();
    } else {
      const h = res.headers.get('set-cookie');
      if (h) rawHeaders = [h];
    }
    for (const h of rawHeaders) {
      if (!h) continue;
      const parts = h.split(';')[0].split('=');
      const name = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (val && val !== '-' && val !== 'delete' && !val.toLowerCase().includes('delete')) {
        cookieJar.set(name, val);
      }
    }
  }

  try {
    // 1. Visitar /gp/aw para inicializar session-id oficial de Amazon
    const r1 = await fetch('https://www.amazon.es/gp/aw', {
      headers: {
        'User-Agent': ua,
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      cache: 'no-store',
    });
    parseCookies(r1);
    cookieJar.set('lc-acbes', 'es_ES');
    cookieJar.set('i18n-prefs', 'EUR');

    // 2. Establecer código postal de España (Madrid 28001) para desbloquear precios y buybox
    const params = new URLSearchParams({
      locationType: 'LOCATION_INPUT',
      zipCode: '28001',
      storeContext: 'generic',
      deviceType: 'mobile',
      pageType: 'Gateway',
      actionSource: 'glow',
    });

    const cookieHeaderBeforeGlow = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

    const r2 = await fetch('https://www.amazon.es/gp/delivery/ajax/address-change.html', {
      method: 'POST',
      headers: {
        'User-Agent': ua,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Cookie': cookieHeaderBeforeGlow,
      },
      body: params.toString(),
      cache: 'no-store',
    });
    parseCookies(r2);

    cachedAmazonSpanishCookie = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    lastGlowTime = now;
    return cachedAmazonSpanishCookie;
  } catch (err) {
    console.warn('[AdminAPI] Error creando sesión española de Amazon:', err);
    return 'lc-acbes=es_ES; i18n-prefs=EUR';
  }
}

async function fetchAmazonProduct(asin: string, rawUrl?: string) {
  // 1. En servidor local, usar directamente el scraper web de 3.py (idéntico al bot)
  if (isLocalServer()) {
    const pyData = scrapeAmazonWithPython(asin, rawUrl);
    if (pyData && pyData.title) {
      return pyData;
    }
  }

  // 2. Fallback HTTP para cloud / Vercel con sesión fijada en España (Madrid 28001)
  try {
    const cleanAsin = asin.replace(/[^a-zA-Z0-9]/g, '');
    const sessionCookie = await getAmazonSpanishSessionCookie();
    const candidateUrls = [
      `https://www.amazon.es/gp/aw/d/${cleanAsin}`,
      rawUrl && (rawUrl.includes('dp/') || rawUrl.includes('gp/product/'))
        ? rawUrl
        : `https://www.amazon.es/dp/${cleanAsin}`,
      `https://www.amazon.es/dp/${cleanAsin}`,
    ];

    const uaDesktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const uaMobile = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

    let bestResult: any = null;
    for (let i = 0; i < candidateUrls.length; i++) {
      const url = candidateUrls[i];
      try {
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        const isMobile = url.includes('/gp/aw/d/');
        const headers: Record<string, string> = {
          'User-Agent': isMobile ? uaMobile : uaDesktop,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Cookie': sessionCookie,
        };

        const res = await fetch(url, { headers, cache: 'no-store' });
        if (!res.ok) continue;
        let html = await res.text();
        if (html.includes('Robot Check')) continue;

        // Desescapar entidades HTML clave para que los regexes de precios, títulos e imágenes coincidan
        html = html
          .replace(/&nbsp;/g, ' ')
          .replace(/&euro;/g, '€')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&#34;/g, '"')
          .replace(/&amp;/g, '&');

        // Título
        let title: string | null = null;
        const titleMatch = html.match(/id=\"productTitle\"[^>]*>([\s\S]*?)<\/span>/i);
        if (titleMatch) {
          title = titleMatch[1].trim();
        } else {
          const tTag = html.match(/<title>([^<]+)<\/title>/i);
          if (tTag) {
            title = tTag[1].replace(/\s*:\s*Amazon\.es[\s\S]*/i, '').trim();
          }
        }
        if (title) {
          title = title.replace(/\s+/g, ' ').trim();
        }

        // Imagen (alta resolución: hiRes, landingImage, main-image o dynamic)
        let image: string | null = null;
        const hiResMatch = html.match(/\"hiRes\":\"(https:\/\/[^\"]+?\.jpg)\"/i);
        if (hiResMatch) {
          image = hiResMatch[1];
        }

        if (!image) {
          const mainMobileImg =
            html.match(/id=\"main-image\"[^>]*data-a-hires=\"([^\"]+)\"/i) ||
            html.match(/id=\"main-image\"[^>]*src=\"([^\"]+)\"/i);
          if (mainMobileImg) image = mainMobileImg[1];
        }

        if (!image) {
          const dynImgMatch = html.match(/data-a-dynamic-image=\"([^\"]+)\"/i);
          if (dynImgMatch) {
            try {
              const decoded = dynImgMatch[1];
              const obj = JSON.parse(decoded);
              const keys = Object.keys(obj);
              if (keys.length > 0) image = keys[keys.length - 1];
            } catch {}
          }
        }

        if (!image) {
          const m =
            html.match(/id=\"landingImage\"[^>]*data-old-hires=\"([^\"]+)\"/i) ||
            html.match(/id=\"landingImage\"[^>]*src=\"([^\"]+)\"/i) ||
            html.match(/\"large\":\"(https:\/\/[^\"]+?\.jpg)\"/i);
          if (m) image = m[1];
        }

        // Precio (lógica robusta idéntica al bot con fallback JSON y accesibilidad)
        let sale_price: string | null = null;

        // 1. apex-pricetopay (precio final en oferta de la buybox)
        const mApex = html.match(/id=\"apex-pricetopay-accessibility-label\"[^>]*>([^<]+)<\/span>/i);
        if (mApex && mApex[1]) {
          const rawP = mApex[1].replace(/€/g, '').replace(/[\s\u00A0]+/g, '').replace(',', '.').trim();
          const num = parseFloat(rawP);
          if (!isNaN(num) && num > 0) {
            sale_price = `${num.toFixed(2).replace('.', ',')} €`;
          }
        }

        // 2. Buybox JSON displayPrice
        if (!sale_price) {
          const mDisplayPrice = html.match(/\"displayPrice\":\s*\"([^\"]+)\"/i);
          if (mDisplayPrice && mDisplayPrice[1]) {
            const rawP = mDisplayPrice[1].replace(/€/g, '').replace(/[\s\u00A0]+/g, '').replace(',', '.').trim();
            const num = parseFloat(rawP);
            if (!isNaN(num) && num > 0) {
              sale_price = `${num.toFixed(2).replace('.', ',')} €`;
            }
          }
        }

        // 3. a-price seguido de a-offscreen (idéntico a 3.py)
        if (!sale_price) {
          const mPriceSpan =
            html.match(/class=\"[^\"]*a-price[^\"]*\"[^>]*>[\s\S]*?class=\"[^\"]*a-offscreen[^\"]*\">([^<]+)<\/span>/i) ||
            html.match(/class=\"(?:a-offscreen|aok-offscreen)\">([^<]+)<\/span>/i);
          if (mPriceSpan && mPriceSpan[1]) {
            const rawP = mPriceSpan[1].replace(/€/g, '').replace(/[\s\u00A0]+/g, '').replace(',', '.').trim();
            const num = parseFloat(rawP);
            if (!isNaN(num) && num > 0) {
              sale_price = `${num.toFixed(2).replace('.', ',')} €`;
            }
          }
        }

        // 4. customerVisiblePrice o twister-plus value
        if (!sale_price) {
          const mInputVal =
            html.match(/customerVisiblePrice\]\[amount\]\"\s*value=\"([0-9.]+)\"/i) ||
            html.match(/twister-plus-price-data-price\"\s*value=\"([0-9.]+)\"/i) ||
            html.match(/\"priceAmount\":\s*([0-9.]+)/i);
          if (mInputVal && mInputVal[1]) {
            const num = parseFloat(mInputVal[1]);
            if (!isNaN(num) && num > 0) {
              sale_price = `${num.toFixed(2).replace('.', ',')} €`;
            }
          }
        }

        // 5. a-color-price (precio específico de producto)
        if (!sale_price) {
          const mColorPrice = html.match(/class=\"[^\"]*a-color-price[^\"]*\"[^>]*>([\s\S]*?)<\/span>/i);
          if (mColorPrice && mColorPrice[1] && mColorPrice[1].includes('€')) {
            const numMatch = mColorPrice[1].match(/([0-9]+[.,][0-9]{2})/);
            if (numMatch) {
              const num = parseFloat(numMatch[1].replace(',', '.'));
              if (!isNaN(num) && num > 0) {
                sale_price = `${num.toFixed(2).replace('.', ',')} €`;
              }
            }
          }
        }

        if (title) {
          const item = {
            title,
            image,
            sale_price,
            affiliate_url: rawUrl || `https://www.amazon.es/dp/${cleanAsin}`,
          };
          if (sale_price) {
            return item;
          }
          if (!bestResult) {
            bestResult = item;
          }
        }
      } catch {}
    }

    if (bestResult) return bestResult;
    return null;
  } catch (err) {
    console.warn('[AdminAPI] Error scraping Amazon:', err);
    return null;
  }
}

async function fetchGenericOgProduct(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const ogTitle = html.match(/property=\"(?:og:title|twitter:title)\"\s+content=\"([^\"]+)\"/i) ||
                    html.match(/content=\"([^\"]+)\"\s+property=\"(?:og:title|twitter:title)\"/i);
    const ogImg = html.match(/property=\"(?:og:image|twitter:image)\"\s+content=\"([^\"]+)\"/i) ||
                  html.match(/content=\"([^\"]+)\"\s+property=\"(?:og:image|twitter:image)\"/i);
    
    // Si podemos rascar el precio de la página genérica
    const priceMatch =
      html.match(/class=\"(?:a-offscreen|aok-offscreen)\"[^>]*>[\s\S]*?([0-9]+[.,][0-9]{2})[\s\u00A0]*(?:€|EUR|&euro;)/i) ||
      html.match(/([0-9]+[.,][0-9]{2})[\s\u00A0]*(?:€|EUR|&euro;)/i);
    const sale_price = priceMatch ? `${priceMatch[1].replace('.', ',')} €` : null;

    return {
      title: ogTitle ? ogTitle[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() : null,
      image: ogImg ? ogImg[1].trim() : null,
      sale_price,
    };
  } catch {
    return null;
  }
}

async function saveImageLocally(
  imageUrl: string,
  platform: string,
  productId: string,
  groupName?: string,
  topicName?: string
): Promise<string | null> {
  if (!imageUrl || !isLocalServer()) return null;
  try {
    const safeGroup = sanitizeName(groupName || 'Desconocido');
    const safeTopic = sanitizeName(topicName || 'General');
    const fileName = `${platform}_${productId}.jpg`;
    const relPath = `img/${safeGroup}/${safeTopic}/${fileName}`;

    const abs1 = path.join('/home/xavi/proyectos-antigravity/1-referidos/inventarios', relPath);
    const abs2 = path.join('/home/xavi/proyectos-antigravity/2-navegador-tesla/public', relPath);

    fs.mkdirSync(path.dirname(abs1), { recursive: true });
    fs.mkdirSync(path.dirname(abs2), { recursive: true });

    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(abs1, buf);
    fs.writeFileSync(abs2, buf);
    return relPath;
  } catch (err) {
    console.warn('[AdminAPI] No se pudo guardar imagen local:', err);
    return null;
  }
}

async function copyOrSaveImageForTopic(
  currentImagePath: string | null,
  imageRemote: string | null,
  platform: string,
  productId: string,
  targetGroupName?: string,
  targetTopicName?: string
): Promise<string | null> {
  if (!isLocalServer()) {
    return currentImagePath || imageRemote || null;
  }
  try {
    const safeGroup = sanitizeName(targetGroupName || 'Desconocido');
    const safeTopic = sanitizeName(targetTopicName || 'General');
    const fileName = `${platform}_${productId}.jpg`;
    const relPath = `img/${safeGroup}/${safeTopic}/${fileName}`;

    const abs1 = path.join('/home/xavi/proyectos-antigravity/1-referidos/inventarios', relPath);
    const abs2 = path.join('/home/xavi/proyectos-antigravity/2-navegador-tesla/public', relPath);

    fs.mkdirSync(path.dirname(abs1), { recursive: true });
    fs.mkdirSync(path.dirname(abs2), { recursive: true });

    // 1. Si ya existe un archivo local, copiarlo a la nueva carpeta de destino
    if (currentImagePath && !currentImagePath.startsWith('http')) {
      const cleanRel = currentImagePath.replace(/^\//, '');
      const src1 = path.join('/home/xavi/proyectos-antigravity/1-referidos/inventarios', cleanRel);
      const src2 = path.join('/home/xavi/proyectos-antigravity/2-navegador-tesla/public', cleanRel);
      const foundSrc = fs.existsSync(src1) ? src1 : fs.existsSync(src2) ? src2 : null;
      if (foundSrc) {
        fs.copyFileSync(foundSrc, abs1);
        fs.copyFileSync(foundSrc, abs2);
        return relPath;
      }
    }

    // 2. Si no hay archivo local pero hay URL remota, descargarlo
    const urlToFetch =
      currentImagePath && currentImagePath.startsWith('http')
        ? currentImagePath
        : imageRemote;
    if (urlToFetch) {
      return await saveImageLocally(urlToFetch, platform, productId, targetGroupName, targetTopicName);
    }

    return currentImagePath || relPath;
  } catch (err) {
    console.warn('[AdminAPI] Error copiando imagen a la carpeta destino:', err);
    return currentImagePath;
  }
}

function buildTelegramCaption(params: {
  title: string;
  affiliateUrl: string;
  targetGroupId: string;
  targetTopicId: string;
  salePrice?: string | null;
  originalPrice?: string | null;
  discount?: string | null;
  versiones?: string[];
}): string {
  const { title, affiliateUrl, targetGroupId, targetTopicId, salePrice, originalPrice, discount, versiones } = params;

  const escapeHtml = (str: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  let displayLink = affiliateUrl || '';
  // Si es Amazon, asegurar tag=energia0d1-21
  if (displayLink && (displayLink.includes('amazon.') || displayLink.includes('amzn.to') || displayLink.includes('a.co'))) {
    if (/[?&]tag=/.test(displayLink)) {
      displayLink = displayLink.replace(/([?&])tag=[^&]*/, '$1tag=energia0d1-21');
    } else {
      const sep = displayLink.includes('?') ? '&' : '?';
      displayLink = `${displayLink}${sep}tag=energia0d1-21`;
    }
  }

  // Si el grupo de destino es Tesla chuches (-1003731237376), envolver en viajandoentesla.es/go?url=
  const TESLA_CHUCHES_ID = '-1003731237376';
  if (targetGroupId === TESLA_CHUCHES_ID && displayLink && !displayLink.startsWith('https://www.viajandoentesla.es/go?url=')) {
    displayLink = `https://www.viajandoentesla.es/go?url=${encodeURIComponent(displayLink)}`;
  }

  let enlaceTexto = `<a href="${displayLink}">Ver oferta</a>`;
  const lowerUrl = (affiliateUrl || '').toLowerCase();
  if (lowerUrl.includes('aliexpress') || lowerUrl.includes('ali.ski') || lowerUrl.includes('s.click')) {
    enlaceTexto = `<a href="${displayLink}">Ver en Aliexpress</a>`;
  } else if (lowerUrl.includes('amazon') || lowerUrl.includes('amzn.to') || lowerUrl.includes('a.co')) {
    enlaceTexto = `<a href="${displayLink}">Ver en Amazon</a>`;
  } else if (lowerUrl.includes('temu')) {
    enlaceTexto = `<a href="${displayLink}">Ver en Temu</a>`;
  }

  let caption = `🛒 ${escapeHtml(title)}\n👉 ${enlaceTexto}`;

  if (salePrice && String(salePrice).trim()) {
    const cleanSale = String(salePrice).replace('€', '').trim();
    if (originalPrice && String(originalPrice).trim()) {
      const cleanOrig = String(originalPrice).replace('€', '').trim();
      if (discount) {
        caption += `\n🔥 <s>${cleanOrig} €</s> <b>${cleanSale} €</b> (${discount} descuento)`;
      } else {
        caption += `\n🔥 <s>${cleanOrig} €</s> <b>${cleanSale} €</b>`;
      }
    } else {
      caption += `\n🔥 <b>${cleanSale} €</b>`;
    }
  }

  if (versiones && versiones.length > 0) {
    const filteredVers = versiones.filter(v => v && v !== '__todas__');
    if (filteredVers.length === 1) {
      caption += `\n🚘 Compatible con versión: <b>${escapeHtml(filteredVers[0])}</b>`;
    } else if (filteredVers.length > 1) {
      caption += `\n🚘 Compatible con las versiones: <b>${filteredVers.map(escapeHtml).join(', ')}</b>`;
    }
  }

  return caption;
}

function buildTelegramKeyboard(params: {
  productId: string;
  platform: string;
  categoria?: string;
  targetGroupId: string;
  targetTopicId: string;
  targetTopicName?: string;
}): any {
  const { productId, platform, categoria, targetGroupId, targetTopicId, targetTopicName } = params;

  const rows: any[][] = [];

  // Fila 1: Botones de votar 👍 👎
  rows.push([
    { text: '👍', callback_data: `vup_${platform}_${productId}` },
    { text: '👎', callback_data: `vdn_${platform}_${productId}` },
  ]);

  const cleanGid = targetGroupId.replace(/^-/, '');
  const absGid = cleanGid;
  const tid = targetTopicId || '0';

  // Fila 2: Categoría (si se asignó)
  if (categoria && categoria.trim()) {
    const catName = categoria.trim();
    const TESLA_CHUCHES_ID = '-1003731237376';
    if (targetGroupId === TESLA_CHUCHES_ID && (tid === '7' || tid === '8')) {
      const seccion = tid === '7' ? 'model3' : 'modely';
      rows.push([
        {
          text: `🗂️ ${catName} (viajandoentesla.es)`,
          url: `https://www.viajandoentesla.es/?section=${seccion}&categoria=${encodeURIComponent(catName)}`,
        },
      ]);
    } else {
      const catHex = Buffer.from(catName, 'utf-8').toString('hex');
      rows.push([
        {
          text: `🗂️ ${catName}`,
          url: `https://t.me/ChuchesEV_Bot?start=c_${absGid}_${tid}_${catHex}`,
        },
      ]);
    }
  }

  // Fila 3: Menú
  let menuLabel = '🗂️ Menú';
  if (targetTopicName && targetTopicName.trim()) {
    const cleanName = targetTopicName.trim().replace(/^(tesla|byd|mg|xpeng|leapmotor|toyota|hyundai|volkswagen|geely)\s*/i, '').trim();
    menuLabel = cleanName ? `🗂️ Menú ${cleanName}` : '🗂️ Menú';
  }
  rows.push([
    {
      text: menuLabel,
      url: `https://t.me/ChuchesEV_Bot?start=search_${absGid}_${tid}`,
    },
  ]);

  // Fila 4: Comentarios
  rows.push([
    {
      text: '💬 Comentarios (0)',
      url: `https://t.me/ChuchesEV_Bot?start=cmt_${absGid}_${tid}_${platform}_${productId}`,
    },
  ]);

  return { inline_keyboard: rows };
}

async function publishProductToTelegram(payload: any): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const {
    targetGroupId,
    targetTopicId,
    targetTopicName,
    platform,
    productId,
    updates,
  } = payload;

  const title = updates?.title || 'Producto Chuche';
  const affiliateUrl = updates?.affiliate_url || '';
  const salePrice = updates?.sale_price || null;
  const originalPrice = updates?.original_price || null;
  const discount = updates?.discount || null;
  const versiones = updates?.versiones || [];
  const categoria = (updates?.categorias && updates.categorias[0]) || '';
  const image = updates?.image || null;
  const imageRemote = updates?.image_remote || null;

  const caption = buildTelegramCaption({
    title,
    affiliateUrl,
    targetGroupId,
    targetTopicId,
    salePrice,
    originalPrice,
    discount,
    versiones,
  });

  const replyMarkup = buildTelegramKeyboard({
    productId,
    platform,
    categoria,
    targetGroupId,
    targetTopicId,
    targetTopicName,
  });

  const threadIdNum = parseInt(targetTopicId, 10);
  const hasThread = !isNaN(threadIdNum) && threadIdNum > 0;

  let sentMessageId: number | null = null;

  // 1. Intentar enviar foto mediante archivo local en disco si estamos en local server
  let localFilePath: string | null = null;
  if (isLocalServer() && image && !image.startsWith('http')) {
    const cleanRel = image.replace(/^\//, '');
    const p1 = path.join('/home/xavi/proyectos-antigravity/1-referidos/inventarios', cleanRel);
    const p2 = path.join('/home/xavi/proyectos-antigravity/2-navegador-tesla/public', cleanRel);
    if (fs.existsSync(p1)) localFilePath = p1;
    else if (fs.existsSync(p2)) localFilePath = p2;
  }

  if (localFilePath) {
    try {
      const formData = new FormData();
      formData.append('chat_id', targetGroupId);
      if (hasThread) formData.append('message_thread_id', String(threadIdNum));
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
      formData.append('reply_markup', JSON.stringify(replyMarkup));
      const fileBuf = fs.readFileSync(localFilePath);
      const blob = new Blob([fileBuf], { type: 'image/jpeg' });
      formData.append('photo', blob, path.basename(localFilePath));

      const res = await fetch(`https://api.telegram.org/bot${CHUCHES_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.ok && data.result?.message_id) {
        sentMessageId = data.result.message_id;
      } else {
        console.warn('[AdminAPI] Telegram sendPhoto multipart no aceptado:', data);
      }
    } catch (err) {
      console.warn('[AdminAPI] Error enviando sendPhoto con FormData:', err);
    }
  }

  // 2. Si no se pudo por multipart, probar sendPhoto con URL pública
  if (!sentMessageId) {
    let photoUrl: string | null = null;
    if (imageRemote && imageRemote.startsWith('http')) {
      photoUrl = imageRemote;
    } else if (image && image.startsWith('http')) {
      photoUrl = image;
    } else if (image) {
      photoUrl = `https://www.viajandoentesla.es/${image.replace(/^\//, '')}`;
    }

    if (photoUrl) {
      try {
        const bodyObj: any = {
          chat_id: targetGroupId,
          photo: photoUrl,
          caption,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        };
        if (hasThread) bodyObj.message_thread_id = threadIdNum;

        const res = await fetch(`https://api.telegram.org/bot${CHUCHES_BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj),
        });
        const data = await res.json();
        if (data.ok && data.result?.message_id) {
          sentMessageId = data.result.message_id;
        } else {
          console.warn('[AdminAPI] Telegram sendPhoto URL falló:', data);
        }
      } catch (err) {
        console.warn('[AdminAPI] Error enviando sendPhoto con URL:', err);
      }
    }
  }

  // 3. Fallback: Si no hay foto o sendPhoto falló, enviar como mensaje de texto enriquecido con enlace
  if (!sentMessageId) {
    try {
      const bodyObj: any = {
        chat_id: targetGroupId,
        text: caption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      };
      if (hasThread) bodyObj.message_thread_id = threadIdNum;

      const res = await fetch(`https://api.telegram.org/bot${CHUCHES_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      });
      const data = await res.json();
      if (data.ok && data.result?.message_id) {
        sentMessageId = data.result.message_id;
      } else {
        console.warn('[AdminAPI] Telegram sendMessage falló:', data);
        return { ok: false, error: data.description || 'Error al enviar mensaje a Telegram' };
      }
    } catch (err: any) {
      console.warn('[AdminAPI] Error enviando sendMessage:', err);
      return { ok: false, error: err.message || 'Error de conexión con Telegram' };
    }
  }

  return { ok: true, messageId: sentMessageId };
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId') || '-1003731237376';
  const topicId = searchParams.get('topicId') || 'all';
  const categoria = searchParams.get('cat') || '';
  const version = searchParams.get('ver') || '';
  const quickFilter = searchParams.get('filter') || 'all'; // all | with_comments | no_category | no_image
  const busqueda = (searchParams.get('q') || '').trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '48')));

  const { inventario, comentarios, votos, topicsData } = await loadAllChuchesData();
  if (!inventario) {
    return NextResponse.json({ error: 'Inventario no disponible' }, { status: 503 });
  }

  // 0.0 Construir índice de productos que ya existen en los grupos oficiales de marcas (excepto Chuches EV General)
  const CHUCHES_EV_GENERAL_ID = '-1002517190518';
  const existingInBrandsKeys = new Set<string>();
  const existingInBrandsTitles = new Set<string>();

  for (const b of BRAND_CONFIG) {
    if (b.id === CHUCHES_EV_GENERAL_ID) continue;
    const gObj = inventario[b.id];
    if (!gObj?.topics) continue;
    for (const tid of Object.keys(gObj.topics)) {
      for (const it of gObj.topics[tid]?.items || []) {
        const k = `${it.platform}_${it.product_id}`;
        existingInBrandsKeys.add(k);
        const nt = normalizeProductTitleKey(it.title || '');
        if (nt && nt !== 'producto aliexpress') {
          existingInBrandsTitles.add(nt);
        }
      }
    }
  }

  function filterOrphansForChuchesEvGeneral(items: any[]): any[] {
    return (items || []).filter(it => {
      const k = `${it.platform}_${it.product_id}`;
      const nt = normalizeProductTitleKey(it.title || '');
      if (existingInBrandsKeys.has(k)) return false;
      if (nt && nt !== 'producto aliexpress' && existingInBrandsTitles.has(nt)) return false;
      return true;
    });
  }

  // 0. Construir pool compartido de Cargadores (y Wifi) universales para "Cargar en CASA"
  // Los "Organizadores" NO entran aquí porque pueden llevar el logo de cada marca.
  interface RawEntry {
    item: any;
    groupId: string;
    groupName: string;
    brandEmoji: string;
    topicId: string;
    topicName: string;
    isSharedCharger?: boolean;
  }

  const sharedCargarPool: RawEntry[] = [];
  const sharedSeenKeys = new Set<string>();
  const sharedSeenTitles = new Set<string>();

  // Primera pasada: priorizar los que ya están dentro de algún topic "Cargar en CASA"
  for (const b of BRAND_CONFIG) {
    const gObj = inventario[b.id];
    if (!gObj?.topics) continue;
    for (const tid of Object.keys(gObj.topics)) {
      const tObj = gObj.topics[tid];
      const tName = tObj?.topic_name || topicsData?.[b.id]?.topics?.[tid] || `Topic ${tid}`;
      if (!isCargarTopicName(tName)) continue;
      for (const it of tObj?.items || []) {
        if (!isSharedCargarEnCasaItem(it, true)) continue;
        const k = `${it.platform}_${it.product_id}`;
        const nt = normalizeProductTitleKey(it.title || '');
        if (sharedSeenKeys.has(k) || (nt && sharedSeenTitles.has(nt))) continue;
        sharedSeenKeys.add(k);
        if (nt) sharedSeenTitles.add(nt);
        sharedCargarPool.push({
          item: it,
          groupId: b.id,
          groupName: b.name,
          brandEmoji: b.emoji,
          topicId: tid,
          topicName: tName,
          isSharedCharger: true,
        });
      }
    }
  }

  // Segunda pasada: añadir cargadores EV domésticos (Wallbox/Tipo 2/Schuko) que estén en modelos
  for (const b of BRAND_CONFIG) {
    const gObj = inventario[b.id];
    if (!gObj?.topics) continue;
    for (const tid of Object.keys(gObj.topics)) {
      const tObj = gObj.topics[tid];
      const tName = tObj?.topic_name || topicsData?.[b.id]?.topics?.[tid] || `Topic ${tid}`;
      if (isCargarTopicName(tName)) continue;
      for (const it of tObj?.items || []) {
        if (!isSharedCargarEnCasaItem(it, false)) continue;
        const k = `${it.platform}_${it.product_id}`;
        const nt = normalizeProductTitleKey(it.title || '');
        if (sharedSeenKeys.has(k) || (nt && sharedSeenTitles.has(nt))) continue;
        sharedSeenKeys.add(k);
        if (nt) sharedSeenTitles.add(nt);
        sharedCargarPool.push({
          item: it,
          groupId: b.id,
          groupName: b.name,
          brandEmoji: b.emoji,
          topicId: tid,
          topicName: tName,
          isSharedCharger: true,
        });
      }
    }
  }

  function getMergedCargarEntriesForBrand(gid: string, tid: string, tName: string, bName: string, bEmoji: string): RawEntry[] {
    const ownItems: any[] = inventario[gid]?.topics?.[tid]?.items || [];
    const result: RawEntry[] = [];
    const seenK = new Set<string>();
    const seenT = new Set<string>();

    // 1. Primero todos los artículos propios de "Cargar en CASA" de esta marca (incluyendo sus Organizadores con su logo)
    for (const it of ownItems) {
      const k = `${it.platform}_${it.product_id}`;
      const nt = normalizeProductTitleKey(it.title || '');
      seenK.add(k);
      if (nt) seenT.add(nt);
      result.push({
        item: it,
        groupId: gid,
        groupName: bName,
        brandEmoji: bEmoji,
        topicId: tid,
        topicName: tName,
      });
    }

    // 2. Después los Cargadores y Wifi universales compartidos que no estén ya en esta marca
    for (const shared of sharedCargarPool) {
      const k = `${shared.item.platform}_${shared.item.product_id}`;
      const nt = normalizeProductTitleKey(shared.item.title || '');
      if (seenK.has(k) || (nt && seenT.has(nt))) continue;
      seenK.add(k);
      if (nt) seenT.add(nt);

      // Clonar con versiones=['__todas__'] (compatibles con todas las versiones, sin versiones de otra marca)
      // y limpiar menciones de otras marcas en el título cuando se ve desde otra marca
      const cleanedTitle =
        gid !== '-1003731237376'
          ? cleanUniversalChargerTitle(shared.item.title || '')
          : shared.item.title || '';

      result.push({
        item: {
          ...shared.item,
          title: cleanedTitle,
          versiones: ['__todas__'],
        },
        groupId: shared.groupId,
        groupName: bName,
        brandEmoji: bEmoji,
        topicId: shared.topicId,
        topicName: tName,
        isSharedCharger: true,
      });
    }

    return result;
  }

  // 1. Construir árbol completo de Marcas y Modelos/Topics (solo marcas oficiales de BRAND_CONFIG)
  const brandsSummary = BRAND_CONFIG
    .map(b => {
      const gInv = inventario[b.id] || {};
      const gTopicsInv = gInv.topics || {};
      const gTopicsMeta = topicsData?.[b.id]?.topics || {};
      const gVersionesDisp = topicsData?.[b.id]?.versiones_disponibles || {};

      const allTopicIds = Array.from(
        new Set([...Object.keys(gTopicsInv), ...Object.keys(gTopicsMeta)])
      );

      let totalBrandItems = 0;
      const topicsList = allTopicIds
        .map(tid => {
          const tInv = gTopicsInv[tid];
          const rawTopicItems: any[] = tInv?.items || [];
          const items: any[] =
            b.id === CHUCHES_EV_GENERAL_ID
              ? filterOrphansForChuchesEvGeneral(rawTopicItems)
              : rawTopicItems;
          const tName = tInv?.topic_name || gTopicsMeta[tid] || `Topic ${tid}`;
          totalBrandItems += items.length;

          const effectiveCount = isCargarTopicName(tName)
            ? getMergedCargarEntriesForBrand(b.id, tid, tName, b.name, b.emoji).length
            : items.length;

          const versSet = new Set<string>(gVersionesDisp[tid] || []);
          for (const it of items) {
            for (const v of it.versiones || []) {
              if (v && v !== '__todas__') versSet.add(v);
            }
          }

          return {
            id: tid,
            name: tName,
            count: effectiveCount,
            versiones: Array.from(versSet).sort(),
            isProduct: isProductTopic(tid, tName, effectiveCount),
          };
        })
        .filter(t => t.isProduct)
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.name.localeCompare(b.name);
        });

      return {
        ...b,
        groupName: gInv.group_name || b.name,
        totalItems: totalBrandItems,
        topics: topicsList,
      };
    });

  // 2. Obtener todas las categorías globales existentes
  const allGlobalCategoriesSet = new Set<string>();
  const globalCatsObj = inventario._global?.categorias || {};
  for (const arr of Object.values(globalCatsObj) as any[]) {
    if (Array.isArray(arr)) {
      for (const c of arr) if (c) allGlobalCategoriesSet.add(c);
    }
  }
  for (const gid of Object.keys(inventario)) {
    if (gid === '_global') continue;
    for (const tid of Object.keys(inventario[gid]?.topics || {})) {
      for (const it of inventario[gid].topics[tid]?.items || []) {
        for (const c of it.categorias || []) {
          if (c) allGlobalCategoriesSet.add(c);
        }
      }
    }
  }
  const allCategories = Array.from(allGlobalCategoriesSet).sort((a, b) =>
    a.localeCompare(b, 'es')
  );

  // 3. Recopilar items según groupId y topicId seleccionados
  const rawEntries: RawEntry[] = [];
  const targetGroups =
    groupId === 'all'
      ? brandsSummary.map(b => b.id)
      : [groupId];

  for (const gid of targetGroups) {
    const bMeta = brandsSummary.find(b => b.id === gid);
    const gObj = inventario[gid];
    if (!gObj?.topics) continue;

    if (topicId !== 'all' && groupId !== 'all') {
      const tObj = gObj.topics[topicId];
      const tName =
        tObj?.topic_name ||
        topicsData?.[gid]?.topics?.[topicId] ||
        `Topic ${topicId}`;

      if (isCargarTopicName(tName)) {
        const merged = getMergedCargarEntriesForBrand(
          gid,
          topicId,
          tName,
          bMeta?.name || gObj.group_name || gid,
          bMeta?.emoji || '🚗'
        );
        rawEntries.push(...merged);
        continue;
      }
    }

    const targetTopics =
      topicId === 'all' || groupId === 'all'
        ? Object.keys(gObj.topics)
        : [topicId];

    for (const tid of targetTopics) {
      const tObj = gObj.topics[tid];
      if (!tObj?.items) continue;
      const tName =
        tObj.topic_name ||
        topicsData?.[gid]?.topics?.[tid] ||
        `Topic ${tid}`;

      const topicItems =
        gid === CHUCHES_EV_GENERAL_ID
          ? filterOrphansForChuchesEvGeneral(tObj.items)
          : tObj.items;

      for (const item of topicItems) {
        rawEntries.push({
          item,
          groupId: gid,
          groupName: bMeta?.name || gObj.group_name || gid,
          brandEmoji: bMeta?.emoji || '🚗',
          topicId: tid,
          topicName: tName,
        });
      }
    }
  }

  // Categorías y secciones que son intrínsecamente compatibles con "Todas las versiones"
  const UNIVERSAL_VERSION_CATS = new Set([
    'cargadores',
    'limpieza',
    'limpiaparabrisas',
    'herramientas',
    'diagnosis',
    'carlinkit',
    'wifi',
    'energía',
    'energia',
    'seguridad',
  ]);

  const isNonModelTopic = (tName: string) => {
    const low = (tName || '').toLowerCase();
    return (
      low.includes('cargar') ||
      low.includes('mantenimiento') ||
      low.includes('limpieza') ||
      low.includes('merch') ||
      low.includes('impresiones') ||
      low.includes('carlinkit') ||
      low.includes('codigos') ||
      low.includes('códigos') ||
      low.includes('pendientes') ||
      low.includes('ventas')
    );
  };

  // Transformar a objetos de producto completos
  const allMapped = rawEntries.map(({ item, groupId: gid, groupName, brandEmoji, topicId: tid, topicName }) => {
    const key = `${item.platform}_${item.product_id}`;
    const cmtsRaw = comentarios?.[key] || [];
    const totalVotos = getVotos(votos, key);
    const baseRecs = Number(item.recommendations || 0);
    const rawTitle = item.title || '';
    const cleanTitle = rawTitle
      .replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '')
      .trim();

    const cats: string[] = Array.isArray(item.categorias) ? item.categorias.filter(Boolean) : [];
    const vers: string[] = Array.isArray(item.versiones) ? item.versiones.filter(Boolean) : [];
    const hasUniversalCat = cats.some(c => UNIVERSAL_VERSION_CATS.has(c.toLowerCase().trim()));
    const isAllVersionsConfirmed = Boolean(
      item.version_confirmada || hasUniversalCat || isNonModelTopic(topicName)
    );

    return {
      id: String(item.product_id),
      platform: String(item.platform),
      key,
      groupId: gid,
      groupName,
      brandEmoji,
      topicId: tid,
      topicName,
      title: cleanTitle || rawTitle,
      rawTitle,
      affiliate_url: item.affiliate_url || item.link || '',
      image: normalizeImg(item.image),
      rawImage: item.image || '',
      image_remote: item.image_remote || null,
      recommendations: baseRecs + totalVotos,
      base_recommendations: baseRecs,
      votes: totalVotos,
      categorias: cats,
      versiones: vers,
      isAllVersionsConfirmed,
      num_comentarios: cmtsRaw.length,
      comentarios: cmtsRaw.map((c: any, idx: number) => ({
        index: idx,
        username: c.username || 'Usuario',
        text: c.text || '',
        date: c.date || '',
      })),
      sale_price: item.sale_price || null,
      original_price: item.original_price || null,
      discount: item.discount || null,
      timestamp: item.timestamp || null,
      bot_message_id: item.bot_message_id || null,
      link_status: item.link_status || 'active',
      backup_links: Array.isArray(item.backup_links) ? item.backup_links : [],
    };
  });

  // Ordenar por recomendaciones descendente
  allMapped.sort((a, b) => b.recommendations - a.recommendations);

  // Calcular contadores de categorías y versiones antes de filtrar por cat/ver/q
  const categoriasMap: Record<string, number> = {};
  const versionesMap: Record<string, number> = {};
  let sinCategoriaCount = 0;
  let conComentariosCount = 0;
  let sinImagenCount = 0;
  let sinPrecioCount = 0;
  let sinVersionCount = 0;
  let enlacesCaidosCount = 0;
  let conLinksReservaCount = 0;

  // Añadir versiones disponibles configuradas en topics.json para este topic
  if (groupId !== 'all' && topicId !== 'all') {
    const dispVers: string[] = topicsData?.[groupId]?.versiones_disponibles?.[topicId] || [];
    for (const v of dispVers) {
      if (v && v !== '__todas__') versionesMap[v] = 0;
    }
  }

  for (const p of allMapped) {
    if (!p.categorias || p.categorias.length === 0) {
      sinCategoriaCount++;
    } else {
      for (const c of p.categorias) {
        if (c) categoriasMap[c] = (categoriasMap[c] || 0) + 1;
      }
    }
    const specificVers = (p.versiones || []).filter((v: string) => v && v !== '__todas__');
    if (specificVers.length === 0) {
      if (!p.isAllVersionsConfirmed) {
        sinVersionCount++;
      }
    } else {
      for (const v of specificVers) {
        versionesMap[v] = (versionesMap[v] || 0) + 1;
      }
    }
    if (p.num_comentarios > 0) conComentariosCount++;
    if (!p.image && !p.image_remote) sinImagenCount++;
    if (!p.sale_price || !String(p.sale_price).trim()) sinPrecioCount++;
    if (p.link_status === 'broken') enlacesCaidosCount++;
    if (p.backup_links && p.backup_links.length > 0) conLinksReservaCount++;
  }

  const categorias = Object.entries(categoriasMap)
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([nombre, count]) => ({ nombre, count }));

  const versiones = Object.entries(versionesMap)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([nombre, count]) => ({ nombre, count }));

  // 4. Aplicar filtros activos
  let filtered = allMapped;

  if (quickFilter === 'with_comments') {
    filtered = filtered.filter(p => p.num_comentarios > 0);
  } else if (quickFilter === 'no_category') {
    filtered = filtered.filter(p => p.categorias.length === 0);
  } else if (quickFilter === 'no_version') {
    filtered = filtered.filter(
      p =>
        !p.isAllVersionsConfirmed &&
        (!p.versiones || p.versiones.filter((v: string) => v && v !== '__todas__').length === 0)
    );
  } else if (quickFilter === 'no_image') {
    filtered = filtered.filter(p => !p.image && !p.image_remote);
  } else if (quickFilter === 'no_price') {
    filtered = filtered.filter(p => !p.sale_price || !String(p.sale_price).trim());
  } else if (quickFilter === 'broken_links') {
    filtered = filtered.filter(p => p.link_status === 'broken');
  } else if (quickFilter === 'with_backups') {
    filtered = filtered.filter(p => p.backup_links && p.backup_links.length > 0);
  }

  if (categoria === '__sin_categoria__') {
    filtered = filtered.filter(p => p.categorias.length === 0);
  } else if (categoria) {
    const cLow = categoria.toLowerCase();
    filtered = filtered.filter(p =>
      p.categorias.some(c => c.toLowerCase() === cLow)
    );
  }

  if (version === '__sin_version__') {
    filtered = filtered.filter(
      p => p.versiones.length === 0 || (p.versiones.length === 1 && p.versiones[0] === '__todas__')
    );
  } else if (version) {
    const vLow = version.toLowerCase();
    filtered = filtered.filter(p =>
      p.versiones.some(v => v.toLowerCase() === vLow)
    );
  }

  if (busqueda) {
    const qLow = busqueda.toLowerCase();
    filtered = filtered.filter(
      p =>
        p.title.toLowerCase().includes(qLow) ||
        p.id.toLowerCase().includes(qLow) ||
        (p.affiliate_url && p.affiliate_url.toLowerCase().includes(qLow)) ||
        p.categorias.some(c => c.toLowerCase().includes(qLow)) ||
        p.comentarios.some(c => c.text.toLowerCase().includes(qLow) || c.username.toLowerCase().includes(qLow))
    );
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const paginated = filtered.slice(offset, offset + limit);

  return NextResponse.json(
    {
      isLocal: isLocalServer(),
      brands: brandsSummary,
      allCategories,
      groupId,
      topicId,
      total,
      totalSection: allMapped.length,
      sinCategoriaCount,
      sinVersionCount,
      conComentariosCount,
      sinImagenCount,
      sinPrecioCount,
      enlacesCaidosCount,
      conLinksReservaCount,
      page,
      totalPages,
      categorias,
      versiones,
      productos: paginated,
    },
    {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  );
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // Acción de login
  if (body.action === 'login') {
    if (body.username === ADMIN_USER && body.password === ADMIN_PASS) {
      return NextResponse.json({ ok: true, user: ADMIN_USER });
    }
    return NextResponse.json({ ok: false, error: 'Usuario o contraseña incorrectos' }, { status: 401 });
  }

  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Acción para importar nuevas ventas de AliExpress desde el servidor local
  if (body.action === 'sync_ventas_ali') {
    if (!isLocalServer()) {
      return NextResponse.json({
        ok: true,
        message: 'Las ventas de AliExpress se sincronizan automáticamente cada noche desde tu servidor local.',
      });
    }
    try {
      const { execSync } = await import('child_process');
      const out = execSync('/home/xavi/milena/bin/python3 /home/xavi/proyectos-antigravity/1-referidos/sync_ventas_aliexpress.py', {
        encoding: 'utf-8',
        timeout: 45000,
      });
      const m = out.match(/Importados\s+(\d+)\s+productos/);
      const num = m ? m[1] : '0';
      return NextResponse.json({
        ok: true,
        message: `Sincronización completada: ${num} productos nuevos importados de tus ventas de AliExpress.`,
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // Acción para lanzar sync_and_deploy.sh cuando se está en servidor local
  if (body.action === 'sync_vercel') {
    if (!isLocalServer()) {
      return NextResponse.json({
        ok: true,
        message: 'Ya estás operando en la nube (Vercel). Los cambios están activos en tiempo real.',
      });
    }
    try {
      exec('bash /home/xavi/proyectos-antigravity/2-navegador-tesla/scripts/sync_and_deploy.sh > /tmp/manual_vercel_sync.log 2>&1 &');
      return NextResponse.json({
        ok: true,
        message: 'Sincronización y despliegue a Vercel iniciados en segundo plano (~1 min).',
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // Acción para recuperar datos desde la API oficial (AliExpress, Amazon o fallback)
  if (body.action === 'fetch_product_api') {
    let platform = (body.platform || '').toLowerCase();
    let productId = String(body.productId || '').trim();
    const rawUrl = String(body.url || '').trim();

    // Si la URL contiene identificador de plataforma o producto, extraerlo
    if (rawUrl) {
      if (rawUrl.includes('aliexpress.com')) {
        platform = 'aliexpress';
        const m = rawUrl.match(/item\/(\d+)\.html/);
        if (m) productId = m[1];
      } else if (rawUrl.includes('amazon.') || rawUrl.includes('amzn.to') || rawUrl.includes('amzn.eu') || rawUrl.includes('a.co') || rawUrl.includes('link.amazon')) {
        platform = 'amazon';
        const m = rawUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i) || rawUrl.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i);
        if (m) productId = m[1];
      }
    }

    let apiData: any = null;

    if (platform === 'aliexpress' && /^\d+$/.test(productId)) {
      apiData = await fetchAliExpressProduct(productId);
    } else if (platform === 'amazon' && (productId || rawUrl)) {
      apiData = await fetchAmazonProduct(productId, rawUrl);
    }

    // Si no obtuvo datos y tenemos URL, probar fallback OpenGraph
    if (!apiData && rawUrl) {
      apiData = await fetchGenericOgProduct(rawUrl);
    }

    if (!apiData) {
      return NextResponse.json(
        { ok: false, error: 'No se encontraron datos en la API para este producto o identificador.' },
        { status: 404 }
      );
    }

    // Si hay imagen y estamos en servidor local, guardarla en carpetas img/
    let localImagePath: string | null = null;
    if (apiData.image && isLocalServer()) {
      localImagePath = await saveImageLocally(
        apiData.image,
        platform || 'aliexpress',
        productId,
        body.groupName,
        body.topicName
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        title: apiData.title,
        sale_price: apiData.sale_price,
        original_price: apiData.original_price || null,
        discount: apiData.discount || null,
        image: localImagePath || apiData.image,
        remote_image: apiData.image,
        affiliate_url: apiData.affiliate_url || null,
      },
    });
  }

  const validActions = [
    'update_product',
    'delete_product',
    'add_comment',
    'update_comment',
    'delete_comment',
    'manage_versions',
    'manage_categories',
    'publish_product',
  ];

  if (!validActions.includes(body.action)) {
    return NextResponse.json({ error: `Acción desconocida: ${body.action}` }, { status: 400 });
  }

  const { inventario, comentarios, topicsData } = await loadAllChuchesData(true);
  if (!inventario) {
    return NextResponse.json({ error: 'Inventario no disponible' }, { status: 503 });
  }

  // Si es delete_product y pidió borrar también el mensaje del grupo de Telegram
  if (body.action === 'delete_product' && body.payload?.deleteTelegramMsg && body.payload?.botMessageId && body.payload?.groupId) {
    try {
      await fetch(
        `https://api.telegram.org/bot${CHUCHES_BOT_TOKEN}/deleteMessage?chat_id=${body.payload.groupId}&message_id=${body.payload.botMessageId}`,
        { method: 'POST' }
      );
    } catch (e) {
      console.warn('[AdminAPI] No se pudo borrar mensaje de Telegram:', e);
    }
  }

  // Si es publish_product, publicar primero en el canal/topic de Telegram y asociar bot_message_id
  if (body.action === 'publish_product') {
    const payload = body.payload || {};
    if (!payload.targetGroupId || !payload.targetTopicId) {
      return NextResponse.json(
        { error: 'Debes seleccionar el grupo y topic de destino.' },
        { status: 400 }
      );
    }

    // 1. Enviar a Telegram
    const tgRes = await publishProductToTelegram(payload);
    if (!tgRes.ok || !tgRes.messageId) {
      return NextResponse.json(
        { error: tgRes.error || 'No se pudo publicar el artículo en Telegram.' },
        { status: 400 }
      );
    }

    // 2. Si estamos en local y hay que organizar la imagen en la carpeta del nuevo topic
    const targetBrand = BRAND_CONFIG.find(b => b.id === payload.targetGroupId);
    const targetGroupName = targetBrand?.name ? `${targetBrand.name} chuches` : payload.targetGroupName;
    if (payload.updates) {
      const finalImage = await copyOrSaveImageForTopic(
        payload.updates.image,
        payload.updates.image_remote,
        payload.platform,
        payload.productId,
        targetGroupName,
        payload.targetTopicName
      );
      if (finalImage) {
        payload.updates.image = finalImage;
      }
      payload.updates.bot_message_id = tgRes.messageId;
    }

    // 3. Ajustar moveMode según removeFromSource (por defecto true)
    payload.moveMode = payload.removeFromSource !== false ? 'move' : 'copy';
  }

  const local = isLocalServer();
  const newAction: AdminAction = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type: body.action,
    payload: body.payload || {},
    appliedLocally: local,
  };

  const changed = applyActionToMemory(newAction, inventario, comentarios, topicsData);
  if (!changed) {
    return NextResponse.json(
      { error: 'No se encontró el elemento a modificar o no hubo cambios.' },
      { status: 404 }
    );
  }

  // Si estamos en el servidor local, escribimos directamente en /home/xavi/proyectos-antigravity/1-referidos/inventarios/
  if (local) {
    if (['delete_product', 'update_product', 'publish_product', 'manage_versions', 'manage_categories'].includes(newAction.type)) {
      writeJSONSafe('inventario_global.json', inventario);
    }
    if (['add_comment', 'update_comment', 'delete_comment'].includes(newAction.type)) {
      writeJSONSafe('comentarios.json', comentarios);
    }
    if (newAction.type === 'manage_versions') {
      writeJSONSafe('topics.json', topicsData);
    }
  }

  // Guardamos también la acción en Supabase Storage para que tanto Vercel como Local estén sincronizados al instante
  const cloudActions = await getCloudActions(true);
  cloudActions.push(newAction);
  // Mantener máximo 500 acciones recientes en el buffer cloud
  const trimmed = cloudActions.slice(-500);
  await saveCloudActions(trimmed);

  return NextResponse.json({
    ok: true,
    isLocal: local,
    actionId: newAction.id,
  });
}
