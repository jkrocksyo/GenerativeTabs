'use strict';

// Scene previews for the background picker.
//
// No pre-rendered thumbnail images exist yet, so previews come straight from
// the real scene renderers:
//   - getThumbnail() runs a theme on a small offscreen canvas for a few
//     simulated seconds (so scenes settle and populate), captures one frame
//     as a data URL, and caches it for the session.
//   - LivePreview drives a small animated render of one theme inside a
//     container element (used for the current-background preview).
const ScenePreview = (() => {
  const SNAP_W  = 480;   // 16:9 capture resolution
  const SNAP_H  = 270;
  const SIM_MS  = 4000;  // simulated time before the frame is captured
  const STEP_MS = 33;

  const cache = new Map();     // themeKey -> dataURL
  const inflight = new Map();  // themeKey -> Promise<dataURL|null>
  let queue = Promise.resolve();

  function createContext(canvas, theme) {
    if ((theme.contextType || '2d') === 'webgl') {
      // preserveDrawingBuffer so the frame survives until toDataURL. Themes
      // that call getContext('webgl') themselves get back this same context.
      const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true }) ||
                 canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
      if (gl) return gl;
      theme.webglFailed = true;
    }
    return canvas.getContext('2d');
  }

  function renderSnapshot(ThemeClass) {
    const theme = new ThemeClass();

    // Themes size themselves from clientWidth, so the canvas needs layout —
    // it joins the DOM offscreen for the duration of the capture.
    const canvas = document.createElement('canvas');
    canvas.width = SNAP_W;
    canvas.height = SNAP_H;
    canvas.style.cssText =
      `position:fixed;left:-${SNAP_W * 2}px;top:0;width:${SNAP_W}px;height:${SNAP_H}px;`;
    document.body.appendChild(canvas);

    try {
      const ctx = createContext(canvas, theme);
      theme.init(canvas, ctx, { intensity: 1.0, speed: 1.0, staticMode: false });
      for (let t = 0; t <= SIM_MS; t += STEP_MS) theme.draw(t);

      const out = document.createElement('canvas');
      out.width = SNAP_W;
      out.height = SNAP_H;
      out.getContext('2d').drawImage(canvas, 0, 0, SNAP_W, SNAP_H);
      return out.toDataURL('image/jpeg', 0.85);
    } finally {
      try { theme.destroy(); } catch (e) { /* one broken theme shouldn't kill the picker */ }
      canvas.remove();
    }
  }

  function getThumbnail(themeKey, ThemeClass) {
    if (cache.has(themeKey)) return Promise.resolve(cache.get(themeKey));
    if (inflight.has(themeKey)) return inflight.get(themeKey);
    if (!ThemeClass) return Promise.resolve(null);

    // Serialize generation, one snapshot per frame, so opening a grid of
    // tiles doesn't jank the panel animation.
    const p = queue = queue.then(() => new Promise(resolve => {
      requestAnimationFrame(() => {
        let url = null;
        try { url = renderSnapshot(ThemeClass); }
        catch (e) { console.warn('Scene snapshot failed:', themeKey, e); }
        if (url) cache.set(themeKey, url);
        inflight.delete(themeKey);
        resolve(url);
      });
    }));
    inflight.set(themeKey, p);
    return p;
  }

  class LivePreview {
    constructor(container) {
      this.container = container;
      this.theme = null;
      this.canvas = null;
      this.rafId = null;
    }

    show(ThemeClass, opts) {
      this.stop();
      if (!ThemeClass) return;

      // Fresh canvas each time — a canvas is permanently bound to its first
      // context type, and themes may need 2d or webgl.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, this.container.clientWidth);
      const h = Math.max(1, Math.round(w * SNAP_H / SNAP_W));
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      this.container.replaceChildren(canvas);
      this.canvas = canvas;

      const theme = new ThemeClass();
      const ctx = createContext(canvas, theme);
      theme.init(canvas, ctx, Object.assign({}, opts));
      this.theme = theme;

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (opts.staticMode || reduced) {
        // settle on a populated frame, then hold still
        for (let t = 0; t <= SIM_MS; t += STEP_MS) theme.draw(t);
        return;
      }
      const loop = ts => {
        this.rafId = requestAnimationFrame(loop);
        if (this.theme) this.theme.draw(ts);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    setSpeed(v) {
      if (this.theme) this.theme.speed = v;
    }

    stop() {
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
      if (this.theme) {
        try { this.theme.destroy(); } catch (e) { /* ignore */ }
        this.theme = null;
      }
      if (this.canvas) { this.canvas.remove(); this.canvas = null; }
    }
  }

  return { getThumbnail, LivePreview };
})();
