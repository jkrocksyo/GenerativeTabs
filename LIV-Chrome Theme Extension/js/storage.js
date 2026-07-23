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
    hideSearch:         false,
    // corners + center column: 'center' keeps the classic centered stack
    logoPosition:       'center',
    logoScale:          1.0,        // header text size multiplier (slider only)
    quickLinks:         [],
    quickLinkGrid:      {},         // { linkId: {row,col} } — grid positions
    iconOnly:           false,      // quick links: icon-only tiles vs oval pills
    brandColors:        false,      // colour quick-link pills to match each site
    brandColorCache:    {},         // { domain: {bg,fg} } cached favicon colours
    intensity:          'medium',
    animSpeed:          1.0,
    staticMode:         false,
    cardSize:           'roomy',    // quick-link card size: 'compact' | 'roomy'
    iconStyle:          'favicon',  // quick-link icon: 'favicon' | 'custom'
    newTabLinks:        false,      // open quick links in a new tab
    favorites:          [],
    randomizeDaily:     null,
    randomizeDailyDate: '',
    // Per-background Advanced Custom Preset overrides, keyed by theme.
    // Absent / { enabled:false } → background inherits global settings live.
    // { enabled:true } → background always uses its own stored values.
    overrides:          {},
  };

  const INTENSITY_MAP = { low: 0.5, medium: 1.0, high: 1.6 };
  // Intensity doubles as a quality control: each tier also caps the render
  // resolution (device-pixel ratio). Lower tier → fewer pixels/frame → less
  // GPU. High keeps full native retina sharpness (the previous fixed cap).
  const QUALITY_MAP = { low: 1.0, medium: 1.5, high: 2.0 };

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

  function intensityValue(name) {
    return INTENSITY_MAP[name] || 1.0;
  }

  function qualityValue(name) {
    return QUALITY_MAP[name] || 1.5;
  }

  return { DEFAULTS, load, save, intensityValue, qualityValue };
})();
