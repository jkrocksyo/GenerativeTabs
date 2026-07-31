'use strict';

const Storage = (() => {
  const DEFAULTS = {
    theme:              'starfield',
    layout:             'logo',     // 'logo' | 'time' | 'date'
    font:               'system',
    clockFormat:        '12h',
    showSeconds:        true,
    showDate:           true,       // show date below when layout=time
    showTimeInDate:     false,      // show time below when layout=date
    collapsedSections:  {},
    hideText:           false,
    greeting:           true,       // particle greeting on the first tab per session
    greetingName:       '',         // who to greet
    hideSearch:         false,
    // corners + center column: 'center' keeps the classic centered stack
    logoPosition:       'center',
    logoScale:          1.0,        // header text size multiplier (slider only)
    quickLinks:         [],
    quickLinkGrid:      {},         // { linkId: {row,col} } — grid positions
    iconOnly:           false,      // quick links: icon-only tiles vs oval pills
    textOnly:           false,      // quick links: text-only pills (no icon)
    brandColors:        false,      // colour quick-link pills to match each site
    brandColorCache:    {},         // { domain: {bg,fg} } cached favicon colours
    intensity:          1.0,        // effect "amount" multiplier (particles/density)
    quality:            1.5,        // render resolution cap (device-pixel ratio)
    fps:                60,         // animation frame-rate cap: 30 | 60 | 120
    animSpeed:          1.0,
    staticMode:         false,
    newTabLinks:        false,      // open quick links in a new tab
    palettes:           {},         // { themeKey: presetName } colour palettes for Interactive scenes
    favorites:          [],
    randomizeDaily:     null,
    randomizeDailyDate: '',
    // Per-background Advanced Custom Preset overrides, keyed by theme.
    // Absent / { enabled:false } → background inherits global settings live.
    // { enabled:true } → background always uses its own stored values.
    overrides:          {},
  };

  // Intensity and Quality are now two independent, continuous controls:
  //   • Intensity — "amount of something" (particle count / density), a plain
  //     multiplier the themes scale their populations by.
  //   • Quality   — render pixel-ratio. Low downscales for a smooth framerate on
  //     weak machines; high supersamples for extra sharpness on strong ones
  //     (independent of the display's own devicePixelRatio, so it always bites).
  const INTENSITY_MIN = 0.2, INTENSITY_MAX = 2.0, INTENSITY_DEFAULT = 1.0;
  const QUALITY_MIN   = 0.75, QUALITY_MAX  = 3.0, QUALITY_DEFAULT   = 1.5;

  // Legacy: intensity used to be a single 'low'|'medium'|'high' tier that drove
  // both amount and resolution. Map an old tier to the new pair.
  const LEGACY_INTENSITY = { low: 0.5, medium: 1.0, high: 1.6 };
  const LEGACY_QUALITY   = { low: 1.0, medium: 1.5, high: 2.0 };

  function clamp(v, lo, hi, dflt) {
    v = parseFloat(v);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
  }

  function load() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(DEFAULTS, items => resolve(items));
      } else {
        const stored = {};
        for (const [k, v] of Object.entries(DEFAULTS)) {
          const raw = localStorage.getItem('__liv_' + k);
          stored[k] = raw !== null ? JSON.parse(raw) : v;
        }
        resolve(stored);
      }
    });
  }

  function save(updates) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set(updates, resolve);
      } else {
        for (const [k, v] of Object.entries(updates)) {
          localStorage.setItem('__liv_' + k, JSON.stringify(v));
        }
        resolve();
      }
    });
  }

  function intensityValue(v) {
    return clamp(v, INTENSITY_MIN, INTENSITY_MAX, INTENSITY_DEFAULT);
  }

  function qualityValue(v) {
    return clamp(v, QUALITY_MIN, QUALITY_MAX, QUALITY_DEFAULT);
  }

  // In-place upgrade of a settings-shaped object (global settings or a preset):
  // convert a legacy string `intensity` tier into the numeric intensity/quality
  // pair. Returns true when it changed something.
  function normalizeTier(obj) {
    if (!obj || typeof obj.intensity !== 'string') return false;
    // A string intensity is legacy data from before quality existed as its own
    // setting, so the tier is the sole source of truth for both — derive quality
    // from it unconditionally (any `quality` present is just an injected default).
    obj.quality   = LEGACY_QUALITY[obj.intensity]   || QUALITY_DEFAULT;
    obj.intensity = LEGACY_INTENSITY[obj.intensity] || INTENSITY_DEFAULT;
    return true;
  }

  const RANGES = {
    intensity: { min: INTENSITY_MIN, max: INTENSITY_MAX, default: INTENSITY_DEFAULT },
    quality:   { min: QUALITY_MIN,   max: QUALITY_MAX,   default: QUALITY_DEFAULT },
  };

  return { DEFAULTS, RANGES, load, save, intensityValue, qualityValue, normalizeTier };
})();
