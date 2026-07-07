'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Still Water — a pond at night so calm it mirrors the stars. Every few
  // seconds something unseen touches the surface and a set of rings opens
  // out: each ring is an ellipse flattened by perspective, a bright crest
  // backed by a dark trough, fading as it grows the way real capillary
  // waves die. Star reflections shiver when a ring passes through them —
  // the physics is the picture; nothing else moves but slow mist.
  class StillWaterTheme {
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
      this._hor = h * 0.30;
      this._buildBackdrop();
      this._buildMist();
      this._drops = [];
      this._dropIn = rand(0.5, 2);
      // Pre-seed so a static first frame already has rings on the water.
      for (let i = 0; i < 2; i++) {
        this._spawnDrop();
        this._drops[i].age = rand(1, 3);
      }
    }

    // Perspective flattening: rings far away are almost lines, near rings
    // open up. 0 at the horizon → 1 at the bottom edge.
    _persp(y) {
      const f = (y - this._hor) / (this._cH - this._hor);
      return 0.20 + 0.30 * f;
    }

    _buildBackdrop() {
      const w = this._cW, h = this._cH, hz = this._hor, u = this._u;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const c = bg.getContext('2d');

      const sky = c.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0,   '#05070f');
      sky.addColorStop(0.7, '#0a1122');
      sky.addColorStop(1,   '#141d33');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, hz + 1);

      // A soft glow low in the sky — light from somewhere beyond the trees.
      const glow = c.createRadialGradient(w * 0.68, hz, 0, w * 0.68, hz, h * 0.3);
      glow.addColorStop(0, 'rgba(120,150,200,0.10)');
      glow.addColorStop(1, 'rgba(120,150,200,0)');
      c.fillStyle = glow;
      c.beginPath(); c.arc(w * 0.68, hz, h * 0.3, 0, TAU); c.fill();

      // Stars, kept small and quiet.
      this._stars = [];
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * w;
        const y = Math.pow(Math.random(), 1.15) * hz * 0.95;
        const r = rand(0.3, 1.1) * u;
        const a = rand(0.2, 0.85);
        c.fillStyle = `rgba(215,228,255,${a})`;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        if (a > 0.45 && Math.random() < 0.5) this._stars.push({ x, y, a });
      }

      // Far shore: a blurred treeline mass, rendered tiny and upscaled so it
      // stays a shape, not a drawing.
      const sw = Math.max(2, Math.ceil(w / 8));
      const sh = Math.max(2, Math.ceil(h * 0.06 / 2));
      const shore = document.createElement('canvas');
      shore.width = sw; shore.height = sh;
      const sc = shore.getContext('2d');
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * sw;
        const r = sh * rand(0.35, 0.8);
        const g = sc.createRadialGradient(x, sh, 0, x, sh, r * 2);
        g.addColorStop(0, 'rgba(6,10,18,0.95)');
        g.addColorStop(1, 'rgba(6,10,18,0)');
        sc.fillStyle = g;
        sc.beginPath(); sc.arc(x, sh, r * 2, 0, TAU); sc.fill();
      }
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(shore, 0, hz - h * 0.05, w, h * 0.06);

      // The water: the sky again, poured down and darkened.
      const sea = c.createLinearGradient(0, hz, 0, h);
      sea.addColorStop(0,    '#10182c');
      sea.addColorStop(0.25, '#0a1020');
      sea.addColorStop(1,    '#030510');
      c.fillStyle = sea;
      c.fillRect(0, hz, w, h - hz);

      // Reflected shore and glow.
      c.globalAlpha = 0.5;
      c.save();
      c.translate(0, hz * 2);
      c.scale(1, -1);
      c.drawImage(shore, 0, hz - h * 0.075, w, h * 0.075);
      c.restore();
      c.globalAlpha = 1;
      const rglow = c.createRadialGradient(w * 0.68, hz, 0, w * 0.68, hz, h * 0.34);
      rglow.addColorStop(0, 'rgba(120,150,200,0.07)');
      rglow.addColorStop(1, 'rgba(120,150,200,0)');
      c.fillStyle = rglow;
      c.beginPath(); c.arc(w * 0.68, hz, h * 0.34, 0, TAU); c.fill();

      const vg = c.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.4, w / 2, h * 0.5, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(1,2,6,0)');
      vg.addColorStop(1, 'rgba(1,2,6,0.5)');
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);

      this._bg = bg;

      // Each kept star owns a reflection: a dim vertical smear on the water.
      this._reflections = this._stars.map(s => ({
        x: s.x,
        y: hz + (hz - s.y) * 1.3,
        a: s.a * 0.30,
        len: rand(3, 7) * u * (1 + (hz - s.y) / hz),
        ph: rand(0, TAU),
        sp: rand(0.4, 1.1),
      })).filter(r => r.y < h * 0.98);
    }

    _buildMist() {
      const w = this._cW, h = this._cH;
      this._mist = [];
      for (let i = 0; i < 5; i++) {
        this._mist.push({
          x: Math.random() * w,
          y: this._hor + (h - this._hor) * rand(0.05, 0.5),
          rx: w * rand(0.12, 0.24),
          ry: h * rand(0.014, 0.03),
          v: rand(1.2, 3) * this._u * (Math.random() < 0.5 ? -1 : 1),
          a: rand(0.03, 0.06),
          ph: rand(0, TAU),
          sp: rand(0.06, 0.15),
        });
      }
    }

    _spawnDrop() {
      const w = this._cW, h = this._cH, hz = this._hor;
      const y = hz + Math.pow(Math.random(), 0.8) * (h - hz) * 0.85 + (h - hz) * 0.08;
      this._drops.push({
        x: w * rand(0.08, 0.92),
        y,
        age: 0,
        rings: 2 + Math.floor(rand(0, 2)),
        // near drops ripple faster and live longer, being closer
        v: (16 + 44 * (y - hz) / (h - hz)) * this._u,
        maxAge: rand(5, 7),
      });
      if (this._drops.length > 6) this._drops.shift();
    }

    _step(dt) {
      this._dropIn -= dt;
      if (this._dropIn <= 0) {
        this._spawnDrop();
        this._dropIn = rand(2.5, 7) / Math.max(0.5, this.intensity);
      }
      for (let i = this._drops.length - 1; i >= 0; i--) {
        const d = this._drops[i];
        d.age += dt;
        if (d.age > d.maxAge + d.rings * 0.7) this._drops.splice(i, 1);
      }
      for (const m of this._mist) {
        m.x += m.v * dt;
        const w = this._cW;
        if (m.x < -m.rx) m.x = w + m.rx;
        if (m.x > w + m.rx) m.x = -m.rx;
      }
    }

    // How strongly the expanding rings are passing through a point — used to
    // make star reflections shiver.
    _disturbance(x, y) {
      let sum = 0;
      for (const d of this._drops) {
        const p = this._persp(d.y);
        for (let i = 0; i < d.rings; i++) {
          const age = d.age - i * 0.7;
          if (age <= 0 || age > d.maxAge) continue;
          const r = d.v * age;
          const dist = Math.hypot(x - d.x, (y - d.y) / p);
          const band = 14 * this._u + r * 0.1;
          const dd = (dist - r) / band;
          if (dd > -2 && dd < 2) {
            sum += Math.exp(-dd * dd) * Math.pow(1 - age / d.maxAge, 1.5);
          }
        }
      }
      return sum;
    }

    _drawRing(ctx, d, i) {
      const age = d.age - i * 0.7;
      if (age <= 0 || age > d.maxAge) return;
      const r = d.v * age;
      const p = this._persp(d.y);
      const fade = Math.pow(1 - age / d.maxAge, 1.6) * Math.min(1, age * 6);
      // amplitude dies as the ring spreads its energy over the circumference
      const a = fade * 0.34 / (1 + r / (90 * this._u)) * (1 - 0.22 * i);
      if (a < 0.008) return;
      const lw = Math.max(1, (2.4 - age * 0.25) * this._u);

      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(1, p);
      // dark trough just inside the crest
      ctx.strokeStyle = `rgba(2,5,12,${a * 0.9})`;
      ctx.lineWidth = lw * 1.8;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(0.1, r - lw * 1.6), 0, TAU); ctx.stroke();
      // the crest catching the sky
      ctx.strokeStyle = `rgba(185,205,240,${a})`;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
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
      const w = this._cW, h = this._cH, hz = this._hor;

      ctx.drawImage(this._bg, 0, 0);

      // Star reflections: still points of light until a ring finds them.
      for (const r of this._reflections) {
        const dist = this._disturbance(r.x, r.y);
        const jx = Math.sin(t * 7 + r.ph) * dist * 3.5 * u;
        const a = Math.min(0.5, r.a * (0.7 + 0.3 * Math.sin(t * r.sp + r.ph)) + dist * 0.22);
        const len = r.len * (1 + dist * 1.6);
        const g = ctx.createLinearGradient(0, r.y - len, 0, r.y + len);
        g.addColorStop(0, 'rgba(200,218,255,0)');
        g.addColorStop(0.5, `rgba(200,218,255,${a})`);
        g.addColorStop(1, 'rgba(200,218,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(r.x + jx - 0.7 * u, r.y - len, 1.4 * u, len * 2);
      }

      // The rings.
      ctx.lineCap = 'round';
      for (const d of this._drops) {
        for (let i = 0; i < d.rings; i++) this._drawRing(ctx, d, i);
      }

      // Mist breathing over the surface.
      for (const m of this._mist) {
        const breathe = 0.6 + 0.4 * Math.sin(t * m.sp + m.ph);
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.rx);
        g.addColorStop(0, `rgba(150,170,205,${m.a * breathe})`);
        g.addColorStop(1, 'rgba(150,170,205,0)');
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.scale(1, m.ry / m.rx);
        ctx.translate(-m.x, -m.y);
        ctx.beginPath(); ctx.arc(m.x, m.y, m.rx, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }

    destroy() {
      this._bg = this._stars = this._reflections = null;
      this._drops = this._mist = null;
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
    _inst = new StillWaterTheme();
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

  window.StillWaterTheme = StillWaterTheme;
  window.StillWater = { init, destroy };
})();
