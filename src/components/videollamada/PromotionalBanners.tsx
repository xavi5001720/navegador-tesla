"use client";

import styles from "./PromotionalBanners.module.css";

export function PromotionalBanners() {
  return (
    <div className={styles.container}>
      {/* Banner 1: Telegram Community */}
      <a
        href="https://t.me/tesla_chuches"
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.card} ${styles.telegramCard}`}
      >
        <div className={styles.badge}>COMUNIDAD TELEGRAM 🚀</div>
        <div className={styles.cardHeader}>
          <span className={styles.cardIcon}>✈️</span>
          <div>
            <h3 className={styles.cardTitle}>Tesla Chuches & Ofertas</h3>
            <p className={styles.cardSubtitle}>
              Únete al grupo con los mejores accesorios, chollos de vuelos y trucos Tesla
            </p>
          </div>
        </div>
        <div className={styles.cardAction}>
          <span>Unirme al grupo en Telegram</span>
          <span className={styles.arrow}>→</span>
        </div>
      </a>

      {/* Banner 2: Web Portal Viajando en Tesla */}
      <a
        href="https://www.viajandoentesla.es"
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.card} ${styles.portalCard}`}
      >
        <div className={styles.badge}>WEB OFICIAL ⚡</div>
        <div className={styles.cardHeader}>
          <span className={styles.cardIcon}>🚘</span>
          <div>
            <h3 className={styles.cardTitle}>ViajandoEnTesla.es</h3>
            <p className={styles.cardSubtitle}>
              Rutas en Supercargadores, radares de escapadas, noticias y accesorios
            </p>
          </div>
        </div>
        <div className={styles.cardAction}>
          <span>Explorar la web</span>
          <span className={styles.arrow}>→</span>
        </div>
      </a>
    </div>
  );
}
