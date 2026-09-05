/**
 * RadarEngine v2 — Conecta directamente a la BD de NavegaPro (Supabase)
 *
 * Reutiliza la misma base de datos de radares de España + Francia
 * que ya tiene NavegaPro, actualizada automáticamente por cron job.
 *
 * Función usada: get_radars_nearby(p_lat, p_lon, p_radius_meters)
 * Retorna: { id, lat, lon, radar_type, speed_limit, direction }
 */
class RadarEngine {
  constructor() {
    // ── Supabase (NavegaPro — lectura pública con ANON key) ────────────
    this.SUPABASE_URL  = 'https://uoejbgifzstyugjsnwkc.supabase.co';
    this.SUPABASE_ANON = 'sb_publishable_LcxIB1UQ7fRvYlLMCbQsDg_ESjWuQwd';

    // ── Estado interno ─────────────────────────────────────────────────
    this.radares         = [];
    this.lastQueryCenter = null;
    this.lastQueryTime   = 0;
    this.isQuerying      = false;
    this.queryError      = false;
    this.passedRadares   = new Set();
    this.alertState      = {};
    this.lastNearestId   = null;

    // ── Configuración (editable desde UI) ─────────────────────────────
    this.searchRadius     = 15000; // metros — igual que NavegaPro
    this.headingTolerance = 50;    // ± grados para "radar adelante"
    this.alertThresholds  = { d1: 500, d2: 300, d3: 150 };

    // ── Re-query: cuando nos movemos >3km ────────────────────────────
    this.REQUERY_DISTANCE   = 3000;
    this.MIN_QUERY_INTERVAL = 60000; // mínimo 1 min entre queries

    // Callbacks
    this.onRadaresUpdated = null;
    this.onQueryStatus    = null;
  }

  // ── CONFIGURACIÓN ─────────────────────────────────────────────────────

  setRadius(meters) {
    this.searchRadius = meters;
    this.forceRequery();
  }

  setAlertThresholds(d1, d2, d3) {
    this.alertThresholds = { d1, d2, d3 };
  }

  forceRequery() {
    this.lastQueryTime   = 0;
    this.lastQueryCenter = null;
    this.passedRadares.clear();
    this.alertState = {};
  }

  get count() { return this.radares.length; }

  // ── API PRINCIPAL ─────────────────────────────────────────────────────

  async update(lat, lon, heading) {
    await this._maybeQuery(lat, lon);

    const nearest = this._getNearestAhead(lat, lon, heading);

    if (nearest?.id !== this.lastNearestId) {
      this.lastNearestId = nearest?.id ?? null;
    }

    this._detectPassedRadares(lat, lon, heading);
    return nearest;
  }

  getAlertLevel(radar) {
    if (!radar) return 0;
    const { d1, d2, d3 } = this.alertThresholds;
    if (radar.distance <= d3) return 3;
    if (radar.distance <= d2) return 2;
    if (radar.distance <= d1) return 1;
    return 0;
  }

  hasAlerted(radarId, level) {
    return (this.alertState[radarId] || 0) >= level;
  }

  markAlerted(radarId, level) {
    this.alertState[radarId] = Math.max(this.alertState[radarId] || 0, level);
  }

  // ── CONSULTA SUPABASE ─────────────────────────────────────────────────

  async _maybeQuery(lat, lon) {
    if (this.isQuerying) return;

    const now = Date.now();
    let shouldQuery = !this.lastQueryCenter;

    if (!shouldQuery) {
      const moved = geoDistance(this.lastQueryCenter.lat, this.lastQueryCenter.lon, lat, lon);
      if (moved > this.REQUERY_DISTANCE && (now - this.lastQueryTime) > this.MIN_QUERY_INTERVAL) {
        shouldQuery = true;
      }
    }

    if (shouldQuery) await this._querySupabase(lat, lon);
  }

  async _querySupabase(lat, lon) {
    this.isQuerying = true;
    this.queryError = false;
    if (this.onQueryStatus) this.onQueryStatus('querying');

    try {
      // Llamamos a la función PostGIS de NavegaPro
      const url = `${this.SUPABASE_URL}/rest/v1/rpc/get_radars_nearby`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.SUPABASE_ANON,
          'Authorization': `Bearer ${this.SUPABASE_ANON}`
        },
        body: JSON.stringify({
          p_lat: lat,
          p_lon: lon,
          p_radius_meters: this.searchRadius
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Supabase ${resp.status}: ${errText}`);
      }

      const data = await resp.json();

      this.radares = (data || []).map(r => ({
        id:       r.id,
        lat:      r.lat,
        lon:      r.lon,
        maxspeed: r.speed_limit || null,
        direction: r.direction  || null,
        type:     r.radar_type  || 'fixed'
      })).filter(r => r.lat && r.lon);

      this.lastQueryCenter = { lat, lon };
      this.lastQueryTime   = Date.now();

      console.log(`[RadarEngine] ✅ ${this.radares.length} radares cargados desde NavegaPro Supabase`);
      if (this.onQueryStatus)    this.onQueryStatus('ok');
      if (this.onRadaresUpdated) this.onRadaresUpdated(this.radares.length);

    } catch (err) {
      console.warn('[RadarEngine] ⚠️ Error Supabase:', err.message);
      this.queryError = true;
      if (this.onQueryStatus) this.onQueryStatus('error');

      // Si no tenemos datos, intentar también los radares comunitarios
      if (this.radares.length === 0) {
        await this._queryCommunityRadars(lat, lon);
      }
    } finally {
      this.isQuerying = false;
    }
  }

  async _queryCommunityRadars(lat, lon) {
    try {
      const url = `${this.SUPABASE_URL}/rest/v1/rpc/get_community_radars_nearby`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.SUPABASE_ANON,
          'Authorization': `Bearer ${this.SUPABASE_ANON}`
        },
        body: JSON.stringify({ p_lat: lat, p_lon: lon, p_radius_meters: this.searchRadius }),
        signal: AbortSignal.timeout(8000)
      });

      if (!resp.ok) return;
      const data = await resp.json();

      const comm = (data || []).map(r => ({
        id: `comm_${r.id}`, lat: r.lat, lon: r.lon,
        maxspeed: null, direction: null, type: 'community_mobile'
      }));

      this.radares = [...this.radares, ...comm];
      if (this.onRadaresUpdated) this.onRadaresUpdated(this.radares.length);
    } catch (e) {
      console.warn('[RadarEngine] Sin radares comunitarios:', e.message);
    }
  }

  // ── LÓGICA DE DETECCIÓN ───────────────────────────────────────────────

  _getNearestAhead(lat, lon, heading) {
    return this.radares
      .filter(r => !this.passedRadares.has(r.id))
      .map(r => {
        const distance = geoDistance(lat, lon, r.lat, r.lon);
        const bearing  = geoBearing(lat, lon, r.lat, r.lon);
        const angDiff  = Math.abs(angleDiff(heading, bearing));

        // Si el radar tiene dirección propia, úsala como filtro adicional
        let dirOk = true;
        if (r.direction !== null) {
          dirOk = Math.abs(angleDiff(heading, r.direction)) <= 45;
        }

        return { ...r, distance, bearing, angDiff, dirOk };
      })
      .filter(r => r.distance > 15)
      .filter(r => r.distance < this.searchRadius)
      .filter(r => r.angDiff  <= this.headingTolerance)
      .filter(r => r.dirOk)
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }

  _detectPassedRadares(lat, lon, heading) {
    this.radares.forEach(r => {
      if (this.passedRadares.has(r.id)) return;
      const dist   = geoDistance(lat, lon, r.lat, r.lon);
      const bear   = geoBearing(lat, lon, r.lat, r.lon);
      const behind = Math.abs(angleDiff(heading, bear)) > 120;
      if (dist < 30 || (dist < 80 && behind)) {
        this.passedRadares.add(r.id);
        delete this.alertState[r.id];
      }
    });
  }
}
