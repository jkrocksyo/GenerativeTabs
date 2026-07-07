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
  aurora:         NorthernLightsTheme,
  nightTrain:     NightTrainTheme,
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
  aurora:         'Northern Lights',
  nightTrain:     'Night Train',
};

const THEME_GROUPS = [
  { key: 'space',      label: 'Space',       themes: ['starfield','nebula','galaxy','particles','hyperspace','meteor','blackhole'] },
  { key: 'nature',     label: 'Nature',       themes: ['sakura', 'fireflies', 'bokeh', 'snow'] },
  { key: 'passingby',  label: 'Passing By',   themes: ['bikeRide', 'dogWalk', 'cityDrive', 'hotAirBalloon'] },
  { key: 'quiet',      label: 'Quiet Moments', themes: ['rainyWindow', 'lanterns', 'fireside', 'aurora', 'nightTrain'] },
];

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
    if (q) window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
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
  });
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
  } else {
    const theme = getRandomThemeFromPool(pool);
    const today = new Date().toISOString().slice(0, 10);
    settings.randomizeDaily = pool;
    settings.theme = theme;
    settings.randomizeDailyDate = today;
    Storage.save({ randomizeDaily: pool, theme, randomizeDailyDate: today });
    engine.switchTheme(THEME_MAP[theme]);
    document.querySelectorAll('.theme-option').forEach(b =>
      b.classList.toggle('active', b.dataset.theme === theme)
    );
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

  document.querySelectorAll(`.theme-star[data-theme="${themeKey}"]`).forEach(star => {
    const isFav = favs.includes(themeKey);
    star.classList.toggle('favorited', isFav);
    star.innerHTML = isFav ? '★' : '☆';
    star.setAttribute('aria-label', (isFav ? 'Unfavorite ' : 'Favorite ') + THEME_LABELS[themeKey]);
  });

  buildFavoritesGroup();
}

function makeThemeOption(themeKey) {
  const isFav = (settings.favorites || []).includes(themeKey);

  const btn = document.createElement('button');
  btn.className = 'theme-option' + (settings.theme === themeKey ? ' active' : '');
  btn.dataset.theme = themeKey;
  btn.type = 'button';

  const dot = document.createElement('span');
  dot.className = `theme-dot theme-dot-${themeKey}`;

  const labelEl = document.createElement('span');
  labelEl.textContent = THEME_LABELS[themeKey];

  const star = document.createElement('span');
  star.className = 'theme-star' + (isFav ? ' favorited' : '');
  star.dataset.theme = themeKey;
  star.setAttribute('role', 'button');
  star.setAttribute('aria-label', (isFav ? 'Unfavorite ' : 'Favorite ') + THEME_LABELS[themeKey]);
  star.textContent = isFav ? '★' : '☆';
  star.addEventListener('click', e => {
    e.stopPropagation();
    toggleFavorite(themeKey);
  });

  btn.appendChild(dot);
  btn.appendChild(labelEl);
  btn.appendChild(star);

  btn.addEventListener('click', () => {
    settings.theme = themeKey;
    Storage.save({ theme: themeKey });
    document.querySelectorAll('.theme-option').forEach(b => b.classList.toggle('active', b.dataset.theme === themeKey));
    engine.switchTheme(THEME_MAP[themeKey]);
  });

  return btn;
}

function buildFavoritesGroup() {
  const container = document.getElementById('favorites-group-body');
  if (!container) return;

  const toggle = container.closest('.theme-group')?.querySelector('.theme-group-toggle');
  const isOpen = toggle?.getAttribute('aria-expanded') === 'true';

  container.innerHTML = '';
  const favs = (settings.favorites || []).filter(k => THEME_MAP[k]);

  if (favs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'favorites-empty';
    empty.textContent = 'No Favorites Added';
    container.appendChild(empty);
  } else {
    container.appendChild(makeRandomizeDailyBtn('favorites', 'Randomize Favorites Daily'));
    favs.forEach(themeKey => container.appendChild(makeThemeOption(themeKey)));
  }

  if (isOpen) container.style.height = '';
}

// ── Settings panel ────────────────────────────────────────────────────────────

function initSettings() {
  const btn      = document.getElementById('settings-btn');
  const overlay  = document.getElementById('settings-overlay');
  const panel    = document.getElementById('settings-panel');
  const closeBtn = document.getElementById('settings-close');

  const open = () => {
    overlay.classList.remove('hidden', 'closing');
    overlay.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  };
  const close = () => {
    overlay.classList.remove('open');
    overlay.classList.add('closing');
    setTimeout(() => { overlay.classList.add('hidden'); overlay.classList.remove('closing'); }, 280);
    panel.setAttribute('aria-hidden', 'true');
    btn.focus();
  };

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });

  const randAll = document.getElementById('randomize-all-daily');
  randAll.classList.toggle('active', settings.randomizeDaily === 'all');
  randAll.addEventListener('click', () => handleRandomizeClick('all'));

  buildThemePicker();
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

// Theme picker
function buildThemePicker() {
  const container = document.getElementById('theme-picker');
  container.innerHTML = '';

  // Favorites group
  const favStateKey = 'theme-favorites';
  const favCollapsed = (settings.collapsedSections || {})[favStateKey] || false;

  const favGroup = document.createElement('div');
  favGroup.className = 'theme-group';

  const favToggle = document.createElement('button');
  favToggle.className = 'theme-group-toggle';
  favToggle.type = 'button';
  favToggle.setAttribute('aria-expanded', favCollapsed ? 'false' : 'true');
  favToggle.innerHTML = `<span>Favorites</span><svg class="chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const favBody = document.createElement('div');
  favBody.className = 'theme-group-body';
  favBody.id = 'favorites-group-body';
  if (favCollapsed) favBody.style.height = '0px';

  favToggle.addEventListener('click', () => {
    const isCollapsed = favToggle.getAttribute('aria-expanded') === 'false';
    if (isCollapsed) {
      favToggle.setAttribute('aria-expanded', 'true');
      favBody.style.height = '0px';
      favBody.getBoundingClientRect();
      favBody.style.height = favBody.scrollHeight + 'px';
      favBody.addEventListener('transitionend', () => { favBody.style.height = ''; }, { once: true });
    } else {
      favToggle.setAttribute('aria-expanded', 'false');
      favBody.style.height = favBody.scrollHeight + 'px';
      favBody.getBoundingClientRect();
      favBody.style.height = '0px';
    }
    settings.collapsedSections = settings.collapsedSections || {};
    settings.collapsedSections[favStateKey] = !isCollapsed;
    Storage.save({ collapsedSections: settings.collapsedSections });
  });

  favGroup.appendChild(favToggle);
  favGroup.appendChild(favBody);
  container.appendChild(favGroup);
  buildFavoritesGroup();

  // Space / Nature groups
  THEME_GROUPS.forEach(({ key, label, themes }) => {
    const stateKey = 'theme-' + key;
    const collapsed = (settings.collapsedSections || {})[stateKey] || false;

    const group = document.createElement('div');
    group.className = 'theme-group';

    const toggle = document.createElement('button');
    toggle.className = 'theme-group-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.innerHTML = `<span>${label}</span><svg class="chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const body = document.createElement('div');
    body.className = 'theme-group-body';
    if (collapsed) body.style.height = '0px';

    body.appendChild(makeRandomizeDailyBtn(key, `Randomize ${label} Daily`));
    themes.forEach(themeKey => body.appendChild(makeThemeOption(themeKey)));

    toggle.addEventListener('click', () => {
      const isCollapsed = toggle.getAttribute('aria-expanded') === 'false';
      if (isCollapsed) {
        toggle.setAttribute('aria-expanded', 'true');
        body.style.height = '0px';
        body.getBoundingClientRect();
        body.style.height = body.scrollHeight + 'px';
        body.addEventListener('transitionend', () => { body.style.height = ''; }, { once: true });
      } else {
        toggle.setAttribute('aria-expanded', 'false');
        body.style.height = body.scrollHeight + 'px';
        body.getBoundingClientRect();
        body.style.height = '0px';
      }
      settings.collapsedSections = settings.collapsedSections || {};
      settings.collapsedSections[stateKey] = !isCollapsed;
      Storage.save({ collapsedSections: settings.collapsedSections });
    });

    group.appendChild(toggle);
    group.appendChild(body);
    container.appendChild(group);
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
      engine.setOptions({ intensity: Storage.intensityValue(btn.dataset.value) });
      engine.switchTheme(THEME_MAP[settings.theme] || StarfieldTheme);
    });
  });

  speedEl.addEventListener('input', () => {
    const v = parseFloat(speedEl.value);
    settings.animSpeed = v;
    Storage.save({ animSpeed: v });
    engine.setOptions({ speed: v });
    const display = Number.isInteger(v) ? v + '' : v.toFixed(2).replace(/0+$/, '');
    speedLbl.textContent = display + '×';
  });

  staticEl.addEventListener('change', () => {
    settings.staticMode = staticEl.checked;
    Storage.save({ staticMode: staticEl.checked });
    engine.setOptions({ staticMode: staticEl.checked });
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
