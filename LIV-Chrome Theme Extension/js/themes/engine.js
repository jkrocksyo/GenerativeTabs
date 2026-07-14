'use strict';

class ThemeEngine {
  constructor(containerEl) {
    this.container = containerEl;
    this.canvas = null;
    this.ctx = null;
    this.currentTheme = null;
    this.rafId = null;
    this.lastTimestamp = 0;
    this._activeContextType = null;
    this._webglFailed = false;
    this._dpr = 1;

    this.options = { intensity: 1.0, staticMode: false, speed: 1.0, quality: 2 };

    this._prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._onResize = this._debounce(this._handleResize.bind(this), 150);
    this._onVisibility = this._handleVisibility.bind(this);

    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibility);

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', e => {
      this._prefersReducedMotion = e.matches;
      this._checkShouldAnimate();
    });
  }

  _debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  }

  _sizeCanvas(canvas) {
    this._dpr = Math.min(window.devicePixelRatio || 1, this.options.quality || 2);
    canvas.width = Math.floor(window.innerWidth * this._dpr);
    canvas.height = Math.floor(window.innerHeight * this._dpr);
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
  }

  _createCanvas(contextType) {
    const canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    this._sizeCanvas(canvas);

    if (this.canvas && this.container.contains(this.canvas)) {
      this.container.replaceChild(canvas, this.canvas);
    } else {
      this.container.insertBefore(canvas, this.container.firstChild);
    }

    this.canvas = canvas;
    this._webglFailed = false;

    if (contextType === 'webgl') {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        this.ctx = gl;
        this._activeContextType = 'webgl';
      } else {
        // WebGL unavailable — fall back to 2D and let theme know
        this.ctx = canvas.getContext('2d');
        this._activeContextType = '2d';
        this._webglFailed = true;
      }
    } else {
      this.ctx = canvas.getContext('2d');
      this._activeContextType = '2d';
    }
  }

  _handleResize() {
    if (!this.canvas) return;
    this._sizeCanvas(this.canvas);
    if (this._activeContextType === 'webgl' && this.ctx) {
      this.ctx.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.currentTheme) this.currentTheme.resize(this.canvas.width, this.canvas.height);
  }

  _handleVisibility() {
    if (document.hidden) this._stopLoop();
    else this._checkShouldAnimate();
  }

  _shouldAnimate() {
    return !this.options.staticMode && !this._prefersReducedMotion && !document.hidden;
  }

  _checkShouldAnimate() {
    if (this._shouldAnimate()) this._startLoop();
    else {
      this._stopLoop();
      if (this.currentTheme) this.currentTheme.draw(0);
    }
  }

  _startLoop() {
    if (this.rafId) return;
    this.lastTimestamp = 0;
    const loop = ts => {
      this.rafId = requestAnimationFrame(loop);
      if (!this.lastTimestamp) { this.lastTimestamp = ts; return; }
      const delta = ts - this.lastTimestamp;
      if (delta < 16) return; // cap at ~60fps
      this.lastTimestamp = ts;
      if (this.currentTheme) this.currentTheme.draw(ts);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  _stopLoop() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  setOptions(opts) {
    const qualityChanged =
      opts.quality !== undefined && opts.quality !== this.options.quality;
    Object.assign(this.options, opts);
    if (this.currentTheme && opts.speed !== undefined) {
      this.currentTheme.speed = opts.speed;
    }
    // Changing the quality cap changes the canvas resolution — re-size so it
    // takes effect immediately (also notifies the theme via resize()).
    if (qualityChanged && this.canvas) this._handleResize();
    this._checkShouldAnimate();
  }

  switchTheme(ThemeClass) {
    this._stopLoop();
    if (this.currentTheme) {
      this.currentTheme.destroy();
      this.currentTheme = null;
      // Force canvas recreation: destroy() calls loseContext() on WebGL themes,
      // so reusing the same canvas would give the new theme a dead context.
      this._activeContextType = null;
    }

    const theme = new ThemeClass();
    const needsType = theme.contextType || '2d';

    // Recreate canvas whenever context type changes (or first run)
    if (this._activeContextType !== needsType) {
      this._createCanvas(needsType);
    }

    if (this._webglFailed) theme.webglFailed = true;

    theme.init(this.canvas, this.ctx, Object.assign({}, this.options));
    this.currentTheme = theme;
    this._checkShouldAnimate();
  }

  destroy() {
    this._stopLoop();
    if (this.currentTheme) this.currentTheme.destroy();
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
  }
}
