'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Floating Lanterns — a sky-lantern night over still water.
  // Two populations: a distant swarm of glowing points drifting up from the
  // horizon, and a handful of near lanterns with drawn paper bodies that
  // sway and flicker. The lake below carries squashed reflections and a
  // band of animated shimmer.
  class FloatingLanternsTheme {
    init(canvas, ctx, opts) {
      this.canvas    = canvas;
      this.ctx       = ctx || canvas.getContext('2d');
      this.speed     = (opts && opts.speed) || 1;
      this.intensity = (opts && opts.intensity) || 1;
      this._t        = rand(0, 100);
      this._lastTs   = null;
      this._build(canvas.width, canvas.height);
    }

    resize(w, h) { this._build(w, h); }

    _build(w, h) {
      this._cW = w;
      this._cH = h;
      this._u  = Math.max(0.6, Math.min(2.4, Math.min(w, h) / 900));
      this._horizon = h * 0.68;
      this._buildSky();
      this._buildGlowSprite();
      this._buildLanterns();
      this._buildShimmer();
    }

    _buildSky() {
      const w = this._cW, h = this._cH, hz = this._horizon, u = this._u;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const c = bg.getContext('2d');

      const sky = c.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0,    '#070b1c');
      sky.addColorStop(0.55, '#111731');
      sky.addColorStop(0.85, '#232036');
      sky.addColorStop(1,    '#3a2a33');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, hz + 1);

      // Static star field (twinklers are drawn live on top).
      for (let i = 0; i < 150; i++) {
        const x = Math.random() * w;
        const y = Math.pow(Math.random(), 1.4) * hz * 0.75;
        const r = Math.random() * 1.1 * u + 0.3;
        c.fillStyle = `rgba(230,238,255,${rand(0.15, 0.7)})`;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }

      // Warm haze where the distant crowd of lanterns gathers.
      const glow = c.createRadialGradient(w * 0.5, hz, 0, w * 0.5, hz, h * 0.42);
      glow.addColorStop(0, 'rgba(255,150,70,0.17)');
      glow.addColorStop(1, 'rgba(255,150,70,0)');
      c.fillStyle = glow;
      c.fillRect(0, 0, w, hz + 1);

      // Mountain silhouettes.
      const ridge = (base, amp, k1, k2, s1, s2, col) => {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(0, hz + 2);
        for (let x = 0; x <= w; x += 8) {
          const y = base
            - amp * (0.55 + 0.45 * Math.sin(x * k1 + s1))
            - amp * 0.5 * (0.5 + 0.5 * Math.sin(x * k2 + s2));
          c.lineTo(x, y);
        }
        c.lineTo(w, hz + 2);
        c.closePath();
        c.fill();
      };
      ridge(hz * 0.92, h * 0.075, 0.0021 / u * 1.4, 0.0093 / u * 1.4, rand(0, 9), rand(0, 9), '#101729');
      ridge(hz * 0.99, h * 0.05,  0.0028 / u * 1.4, 0.011  / u * 1.4, rand(0, 9), rand(0, 9), '#0a0f1d');

      // The lake.
      const water = c.createLinearGradient(0, hz, 0, h);
      water.addColorStop(0,    '#191423');
      water.addColorStop(0.25, '#100f1f');
      water.addColorStop(1,    '#04060e');
      c.fillStyle = water;
      c.fillRect(0, hz, w, h - hz);

      // Warm smear just under the waterline.
      const smear = c.createLinearGradient(0, hz, 0, hz + h * 0.14);
      smear.addColorStop(0, 'rgba(255,145,65,0.14)');
      smear.addColorStop(1, 'rgba(255,145,65,0)');
      c.fillStyle = smear;
      c.fillRect(0, hz, w, h * 0.14);

      // Vignette.
      const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(2,4,10,0)');
      vg.addColorStop(1, 'rgba(2,4,10,0.45)');
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);

      this._sky = bg;

      this._twinkles = [];
      for (let i = 0; i < 26; i++) {
        this._twinkles.push({
          x: Math.random() * w,
          y: Math.pow(Math.random(), 1.4) * hz * 0.7,
          r: rand(0.5, 1.4) * u,
          ph: rand(0, TAU),
          sp: rand(1.2, 2.6),
        });
      }
    }

    _buildGlowSprite() {
      const s = document.createElement('canvas');
      s.width = s.height = 256;
      const c = s.getContext('2d');
      const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0,    'rgba(255,214,150,0.85)');
      g.addColorStop(0.25, 'rgba(255,175,95,0.38)');
      g.addColorStop(0.6,  'rgba(255,150,70,0.12)');
      g.addColorStop(1,    'rgba(255,150,70,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
      this._glow = s;
    }

    _makeLantern(near, seed) {
      const w = this._cW, h = this._cH, hz = this._horizon, u = this._u;
      const z = near ? rand(0.55, 1) : rand(0.05, 0.55);
      const l = {
        z,
        near,
        s:  near ? (12 + (z - 0.55) / 0.45 * 26) * u : (1.6 + z * 8) * u,
        vy: near ? (11 + z * 20) * u : (3.2 + z * 10) * u,
        x:  Math.random() * w,
        y:  0,
        ph:  rand(0, TAU),
        ph2: rand(0, TAU),
        ph3: rand(0, TAU),
        om:  rand(0.25, 0.7),
        hue: rand(0, 1),  // 0 = deep amber, 1 = pale gold
      };
      if (seed) {
        l.y = near ? rand(h * 0.15, h * 1.1) : rand(h * 0.06, hz);
      } else {
        l.y = near ? h + l.s * 3 : hz - rand(0, h * 0.03);
      }
      return l;
    }

    _buildLanterns() {
      this._far = [];
      this._near = [];
      const nFar  = Math.round(58 * this.intensity);
      const nNear = Math.round(13 * this.intensity);
      for (let i = 0; i < nFar; i++)  this._far.push(this._makeLantern(false, true));
      for (let i = 0; i < nNear; i++) this._near.push(this._makeLantern(true, true));
      this._near.sort((a, b) => a.s - b.s);
    }

    _buildShimmer() {
      const w = this._cW, h = this._cH, hz = this._horizon, u = this._u;
      this._shimmer = [];
      for (let i = 0; i < 36; i++) {
        this._shimmer.push({
          x: Math.random() * w,
          y: hz + Math.pow(Math.random(), 1.6) * h * 0.17 + 3 * u,
          len: rand(9, 30) * u,
          ph: rand(0, TAU),
          sp: rand(0.8, 1.8),
        });
      }
    }

    // ── Simulation ─────────────────────────────────────────────────────────

    _stepLantern(l, dt) {
      const w = this._cW, h = this._cH, u = this._u, t = this._t;
      l.y -= l.vy * dt;
      l.x += (Math.sin(t * l.om + l.ph) * 7 * u * l.z + 3 * u * l.z) * dt;
      const mg = l.s * 6;
      if (l.x > w + mg) l.x = -mg;
      if (l.x < -mg)    l.x = w + mg;
      if (l.y < -l.s * 4) {
        Object.assign(l, this._makeLantern(l.near, false));
      }
    }

    _step(dt) {
      for (const l of this._far)  this._stepLantern(l, dt);
      for (const l of this._near) this._stepLantern(l, dt);
    }

    // ── Drawing ────────────────────────────────────────────────────────────

    _flicker(l, t) {
      const f = 0.72 + 0.28 * (0.6 * Math.sin(t * 2.3 + l.ph2) + 0.4 * Math.sin(t * 5.1 + l.ph3));
      return Math.max(0.45, Math.min(1, f));
    }

    _fade(l) {
      // Ease out near the top of the frame so lanterns dissolve into the night.
      const top = this._cH * 0.2;
      const a = l.y < top ? Math.max(0, l.y / top) : 1;
      return a * a;
    }

    _drawBody(ctx, l, b) {
      // Paper body: warm gradient, ribs, dark mouth up top, fire below.
      const hgt = l.s * 1.3, wid = hgt * 0.74;
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(Math.sin(this._t * 0.5 + l.ph) * 0.05);

      const g = ctx.createLinearGradient(0, -hgt / 2, 0, hgt / 2);
      const warm = l.hue;
      g.addColorStop(0, `rgba(${168 + warm * 30 | 0},${82 + warm * 26 | 0},${34 + warm * 18 | 0},1)`);
      g.addColorStop(0.55, `rgba(${232 + warm * 16 | 0},${132 + warm * 30 | 0},${56 + warm * 30 | 0},1)`);
      g.addColorStop(1, `rgba(255,${196 + warm * 24 | 0},${120 + warm * 40 | 0},1)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-wid * 0.31, -hgt / 2);
      ctx.lineTo(wid * 0.31, -hgt / 2);
      ctx.quadraticCurveTo(wid * 0.54, -hgt * 0.08, wid * 0.5, hgt / 2);
      ctx.lineTo(-wid * 0.5, hgt / 2);
      ctx.quadraticCurveTo(-wid * 0.54, -hgt * 0.08, -wid * 0.31, -hgt / 2);
      ctx.closePath();
      ctx.fill();

      // Inner firelight through the paper.
      const fg = ctx.createRadialGradient(0, hgt * 0.24, 0, 0, hgt * 0.24, wid * 0.6);
      fg.addColorStop(0, `rgba(255,242,200,${0.75 * b})`);
      fg.addColorStop(1, 'rgba(255,242,200,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-wid * 0.31, -hgt / 2);
      ctx.lineTo(wid * 0.31, -hgt / 2);
      ctx.quadraticCurveTo(wid * 0.54, -hgt * 0.08, wid * 0.5, hgt / 2);
      ctx.lineTo(-wid * 0.5, hgt / 2);
      ctx.quadraticCurveTo(-wid * 0.54, -hgt * 0.08, -wid * 0.31, -hgt / 2);
      ctx.closePath();
      ctx.fill();

      // Bamboo ribs.
      ctx.strokeStyle = 'rgba(90,38,14,0.18)';
      ctx.lineWidth = Math.max(1, l.s * 0.045);
      for (const rx of [-0.26, 0, 0.26]) {
        ctx.beginPath();
        ctx.moveTo(wid * rx * 1.15, -hgt / 2 + 1);
        ctx.quadraticCurveTo(wid * rx * 1.5, 0, wid * rx * 1.45, hgt / 2 - 1);
        ctx.stroke();
      }

      // Dark opening at the crown.
      ctx.fillStyle = 'rgba(52,22,10,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, -hgt / 2, wid * 0.30, wid * 0.075, 0, 0, TAU);
      ctx.fill();

      // Bright mouth at the base, where the flame rides.
      ctx.fillStyle = `rgba(255,238,190,${0.9 * b})`;
      ctx.beginPath();
      ctx.ellipse(0, hgt / 2, wid * 0.4, wid * 0.09, 0, 0, TAU);
      ctx.fill();

      ctx.restore();
    }

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
      const glow = this._glow;

      ctx.drawImage(this._sky, 0, 0);

      // Twinkling stars.
      for (const s of this._twinkles) {
        const a = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
        ctx.fillStyle = `rgba(230,240,255,${a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }

      // Water shimmer band.
      for (const sh of this._shimmer) {
        const a = 0.035 + 0.055 * (0.5 + 0.5 * Math.sin(t * sh.sp + sh.ph));
        ctx.fillStyle = `rgba(255,172,92,${a})`;
        const x = sh.x + Math.sin(t * 0.3 + sh.ph) * 5 * u;
        ctx.fillRect(x - sh.len / 2, sh.y, sh.len, 1.4 * u);
      }

      // Reflections of airborne lanterns, squashed into the lake.
      const reflect = (l) => {
        if (l.y >= hz || hz - l.y > h * 0.45) return;
        const b = this._flicker(l, t) * this._fade(l);
        const ry = hz + (hz - l.y) * 0.55;
        if (ry > h + 40 * u) return;
        const gs = l.s * (l.near ? 3.2 : 4.5);
        const wob = Math.sin(t * 1.1 + l.ph) * 2.5 * u;
        ctx.globalAlpha = 0.22 * b;
        ctx.drawImage(glow, l.x - gs + wob, ry - gs * 0.42, gs * 2, gs * 0.84);
        ctx.globalAlpha = 0.16 * b;
        ctx.fillStyle = '#ffbe78';
        for (let k = 0; k < 2; k++) {
          const dy = (4 + k * 7) * u * (l.near ? l.s / (14 * u) : 1);
          const dx = Math.sin(t * 1.3 + l.ph + k * 2.1) * 4 * u;
          ctx.fillRect(l.x - l.s * 0.9 + dx + wob, ry + dy, l.s * 1.8, 1.3 * u);
        }
        ctx.globalAlpha = 1;
      };
      for (const l of this._far)  reflect(l);
      for (const l of this._near) reflect(l);

      // Distant swarm: glow plus a hot little paper speck.
      for (const l of this._far) {
        const b = this._flicker(l, t);
        const a = this._fade(l);
        if (a <= 0.01) continue;
        const gs = l.s * 4.5;
        ctx.globalAlpha = 0.4 * b * a;
        ctx.drawImage(glow, l.x - gs, l.y - gs, gs * 2, gs * 2);
        ctx.globalAlpha = a;
        ctx.fillStyle = `rgba(255,${205 + (b * 40 | 0)},${140 + (b * 40 | 0)},${0.95 * b})`;
        ctx.beginPath();
        ctx.ellipse(l.x, l.y, l.s * 0.44, l.s * 0.62, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Near lanterns, small to large so the big ones read closest.
      // (Respawns reroll size, so keep the depth order fresh.)
      this._near.sort((a, b) => a.s - b.s);
      for (const l of this._near) {
        const b = this._flicker(l, t);
        const a = this._fade(l);
        if (a <= 0.01) continue;
        const gs = l.s * 3.4;
        ctx.globalAlpha = 0.42 * b * a;
        ctx.drawImage(glow, l.x - gs, l.y - gs, gs * 2, gs * 2);
        ctx.globalAlpha = a;
        this._drawBody(ctx, l, b);
      }
      ctx.globalAlpha = 1;
    }

    destroy() {
      this._sky = this._glow = null;
      this._far = this._near = this._shimmer = this._twinkles = null;
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
    _inst = new FloatingLanternsTheme();
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

  window.FloatingLanternsTheme = FloatingLanternsTheme;
  window.FloatingLanterns = { init, destroy };
})();
