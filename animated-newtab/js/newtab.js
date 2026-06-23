'use strict';

const THEME_MAP = {
  starfield: StarfieldTheme,
  nebula:    NebulaTheme,
  galaxy:    GalaxyTheme,
  aurora:    AuroraTheme,
  particles: ParticlesTheme,
};

const THEME_LABELS = {
  starfield: 'Deep Space',
  nebula:    'Nebula Drift',
  galaxy:    'Galaxy Spiral',
  aurora:    'Aurora Borealis',
  particles: 'Drift',
};

const SEARCH_URLS = {
  google:     q => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  bing:       q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  duckduckgo: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  custom:     (q, url) => url.replace('{query}', encodeURIComponent(q)),
};

let engine;
let settings;
let clockInterval;

// ── Boot ─────────────────────────────────────────────────────────────────────

(async () => {
  settings = await Storage.load();

  engine = new ThemeEngine(document.getElementById('canvas-container'));
  engine.setOptions({
    intensity:  Storage.intensityValue(settings.intensity),
    staticMode: settings.staticMode,
  });
  engine.switchTheme(THEME_MAP[settings.theme] || StarfieldTheme);

  initClock();
  initSearch();
  renderQuickLinks();
  initSettings();

  // Fade in — remove overlay after first paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const overlay = document.getElementById('fade-overlay');
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 600);
    });
  });
})();

// ── Clock ─────────────────────────────────────────────────────────────────────

function initClock() {
  tickClock();
  clockInterval = setInterval(tickClock, 1000);
}

function tickClock() {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  const is12 = settings.clockFormat === '12h';
  let ampm = '';
  if (is12) {
    ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
  }

  document.getElementById('clock-hm').textContent = `${h}:${pad(m)}`;

  const secEl = document.getElementById('clock-s');
  if (settings.showSeconds) {
    secEl.textContent = `:${pad(s)}`;
    secEl.hidden = false;
  } else {
    secEl.hidden = true;
  }

  const ampmEl = document.getElementById('clock-ampm');
  if (is12) {
    ampmEl.textContent = ` ${ampm}`;
    ampmEl.hidden = false;
  } else {
    ampmEl.hidden = true;
  }

  const dateEl = document.getElementById('clock-date');
  if (settings.showDate) {
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    dateEl.hidden = false;
  } else {
    dateEl.hidden = true;
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
    const eng = settings.searchEngine;
    const fn = SEARCH_URLS[eng] || SEARCH_URLS.google;
    window.location.href = fn(q, settings.customSearchUrl);
  });
}

// ── Quick links ───────────────────────────────────────────────────────────────

function renderQuickLinks() {
  const container = document.getElementById('quick-links');
  container.innerHTML = '';
  const links = settings.quickLinks || [];
  if (!links.length) return;
  links.forEach(link => {
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
  const btn      = document.getElementById('settings-btn');
  const overlay  = document.getElementById('settings-overlay');
  const panel    = document.getElementById('settings-panel');
  const closeBtn = document.getElementById('settings-close');

  const openPanel = () => {
    overlay.classList.remove('hidden');
    overlay.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    closeBtn.focus();
  };
  const closePanel = () => {
    overlay.classList.remove('open');
    overlay.classList.add('closing');
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.classList.remove('closing');
    }, 280);
    panel.setAttribute('aria-hidden', 'true');
    btn.focus();
  };

  btn.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);
  overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) closePanel(); });

  buildSettingsUI();
}

function buildSettingsUI() {
  buildThemePicker();
  buildClockSettings();
  buildSearchSettings();
  buildQuickLinksEditor();
  buildAnimationSettings();
}

// Theme picker
function buildThemePicker() {
  const container = document.getElementById('theme-picker');
  container.innerHTML = '';
  for (const [key, label] of Object.entries(THEME_LABELS)) {
    const btn = document.createElement('button');
    btn.className = 'theme-option' + (settings.theme === key ? ' active' : '');
    btn.dataset.theme = key;
    btn.type = 'button';
    btn.innerHTML = `<span class="theme-dot theme-dot-${key}"></span><span>${label}</span>`;
    btn.addEventListener('click', () => {
      settings.theme = key;
      Storage.save({ theme: key });
      document.querySelectorAll('.theme-option').forEach(b => b.classList.toggle('active', b.dataset.theme === key));
      engine.switchTheme(THEME_MAP[key]);
    });
    container.appendChild(btn);
  }
}

// Clock settings
function buildClockSettings() {
  const h12 = document.getElementById('setting-12h');
  const secs = document.getElementById('setting-seconds');
  const date = document.getElementById('setting-date');

  h12.checked  = settings.clockFormat === '12h';
  secs.checked = settings.showSeconds;
  date.checked = settings.showDate;

  h12.addEventListener('change', () => {
    settings.clockFormat = h12.checked ? '12h' : '24h';
    Storage.save({ clockFormat: settings.clockFormat });
    tickClock();
  });
  secs.addEventListener('change', () => {
    settings.showSeconds = secs.checked;
    Storage.save({ showSeconds: secs.checked });
    tickClock();
  });
  date.addEventListener('change', () => {
    settings.showDate = date.checked;
    Storage.save({ showDate: date.checked });
    tickClock();
  });
}

// Search settings
function buildSearchSettings() {
  const sel  = document.getElementById('setting-engine');
  const cRow = document.getElementById('custom-url-row');
  const cUrl = document.getElementById('setting-custom-url');

  sel.value  = settings.searchEngine;
  cUrl.value = settings.customSearchUrl;
  cRow.classList.toggle('hidden', settings.searchEngine !== 'custom');

  sel.addEventListener('change', () => {
    settings.searchEngine = sel.value;
    Storage.save({ searchEngine: sel.value });
    cRow.classList.toggle('hidden', sel.value !== 'custom');
  });
  cUrl.addEventListener('input', () => {
    settings.customSearchUrl = cUrl.value;
    Storage.save({ customSearchUrl: cUrl.value });
  });
}

// Quick links editor
function buildQuickLinksEditor() {
  const container = document.getElementById('quick-links-editor');
  const addBtn    = document.getElementById('add-quick-link');

  const renderEditor = () => {
    container.innerHTML = '';
    const links = settings.quickLinks || [];
    links.forEach((link, i) => {
      const row = document.createElement('div');
      row.className = 'ql-row';
      row.innerHTML = `
        <input class="ql-label" type="text" placeholder="Label" value="${escHtml(link.label || '')}" maxlength="20">
        <input class="ql-url"   type="url"  placeholder="https://..." value="${escHtml(link.url || '')}">
        <button class="ql-remove" type="button" aria-label="Remove">✕</button>
      `;
      row.querySelector('.ql-label').addEventListener('input', e => {
        settings.quickLinks[i].label = e.target.value;
        saveAndRender();
      });
      row.querySelector('.ql-url').addEventListener('input', e => {
        settings.quickLinks[i].url = e.target.value;
        saveAndRender();
      });
      row.querySelector('.ql-remove').addEventListener('click', () => {
        settings.quickLinks.splice(i, 1);
        saveAndRender(true);
      });
      container.appendChild(row);
    });
    addBtn.disabled = links.length >= 6;
  };

  const saveAndRender = (rebuildEditor = false) => {
    Storage.save({ quickLinks: settings.quickLinks });
    renderQuickLinks();
    if (rebuildEditor) renderEditor();
  };

  addBtn.addEventListener('click', () => {
    if (settings.quickLinks.length >= 6) return;
    settings.quickLinks.push({ label: '', url: '' });
    renderEditor();
  });

  renderEditor();
}

// Animation settings
function buildAnimationSettings() {
  const btns   = document.querySelectorAll('.intensity-btn');
  const static_ = document.getElementById('setting-static');

  btns.forEach(b => b.classList.toggle('active', b.dataset.value === settings.intensity));
  static_.checked = settings.staticMode;

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      settings.intensity = btn.dataset.value;
      Storage.save({ intensity: btn.dataset.value });
      btns.forEach(b => b.classList.toggle('active', b === btn));
      engine.setOptions({ intensity: Storage.intensityValue(btn.dataset.value) });
      // Re-init theme with new intensity
      engine.switchTheme(THEME_MAP[settings.theme] || StarfieldTheme);
    });
  });

  static_.addEventListener('change', () => {
    settings.staticMode = static_.checked;
    Storage.save({ staticMode: static_.checked });
    engine.setOptions({ staticMode: static_.checked });
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
