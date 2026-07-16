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
let settings;

// ── Boot ─────────────────────────────────────────────────────────────────────

(async () => {
  settings = await Storage.load();
  checkDailyRandomize();

  engine = new ThemeEngine(document.getElementById('canvas-container'));
  engine.setOptions({
    intensity:  Storage.intensityValue(settings.intensity),
    quality:    Storage.qualityValue(settings.intensity),
    speed:      settings.animSpeed,
    staticMode: settings.staticMode,
  });
  engine.switchTheme(THEME_MAP[settings.theme] || StarfieldTheme);

  applyFont();
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
  const font = FONTS[settings.font] || FONTS.system;
  document.documentElement.style.setProperty('--ui-font', font.stack);
}

// ── Header / Layout ───────────────────────────────────────────────────────────

function renderHeader() {
  const hide = settings.hideText;
  document.getElementById('header-logo').hidden = settings.layout !== 'logo' || hide;
  document.getElementById('header-time').hidden = settings.layout !== 'time' || hide;
  document.getElementById('header-date').hidden = settings.layout !== 'date' || hide;
  document.querySelectorAll('.layout-btn').forEach(b =>
    b.classList.toggle('active', !hide && b.dataset.value === settings.layout)
  );
  const hasSubline =
    (settings.layout === 'time' && settings.showDate) ||
    settings.layout === 'date';
  document.getElementById('header').classList.toggle('has-subline', !hide && hasSubline);
}

function renderSearch() {
  document.getElementById('search-container').hidden = settings.hideSearch;
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
  (settings.quickLinks || []).forEach(link => {
    if (!link.label || !link.url) return;
    const a = document.createElement('a');
    a.className = 'quick-link';
    a.href = link.url;
    a.textContent = link.label;
    a.addEventListener('click', e => { e.preventDefault(); window.location.href = link.url; });
    container.appendChild(a);
    styleBrandLink(a, link.url);
  });
}

// Colour a quick-link pill to match its site. Curated overrides win; otherwise
// we read the colour from Chrome's local favicon cache (once, then remembered).
function styleBrandLink(a, url) {
  const domain = BrandColors.domainOf(url);
  if (!domain) return;

  const override = BrandColors.lookup(domain);
  if (override) { applyBrandStyle(a, override); return; }

  const cache = settings.brandColorCache || {};
  if (cache[domain]) { applyBrandStyle(a, cache[domain]); return; }

  // Not cached yet: read the local favicon. We only remember successes, so a
  // site with no cached icon yet (never visited) will light up on a later new
  // tab once Chrome has its favicon — no permanent "no colour" verdict.
  BrandColors.extract(url).then(colors => {
    if (!colors) return;
    settings.brandColorCache = settings.brandColorCache || {};
    settings.brandColorCache[domain] = colors;
    Storage.save({ brandColorCache: settings.brandColorCache });
    applyBrandStyle(a, colors);
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
    engine.switchTheme(THEME_MAP[theme]);
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

// ── Background picker navigation (Main → Categories → Backgrounds) ──────────

const VIEW_INDEX = { main: 0, categories: 1, backgrounds: 2 };
const nav = { view: 'main', categoryKey: null };
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

function navigateTo(view, categoryKey = null, animate = true) {
  nav.view = view;
  if (view === 'backgrounds') nav.categoryKey = categoryKey;

  if (view === 'main') {
    renderAppearance();
  } else {
    livePreview.stop();
    if (view === 'categories') buildCategoryGrid();
    else buildBackgroundGrid(nav.categoryKey);
  }
  applyNavTransforms(animate);
}

// ── Screen 1: Appearance ─────────────────────────────────────────────────────

function renderAppearance() {
  document.getElementById('appearance-name').textContent =
    THEME_LABELS[settings.theme] || '';
  startAppearancePreview();
}

function startAppearancePreview() {
  const overlay = document.getElementById('settings-overlay');
  if (!overlay.classList.contains('open') || nav.view !== 'main') return;
  livePreview.show(THEME_MAP[settings.theme] || StarfieldTheme, {
    intensity:  Storage.intensityValue(settings.intensity),
    quality:    Storage.qualityValue(settings.intensity),
    speed:      settings.animSpeed,
    staticMode: settings.staticMode,
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

function buildCategoryGrid() {
  const grid = document.getElementById('category-grid');
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
  if (!cat) { navigateTo('categories'); return; }

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
  engine.switchTheme(THEME_MAP[themeKey]);
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
    renderAppearance();
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

  document.getElementById('change-background').addEventListener('click', () => navigateTo('categories'));
  document.getElementById('back-to-main').addEventListener('click', () => navigateTo('main'));
  document.getElementById('back-to-categories').addEventListener('click', () => navigateTo('categories'));

  const randAll = document.getElementById('randomize-all-daily');
  randAll.classList.toggle('active', settings.randomizeDaily === 'all');
  randAll.addEventListener('click', () => handleRandomizeClick('all'));

  buildFontSettings();
  buildDisplaySettings();
  buildQuickLinksEditor();
  buildAnimationSettings();
  initSectionToggles();
}

function initSectionToggles() {
  const collapsed = settings.collapsedSections || {};

  document.querySelectorAll('.settings-section').forEach(section => {
    const key  = section.dataset.section;
    const btn  = section.querySelector('.section-toggle');
    const body = section.querySelector('.section-body');

    if (collapsed[key]) {
      body.style.height = '0px';
      section.classList.add('collapsed');
      btn.setAttribute('aria-expanded', 'false');
    } else {
      body.style.height = body.scrollHeight + 'px';
      requestAnimationFrame(() => { body.style.height = ''; });
    }

    btn.addEventListener('click', () => {
      const isCollapsed = section.classList.contains('collapsed');

      if (isCollapsed) {
        section.classList.remove('collapsed');
        btn.setAttribute('aria-expanded', 'true');
        body.style.height = '0px';
        body.getBoundingClientRect();
        body.style.height = body.scrollHeight + 'px';
        body.addEventListener('transitionend', () => { body.style.height = ''; }, { once: true });
      } else {
        body.style.height = body.scrollHeight + 'px';
        body.getBoundingClientRect();
        body.style.height = '0px';
        section.classList.add('collapsed');
        btn.setAttribute('aria-expanded', 'false');
      }

      settings.collapsedSections = settings.collapsedSections || {};
      settings.collapsedSections[key] = !isCollapsed;
      Storage.save({ collapsedSections: settings.collapsedSections });
    });
  });
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
      applyFont();
      document.querySelectorAll('.font-option').forEach(b => b.classList.toggle('active', b === btn));
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
  updateSubSections();

  layoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      settings.layout = btn.dataset.value;
      Storage.save({ layout: btn.dataset.value });
      layoutBtns.forEach(b => b.classList.toggle('active', b === btn));
      updateSubSections();
      renderHeader();
      tickClock();
    });
  });

  h12El.addEventListener('change', () => {
    settings.clockFormat = h12El.checked ? '12h' : '24h';
    Storage.save({ clockFormat: settings.clockFormat });
    tickClock();
  });
  secsEl.addEventListener('change', () => {
    settings.showSeconds = secsEl.checked;
    Storage.save({ showSeconds: secsEl.checked });
    tickClock();
  });
  dateEl.addEventListener('change', () => {
    settings.showDate = dateEl.checked;
    Storage.save({ showDate: dateEl.checked });
    renderHeader();
    tickClock();
  });
  timeDateEl.addEventListener('change', () => {
    settings.showTimeInDate = timeDateEl.checked;
    Storage.save({ showTimeInDate: timeDateEl.checked });
    renderHeader();
    tickClock();
  });
  hideTextEl.addEventListener('change', () => {
    settings.hideText = hideTextEl.checked;
    Storage.save({ hideText: hideTextEl.checked });
    renderHeader();
  });
  hideSearchEl.addEventListener('change', () => {
    settings.hideSearch = hideSearchEl.checked;
    Storage.save({ hideSearch: hideSearchEl.checked });
    renderSearch();
  });
}

// Quick links editor
function buildQuickLinksEditor() {
  const container = document.getElementById('quick-links-editor');
  const addBtn    = document.getElementById('add-quick-link');

  const renderEditor = () => {
    container.innerHTML = '';
    (settings.quickLinks || []).forEach((link, i) => {
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
    addBtn.disabled = (settings.quickLinks || []).length >= 6;
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
      engine.setOptions({
        intensity: Storage.intensityValue(btn.dataset.value),
        quality:   Storage.qualityValue(btn.dataset.value),
      });
      engine.switchTheme(THEME_MAP[settings.theme] || StarfieldTheme);
      startAppearancePreview();
    });
  });

  speedEl.addEventListener('input', () => {
    const v = parseFloat(speedEl.value);
    settings.animSpeed = v;
    Storage.save({ animSpeed: v });
    engine.setOptions({ speed: v });
    livePreview.setSpeed(v);
    const display = Number.isInteger(v) ? v + '' : v.toFixed(2).replace(/0+$/, '');
    speedLbl.textContent = display + '×';
  });

  staticEl.addEventListener('change', () => {
    settings.staticMode = staticEl.checked;
    Storage.save({ staticMode: staticEl.checked });
    engine.setOptions({ staticMode: staticEl.checked });
    startAppearancePreview();
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
