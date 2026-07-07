'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Quasi-Gaussian sample in roughly [-2, 2].
  function gauss() {
    return Math.random() + Math.random() + Math.random() + Math.random() - 2;
  }

  // Golden Hour — the last minutes of sun over open water. The sky and sun
  // are painted once; the life of the scene is in two things: banks of
  // clouds lit from below (each one a cluster of soft puffs with a warm
  // under-light pass baked in) drifting at parallax speeds, and the glitter
  // path — hundreds of horizontal glints with a Gaussian spread around the
  // sun line, fused near the horizon, long and sparse near the viewer.
  class GoldenHourTheme {
    init(canvas, ctx, opts) {
      this.canvas    = canvas;
      this.ctx       = ctx || canvas.getContext('2d');
      this.speed     = (opts && opts.speed) || 1;
      this.intensity = (opts && opts.intensity) || 1;
      this._t        = rand(0, 500);
      this._lastTs   = null;
      this._build(canvas.width, canvas.height);
    }

    resize(w, h) { this._build(w, h); }

    _build(w, h) {
      this._cW = w;
      this._cH = h;
      this._u  = Math.max(0.6, Math.min(2.4, Math.min(w, h) / 900));
      this._hor  = h * 0.72;
      this._sunX = w * 0.56;
      this._sunY = h * 0.655;
      this._buildBackdrop();
      this._buildClouds();
      this._buildGlints();
    }

    _buildBackdrop() {
      const w = this._cW, h = this._cH, hz = this._hor;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const c = bg.getContext('2d');

      const sky = c.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0,    '#332948');
      sky.addColorStop(0.42, '#6b4050');
      sky.addColorStop(0.75, '#b85c40');
      sky.addColorStop(1,    '#e88d48');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, hz + 1);

      // Sea: the sky poured back down, darkening toward the viewer.
      const sea = c.createLinearGradient(0, hz, 0, h);
      sea.addColorStop(0,    '#c07344');
      sea.addColorStop(0.18, '#75403c');
      sea.addColorStop(0.55, '#3a2233');
      sea.addColorStop(1,    '#180f20');
      c.fillStyle = sea;
      c.fillRect(0, hz, w, h - hz);

      // Sun bloom, then disc, flattened slightly the way a low sun is.
      const passes = [
        [h * 0.55, 'rgba(255,158,84,0.18)'],
        [h * 0.20, 'rgba(255,178,100,0.34)'],
        [h * 0.06, 'rgba(255,208,140,0.60)'],
      ];
      for (const [r, col] of passes) {
        const g = c.createRadialGradient(this._sunX, this._sunY, 0, this._sunX, this._sunY, r);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(255,158,84,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(this._sunX, this._sunY, r, 0, TAU); c.fill();
      }
      c.save();
      c.translate(this._sunX, this._sunY);
      c.scale(1, 0.92);
      c.fillStyle = 'rgba(255,232,190,0.95)';
      c.beginPath(); c.arc(0, 0, h * 0.030, 0, TAU); c.fill();
      c.restore();

      // Broad reflected wash under the sun.
      const rw = c.createLinearGradient(0, hz, 0, h);
      rw.addColorStop(0, 'rgba(255,178,100,0.28)');
      rw.addColorStop(0.5, 'rgba(255,158,84,0.10)');
      rw.addColorStop(1, 'rgba(255,158,84,0)');
      c.save();
      c.beginPath();
      c.moveTo(this._sunX - w * 0.06, hz);
      c.lineTo(this._sunX + w * 0.06, hz);
      c.lineTo(this._sunX + w * 0.24, h);
      c.lineTo(this._sunX - w * 0.24, h);
      c.closePath();
      c.clip();
      c.fillStyle = rw;
      c.fillRect(0, hz, w, h - hz);
      c.restore();

      const vg = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.42, w / 2, h * 0.5, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(10,6,14,0)');
      vg.addColorStop(1, 'rgba(10,6,14,0.4)');
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);

      this._bg = bg;
    }

    _makeCloudSprite(pw, ph, body, lit) {
      const s = document.createElement('canvas');
      s.width = pw; s.height = ph;
      const c = s.getContext('2d');
      const n = 7 + Math.floor(rand(0, 5));
      for (let i = 0; i < n; i++) {
        const x = pw * (0.15 + 0.7 * (i / n)) + gauss() * pw * 0.06;
        const y = ph * 0.55 + gauss() * ph * 0.13;
        const r = ph * rand(0.22, 0.42);
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0,   `rgba(${body},0.55)`);
        g.addColorStop(0.7, `rgba(${body},0.30)`);
        g.addColorStop(1,   `rgba(${body},0)`);
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }
      // The sun is below these clouds, so the warm light comes up at them.
      c.globalCompositeOperation = 'source-atop';
      const gl = c.createLinearGradient(0, ph, 0, 0);
      gl.addColorStop(0,   `rgba(${lit},0.55)`);
      gl.addColorStop(0.5, `rgba(${lit},0.14)`);
      gl.addColorStop(1,   'rgba(0,0,0,0)');
      c.fillStyle = gl;
      c.fillRect(0, 0, pw, ph);
      c.globalCompositeOperation = 'source-over';
      return s;
    }

    _buildClouds() {
      const w = this._cW, h = this._cH;
      // Far high cloud is dim violet; the nearer, lower banks catch more fire.
      const layers = [
        { n: 5, y: [0.08, 0.30], sc: [0.10, 0.16], v: 2.0, a: 0.55, body: '86,62,88',  lit: '255,150,110' },
        { n: 4, y: [0.30, 0.48], sc: [0.15, 0.24], v: 3.6, a: 0.75, body: '74,50,72',  lit: '255,160,100' },
        { n: 3, y: [0.46, 0.60], sc: [0.22, 0.34], v: 5.6, a: 0.9,  body: '56,38,58',  lit: '255,170,96'  },
      ];
      this._clouds = [];
      for (const L of layers) {
        for (let i = 0; i < L.n; i++) {
          const sc = rand(L.sc[0], L.sc[1]);
          const pw = Math.max(8, Math.round(w * sc * 2.2));
          const ph = Math.max(6, Math.round(h * sc * 0.62));
          this._clouds.push({
            sprite: this._makeCloudSprite(pw, ph, L.body, L.lit),
            x: rand(-0.1, 1.1) * w,
            y: h * rand(L.y[0], L.y[1]),
            wdt: pw, hgt: ph,
            v: L.v * this._u * rand(0.8, 1.25),
            a: L.a * rand(0.8, 1),
          });
        }
      }
    }

    _buildGlints() {
      const w = this._cW, h = this._cH, hz = this._hor, u = this._u;
      this._glints = [];
      const rows = 30;
      for (let r = 0; r < rows; r++) {
        const f = r / (rows - 1);                    // 0 horizon → 1 near
        const y = hz + Math.pow(f, 1.5) * (h - hz) * 0.94 + 2 * u;
        const spread = w * (0.030 + f * 0.17);
        const count = Math.round(9 - f * 6);
        for (let i = 0; i < count; i++) {
          this._glints.push({
            x: this._sunX + gauss() * spread * 0.55,
            y: y + gauss() * (h - hz) * 0.012,
            len: (3 + f * 26 + Math.random() * f * 18) * u,
            th: Math.max(1, (0.8 + f * 1.6) * u),
            base: 0.10 + (1 - f) * 0.22,
            ph: rand(0, TAU),
            sp: rand(0.8, 2.6),
          });
        }
      }
    }

    draw(ts) {
      if (ts === 0) { this._frame(); return; }
      const dt = (this._lastTs != null) ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      this._t += dt * this.speed;
      this._frame();
    }

    _frame() {
      const ctx = this.ctx, t = this._t;
      const w = this._cW, h = this._cH;

      ctx.drawImage(this._bg, 0, 0);

      // Slow breath on the sun's glow.
      const pulse = 0.05 + 0.04 * Math.sin(t * 0.26);
      const pg = ctx.createRadialGradient(this._sunX, this._sunY, 0, this._sunX, this._sunY, h * 0.3);
      pg.addColorStop(0, `rgba(255,178,100,${pulse})`);
      pg.addColorStop(1, 'rgba(255,178,100,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(this._sunX, this._sunY, h * 0.3, 0, TAU); ctx.fill();

      for (const cl of this._clouds) {
        const span = w + cl.wdt * 2;
        const x = (((cl.x + t * cl.v) % span) + span) % span - cl.wdt;
        ctx.globalAlpha = cl.a;
        ctx.drawImage(cl.sprite, x, cl.y - cl.hgt / 2);
      }
      ctx.globalAlpha = 1;

      // The glitter path: each glint is a wave facet catching the sun for a
      // moment — most of them dark, a fraction flashing at any instant.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const g of this._glints) {
        const tw = 0.5 + 0.5 * Math.sin(t * g.sp + g.ph);
        const a = g.base * Math.pow(tw, 3) * Math.min(1.3, this.intensity);
        if (a < 0.01) continue;
        ctx.fillStyle = `rgba(255,196,130,${a})`;
        ctx.fillRect(g.x - g.len / 2, g.y, g.len, g.th);
      }
      ctx.restore();
    }

    destroy() {
      this._bg = this._clouds = this._glints = null;
    }
  }

  // ── Standalone API (used by preview HTML) ─────────────────────────────────
  let _inst = null, _raf = null, _boundResize = null, _boundVis = null;

  function _debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  function init(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    function resize() {
      canvas.width  = Math.floor(window.innerWidth  * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      if (_inst) _inst.resize(canvas.width, canvas.height);
    }
    resize();
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;';

    const ctx = canvas.getContext('2d');
    _inst = new GoldenHourTheme();
    _inst.init(canvas, ctx, { speed: 1 });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function loop(ts) {
      _raf = requestAnimationFrame(loop);
      _inst.draw(ts);
    }

    _boundResize = _debounce(resize, 150);
    _boundVis = () => {
      if (document.hidden) { cancelAnimationFrame(_raf); _raf = null; }
      else if (!_raf)      { _raf = requestAnimationFrame(loop); }
    };

    window.addEventListener('resize', _boundResize);
    document.addEventListener('visibilitychange', _boundVis);

    if (reduced) { _inst.draw(0); }
    else         { _raf = requestAnimationFrame(loop); }
  }

  function destroy() {
    if (_raf)         { cancelAnimationFrame(_raf); _raf = null; }
    if (_inst)        { _inst.destroy(); _inst = null; }
    if (_boundResize) { window.removeEventListener('resize', _boundResize); _boundResize = null; }
    if (_boundVis)    { document.removeEventListener('visibilitychange', _boundVis); _boundVis = null; }
  }

  window.GoldenHourTheme = GoldenHourTheme;
  window.GoldenHour = { init, destroy };
})();
