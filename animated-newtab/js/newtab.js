'use strict';

const THEME_MAP = {
  starfield:  StarfieldTheme,
  nebula:     NebulaTheme,
  galaxy:     GalaxyTheme,
  particles:  ParticlesTheme,
  hyperspace: HyperspaceTheme,
  meteor:     MeteorShowerTheme,
  blackhole:  BlackHoleTheme,
  sakura:     SakuraPetalsTheme,
  fireflies:  ForestFirefliesTheme,
  bokeh:      BokehLightsTheme,
};

const THEME_LABELS = {
  starfield:  'Deep Space',
  nebula:     'Nebula Drift',
  galaxy:     'Galaxy Spiral',
  particles:  'Constellations',
  hyperspace: 'Hyperspace',
  meteor:     'Meteor Shower',
  blackhole:  'Black Hole',
  sakura:     'Sakura Petals',
  fireflies:  'Forest Fireflies',
  bokeh:      'Bokeh Lights',
};

const THEME_GROUPS = [
  { key: 'space',  label: 'Space',  themes: ['starfield','nebula','galaxy','particles','hyperspace','meteor','blackhole'] },
  { key: 'nature', label: 'Nature', themes: ['sakura', 'fireflies', 'bokeh'] },
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
  // Remove active highlight from layout buttons when text is hidden
  document.querySelectorAll('.layout-btn').forEach(b =>
    b.classList.toggle('active', !hide && b.dataset.value === settings.layout)
  );
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

  // Time header
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

  // Date header
  document.getElementById('date-weekday').textContent = now.toLocaleDateString('en-US', { weekday: 'long' });
  document.getElementById('date-full').textContent    = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const timeSmall = document.getElementById('date-time-small');
  if (settings.showTimeInDate) {
    timeSmall.textContent = `${h}:${pad(m)}${is12 ? ' ' + ampm : ''}`;
    timeSmall.hidden = false;
  } else {
    timeSmall.hidden = true;
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

// ── Settings panel ────────────────────────────────────────────────────────────

function initSettings() {
  const btn     = document.getElementById('settings-btn');
  const overlay = document.getElementById('settings-overlay');
  const panel   = document.getElementById('settings-panel');
  const closeBtn= document.getElementById('settings-close');

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

    // Apply initial state instantly — no transition on load
    if (collapsed[key]) {
      body.style.height = '0px';
      section.classList.add('collapsed');
      btn.setAttribute('aria-expanded', 'false');
    } else {
      // Pin open height so transitions have an explicit value to start from
      body.style.height = body.scrollHeight + 'px';
      // Release to auto after one frame so the panel can resize freely
      requestAnimationFrame(() => { body.style.height = ''; });
    }

    btn.addEventListener('click', () => {
      const isCollapsed = section.classList.contains('collapsed');

      if (isCollapsed) {
        // Expand: 0 → natural height, then release to auto
        section.classList.remove('collapsed');
        btn.setAttribute('aria-expanded', 'true');
        body.style.height = '0px';
        // Force layout so transition starts from 0
        body.getBoundingClientRect();
        body.style.height = body.scrollHeight + 'px';
        body.addEventListener('transitionend', () => {
          body.style.height = '';
        }, { once: true });
      } else {
        // Collapse: natural height → exact 0
        body.style.height = body.scrollHeight + 'px';
        body.getBoundingClientRect(); // commit explicit height
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

    themes.forEach(themeKey => {
      const btn = document.createElement('button');
      btn.className = 'theme-option' + (settings.theme === themeKey ? ' active' : '');
      btn.dataset.theme = themeKey;
      btn.type = 'button';
      btn.innerHTML = `<span class="theme-dot theme-dot-${themeKey}"></span><span>${THEME_LABELS[themeKey]}</span>`;
      btn.addEventListener('click', () => {
        settings.theme = themeKey;
        Storage.save({ theme: themeKey });
        document.querySelectorAll('.theme-option').forEach(b => b.classList.toggle('active', b.dataset.theme === themeKey));
        engine.switchTheme(THEME_MAP[themeKey]);
      });
      body.appendChild(btn);
    });

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

  // Init states
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
    tickClock();
  });
  timeDateEl.addEventListener('change', () => {
    settings.showTimeInDate = timeDateEl.checked;
    Storage.save({ showTimeInDate: timeDateEl.checked });
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
        <input class="ql-url"   type="url"  placeholder="https://…"  value="${escHtml(link.url   || '')}">
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
