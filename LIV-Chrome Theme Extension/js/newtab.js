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
let settings;   // global defaults — the source of truth every background inherits
let live;       // effective settings for the ACTIVE background (global + its override)

// ── Per-background overrides (Advanced Custom Preset) ─────────────────────────

// Each override field, and the global/live settings key it maps onto. The
// override object uses its own names (header/static/speed); the live+global
// objects use layout/staticMode/animSpeed.
const OVERRIDE_FIELDS = [
  { ov: 'header',       key: 'layout' },
  { ov: 'hideText',     key: 'hideText' },
  { ov: 'hideSearch',   key: 'hideSearch' },
  { ov: 'logoPosition', key: 'logoPosition' },
  { ov: 'font',         key: 'font' },
  { ov: 'intensity',    key: 'intensity' },
  { ov: 'speed',        key: 'animSpeed' },
  { ov: 'static',       key: 'staticMode' },
  { ov: 'cardSize',     key: 'cardSize' },
  { ov: 'iconStyle',    key: 'iconStyle' },
  { ov: 'newTabLinks',  key: 'newTabLinks' },
];

// A fresh override = an exact copy of the current global settings, so enabling
// it changes nothing visually until the user edits a specific field.
function makeOverrideFromGlobal() {
  const ov = { enabled: true };
  OVERRIDE_FIELDS.forEach(f => { ov[f.ov] = settings[f.key]; });
  return ov;
}

function overrideFor(themeKey) {
  return (settings.overrides || {})[themeKey] || null;
}

function saveOverrides() {
  settings.overrides = settings.overrides || {};
  Storage.save({ overrides: settings.overrides });
}

function activeHasEnabledOverride() {
  const ov = overrideFor(settings.theme);
  return !!(ov && ov.enabled);
}

// Effective settings for the active background: global, with an enabled
// override layered on top. This is the single resolution used by the live
// page, normal selection, and daily randomize alike.
function computeLive() {
  const l = Object.assign({}, settings);
  const ov = overrideFor(settings.theme);
  if (ov && ov.enabled) {
    OVERRIDE_FIELDS.forEach(f => { l[f.key] = ov[f.ov]; });
  }
  return l;
}

function recomputeLive() { live = computeLive(); }

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

// ── Quick links ───────────────────────────────────────────────────────────────

function renderQuickLinks() {
  const container = document.getElementById('quick-links');
  container.innerHTML = '';
  container.classList.toggle('ql-compact', live.cardSize === 'compact');
  container.classList.toggle('ql-icons-hidden', live.iconStyle === 'custom');
  (settings.quickLinks || []).forEach(link => {
    if (!link.url) return;
    const label = link.label || BrandColors.siteName(link.url);
    if (!label) return;

    const a = document.createElement('a');
    a.className = 'quick-link';
    a.href = link.url;
    a.textContent = label;
    a.addEventListener('click', e => {
      e.preventDefault();
      if (live.newTabLinks) window.open(link.url, '_blank');
      else window.location.href = link.url;
    });

    container.appendChild(a);
    decorateQuickLink(a, link.url);
  });
}

// Add the site's logo and brand colour to a pill. Curated brands get a bundled
// logo (always shown, tinted to the pill accent). Everything else falls back to
// Chrome's locally-cached favicon, which is only drawn when it's a real icon —
// the blank default globe (uncached sites) is skipped so those pills stay
// text-only rather than showing an empty glyph.
function decorateQuickLink(a, url) {
  const domain = BrandColors.domainOf(url);
  if (!domain) return;

  // Curated / cached colour can apply immediately, without touching the icon.
  const override = BrandColors.lookup(domain);
  const cached = (settings.brandColorCache || {})[domain];
  if (settings.brandColors && (override || cached)) {
    applyBrandStyle(a, override || cached);
  }

  // Bundled brand logo wins: it's local, always present, and consistent.
  const logoDomain = BrandColors.logoDomain(domain);
  if (logoDomain) {
    const logo = document.createElement('span');
    logo.className = 'ql-logo';
    logo.style.setProperty('--ql-logo-src', `url("${BrandColors.logoUrl(logoDomain)}")`);
    a.insertBefore(logo, a.firstChild);
    return;
  }

  BrandColors.analyze(url).then(({ blank, colors }) => {
    if (!blank) {
      const img = document.createElement('img');
      img.className = 'ql-icon';
      img.src = BrandColors.faviconUrl(url, 32);
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('error', () => img.remove());
      a.insertBefore(img, a.firstChild);
    }
    // Remember an extracted colour (only successes) and apply it if we had no
    // curated/cached one already.
    if (colors && !override && !cached) {
      settings.brandColorCache = settings.brandColorCache || {};
      settings.brandColorCache[domain] = colors;
      Storage.save({ brandColorCache: settings.brandColorCache });
      if (settings.brandColors) applyBrandStyle(a, colors);
    }
  });
}

function applyBrandStyle(a, colors) {
  a.style.setProperty('--ql-bg', colors.bg);
  a.style.setProperty('--ql-fg', colors.fg);
  a.classList.add('branded');
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

const VIEW_INDEX = { main: 0, backgrounds: 1, editbg: 2 };
const nav = { view: 'main', categoryKey: null, editKey: null };
let activePanel = 'home';   // which rail section is showing on the main view
let showPanel;              // set by initRailNav; switches the active rail section
let livePreview;
let editPreview;            // live scene preview on the Edit background page

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
  const prev = nav.view;
  nav.view = view;
  if (view === 'backgrounds') nav.categoryKey = arg;
  if (view === 'editbg') nav.editKey = arg;

  // Leaving the Edit page tears down its own live preview.
  if (prev === 'editbg' && view !== 'editbg' && editPreview) editPreview.stop();

  if (view === 'main') {
    renderAppearance();
  } else {
    livePreview.stop();
    if (view === 'backgrounds') buildBackgroundGrid(nav.categoryKey);
    else if (view === 'editbg') buildEditBackground(nav.editKey);
  }
  applyNavTransforms(animate);
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
    btn.addEventListener('click', () => navigateTo('backgrounds', cat.key));
    grid.appendChild(btn);
  });
}

// ── Screen 3: Background grid ────────────────────────────────────────────────

function buildBackgroundGrid(categoryKey) {
  const cat = getCategoryEntry(categoryKey);
  if (!cat) { navigateTo('main'); return; }

  document.getElementById('backgrounds-title').textContent = cat.label;

  const randWrap = document.getElementById('backgrounds-randomize');
  randWrap.innerHTML = '';
  const grid = document.getElementById('background-grid');
  grid.innerHTML = '';

  if (!cat.themes.length) {
    const empty = document.createElement('div');
    empty.className = 'favorites-empty';
    empty.textContent = 'No Favorites Added';
    randWrap.appendChild(empty);
    return;
  }

  randWrap.appendChild(makeRandomizeDailyBtn(cat.key, `Randomize ${cat.label} Daily`));
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

  // Edit icon sits on the artwork itself, bottom-left. Tapping it opens the
  // full-page Edit background screen instead of selecting the background.
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'tile-edit';
  edit.setAttribute('aria-label', `Edit ${THEME_LABELS[themeKey]} background`);
  edit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13.5 6.5l4 4M4 20l1-4L15.5 5.5a1.5 1.5 0 0 1 2.12 0l.88.88a1.5 1.5 0 0 1 0 2.12L8 19l-4 1z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  edit.addEventListener('click', e => { e.stopPropagation(); navigateTo('editbg', themeKey); });
  thumbBtn.appendChild(edit);

  thumbBtn.addEventListener('click', () => applyTheme(themeKey));

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
  settings.theme = themeKey;
  Storage.save({ theme: themeKey });
  recomputeLive();            // apply the new background's preset (if enabled)
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

// ── Screen 4: Edit background (per-background Advanced Custom Preset) ─────────

const HEADER_OPTS    = [['logo', 'Logo'], ['time', 'Time'], ['date', 'Date']];
const LOGO_POS_OPTS  = [
  ['top-left', 'Top left'], ['top-right', 'Top right'],
  ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right'],
  ['top-center', 'Top center'], ['bottom-center', 'Bottom center'], ['center', 'Center'],
];
const FONT_OPTS      = Object.entries(FONTS).map(([k, f]) => [k, f.label]);
const INTENSITY_OPTS = [['low', 'Low'], ['medium', 'Med'], ['high', 'High']];
const SPEED_OPTS     = [[0.5, 'Slow'], [0.75, 'Relaxed'], [1, 'Normal'], [1.5, 'Fast'], [2, 'Very fast']];
const CARDSIZE_OPTS  = [['compact', 'Compact'], ['roomy', 'Roomy']];
const ICONSTYLE_OPTS = [['favicon', 'Favicon'], ['custom', 'Custom']];

function nearestSpeedValue(v) {
  let best = SPEED_OPTS[0][0], bestD = Infinity;
  for (const [val] of SPEED_OPTS) {
    const d = Math.abs(val - v);
    if (d < bestD) { bestD = d; best = val; }
  }
  return best;
}

// Whether the edited background currently reads from its override or from global.
function editSource() {
  const ov = overrideFor(nav.editKey);
  return { ov, enabled: !!(ov && ov.enabled) };
}

function editFieldValue(ovKey, globalKey) {
  const { ov, enabled } = editSource();
  return enabled ? ov[ovKey] : settings[globalKey];
}

// Engine opts the preview / live page should show for the edited background:
// its override values when enabled, otherwise the current global values.
function editEngineOpts() {
  const { ov, enabled } = editSource();
  const intensity = enabled ? ov.intensity  : settings.intensity;
  const speed     = enabled ? ov.speed       : settings.animSpeed;
  const staticM   = enabled ? ov.static      : settings.staticMode;
  return {
    intensity:  Storage.intensityValue(intensity),
    quality:    Storage.qualityValue(intensity),
    speed,
    staticMode: staticM,
  };
}

function startEditPreview() {
  editPreview.show(THEME_MAP[nav.editKey] || StarfieldTheme, editEngineOpts());
}

function makeEditSelectRow(label, options, current, onChange) {
  const row = document.createElement('div');
  row.className = 'edit-row';
  const lbl = document.createElement('span');
  lbl.className = 'edit-row-label';
  lbl.textContent = label;
  const sel = document.createElement('select');
  sel.className = 'edit-select';
  options.forEach(([val, text]) => {
    const o = document.createElement('option');
    o.value = String(val);
    o.textContent = text;
    sel.appendChild(o);
  });
  sel.value = String(current);
  sel.addEventListener('change', () => onChange(sel.value));
  row.append(lbl, sel);
  return row;
}

function makeEditToggleRow(label, checked, onChange) {
  const row = document.createElement('label');
  row.className = 'edit-row';
  const lbl = document.createElement('span');
  lbl.className = 'edit-row-label';
  lbl.textContent = label;
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!checked;
  cb.addEventListener('change', () => onChange(cb.checked));
  row.append(lbl, cb);
  return row;
}

// Write one field into the edited background's override. Auto-enables the
// preset on first touch, seeding a full copy of global so only this field moves.
function editField(ovKey, value) {
  settings.overrides = settings.overrides || {};
  let ov = settings.overrides[nav.editKey];
  if (!ov || !ov.enabled) {
    ov = makeOverrideFromGlobal();          // exact copy of current global
    settings.overrides[nav.editKey] = ov;
  }
  ov[ovKey] = value;
  ov.enabled = true;
  saveOverrides();

  if (nav.editKey === settings.theme) {
    recomputeLive();
    applyLiveToPage(ovKey === 'intensity');
    refreshSelectionMarks();
  }
  if (ovKey === 'speed') editPreview.setSpeed(editEngineOpts().speed);
  else if (ovKey === 'intensity' || ovKey === 'static') startEditPreview();

  renderEditPage();
}

function editToggleEnabled(checked) {
  settings.overrides = settings.overrides || {};
  let ov = settings.overrides[nav.editKey];
  if (checked) {
    if (!ov) { ov = makeOverrideFromGlobal(); settings.overrides[nav.editKey] = ov; }
    ov.enabled = true;
  } else if (ov) {
    ov.enabled = false;   // keep the object cached so re-enabling restores it
  }
  saveOverrides();

  if (nav.editKey === settings.theme) {
    recomputeLive();
    applyLiveToPage(true);
    refreshSelectionMarks();
  }
  startEditPreview();     // effective opts may have flipped override↔global
  renderEditPage();
}

function renderEditStatus() {
  const { enabled } = editSource();
  const statusEl = document.getElementById('editbg-status');
  statusEl.textContent = enabled ? 'Custom preset active' : 'Using global settings';
  statusEl.classList.toggle('active', enabled);
  document.getElementById('editbg-enabled').checked = enabled;
  document.getElementById('editbg-settings').classList.toggle('edit-inherited', !enabled);
}

function renderEditRows() {
  const box = document.getElementById('editbg-settings');
  box.innerHTML = '';
  box.append(
    makeEditSelectRow('Header', HEADER_OPTS, editFieldValue('header', 'layout'),
      v => editField('header', v)),
    makeEditToggleRow('Hide text', editFieldValue('hideText', 'hideText'),
      v => editField('hideText', v)),
    makeEditToggleRow('Hide search bar', editFieldValue('hideSearch', 'hideSearch'),
      v => editField('hideSearch', v)),
    makeEditSelectRow('Logo position', LOGO_POS_OPTS, editFieldValue('logoPosition', 'logoPosition'),
      v => editField('logoPosition', v)),
    makeEditSelectRow('Font', FONT_OPTS, editFieldValue('font', 'font'),
      v => editField('font', v)),
    makeEditSelectRow('Animation intensity', INTENSITY_OPTS, editFieldValue('intensity', 'intensity'),
      v => editField('intensity', v)),
    makeEditSelectRow('Animation speed', SPEED_OPTS, nearestSpeedValue(editFieldValue('speed', 'animSpeed')),
      v => editField('speed', parseFloat(v))),
    makeEditToggleRow('Static mode', editFieldValue('static', 'staticMode'),
      v => editField('static', v)),
    makeEditSelectRow('Quick link card size', CARDSIZE_OPTS, editFieldValue('cardSize', 'cardSize'),
      v => editField('cardSize', v)),
    makeEditSelectRow('Quick link icon style', ICONSTYLE_OPTS, editFieldValue('iconStyle', 'iconStyle'),
      v => editField('iconStyle', v)),
    makeEditToggleRow('Open links in new tab', editFieldValue('newTabLinks', 'newTabLinks'),
      v => editField('newTabLinks', v)),
  );
}

function renderEditPage() {
  renderEditStatus();
  renderEditRows();
}

function buildEditBackground(themeKey) {
  document.getElementById('editbg-title').textContent = THEME_LABELS[themeKey] || '';
  startEditPreview();
  renderEditPage();
}

// ── Global-settings conflict popup ───────────────────────────────────────────
// Changing a global default while the ACTIVE background has an enabled override
// asks whether to drop that override. The global change is already applied by
// the caller; this only decides the override's fate.

let conflictOpen = false;

function maybeConflictPopup() {
  if (conflictOpen || !activeHasEnabledOverride()) return;
  conflictOpen = true;
  document.getElementById('preset-conflict').classList.remove('hidden');
}

function initConflictPopup() {
  const overlay = document.getElementById('preset-conflict');
  const close = () => { overlay.classList.add('hidden'); conflictOpen = false; };

  document.getElementById('preset-conflict-yes').addEventListener('click', () => {
    const ov = overrideFor(settings.theme);
    if (ov) {
      ov.enabled = false;          // revert active background to inherit global
      saveOverrides();
      recomputeLive();
      applyLiveToPage(true);
    }
    close();
  });
  document.getElementById('preset-conflict-no').addEventListener('click', close);
}

// ── Settings panel ────────────────────────────────────────────────────────────

function initSettings() {
  const btn     = document.getElementById('settings-btn');
  const overlay = document.getElementById('settings-overlay');
  const panel   = document.getElementById('settings-panel');

  livePreview = new ScenePreview.LivePreview(document.getElementById('appearance-preview'));
  editPreview = new ScenePreview.LivePreview(document.getElementById('editbg-preview'));
  applyNavTransforms(false);

  const open = () => {
    overlay.classList.remove('hidden', 'closing');
    overlay.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    showPanel('home');   // always open on the Home tab
    document.querySelector('#view-main .settings-close').focus();
  };
  const close = () => {
    overlay.classList.remove('open');
    overlay.classList.add('closing');
    livePreview.stop();
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

  document.getElementById('back-to-home').addEventListener('click', () => navigateTo('main'));
  document.getElementById('back-to-backgrounds').addEventListener('click', () => navigateTo('backgrounds', nav.categoryKey));
  document.getElementById('editbg-enabled').addEventListener('change', e => editToggleEnabled(e.target.checked));

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
  initConflictPopup();
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
      maybeConflictPopup();
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

    // The live scene preview only belongs to the Home panel.
    if (panel === 'home') renderAppearance();
    else livePreview.stop();
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
      maybeConflictPopup();
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
      maybeConflictPopup();
    });
  });

  h12El.addEventListener('change', () => {
    settings.clockFormat = h12El.checked ? '12h' : '24h';
    Storage.save({ clockFormat: settings.clockFormat });
    recomputeLive();
    tickClock();
  });
  secsEl.addEventListener('change', () => {
    settings.showSeconds = secsEl.checked;
    Storage.save({ showSeconds: secsEl.checked });
    recomputeLive();
    tickClock();
  });
  dateEl.addEventListener('change', () => {
    settings.showDate = dateEl.checked;
    Storage.save({ showDate: dateEl.checked });
    recomputeLive();
    renderHeader();
    tickClock();
  });
  timeDateEl.addEventListener('change', () => {
    settings.showTimeInDate = timeDateEl.checked;
    Storage.save({ showTimeInDate: timeDateEl.checked });
    recomputeLive();
    renderHeader();
    tickClock();
  });
  hideTextEl.addEventListener('change', () => {
    settings.hideText = hideTextEl.checked;
    Storage.save({ hideText: hideTextEl.checked });
    recomputeLive();
    renderHeader();
    maybeConflictPopup();
  });
  hideSearchEl.addEventListener('change', () => {
    settings.hideSearch = hideSearchEl.checked;
    Storage.save({ hideSearch: hideSearchEl.checked });
    recomputeLive();
    renderSearch();
    maybeConflictPopup();
  });
  brandEl.addEventListener('change', () => {
    settings.brandColors = brandEl.checked;
    Storage.save({ brandColors: brandEl.checked });
    recomputeLive();
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
      row.querySelector('.ql-remove').addEventListener('click', () => { settings.quickLinks.splice(i, 1); persist(true); });
      container.appendChild(row);
    });
    addBtn.disabled = links.length >= 6;
  };

  const persist = (rebuildEditor = false) => {
    Storage.save({ quickLinks: settings.quickLinks });
    renderQuickLinks();
    if (rebuildEditor) renderEditor();
  };

  addBtn.addEventListener('click', () => {
    if ((settings.quickLinks || []).length >= 6) return;
    settings.quickLinks.push({ label: '', url: '' });
    renderEditor();
  });

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
      // When the active background masks intensity with its own preset, `live`
      // is unchanged — re-init nothing; otherwise apply + re-init the scene.
      applyLiveEngine(!activeHasEnabledOverride());
      startAppearancePreview();
      maybeConflictPopup();
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
  speedEl.addEventListener('change', () => maybeConflictPopup());

  staticEl.addEventListener('change', () => {
    settings.staticMode = staticEl.checked;
    Storage.save({ staticMode: staticEl.checked });
    recomputeLive();
    engine.setOptions({ staticMode: live.staticMode });
    startAppearancePreview();
    maybeConflictPopup();
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
