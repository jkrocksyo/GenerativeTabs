'use strict';

const THEME_MAP = {
  starfield: StarfieldTheme,
  nebula:    NebulaTheme,
  galaxy:    GalaxyTheme,
  aurora:    AuroraTheme,
  particles: ParticlesTheme,
};

(async () => {
  const settings = await Storage.load();

  const engine = new ThemeEngine(document.getElementById('canvas-container'));
  engine.setOptions({
    intensity:  Storage.intensityValue(settings.intensity),
    staticMode: settings.staticMode,
  });
  engine.switchTheme(THEME_MAP[settings.theme] || StarfieldTheme);

  // Stay in sync when the user changes settings on the new tab page
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes) => {
      let needsReinit = false;

      if (changes.theme)     { settings.theme     = changes.theme.newValue;     needsReinit = true; }
      if (changes.intensity) { settings.intensity = changes.intensity.newValue; needsReinit = true; }
      if (changes.staticMode) {
        settings.staticMode = changes.staticMode.newValue;
        engine.setOptions({ staticMode: settings.staticMode });
      }

      if (needsReinit) {
        engine.setOptions({ intensity: Storage.intensityValue(settings.intensity) });
        engine.switchTheme(THEME_MAP[settings.theme] || StarfieldTheme);
      }
    });
  }

  // Fade in
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const overlay = document.getElementById('fade-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 600);
  }));
})();
