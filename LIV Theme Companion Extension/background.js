'use strict';

// Maps LiV theme keys to the "LIV Theme — <Name>" static extension names.
// Each static theme lives in themes/<key>/manifest.json as a pure Chrome theme.
const THEME_NAME = {
  starfield:  'LIV Theme — Deep Space',
  nebula:     'LIV Theme — Nebula Drift',
  galaxy:     'LIV Theme — Galaxy Spiral',
  particles:  'LIV Theme — Constellations',
  hyperspace: 'LIV Theme — Hyperspace',
  meteor:     'LIV Theme — Meteor Shower',
  blackhole:  'LIV Theme — Black Hole',
  sakura:     'LIV Theme — Sakura Petals',
  fireflies:  'LIV Theme — Forest Fireflies',
  bokeh:      'LIV Theme — Bokeh Lights',
  snow:       'LIV Theme — Falling Snow',
};

// All static theme extension names we manage.
const ALL_THEME_NAMES = new Set(Object.values(THEME_NAME));

// ── Tab group color map (for any grouped tabs) ────────────────────────────────

const TAB_GROUP_COLOR = {
  starfield:  'grey',
  nebula:     'purple',
  galaxy:     'yellow',
  particles:  'blue',
  hyperspace: 'blue',
  meteor:     'orange',
  blackhole:  'grey',
  sakura:     'pink',
  fireflies:  'green',
  bokeh:      'cyan',
  snow:       'grey',
};

// ── Theme switching ───────────────────────────────────────────────────────────

async function applyTheme(themeKey) {
  const targetName = THEME_NAME[themeKey];
  if (!targetName) return;

  let all;
  try {
    all = await chrome.management.getAll();
  } catch (e) {
    console.warn('[LIV Companion] chrome.management unavailable:', e.message);
    return;
  }

  for (const ext of all) {
    if (!ALL_THEME_NAMES.has(ext.name)) continue;
    const shouldEnable = ext.name === targetName;
    if (ext.enabled !== shouldEnable) {
      chrome.management.setEnabled(ext.id, shouldEnable);
    }
  }

  // Color any existing tab groups.
  const groupColor = TAB_GROUP_COLOR[themeKey] ?? 'grey';
  if (chrome.tabGroups?.update) {
    try {
      const groups = await chrome.tabGroups.query({});
      for (const group of groups) {
        chrome.tabGroups.update(group.id, {color: groupColor});
      }
    } catch (_) {}
  }
}

async function resetTheme() {
  let all;
  try {
    all = await chrome.management.getAll();
  } catch (_) { return; }

  for (const ext of all) {
    if (ALL_THEME_NAMES.has(ext.name) && ext.enabled) {
      chrome.management.setEnabled(ext.id, false);
    }
  }
}

// ── LiV subscription ──────────────────────────────────────────────────────────

// Receive pushed theme changes from LiV's background service worker.
chrome.runtime.onMessageExternal.addListener((msg) => {
  if (msg.type === 'livTheme:changed') applyTheme(msg.livTheme);
});

// ── Startup ───────────────────────────────────────────────────────────────────

let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;

  // Find the LiV extension by name. Cache its ID in session storage so we
  // don't call management.getAll() on every service worker wake-up.
  let livId;
  try {
    ({livId} = await chrome.storage.session.get('livId'));
  } catch (_) {}

  if (!livId) {
    try {
      const all = await chrome.management.getAll();
      const liv = all.find(e => e.name === 'Liv' && e.enabled);
      if (!liv) {
        console.info('[LIV Companion] LiV extension not found or not enabled.');
        return;
      }
      livId = liv.id;
      chrome.storage.session.set({livId});
    } catch (e) {
      console.warn('[LIV Companion] chrome.management error:', e.message);
      return;
    }
  }

  // Subscribe and get current theme in one round-trip.
  try {
    const response = await chrome.runtime.sendMessage(livId, {type: 'livTheme:subscribe'});
    if (response?.livTheme) await applyTheme(response.livTheme);
  } catch (e) {
    console.info('[LIV Companion] Could not reach LiV SW:', e.message);
    // LiV SW may have been idle; it will push on the next theme change.
  }
}

chrome.runtime.onInstalled.addListener(() => { initialized = false; init(); });
chrome.runtime.onStartup.addListener(() => { initialized = false; init(); });
chrome.tabs.onActivated.addListener(() => { if (!initialized) init(); });
