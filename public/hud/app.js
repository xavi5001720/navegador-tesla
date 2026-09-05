/**
 * app.js — Orquestador principal del HUD Radar DGT
 *
 * Conecta GPS + RadarEngine + AudioEngine → actualiza la UI
 * Gestiona modos: HUD espejado, pantalla completa, demo, ajustes
 */

// ── Instancias de módulos ─────────────────────────────────────────────────
const gpsModule    = new GPSModule();
const radarEngine  = new RadarEngine();
const audioEngine  = new AudioEngine();

// ── Estado de la app ──────────────────────────────────────────────────────
const state = {
  hudMode:    true,   // pantalla espejada
  muted:      false,
  demoMode:   false,
  settingsOpen: false,
  gpsStatus:  'idle', // idle | requesting | active | error
  wakeLock:   null,

  // Última posición conocida
  lat: null, lon: null, speed: 0, heading: 0, accuracy: null,

  // Radar activo
  nearestRadar:    null,
  lastAlertLevel:  0,
  lastRadarId:     null,
};

// ── Ajustes (sincronizados con UI) ────────────────────────────────────────
const settings = {
  d1: 500, d2: 300, d3: 150,
  radius: 15000,
  brightness: 1.0
};

// ── Refs a elementos DOM ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const els = {
  // Overlays
  overlayPermission: $('overlay-permission'),
  overlayError:      $('overlay-error'),
  errorMessage:      $('error-message'),

  // Status
  gpsDot:            $('gps-dot'),
  gpsLabel:          $('gps-label'),
  demoBadge:         $('demo-badge'),
  radaresCount:      $('radares-count'),
  radaresCountNum:   $('radares-count-num'),
  currentTime:       $('current-time'),

  // Radar panel
  radarPanel:        $('radar-panel'),
  radarDistance:     $('radar-distance-display'),
  radarLimit:        $('radar-limit-value'),
  radarLabelTop:     $('radar-label-top'),
  radarTypeLabel:    $('radar-type-label'),
  radarProgress:     $('radar-progress-fill'),

  // Speed
  hudContainer:      $('hud-container'),
  speedValue:        $('speed-value'),
  speedStatusText:   $('speed-status-text'),

  // Info bar
  compassArrow:      $('compass-arrow'),
  headingDegrees:    $('heading-degrees'),
  headingCardinal:   $('heading-cardinal'),
  accuracyWrap:      $('accuracy-wrap'),
  accuracyValue:     $('accuracy-value'),

  // Buttons
  btnRequestGps:     $('btn-request-gps'),
  btnDemoMode:       $('btn-demo-mode'),
  btnRetryGps:       $('btn-retry-gps'),
  btnUseDemo:        $('btn-use-demo'),
  btnHudToggle:      $('btn-hud-toggle'),
  btnMute:           $('btn-mute'),
  muteIcon:          $('mute-icon'),
  btnSettings:       $('btn-settings'),

  // Settings
  settingsPanel:     $('settings-panel'),
  btnCloseSettings:  $('btn-close-settings'),
  setRadius:         $('set-radius'),
  setAlert1:         $('set-alert1'),
  setAlert2:         $('set-alert2'),
  setAlert3:         $('set-alert3'),
  setBrightness:     $('set-brightness'),
  btnForceReload:    $('btn-force-reload-radares'),
};

// ── INICIALIZACIÓN ────────────────────────────────────────────────────────

function init() {
  bindButtons();
  startClock();
  applyHudMode();

  // Restaurar ajustes guardados
  loadSettings();
}

// ── BOTONES ───────────────────────────────────────────────────────────────

function bindButtons() {
  // Overlay de permisos
  els.btnRequestGps.addEventListener('click', () => {
    audioEngine.unlock();
    startGPS();
  });
  els.btnDemoMode.addEventListener('click', () => {
    audioEngine.unlock();
    startDemo();
  });

  // Overlay de error
  els.btnRetryGps.addEventListener('click', () => {
    hideOverlay('error');
    startGPS();
  });
  els.btnUseDemo.addEventListener('click', () => {
    hideOverlay('error');
    startDemo();
  });

  // HUD toggle
  els.btnHudToggle.addEventListener('click', () => {
    state.hudMode = !state.hudMode;
    applyHudMode();
  });

  // Mute
  els.btnMute.addEventListener('click', () => {
    state.muted = audioEngine.toggleMute();
    updateMuteBtn();
  });

  // Settings open/close
  els.btnSettings.addEventListener('click', () => openSettings());
  els.btnCloseSettings.addEventListener('click', () => closeSettings());

  // Settings: radius
  els.setRadius.addEventListener('change', () => {
    settings.radius = parseInt(els.setRadius.value);
    radarEngine.setRadius(settings.radius);
    saveSettings();
  });

  // Settings: alert distances
  els.setAlert1.addEventListener('change', () => { settings.d1 = parseInt(els.setAlert1.value); applyAlertSettings(); saveSettings(); });
  els.setAlert2.addEventListener('change', () => { settings.d2 = parseInt(els.setAlert2.value); applyAlertSettings(); saveSettings(); });
  els.setAlert3.addEventListener('change', () => { settings.d3 = parseInt(els.setAlert3.value); applyAlertSettings(); saveSettings(); });

  // Settings: brightness
  els.setBrightness.addEventListener('change', () => {
    settings.brightness = parseFloat(els.setBrightness.value);
    els.hudContainer.style.filter = `brightness(${settings.brightness})`;
    saveSettings();
  });

  // Force reload radares
  els.btnForceReload.addEventListener('click', () => {
    radarEngine.forceRequery();
    if (state.lat) radarEngine.update(state.lat, state.lon, state.heading);
  });

  // Cerrar settings al hacer click fuera del panel
  document.addEventListener('click', (e) => {
    if (state.settingsOpen && !els.settingsPanel.contains(e.target) && e.target !== els.btnSettings) {
      closeSettings();
    }
  });
}

// ── GPS ───────────────────────────────────────────────────────────────────

function startGPS() {
  hideOverlay('permission');
  setGpsStatus('requesting');

  gpsModule.start(
    onGpsUpdate,
    onGpsError,
    (status) => setGpsStatus(status)
  );

  requestWakeLock();

  // Configurar callbacks del motor de radares
  radarEngine.onRadaresUpdated = (count) => {
    els.radaresCountNum.textContent = count;
    els.radaresCount.classList.toggle('hidden', count === 0);
  };
  radarEngine.onQueryStatus = (status) => {
    // Podríamos mostrar un spinner aquí si quisiéramos
    console.log('[Radares]', status);
  };
}

async function onGpsUpdate(data) {
  state.lat      = data.lat;
  state.lon      = data.lon;
  state.speed    = data.speed;
  state.heading  = data.heading;
  state.accuracy = data.accuracy;

  // Actualizar UI de velocidad
  updateSpeedDisplay(data.speed);
  updateHeadingDisplay(data.heading);

  if (data.accuracy) {
    els.accuracyValue.textContent = `± ${Math.round(data.accuracy)} m`;
    els.accuracyWrap.classList.remove('hidden');
  }

  // Consultar motor de radares (solo activo si hay movimiento real > 5 km/h)
  const nearest = await radarEngine.update(data.lat, data.lon, data.heading, data.speed);
  updateRadarUI(nearest, data.speed);
}

function onGpsError(msg) {
  setGpsStatus('error');
  els.errorMessage.textContent = msg;
  showOverlay('error');
}

// ── DEMO MODE ─────────────────────────────────────────────────────────────

let demoInterval = null;
const DEMO = {
  // Simulación: conduciendo en la A-2 (Madrid → Zaragoza)
  // Posición base: Alcalá de Henares
  baseLat: 40.4817, baseLon: -3.3640,
  heading: 75,  // hacia el este
  speed: 0,
  step: 0,
  // Radar ficticio a ~500m de distancia
  radarLat: 40.4817 + 0.0045,
  radarLon: -3.3640 + 0.0065,
  radarSpeed: 100,
};

function startDemo() {
  state.demoMode = true;
  hideOverlay('permission');
  hideOverlay('error');
  els.demoBadge.classList.remove('hidden');

  // Inyectar un radar ficticio en el motor
  radarEngine.radares = [{
    id: 'demo_1',
    lat: DEMO.radarLat,
    lon: DEMO.radarLon,
    maxspeed: DEMO.radarSpeed,
    direction: DEMO.heading,
    type: 'fixed'
  }];
  radarEngine.onRadaresUpdated?.(1);

  setGpsStatus('active');
  requestWakeLock();

  let stepCount = 0;
  const totalSteps = 120; // 2 min de demo a 1s/step

  demoInterval = setInterval(() => {
    stepCount++;
    if (stepCount > totalSteps) {
      stepCount = 0;
      radarEngine.passedRadares.clear();
      radarEngine.alertState = {};
      audioEngine.resetCooldowns();
    }

    // Velocidad: sube hasta 110
    DEMO.speed = Math.min(110, stepCount * 1.2);

    // Avanzar posición en la dirección del heading
    const progress = stepCount / totalSteps;
    const lat = DEMO.baseLat + progress * 0.009;
    const lon = DEMO.baseLon + progress * 0.013;

    // Simular que el radar queda fijo
    const fakeGps = {
      lat, lon,
      speed:    Math.round(DEMO.speed),
      heading:  DEMO.heading,
      accuracy: 8,
    };

    state.lat = lat; state.lon = lon;
    state.speed = fakeGps.speed;
    state.heading = fakeGps.heading;

    updateSpeedDisplay(fakeGps.speed);
    updateHeadingDisplay(fakeGps.heading);

    // Calcular distancia al radar demo
    const dist = geoDistance(lat, lon, DEMO.radarLat, DEMO.radarLon);
    const inRange = dist < 5000 && dist > 0;

    if (inRange) {
      const fakeRadar = { ...radarEngine.radares[0], distance: dist };
      updateRadarUI(fakeRadar, fakeGps.speed);
    } else {
      updateRadarUI(null, fakeGps.speed);
    }

  }, 1000);
}

function stopDemo() {
  if (demoInterval) clearInterval(demoInterval);
  demoInterval = null;
  state.demoMode = false;
  els.demoBadge.classList.add('hidden');
}

// ── UI: VELOCIDAD ─────────────────────────────────────────────────────────

function updateSpeedDisplay(speed) {
  const s = Math.max(0, Math.round(speed));
  els.speedValue.textContent = isNaN(s) ? '--' : s;

  // Color según contexto radar
  if (!state.nearestRadar) {
    setSpeedState('neutral');
    els.speedStatusText.textContent = '';
  }
}

function setSpeedState(stateName) {
  els.speedValue.className = `speed-value state-${stateName}`;
}

// ── UI: RADAR ─────────────────────────────────────────────────────────────

function updateRadarUI(radar, speed) {
  state.nearestRadar = radar;

  if (!radar) {
    els.radarPanel.classList.add('hidden');
    setSpeedState('neutral');
    els.speedStatusText.textContent = '';
    state.lastAlertLevel = 0;
    state.lastRadarId    = null;
    return;
  }

  // Mostrar panel
  els.radarPanel.classList.remove('hidden');

  // Distancia formateada
  const dist     = Math.round(radar.distance);
  const distText = dist < 1000
    ? `${dist} m`
    : `${(dist / 1000).toFixed(1)} km`;
  els.radarDistance.textContent = distText;

  // Límite de velocidad
  const limit = radar.maxspeed;
  if (limit) {
    els.radarLimit.textContent = limit;
  } else {
    els.radarLimit.textContent = '—';
  }

  // Tipo de radar
  const typeLabels = {
    fixed:          'radar fijo',
    section:        'radar de tramo',
    camera:         'cámara semáforo',
    mobile_zone:    'zona radar móvil',
    community_mobile: 'radar reportado',
  };
  els.radarTypeLabel.textContent = typeLabels[radar.type] || 'radar';

  // Barra de progreso (cuánto hemos avanzado hacia el radar)
  const initialDist = settings.d1;
  const progress = radar.distance < initialDist
    ? Math.max(0, 100 - (radar.distance / initialDist * 100))
    : 0;
  els.radarProgress.style.width = `${progress}%`;

  // Color de velocidad
  const overLimit = limit && speed > limit;
  if (overLimit) {
    setSpeedState('danger');
    els.speedStatusText.textContent = `LÍMITE ${limit}`;
    els.radarPanel.classList.add('urgent');
  } else {
    setSpeedState('safe');
    els.speedStatusText.textContent = limit ? `LÍMITE ${limit}` : '';
    els.radarPanel.classList.remove('urgent');
  }

  // Avisos acústicos (solo si estamos conduciendo a velocidad >= 5 km/h)
  const alertLevel = radarEngine.getAlertLevel(radar);

  if (speed >= 5) {
    // Detectar cambio de radar
    if (radar.id !== state.lastRadarId) {
      state.lastRadarId   = radar.id;
      state.lastAlertLevel = 0;
      audioEngine.resetCooldowns();
    }

    if (alertLevel > 0 && !radarEngine.hasAlerted(radar.id, alertLevel)) {
      const played = audioEngine.playAlert(alertLevel);
      if (played) radarEngine.markAlerted(radar.id, alertLevel);
    }
  }
  state.lastAlertLevel = alertLevel;
}

// ── UI: HEADING ───────────────────────────────────────────────────────────

function updateHeadingDisplay(heading) {
  const h = Math.round(heading);
  els.headingDegrees.textContent  = `${h}°`;
  els.headingCardinal.textContent = headingToCardinal(h);

  // Rotar la flecha del compás
  // (en modo HUD espejado, invertimos la rotación para que se vea bien)
  const rotation = state.hudMode ? -h : h;
  els.compassArrow.style.transform = `rotate(${rotation}deg)`;
}

// ── UI: STATUS GPS ────────────────────────────────────────────────────────

function setGpsStatus(status) {
  state.gpsStatus = status;
  const dot   = els.gpsDot;
  const label = els.gpsLabel;

  dot.className   = 'status-dot';
  label.className = 'status-label';

  switch (status) {
    case 'requesting':
      dot.classList.add('dot-searching');
      label.textContent = 'GPS…';
      break;
    case 'active':
      dot.classList.add('dot-active');
      label.textContent = 'GPS';
      audioEngine.playConfirm();
      break;
    case 'error':
      dot.classList.add('dot-error');
      label.textContent = 'ERR';
      break;
    default:
      dot.classList.add('dot-searching');
      label.textContent = 'GPS';
  }
}

// ── OVERLAYS ──────────────────────────────────────────────────────────────

function showOverlay(name) {
  if (name === 'permission') els.overlayPermission.classList.add('active');
  if (name === 'error')      els.overlayError.classList.add('active');
}
function hideOverlay(name) {
  if (name === 'permission') els.overlayPermission.classList.remove('active');
  if (name === 'error')      els.overlayError.classList.remove('active');
}

// ── MODOS ─────────────────────────────────────────────────────────────────

function applyHudMode() {
  els.hudContainer.classList.toggle('mirrored', state.hudMode);
  els.btnHudToggle.classList.toggle('ctrl-btn--active', state.hudMode);
  els.btnHudToggle.setAttribute('aria-pressed', state.hudMode);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
    screen.orientation?.lock?.('portrait').catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
}

function updateMuteBtn() {
  els.muteIcon.textContent = state.muted ? '🔇' : '🔊';
  els.btnMute.classList.toggle('ctrl-btn--muted', state.muted);
  els.btnMute.setAttribute('aria-pressed', state.muted);
}

// ── AJUSTES ───────────────────────────────────────────────────────────────

function openSettings() {
  state.settingsOpen = true;
  els.settingsPanel.classList.remove('hidden');
}
function closeSettings() {
  state.settingsOpen = false;
  els.settingsPanel.classList.add('hidden');
}

function applyAlertSettings() {
  radarEngine.setAlertThresholds(settings.d1, settings.d2, settings.d3);
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('hud-settings') || '{}');
    if (saved.d1) { settings.d1 = saved.d1; els.setAlert1.value = saved.d1; }
    if (saved.d2) { settings.d2 = saved.d2; els.setAlert2.value = saved.d2; }
    if (saved.d3) { settings.d3 = saved.d3; els.setAlert3.value = saved.d3; }
    if (saved.radius) { settings.radius = saved.radius; els.setRadius.value = saved.radius; }
    if (saved.hudMode !== undefined) {
      state.hudMode = saved.hudMode;
      applyHudMode();
    }
    applyAlertSettings();
    radarEngine.setRadius(settings.radius);
  } catch (e) { /* Sin settings guardados */ }
}

function saveSettings() {
  try {
    localStorage.setItem('hud-settings', JSON.stringify({
      ...settings, hudMode: state.hudMode
    }));
  } catch (e) {}
}

// ── RELOJ ─────────────────────────────────────────────────────────────────

function startClock() {
  const update = () => {
    const now  = new Date();
    const h    = String(now.getHours()).padStart(2, '0');
    const m    = String(now.getMinutes()).padStart(2, '0');
    els.currentTime.textContent = `${h}:${m}`;
  };
  update();
  setInterval(update, 10000);
}

// ── WAKE LOCK (pantalla siempre activa) ────────────────────────────────────

async function requestWakeLock() {
  if (!navigator.wakeLock) return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => {
      // Re-adquirir cuando la página vuelve a ser visible
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && !state.demoMode) {
          requestWakeLock();
        }
      }, { once: true });
    });
  } catch (e) {
    console.log('[WakeLock] No disponible:', e.message);
  }
}

// ── ARRANQUE ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
