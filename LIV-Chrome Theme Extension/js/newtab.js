'use strict';

const THEME_MAP = {
  starfield:      StarfieldTheme,
  nebula:         NebulaTheme,
  galaxy:         GalaxyTheme,
  particles:      ParticlesTheme,
  hyperspace:     HyperspaceTheme,
  meteor:         MeteorShowerTheme,
  blackhole:      BlackHoleTheme,
  sakura:         SakuraPetalsTheme,
  fireflies:      ForestFirefliesTheme,
  bokeh:          BokehLightsTheme,
  snow:           FallingSnowTheme,
  bikeRide:       SunsetBikeRideTheme,
  dogWalk:        AutumnDogWalkTheme,
  cityDrive:      NightCityDriveTheme,
  hotAirBalloon:  HotAirBalloonTheme,
  rainyWindow:    RainyWindowTheme,
  lanterns:       FloatingLanternsTheme,
  fireside:       FiresideTheme,
  nightTrain:     NightTrainTheme,
  oceanLight:     OceanLightTheme,
  goldenHour:           GoldenHourTheme,
  windmillRainbowField: WindmillRainbowFieldTheme,
};

const THEME_LABELS = {
  starfield:      'Deep Space',
  nebula:         'Nebula Drift',
  galaxy:         'Galaxy Spiral',
  particles:      'Constellations',
  hyperspace:     'Hyperspace',
  meteor:         'Meteor Shower',
  blackhole:      'Black Hole',
  sakura:         'Sakura Petals',
  fireflies:      'Forest Fireflies',
  bokeh:          'Bokeh Lights',
  snow:           'Falling Snow',
  bikeRide:       'Sunset Bike Ride',
  dogWalk:        'Autumn Dog Walk',
  cityDrive:      'Night City Drive',
  hotAirBalloon:  'Hot Air Balloon',
  rainyWindow:    'Rainy Window',
  lanterns:       'Floating Lanterns',
  fireside:       'Fireside',
  nightTrain:     'Night Train',
  oceanLight:     'Ocean Light',
  goldenHour:           'Golden Hour',
  windmillRainbowField: 'Rainbow Fields',
};

const THEME_GROUPS = [
  { key: 'space',      label: 'Space',      themes: ['starfield','nebula','galaxy','particles','hyperspace','meteor','blackhole'] },
  { key: 'nature',     label: 'Nature',     themes: ['sakura','fireflies','bokeh','snow','oceanLight','goldenHour','windmillRainbowField','rainyWindow','lanterns','fireside'] },
  { key: 'passingby',  label: 'Passing By', themes: ['bikeRide','dogWalk','cityDrive','hotAirBalloon','nightTrain'] },
];

// Pre-rendered thumbnail images (themeKey -> URL). None exist yet; when a
// thumbnail library gets built they take precedence over the generated
// ScenePreview snapshots.
const THEME_THUMBS = {};

function getThumb(themeKey) {
  if (THEME_THUMBS[themeKey]) return Promise.resolve(THEME_THUMBS[themeKey]);
  return ScenePreview.getThumbnail(themeKey, THEME_MAP[themeKey]);
}

// The category a scene lives in is derived from THEME_GROUPS, never stored.
function categoryOf(themeKey) {
  return THEME_GROUPS.find(g => g.themes.includes(themeKey)) || null;
}

// Favorites act as a pseudo-category on the picker screens; its member list
// is computed on demand and it never claims the active-category checkmark
// (that belongs to the scene's real group).
function getCategoryEntry(key) {
  if (key === 'favorites') {
    return { key, label: 'Favorites', themes: (settings.favorites || []).filter(k => THEME_MAP[k]) };
  }
  return THEME_GROUPS.find(g => g.key === key) || null;
}

const FONTS = {
  system:    { label: 'System',   stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
  georgia:   { label: 'Serif',    stack: 'Georgia, "Times New Roman", serif' },
  trebuchet: { label: 'Rounded',  stack: '"Trebuchet MS", "Gill Sans MT", Calibri, sans-serif' },
  helvetica: { label: 'Clean',    stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  mono:      { label: 'Mono',     stack: '"SF Mono", "Fira Code", "Courier New", monospace' },
};

let engine;
let settings;   // global defaults — the toolbar settings shared by every background
let live;       // effective settings for the ACTIVE background (global or its preset)

// ── Per-background presets (Advanced Customization) ──────────────────────────
//
// A preset is a saved snapshot of the toolbar settings attached to a specific
// background (settings.overrides[themeKey]). When that background is the active
// one, the tab renders with its preset instead of the global toolbar settings.
//
// The snapshot stores real settings keys, so applying a preset is just a merge
// over global. Presets are created/saved/deleted on the Advanced page.

const PRESET_FIELDS = [
  'layout', 'hideText', 'hideSearch', 'logoPosition', 'logoScale', 'font',
  'clockFormat', 'showSeconds', 'showDate', 'showTimeInDate',
  'brandColors', 'cardSize', 'iconStyle', 'newTabLinks',
  'intensity', 'animSpeed', 'staticMode',
  // The exact quick-link arrangement (linkId → {row,col}) is part of a preset,
  // so a background restores its own layout of the links whenever it's shown.
  'quickLinkGrid',
];

// The background being set up / edited on the Advanced page. While it's pending
// it previews the live global toolbar (so toolbar tweaks are visible), even if
// it already has a saved preset. null the rest of the time.
let pendingPresetBg = null;

function snapshotSettings() {
  const s = {};
  PRESET_FIELDS.forEach(k => {
    const v = settings[k];
    // Deep-clone object fields (e.g. quickLinkGrid) so the saved snapshot is
    // independent of later edits to the global settings.
    s[k] = (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
  });
  return s;
}

function overrideFor(themeKey) {
  return (settings.overrides || {})[themeKey] || null;
}

function savePresets() {
  settings.overrides = settings.overrides || {};
  Storage.save({ overrides: settings.overrides });
}

// Effective settings for the active background: its saved preset wins, unless
// it's the one being edited (then it previews the global toolbar so changes
// show live). Single resolution used by the live page, selection and randomize.
function activeUsesPreset() {
  return !!overrideFor(settings.theme) && settings.theme !== pendingPresetBg;
}

function computeLive() {
  if (activeUsesPreset()) return Object.assign({}, settings, overrideFor(settings.theme));
  return Object.assign({}, settings);
}

function recomputeLive() { live = computeLive(); }

// Presets used to be stored under a different schema (mapped field names +
// an `enabled` flag). Drop any leftover ones so they don't show as phantom
// presets; a snapshot always carries the real `layout` key.
function migrateOldPresets() {
  const ov = settings.overrides;
  if (!ov) return;
  let changed = false;
  for (const key of Object.keys(ov)) {
    if (!ov[key] || typeof ov[key].layout === 'undefined') { delete ov[key]; changed = true; }
  }
  if (changed) Storage.save({ overrides: ov });
}

// Push the engine options in `live` to the running background. Only re-inits
// the theme when asked (intensity/quality changes need a fresh init).
function applyLiveEngine(reinit = false) {
  engine.setOptions({
    intensity:  Storage.intensityValue(live.intensity),
    quality:    Storage.qualityValue(live.intensity),
    speed:      live.animSpeed,
    staticMode: live.staticMode,
  });
  if (reinit) engine.switchTheme(THEME_MAP[settings.theme] || StarfieldTheme);
}

// Re-apply every live-page render from the current `live` object.
function applyLiveToPage(reinit = false) {
  applyFont();
  applyLogoPosition();
  applyLogoScale();
  renderHeader();
  renderSearch();
  renderQuickLinks();
  applyLiveEngine(reinit);
}

// ── Boot ─────────────────────────────────────────────────────────────────────

(async () => {
  settings = await Storage.load();
  migrateOldPresets();
  checkDailyRandomize();
  recomputeLive();

  engine = new ThemeEngine(document.getElementById('canvas-container'));
  engine.setOptions({
    intensity:  Storage.intensityValue(live.intensity),
    quality:    Storage.qualityValue(live.intensity),
    speed:      live.animSpeed,
    staticMode: live.staticMode,
  });
  engine.switchTheme(THEME_MAP[settings.theme] || StarfieldTheme);

  applyFont();
  applyLogoPosition();
  applyLogoScale();
  renderHeader();
  renderSearch();
  initClock();
  initSearch();
  renderQuickLinks();
  document.getElementById('ql-done').addEventListener('click', exitQlEdit);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && qlEditing) exitQlEdit(); });
  let qlResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(qlResizeTimer);
    qlResizeTimer = setTimeout(() => { if (!qlEditing) renderQuickLinks(); }, 200);
  });
  initSettings();

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const overlay = document.getElementById('fade-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 600);
  }));
})();

// ── Font ──────────────────────────────────────────────────────────────────────

function applyFont() {
  const font = FONTS[live.font] || FONTS.system;
  document.documentElement.style.setProperty('--ui-font', font.stack);
}

// ── Header / Layout ───────────────────────────────────────────────────────────

function renderHeader() {
  const hide = live.hideText;
  document.getElementById('header-logo').hidden = live.layout !== 'logo' || hide;
  document.getElementById('header-time').hidden = live.layout !== 'time' || hide;
  document.getElementById('header-date').hidden = live.layout !== 'date' || hide;
  document.querySelectorAll('.layout-btn').forEach(b =>
    b.classList.toggle('active', !settings.hideText && b.dataset.value === settings.layout)
  );
  const hasSubline =
    (live.layout === 'time' && live.showDate) ||
    live.layout === 'date';
  document.getElementById('header').classList.toggle('has-subline', !hide && hasSubline);
}

function renderSearch() {
  document.getElementById('search-container').hidden = live.hideSearch;
}

// Position the header (logo / clock / date). 'center' keeps the classic
// centered stack; every other value pins it to that spot on the screen.
function applyLogoPosition() {
  document.body.dataset.logoPosition = live.logoPosition || 'center';
}

// Header text size is driven only by the slider — never by its position.
function applyLogoScale() {
  document.documentElement.style.setProperty('--logo-scale', live.logoScale || 1);
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function initClock() {
  tickClock();
  setInterval(tickClock, 1000);
}

function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  const is12 = settings.clockFormat === '12h';
  const ampm = is12 ? (h >= 12 ? 'PM' : 'AM') : '';
  if (is12) h = h % 12 || 12;

  document.getElementById('clock-hm').textContent = `${h}:${pad(m)}`;

  const secEl = document.getElementById('clock-s');
  secEl.textContent = `:${pad(s)}`;
  secEl.hidden = !settings.showSeconds;

  const ampmEl = document.getElementById('clock-ampm');
  ampmEl.textContent = ` ${ampm}`;
  ampmEl.hidden = !is12;

  const dateLine = document.getElementById('clock-date-line');
  if (settings.showDate) {
    dateLine.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    dateLine.hidden = false;
  } else {
    dateLine.hidden = true;
  }

  document.getElementById('date-weekday').textContent = now.toLocaleDateString('en-US', { weekday: 'long' });
  document.getElementById('date-full').textContent    = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const timeSmall = document.getElementById('date-time-small');
  const dateSep   = document.getElementById('date-separator');
  if (settings.showTimeInDate) {
    timeSmall.textContent = `${h}:${pad(m)}${is12 ? ' ' + ampm : ''}`;
    timeSmall.hidden = false;
    dateSep.hidden   = false;
  } else {
    timeSmall.hidden = true;
    dateSep.hidden   = true;
  }
}

function pad(n) { return String(n).padStart(2, '0'); }

// ── Search ────────────────────────────────────────────────────────────────────

function initSearch() {
  const input = document.getElementById('search-input');
  input.focus();
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const q = input.value.trim();
    if (!q) return;
    // Route through the browser's configured default search engine rather than
    // forcing Google. Fall back to Google only if the search API is missing.
    if (chrome.search && chrome.search.query) {
      chrome.search.query({ text: q, disposition: 'CURRENT_TAB' });
    } else {
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    }
  });
}


// ── Quick links — rearrangeable full-tab grid (oval pills or icon-only) ──────
//
// Links sit on a grid that fills the whole tab (minus the centre — logo/clock/
// search — and an edge margin). "Icon only" (Widgets toggle) renders each link
// as just its app icon; otherwise each is an oval pill with text. Press-and-hold
// enters edit mode (jiggle + pointer-drag rearrange); positions persist to
// settings.quickLinkGrid { linkId: {row,col} }.

const QL_MAX = 24;
const QL_HOLD_MS = 500;
const QL_MOVE_THRESHOLD = 8;
const QL_EDGE = 30;                    // keep-clear margin from the screen edges

let qlEditing = false;
let qlHoldTimer = null;
let qlGeomCache = null;
let rebuildQuickLinksEditor = null;    // set by the settings editor

function qlIconOnly() { return !!settings.iconOnly; }
function qlCellSize() { return qlIconOnly() ? { w: 80, h: 90 } : { w: 184, h: 58 }; }

function qlLinks() {
  return (settings.quickLinks || []).filter(l => l.url && (l.label || BrandColors.siteName(l.url)));
}

function ensureLinkIds() {
  let changed = false;
  (settings.quickLinks || []).forEach(l => {
    if (!l.id) { l.id = 'ql_' + Math.random().toString(36).slice(2, 9); changed = true; }
  });
  if (changed) Storage.save({ quickLinks: settings.quickLinks });
}

// The centre region (logo/clock + search) the grid must leave clear.
function qlProtectedRect() {
  let rect = null;
  ['header', 'search-container'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.hidden) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    if (!rect) rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    else {
      rect.left = Math.min(rect.left, r.left); rect.top = Math.min(rect.top, r.top);
      rect.right = Math.max(rect.right, r.right); rect.bottom = Math.max(rect.bottom, r.bottom);
    }
  });
  if (rect) { const m = 24; rect.left -= m; rect.top -= m; rect.right += m; rect.bottom += m; }
  return rect;
}

// Full-viewport grid geometry (centred, with edge margins) + protected rect.
function qlGeom() {
  const { w, h } = qlCellSize();
  const cols = Math.max(1, Math.floor((window.innerWidth  - QL_EDGE * 2) / w));
  const rows = Math.max(1, Math.floor((window.innerHeight - QL_EDGE * 2) / h));
  const ox = Math.round((window.innerWidth  - cols * w) / 2);
  const oy = Math.round((window.innerHeight - rows * h) / 2);
  return { w, h, cols, rows, ox, oy, prot: qlProtectedRect() };
}

function qlCellBlocked(g, row, col) {
  if (!g.prot) return false;
  const x = g.ox + col * g.w, y = g.oy + row * g.h;
  return !(x + g.w <= g.prot.left || x >= g.prot.right || y + g.h <= g.prot.top || y >= g.prot.bottom);
}

function qlFirstFreeCell(g, taken) {
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    if (!taken.has(r + ',' + c) && !qlCellBlocked(g, r, c)) return { row: r, col: c };
  }
  return null;
}

function qlPlacements(links, g) {
  // Read the ACTIVE background's grid: its preset's saved arrangement when a
  // preset is showing, otherwise the global grid.
  const map = live.quickLinkGrid || {};
  const taken = new Set();
  const placed = [], rest = [];
  links.forEach(link => {
    const p = map[link.id];
    const ok = p && Number.isInteger(p.row) && Number.isInteger(p.col) &&
               p.row < g.rows && p.col < g.cols &&
               !taken.has(p.row + ',' + p.col) && !qlCellBlocked(g, p.row, p.col);
    if (ok) { taken.add(p.row + ',' + p.col); placed.push({ link, row: p.row, col: p.col }); }
    else rest.push(link);
  });
  rest.forEach(link => {
    const cell = qlFirstFreeCell(g, taken);
    if (!cell) return;
    taken.add(cell.row + ',' + cell.col);
    placed.push({ link, row: cell.row, col: cell.col });
  });
  return placed;
}

// Persist the quick-link arrangement to whichever store the active background
// uses: directly into its preset when one is showing (so rearranging on that
// background edits its saved layout), otherwise the global grid.
function qlSaveGrid(map) {
  if (activeUsesPreset()) {
    const ov = overrideFor(settings.theme);
    ov.quickLinkGrid = map;
    savePresets();
  } else {
    settings.quickLinkGrid = map;
    Storage.save({ quickLinkGrid: map });
  }
  recomputeLive();
}

function qlPersistFromDom() {
  const map = {};
  document.querySelectorAll('#quick-links .ql-tile').forEach(t => {
    map[t.dataset.id] = { row: +t.dataset.row, col: +t.dataset.col };
  });
  qlSaveGrid(map);
}

function renderQuickLinks() {
  const container = document.getElementById('quick-links');
  ensureLinkIds();
  container.innerHTML = '';
  container.classList.toggle('editing', qlEditing);
  container.classList.toggle('icon-only', qlIconOnly());

  const g = qlGeomCache = qlGeom();
  const placed = qlPlacements(qlLinks(), g);

  const map = {};
  placed.forEach(p => { map[p.link.id] = { row: p.row, col: p.col }; });
  qlSaveGrid(map);

  placed.forEach(p => container.appendChild(makeQuickLinkTile(p.link, p.row, p.col, g)));
  qlRenderCells();
}

// Dashed empty slots for every free, non-protected cell (edit mode only).
function qlRenderCells() {
  const container = document.getElementById('quick-links');
  container.querySelectorAll('.ql-cell').forEach(c => c.remove());
  if (!qlEditing) return;
  const g = qlGeomCache || (qlGeomCache = qlGeom());

  // Oval slots hug the widest actual pill rather than filling the whole cell.
  if (!qlIconOnly()) {
    let maxW = 0;
    container.querySelectorAll('.ql-tile .ql-body').forEach(b => { maxW = Math.max(maxW, b.offsetWidth); });
    container.style.setProperty('--ql-slot-w', (maxW ? maxW + 8 : 168) + 'px');
  }

  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    if (qlCellBlocked(g, r, c)) continue;
    const cell = document.createElement('div');
    cell.className = 'ql-cell';
    cell.dataset.row = r;
    cell.dataset.col = c;
    cell.style.left = (g.ox + c * g.w) + 'px';
    cell.style.top  = (g.oy + r * g.h) + 'px';
    cell.style.width  = g.w + 'px';
    cell.style.height = g.h + 'px';
    container.insertBefore(cell, container.firstChild);
  }
}

function qlPositionTile(tile, row, col, g) {
  g = g || qlGeomCache;
  tile.style.left = (g.ox + col * g.w) + 'px';
  tile.style.top  = (g.oy + row * g.h) + 'px';
  tile.dataset.row = row;
  tile.dataset.col = col;
}

function makeQuickLinkTile(link, row, col, g) {
  const label = link.label || BrandColors.siteName(link.url);
  const tile = document.createElement('div');
  tile.className = 'ql-tile';
  tile.dataset.id = link.id;
  tile.tabIndex = 0;
  tile.setAttribute('role', 'link');
  tile.setAttribute('aria-label', label);
  tile.title = label;
  tile.style.width  = g.w + 'px';
  tile.style.height = g.h + 'px';
  qlPositionTile(tile, row, col, g);
  tile.style.setProperty('--jiggle-delay', Math.floor(Math.random() * 150) + 'ms');
  tile.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !qlEditing) { e.preventDefault(); openQuickLink(link); }
  });

  const body = document.createElement('div');
  body.className = 'ql-body';

  // Delete badge lives on the app body so it sits on the icon/pill's corner.
  const del = document.createElement('button');
  del.className = 'ql-del';
  del.type = 'button';
  del.setAttribute('aria-label', 'Remove ' + label);
  del.textContent = '×';
  del.addEventListener('pointerdown', e => e.stopPropagation());
  del.addEventListener('click', e => { e.stopPropagation(); removeQuickLink(link.id); });
  body.appendChild(del);

  // Both modes show the app icon (brand logo → favicon → letter), tinted by the
  // theme colour when enabled. Oval mode adds the text label beside it.
  const box = document.createElement('div');
  box.className = 'ql-icon-box';
  body.appendChild(box);
  decorateQuickTile(box, link.url, label);

  if (!qlIconOnly()) {
    const lbl = document.createElement('span');
    lbl.className = 'ql-tile-label';
    lbl.textContent = label;
    body.appendChild(lbl);
  }
  tile.appendChild(body);

  attachTilePointer(tile, link);
  return tile;
}

function openQuickLink(link) {
  if (live.newTabLinks) window.open(link.url, '_blank');
  else window.location.href = link.url;
}

function removeQuickLink(id) {
  const idx = (settings.quickLinks || []).findIndex(l => l.id === id);
  if (idx === -1) return;
  settings.quickLinks.splice(idx, 1);
  if (settings.quickLinkGrid) delete settings.quickLinkGrid[id];
  Storage.save({ quickLinks: settings.quickLinks, quickLinkGrid: settings.quickLinkGrid || {} });
  renderQuickLinks();
  if (rebuildQuickLinksEditor) rebuildQuickLinksEditor();
}

// Fill a tile's icon box: bundled brand logo → favicon → first-letter fallback.
// When "Use Theme Color" is on the whole tile goes branded: --ql-bg fills the
// pill / icon box (the app's outer shell, e.g. Spotify black) and --ql-fg tints
// the text and the masked logo mark (the app's accent, e.g. Spotify green).
function decorateQuickTile(box, url, label) {
  const body = box.parentElement;
  const domain = BrandColors.domainOf(url);
  const letter = () => { box.classList.add('ql-letter'); box.textContent = (label || '?').charAt(0).toUpperCase(); };
  if (!domain) { letter(); return; }

  const override = BrandColors.lookup(domain);
  const cached   = (settings.brandColorCache || {})[domain];
  const colors   = override || cached;
  if (settings.brandColors && colors) applyBrandColors(body, colors);

  const logoDomain = BrandColors.logoDomain(domain);
  if (logoDomain) {
    const logo = document.createElement('span');
    logo.className = 'ql-logo-mask';
    logo.style.setProperty('--ql-logo-src', `url("${BrandColors.logoUrl(logoDomain)}")`);
    box.appendChild(logo);
    return;
  }

  BrandColors.analyze(url).then(({ blank, colors: found }) => {
    if (!blank) {
      const img = document.createElement('img');
      img.className = 'ql-fav';
      img.src = BrandColors.faviconUrl(url, 64);
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('error', () => { img.remove(); letter(); });
      box.appendChild(img);
    } else {
      letter();
    }
    if (found && !colors) {
      settings.brandColorCache = settings.brandColorCache || {};
      settings.brandColorCache[domain] = found;
      Storage.save({ brandColorCache: settings.brandColorCache });
      if (settings.brandColors) applyBrandColors(body, found);
    }
  });
}

// Flag a tile as brand-coloured; CSS reads --ql-bg / --ql-fg per display mode.
function applyBrandColors(body, colors) {
  body.style.setProperty('--ql-bg', colors.bg);
  body.style.setProperty('--ql-fg', colors.fg);
  body.classList.add('branded');
}

// ── Grid interaction: press-hold, jiggle edit mode, pointer drag ─────────────

function clearHold() { if (qlHoldTimer) { clearTimeout(qlHoldTimer); qlHoldTimer = null; } }

function attachTilePointer(tile, link) {
  tile.addEventListener('pointerdown', e => {
    if (e.button && e.button !== 0) return;
    const state = { link, tile, x0: e.clientX, y0: e.clientY, pid: e.pointerId, moved: false, dragging: false };
    try { tile.setPointerCapture(e.pointerId); } catch (_) {}

    const onMove = ev => {
      if (!state.dragging) {
        if (Math.hypot(ev.clientX - state.x0, ev.clientY - state.y0) > QL_MOVE_THRESHOLD) {
          state.moved = true;
          clearHold();
          if (qlEditing) beginDrag(state, ev);
          else cleanup();          // moved before the hold fired → not a press-hold
        }
        return;
      }
      dragMove(state, ev);
    };
    const onUp = () => {
      clearHold();
      if (state.dragging) endDrag(state);
      else if (!state.moved && !qlEditing) openQuickLink(link);
      cleanup();
    };
    const cleanup = () => {
      try { tile.releasePointerCapture(state.pid); } catch (_) {}
      tile.removeEventListener('pointermove', onMove);
      tile.removeEventListener('pointerup', onUp);
      tile.removeEventListener('pointercancel', onUp);
    };

    tile.addEventListener('pointermove', onMove);
    tile.addEventListener('pointerup', onUp);
    tile.addEventListener('pointercancel', onUp);

    if (!qlEditing) {
      clearHold();
      qlHoldTimer = setTimeout(() => {
        qlHoldTimer = null;
        enterQlEdit();
        beginDrag(state, { clientX: state.x0, clientY: state.y0 });   // hold → grab the tile
      }, QL_HOLD_MS);
    }
  });
}

function qlHighlightCell(row, col) {
  const container = document.getElementById('quick-links');
  container.querySelectorAll('.ql-cell.highlight').forEach(c => c.classList.remove('highlight'));
  const cell = container.querySelector(`.ql-cell[data-row="${row}"][data-col="${col}"]`);
  if (cell) cell.classList.add('highlight');
}

function beginDrag(state, ev) {
  state.dragging = true;
  const rect = state.tile.getBoundingClientRect();
  state.offsetX = ev.clientX - rect.left;
  state.offsetY = ev.clientY - rect.top;
  state.curRow = +state.tile.dataset.row;
  state.curCol = +state.tile.dataset.col;
  state.tile.classList.add('dragging');
  qlHighlightCell(state.curRow, state.curCol);
  dragMove(state, ev);
}

function dragMove(state, ev) {
  const g = qlGeomCache;
  const crect = document.getElementById('quick-links').getBoundingClientRect();
  const x = ev.clientX - crect.left - state.offsetX;
  const y = ev.clientY - crect.top  - state.offsetY;
  state.tile.style.left = x + 'px';
  state.tile.style.top  = y + 'px';

  let col = Math.round((x - g.ox) / g.w);
  let row = Math.round((y - g.oy) / g.h);
  col = Math.max(0, Math.min(g.cols - 1, col));
  row = Math.max(0, Math.min(g.rows - 1, row));

  if ((row !== state.curRow || col !== state.curCol) && !qlCellBlocked(g, row, col)) {
    const occ = document.querySelector(`#quick-links .ql-tile[data-row="${row}"][data-col="${col}"]:not(.dragging)`);
    if (occ) qlPositionTile(occ, state.curRow, state.curCol, g);   // swap occupant into the vacated cell
    state.curRow = row;
    state.curCol = col;
    qlHighlightCell(row, col);                                     // light up the target slot
  }
}

function endDrag(state) {
  state.tile.classList.remove('dragging');
  document.querySelectorAll('#quick-links .ql-cell.highlight').forEach(c => c.classList.remove('highlight'));
  qlPositionTile(state.tile, state.curRow, state.curCol);   // ease-out snap (CSS transition)
  qlPersistFromDom();
}

function enterQlEdit() {
  if (qlEditing) return;
  qlEditing = true;
  document.getElementById('quick-links').classList.add('editing');
  qlRenderCells();
  document.getElementById('ql-done').classList.remove('hidden');
  setTimeout(() => document.addEventListener('pointerdown', qlOutsideDown, true), 0);
}

function exitQlEdit() {
  if (!qlEditing) return;
  qlEditing = false;
  document.getElementById('quick-links').classList.remove('editing');
  qlRenderCells();
  document.getElementById('ql-done').classList.add('hidden');
  document.removeEventListener('pointerdown', qlOutsideDown, true);
  qlPersistFromDom();
}

function qlOutsideDown(e) {
  if (e.target.closest('.ql-tile') || e.target.closest('#ql-done')) return;
  exitQlEdit();
}

// ── Daily Randomize ───────────────────────────────────────────────────────────

function getRandomThemeFromPool(pool) {
  let keys;
  if (pool === 'all') {
    keys = Object.keys(THEME_MAP);
  } else if (pool === 'favorites') {
    keys = (settings.favorites || []).filter(k => THEME_MAP[k]);
    if (!keys.length) keys = Object.keys(THEME_MAP);
  } else {
    const group = THEME_GROUPS.find(g => g.key === pool);
    keys = group ? group.themes : Object.keys(THEME_MAP);
  }
  return keys[Math.floor(Math.random() * keys.length)];
}

function checkDailyRandomize() {
  if (!settings.randomizeDaily) return;
  const today = new Date().toISOString().slice(0, 10);
  if (settings.randomizeDailyDate === today) return;
  const theme = getRandomThemeFromPool(settings.randomizeDaily);
  settings.theme = theme;
  settings.randomizeDailyDate = today;
  Storage.save({ theme, randomizeDailyDate: today });
}

function handleRandomizeClick(pool) {
  pendingPresetBg = null;
  const wasActive = settings.randomizeDaily === pool;
  if (wasActive) {
    settings.randomizeDaily = null;
    Storage.save({ randomizeDaily: null });
    refreshSelectionMarks();
  } else {
    const theme = getRandomThemeFromPool(pool);
    const today = new Date().toISOString().slice(0, 10);
    settings.randomizeDaily = pool;
    settings.theme = theme;
    settings.randomizeDailyDate = today;
    Storage.save({ randomizeDaily: pool, theme, randomizeDailyDate: today });
    recomputeLive();          // the picked background may carry its own preset
    applyLiveToPage(true);
    refreshSelectionMarks();
    startAppearancePreview();
  }
  document.querySelectorAll('.randomize-daily-btn').forEach(b =>
    b.classList.toggle('active', !wasActive && b.dataset.pool === pool)
  );
}

function makeRandomizeDailyBtn(pool, label) {
  const btn = document.createElement('button');
  btn.className = 'theme-option randomize-daily-btn' + (settings.randomizeDaily === pool ? ' active' : '');
  btn.dataset.pool = pool;
  btn.type = 'button';

  const icon = document.createElement('span');
  icon.className = 'rdaily-icon';
  icon.textContent = '↻';

  const lbl = document.createElement('span');
  lbl.textContent = label;

  btn.appendChild(icon);
  btn.appendChild(lbl);
  btn.addEventListener('click', () => handleRandomizeClick(pool));
  return btn;
}


// ── Favorites ─────────────────────────────────────────────────────────────────

function toggleFavorite(themeKey) {
  const favs = settings.favorites || [];
  const idx = favs.indexOf(themeKey);
  if (idx === -1) favs.push(themeKey);
  else favs.splice(idx, 1);
  settings.favorites = favs;
  Storage.save({ favorites: favs });

  const isFav = favs.includes(themeKey);
  document.querySelectorAll(`.theme-heart[data-theme="${themeKey}"]`).forEach(heart => {
    heart.classList.toggle('favorited', isFav);
    heart.setAttribute('aria-label', (isFav ? 'Unfavorite ' : 'Favorite ') + THEME_LABELS[themeKey]);
  });

  // Unfavoriting while browsing the Favorites pseudo-category removes tiles
  if (nav.view === 'backgrounds' && nav.categoryKey === 'favorites') {
    buildBackgroundGrid('favorites');
  }
}

// ── Background picker navigation (Home → Backgrounds → Edit) ────────────────
// Home's category tiles jump straight to a category's backgrounds; Back returns
// straight to Home. There's no separate categories page — the tiles under the
// preview are that index.

const VIEW_INDEX = { main: 0, backgrounds: 1 };
// pickMode: 'select' (tap a tile to use it) | 'preset' (tap a tile to attach a
// preset to it). categoryKey 'all' shows every background grouped by category.
const nav = { view: 'main', categoryKey: null, pickMode: 'select' };
let activePanel = 'home';   // which rail section is showing on the main view
let showPanel;              // set by initRailNav; switches the active rail section
let livePreview;

function applyNavTransforms(animate = true) {
  const current = VIEW_INDEX[nav.view];
  document.querySelectorAll('.settings-view').forEach(v => {
    const i = VIEW_INDEX[v.dataset.view];
    if (!animate) v.classList.add('no-anim');
    v.style.transform = `translateX(${(i - current) * 100}%)`;
    v.setAttribute('aria-hidden', i === current ? 'false' : 'true');
    if (!animate) { v.getBoundingClientRect(); v.classList.remove('no-anim'); }
  });
}

function navigateTo(view, arg = null, animate = true) {
  nav.view = view;
  if (view === 'backgrounds') nav.categoryKey = arg;

  if (view === 'main') {
    renderAppearance();
  } else if (view === 'backgrounds') {
    livePreview.stop();
    stopPresetPreviews();
    buildBackgroundGrid(nav.categoryKey);
  }
  applyNavTransforms(animate);
}

// Enter the background grid to select a background normally.
function openBackgroundBrowse(categoryKey) {
  nav.pickMode = 'select';
  navigateTo('backgrounds', categoryKey);
}

// Enter the background grid (all backgrounds) to attach a new preset.
function openPresetPicker() {
  nav.pickMode = 'preset';
  navigateTo('backgrounds', 'all');
}

// ── Screen 1: Appearance ─────────────────────────────────────────────────────

function renderAppearance() {
  document.getElementById('appearance-name').textContent =
    THEME_LABELS[settings.theme] || '';
  buildCategoryGrid('home-category-grid');   // category tiles under the preview
  startAppearancePreview();
}

function startAppearancePreview() {
  const overlay = document.getElementById('settings-overlay');
  // The preview lives in the Home panel, so only run it while that tab is shown.
  if (!overlay.classList.contains('open') || nav.view !== 'main' || activePanel !== 'home') return;
  livePreview.show(THEME_MAP[settings.theme] || StarfieldTheme, {
    intensity:  Storage.intensityValue(live.intensity),
    quality:    Storage.qualityValue(live.intensity),
    speed:      live.animSpeed,
    staticMode: live.staticMode,
  });
}

// ── Screen 2: Category grid ──────────────────────────────────────────────────

function makeCheckBadge() {
  const badge = document.createElement('span');
  badge.className = 'tile-check';
  badge.innerHTML =
    '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
    '<path d="M2.5 6.3L5 8.8l4.5-5.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return badge;
}

function makeThumbImg(themeKey) {
  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  img.addEventListener('load', () => img.classList.add('loaded'));
  getThumb(themeKey).then(url => { if (url) img.src = url; });
  return img;
}

function buildCategoryGrid(gridId = 'category-grid') {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';

  const activeCat = categoryOf(settings.theme);
  const entries = [getCategoryEntry('favorites'), ...THEME_GROUPS];

  entries.forEach(cat => {
    const isActive = !settings.randomizeDaily && cat.key !== 'favorites' && activeCat && activeCat.key === cat.key;

    const btn = document.createElement('button');
    btn.className = 'category-tile';
    btn.type = 'button';
    btn.dataset.catKey = cat.key;
    btn.setAttribute('aria-label', `${cat.label} backgrounds`);

    const thumb = document.createElement('span');
    thumb.className = 'tile-thumb square' + (isActive ? ' selected' : '');

    if (cat.themes.length > 0) {
      const rep = cat.themes.includes(settings.theme) ? settings.theme : cat.themes[0];
      thumb.appendChild(makeThumbImg(rep));
    } else {
      const ph = document.createElement('div');
      ph.className = 'fav-placeholder';
      ph.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20.5S3 14.5 3 8.5a5.5 5.5 0 0 1 9-4.24A5.5 5.5 0 0 1 21 8.5c0 6-9 12-9 12z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      thumb.appendChild(ph);
    }
    if (isActive) thumb.appendChild(makeCheckBadge());

    const label = document.createElement('span');
    label.className = 'tile-label';
    label.textContent = cat.label;

    btn.append(thumb, label);
    btn.addEventListener('click', () => openBackgroundBrowse(cat.key));
    grid.appendChild(btn);
  });
}

// ── Screen 3: Background grid ────────────────────────────────────────────────

function buildBackgroundGrid(categoryKey) {
  const preset = nav.pickMode === 'preset';
  const randWrap = document.getElementById('backgrounds-randomize');
  const grid = document.getElementById('background-grid');
  randWrap.innerHTML = '';
  grid.innerHTML = '';

  // 'all' shows every background grouped by category (used by the preset picker).
  if (categoryKey === 'all') {
    document.getElementById('backgrounds-title').textContent =
      preset ? 'Choose a Background' : 'All Backgrounds';
    THEME_GROUPS.forEach(group => {
      const heading = document.createElement('div');
      heading.className = 'bg-section-label';
      heading.textContent = group.label;
      grid.appendChild(heading);
      group.themes.forEach(themeKey => grid.appendChild(makeBackgroundTile(themeKey)));
    });
    return;
  }

  const cat = getCategoryEntry(categoryKey);
  if (!cat) { navigateTo('main'); return; }

  document.getElementById('backgrounds-title').textContent = cat.label;

  if (!cat.themes.length) {
    const empty = document.createElement('div');
    empty.className = 'favorites-empty';
    empty.textContent = 'No Favorites Added';
    randWrap.appendChild(empty);
    return;
  }

  if (!preset) randWrap.appendChild(makeRandomizeDailyBtn(cat.key, `Randomize ${cat.label} Daily`));
  cat.themes.forEach(themeKey => grid.appendChild(makeBackgroundTile(themeKey)));
}

function makeBackgroundTile(themeKey) {
  const isActive = !settings.randomizeDaily && settings.theme === themeKey;
  const isFav = (settings.favorites || []).includes(themeKey);

  const tile = document.createElement('div');
  tile.className = 'background-tile';
  tile.dataset.theme = themeKey;

  const thumbBtn = document.createElement('button');
  thumbBtn.type = 'button';
  thumbBtn.className = 'tile-thumb wide' + (isActive ? ' selected' : '');
  thumbBtn.setAttribute('aria-label', `Use ${THEME_LABELS[themeKey]} background`);
  thumbBtn.appendChild(makeThumbImg(themeKey));
  if (isActive) thumbBtn.appendChild(makeCheckBadge());

  const heart = document.createElement('button');
  heart.type = 'button';
  heart.className = 'theme-heart' + (isFav ? ' favorited' : '');
  heart.dataset.theme = themeKey;
  heart.setAttribute('aria-label', (isFav ? 'Unfavorite ' : 'Favorite ') + THEME_LABELS[themeKey]);
  heart.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path class="heart-path" d="M12 20.5S3 14.5 3 8.5a5.5 5.5 0 0 1 9-4.24A5.5 5.5 0 0 1 21 8.5c0 6-9 12-9 12z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  heart.addEventListener('click', e => { e.stopPropagation(); toggleFavorite(themeKey); });
  thumbBtn.appendChild(heart);

  // Tapping the tile selects the background — or, in preset-pick mode, attaches
  // a new preset to it.
  thumbBtn.addEventListener('click', () =>
    nav.pickMode === 'preset' ? choosePresetBackground(themeKey) : applyTheme(themeKey));

  const row = document.createElement('div');
  row.className = 'tile-name-row';

  const name = document.createElement('span');
  name.className = 'tile-label';
  name.textContent = THEME_LABELS[themeKey];

  row.append(name);
  tile.append(thumbBtn, row);
  return tile;
}

// Applying stays on the grid (Chrome behavior): swap the live background and
// move the checkmark, no navigation.
function applyTheme(themeKey) {
  pendingPresetBg = null;     // a normal selection isn't a preset-edit session
  settings.theme = themeKey;
  Storage.save({ theme: themeKey });
  recomputeLive();            // apply the new background's preset (if it has one)
  applyLiveToPage(true);
  refreshSelectionMarks();
}

function refreshSelectionMarks() {
  const showCheck = !settings.randomizeDaily;
  const activeCat = showCheck ? categoryOf(settings.theme) : null;

  document.querySelectorAll('.background-tile').forEach(tile => {
    const thumb = tile.querySelector('.tile-thumb');
    const isActive = showCheck && tile.dataset.theme === settings.theme;
    thumb.classList.toggle('selected', isActive);
    const badge = thumb.querySelector('.tile-check');
    if (isActive && !badge) thumb.appendChild(makeCheckBadge());
    else if (!isActive && badge) badge.remove();
  });

  document.querySelectorAll('.category-tile').forEach(tile => {
    const thumb = tile.querySelector('.tile-thumb');
    const isActive = activeCat && tile.dataset.catKey === activeCat.key;
    thumb.classList.toggle('selected', !!isActive);
    const badge = thumb.querySelector('.tile-check');
    if (isActive && !badge) thumb.appendChild(makeCheckBadge());
    else if (!isActive && badge) badge.remove();
  });

  document.getElementById('appearance-name').textContent =
    THEME_LABELS[settings.theme] || '';
}

// ── Advanced Customization: per-background presets ───────────────────────────

// Pick a background from the preset picker: switch the live tab to it and keep
// it pending so the user can tweak the toolbar (live) and then Save.
function choosePresetBackground(themeKey) {
  pendingPresetBg = themeKey;
  settings.theme = themeKey;
  Storage.save({ theme: themeKey });
  recomputeLive();               // pending === active → previews the live toolbar
  applyLiveToPage(true);
  refreshSelectionMarks();
  nav.pickMode = 'select';
  navigateTo('main');
  showPanel('advanced');
}

// Re-open a saved preset for editing: make it active + pending so toolbar tweaks
// preview live before re-saving.
function editPreset(themeKey) {
  pendingPresetBg = themeKey;
  settings.theme = themeKey;
  Storage.save({ theme: themeKey });
  recomputeLive();
  applyLiveToPage(true);
  refreshSelectionMarks();
  buildAdvancedPanel();
}

// Snapshot the current toolbar settings as this background's preset.
function savePreset(themeKey) {
  settings.overrides = settings.overrides || {};
  settings.overrides[themeKey] = snapshotSettings();
  savePresets();
  recomputeLive();
  buildAdvancedPanel();
  flashSaved(themeKey);
}

function deletePreset(themeKey) {
  if (settings.overrides) delete settings.overrides[themeKey];
  savePresets();
  if (pendingPresetBg === themeKey) pendingPresetBg = null;
  if (settings.theme === themeKey) { recomputeLive(); applyLiveToPage(true); }
  buildAdvancedPanel();
}

// A live animated scene can run behind each preset card, but the total load is
// bounded so it stays light even if every background (22) has a preset: at most
// PRESET_ANIM_MAX cards animate at once, at a render resolution that shrinks as
// more of them run; any beyond the cap fall back to the static snapshot image
// (no animation loop, no held WebGL context). Active previews are tracked here
// so they can all be torn down when the panel is rebuilt or hidden.
const PRESET_ANIM_MAX = 4;
let presetPreviews = [];

function stopPresetPreviews() {
  presetPreviews.forEach(p => { try { p.stop(); } catch (e) { /* ignore */ } });
  presetPreviews = [];
}

// dpr cap for the animating cards — lower as more run so total fill cost is flat.
function presetAnimQuality(animatingCount) {
  if (animatingCount <= 2) return 1.0;
  if (animatingCount <= 3) return 0.6;
  return 0.45;
}

function buildAdvancedPanel() {
  const list = document.getElementById('preset-list');
  if (!list) return;
  stopPresetPreviews();
  list.innerHTML = '';

  const keys = new Set(Object.keys(settings.overrides || {}));
  if (pendingPresetBg) keys.add(pendingPresetBg);
  const arr = [...keys].filter(k => THEME_MAP[k]);

  if (!arr.length) {
    const empty = document.createElement('div');
    empty.className = 'preset-empty';
    empty.textContent = 'No presets yet. Add one to save custom settings for a specific background.';
    list.appendChild(empty);
    return;
  }
  const animatingCount = Math.min(arr.length, PRESET_ANIM_MAX);
  const quality = presetAnimQuality(animatingCount);
  arr.forEach((themeKey, i) => list.appendChild(makePresetCard(themeKey, i < PRESET_ANIM_MAX, quality)));
}

function makePresetCard(themeKey, animate, animQuality) {
  const saved    = !!overrideFor(themeKey);
  const isActive = settings.theme === themeKey;

  const card = document.createElement('div');
  card.className = 'preset-card' + (isActive ? ' active' : '');
  card.dataset.theme = themeKey;

  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'preset-card-thumb tile-thumb wide';
  thumb.setAttribute('aria-label', `Edit ${THEME_LABELS[themeKey]} preset`);

  // Within the animation budget, run a live scene with this preset's own
  // intensity / speed / static settings (resolution capped by animQuality).
  // Otherwise fall back to the static snapshot so extra cards cost nothing.
  const eff = effectiveFor(themeKey);
  if (animate) {
    const sceneEl = document.createElement('div');
    sceneEl.className = 'preset-live';
    thumb.appendChild(sceneEl);
    const preview = new ScenePreview.LivePreview(sceneEl);
    preview.show(THEME_MAP[themeKey] || StarfieldTheme, {
      intensity:  Storage.intensityValue(eff.intensity),
      quality:    Math.min(Storage.qualityValue(eff.intensity), animQuality),
      speed:      eff.animSpeed,
      staticMode: eff.staticMode,
    });
    presetPreviews.push(preview);
  } else {
    thumb.appendChild(makeThumbImg(themeKey));
  }

  thumb.appendChild(makePresetPreviewOverlay(themeKey));
  if (isActive) thumb.appendChild(makeCheckBadge());
  thumb.addEventListener('click', () => editPreset(themeKey));

  const name = document.createElement('div');
  name.className = 'preset-card-name';
  name.textContent = THEME_LABELS[themeKey];

  const status = document.createElement('div');
  status.className = 'preset-card-status';
  status.textContent = saved
    ? (isActive ? 'Active — showing this preset' : 'Saved preset')
    : 'Adjust the toolbar, then save';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'preset-save-btn';
  saveBtn.textContent = 'Save Current Settings';
  saveBtn.addEventListener('click', () => savePreset(themeKey));

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'preset-delete-btn';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => askDeletePreset(themeKey));

  card.append(thumb, name, status, saveBtn, delBtn);
  return card;
}

// Effective settings a background renders with: its saved preset merged over
// the global toolbar (an unsaved/pending background just uses global).
function effectiveFor(themeKey) {
  return Object.assign({}, settings, overrideFor(themeKey) || {});
}

// Grid geometry for a given quick-link mode at the current window size — the
// same math as qlGeom() but without the live-page protected-rect, so a preview
// can map each saved {row,col} to a fraction of the screen.
function qlGeomFor(iconOnly) {
  const { w, h } = iconOnly ? { w: 80, h: 90 } : { w: 184, h: 58 };
  const cols = Math.max(1, Math.floor((window.innerWidth  - QL_EDGE * 2) / w));
  const rows = Math.max(1, Math.floor((window.innerHeight - QL_EDGE * 2) / h));
  const ox = Math.round((window.innerWidth  - cols * w) / 2);
  const oy = Math.round((window.innerHeight - rows * h) / 2);
  return { w, h, cols, rows, ox, oy };
}

// A faithful, static miniature of the real new-tab drawn over a preset's scene
// thumbnail — the actual header/search/quick-link markup and classes rendered
// at full window size, then CSS-scaled down to cover the tile. Because the
// stage is exactly window-sized, the live page's vw/rem-based sizing lands
// identically, so it's the real look shrunk, not a redrawn approximation.
function makePresetPreviewOverlay(themeKey) {
  const eff = effectiveFor(themeKey);
  const overlay = document.createElement('div');
  overlay.className = 'preset-preview-overlay';

  const vpW = window.innerWidth, vpH = window.innerHeight;
  const stage = document.createElement('div');
  stage.className = 'ppv-stage';
  stage.dataset.logoPosition = eff.logoPosition || 'center';
  stage.style.width  = vpW + 'px';
  stage.style.height = vpH + 'px';
  stage.style.setProperty('--logo-scale', eff.logoScale || 1);
  stage.style.setProperty('--ui-font', (FONTS[eff.font] || FONTS.system).stack);

  if (!eff.hideText) stage.appendChild(previewHeader(eff));

  if (!eff.hideSearch) {
    const search = document.createElement('div');
    search.className = 'ppv-search';
    const input = document.createElement('div');
    input.className = 'ppv-search-input';
    input.textContent = 'Search…';
    search.appendChild(input);
    stage.appendChild(search);
  }

  const links = document.createElement('div');
  links.className = 'ppv-links' + (eff.iconOnly ? ' icon-only' : '');
  const g = qlGeomFor(!!eff.iconOnly);
  const grid = eff.quickLinkGrid || {};
  qlLinks().forEach(link => {
    const p = grid[link.id];
    if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col)) return;
    links.appendChild(makePreviewTile(link, p.row, p.col, g, !!eff.iconOnly));
  });
  stage.appendChild(links);

  overlay.appendChild(stage);

  // Scale the full-size stage to cover the tile once the tile has a measured
  // size (same crop behaviour as the scene image's object-fit: cover).
  requestAnimationFrame(() => {
    const tw = overlay.clientWidth, th = overlay.clientHeight;
    if (tw && th) {
      const s = Math.max(tw / vpW, th / vpH);
      stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    }
    stage.style.visibility = 'visible';
  });

  return overlay;
}

// A non-interactive clone of a quick-link tile (no delete badge / drag / jiggle),
// using the real .ql-tile markup so it inherits the live pill / icon styling.
function makePreviewTile(link, row, col, g, iconOnly) {
  const label = link.label || BrandColors.siteName(link.url);
  const tile = document.createElement('div');
  tile.className = 'ql-tile';
  tile.style.width  = g.w + 'px';
  tile.style.height = g.h + 'px';
  tile.style.left = (g.ox + col * g.w) + 'px';
  tile.style.top  = (g.oy + row * g.h) + 'px';

  const body = document.createElement('div');
  body.className = 'ql-body';
  const box = document.createElement('div');
  box.className = 'ql-icon-box';
  body.appendChild(box);
  decorateQuickTile(box, link.url, label);

  if (!iconOnly) {
    const lbl = document.createElement('span');
    lbl.className = 'ql-tile-label';
    lbl.textContent = label;
    body.appendChild(lbl);
  }
  tile.appendChild(body);
  return tile;
}

// The header block (logo / clock / date) for a preview, mirroring renderHeader +
// tickClock and reusing the live classes so it renders identically.
function previewHeader(eff) {
  const now = new Date();
  const is12 = eff.clockFormat === '12h';
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
  let h = now.getHours();
  if (is12) h = h % 12 || 12;
  const m = pad(now.getMinutes());

  const header = document.createElement('div');
  header.className = 'ppv-header';
  const layout = eff.layout || 'logo';

  if (layout === 'time') {
    header.classList.toggle('has-subline', !!eff.showDate);
    const row = document.createElement('div');
    row.className = 'time-row';
    row.appendChild(ppvEl('span', 'ppv-clock-hm', `${h}:${m}`));
    if (eff.showSeconds) row.appendChild(ppvEl('span', 'clock-sub', `:${pad(now.getSeconds())}`));
    if (is12) row.appendChild(ppvEl('span', 'clock-sub', ` ${ampm}`));
    header.appendChild(row);
    if (eff.showDate) {
      header.appendChild(ppvEl('div', 'ppv-clock-date-line',
        now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })));
    }
  } else if (layout === 'date') {
    header.classList.add('has-subline');
    header.appendChild(ppvEl('div', 'ppv-date-weekday', now.toLocaleDateString('en-US', { weekday: 'long' })));
    const line = document.createElement('div');
    line.className = 'ppv-date-line';
    if (eff.showTimeInDate) {
      line.appendChild(ppvEl('span', 'ppv-date-sub', `${h}:${m}${is12 ? ' ' + ampm : ''}`));
      line.appendChild(ppvEl('span', 'ppv-date-sub', '·'));
    }
    line.appendChild(ppvEl('span', 'ppv-date-sub', now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })));
    header.appendChild(line);
  } else {
    header.appendChild(ppvEl('div', 'wordmark', 'LIV'));
  }
  return header;
}

function ppvEl(tag, cls, text) {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = text;
  return el;
}

// Brief visual confirmation on a preset's Save button.
function flashSaved(themeKey) {
  const btn = document.querySelector(`.preset-card[data-theme="${themeKey}"] .preset-save-btn`);
  if (!btn) return;
  const prev = btn.textContent;
  btn.textContent = 'Saved ✓';
  btn.classList.add('saved');
  setTimeout(() => { btn.textContent = prev; btn.classList.remove('saved'); }, 1200);
}

// ── Delete-preset confirmation popup ─────────────────────────────────────────

let deleteTarget = null;

function askDeletePreset(themeKey) {
  deleteTarget = themeKey;
  document.getElementById('preset-delete-confirm').classList.remove('hidden');
}

function initDeleteConfirm() {
  const overlay = document.getElementById('preset-delete-confirm');
  const close = () => { overlay.classList.add('hidden'); deleteTarget = null; };
  document.getElementById('preset-delete-yes').addEventListener('click', () => {
    if (deleteTarget) deletePreset(deleteTarget);
    close();
  });
  document.getElementById('preset-delete-no').addEventListener('click', close);
}

// ── Adjust-preset popup ──────────────────────────────────────────────────────
// When the active background is showing a SAVED preset and the user changes a
// toolbar setting, ask whether that change should be written into the preset.
// (Not shown while a preset is being set up on the Advanced page — there the
// toolbar previews live and Save is explicit.)

let adjustOpen = false;
let adjustFields = null;

function maybeAdjustPreset(fields) {
  if (adjustOpen || !activeUsesPreset()) return;
  const ov = overrideFor(settings.theme);
  // Only ask about fields whose new global value actually differs from the preset.
  const changed = fields.filter(k => ov[k] !== settings[k]);
  if (!changed.length) return;
  adjustFields = changed;
  adjustOpen = true;
  document.getElementById('preset-adjust-name').textContent =
    THEME_LABELS[settings.theme] || 'This background';
  document.getElementById('preset-adjust-confirm').classList.remove('hidden');
}

function initAdjustConfirm() {
  const overlay = document.getElementById('preset-adjust-confirm');
  const close = () => { overlay.classList.add('hidden'); adjustOpen = false; adjustFields = null; };
  document.getElementById('preset-adjust-yes').addEventListener('click', () => {
    const ov = overrideFor(settings.theme);
    if (ov && adjustFields) {
      adjustFields.forEach(k => { ov[k] = settings[k]; });   // write the changed field(s) in
      savePresets();
      recomputeLive();
      applyLiveToPage(true);
    }
    close();
  });
  document.getElementById('preset-adjust-no').addEventListener('click', close);
}

// ── Settings panel ────────────────────────────────────────────────────────────

function initSettings() {
  const btn     = document.getElementById('settings-btn');
  const overlay = document.getElementById('settings-overlay');
  const panel   = document.getElementById('settings-panel');

  livePreview = new ScenePreview.LivePreview(document.getElementById('appearance-preview'));
  applyNavTransforms(false);

  const open = () => {
    overlay.classList.remove('hidden', 'closing');
    overlay.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    showPanel('home');   // always open on the Backgrounds tab
    document.querySelector('#view-main .settings-close').focus();
  };
  const close = () => {
    overlay.classList.remove('open');
    overlay.classList.add('closing');
    livePreview.stop();
    stopPresetPreviews();
    // End any preset-edit session: the active background settles onto its saved
    // preset (if any) now that we're no longer previewing the toolbar on it.
    if (pendingPresetBg) { pendingPresetBg = null; recomputeLive(); applyLiveToPage(true); }
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.classList.remove('closing');
      navigateTo('main', null, false);   // reopen on the main screen
    }, 280);
    panel.setAttribute('aria-hidden', 'true');
    btn.focus();
  };

  btn.addEventListener('click', open);
  document.querySelectorAll('.settings-close').forEach(b => b.addEventListener('click', close));
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

  // Back from the background grid returns to whichever panel launched it.
  document.getElementById('back-to-home').addEventListener('click', () => {
    const toPanel = nav.pickMode === 'preset' ? 'advanced' : 'home';
    nav.pickMode = 'select';
    navigateTo('main');
    showPanel(toPanel);
  });
  document.getElementById('add-preset').addEventListener('click', openPresetPicker);

  const randAll = document.getElementById('randomize-all-daily');
  randAll.classList.toggle('active', settings.randomizeDaily === 'all');
  randAll.addEventListener('click', () => handleRandomizeClick('all'));

  buildLogoPositionPicker();
  buildLogoScaleSlider();
  buildFontSettings();
  buildDisplaySettings();
  buildQuickLinksEditor();
  buildAnimationSettings();
  initRailNav();
  initDeleteConfirm();
  initAdjustConfirm();
}

// Logo position picker — corner + center-column dots over a mini new-tab rect.
function buildLogoPositionPicker() {
  const dots = document.querySelectorAll('.logo-pos-dot');
  const refresh = () => dots.forEach(d => d.classList.toggle('active', d.dataset.pos === settings.logoPosition));
  refresh();
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      settings.logoPosition = dot.dataset.pos;
      Storage.save({ logoPosition: dot.dataset.pos });
      recomputeLive();
      applyLogoPosition();
      refresh();
      maybeAdjustPreset(['logoPosition']);
    });
  });
}

// Text size slider — scales the header text regardless of logo position.
function buildLogoScaleSlider() {
  const slider = document.getElementById('setting-logo-scale');
  const label  = document.getElementById('logo-scale-label');
  const setLabel = v => { label.textContent = Math.round(v * 100) + '%'; };

  slider.value = settings.logoScale || 1;
  setLabel(slider.value);

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    settings.logoScale = v;
    Storage.save({ logoScale: v });
    recomputeLive();
    applyLogoScale();
    setLabel(v);
  });
  slider.addEventListener('change', () => maybeAdjustPreset(['logoScale']));
}

// Left icon rail: only the active section's panel is shown. The Home panel
// (background preview + Change Background) is the default.
function initRailNav() {
  const railBtns = document.querySelectorAll('.rail-btn');
  const panels   = document.querySelectorAll('.settings-panel-section');

  showPanel = panel => {
    activePanel = panel;
    railBtns.forEach(b => {
      const on = b.dataset.panel === panel;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => p.classList.toggle('active', p.dataset.panel === panel));

    // The live scene preview only belongs to the Backgrounds (home) panel.
    if (panel === 'home') renderAppearance();
    else livePreview.stop();
    // Preset cards animate only while the Advanced panel is showing.
    if (panel === 'advanced') buildAdvancedPanel();
    else stopPresetPreviews();
  };

  railBtns.forEach(btn => btn.addEventListener('click', () => showPanel(btn.dataset.panel)));
  showPanel(activePanel);
}

// Font picker
function buildFontSettings() {
  const container = document.getElementById('font-picker');
  container.innerHTML = '';
  for (const [key, font] of Object.entries(FONTS)) {
    const btn = document.createElement('button');
    btn.className = 'font-option' + (settings.font === key ? ' active' : '');
    btn.dataset.font = key;
    btn.type = 'button';
    btn.style.fontFamily = font.stack;
    btn.textContent = font.label;
    btn.addEventListener('click', () => {
      settings.font = key;
      Storage.save({ font: key });
      recomputeLive();
      applyFont();
      document.querySelectorAll('.font-option').forEach(b => b.classList.toggle('active', b === btn));
      maybeAdjustPreset(['font']);
    });
    container.appendChild(btn);
  }
}

// Display / Layout settings
function buildDisplaySettings() {
  const layoutBtns  = document.querySelectorAll('.layout-btn');
  const timeSubEl   = document.getElementById('time-sub-settings');
  const dateSubEl   = document.getElementById('date-sub-settings');
  const h12El       = document.getElementById('setting-12h');
  const secsEl      = document.getElementById('setting-seconds');
  const dateEl      = document.getElementById('setting-date');
  const timeDateEl  = document.getElementById('setting-time-in-date');
  const hideTextEl  = document.getElementById('setting-hide-text');
  const hideSearchEl= document.getElementById('setting-hide-search');
  const brandEl     = document.getElementById('setting-brand-colors');
  const iconOnlyEl  = document.getElementById('setting-icon-only');

  const updateSubSections = () => {
    timeSubEl.hidden = settings.layout !== 'time';
    dateSubEl.hidden = settings.layout !== 'date';
  };

  layoutBtns.forEach(b => b.classList.toggle('active', !settings.hideText && b.dataset.value === settings.layout));
  h12El.checked       = settings.clockFormat === '12h';
  secsEl.checked      = settings.showSeconds;
  dateEl.checked      = settings.showDate;
  timeDateEl.checked  = settings.showTimeInDate;
  hideTextEl.checked  = settings.hideText;
  hideSearchEl.checked= settings.hideSearch;
  brandEl.checked     = settings.brandColors;
  iconOnlyEl.checked  = settings.iconOnly;
  updateSubSections();

  layoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      settings.layout = btn.dataset.value;
      Storage.save({ layout: btn.dataset.value });
      layoutBtns.forEach(b => b.classList.toggle('active', b === btn));
      updateSubSections();
      recomputeLive();
      renderHeader();
      tickClock();
      maybeAdjustPreset(['layout']);
    });
  });

  h12El.addEventListener('change', () => {
    settings.clockFormat = h12El.checked ? '12h' : '24h';
    Storage.save({ clockFormat: settings.clockFormat });
    recomputeLive();
    tickClock();
    maybeAdjustPreset(['clockFormat']);
  });
  secsEl.addEventListener('change', () => {
    settings.showSeconds = secsEl.checked;
    Storage.save({ showSeconds: secsEl.checked });
    recomputeLive();
    tickClock();
    maybeAdjustPreset(['showSeconds']);
  });
  dateEl.addEventListener('change', () => {
    settings.showDate = dateEl.checked;
    Storage.save({ showDate: dateEl.checked });
    recomputeLive();
    renderHeader();
    tickClock();
    maybeAdjustPreset(['showDate']);
  });
  timeDateEl.addEventListener('change', () => {
    settings.showTimeInDate = timeDateEl.checked;
    Storage.save({ showTimeInDate: timeDateEl.checked });
    recomputeLive();
    renderHeader();
    tickClock();
    maybeAdjustPreset(['showTimeInDate']);
  });
  hideTextEl.addEventListener('change', () => {
    settings.hideText = hideTextEl.checked;
    Storage.save({ hideText: hideTextEl.checked });
    recomputeLive();
    renderHeader();
    maybeAdjustPreset(['hideText']);
  });
  hideSearchEl.addEventListener('change', () => {
    settings.hideSearch = hideSearchEl.checked;
    Storage.save({ hideSearch: hideSearchEl.checked });
    recomputeLive();
    renderSearch();
    maybeAdjustPreset(['hideSearch']);
  });
  brandEl.addEventListener('change', () => {
    settings.brandColors = brandEl.checked;
    Storage.save({ brandColors: brandEl.checked });
    recomputeLive();
    renderQuickLinks();
    maybeAdjustPreset(['brandColors']);
  });
  iconOnlyEl.addEventListener('change', () => {
    settings.iconOnly = iconOnlyEl.checked;
    Storage.save({ iconOnly: iconOnlyEl.checked });
    renderQuickLinks();
  });
}

// Quick links editor
function buildQuickLinksEditor() {
  const container = document.getElementById('quick-links-editor');
  const addBtn    = document.getElementById('add-quick-link');

  const renderEditor = () => {
    container.innerHTML = '';
    const links = settings.quickLinks || [];
    if (!links.length) {
      const empty = document.createElement('div');
      empty.className = 'ql-empty';
      empty.textContent = 'No links yet';
      container.appendChild(empty);
    }
    links.forEach((link, i) => {
      const row = document.createElement('div');
      row.className = 'ql-row';
      row.innerHTML = `
        <input class="ql-label" type="text" placeholder="Label" value="${escHtml(link.label || '')}" maxlength="20">
        <input class="ql-url"   type="url"  placeholder="Paste entire link"  value="${escHtml(link.url   || '')}">
        <button class="ql-remove" type="button" aria-label="Remove">✕</button>
      `;
      row.querySelector('.ql-label').addEventListener('input', e => { settings.quickLinks[i].label = e.target.value; persist(); });
      row.querySelector('.ql-url').addEventListener('input',   e => { settings.quickLinks[i].url   = e.target.value; persist(); });
      row.querySelector('.ql-remove').addEventListener('click', () => {
        const removed = settings.quickLinks.splice(i, 1)[0];
        if (removed && settings.quickLinkGrid) delete settings.quickLinkGrid[removed.id];
        Storage.save({ quickLinkGrid: settings.quickLinkGrid || {} });
        persist(true);
      });
      container.appendChild(row);
    });
    addBtn.disabled = links.length >= QL_MAX;
  };

  const persist = (rebuildEditor = false) => {
    Storage.save({ quickLinks: settings.quickLinks });
    renderQuickLinks();
    if (rebuildEditor) renderEditor();
  };

  addBtn.addEventListener('click', () => {
    if ((settings.quickLinks || []).length >= QL_MAX) return;
    settings.quickLinks.push({ id: 'ql_' + Math.random().toString(36).slice(2, 9), label: '', url: '' });
    renderEditor();
  });

  // Let the on-page delete badge refresh this editor when it's open.
  rebuildQuickLinksEditor = renderEditor;
  renderEditor();
}

// Animation settings
function buildAnimationSettings() {
  const btns     = document.querySelectorAll('.intensity-btn');
  const staticEl = document.getElementById('setting-static');
  const speedEl  = document.getElementById('setting-speed');
  const speedLbl = document.getElementById('speed-label');

  btns.forEach(b => b.classList.toggle('active', b.dataset.value === settings.intensity));
  staticEl.checked = settings.staticMode;

  const spd = settings.animSpeed || 1.0;
  speedEl.value = spd;
  speedLbl.textContent = spd.toFixed(2).replace(/\.?0+$/, '') + '×';

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      settings.intensity = btn.dataset.value;
      Storage.save({ intensity: btn.dataset.value });
      btns.forEach(b => b.classList.toggle('active', b === btn));
      recomputeLive();
      // When the active background is showing a frozen preset, a global change
      // doesn't alter `live` — skip the scene re-init; otherwise apply it.
      applyLiveEngine(!activeUsesPreset());
      startAppearancePreview();
      maybeAdjustPreset(['intensity']);
    });
  });

  speedEl.addEventListener('input', () => {
    const v = parseFloat(speedEl.value);
    settings.animSpeed = v;
    Storage.save({ animSpeed: v });
    recomputeLive();
    engine.setOptions({ speed: live.animSpeed });
    livePreview.setSpeed(live.animSpeed);
    const display = Number.isInteger(v) ? v + '' : v.toFixed(2).replace(/0+$/, '');
    speedLbl.textContent = display + '×';
  });
  speedEl.addEventListener('change', () => maybeAdjustPreset(['animSpeed']));

  staticEl.addEventListener('change', () => {
    settings.staticMode = staticEl.checked;
    Storage.save({ staticMode: staticEl.checked });
    recomputeLive();
    engine.setOptions({ staticMode: live.staticMode });
    startAppearancePreview();
    maybeAdjustPreset(['staticMode']);
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
