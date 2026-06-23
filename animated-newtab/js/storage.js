'use strict';

const Storage = (() => {
  const DEFAULTS = {
    theme:          'starfield',
    layout:         'logo',     // 'logo' | 'time' | 'date'
    font:           'system',
    clockFormat:    '12h',
    showSeconds:    true,
    showDate:       true,       // show date below when layout=time
    showTimeInDate: false,      // show time below when layout=date
    collapsedSections: {},
    hideText:       false,
    hideSearch:     false,
    quickLinks:     [],
    intensity:      'medium',
    staticMode:     false,
  };

  const INTENSITY_MAP = { low: 0.5, medium: 1.0, high: 1.6 };

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

  return { DEFAULTS, load, save, intensityValue };
})();
