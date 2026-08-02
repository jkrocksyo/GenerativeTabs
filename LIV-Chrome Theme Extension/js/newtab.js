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
  waveSurface:          WaveSurfaceTheme,
  torusWave:            TorusWaveTheme,
  harmonicSphere:       HarmonicSphereTheme,
  doublePendulum:       DoublePendulumTheme,
  newtonsCradle:        NewtonsCradleTheme,
  atom:                 AtomTheme,
  gyroscope:            GyroscopeTheme,
  dnaHelix:             DnaHelixTheme,
  harmonicSurface:      HarmonicSurfaceTheme,
  maurerRose:           MaurerRoseTheme,
  mobius:               MobiusStripTheme,
  pointSphere:          PointSphereTheme,
  liquidOrb:            LiquidOrbTheme,
  lensIllusion:         LensIllusionTheme,
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
  waveSurface:          'Wave Surface',
  torusWave:            'Torus Wave',
  harmonicSphere:       'Harmonic Sphere',
  doublePendulum:       'Double Pendulum',
  newtonsCradle:        "Newton's Cradle",
  atom:                 'Atom',
  gyroscope:            'Gyroscope',
  dnaHelix:             'DNA Helix',
  harmonicSurface:      'Harmonic Surface',
  maurerRose:           'Maurer Rose',
  mobius:               'Möbius Strip',
  pointSphere:          'Point Sphere',
  liquidOrb:            'Liquid Orb',
  lensIllusion:         'Lens Illusion',
};

const THEME_GROUPS = [
  { key: 'space',      label: 'Space',      themes: ['starfield','nebula','galaxy','particles','hyperspace','meteor','blackhole'] },
  { key: 'nature',     label: 'Nature',     themes: ['sakura','fireflies','bokeh','snow','oceanLight','goldenHour','windmillRainbowField','rainyWindow','lanterns','fireside'] },
  { key: 'passingby',  label: 'Passing By', themes: ['bikeRide','dogWalk','cityDrive','hotAirBalloon','nightTrain'] },
  { key: 'math',       label: 'Graphs',     themes: ['waveSurface','torusWave','harmonicSphere','harmonicSurface','maurerRose','mobius'] },
  { key: 'science',    label: 'Science',    themes: ['doublePendulum','newtonsCradle','atom','gyroscope','dnaHelix'] },
  { key: 'interactive',label: 'Interactive',themes: ['pointSphere','liquidOrb','lensIllusion'] },
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
  'brandColors', 'iconOnly', 'textOnly', 'newTabLinks',
  'intensity', 'quality', 'fps', 'animSpeed', 'staticMode',
];
// The quick-link arrangement (linkId → {row,col}) is per-background too, but it
// is NOT a snapshot field: it's arranged directly on the page and kept live in
// the background's own store (its preset when it has one, else the global grid).
// Snapshotting it here would clobber the dragged layout on Save, so it's handled
// separately by activeGrid() / qlSaveGrid / savePreset.

// The background being set up / edited on the Advanced page. While it's pending
// it previews the live global toolbar (so toolbar tweaks are visible), even if
// it already has a saved preset. null the rest of the time.
let pendingPresetBg = null;

// While the "save to preset?" prompt is open on a preset background, the pending
// change is previewed live by overlaying it here (field → new value), so the
// user sees the effect before deciding. Cleared when they answer the prompt.
let presetPreview = null;

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

// The quick-link arrangement for the active background: its preset's grid when
// the preset exists (even while it's being edited), otherwise the global grid.
// Independent of pending/preview state because links are arranged directly on
// the page, not previewed-from-global like the toolbar fields.
function activeGrid() {
  const ov = overrideFor(settings.theme);
  return (ov ? ov.quickLinkGrid : settings.quickLinkGrid) || {};
}

function computeLive() {
  const s = activeUsesPreset()
    ? Object.assign({}, settings, overrideFor(settings.theme))
    : Object.assign({}, settings);
  if (presetPreview) Object.assign(s, presetPreview);   // live preview of a pending change
  s.quickLinkGrid = activeGrid();
  return s;
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

// Intensity used to be a single 'low'|'medium'|'high' tier driving both the
// effect amount and the render resolution. Split it into the numeric
// intensity + quality pair, for the global settings and every saved preset.
function migrateIntensityQuality() {
  const changed = {};
  if (Storage.normalizeTier(settings)) {
    changed.intensity = settings.intensity;
    changed.quality   = settings.quality;
  }
  const ov = settings.overrides || {};
  let ovChanged = false;
  for (const key of Object.keys(ov)) {
    if (Storage.normalizeTier(ov[key])) ovChanged = true;
  }
  if (ovChanged) changed.overrides = ov;
  if (Object.keys(changed).length) Storage.save(changed);
}

// Push the engine options in `live` to the running background. Only re-inits
// the theme when asked (intensity/quality changes need a fresh init).
function applyLiveEngine(reinit = false) {
  engine.setOptions({
    intensity:  Storage.intensityValue(live.intensity),
    quality:    Storage.qualityValue(live.quality),
    fps:        live.fps,
    speed:      live.animSpeed,
    staticMode: live.staticMode,
    scenePalette: paletteFor(settings.theme),
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
  migrateIntensityQuality();
  checkDailyRandomize();
  recomputeLive();

  engine = new ThemeEngine(document.getElementById('canvas-container'));
  engine.setOptions({
    intensity:  Storage.intensityValue(live.intensity),
    quality:    Storage.qualityValue(live.quality),
    fps:        live.fps,
    speed:      live.animSpeed,
    staticMode: live.staticMode,
    scenePalette: paletteFor(settings.theme),
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
  const reflowLinks = (delay) => {
    clearTimeout(qlResizeTimer);
    qlResizeTimer = setTimeout(() => { if (!qlEditing) renderQuickLinks(); }, delay);
  };
  window.addEventListener('resize', () => reflowLinks(200));
  // Reflow the grid around the centre UI whenever the header or search box
  // changes size (logo text-size slider, layout, show/hide, font…). The pill
  // cells keep their size — only their arrangement adjusts to the new clearance.
  const centreObserver = new ResizeObserver(() => reflowLinks(120));
  centreObserver.observe(document.getElementById('header'));
  centreObserver.observe(document.getElementById('search-container'));
  initSettings();

  const fadeOut = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    const overlay = document.getElementById('fade-overlay');
    if (overlay) { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 600); }
  }));

  // Particle greeting: only on the first tab of a browser session, and only
  // once we know it's the first (so the header doesn't flash before it plays).
  if (settings.greeting && Greeting.canPlay() && await Greeting.firstThisSession()) {
    document.body.classList.add('greeting-playing');
    fadeOut();
    Greeting.play(Greeting.textFor(settings.greetingName), () => {
      document.body.classList.add('greeting-reveal');
      document.body.classList.remove('greeting-playing');
      setTimeout(() => document.body.classList.remove('greeting-reveal'), 700);
    });
  } else {
    fadeOut();
  }
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

  const cfg = live || settings;   // active background's settings (preset-aware)
  const is12 = cfg.clockFormat === '12h';
  const ampm = is12 ? (h >= 12 ? 'PM' : 'AM') : '';
  if (is12) h = h % 12 || 12;

  document.getElementById('clock-hm').textContent = `${h}:${pad(m)}`;

  const secEl = document.getElementById('clock-s');
  secEl.textContent = `:${pad(s)}`;
  secEl.hidden = !cfg.showSeconds;

  const ampmEl = document.getElementById('clock-ampm');
  ampmEl.textContent = ` ${ampm}`;
  ampmEl.hidden = !is12;

  const dateLine = document.getElementById('clock-date-line');
  if (cfg.showDate) {
    dateLine.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    dateLine.hidden = false;
  } else {
    dateLine.hidden = true;
  }

  document.getElementById('date-weekday').textContent = now.toLocaleDateString('en-US', { weekday: 'long' });
  document.getElementById('date-full').textContent    = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const timeSmall = document.getElementById('date-time-small');
  const dateSep   = document.getElementById('date-separator');
  if (cfg.showTimeInDate) {
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

const QL_HOLD_MS = 500;
const QL_MOVE_THRESHOLD = 8;
const QL_EDGE = 30;                    // keep-clear margin from the screen edges

let qlEditing = false;
let qlHoldTimer = null;
let qlGeomCache = null;
let rebuildQuickLinksEditor = null;    // set by the settings editor

function qlTextOnly() { return !!((live || settings).textOnly); }
// Text-only wins if both are somehow set, so the two never fight over a tile.
function qlIconOnly() { return !!((live || settings).iconOnly) && !qlTextOnly(); }
// Oval cells are as wide as the widest pill (measured from the tiles already in
// the DOM) so no label is ever truncated and every cell/slot is the same width;
// icon cells stay fixed. QL_OVAL_GAP is the breathing room around the pill.
const QL_OVAL_H = 42;
const QL_OVAL_GAP = 8;    // small clear space around each pill — never overlapping
function qlCellSize() {
  if (qlIconOnly()) return { w: 80, h: 90 };
  const container = document.getElementById('quick-links');
  let maxW = 0;
  container.querySelectorAll('.ql-tile .ql-body').forEach(b => { maxW = Math.max(maxW, b.offsetWidth); });
  return { w: (maxW ? Math.ceil(maxW) : 120) + QL_OVAL_GAP, h: QL_OVAL_H };
}

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

// The centre elements the grid must leave clear, as separate rects (not one
// merged box) so links can tuck into the space beside the narrow logo without
// being pushed out by the much wider search bar. The header gets no margin so
// links can sit right up against the logo text; the search bar keeps a small
// keep-clear gap.
const QL_PROT_MARGIN = { header: 1, 'search-container': 10 };   // ~1px clear around the logo
function qlProtectedRects() {
  const rects = [];
  for (const id of ['header', 'search-container']) {
    const el = document.getElementById(id);
    if (!el || el.hidden) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const m = QL_PROT_MARGIN[id];
    // A text element's box includes line-height whitespace above/below the
    // glyphs; trim it so links hug the visible text rather than the empty box.
    const vi = id === 'header' ? Math.min(r.height * 0.15, 26) : 0;
    rects.push({ left: r.left - m, top: r.top + vi - m, right: r.right + m, bottom: r.bottom - vi + m });
  }
  return rects;
}

// Full-viewport grid geometry (centred, with edge margins) + protected rect.
function qlGeom() {
  const { w, h } = qlCellSize();
  const cols = Math.max(1, Math.floor((window.innerWidth  - QL_EDGE * 2) / w));
  const rows = Math.max(1, Math.floor((window.innerHeight - QL_EDGE * 2) / h));
  const ox = Math.round((window.innerWidth  - cols * w) / 2);
  const oy = Math.round((window.innerHeight - rows * h) / 2);
  return { w, h, cols, rows, ox, oy, prot: qlProtectedRects() };
}

function qlCellBlocked(g, row, col) {
  if (!g.prot || !g.prot.length) return false;
  const x = g.ox + col * g.w, y = g.oy + row * g.h;
  return g.prot.some(p =>
    !(x + g.w <= p.left || x >= p.right || y + g.h <= p.top || y >= p.bottom));
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

// Persist the quick-link arrangement to the active background's own store: its
// preset when it has one (so rearranging edits that background's saved layout),
// otherwise the global grid. Keyed on whether the preset exists — not on
// preview/pending state — so a drag always lands where the page reads from.
function qlSaveGrid(map) {
  const ov = overrideFor(settings.theme);
  if (ov) {
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
  container.classList.toggle('text-only', qlTextOnly());

  const links = qlLinks();
  // Build every tile first (unsized) so oval pills can be measured at their
  // natural, untruncated width before the cell size is chosen.
  const tileById = {};
  links.forEach(link => {
    const t = makeQuickLinkTile(link);
    tileById[link.id] = t;
    container.appendChild(t);
  });

  const g = qlGeomCache = qlGeom();
  const placed = qlPlacements(links, g);

  const map = {};
  placed.forEach(p => { map[p.link.id] = { row: p.row, col: p.col }; });
  qlSaveGrid(map);

  const placedIds = new Set();
  placed.forEach(p => {
    placedIds.add(p.link.id);
    const tile = tileById[p.link.id];
    tile.style.width  = g.w + 'px';
    tile.style.height = g.h + 'px';
    qlPositionTile(tile, p.row, p.col, g);
  });
  // Drop any link that didn't fit anywhere so it isn't left stacked at 0,0.
  links.forEach(l => { if (!placedIds.has(l.id)) tileById[l.id].remove(); });

  qlRenderCells();

  // Safety net: if a pill ends up wider than the cell we sized (a stray late
  // metric), grow the cell and re-place once so pills can never overlap.
  if (!qlIconOnly() && !qlEditing) {
    requestAnimationFrame(() => {
      if (qlEditing) return;
      let need = 0;
      document.querySelectorAll('#quick-links .ql-tile .ql-body')
        .forEach(b => { need = Math.max(need, b.offsetWidth); });
      if (need && Math.ceil(need) + QL_OVAL_GAP > g.w + 0.5) renderQuickLinks();
    });
  }
}

// Dashed empty slots for every free, non-protected cell (edit mode only).
function qlRenderCells() {
  const container = document.getElementById('quick-links');
  container.querySelectorAll('.ql-cell').forEach(c => c.remove());
  if (!qlEditing) return;
  const g = qlGeomCache || (qlGeomCache = qlGeom());

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

// Builds a tile's markup only — sizing and grid placement happen in
// renderQuickLinks after the pills have been measured.
function makeQuickLinkTile(link) {
  const label = link.label || BrandColors.siteName(link.url);
  const tile = document.createElement('div');
  tile.className = 'ql-tile';
  tile.dataset.id = link.id;
  tile.tabIndex = 0;
  tile.setAttribute('role', 'link');
  tile.setAttribute('aria-label', label);
  tile.title = label;
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

  // Three modes: oval (icon + label), icon-only (icon), text-only (label). The
  // icon appears unless text-only; the label appears unless icon-only.
  if (!qlTextOnly()) {
    const box = document.createElement('div');
    box.className = 'ql-icon-box';
    body.appendChild(box);
    decorateQuickTile(box, link.url, label, qlIconOnly(), !!(live || settings).brandColors);
  } else if (!!(live || settings).brandColors) {
    applyBrandToBody(body, link.url);   // text-only still honours Theme Color
  }

  if (!qlIconOnly()) {
    const lbl = document.createElement('span');
    lbl.className = 'ql-tile-label';
    lbl.textContent = label;
    body.appendChild(lbl);
  }
  tile.appendChild(body);

  attachTilePointer(tile, body, link);
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
function decorateQuickTile(box, url, label, iconOnly, brand) {
  const body = box.parentElement;
  const domain = BrandColors.domainOf(url);
  const letter = () => { box.classList.add('ql-letter'); box.textContent = (label || '?').charAt(0).toUpperCase(); };
  const favicon = () => {
    const img = document.createElement('img');
    img.className = 'ql-fav';
    img.src = BrandColors.faviconUrl(url, 64);
    img.alt = '';
    img.decoding = 'async';
    img.addEventListener('error', () => { img.remove(); letter(); });
    box.appendChild(img);
  };
  if (!domain) { letter(); return; }

  const override = BrandColors.lookup(domain);
  const cached   = (settings.brandColorCache || {})[domain];
  const colors   = override || cached;
  if (brand && colors) applyBrandColors(body, colors);

  const logoDomain = BrandColors.logoDomain(domain);
  if (logoDomain) {
    // Prime's full stacked wordmark is illegible in a small oval pill, so the
    // pill uses the official smile arrow alone; icon-only tiles keep the full mark.
    const asset = (!iconOnly && logoDomain === 'primevideo.com') ? 'primevideo-arrow' : logoDomain;
    addLogoMask(box, asset);
    return;
  }

  BrandColors.analyze(url).then(({ blank, colors: found }) => {
    if (!blank) favicon();
    else letter();
    if (found && !colors) {
      settings.brandColorCache = settings.brandColorCache || {};
      settings.brandColorCache[domain] = found;
      Storage.save({ brandColorCache: settings.brandColorCache });
      if (brand) applyBrandColors(body, found);
    }
  });
}

// Append a bundled brand mark (masked so it takes the accent colour) to a box.
function addLogoMask(box, logoDomain) {
  const logo = document.createElement('span');
  logo.className = 'ql-logo-mask';
  logo.style.setProperty('--ql-logo-src', `url("${BrandColors.logoUrl(logoDomain)}")`);
  box.appendChild(logo);
}

// Flag a tile as brand-coloured; CSS reads --ql-bg / --ql-fg per display mode.
function applyBrandColors(body, colors) {
  body.style.setProperty('--ql-bg', colors.bg);
  body.style.setProperty('--ql-fg', colors.fg);
  body.classList.add('branded');
}

// Tint a tile body with its brand colours without touching an icon — used by
// text-only pills, which have no icon box for decorateQuickTile to fill.
function applyBrandToBody(body, url) {
  const domain = BrandColors.domainOf(url);
  if (!domain) return;
  const colors = BrandColors.lookup(domain) || (settings.brandColorCache || {})[domain];
  if (colors) { applyBrandColors(body, colors); return; }
  BrandColors.analyze(url).then(({ colors: found }) => {
    if (!found) return;
    settings.brandColorCache = settings.brandColorCache || {};
    settings.brandColorCache[domain] = found;
    Storage.save({ brandColorCache: settings.brandColorCache });
    applyBrandColors(body, found);
  });
}

// ── Grid interaction: press-hold, jiggle edit mode, pointer drag ─────────────

function clearHold() { if (qlHoldTimer) { clearTimeout(qlHoldTimer); qlHoldTimer = null; } }

// `hit` is the visible pill / icon (.ql-body) — the only clickable surface, so
// the dead margin around it inside the grid cell doesn't register taps. `tile`
// stays the positioned cell we move while dragging.
function attachTilePointer(tile, hit, link) {
  hit.addEventListener('pointerdown', e => {
    if (e.button && e.button !== 0) return;
    const state = { link, tile, x0: e.clientX, y0: e.clientY, pid: e.pointerId, moved: false, dragging: false };
    try { hit.setPointerCapture(e.pointerId); } catch (_) {}

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
      try { hit.releasePointerCapture(state.pid); } catch (_) {}
      hit.removeEventListener('pointermove', onMove);
      hit.removeEventListener('pointerup', onUp);
      hit.removeEventListener('pointercancel', onUp);
    };

    hit.addEventListener('pointermove', onMove);
    hit.addEventListener('pointerup', onUp);
    hit.addEventListener('pointercancel', onUp);

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
// preset to it). categoryKey 'categories' shows the category tiles (preset flow).
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
  navigateTo('backgrounds', 'categories');   // category tiles first, then backgrounds
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
    quality:    Storage.qualityValue(live.quality),
    fps:        live.fps,
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

function buildCategoryGrid(gridId = 'category-grid', onPick = openBackgroundBrowse) {
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
    btn.addEventListener('click', () => onPick(cat.key));
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
  grid.classList.remove('as-categories');

  // Preset flow, step 1: the same category tiles as the main background page
  // (Favorites first). Tapping one opens that category's backgrounds below.
  if (categoryKey === 'categories') {
    document.getElementById('backgrounds-title').textContent = 'Choose a Category';
    grid.classList.add('as-categories');
    buildCategoryGrid('background-grid', key => navigateTo('backgrounds', key));
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

  // Interactive scenes carry a colour-palette picker to the right of the caption:
  // preset swatches that recolour the scene live (and repaint it if active).
  if (PALETTE_THEMES.has(themeKey)) row.append(makePaletteSwatchRow(themeKey));

  tile.append(thumbBtn, row);

  return tile;
}

// Interactive backgrounds that expose the shared 7-swatch colour picker.
const PALETTE_THEMES = new Set(['pointSphere', 'liquidOrb', 'lensIllusion']);

// The colour preset chosen for a scene (defaults to Aurora). Global per scene,
// independent of the per-background toolbar presets.
function paletteFor(themeKey) {
  return (settings.palettes || {})[themeKey] || 'Aurora';
}

// A row of palette swatches for one Interactive scene. Clicking one applies that
// colour preset to the scene and, when it's the live background, recolours it
// instantly (no scene reload).
function makePaletteSwatchRow(themeKey) {
  const palettes = window.INTERACTIVE_PALETTES || [];
  const current = paletteFor(themeKey);
  const wrap = document.createElement('div');
  wrap.className = 'scene-swatches';

  palettes.forEach(p => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'scene-swatch' + (current === p.name ? ' active' : '');
    sw.dataset.preset = p.name;
    sw.title = p.name;
    sw.setAttribute('aria-label', `${p.name} colour`);
    sw.style.background = `linear-gradient(135deg, ${p.swatch[0]}, ${p.swatch[1]})`;
    sw.addEventListener('click', e => {
      e.stopPropagation();
      setScenePalette(themeKey, p.name);
      wrap.querySelectorAll('.scene-swatch').forEach(el =>
        el.classList.toggle('active', el.dataset.preset === p.name));
    });
    wrap.appendChild(sw);
  });
  return wrap;
}

function setScenePalette(themeKey, name) {
  settings.palettes = settings.palettes || {};
  settings.palettes[themeKey] = name;
  Storage.save({ palettes: settings.palettes });
  // Recolour the live scene in place when it's the active background.
  const theme = engine && engine.currentTheme;
  if (settings.theme === themeKey && theme && typeof theme.setPreset === 'function') {
    theme.setPreset(name);
  }
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
  const prev = settings.overrides[themeKey];
  const snap = snapshotSettings();
  // Keep the background's own quick-link arrangement: an existing preset already
  // holds the layout dragged onto it; a brand-new one inherits whatever's shown
  // now (the global grid). Snapshotting global here would move the links.
  snap.quickLinkGrid = (prev && prev.quickLinkGrid)
    ? prev.quickLinkGrid
    : JSON.parse(JSON.stringify(settings.quickLinkGrid || {}));
  settings.overrides[themeKey] = snap;
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
      quality:    Math.min(Storage.qualityValue(eff.quality), animQuality),
      fps:        eff.fps,
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

// Size + place a preview's quick-link tiles with the same geometry the live
// page uses (oval cells hug the widest pill), reading saved row/col off each
// tile's dataset. offsetWidth is unaffected by the stage's CSS scale, so this
// stays correct even after the miniature is scaled.
function layoutPreviewTiles(tiles, iconOnly) {
  let w, h;
  if (iconOnly) { w = 80; h = 90; }
  else {
    let maxW = 0;
    tiles.forEach(t => { const b = t.querySelector('.ql-body'); if (b) maxW = Math.max(maxW, b.offsetWidth); });
    w = (maxW ? Math.ceil(maxW) : 120) + QL_OVAL_GAP;
    h = QL_OVAL_H;
  }
  const cols = Math.max(1, Math.floor((window.innerWidth  - QL_EDGE * 2) / w));
  const rows = Math.max(1, Math.floor((window.innerHeight - QL_EDGE * 2) / h));
  const ox = Math.round((window.innerWidth  - cols * w) / 2);
  const oy = Math.round((window.innerHeight - rows * h) / 2);
  tiles.forEach(t => {
    t.style.width  = w + 'px';
    t.style.height = h + 'px';
    t.style.left = (ox + (+t.dataset.col) * w) + 'px';
    t.style.top  = (oy + (+t.dataset.row) * h) + 'px';
  });
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
  const grid = eff.quickLinkGrid || {};
  const previewTiles = [];
  qlLinks().forEach(link => {
    const p = grid[link.id];
    if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col)) return;
    const t = makePreviewTile(link, !!eff.iconOnly, !!eff.brandColors);
    t.dataset.row = p.row;
    t.dataset.col = p.col;
    previewTiles.push(t);
    links.appendChild(t);
  });
  stage.appendChild(links);

  overlay.appendChild(stage);

  // Once laid out: size/place the pills (needs measurement), then scale the
  // full-size stage to cover the tile (same crop as the scene's object-fit).
  requestAnimationFrame(() => {
    layoutPreviewTiles(previewTiles, !!eff.iconOnly);
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
// Sizing / placement is applied later by layoutPreviewTiles.
function makePreviewTile(link, iconOnly, brand) {
  const label = link.label || BrandColors.siteName(link.url);
  const tile = document.createElement('div');
  tile.className = 'ql-tile';

  const body = document.createElement('div');
  body.className = 'ql-body';
  const box = document.createElement('div');
  box.className = 'ql-icon-box';
  body.appendChild(box);
  decorateQuickTile(box, link.url, label, iconOnly, brand);

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

// Fields that only take effect on a fresh scene init (read once in theme.init),
// so previewing / applying / reverting them needs a re-init rather than a live
// option tweak.
function adjustNeedsReinit(fields) {
  return fields.some(k => k === 'intensity' || k === 'quality');
}

function maybeAdjustPreset(fields) {
  if (adjustOpen || !activeUsesPreset()) return;
  const ov = overrideFor(settings.theme);
  // Only ask about fields whose new global value actually differs from the preset.
  const changed = fields.filter(k => ov[k] !== settings[k]);
  if (!changed.length) return;
  adjustFields = changed;
  adjustOpen = true;
  // Preview the change on the active preset background so the user sees the
  // effect while the prompt is open.
  presetPreview = presetPreview || {};
  changed.forEach(k => { presetPreview[k] = settings[k]; });
  recomputeLive();
  applyLiveToPage(adjustNeedsReinit(changed));
  document.getElementById('preset-adjust-name').textContent =
    THEME_LABELS[settings.theme] || 'This background';
  document.getElementById('preset-adjust-confirm').classList.remove('hidden');
}

function initAdjustConfirm() {
  const overlay = document.getElementById('preset-adjust-confirm');
  // Drop the preview overlay and re-render: on "Save" the value now lives in the
  // preset (so it stays); on "No" the background reverts to the preset's value.
  const finish = () => {
    const reinit = adjustFields ? adjustNeedsReinit(adjustFields) : true;
    presetPreview = null;
    recomputeLive();
    applyLiveToPage(reinit);
    overlay.classList.add('hidden');
    adjustOpen = false;
    adjustFields = null;
  };
  document.getElementById('preset-adjust-yes').addEventListener('click', () => {
    const ov = overrideFor(settings.theme);
    if (ov && adjustFields) {
      adjustFields.forEach(k => { ov[k] = settings[k]; });   // write the changed field(s) in
      savePresets();
    }
    finish();
  });
  document.getElementById('preset-adjust-no').addEventListener('click', finish);
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
    FpsMeter.stop();
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
    // In the preset flow, a category's backgrounds steps back to the category
    // tiles first; the tiles (or a normal browse) step back to the panel.
    if (nav.pickMode === 'preset' && nav.categoryKey !== 'categories') {
      navigateTo('backgrounds', 'categories');
      return;
    }
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
// Live FPS readout under the Animation settings: the frames the scene is
// actually drawing per second — reflecting the frame-rate cap you set and any
// slowdown when the machine can't keep up. Reads the engine's real draw counter
// (not the display's rAF rate). There's no per-tab CPU/GPU% available to
// extensions; the true rendered frame rate is the honest signal.
const FpsMeter = (() => {
  let timer = 0, lastCount = 0, lastTime = 0;
  function tick() {
    const now = performance.now();
    const c = engine ? engine.frameCount : 0;
    const fps = lastTime ? Math.round((c - lastCount) * 1000 / (now - lastTime)) : 0;
    const lbl = document.getElementById('fps-live');
    if (lbl) lbl.textContent = Math.max(0, fps) + ' fps';
    lastCount = c; lastTime = now;
  }
  function start() {
    if (timer) return;
    lastCount = engine ? engine.frameCount : 0;
    lastTime = performance.now();
    timer = setInterval(tick, 500);
  }
  function stop() { if (timer) { clearInterval(timer); timer = 0; } }
  return { start, stop };
})();

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
    // The live FPS readout samples only while the Animation panel is visible.
    if (panel === 'animation') FpsMeter.start();
    else FpsMeter.stop();
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
      if (!qlEditing) renderQuickLinks();   // pill widths depend on the font
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
  const textOnlyEl  = document.getElementById('setting-text-only');
  const newTabEl    = document.getElementById('setting-new-tab-links');

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
  textOnlyEl.checked  = settings.textOnly;
  newTabEl.checked    = settings.newTabLinks;
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
    if (iconOnlyEl.checked) { settings.textOnly = false; textOnlyEl.checked = false; }  // exclusive
    Storage.save({ iconOnly: settings.iconOnly, textOnly: settings.textOnly });
    recomputeLive();
    renderQuickLinks();
    maybeAdjustPreset(['iconOnly', 'textOnly']);
  });
  textOnlyEl.addEventListener('change', () => {
    settings.textOnly = textOnlyEl.checked;
    if (textOnlyEl.checked) { settings.iconOnly = false; iconOnlyEl.checked = false; }  // exclusive
    Storage.save({ textOnly: settings.textOnly, iconOnly: settings.iconOnly });
    recomputeLive();
    renderQuickLinks();
    maybeAdjustPreset(['textOnly', 'iconOnly']);
  });
  newTabEl.addEventListener('change', () => {
    settings.newTabLinks = newTabEl.checked;
    Storage.save({ newTabLinks: newTabEl.checked });
    recomputeLive();   // click handler reads live.newTabLinks
    maybeAdjustPreset(['newTabLinks']);
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
  };

  const persist = (rebuildEditor = false) => {
    Storage.save({ quickLinks: settings.quickLinks });
    renderQuickLinks();
    if (rebuildEditor) renderEditor();
  };

  addBtn.addEventListener('click', () => {
    settings.quickLinks.push({ id: 'ql_' + Math.random().toString(36).slice(2, 9), label: '', url: '' });
    renderEditor();
  });

  // Let the on-page delete badge refresh this editor when it's open.
  rebuildQuickLinksEditor = renderEditor;
  renderEditor();
}

// Animation settings
function buildAnimationSettings() {
  const intensityEl  = document.getElementById('setting-intensity');
  const intensityLbl = document.getElementById('intensity-label');
  const qualityEl    = document.getElementById('setting-quality');
  const qualityLbl   = document.getElementById('quality-label');
  const fpsBtns  = document.querySelectorAll('.fps-btn');
  const staticEl = document.getElementById('setting-static');
  const speedEl  = document.getElementById('setting-speed');
  const speedLbl = document.getElementById('speed-label');

  const intensityText = v => Math.round(v * 100) + '%';
  const qualityText   = v => (Number.isInteger(v) ? v + '' : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')) + '×';
  // Tint the readout red at the slider's extremes (min = may look sparse/soft,
  // max = heaviest on the machine) so the trade-off is obvious.
  const R = Storage.RANGES;
  const setIntensity = v => {
    intensityLbl.textContent = intensityText(v);
    intensityLbl.classList.toggle('extreme', v <= R.intensity.min || v >= R.intensity.max);
  };
  const setQuality = v => {
    qualityLbl.textContent = qualityText(v);
    qualityLbl.classList.toggle('extreme', v <= R.quality.min || v >= R.quality.max);
  };

  const intens = Storage.intensityValue(settings.intensity);
  intensityEl.value = intens;
  setIntensity(intens);

  const qual = Storage.qualityValue(settings.quality);
  qualityEl.value = qual;
  setQuality(qual);

  staticEl.checked = settings.staticMode;

  const curFps = settings.fps || 60;
  fpsBtns.forEach(b => b.classList.toggle('active', +b.dataset.value === curFps));

  const spd = settings.animSpeed || 1.0;
  speedEl.value = spd;
  speedLbl.textContent = spd.toFixed(2).replace(/\.?0+$/, '') + '×';

  fpsBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const v = parseInt(btn.dataset.value, 10);
      settings.fps = v;
      Storage.save({ fps: v });
      fpsBtns.forEach(b => b.classList.toggle('active', b === btn));
      recomputeLive();
      engine.setOptions({ fps: live.fps });   // takes effect immediately, no re-init
      maybeAdjustPreset(['fps']);
    });
  });

  // Intensity (effect amount) and Quality (render resolution) both need a fresh
  // scene init to take effect, so re-init on release (change), not every input.
  intensityEl.addEventListener('input', () => {
    const v = parseFloat(intensityEl.value);
    settings.intensity = v;
    setIntensity(v);
  });
  intensityEl.addEventListener('change', () => {
    const v = parseFloat(intensityEl.value);
    settings.intensity = v;
    Storage.save({ intensity: v });
    recomputeLive();
    // When the active background is showing a frozen preset, a global change
    // doesn't alter `live` — skip the scene re-init; otherwise apply it.
    applyLiveEngine(!activeUsesPreset());
    startAppearancePreview();
    maybeAdjustPreset(['intensity']);
  });

  qualityEl.addEventListener('input', () => {
    const v = parseFloat(qualityEl.value);
    settings.quality = v;
    setQuality(v);
  });
  qualityEl.addEventListener('change', () => {
    const v = parseFloat(qualityEl.value);
    settings.quality = v;
    Storage.save({ quality: v });
    recomputeLive();
    applyLiveEngine(!activeUsesPreset());
    startAppearancePreview();
    maybeAdjustPreset(['quality']);
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

  const greetingEl  = document.getElementById('setting-greeting');
  const greetNameRow= document.getElementById('greeting-name-row');
  const greetNameEl = document.getElementById('setting-greeting-name');
  greetingEl.checked  = settings.greeting;
  greetNameRow.hidden = !settings.greeting;
  greetNameEl.value   = settings.greetingName || '';
  greetingEl.addEventListener('change', () => {
    settings.greeting = greetingEl.checked;
    Storage.save({ greeting: greetingEl.checked });
    greetNameRow.hidden = !greetingEl.checked;
    if (greetingEl.checked) Greeting.resetSession();   // so the next tab previews it
  });
  greetNameEl.addEventListener('input', () => {
    settings.greetingName = greetNameEl.value;
    Storage.save({ greetingName: greetNameEl.value });
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
