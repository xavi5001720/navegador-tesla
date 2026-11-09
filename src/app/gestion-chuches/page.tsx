'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './gestion.module.css';

interface ComentarioItem {
  index: number;
  username: string;
  text: string;
  date: string;
}

interface BackupLinkItem {
  product_id?: string;
  platform?: string;
  affiliate_url: string;
  sale_price?: string | null;
  title?: string;
  status?: string;
}

interface ProductoAdmin {
  id: string;
  platform: string;
  key: string;
  groupId: string;
  groupName: string;
  brandEmoji: string;
  topicId: string;
  topicName: string;
  title: string;
  rawTitle: string;
  affiliate_url: string;
  image: string | null;
  rawImage: string;
  image_remote: string | null;
  recommendations: number;
  base_recommendations: number;
  votes: number;
  categorias: string[];
  versiones: string[];
  isAllVersionsConfirmed?: boolean;
  num_comentarios: number;
  comentarios: ComentarioItem[];
  sale_price: string | null;
  original_price: string | null;
  discount: string | null;
  timestamp: string | null;
  bot_message_id: number | null;
  link_status?: string;
  backup_links?: BackupLinkItem[];
}

interface TopicSummary {
  id: string;
  name: string;
  count: number;
  versiones: string[];
}

interface BrandSummary {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  telegram: string;
  groupName: string;
  totalItems: number;
  topics: TopicSummary[];
}

interface AdminApiResponse {
  isLocal: boolean;
  brands: BrandSummary[];
  allCategories: string[];
  groupId: string;
  topicId: string;
  total: number;
  totalSection: number;
  sinCategoriaCount: number;
  sinVersionCount: number;
  conComentariosCount: number;
  sinImagenCount: number;
  sinPrecioCount: number;
  enlacesCaidosCount?: number;
  conLinksReservaCount?: number;
  page: number;
  totalPages: number;
  categorias: { nombre: string; count: number }[];
  versiones: { nombre: string; count: number }[];
  productos: ProductoAdmin[];
}

const PLATFORM_BADGE: Record<string, { label: string; color: string }> = {
  amazon: { label: 'Amazon', color: '#ff9900' },
  aliexpress: { label: 'AliExpress', color: '#ff4747' },
  aliexpress_short: { label: 'AliExpress', color: '#ff4747' },
  temu: { label: 'Temu', color: '#fb6a37' },
  shein: { label: 'Shein', color: '#a020f0' },
};

const STORAGE_AUTH_KEY = 'chuches_admin_auth_v1';

export default function GestionChuchesPage() {
  // ── Autenticación ──
  const [auth, setAuth] = useState<{ user: string; pass: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Estado de Navegación y Filtros ──
  const [groupId, setGroupId] = useState('-1003731237376');
  const [topicId, setTopicId] = useState('all');
  const [categoria, setCategoria] = useState('');
  const [versionFilter, setVersionFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'no_category' | 'no_version' | 'with_comments' | 'no_image' | 'no_price' | 'broken_links' | 'with_backups'>('all');
  const [busqueda, setBusqueda] = useState('');
  const [buscadorInput, setBuscadorInput] = useState('');
  const [page, setPage] = useState(1);

  // ── Datos del Catálogo ──
  const [data, setData] = useState<AdminApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Modales de Edición / Borrado / Gestión ──
  const [publishingProduct, setPublishingProduct] = useState<ProductoAdmin | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductoAdmin | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductoAdmin | null>(null);
  const [showTaxonomyModal, setShowTaxonomyModal] = useState(false);
  const [syncingVercel, setSyncingVercel] = useState(false);
  const [syncingAli, setSyncingAli] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(prev => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Comprobar sesión guardada al cargar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_AUTH_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.user && parsed?.pass) {
          setAuth(parsed);
        }
      }
    } catch {}
    setAuthChecked(true);
  }, []);

  const fetchAdminData = useCallback(
    async (
      currentAuth: { user: string; pass: string },
      gid: string,
      tid: string,
      cat: string,
      ver: string,
      qf: string,
      q: string,
      pg: number,
      silent = false
    ) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({
          groupId: gid,
          topicId: tid,
          page: String(pg),
          limit: '48',
        });
        if (cat) params.set('cat', cat);
        if (ver) params.set('ver', ver);
        if (qf && qf !== 'all') params.set('filter', qf);
        if (q) params.set('q', q);

        const res = await fetch(`/api/chuches/admin?${params.toString()}`, {
          headers: {
            'x-admin-user': currentAuth.user,
            'x-admin-pass': currentAuth.pass,
          },
          cache: 'no-store',
        });

        if (res.status === 401) {
          localStorage.removeItem(STORAGE_AUTH_KEY);
          setAuth(null);
          return;
        }

        const json = await res.json();
        if (res.ok) {
          setData(json);
        } else {
          showToast(`⚠️ ${json.error || 'Error al cargar datos'}`);
        }
      } catch (e) {
        console.error(e);
        showToast('⚠️ Error de conexión con el servidor');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (auth) {
      fetchAdminData(auth, groupId, topicId, categoria, versionFilter, quickFilter, busqueda, page);
    }
  }, [auth, groupId, topicId, categoria, versionFilter, quickFilter, busqueda, page, fetchAdminData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/chuches/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username: loginUser.trim(),
          password: loginPass.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        const creds = { user: loginUser.trim(), pass: loginPass.trim() };
        localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(creds));
        setAuth(creds);
      } else {
        setLoginError(json.error || 'Usuario o contraseña incorrectos');
      }
    } catch {
      setLoginError('Error de conexión al verificar credenciales');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_AUTH_KEY);
    setAuth(null);
    setData(null);
  };

  const executeAdminAction = async (action: string, payload: any, successMsg: string) => {
    if (!auth) return false;
    try {
      const res = await fetch('/api/chuches/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': auth.user,
          'x-admin-pass': auth.pass,
        },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(`❌ ${json.error || 'No se pudo guardar el cambio'}`);
        return false;
      }
      showToast(`✅ ${successMsg}`);
      await fetchAdminData(auth, groupId, topicId, categoria, versionFilter, quickFilter, busqueda, page, true);
      return true;
    } catch (e) {
      console.error(e);
      showToast('❌ Error de red al guardar');
      return false;
    }
  };

  const handleSyncAli = async () => {
    if (!auth || syncingAli) return;
    setSyncingAli(true);
    try {
      const res = await fetch('/api/chuches/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': auth.user,
          'x-admin-pass': auth.pass,
        },
        body: JSON.stringify({ action: 'sync_ventas_ali' }),
      });
      const json = await res.json();
      showToast(`🛍️ ${json.message || 'Ventas sincronizadas'}`);
      await fetchAdminData(auth, groupId, topicId, categoria, versionFilter, quickFilter, busqueda, page, true);
    } catch {
      showToast('❌ Error al sincronizar ventas de AliExpress');
    } finally {
      setSyncingAli(false);
    }
  };

  const handleSyncVercel = async () => {
    if (!auth || syncingVercel) return;
    setSyncingVercel(true);
    try {
      const res = await fetch('/api/chuches/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': auth.user,
          'x-admin-pass': auth.pass,
        },
        body: JSON.stringify({ action: 'sync_vercel' }),
      });
      const json = await res.json();
      showToast(`🚀 ${json.message || 'Sincronización iniciada'}`);
    } catch {
      showToast('❌ Error al iniciar sincronización');
    } finally {
      setTimeout(() => setSyncingVercel(false), 3000);
    }
  };

  const handleBrandSelect = (gid: string) => {
    setGroupId(gid);
    setTopicId('all');
    setCategoria('');
    setVersionFilter('');
    setPage(1);
  };

  const handleTopicSelect = (tid: string) => {
    setTopicId(tid);
    setCategoria('');
    setVersionFilter('');
    setPage(1);
  };

  const handleSearchInput = (val: string) => {
    setBuscadorInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBusqueda(val);
      setPage(1);
    }, 350);
  };

  if (!authChecked) return null;

  // ── Pantalla de Login ──
  if (!auth) {
    return (
      <div className={styles.loginWrap}>
        <div className={styles.loginCard}>
          <div className={styles.loginIcon}>🛠️</div>
          <h1 className={styles.loginTitle}>Gestor ChuchesEV</h1>
          <p className={styles.loginSub}>
            Panel privado de administración de base de datos multimarca
          </p>
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <div>
              <label className={styles.fieldLabel}>Usuario</label>
              <input
                type="text"
                className={styles.input}
                value={loginUser}
                onChange={e => setLoginUser(e.target.value)}
                placeholder="Introduce tu usuario"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className={styles.fieldLabel}>Contraseña</label>
              <input
                type="password"
                className={styles.input}
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            {loginError && <div className={styles.loginError}>{loginError}</div>}
            <button type="submit" className={styles.loginBtn} disabled={loginLoading}>
              {loginLoading ? 'Verificando...' : '🔓 Entrar al Gestor'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const currentBrand = data?.brands?.find(b => b.id === groupId) || null;
  const totalGlobalItems = data?.brands?.reduce((acc, b) => acc + b.totalItems, 0) || 0;

  return (
    <div className={styles.wrap}>
      {/* ── Barra Superior ── */}
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.brandHeader}>
            <span className={styles.adminBadge}>🛠️ GESTOR BD CHUCHES</span>
            <span
              className={`${styles.serverBadge} ${
                data?.isLocal ? styles.serverLocal : styles.serverCloud
              }`}
              title={
                data?.isLocal
                  ? 'Guardado directo en disco (/1-referidos/inventarios/)'
                  : 'Sincronizado en tiempo real con Supabase + Local'
              }
            >
              {data?.isLocal ? '🟢 Servidor Local Directo' : '☁️ Sincronización Cloud Activa'}
            </span>
          </div>

          <div className={styles.topActions}>
            <button
              className={styles.topBtn}
              onClick={handleSyncAli}
              disabled={syncingAli}
              title="Importar nuevos productos vendidos en AliExpress que aún no están en los grupos"
            >
              {syncingAli ? '⏳ Importando...' : '🛍️ Importar Ventas Ali'}
            </button>
            <button
              className={styles.topBtn}
              onClick={() => setShowTaxonomyModal(true)}
            >
              ⚙️ Versiones y Categorías
            </button>
            {data?.isLocal && (
              <button
                className={`${styles.topBtn} ${styles.topBtnPrimary}`}
                onClick={handleSyncVercel}
                disabled={syncingVercel}
              >
                {syncingVercel ? '⏳ Publicando...' : '🚀 Subir cambios a Vercel'}
              </button>
            )}
            <a href="/" target="_blank" rel="noopener noreferrer" className={styles.topBtn}>
              👁️ Ver Web Pública
            </a>
            <button className={`${styles.topBtn} ${styles.topBtnDanger}`} onClick={handleLogout}>
              🔒 Salir
            </button>
          </div>
        </div>
      </header>

      {/* ── Selector Nivel 1: Marcas ── */}
      <section className={styles.brandsSection}>
        <div className={styles.sectionLabel}>
          <span>🚗 1. Selecciona Marca ({data?.brands?.length || 0} grupos)</span>
        </div>
        <div className={styles.brandsBar}>
          {data?.brands?.map(b => (
            <button
              key={b.id}
              className={`${styles.brandBtn} ${groupId === b.id ? styles.brandBtnActive : ''}`}
              onClick={() => handleBrandSelect(b.id)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span>{b.emoji}</span>
                <span>{b.name}</span>
              </span>
              <span className={styles.brandCount}>{b.totalItems}</span>
            </button>
          ))}
        </div>

        {/* ── Selector Nivel 2: Modelos / Topics de la Marca ── */}
        {currentBrand && currentBrand.topics.length > 0 && (
          <div className={styles.topicsBar}>
            <button
              className={`${styles.topicBtn} ${topicId === 'all' ? styles.topicBtnActive : ''}`}
              onClick={() => handleTopicSelect('all')}
            >
              <span>📋 Todos ({currentBrand.totalItems})</span>
            </button>
            {currentBrand.topics.map(t => (
              <button
                key={t.id}
                className={`${styles.topicBtn} ${topicId === t.id ? styles.topicBtnActive : ''}`}
                onClick={() => handleTopicSelect(t.id)}
              >
                <span>{t.name}</span>
                <span className={styles.topicCount}>{t.count}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Cuerpo Principal: Sidebar + Grid ── */}
      <div className={styles.mainLayout}>
        <aside className={styles.sidebar}>
          {/* Buscador */}
          <div className={styles.filterGroup}>
            <h4 className={styles.filterTitle}>🔍 Buscar artículo</h4>
            <input
              type="text"
              className={styles.input}
              placeholder="Título, ID, enlace, comentario..."
              value={buscadorInput}
              onChange={e => handleSearchInput(e.target.value)}
            />
          </div>

          {/* Filtros rápidos de mantenimiento */}
          <div className={styles.filterGroup}>
            <h4 className={styles.filterTitle}>⚡ Filtros de revisión</h4>
            <div className={styles.quickFilters}>
              <button
                className={`${styles.qfBtn} ${quickFilter === 'all' ? styles.qfBtnActive : ''}`}
                onClick={() => { setQuickFilter('all'); setPage(1); }}
              >
                <span>📦 Todos los artículos</span>
                <span>{data?.totalSection || 0}</span>
              </button>
              <button
                className={`${styles.qfBtn} ${quickFilter === 'no_category' ? styles.qfBtnActive : ''}`}
                onClick={() => { setQuickFilter('no_category'); setPage(1); }}
              >
                <span>⚠️ Sin categoría</span>
                <span>{data?.sinCategoriaCount || 0}</span>
              </button>
              <button
                className={`${styles.qfBtn} ${quickFilter === 'no_version' ? styles.qfBtnActive : ''}`}
                onClick={() => { setQuickFilter('no_version'); setPage(1); }}
              >
                <span>🚗 Sin versión</span>
                <span>{data?.sinVersionCount || 0}</span>
              </button>
              <button
                className={`${styles.qfBtn} ${quickFilter === 'with_comments' ? styles.qfBtnActive : ''}`}
                onClick={() => { setQuickFilter('with_comments'); setPage(1); }}
              >
                <span>💬 Con comentarios</span>
                <span>{data?.conComentariosCount || 0}</span>
              </button>
              <button
                className={`${styles.qfBtn} ${quickFilter === 'no_image' ? styles.qfBtnActive : ''}`}
                onClick={() => { setQuickFilter('no_image'); setPage(1); }}
              >
                <span>🖼️ Sin imagen</span>
                <span>{data?.sinImagenCount || 0}</span>
              </button>
              <button
                className={`${styles.qfBtn} ${quickFilter === 'no_price' ? styles.qfBtnActive : ''}`}
                onClick={() => { setQuickFilter('no_price'); setPage(1); }}
              >
                <span>🏷️ Sin precio</span>
                <span>{data?.sinPrecioCount || 0}</span>
              </button>
              <button
                className={`${styles.qfBtn} ${quickFilter === 'with_backups' ? styles.qfBtnActive : ''}`}
                onClick={() => { setQuickFilter('with_backups'); setPage(1); }}
              >
                <span>🔗 Con links reserva</span>
                <span>{data?.conLinksReservaCount || 0}</span>
              </button>
              <button
                className={`${styles.qfBtn} ${quickFilter === 'broken_links' ? styles.qfBtnActive : ''}`}
                onClick={() => { setQuickFilter('broken_links'); setPage(1); }}
              >
                <span>🚨 Revisar link / stock</span>
                <span>{data?.enlacesCaidosCount || 0}</span>
              </button>
            </div>
          </div>

          {/* Selector de Categoría */}
          <div className={styles.filterGroup}>
            <h4 className={styles.filterTitle}>📁 Categoría</h4>
            <select
              className={styles.select}
              value={categoria}
              onChange={e => { setCategoria(e.target.value); setPage(1); }}
            >
              <option value="">Todas las categorías ({data?.totalSection || 0})</option>
              {(data?.sinCategoriaCount || 0) > 0 && (
                <option value="__sin_categoria__">
                  ⚠️ Sin categoría ({data?.sinCategoriaCount})
                </option>
              )}
              {data?.categorias?.map(c => (
                <option key={c.nombre} value={c.nombre}>
                  {c.nombre} ({c.count})
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Versión */}
          {data?.versiones && data.versiones.length > 0 && (
            <div className={styles.filterGroup}>
              <h4 className={styles.filterTitle}>🚗 Versión del modelo</h4>
              <select
                className={styles.select}
                value={versionFilter}
                onChange={e => { setVersionFilter(e.target.value); setPage(1); }}
              >
                <option value="">Todas las versiones</option>
                <option value="__sin_version__">🌐 Genéricas (__todas__)</option>
                {data.versiones.map(v => (
                  <option key={v.nombre} value={v.nombre}>
                    {v.nombre} ({v.count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {(categoria || versionFilter || quickFilter !== 'all' || busqueda) && (
            <button
              className={styles.topBtn}
              style={{ justifyContent: 'center', width: '100%' }}
              onClick={() => {
                setCategoria('');
                setVersionFilter('');
                setQuickFilter('all');
                setBusqueda('');
                setBuscadorInput('');
                setPage(1);
              }}
            >
              🧹 Limpiar todos los filtros
            </button>
          )}
        </aside>

        {/* ── Catálogo Principal ── */}
        <main>
          <div className={styles.catalogHeader}>
            <div className={styles.catalogCount}>
              {loading
                ? 'Cargando base de datos...'
                : `${data?.total || 0} artículos mostrados`}
              {currentBrand ? ` · ${currentBrand.emoji} ${currentBrand.name}` : ' · 🌐 Todas las marcas'}
              {topicId !== 'all' && currentBrand
                ? ` › ${currentBrand.topics.find(t => t.id === topicId)?.name || topicId}`
                : ''}
            </div>
            {data && data.totalPages > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  className={styles.miniBtn}
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  ◀ Ant
                </button>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  Pág {page} / {data.totalPages}
                </span>
                <button
                  className={styles.miniBtn}
                  disabled={page === data.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Sig ▶
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
              ⏳ Cargando productos...
            </div>
          ) : data?.productos?.length ? (
            <>
              <div className={styles.grid}>
                {data.productos.map(p => (
                  <AdminProductCard
                    key={`${p.groupId}_${p.topicId}_${p.key}`}
                    p={p}
                    onPublish={() => setPublishingProduct(p)}
                    onEdit={() => setEditingProduct(p)}
                    onDelete={() => setDeletingProduct(p)}
                    onExecuteAction={executeAdminAction}
                  />
                ))}
              </div>

              {data.totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={page === 1}
                    onClick={() => {
                      setPage(page - 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    ← Anterior
                  </button>
                  <span>
                    Página <strong>{page}</strong> de <strong>{data.totalPages}</strong>
                  </span>
                  <button
                    className={styles.pageBtn}
                    disabled={page === data.totalPages}
                    onClick={() => {
                      setPage(page + 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                background: '#111319',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '3rem',
                textAlign: 'center',
                color: '#9ca3af',
              }}
            >
              No se encontraron artículos con los filtros actuales.
            </div>
          )}
        </main>
      </div>

      {/* ── Modal Publicar Chuche en Telegram ── */}
      {publishingProduct && data && (
        <PublishProductModal
          product={publishingProduct}
          brands={data.brands}
          allCategories={data.allCategories}
          auth={auth}
          showToast={showToast}
          onClose={() => setPublishingProduct(null)}
          onPublish={async payload => {
            const ok = await executeAdminAction(
              'publish_product',
              payload,
              'Chuche publicada con éxito en Telegram y añadida al inventario'
            );
            if (ok) setPublishingProduct(null);
            return ok;
          }}
        />
      )}

      {/* ── Modal Editar / Reclasificar Producto ── */}
      {editingProduct && data && (
        <EditProductModal
          product={editingProduct}
          brands={data.brands}
          allCategories={data.allCategories}
          auth={auth}
          showToast={showToast}
          onClose={() => setEditingProduct(null)}
          onSave={async payload => {
            const ok = await executeAdminAction(
              'update_product',
              payload,
              'Artículo actualizado correctamente'
            );
            if (ok) setEditingProduct(null);
          }}
        />
      )}

      {/* ── Modal Eliminar Producto ── */}
      {deletingProduct && (
        <DeleteProductModal
          product={deletingProduct}
          onClose={() => setDeletingProduct(null)}
          onConfirm={async (scope, deleteTelegramMsg) => {
            const ok = await executeAdminAction(
              'delete_product',
              {
                groupId: deletingProduct.groupId,
                topicId: deletingProduct.topicId,
                platform: deletingProduct.platform,
                productId: deletingProduct.id,
                scope,
                deleteTelegramMsg,
                botMessageId: deletingProduct.bot_message_id,
              },
              'Artículo eliminado de la base de datos'
            );
            if (ok) setDeletingProduct(null);
          }}
        />
      )}

      {/* ── Modal Gestión de Versiones y Categorías ── */}
      {showTaxonomyModal && data && (
        <TaxonomyModal
          brands={data.brands}
          allCategories={data.allCategories}
          initialGroupId={groupId === 'all' ? '-1003731237376' : groupId}
          initialTopicId={topicId}
          onClose={() => setShowTaxonomyModal(false)}
          onExecuteAction={executeAdminAction}
        />
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  TARJETA DE PRODUCTO CON CONTROLES DE ADMINISTRADOR E HILO DE COMENTARIOS
// ═══════════════════════════════════════════════════════════════════════════
function AdminProductCard({
  p,
  onPublish,
  onEdit,
  onDelete,
  onExecuteAction,
}: {
  p: ProductoAdmin;
  onPublish: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExecuteAction: (action: string, payload: any, msg: string) => Promise<boolean>;
}) {
  const [imgError, setImgError] = useState(false);
  const [editingCmtIndex, setEditingCmtIndex] = useState<number | null>(null);
  const [editCmtUser, setEditCmtUser] = useState('');
  const [editCmtText, setEditCmtText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [newCmtUser, setNewCmtUser] = useState('Xavi');
  const [newCmtText, setNewCmtText] = useState('');

  const badge = PLATFORM_BADGE[p.platform] || { label: p.platform, color: '#666' };
  const displayImage = !imgError && p.image ? p.image : p.image_remote;
  const visibleVersions = p.versiones.filter(v => v && v !== '__todas__');

  const startEditComment = (c: ComentarioItem) => {
    setEditingCmtIndex(c.index);
    setEditCmtUser(c.username);
    setEditCmtText(c.text);
  };

  const saveEditComment = async (idx: number) => {
    const ok = await onExecuteAction(
      'update_comment',
      {
        key: p.key,
        index: idx,
        username: editCmtUser.trim() || 'Usuario',
        text: editCmtText.trim(),
      },
      'Comentario actualizado'
    );
    if (ok) setEditingCmtIndex(null);
  };

  const handleDeleteComment = async (idx: number) => {
    if (!window.confirm('¿Seguro que quieres borrar este comentario?')) return;
    await onExecuteAction(
      'delete_comment',
      { key: p.key, index: idx },
      'Comentario eliminado'
    );
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCmtText.trim()) return;
    const ok = await onExecuteAction(
      'add_comment',
      {
        key: p.key,
        username: newCmtUser.trim() || 'Xavi',
        text: newCmtText.trim(),
      },
      'Comentario añadido'
    );
    if (ok) {
      setNewCmtText('');
      setAddingComment(false);
    }
  };

  return (
    <div className={styles.card}>
      {/* Imagen + Badges */}
      <div className={styles.cardImg}>
        {displayImage ? (
          <img
            src={displayImage}
            alt={p.title}
            onError={e => {
              if (displayImage !== p.image_remote && p.image_remote) {
                (e.target as HTMLImageElement).src = p.image_remote;
              } else {
                setImgError(true);
              }
            }}
            loading="lazy"
          />
        ) : (
          <div className={styles.cardImgPlaceholder}>
            <span style={{ fontSize: '1.8rem' }}>🖼️</span>
            <span>Sin imagen</span>
          </div>
        )}
        <span className={styles.platformBadge} style={{ background: badge.color }}>
          {badge.label}
        </span>
        <div className={styles.locationBadge}>
          <span>
            {p.brandEmoji} {p.groupName.replace(/ chuches$/i, '')} › <strong>{p.topicName}</strong>
          </span>
          <span style={{ opacity: 0.7 }}>#{p.id.slice(-6)}</span>
        </div>
      </div>

      {/* Cuerpo */}
      <div className={styles.cardBody}>
        {/* Categorías y Versiones */}
        <div className={styles.tagsRow}>
          {p.categorias.length > 0 ? (
            p.categorias.map(c => (
              <span key={c} className={styles.catTag}>
                📁 {c}
              </span>
            ))
          ) : (
            <span className={styles.noCatTag}>⚠️ Sin categoría</span>
          )}
          {visibleVersions.length > 0 ? (
            visibleVersions.map(v => (
              <span key={v} className={styles.verTag}>
                🚗 {v}
              </span>
            ))
          ) : p.isAllVersionsConfirmed ? (
            <span className={styles.verTag} style={{ opacity: 0.85 }}>
              🚗 Todas las versiones
            </span>
          ) : null}
          {p.backup_links && p.backup_links.length > 0 && (
            <span
              className={styles.catTag}
              style={{
                background: 'rgba(16, 185, 129, 0.16)',
                color: '#34d399',
                borderColor: 'rgba(16, 185, 129, 0.35)',
              }}
              title="Este artículo tiene enlaces alternativos de reserva guardados"
            >
              🔗 +{p.backup_links.length} link reserva
            </span>
          )}
          {p.link_status === 'broken' && (
            <span
              className={styles.noCatTag}
              title="No devuelto en el programa de afiliados de AliExpress o sin stock"
            >
              🚨 Revisar link / stock
            </span>
          )}
        </div>

        <h3 className={styles.cardTitle} title={p.title}>
          {p.title}
        </h3>

        <div className={styles.metaRow}>
          <span>
            ⭐ <strong>{p.recommendations}</strong> rec. ({p.votes} votos)
          </span>
          {p.sale_price && <span className={styles.priceNew}>{p.sale_price}</span>}
        </div>

        {/* Gestión de Comentarios integrada en la tarjeta */}
        <div className={styles.commentsBox}>
          <div className={styles.commentHeader}>
            <span>💬 Comentarios ({p.comentarios.length})</span>
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => setAddingComment(!addingComment)}
            >
              {addingComment ? '✖ Cerrar' : '➕ Añadir'}
            </button>
          </div>

          {addingComment && (
            <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <input
                type="text"
                className={styles.input}
                style={{ padding: '0.35rem 0.55rem', fontSize: '0.76rem' }}
                placeholder="Usuario (ej. Xavi)"
                value={newCmtUser}
                onChange={e => setNewCmtUser(e.target.value)}
              />
              <textarea
                className={styles.input}
                style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem', minHeight: '52px' }}
                placeholder="Escribe el comentario..."
                value={newCmtText}
                onChange={e => setNewCmtText(e.target.value)}
              />
              <button type="submit" className={styles.btnEdit} style={{ padding: '0.3rem' }}>
                💾 Guardar comentario
              </button>
            </form>
          )}

          {p.comentarios.map(c => (
            <div key={c.index} className={styles.commentItem}>
              {editingCmtIndex === c.index ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <input
                    type="text"
                    className={styles.input}
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                    value={editCmtUser}
                    onChange={e => setEditCmtUser(e.target.value)}
                  />
                  <textarea
                    className={styles.input}
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.76rem', minHeight: '48px' }}
                    value={editCmtText}
                    onChange={e => setEditCmtText(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className={styles.miniBtn}
                      onClick={() => setEditingCmtIndex(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={styles.miniBtn}
                      style={{ background: '#00e5ff', color: '#000', fontWeight: 700 }}
                      onClick={() => saveEditComment(c.index)}
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.commentTop}>
                    <span className={styles.commentUser}>@{c.username}</span>
                    <div className={styles.commentBtns}>
                      <button
                        type="button"
                        className={styles.miniBtn}
                        onClick={() => startEditComment(c)}
                        title="Editar comentario"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className={`${styles.miniBtn} ${styles.miniBtnDanger}`}
                        onClick={() => handleDeleteComment(c.index)}
                        title="Borrar comentario"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div style={{ color: '#e5e7eb', wordBreak: 'break-word' }}>{c.text}</div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Botones de Acción */}
        <div className={styles.cardFooter}>
          <div className={styles.adminBtnsRow}>
            <button
              type="button"
              className={styles.btnPublish}
              onClick={onPublish}
              title="Publicar esta chuche en Telegram y añadirla al catálogo"
            >
              📢 Publicar
            </button>
            <button type="button" className={styles.btnEdit} onClick={onEdit}>
              ✏️ Editar / Mover
            </button>
            {p.affiliate_url && (
              <a
                href={p.affiliate_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnTestLink}
                title="Probar si el enlace funciona"
              >
                🔗 Probar
              </a>
            )}
            <button
              type="button"
              className={styles.btnDelete}
              onClick={onDelete}
              title="Eliminar chuche"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MODAL DE EDICIÓN Y RECLASIFICACIÓN DE UN ARTÍCULO
// ═══════════════════════════════════════════════════════════════════════════
function EditProductModal({
  product,
  brands,
  allCategories,
  auth,
  showToast,
  onClose,
  onSave,
}: {
  product: ProductoAdmin;
  brands: BrandSummary[];
  allCategories: string[];
  auth: { user: string; pass: string } | null;
  showToast: (msg: string) => void;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
}) {
  const [title, setTitle] = useState(product.title);
  const [affiliateUrl, setAffiliateUrl] = useState(product.affiliate_url);
  const [rawImage, setRawImage] = useState(product.rawImage);
  const [salePrice, setSalePrice] = useState(product.sale_price || '');
  const [baseRecs, setBaseRecs] = useState(String(product.base_recommendations));
  const [targetGroupId, setTargetGroupId] = useState(product.groupId);
  const [targetTopicId, setTargetTopicId] = useState(product.topicId);
  const [moveMode, setMoveMode] = useState<'move' | 'copy'>('move');
  const [selectedCats, setSelectedCats] = useState<string[]>(product.categorias);
  const [newCatInput, setNewCatInput] = useState('');
  const [selectedVers, setSelectedVers] = useState<string[]>(
    product.versiones.filter(v => v !== '__todas__')
  );
  const [newVerInput, setNewVerInput] = useState('');
  const [backupLinks, setBackupLinks] = useState<BackupLinkItem[]>(product.backup_links || []);
  const [newBackupUrl, setNewBackupUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingApi, setLoadingApi] = useState<'all' | 'title' | 'price' | 'image' | null>(null);

  const selectedBrandObj = brands.find(b => b.id === targetGroupId);
  const availableTopics = selectedBrandObj?.topics || [];
  const selectedTopicObj = availableTopics.find(t => t.id === targetTopicId);

  const handleFetchApi = async (field: 'all' | 'title' | 'price' | 'image') => {
    if (!auth) {
      showToast('❌ Sesión expirada. Vuelve a iniciar sesión.');
      return;
    }
    setLoadingApi(field);
    try {
      const res = await fetch('/api/chuches/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': auth.user,
          'x-admin-pass': auth.pass,
        },
        body: JSON.stringify({
          action: 'fetch_product_api',
          productId: product.id,
          platform: product.platform,
          url: affiliateUrl || product.affiliate_url,
          groupName: selectedBrandObj?.name || product.groupId,
          topicName: selectedTopicObj?.name || product.topicId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        showToast(`❌ ${json.error || 'No se pudieron recuperar datos de la API'}`);
        return;
      }

      const data = json.data;
      if (!data) {
        showToast('⚠️ La API no devolvió información para este artículo');
        return;
      }

      let updatedCount = 0;

      if ((field === 'all' || field === 'title') && data.title) {
        setTitle(data.title);
        updatedCount++;
      }
      if ((field === 'all' || field === 'price') && data.sale_price) {
        setSalePrice(data.sale_price);
        updatedCount++;
      }
      if ((field === 'all' || field === 'image') && data.image) {
        setRawImage(data.image);
        updatedCount++;
      }

      if (field === 'all') {
        showToast(`✅ ${updatedCount} datos recuperados correctamente de la API`);
      } else if (field === 'title') {
        showToast(data.title ? '✅ Título recuperado de la API' : '⚠️ No se encontró título en la API');
      } else if (field === 'price') {
        showToast(data.sale_price ? `✅ Precio recuperado: ${data.sale_price}` : '⚠️ No se encontró precio en la API');
      } else if (field === 'image') {
        showToast(data.image ? '✅ Imagen recuperada y lista' : '⚠️ No se encontró imagen en la API');
      }
    } catch (e: any) {
      showToast(`❌ Error al conectar con la API: ${e.message}`);
    } finally {
      setLoadingApi(null);
    }
  };

  const previewImg = rawImage
    ? (rawImage.startsWith('http://') || rawImage.startsWith('https://') || rawImage.startsWith('/')
        ? rawImage
        : `/${rawImage}`)
    : null;

  // Cuando cambia la marca destino, seleccionar su primer topic por defecto si el actual no existe
  const handleBrandChange = (newGid: string) => {
    setTargetGroupId(newGid);
    const bObj = brands.find(b => b.id === newGid);
    if (bObj && bObj.topics.length > 0) {
      const exists = bObj.topics.some(t => t.id === targetTopicId);
      if (!exists) {
        setTargetTopicId(bObj.topics[0].id);
      }
    }
  };

  const allCatsPool = Array.from(new Set([...allCategories, ...selectedCats])).sort((a, b) =>
    a.localeCompare(b, 'es')
  );

  const allVersPool = Array.from(
    new Set([...(selectedTopicObj?.versiones || []), ...selectedVers])
  ).sort();

  const toggleCat = (cat: string) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCustomCat = () => {
    const val = newCatInput.trim();
    if (!val) return;
    if (!selectedCats.includes(val)) {
      setSelectedCats(prev => [...prev, val]);
    }
    setNewCatInput('');
  };

  const toggleVer = (ver: string) => {
    setSelectedVers(prev =>
      prev.includes(ver) ? prev.filter(v => v !== ver) : [...prev, ver]
    );
  };

  const handleAddCustomVer = () => {
    const val = newVerInput.trim();
    if (!val) return;
    if (!selectedVers.includes(val)) {
      setSelectedVers(prev => [...prev, val]);
    }
    setNewVerInput('');
  };

  const isLocationChanged =
    targetGroupId !== product.groupId || targetTopicId !== product.topicId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      sourceGroupId: product.groupId,
      sourceTopicId: product.topicId,
      targetGroupId,
      targetTopicId,
      TargetTopicName: selectedTopicObj?.name || targetTopicId,
      moveMode,
      platform: product.platform,
      productId: product.id,
      updates: {
        title: title.trim(),
        affiliate_url: affiliateUrl.trim(),
        image: rawImage.trim(),
        sale_price: salePrice.trim() || null,
        recommendations: Math.max(0, parseInt(baseRecs) || 0),
        categorias: selectedCats,
        versiones: selectedVers.length > 0 ? selectedVers : ['__todas__'],
        backup_links: backupLinks,
        link_status: 'active',
      },
    });
    setSaving(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>✏️ Editar / Reclasificar Chuche</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          {/* Ubicación: Marca y Modelo/Topic */}
          <div
            style={{
              background: 'rgba(0, 229, 255, 0.06)',
              border: '1px solid rgba(0, 229, 255, 0.22)',
              borderRadius: '12px',
              padding: '0.85rem',
            }}
          >
            <div className={styles.fieldLabel} style={{ color: '#00e5ff', marginBottom: '0.55rem' }}>
              📍 Ubicación (Marca y Modelo / Sección)
            </div>
            <div className={styles.formGrid2}>
              <div>
                <label className={styles.fieldLabel}>Marca (Grupo)</label>
                <select
                  className={styles.select}
                  value={targetGroupId}
                  onChange={e => handleBrandChange(e.target.value)}
                >
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.emoji} {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.fieldLabel}>Modelo / Topic</label>
                <select
                  className={styles.select}
                  value={targetTopicId}
                  onChange={e => setTargetTopicId(e.target.value)}
                >
                  {availableTopics.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLocationChanged && (
              <div style={{ marginTop: '0.65rem', display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.83rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={moveMode === 'move'}
                    onChange={() => setMoveMode('move')}
                  />
                  <span>🔄 <strong>Mover</strong> (quitar del modelo origen y pasar al nuevo)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={moveMode === 'copy'}
                    onChange={() => setMoveMode('copy')}
                  />
                  <span>📋 <strong>Copiar</strong> (mantener en ambos modelos)</span>
                </label>
              </div>
            )}
          </div>

          {/* Banner de Auto-recuperación API */}
          <div className={styles.apiMasterBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.3rem' }}>⚡</span>
              <div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#00e5ff' }}>
                  Recuperación Inteligente vía API ({product.platform.toUpperCase()})
                </div>
                <div style={{ fontSize: '0.74rem', color: '#9ca3af' }}>
                  Descarga el título oficial, el precio actual y la imagen en alta resolución
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.apiMasterBtn}
              onClick={() => handleFetchApi('all')}
              disabled={loadingApi !== null}
            >
              {loadingApi === 'all' ? '⏳ Consultando API...' : '⚡ Auto-recuperar todo'}
            </button>
          </div>

          {/* Título */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className={styles.fieldLabel} style={{ marginBottom: 0 }}>Título del artículo</label>
              <button
                type="button"
                className={styles.apiFieldBtn}
                onClick={() => handleFetchApi('title')}
                disabled={loadingApi !== null}
                title="Recuperar título oficial de la API"
              >
                {loadingApi === 'title' ? '⏳...' : '📝 Rellenar con API'}
              </button>
            </div>
            <input
              type="text"
              className={styles.input}
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Enlace de afiliado + botón Probar */}
          <div>
            <label className={styles.fieldLabel}>Enlace de afiliado ({product.platform})</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="url"
                className={styles.input}
                value={affiliateUrl}
                onChange={e => setAffiliateUrl(e.target.value)}
              />
              {affiliateUrl && (
                <a
                  href={affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.btnTestLink}
                  style={{ whiteSpace: 'nowrap', padding: '0 0.9rem' }}
                >
                  🔗 Probar enlace
                </a>
              )}
            </div>

            {/* Enlaces de reserva (backup_links) */}
            <div
              style={{
                marginTop: '0.6rem',
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.22)',
                borderRadius: '10px',
                padding: '0.65rem',
              }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', marginBottom: '0.4rem' }}>
                🔗 Enlaces de reserva ({backupLinks.length}) — Si cae el principal se usa uno de estos
              </div>
              {backupLinks.map((b, bIdx) => (
                <div
                  key={bIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginBottom: '0.35rem',
                    fontSize: '0.76rem',
                  }}
                >
                  <input
                    type="text"
                    className={styles.input}
                    style={{ padding: '0.28rem 0.5rem', fontSize: '0.75rem', flex: 1 }}
                    value={b.affiliate_url}
                    readOnly
                  />
                  {b.sale_price && (
                    <span style={{ color: '#00e5ff', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {b.sale_price}
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.miniBtn}
                    style={{ background: '#10b981', color: '#000', fontWeight: 700, whiteSpace: 'nowrap' }}
                    onClick={() => {
                      const prevPrimary = affiliateUrl;
                      setAffiliateUrl(b.affiliate_url);
                      if (b.sale_price && !salePrice) setSalePrice(b.sale_price);
                      const nextBackups = [...backupLinks];
                      nextBackups[bIdx] = {
                        ...b,
                        affiliate_url: prevPrimary,
                      };
                      setBackupLinks(nextBackups);
                    }}
                    title="Poner este link como principal y pasar el actual a reserva"
                  >
                    🔄 Usar principal
                  </button>
                  <a
                    href={b.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.miniBtn}
                    style={{ textDecoration: 'none' }}
                    title="Probar este link de reserva"
                  >
                    🔗
                  </a>
                  <button
                    type="button"
                    className={`${styles.miniBtn} ${styles.miniBtnDanger}`}
                    onClick={() => setBackupLinks(prev => prev.filter((_, i) => i !== bIdx))}
                    title="Quitar link de reserva"
                  >
                    🗑️
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                <input
                  type="url"
                  className={styles.input}
                  style={{ padding: '0.3rem 0.55rem', fontSize: '0.76rem', flex: 1 }}
                  placeholder="Añadir otro link alternativo de reserva (https://...)"
                  value={newBackupUrl}
                  onChange={e => setNewBackupUrl(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.miniBtn}
                  onClick={() => {
                    const u = newBackupUrl.trim();
                    if (!u) return;
                    setBackupLinks(prev => [...prev, { affiliate_url: u }]);
                    setNewBackupUrl('');
                  }}
                >
                  ➕ Guardar reserva
                </button>
              </div>
            </div>
          </div>

          {/* Precio, Recomendaciones e Imagen */}
          <div className={styles.formGrid2}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label className={styles.fieldLabel} style={{ marginBottom: 0 }}>Precio (ej. 19,99 €)</label>
                <button
                  type="button"
                  className={styles.apiFieldBtn}
                  onClick={() => handleFetchApi('price')}
                  disabled={loadingApi !== null}
                  title="Recuperar precio actual de la API"
                >
                  {loadingApi === 'price' ? '⏳...' : '💶 Rellenar con API'}
                </button>
              </div>
              <input
                type="text"
                className={styles.input}
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className={styles.fieldLabel}>⭐ Recomendaciones base</label>
              <input
                type="number"
                className={styles.input}
                value={baseRecs}
                onChange={e => setBaseRecs(e.target.value)}
                min={0}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className={styles.fieldLabel} style={{ marginBottom: 0 }}>Ruta o URL de Imagen</label>
              <button
                type="button"
                className={styles.apiFieldBtn}
                onClick={() => handleFetchApi('image')}
                disabled={loadingApi !== null}
                title="Descargar imagen en alta resolución de la API"
              >
                {loadingApi === 'image' ? '⏳ Descargando...' : '🖼️ Descargar de API'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
              {previewImg ? (
                <div className={styles.imgPreviewThumb} title="Vista previa de imagen">
                  <img
                    src={previewImg}
                    alt="Preview"
                    onError={e => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : null}
              <input
                type="text"
                className={styles.input}
                value={rawImage}
                onChange={e => setRawImage(e.target.value)}
                placeholder="img/Marca/Modelo/archivo.jpg o https://..."
                style={{ flex: 1 }}
              />
            </div>
          </div>

          {/* Categorías */}
          <div>
            <label className={styles.fieldLabel}>
              📁 Categorías seleccionadas ({selectedCats.length})
            </label>
            <div className={styles.chipsWrap}>
              {allCatsPool.map(cat => {
                const active = selectedCats.includes(cat);
                return (
                  <button
                    type="button"
                    key={cat}
                    className={`${styles.chip} ${active ? styles.chipSelected : ''}`}
                    onClick={() => toggleCat(cat)}
                  >
                    {active ? '✓ ' : ''}
                    {cat}
                  </button>
                );
              })}
            </div>
            <div className={styles.inlineAddRow}>
              <input
                type="text"
                className={styles.input}
                placeholder="Nueva categoría..."
                value={newCatInput}
                onChange={e => setNewCatInput(e.target.value)}
              />
              <button
                type="button"
                className={styles.topBtn}
                onClick={handleAddCustomCat}
              >
                ➕ Añadir
              </button>
            </div>
          </div>

          {/* Versiones */}
          <div>
            <label className={styles.fieldLabel}>
              🚗 Versiones compatibles ({selectedVers.length === 0 ? 'Vale para todas' : selectedVers.join(', ')})
            </label>
            <div className={styles.chipsWrap}>
              <button
                type="button"
                className={`${styles.chip} ${selectedVers.length === 0 ? styles.chipSelected : ''}`}
                onClick={() => setSelectedVers([])}
              >
                {selectedVers.length === 0 ? '✓ ' : ''}🌐 Todas las versiones (__todas__)
              </button>
              {allVersPool.map(ver => {
                const active = selectedVers.includes(ver);
                return (
                  <button
                    type="button"
                    key={ver}
                    className={`${styles.chip} ${active ? styles.chipSelected : ''}`}
                    onClick={() => toggleVer(ver)}
                  >
                    {active ? '✓ ' : ''}
                    {ver}
                  </button>
                );
              })}
            </div>
            <div className={styles.inlineAddRow}>
              <input
                type="text"
                className={styles.input}
                placeholder="Añadir versión específica (ej. Highland 2024+)..."
                value={newVerInput}
                onChange={e => setNewVerInput(e.target.value)}
              />
              <button
                type="button"
                className={styles.topBtn}
                onClick={handleAddCustomVer}
              >
                ➕ Añadir
              </button>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? 'Guardando...' : '💾 Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MODAL DE PUBLICACIÓN EN TELEGRAM E INVENTARIO
// ═══════════════════════════════════════════════════════════════════════════
function PublishProductModal({
  product,
  brands,
  allCategories,
  auth,
  showToast,
  onClose,
  onPublish,
}: {
  product: ProductoAdmin;
  brands: BrandSummary[];
  allCategories: string[];
  auth: { user: string; pass: string } | null;
  showToast: (msg: string) => void;
  onClose: () => void;
  onPublish: (payload: any) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(product.title);
  const [affiliateUrl, setAffiliateUrl] = useState(product.affiliate_url);
  const [rawImage, setRawImage] = useState(product.rawImage);
  const [imageRemote, setImageRemote] = useState(product.image_remote || '');
  const [salePrice, setSalePrice] = useState(product.sale_price || '');
  const [originalPrice, setOriginalPrice] = useState(product.original_price || '');
  const [discount, setDiscount] = useState(product.discount || '');

  // Si el producto está en Chuches EV general, por defecto sugerir Tesla (o la primera marca disponible)
  const isFromChuchesGeneral = product.groupId === '-1002517190518';
  const initialGid = isFromChuchesGeneral ? '-1003731237376' : product.groupId;
  const [targetGroupId, setTargetGroupId] = useState(initialGid);

  // Topics de la marca seleccionada
  const selectedBrandObj = brands.find(b => b.id === targetGroupId) || brands[0];
  const availableTopics = selectedBrandObj?.topics || [];

  const initialTid = availableTopics.some(t => t.id === product.topicId)
    ? product.topicId
    : (availableTopics[0]?.id || '0');
  const [targetTopicId, setTargetTopicId] = useState(initialTid);

  const selectedTopicObj = availableTopics.find(t => t.id === targetTopicId);

  const [selectedCats, setSelectedCats] = useState<string[]>(product.categorias);
  const [newCatInput, setNewCatInput] = useState('');
  const [selectedVers, setSelectedVers] = useState<string[]>(
    product.versiones.filter(v => v !== '__todas__')
  );
  const [removeFromSource, setRemoveFromSource] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [loadingApi, setLoadingApi] = useState<'all' | 'title' | 'price' | 'image' | null>(null);

  const handleBrandChange = (newGid: string) => {
    setTargetGroupId(newGid);
    const bObj = brands.find(b => b.id === newGid);
    if (bObj && bObj.topics.length > 0) {
      setTargetTopicId(bObj.topics[0].id);
      setSelectedVers([]); // Reiniciar versiones al cambiar de marca
    }
  };

  const handleFetchApi = async (field: 'all' | 'title' | 'price' | 'image') => {
    if (!auth) {
      showToast('❌ Sesión expirada. Vuelve a iniciar sesión.');
      return;
    }
    setLoadingApi(field);
    try {
      const res = await fetch('/api/chuches/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user': auth.user,
          'x-admin-pass': auth.pass,
        },
        body: JSON.stringify({
          action: 'fetch_product_api',
          productId: product.id,
          platform: product.platform,
          url: affiliateUrl || product.affiliate_url,
          groupName: selectedBrandObj?.name || product.groupId,
          topicName: selectedTopicObj?.name || product.topicId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        showToast(`❌ ${json.error || 'No se pudieron recuperar datos de la API'}`);
        return;
      }
      const data = json.data;
      if (!data) {
        showToast('⚠️ La API no devolvió información para este artículo');
        return;
      }

      if ((field === 'all' || field === 'title') && data.title) setTitle(data.title);
      if ((field === 'all' || field === 'price') && data.sale_price) setSalePrice(data.sale_price);
      if (data.original_price) setOriginalPrice(data.original_price);
      if (data.discount) setDiscount(data.discount);
      if ((field === 'all' || field === 'image') && data.image) {
        setRawImage(data.image);
        if (data.remote_image) setImageRemote(data.remote_image);
      }
      showToast('✅ Datos recuperados de la API');
    } catch (e: any) {
      showToast(`❌ Error al conectar con la API: ${e.message}`);
    } finally {
      setLoadingApi(null);
    }
  };

  const toggleCat = (cat: string) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCustomCat = () => {
    const val = newCatInput.trim();
    if (!val) return;
    if (!selectedCats.includes(val)) {
      setSelectedCats(prev => [...prev, val]);
    }
    setNewCatInput('');
  };

  const toggleVer = (ver: string) => {
    setSelectedVers(prev =>
      prev.includes(ver) ? prev.filter(v => v !== ver) : [...prev, ver]
    );
  };

  const allCatsPool = Array.from(new Set([...allCategories, ...selectedCats])).sort((a, b) =>
    a.localeCompare(b, 'es')
  );

  const availableTopicVers = selectedTopicObj?.versiones || [];

  const previewImg = rawImage
    ? (rawImage.startsWith('http://') || rawImage.startsWith('https://') || rawImage.startsWith('/')
        ? rawImage
        : `/${rawImage}`)
    : (imageRemote || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('⚠️ Debes indicar un título para publicar');
      return;
    }
    if (!targetGroupId || !targetTopicId) {
      showToast('⚠️ Debes seleccionar una marca y un topic de destino');
      return;
    }

    setPublishing(true);
    try {
      const payload = {
        sourceGroupId: product.groupId,
        sourceTopicId: product.topicId,
        targetGroupId,
        targetTopicId,
        targetTopicName: selectedTopicObj?.name || targetTopicId,
        targetGroupName: selectedBrandObj?.name || targetGroupId,
        platform: product.platform,
        productId: product.id,
        removeFromSource,
        updates: {
          title: title.trim(),
          affiliate_url: affiliateUrl.trim(),
          image: rawImage,
          image_remote: imageRemote || null,
          sale_price: salePrice.trim() || null,
          original_price: originalPrice.trim() || null,
          discount: discount.trim() || null,
          categorias: selectedCats,
          versiones: selectedVers.length > 0 ? selectedVers : ['__todas__'],
          recommendations: product.recommendations,
        },
      };

      await onPublish(payload);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>📢 Publicar Chuche en Telegram e Inventario</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Tarjeta de previsualización compacta */}
          <div className={styles.previewPublishCard}>
            {previewImg ? (
              <img src={previewImg} alt={title} className={styles.previewPublishImg} />
            ) : (
              <div className={styles.previewPublishImg} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🖼️
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                <span className={styles.platformBadge} style={{ position: 'static' }}>
                  {product.platform.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>ID: {product.id}</span>
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title || 'Sin título'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 700, marginTop: '0.2rem' }}>
                {salePrice ? `🔥 ${salePrice}` : '⚠️ Sin precio indicado'}
              </div>
            </div>
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => handleFetchApi('all')}
              disabled={loadingApi !== null}
              title="Buscar título, precio e imagen automáticamente con la API"
            >
              {loadingApi === 'all' ? '⏳ Buscando...' : '⚡ Rellenar con API'}
            </button>
          </div>

          {/* Destino de la publicación */}
          <div style={{ background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)', borderRadius: '12px', padding: '0.9rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '0.65rem' }}>
              🎯 Destino de la Publicación (Canal y Topic de Telegram)
            </div>
            <div className={styles.formGrid2}>
              <div>
                <label className={styles.fieldLabel}>🚗 Marca / Grupo de Telegram</label>
                <select
                  className={styles.select}
                  value={targetGroupId}
                  onChange={e => handleBrandChange(e.target.value)}
                >
                  {brands
                    .filter(b => b.id !== '-1002517190518') // Excluir ChuchesEV general como destino
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {b.emoji} {b.name} ({b.topics.length} topics)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className={styles.fieldLabel}>📌 Topic / Modelo dentro del grupo</label>
                <select
                  className={styles.select}
                  value={targetTopicId}
                  onChange={e => setTargetTopicId(e.target.value)}
                >
                  {availableTopics.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.count} chuches)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Título y Enlace */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label className={styles.fieldLabel} style={{ margin: 0 }}>📝 Título del Producto (Caption Telegram)</label>
              <button
                type="button"
                className={styles.miniBtn}
                onClick={() => handleFetchApi('title')}
                disabled={loadingApi !== null}
                title="Actualizar sólo título con la API"
              >
                {loadingApi === 'title' ? '⏳...' : '⚡ API Título'}
              </button>
            </div>
            <input
              type="text"
              className={styles.input}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Alfombrillas Todo Tiempo de Goma Premium"
              required
            />
          </div>

          {/* Precio y Enlace */}
          <div className={styles.formGrid2}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className={styles.fieldLabel} style={{ margin: 0 }}>💶 Precio Venta</label>
                <button
                  type="button"
                  className={styles.miniBtn}
                  onClick={() => handleFetchApi('price')}
                  disabled={loadingApi !== null}
                  title="Buscar precio con la API"
                >
                  {loadingApi === 'price' ? '⏳...' : '⚡ API Precio'}
                </button>
              </div>
              <input
                type="text"
                className={styles.input}
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
                placeholder="Ej: 39,99 €"
              />
            </div>

            <div>
              <label className={styles.fieldLabel}>🔗 Enlace de Afiliado</label>
              <input
                type="url"
                className={styles.input}
                value={affiliateUrl}
                onChange={e => setAffiliateUrl(e.target.value)}
                placeholder="https://..."
                required
              />
            </div>
          </div>

          {/* Categoría para el botón inline de Telegram */}
          <div>
            <label className={styles.fieldLabel}>🗂️ Categoría (se creará el botón inline oficial)</label>
            <div className={styles.chipsWrap}>
              {allCatsPool.map(c => {
                const isSel = selectedCats.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.chip} ${isSel ? styles.chipSelected : ''}`}
                    onClick={() => toggleCat(c)}
                  >
                    {isSel ? '✓ ' : ''}{c}
                  </button>
                );
              })}
            </div>
            <div className={styles.inlineAddRow}>
              <input
                type="text"
                className={styles.input}
                placeholder="Nueva categoría..."
                value={newCatInput}
                onChange={e => setNewCatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomCat();
                  }
                }}
              />
              <button
                type="button"
                className={styles.miniBtn}
                onClick={handleAddCustomCat}
              >
                ➕ Añadir
              </button>
            </div>
          </div>

          {/* Versiones (si el topic tiene versiones disponibles configuradas) */}
          {availableTopicVers.length > 0 && (
            <div>
              <label className={styles.fieldLabel}>
                🚗 Versión Compatible ({selectedTopicObj?.name})
              </label>
              <div className={styles.chipsWrap} style={{ maxHeight: '110px' }}>
                {availableTopicVers.map(v => {
                  const isSel = selectedVers.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      className={`${styles.chip} ${isSel ? styles.chipSelected : ''}`}
                      onClick={() => toggleVer(v)}
                    >
                      {isSel ? '✓ ' : ''}{v}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                💡 Si no marcas ninguna versión específica, se considerará universal para todas las versiones.
              </div>
            </div>
          )}

          {/* Checkbox de origen */}
          <div style={{ background: '#11141c', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.85rem', color: '#e5e7eb' }}>
              <input
                type="checkbox"
                checked={removeFromSource}
                onChange={e => setRemoveFromSource(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#10b981' }}
              />
              <span>
                <strong>Quitar del origen actual</strong> ({product.groupName} › {product.topicName}) al publicar
              </span>
            </label>
          </div>

          {/* Footer de Acciones */}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose} disabled={publishing}>
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnPublishSubmit}
              disabled={publishing || !targetGroupId || !targetTopicId}
            >
              {publishing ? '⏳ Publicando en Telegram...' : '🚀 Publicar en Telegram e Inventario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MODAL DE CONFIRMACIÓN DE BORRADO
// ═══════════════════════════════════════════════════════════════════════════
function DeleteProductModal({
  product,
  onClose,
  onConfirm,
}: {
  product: ProductoAdmin;
  onClose: () => void;
  onConfirm: (scope: 'topic' | 'brand' | 'all', deleteTelegramMsg: boolean) => Promise<void>;
}) {
  const [scope, setScope] = useState<'topic' | 'brand' | 'all'>('topic');
  const [deleteTg, setDeleteTg] = useState(Boolean(product.bot_message_id));
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm(scope, deleteTg);
    setDeleting(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalCard}
        style={{ maxWidth: '480px' }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>🗑️ Eliminar Artículo</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.45 }}>
          ¿Seguro que quieres eliminar <strong>{product.title}</strong> ({product.platform} #{product.id})?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.3rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem' }}>
            <input
              type="radio"
              checked={scope === 'topic'}
              onChange={() => setScope('topic')}
            />
            <span>
              Borrar de <strong>{product.topicName}</strong> ({product.groupName})
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem' }}>
            <input
              type="radio"
              checked={scope === 'brand'}
              onChange={() => setScope('brand')}
            />
            <span>
              Borrar de todos los modelos de <strong>{product.groupName}</strong>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem' }}>
            <input
              type="radio"
              checked={scope === 'all'}
              onChange={() => setScope('all')}
            />
            <span>Borrar de toda la base de datos (todas las marcas)</span>
          </label>
        </div>

        {product.bot_message_id && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(227, 25, 55, 0.1)',
              border: '1px solid rgba(227, 25, 55, 0.3)',
              padding: '0.65rem',
              borderRadius: '10px',
              fontSize: '0.83rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={deleteTg}
              onChange={e => setDeleteTg(e.target.checked)}
            />
            <span>
              ✈️ Borrar también el mensaje publicado en el grupo de Telegram (ID #{product.bot_message_id})
            </span>
          </label>
        )}

        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnDangerConfirm}
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? 'Eliminando...' : '🗑️ Sí, Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MODAL PARA LIMPIAR / GESTIONAR VERSIONES Y CATEGORÍAS GLOBALES
// ═══════════════════════════════════════════════════════════════════════════
function TaxonomyModal({
  brands,
  allCategories,
  initialGroupId,
  initialTopicId,
  onClose,
  onExecuteAction,
}: {
  brands: BrandSummary[];
  allCategories: string[];
  initialGroupId: string;
  initialTopicId: string;
  onClose: () => void;
  onExecuteAction: (action: string, payload: any, msg: string) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<'versions' | 'categories'>('versions');
  const [selGid, setSelGid] = useState(initialGroupId);
  const currentBrand = brands.find(b => b.id === selGid) || brands[0];
  const [selTid, setSelTid] = useState(
    initialTopicId !== 'all' && currentBrand?.topics.some(t => t.id === initialTopicId)
      ? initialTopicId
      : currentBrand?.topics[0]?.id || ''
  );
  const [newVer, setNewVer] = useState('');
  const [newCat, setNewCat] = useState('');

  const currentTopic = currentBrand?.topics.find(t => t.id === selTid);
  const topicVersions = currentTopic?.versiones || [];

  const handleBrandChange = (gid: string) => {
    setSelGid(gid);
    const b = brands.find(x => x.id === gid);
    setSelTid(b?.topics[0]?.id || '');
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>⚙️ Gestionar Versiones y Categorías</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={`${styles.topBtn} ${tab === 'versions' ? styles.topBtnPrimary : ''}`}
            onClick={() => setTab('versions')}
          >
            🚗 Versiones por Modelo
          </button>
          <button
            type="button"
            className={`${styles.topBtn} ${tab === 'categories' ? styles.topBtnPrimary : ''}`}
            onClick={() => setTab('categories')}
          >
            📁 Categorías Globales ({allCategories.length})
          </button>
        </div>

        {tab === 'versions' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className={styles.formGrid2}>
              <div>
                <label className={styles.fieldLabel}>Marca</label>
                <select
                  className={styles.select}
                  value={selGid}
                  onChange={e => handleBrandChange(e.target.value)}
                >
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.emoji} {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.fieldLabel}>Modelo / Topic</label>
                <select
                  className={styles.select}
                  value={selTid}
                  onChange={e => setSelTid(e.target.value)}
                >
                  {currentBrand?.topics.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={styles.fieldLabel}>
                Versiones de {currentTopic?.name || 'este modelo'} ({topicVersions.length})
              </label>
              {topicVersions.length === 0 ? (
                <p style={{ fontSize: '0.84rem', color: '#9ca3af' }}>
                  Este modelo no tiene versiones específicas configuradas.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '240px', overflowY: 'auto' }}>
                  {topicVersions.map(v => (
                    <div
                      key={v}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#0b0d13',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>🚗 {v}</span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          className={styles.miniBtn}
                          onClick={async () => {
                            const nuevo = window.prompt(`Nuevo nombre para la versión "${v}":`, v);
                            if (nuevo && nuevo.trim() && nuevo.trim() !== v) {
                              await onExecuteAction(
                                'manage_versions',
                                {
                                  groupId: selGid,
                                  topicId: selTid,
                                  op: 'rename',
                                  versionName: v,
                                  newVersionName: nuevo.trim(),
                                },
                                `Versión renombrada a "${nuevo.trim()}"`
                              );
                            }
                          }}
                        >
                          ✏️ Renombrar
                        </button>
                        <button
                          type="button"
                          className={`${styles.miniBtn} ${styles.miniBtnDanger}`}
                          onClick={async () => {
                            if (window.confirm(`¿Eliminar la versión "${v}" de este modelo?`)) {
                              await onExecuteAction(
                                'manage_versions',
                                {
                                  groupId: selGid,
                                  topicId: selTid,
                                  op: 'delete',
                                  versionName: v,
                                },
                                `Versión "${v}" eliminada`
                              );
                            }
                          }}
                        >
                          🗑️ Quitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.inlineAddRow}>
              <input
                type="text"
                className={styles.input}
                placeholder="Nueva versión para este modelo..."
                value={newVer}
                onChange={e => setNewVer(e.target.value)}
              />
              <button
                type="button"
                className={styles.btnSave}
                onClick={async () => {
                  if (!newVer.trim()) return;
                  const ok = await onExecuteAction(
                    'manage_versions',
                    {
                      groupId: selGid,
                      topicId: selTid,
                      op: 'add',
                      versionName: newVer.trim(),
                    },
                    `Versión "${newVer.trim()}" añadida`
                  );
                  if (ok) setNewVer('');
                }}
              >
                ➕ Añadir
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '280px', overflowY: 'auto' }}>
              {allCategories.map(c => (
                <div
                  key={c}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#0b0d13',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>📁 {c}</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className={styles.miniBtn}
                      onClick={async () => {
                        const nuevo = window.prompt(`Renombrar categoría "${c}" en toda la base de datos a:`, c);
                        if (nuevo && nuevo.trim() && nuevo.trim() !== c) {
                          await onExecuteAction(
                            'manage_categories',
                            { op: 'rename', categoryName: c, newCategoryName: nuevo.trim() },
                            `Categoría renombrada a "${nuevo.trim()}"`
                          );
                        }
                      }}
                    >
                      ✏️ Renombrar
                    </button>
                    <button
                      type="button"
                      className={`${styles.miniBtn} ${styles.miniBtnDanger}`}
                      onClick={async () => {
                        if (window.confirm(`¿Quitar la categoría "${c}" de todos los artículos?`)) {
                          await onExecuteAction(
                            'manage_categories',
                            { op: 'delete', categoryName: c },
                            `Categoría "${c}" eliminada`
                          );
                        }
                      }}
                    >
                      🗑️ Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.inlineAddRow}>
              <input
                type="text"
                className={styles.input}
                placeholder="Crear nueva categoría global..."
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
              />
              <button
                type="button"
                className={styles.btnSave}
                onClick={async () => {
                  if (!newCat.trim()) return;
                  const ok = await onExecuteAction(
                    'manage_categories',
                    { op: 'add', categoryName: newCat.trim() },
                    `Categoría "${newCat.trim()}" creada`
                  );
                  if (ok) setNewCat('');
                }}
              >
                ➕ Crear
              </button>
            </div>
          </div>
        )}

        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
