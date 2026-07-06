'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Fireside — a campfire on a still night.
  // The fire is built from additive particles: soft sprites that rise from
  // the fuel bed, shrinking and cooling from white-gold through orange to
  // ember red. Sparks climb higher, smoke drifts above, and the whole
  // clearing breathes with the flame's light.
  class FiresideTheme {
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
      this._fx = w * 0.5;
      this._fy = h * 0.80;
      this._buildBackground();
      this._buildSprites();
      this._buildParticles();
    }

    _buildBackground() {
      const w = this._cW, h = this._cH, u = this._u;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const c = bg.getContext('2d');

      const sky = c.createLinearGradient(0, 0, 0, h * 0.85);
      sky.addColorStop(0,    '#070b18');
      sky.addColorStop(0.6,  '#0d1426');
      sky.addColorStop(1,    '#16192b');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, h);

      // Stars, denser overhead.
      for (let i = 0; i < 140; i++) {
        const x = Math.random() * w;
        const y = Math.pow(Math.random(), 1.5) * h * 0.6;
        c.fillStyle = `rgba(226,236,255,${rand(0.12, 0.65)})`;
        c.beginPath(); c.arc(x, y, rand(0.3, 1.3) * u, 0, TAU); c.fill();
      }

      // Ground.
      const gr = c.createLinearGradient(0, h * 0.72, 0, h);
      gr.addColorStop(0, '#141210');
      gr.addColorStop(1, '#080706');
      c.fillStyle = gr;
      c.fillRect(0, h * 0.72, w, h * 0.28);
      c.fillStyle = '#0e0d10';
      c.beginPath();
      c.ellipse(w * 0.5, h * 0.72, w * 0.75, h * 0.045, 0, 0, TAU);
      c.fill();

      // Pines framing the clearing, kept away from center.
      const pine = (x, base, ht, tone) => {
        c.fillStyle = tone;
        const tiers = 5;
        for (let i = 0; i < tiers; i++) {
          const ty = base - ht * (i / tiers);
          const tw = ht * 0.34 * (1 - i / tiers * 0.72);
          const th = ht * 0.30;
          c.beginPath();
          c.moveTo(x - tw, ty);
          c.lineTo(x + tw, ty);
          c.lineTo(x, ty - th);
          c.closePath();
          c.fill();
        }
        c.fillRect(x - ht * 0.02, base - ht * 0.02, ht * 0.04, ht * 0.06);
      };
      const spots = [
        [0.06, 0.42], [0.145, 0.55], [0.24, 0.34],
        [0.78, 0.38], [0.87, 0.56], [0.95, 0.44],
      ];
      for (const [fx2, sz] of spots) {
        pine(w * fx2 + rand(-14, 14) * u, h * rand(0.70, 0.735), h * sz, Math.random() < 0.5 ? '#0a0e18' : '#0c111c');
      }

      // Stone ring around the fire pit.
      const stones = 9;
      for (let i = 0; i < stones; i++) {
        const a = (i / stones) * TAU + 0.3;
        const sx = this._fx + Math.cos(a) * 74 * u;
        const sy = this._fy + 14 * u + Math.sin(a) * 26 * u;
        const sr = rand(7, 11) * u;
        c.fillStyle = '#26211f';
        c.beginPath(); c.ellipse(sx, sy + 2 * u, sr * 1.05, sr * 0.7, 0, 0, TAU); c.fill();
        c.fillStyle = '#3a322d';
        c.beginPath(); c.ellipse(sx, sy, sr, sr * 0.72, rand(-0.2, 0.2), 0, TAU); c.fill();
        // Fire-facing highlight.
        c.fillStyle = 'rgba(255,150,70,0.20)';
        c.beginPath(); c.ellipse(sx - Math.cos(a) * sr * 0.35, sy - sr * 0.22, sr * 0.55, sr * 0.32, 0, 0, TAU); c.fill();
      }

      // Crossed logs.
      const log = (ang, len, lift) => {
        c.save();
        c.translate(this._fx, this._fy + 10 * u - lift);
        c.rotate(ang);
        const lw2 = 9 * u;
        const g2 = c.createLinearGradient(0, -lw2, 0, lw2);
        g2.addColorStop(0, '#33221a');
        g2.addColorStop(1, '#1c110c');
        c.fillStyle = g2;
        c.beginPath();
        if (c.roundRect) c.roundRect(-len / 2, -lw2, len, lw2 * 2, lw2);
        else c.rect(-len / 2, -lw2, len, lw2 * 2);
        c.fill();
        c.fillStyle = '#4a2f1e';
        c.beginPath(); c.ellipse(-len / 2 + lw2 * 0.5, 0, lw2 * 0.5, lw2 * 0.85, 0, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(len / 2 - lw2 * 0.5, 0, lw2 * 0.5, lw2 * 0.85, 0, 0, TAU); c.fill();
        c.restore();
      };
      log(-0.32, 120 * u, 0);
      log(0.28, 112 * u, 4 * u);
      log(-0.05, 100 * u, 9 * u);

      // Vignette.
      const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.36, w / 2, h / 2, Math.max(w, h) * 0.72);
      vg.addColorStop(0, 'rgba(3,4,9,0)');
      vg.addColorStop(1, 'rgba(3,4,9,0.5)');
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);

      this._bg = bg;

      this._twinkles = [];
      for (let i = 0; i < 20; i++) {
        this._twinkles.push({
          x: Math.random() * w,
          y: Math.pow(Math.random(), 1.5) * h * 0.55,
          r: rand(0.5, 1.3) * u,
          ph: rand(0, TAU),
          sp: rand(1.2, 2.5),
        });
      }
    }

    _buildSprites() {
      // One soft radial sprite; tint comes from composite color at draw time.
      const s = document.createElement('canvas');
      s.width = s.height = 128;
      const c = s.getContext('2d');
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0,   'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
      g.addColorStop(1,   'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      this._soft = s;

      // Pre-tinted flame sprites: hot core, body, cool tip.
      this._flameSprites = ['255,236,180', '255,160,60', '215,80,25'].map(col => {
        const f = document.createElement('canvas');
        f.width = f.height = 128;
        const fc = f.getContext('2d');
        const fg = fc.createRadialGradient(64, 64, 0, 64, 64, 64);
        fg.addColorStop(0,    `rgba(${col},0.9)`);
        fg.addColorStop(0.45, `rgba(${col},0.38)`);
        fg.addColorStop(1,    `rgba(${col},0)`);
        fc.fillStyle = fg;
        fc.fillRect(0, 0, 128, 128);
        return f;
      });
    }

    _seedFlame(p, stagger) {
      const u = this._u;
      p.maxLife = rand(0.55, 1.05);
      p.life    = stagger ? Math.random() * p.maxLife : 0;
      p.x0      = rand(-26, 26) * u;
      p.z       = 1 - Math.abs(p.x0) / (30 * u);     // center particles climb hottest
      p.vy      = rand(70, 130) * u * (0.6 + p.z * 0.5);
      p.size    = rand(11, 22) * u;
      p.wob     = rand(1.5, 3.5);
      p.ph      = rand(0, TAU);
    }

    _seedEmber(e, stagger) {
      const u = this._u;
      e.maxLife = rand(1.8, 4);
      e.life    = stagger ? Math.random() * e.maxLife : 0;
      e.x       = this._fx + rand(-20, 20) * u;
      e.y       = this._fy - rand(10, 50) * u;
      e.vy      = rand(45, 95) * u;
      e.vx      = rand(-8, 8) * u;
      e.size    = rand(1.1, 2.3) * u;
      e.ph      = rand(0, TAU);
      e.fl      = rand(4, 9);
    }

    _seedSmoke(s, stagger) {
      const u = this._u;
      s.maxLife = rand(3.5, 6);
      s.life    = stagger ? Math.random() * s.maxLife : 0;
      s.x       = this._fx + rand(-12, 12) * u;
      s.y       = this._fy - rand(60, 90) * u;
      s.vy      = rand(26, 44) * u;
      s.size    = rand(16, 30) * u;
      s.ph      = rand(0, TAU);
    }

    _buildParticles() {
      const nF = Math.round(64 * this.intensity);
      const nE = Math.round(13 * this.intensity);
      const nS = 7;
      this._flames = []; this._embers = []; this._smoke = [];
      for (let i = 0; i < nF; i++) { const p = {}; this._seedFlame(p, true); this._flames.push(p); }
      for (let i = 0; i < nE; i++) { const e = {}; this._seedEmber(e, true); this._embers.push(e); }
      for (let i = 0; i < nS; i++) { const s = {}; this._seedSmoke(s, true); this._smoke.push(s); }
    }

    // ── Simulation ─────────────────────────────────────────────────────────

    _step(dt) {
      for (const p of this._flames) {
        p.life += dt;
        if (p.life >= p.maxLife) this._seedFlame(p, false);
      }
      for (const e of this._embers) {
        e.life += dt;
        e.y -= e.vy * dt;
        e.x += (e.vx + Math.sin(this._t * 2 + e.ph) * 14 * this._u) * dt;
        if (e.life >= e.maxLife) this._seedEmber(e, false);
      }
      for (const s of this._smoke) {
        s.life += dt;
        s.y -= s.vy * dt;
        s.x += Math.sin(this._t * 0.6 + s.ph) * 8 * this._u * dt;
        if (s.life >= s.maxLife) this._seedSmoke(s, false);
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
      const fx = this._fx, fy = this._fy;

      ctx.drawImage(this._bg, 0, 0);

      for (const s of this._twinkles) {
        const a = 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
        ctx.fillStyle = `rgba(226,236,255,${a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }

      // The clearing breathes with the fire.
      const energy = 0.82 + 0.10 * Math.sin(t * 2.1) + 0.08 * Math.sin(t * 5.3 + 1.7);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const R = Math.max(this._cW, this._cH) * 0.5;
      const gl = ctx.createRadialGradient(fx, fy - 20 * u, 0, fx, fy - 20 * u, R);
      gl.addColorStop(0,   `rgba(255,150,60,${0.20 * energy})`);
      gl.addColorStop(0.35,`rgba(255,120,45,${0.08 * energy})`);
      gl.addColorStop(1,   'rgba(255,120,45,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, this._cW, this._cH);
      ctx.restore();

      // Warm pool on the ground.
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const gp = ctx.createRadialGradient(fx, fy + 16 * u, 0, fx, fy + 16 * u, 190 * u);
      gp.addColorStop(0, `rgba(255,160,70,${0.30 * energy})`);
      gp.addColorStop(1, 'rgba(255,160,70,0)');
      ctx.fillStyle = gp;
      ctx.beginPath();
      ctx.ellipse(fx, fy + 16 * u, 190 * u, 62 * u, 0, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Smoke, behind the flames.
      for (const s of this._smoke) {
        const p = s.life / s.maxLife;
        const a = 0.05 * Math.sin(Math.PI * Math.min(1, p * 1.15));
        if (a <= 0) continue;
        const sz = s.size * (1 + p * 2.2);
        ctx.globalAlpha = a;
        ctx.drawImage(this._soft, s.x - sz, s.y - sz, sz * 2, sz * 2);
      }
      ctx.globalAlpha = 1;

      // Flames — additive sprites cooling as they climb.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this._flames) {
        const f = p.life / p.maxLife;
        const rise = f * p.vy * p.maxLife;
        const x = fx + p.x0 * (1 - f * 0.55) + Math.sin(p.ph + f * p.wob * TAU) * 5 * u * f;
        const y = fy - 4 * u - rise;
        const sz = p.size * (1 - f * 0.62) * (0.7 + p.z * 0.4);
        const heat = Math.max(0, Math.min(1, p.z - f * 1.15 + 0.35));
        const spr = heat > 0.62 ? 0 : heat > 0.3 ? 1 : 2;
        ctx.globalAlpha = 0.5 * (1 - f) * (0.6 + p.z * 0.4) * energy;
        ctx.drawImage(this._flameSprites[spr], x - sz, y - sz, sz * 2, sz * 2);
      }

      // Hot heart of the fire.
      const coreW = 30 * u * (0.9 + 0.1 * Math.sin(t * 7.1));
      ctx.globalAlpha = 0.85 * energy;
      ctx.drawImage(this._flameSprites[0], fx - coreW, fy - 12 * u - coreW * 1.2, coreW * 2, coreW * 2);

      // Sparks.
      for (const e of this._embers) {
        const p = e.life / e.maxLife;
        const a = (1 - p) * (0.5 + 0.5 * Math.sin(t * e.fl + e.ph));
        if (a <= 0.02) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = p < 0.4 ? '#ffcf8a' : '#ff8a3c';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * (1 - p * 0.5), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    destroy() {
      this._bg = this._soft = this._flameSprites = null;
      this._flames = this._embers = this._smoke = this._twinkles = null;
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
    _inst = new FiresideTheme();
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

  window.FiresideTheme = FiresideTheme;
  window.Fireside = { init, destroy };
})();
