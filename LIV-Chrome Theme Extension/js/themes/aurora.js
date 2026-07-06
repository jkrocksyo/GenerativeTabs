'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Northern Lights — aurora curtains over a mirror-still lake.
  // Each curtain is a run of thin vertical strips stamped from a pre-built
  // gradient sprite (green base, violet fringe). The strips ride slow sine
  // fields for the curtain's sway, and a faster travelling wave modulates
  // their alpha into the classic searchlight rays. The whole aurora is
  // rendered small and upscaled, which both softens and cheapens it, then
  // flipped into the lake.
  class NorthernLightsTheme {
    init(canvas, ctx, opts) {
      this.canvas    = canvas;
      this.ctx       = ctx || canvas.getContext('2d');
      this.speed     = (opts && opts.speed) || 1;
      this.intensity = (opts && opts.intensity) || 1;
      this._t        = rand(0, 200);
      this._lastTs   = null;
      this._meteor   = null;
      this._meteorIn = rand(8, 20);
      this._build(canvas.width, canvas.height);
    }

    resize(w, h) { this._build(w, h); }

    _build(w, h) {
      this._cW = w;
      this._cH = h;
      this._u  = Math.max(0.6, Math.min(2.4, Math.min(w, h) / 900));
      this._horizon = h * 0.72;
      this._buildStrips();
      this._buildSky();
      this._buildAuroraBuffer();
      this._buildShimmer();
    }

    _buildStrips() {
      // Vertical color profile of a curtain, bottom (bright) to top (fringe).
      const make = (bottom, mid, top) => {
        const s = document.createElement('canvas');
        s.width = 4; s.height = 256;
        const c = s.getContext('2d');
        const g = c.createLinearGradient(0, 256, 0, 0);
        g.addColorStop(0,    `rgba(${bottom},0.9)`);
        g.addColorStop(0.18, `rgba(${bottom},0.55)`);
        g.addColorStop(0.5,  `rgba(${mid},0.3)`);
        g.addColorStop(0.82, `rgba(${top},0.14)`);
        g.addColorStop(1,    `rgba(${top},0)`);
        c.fillStyle = g;
        c.fillRect(0, 0, 4, 256);
        return s;
      };
      this._strips = [
        make('130,255,170', '80,220,170',  '150,110,255'),
        make('90,240,190',  '70,200,190',  '110,140,255'),
        make('160,255,150', '110,220,140', '235,120,200'),
      ];
    }

    _buildSky() {
      const w = this._cW, h = this._cH, hz = this._horizon, u = this._u;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const c = bg.getContext('2d');

      const sky = c.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0,    '#03060f');
      sky.addColorStop(0.55, '#081120');
      sky.addColorStop(1,    '#0e1c2c');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, hz + 1);

      for (let i = 0; i < 170; i++) {
        const x = Math.random() * w;
        const y = Math.pow(Math.random(), 1.2) * hz * 0.92;
        c.fillStyle = `rgba(224,236,255,${rand(0.15, 0.8)})`;
        c.beginPath(); c.arc(x, y, rand(0.3, 1.2) * u, 0, TAU); c.fill();
      }

      // Snowy ridge line.
      const ridge = [];
      for (let x = 0; x <= w; x += 8) {
        ridge.push(
          hz - h * 0.055 * (0.5 + 0.5 * Math.sin(x * 0.0026 / u * 1.4 + 1.7))
             - h * 0.035 * (0.5 + 0.5 * Math.sin(x * 0.011 / u * 1.4 + 4.2))
        );
      }
      c.fillStyle = '#0a1220';
      c.beginPath();
      c.moveTo(0, hz + 2);
      ridge.forEach((y, i) => c.lineTo(i * 8, y));
      c.lineTo(w, hz + 2);
      c.closePath();
      c.fill();
      // Faint snow caps catching the sky.
      c.strokeStyle = 'rgba(150,200,220,0.14)';
      c.lineWidth = 1.5 * u;
      c.beginPath();
      ridge.forEach((y, i) => i ? c.lineTo(i * 8, y) : c.moveTo(0, y));
      c.stroke();

      // The lake.
      const water = c.createLinearGradient(0, hz, 0, h);
      water.addColorStop(0,    '#0a1524');
      water.addColorStop(0.3,  '#071020');
      water.addColorStop(1,    '#02050c');
      c.fillStyle = water;
      c.fillRect(0, hz, w, h - hz);

      // Dark reflection of the ridge.
      c.save();
      c.globalAlpha = 0.35;
      c.translate(0, hz * 2);
      c.scale(1, -0.6);
      c.fillStyle = '#060c16';
      c.beginPath();
      c.moveTo(0, hz + 2);
      ridge.forEach((y, i) => c.lineTo(i * 8, y));
      c.lineTo(w, hz + 2);
      c.closePath();
      c.fill();
      c.restore();

      const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(1,3,8,0)');
      vg.addColorStop(1, 'rgba(1,3,8,0.45)');
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);

      this._sky = bg;

      this._twinkles = [];
      for (let i = 0; i < 26; i++) {
        this._twinkles.push({
          x: Math.random() * w,
          y: Math.pow(Math.random(), 1.2) * hz * 0.85,
          r: rand(0.5, 1.4) * u,
          ph: rand(0, TAU),
          sp: rand(1.2, 2.6),
        });
      }

      this._ribbons = [
        { off: 0.26, amp: 0.10, k1: 2.4, k2: 5.9,  s1: 0.10, s2: 0.05, hK: 7.1, hS: 0.07, rayK: 42, rayS: 0.55, ph: rand(0, TAU), a: 0.75, spr: 0 },
        { off: 0.44, amp: 0.08, k1: 3.1, k2: 7.3,  s1: 0.07, s2: 0.04, hK: 5.3, hS: 0.05, rayK: 55, rayS: 0.42, ph: rand(0, TAU), a: 0.55, spr: 1 },
        { off: 0.13, amp: 0.06, k1: 1.8, k2: 4.7,  s1: 0.05, s2: 0.03, hK: 6.2, hS: 0.04, rayK: 34, rayS: 0.30, ph: rand(0, TAU), a: 0.4,  spr: 2 },
      ];
    }

    _buildAuroraBuffer() {
      const aw = Math.max(2, Math.ceil(this._cW / 4));
      const ah = Math.max(2, Math.ceil(this._horizon / 4));
      const a = document.createElement('canvas');
      a.width = aw; a.height = ah;
      this._aur = a;
      this._aurCtx = a.getContext('2d');
    }

    _buildShimmer() {
      const w = this._cW, h = this._cH, hz = this._horizon, u = this._u;
      this._shimmer = [];
      for (let i = 0; i < 30; i++) {
        this._shimmer.push({
          x: Math.random() * w,
          y: hz + Math.pow(Math.random(), 1.5) * (h - hz) * 0.8 + 4 * u,
          len: rand(10, 34) * u,
          ph: rand(0, TAU),
          sp: rand(0.6, 1.5),
          g: Math.random() < 0.7,
        });
      }
    }

    _renderAurora(t) {
      const c = this._aurCtx;
      const aw = this._aur.width, ah = this._aur.height;
      c.clearRect(0, 0, aw, ah);
      c.globalCompositeOperation = 'lighter';

      const step = 4;
      const glow = 0.85 + 0.15 * Math.sin(t * 0.13);
      for (const r of this._ribbons) {
        const spr = this._strips[r.spr];
        for (let x = 0; x < aw; x += step) {
          const nx = x / aw;
          const base = ah * (r.off + 0.16)
            + Math.sin(nx * r.k1 + t * r.s1 + r.ph) * ah * r.amp
            + Math.sin(nx * r.k2 - t * r.s2 + r.ph * 2) * ah * r.amp * 0.55;
          const hgt = ah * (0.30 + 0.13 * Math.sin(nx * r.hK + t * r.hS + r.ph));
          // Travelling rays: two interfering waves squared for contrast.
          const ray = 0.5 + 0.5 * Math.sin(nx * r.rayK - t * r.rayS + r.ph)
                    * Math.sin(nx * r.rayK * 0.37 + t * r.rayS * 0.7);
          c.globalAlpha = r.a * glow * (0.25 + 0.75 * ray * ray) * Math.min(1, this.intensity);
          c.drawImage(spr, x, base - hgt, step, hgt);
        }
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }

    // ── Simulation ─────────────────────────────────────────────────────────

    _step(dt) {
      this._meteorIn -= dt;
      if (this._meteorIn <= 0 && !this._meteor) {
        const w = this._cW, u = this._u;
        const ang = rand(0.5, 0.9);
        this._meteor = {
          x: rand(w * 0.15, w * 0.85),
          y: rand(this._cH * 0.05, this._cH * 0.25),
          vx: Math.cos(ang) * 900 * u * (Math.random() < 0.5 ? 1 : -1),
          vy: Math.sin(ang) * 700 * u,
          life: 0,
          dur: rand(0.5, 0.8),
        };
        this._meteorIn = rand(14, 34) / Math.max(0.5, this.intensity);
      }
      if (this._meteor) {
        const m = this._meteor;
        m.life += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.life > m.dur) this._meteor = null;
      }
    }

    // ── Frame ──────────────────────────────────────────────────────────────

    draw(ts) {
      if (ts === 0) { this._frame(); return; }
      const dt = (this._lastTs != null) ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      const sdt = dt * this.speed;
      this._t += sdt;
      if (sdt > 0) this._step(sdt);
      this._frame();
    }

    _frame() {
      const ctx = this.ctx, t = this._t, u = this._u;
      const w = this._cW, h = this._cH, hz = this._horizon;

      this._renderAurora(t);

      ctx.drawImage(this._sky, 0, 0);

      for (const s of this._twinkles) {
        const a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
        ctx.fillStyle = `rgba(224,236,255,${a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }

      if (this._meteor) {
        const m = this._meteor;
        const f = Math.sin(Math.PI * Math.min(1, m.life / m.dur));
        const tx = m.x - m.vx * 0.12, ty = m.y - m.vy * 0.12;
        const mg = ctx.createLinearGradient(tx, ty, m.x, m.y);
        mg.addColorStop(0, 'rgba(200,220,255,0)');
        mg.addColorStop(1, `rgba(230,240,255,${0.8 * f})`);
        ctx.strokeStyle = mg;
        ctx.lineWidth = 1.6 * u;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();
      }

      // The curtains.
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this._aur, 0, 0, w, hz);

      // Their reflection, squashed and dimmed into the lake.
      ctx.globalAlpha = 0.30;
      ctx.save();
      ctx.translate(Math.sin(t * 0.4) * 3 * u, 0);
      ctx.scale(1, -1);
      ctx.drawImage(this._aur, 0, -(hz + (h - hz) * 0.96), w, (h - hz) * 0.96 * 2);
      ctx.restore();
      ctx.restore();
      ctx.globalAlpha = 1;

      // Cold glints riding the water.
      for (const s of this._shimmer) {
        const a = 0.03 + 0.05 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
        ctx.fillStyle = s.g ? `rgba(140,255,190,${a})` : `rgba(190,210,255,${a})`;
        const x = s.x + Math.sin(t * 0.25 + s.ph) * 6 * u;
        ctx.fillRect(x - s.len / 2, s.y, s.len, 1.3 * u);
      }
    }

    destroy() {
      this._sky = this._aur = this._aurCtx = this._strips = null;
      this._twinkles = this._shimmer = this._ribbons = this._meteor = null;
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
    _inst = new NorthernLightsTheme();
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

  window.NorthernLightsTheme = NorthernLightsTheme;
  window.NorthernLights = { init, destroy };
})();
