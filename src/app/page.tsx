'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './chuches.module.css';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Producto {
  id: string;
  platform: string;
  title: string;
  affiliate_url: string | null;
  image: string | null;
  recommendations: number;
  votes: number;
  categorias: string[];
  versiones: string[];
  num_comentarios: number;
  comentarios: { username: string; text: string; date: string }[];
  sale_price: string | null;
  original_price: string | null;
  discount: string | null;
  section: string;
}

interface CategoriaItem { nombre: string; count: number; }
interface VersionItem { nombre: string; count: number; }

interface ApiResponse {
  section: string;
  total: number;
  page: number;
  totalPages: number;
  categorias: CategoriaItem[];
  versiones: VersionItem[];
  productos: Producto[];
}

// ── Constantes ────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'model3', label: 'Model 3', emoji: '🚗' },
  { id: 'modely', label: 'Model Y', emoji: '🚗' },
  { id: 'cargar', label: 'Cargar en Casa', emoji: '⚡' },
  { id: 'mantenimiento', label: 'Mantenimiento', emoji: '🧽' },
  { id: 'lifestyle', label: 'Lifestyle', emoji: '👕' },
  { id: 'ayudas', label: 'Ayudas 2026', emoji: '💶' },
  { id: 'codigos', label: 'Códigos Ali', emoji: '🏷️' },
  { id: 'referidos', label: 'Referidos Tesla', emoji: '🎰' },
  { id: 'navegador', label: 'Navegador (en construcción)', emoji: '🛰️', isLink: true, href: '/navegador' },
];

const PLATFORM_BADGE: Record<string, { label: string; color: string }> = {
  amazon: { label: 'Amazon', color: '#ff9900' },
  aliexpress: { label: 'AliExpress', color: '#ff4747' },
  aliexpress_short: { label: 'AliExpress', color: '#ff4747' },
  temu: { label: 'Temu', color: '#fb6a37' },
  shein: { label: 'Shein', color: '#a020f0' },
};

// ── Componente Tarjeta de Producto ────────────────────────────────────────────
function ProductCard({ p }: { p: Producto }) {
  const [imgError, setImgError] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const badge = PLATFORM_BADGE[p.platform] || { label: p.platform, color: '#666' };
  const cat = p.categorias[0] || '';

  const displayImage = !imgError && p.image ? p.image : p.image_remote;

  const telegramUrl = p.affiliate_url
    ? `https://t.me/tesla_chuches`
    : 'https://t.me/tesla_chuches';

  return (
    <div className={styles.card}>
      {/* Imagen */}
      <div className={styles.cardImg}>
        {displayImage ? (
          <img
            src={displayImage}
            alt={p.title}
            onError={() => {
              if (displayImage !== p.image_remote && p.image_remote) {
                // Probamos imagen remota si la local falla
                (event?.target as HTMLImageElement).src = p.image_remote;
              } else {
                setImgError(true);
              }
            }}
            loading="lazy"
          />
        ) : (
          <div className={styles.cardImgPlaceholder}>
            <span>⚡</span>
          </div>
        )}
        <span className={styles.platformBadge} style={{ background: badge.color }}>
          {badge.label}
        </span>
        {p.discount && (
          <span className={styles.discountBadge}>-{p.discount}</span>
        )}
      </div>

      {/* Contenido */}
      <div className={styles.cardBody}>
        {cat && <span className={styles.catTag}>{cat}</span>}
        <h3 className={styles.cardTitle}>{p.title}</h3>

        {/* Precio */}
        {p.sale_price && (
          <div className={styles.priceRow}>
            <span className={styles.priceNew}>{p.sale_price}</span>
            {p.original_price && (
              <span className={styles.priceOld}>{p.original_price}</span>
            )}
          </div>
        )}

        {/* Stats */}
        <div className={styles.statsRow}>
          <span title="Recomendaciones de la comunidad">
            ⭐ {p.recommendations}
          </span>
          {p.num_comentarios > 0 && (
            <button
              className={styles.cmtBtn}
              onClick={() => setShowComments(!showComments)}
              title="Comentarios de la comunidad"
            >
              💬 {p.num_comentarios}
            </button>
          )}
        </div>

        {/* Comentarios desplegables */}
        {showComments && p.comentarios.length > 0 && (
          <div className={styles.comments}>
            {p.comentarios.map((c, i) => (
              <div key={i} className={styles.comment}>
                <span className={styles.commentUser}>@{c.username}:</span>
                <span className={styles.commentText}>{c.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Botones de acción */}
        <div className={styles.cardActions}>
          {p.affiliate_url && (
            <a
              href={p.affiliate_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.btnBuy}
            >
              🛒 Ver oferta
            </a>
          )}
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnTelegram}
            title="Ver en el grupo de Telegram"
          >
            ✈️ Telegram
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Sección Ayudas ────────────────────────────────────────────────────────────
function AyudasSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/chuches/ayudas')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Cargando ayudas...</div>;
  if (!data?.ayudas?.[0]) return <div className={styles.empty}>Sin datos de ayudas disponibles.</div>;

  const ayuda = data.ayudas[0];

  return (
    <div className={styles.ayudasWrap}>
      <div className={styles.ayudasHero}>
        <h2 className={styles.ayudasTitulo}>{ayuda.titulo}</h2>
        <p className={styles.ayudasSub}>{ayuda.subtitulo}</p>
        <p className={styles.ayudasIntro}>{ayuda.intro}</p>
        <div className={styles.ayudasDestacados}>
          {ayuda.destacados?.map((d: any, i: number) => (
            <div key={i} className={styles.ayudasDestacado}>
              <span className={styles.dEmoji}>{d.emoji}</span>
              <div>
                <strong>{d.label}</strong>
                <p>{d.valor}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.ayudasSecciones}>
        {ayuda.secciones?.map((s: any) => (
          <div key={s.id} className={styles.ayudasSeccion}>
            <h3>{s.emoji} {s.numero}. {s.titulo}</h3>
            <p>{s.descripcion}</p>
            {s.tramos?.length > 0 && (
              <div className={styles.tramos}>
                {s.tramos.map((t: any, i: number) => (
                  <div key={i} className={styles.tramo}>
                    <span className={styles.tramoEmoji}>{t.emoji}</span>
                    <div>
                      <strong>{t.nombre}</strong> — <span className={styles.tramoImporte}>{t.importe}</span>
                      <p className={styles.tramoCondicion}>{t.condicion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {s.nota && <p className={styles.nota}>ℹ️ {s.nota}</p>}
          </div>
        ))}
      </div>

      <div className={styles.totalBox}>
        <div className={styles.totalLabel}>💵 AHORRO TOTAL EN LA COMPRA</div>
        <div className={styles.totalImporte}>{ayuda.total_compra?.importe}</div>
        <div className={styles.totalDesglose}>
          {ayuda.total_compra?.desglose?.map((d: any, i: number) => (
            <div key={i} className={styles.totalItem}>
              <span>{d.concepto}</span><span>{d.importe}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.ahorroGrid}>
        <h3 className={styles.ahorroTitulo}>🔌 Ahorro en el Día a Día</h3>
        {ayuda.ahorro_dia_a_dia?.map((a: any, i: number) => (
          <div key={i} className={styles.ahorroItem}>
            <span className={styles.ahorroEmoji}>{a.emoji}</span>
            <div>
              <strong>{a.concepto}</strong>
              <p>{a.detalle}</p>
            </div>
          </div>
        ))}
      </div>

      <a href="https://t.me/tesla_chuches" target="_blank" rel="noopener noreferrer" className={styles.btnTelegramBig}>
        ✈️ Únete a la comunidad para más info
      </a>
    </div>
  );
}

// ── Sección Códigos AliExpress ─────────────────────────────────────────────────
function CodigosSection() {
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/chuches/codigos').then(r => r.json()).then(setData);
  }, []);

  const handleCopy = (codigo: string) => {
    navigator.clipboard.writeText(codigo).then(() => {
      setCopied(codigo);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (!data) return <div className={styles.loading}>Cargando códigos...</div>;
  if (!data.codigos?.length) return (
    <div className={styles.empty}>
      <p>No hay códigos activos en este momento.</p>
      <p>Únete al grupo para recibir alertas cuando se publiquen nuevos códigos 👇</p>
      <a href="https://t.me/tesla_chuches" target="_blank" rel="noopener noreferrer" className={styles.btnTelegramBig}>
        ✈️ Ir al grupo Tesla Chuches
      </a>
    </div>
  );

  return (
    <div className={styles.codigosWrap}>
      <div className={styles.codigosHeader}>
        <div className={styles.codigosMeta}>
          {data.inicio && <span>🟢 Inicio: <strong>{data.inicio}</strong></span>}
          {data.fin && <span>🔴 Fin: <strong>{data.fin}</strong></span>}
        </div>
        {data.enlace && (
          <a href={data.enlace} target="_blank" rel="noopener noreferrer" className={styles.btnPromo}>
            🔗 Ver promoción en AliExpress
          </a>
        )}
      </div>
      <div className={styles.codigosGrid}>
        {data.codigos.map((c: any, i: number) => (
          <div key={i} className={styles.codigoCard}>
            <div className={styles.codigoCodigo}>{c.codigo}</div>
            <div className={styles.codigoDescuento}>{c.descuento}</div>
            <button
              className={`${styles.codigoCopyBtn} ${copied === c.codigo ? styles.codigoCopied : ''}`}
              onClick={() => handleCopy(c.codigo)}
            >
              {copied === c.codigo ? '✅ Copiado' : '📋 Copiar'}
            </button>
          </div>
        ))}
      </div>
      <p className={styles.codigosNota}>
        💡 Introduce el código en el carrito de AliExpress antes de finalizar tu compra.
      </p>
    </div>
  );
}

// ── Sección Referidos ─────────────────────────────────────────────────────────
function ReferidosSection() {
  return (
    <div className={styles.referidosWrap}>
      <div className={styles.referidosHero}>
        <div className={styles.referidosEmoji}>🎰</div>
        <h2>Ruleta de Referidos Tesla</h2>
        <p className={styles.referidosSub}>
          ¿Vas a comprar un Tesla? Utiliza el código de referido de un compañero de la comunidad y <strong>ambos os lleváis recompensas de Tesla</strong>.
        </p>
      </div>
      <div className={styles.referidosPasos}>
        <div className={styles.referidoPaso}>
          <span className={styles.pasoNum}>1</span>
          <div>
            <strong>Entra al grupo Tesla Chuches</strong>
            <p>Toda la magia ocurre en nuestro grupo de Telegram.</p>
          </div>
        </div>
        <div className={styles.referidoPaso}>
          <span className={styles.pasoNum}>2</span>
          <div>
            <strong>Pulsa "Obtener un referido"</strong>
            <p>El algoritmo elige un código al azar priorizando a quienes ya han participado en la comunidad.</p>
          </div>
        </div>
        <div className={styles.referidoPaso}>
          <span className={styles.pasoNum}>3</span>
          <div>
            <strong>¿Ya tienes un Tesla? Añade tu código</strong>
            <p>Participa en el bombo y ayuda a la comunidad. ¡Estate atento a las cajas sorpresa!</p>
          </div>
        </div>
      </div>
      <a href="https://t.me/tesla_chuches" target="_blank" rel="noopener noreferrer" className={styles.btnTelegramBig}>
        ✈️ Ir al grupo Tesla Chuches
      </a>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function ChuchesPage() {
  const [section, setSection] = useState('model3');
  const [categoria, setCategoria] = useState('');
  const [versionFilter, setVersionFilter] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [buscadorInput, setBuscadorInput] = useState('');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [showIosModal, setShowIosModal] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialUrlApplied = useRef(false);

  const fetchProducts = useCallback(async (sec: string, cat: string, ver: string, q: string, pg: number) => {
    if (['ayudas', 'codigos', 'referidos'].includes(sec)) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ section: sec, page: String(pg), limit: '48' });
      if (cat) params.set('cat', cat);
      if (ver) params.set('ver', ver);
      if (q) params.set('q', q);
      const res = await fetch(`/api/chuches/products?${params}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      });
    } else {
      setShowIosModal(true);
    }
  };

  // Leer parámetros de la URL al cargar (ej: desde botón de Telegram)
  // Permite que /?section=modely&categoria=Pedales active la pestaña y filtro correctos
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sec = params.get('section');
    const cat = params.get('categoria');
    const validSec = sec && ['model3', 'modely'].includes(sec) ? sec : null;
    if (validSec || cat) {
      initialUrlApplied.current = true;
      if (validSec) setSection(validSec);
      if (cat) setCategoria(cat);
      fetchProducts(validSec || 'model3', cat || '', '', '', 1);
    }
  }, [fetchProducts]);

  useEffect(() => {
    // Si venimos de URL params, saltamos el reset de filtros esta vez
    if (initialUrlApplied.current) {
      initialUrlApplied.current = false;
      return;
    }
    setCategoria('');
    setVersionFilter('');
    setCatSearch('');
    setBusqueda('');
    setBuscadorInput('');
    setPage(1);
    fetchProducts(section, '', '', '', 1);
  }, [section, fetchProducts]);

  const handleCatChange = (cat: string) => {
    setCategoria(cat);
    setPage(1);
    fetchProducts(section, cat, versionFilter, busqueda, 1);
  };

  const handleVersionChange = (ver: string) => {
    setVersionFilter(ver);
    setPage(1);
    fetchProducts(section, categoria, ver, busqueda, 1);
  };

  const handleSearch = (q: string) => {
    setBuscadorInput(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBusqueda(q);
      setPage(1);
      fetchProducts(section, categoria, versionFilter, q, 1);
    }, 400);
  };

  const handlePage = (pg: number) => {
    setPage(pg);
    fetchProducts(section, categoria, versionFilter, busqueda, pg);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isSpecial = ['ayudas', 'codigos', 'referidos'].includes(section);

  const filteredCategories = data?.categorias?.filter(c =>
    !catSearch || c.nombre.toLowerCase().includes(catSearch.toLowerCase())
  ) || [];

  return (
    <div className={styles.wrap}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerBtns}>
            <a
              href="https://play.google.com/store/apps/details?id=es.viajandoentesla.teslachuches&pcampaignid=web_share"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.headerAppBtn}
            >
              <span>📱</span>
              <span>App Android</span>
            </a>
            <a href="https://t.me/tesla_chuches" target="_blank" rel="noopener noreferrer" className={styles.headerTgBtn}>
              ✈️ Comunidad Telegram
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroAvatarWrap}>
          <img src="/logo-teslachuches.png" alt="Tesla Chuches Comunidad" className={styles.heroAvatar} />
        </div>
        <h1 className={styles.heroTitle}>
          Los mejores accesorios para tu <span className={styles.heroTesla}>Tesla</span>
        </h1>
        <p className={styles.heroSub}>
          Seleccionados y valorados por la comunidad. Más de <strong>1.000 productos</strong> clasificados por modelo y categoría.
        </p>
        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <strong>{data?.stats?.totalProducts ? data.stats.totalProducts.toLocaleString('es-ES') : '1.039'}</strong>
            <span>accesorios</span>
          </div>
          <div className={styles.heroStat}>
            <strong>{data?.stats?.totalCategories || 47}</strong>
            <span>categorías</span>
          </div>
          <div className={styles.heroStat}>
            <strong>{data?.stats?.totalReferidos || 76}</strong>
            <span>referidos</span>
          </div>
          <div className={styles.heroStat}>
            <strong>{data?.stats?.totalMiembros || 488}</strong>
            <span>miembros</span>
          </div>
        </div>

        <div className={styles.heroAppBanner}>
          <a
            href="https://play.google.com/store/apps/details?id=es.viajandoentesla.teslachuches&pcampaignid=web_share"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.playStoreBtn}
          >
            <svg className={styles.playStoreIcon} viewBox="0 0 512 512" fill="currentColor">
              <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l220.7-221.3 60.1 60.1L104.6 499z" />
            </svg>
            <div className={styles.playStoreText}>
              <span className={styles.playStoreSub}>DISPONIBLE EN</span>
              <span className={styles.playStoreTitle}>Google Play</span>
            </div>
          </a>
        </div>
      </section>

      {/* ── Navegación de secciones ── */}
      <nav className={styles.sectionsNav}>
        {SECTIONS.map(s => (
          s.isLink ? (
            <a
              key={s.id}
              href={s.href}
              className={`${styles.sectionBtn} ${styles.sectionBtnLink}`}
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
            </a>
          ) : (
            <button
              key={s.id}
              className={`${styles.sectionBtn} ${section === s.id ? styles.sectionBtnActive : ''}`}
              onClick={() => setSection(s.id)}
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
            </button>
          )
        ))}
      </nav>

      {/* ── Contenido de secciones especiales ── */}
      {section === 'ayudas' && (
        <main className={styles.specialSection}><AyudasSection /></main>
      )}
      {section === 'codigos' && (
        <main className={styles.specialSection}><CodigosSection /></main>
      )}
      {section === 'referidos' && (
        <main className={styles.specialSection}><ReferidosSection /></main>
      )}

      {/* ── Catálogo de productos ── */}
      {!isSpecial && (
        <main className={styles.catalogoWrap}>
          <div className={styles.catalogoSidebar}>
            {/* Buscador de productos */}
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="🔍 Buscar accesorios..."
                value={buscadorInput}
                onChange={e => handleSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {/* Filtro por Versión — dropdown */}
            {data?.versiones && data.versiones.length > 0 && (
              <div className={styles.catFilter}>
                <h4 className={styles.catFilterTitle}>🚗 Versión Tesla</h4>
                <select
                  className={styles.filterSelect}
                  value={versionFilter}
                  onChange={e => handleVersionChange(e.target.value)}
                >
                  <option value="">Todas las versiones</option>
                  {data.versiones.map(v => (
                    <option key={v.nombre} value={v.nombre}>
                      {v.nombre} ({v.count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Categorías — dropdown */}
            {data?.categorias && data.categorias.length > 0 && (
              <div className={styles.catFilter}>
                <h4 className={styles.catFilterTitle}>📁 Categoría</h4>
                <select
                  className={styles.filterSelect}
                  value={categoria}
                  onChange={e => handleCatChange(e.target.value)}
                >
                  <option value="">Todas las categorías ({data.total})</option>
                  {data.categorias.map(c => (
                    <option key={c.nombre} value={c.nombre}>
                      {c.nombre} ({c.count})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className={styles.catalogoMain}>
            {/* Cabecera del catálogo */}
            <div className={styles.catalogoHeader}>
              <span className={styles.catalogoCount}>
                {loading ? 'Cargando...' : `${data?.total || 0} productos`}
                {categoria && ` · ${categoria}`}
                {versionFilter && ` · ${versionFilter}`}
                {busqueda && ` · "${busqueda}"`}
              </span>
            </div>

            {/* Grid de productos */}
            {loading ? (
              <div className={styles.loadingGrid}>
                {[...Array(12)].map((_, i) => (
                  <div key={i} className={styles.skeleton} />
                ))}
              </div>
            ) : data?.productos?.length ? (
              <>
                <div className={styles.productoGrid}>
                  {data.productos.map(p => (
                    <ProductCard key={`${p.platform}_${p.id}`} p={p} />
                  ))}
                </div>
                {/* Paginación */}
                {data.totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button
                      disabled={page === 1}
                      onClick={() => handlePage(page - 1)}
                      className={styles.pageBtn}
                    >← Anterior</button>
                    <span className={styles.pageInfo}>
                      Página {page} de {data.totalPages}
                    </span>
                    <button
                      disabled={page === data.totalPages}
                      onClick={() => handlePage(page + 1)}
                      className={styles.pageBtn}
                    >Siguiente →</button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.empty}>
                No hay productos para este filtro.
                <button className={styles.clearBtn} onClick={() => {
                  setBuscadorInput(''); setBusqueda(''); setCategoria(''); setVersionFilter(''); setCatSearch('');
                  fetchProducts(section, '', '', '', 1);
                }}>Limpiar filtros</button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ── Footer / Comunidad ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerComunidad}>
            <h3>💬 Comunidad Tesla Chuches</h3>
            <p>Únete a miles de propietarios de Tesla que comparten sus mejores descuentos, accesorios y experiencias cada día.</p>
            <a href="https://t.me/tesla_chuches" target="_blank" rel="noopener noreferrer" className={styles.btnTelegramBig}>
              ✈️ Unirse al grupo
            </a>
          </div>
          <div className={styles.footerLinks}>
            <a href="/navegador">🗺️ Navegador Tesla</a>
            <span>·</span>
            <a href="https://t.me/tesla_chuches" target="_blank" rel="noopener noreferrer">Telegram</a>
            <span>·</span>
            <a href="/privacidad">🔒 Política de Privacidad</a>
          </div>
          <p className={styles.footerDisclaimer}>
            Los precios y disponibilidad pueden variar. Los enlaces son de afiliado y ayudan a mantener la comunidad.
          </p>
        </div>
      </footer>
    </div>
  );
}
