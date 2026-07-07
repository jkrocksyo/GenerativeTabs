'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function gauss() {
    return Math.random() + Math.random() + Math.random() + Math.random() - 2;
  }

  // Colliding Worlds — two planet-scale bodies caught mid-impact, seen
  // from space. Each body is an irregular molten mass painted from
  // hundreds of soft puffs at low resolution and upscaled — dark cooled
  // crust on the far side, glowing fractured rock toward the seam — so
  // neither ever reads as a disc. Between them the contact zone blazes,
  // ejecta fans out along the seam and cools from white to ember red as
  // it decelerates, vapor plumes tumble away, and every so often a soft
  // equatorial shock disc rolls outward and dissolves.
  class CollisionTheme {
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
      this._cx = w * 0.5;
      this._cy = h * 0.47;
      this._buildBackdrop();
      this._buildBodies();
      this._buildSprites();
      this._ejecta = [];
      this._plumes = [];
      this._shock  = { r: 0, a: 0 };
      this._nextShock = this._t + rand(3, 6);
      this._dt = 0;
    }

    _buildBackdrop() {
      const w = this._cW, h = this._cH;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const c = bg.getContext('2d');

      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0,   '#030309');
      g.addColorStop(0.5, '#07060f');
      g.addColorStop(1,   '#020208');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);

      // Cold thin nebulosity far behind the event.
      for (let i = 0; i < 9; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = h * rand(0.12, 0.3);
        const gg = c.createRadialGradient(x, y, 0, x, y, r);
        const col = Math.random() < 0.5 ? '70,80,130' : '110,70,110';
        gg.addColorStop(0, `rgba(${col},${rand(0.02, 0.05).toFixed(3)})`);
        gg.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = gg;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }

      // The wide warm haze the impact throws into space, baked faint.
      const ig = c.createRadialGradient(this._cx, this._cy, 0, this._cx, this._cy, h * 0.75);
      ig.addColorStop(0,   'rgba(255,140,80,0.10)');
      ig.addColorStop(0.4, 'rgba(200,90,60,0.04)');
      ig.addColorStop(1,   'rgba(200,90,60,0)');
      c.fillStyle = ig;
      c.beginPath(); c.arc(this._cx, this._cy, h * 0.75, 0, TAU); c.fill();

      const u = this._u;
      for (let i = 0; i < 150; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const dx = x - this._cx, dy = y - this._cy;
        if (dx * dx + dy * dy < (h * 0.3) * (h * 0.3)) continue;
        c.fillStyle = `rgba(210,220,246,${rand(0.08, 0.5).toFixed(3)})`;
        const s = rand(0.5, 1.5) * Math.min(u, 1.5);
        c.fillRect(x, y, s, s);
      }

      const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.85);
      vg.addColorStop(0, 'rgba(1,1,4,0)');
      vg.addColorStop(1, 'rgba(1,1,4,0.5)');
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);

      this._bg = bg;
    }

    // One body, tip pointing right (mirrored for the other side). Painted
    // low-res from puffs: a near-solid dark hulk whose seam-facing end is
    // shot through with molten light, edges fraying into torn rock.
    _makeBody() {
      const lw = 220, lh = 190;
      const low = document.createElement('canvas');
      low.width = lw; low.height = lh;
      const c = low.getContext('2d');
      const puff = (x, y, r, col, a) => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0,   `rgba(${col},${a.toFixed(3)})`);
        g.addColorStop(0.6, `rgba(${col},${(a * 0.45).toFixed(3)})`);
        g.addColorStop(1,   `rgba(${col},0)`);
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      };

      // Dark crust: heavy accumulation around an off-center core, drawn
      // toward the tip so the mass leans into the impact.
      for (let i = 0; i < 130; i++) {
        const x = lw * 0.46 + gauss() * lw * 0.16 + Math.random() * lw * 0.10;
        const y = lh * 0.50 + gauss() * lh * 0.15;
        puff(x, y, lh * rand(0.07, 0.16), '24,20,26', rand(0.10, 0.17));
      }
      // Torn edges: sparse dark tufts flying off the silhouette.
      for (let i = 0; i < 26; i++) {
        const ang = rand(0, TAU);
        const x = lw * 0.46 + Math.cos(ang) * lw * rand(0.22, 0.3);
        const y = lh * 0.50 + Math.sin(ang) * lh * rand(0.24, 0.34);
        puff(x, y, lh * rand(0.025, 0.06), '20,17,22', rand(0.08, 0.14));
      }
      // Molten fractures: warm light welling up, dense at the tip and
      // dying off toward the cold side.
      for (let i = 0; i < 90; i++) {
        const x = lw * (0.55 + Math.abs(gauss()) * 0.14) + Math.random() * lw * 0.06;
        const y = lh * 0.50 + gauss() * lh * 0.13;
        const d = Math.max(0, (lw * 0.92 - x) / (lw * 0.45));
        const a = 0.10 * Math.exp(-d * d);
        if (a < 0.008) continue;
        puff(x, y, lh * rand(0.02, 0.055), Math.random() < 0.3 ? '255,210,140' : '255,120,55', a * rand(0.7, 1.4));
      }
      // White heat right at the crush zone.
      for (let i = 0; i < 26; i++) {
        const x = lw * rand(0.86, 0.97);
        const y = lh * 0.50 + gauss() * lh * 0.10;
        puff(x, y, lh * rand(0.02, 0.05), '255,235,200', rand(0.10, 0.2));
      }

      const bw = Math.round(this._cW * 0.34), bh = Math.round(bw * lh / lw);
      const spr = document.createElement('canvas');
      spr.width = bw; spr.height = bh;
      const sc = spr.getContext('2d');
      sc.imageSmoothingEnabled = true;
      sc.imageSmoothingQuality = 'high';
      sc.filter = `blur(${Math.max(1, bh * 0.006).toFixed(1)}px)`;
      sc.drawImage(low, 0, 0, bw, bh);
      sc.filter = 'none';
      return spr;
    }

    _buildBodies() {
      this._bodyL = this._makeBody();
      this._bodyR = this._makeBody();
    }

    _makeGlow(r, g, b) {
      const s = document.createElement('canvas');
      s.width = s.height = 64;
      const c = s.getContext('2d');
      const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0,    `rgba(${r},${g},${b},1)`);
      gr.addColorStop(0.3,  `rgba(${r},${g},${b},0.4)`);
      gr.addColorStop(0.65, `rgba(${r},${g},${b},0.10)`);
      gr.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      c.fillStyle = gr;
      c.fillRect(0, 0, 64, 64);
      return s;
    }

    _makePlume() {
      const s = document.createElement('canvas');
      s.width = s.height = 96;
      const c = s.getContext('2d');
      for (let i = 0; i < 18; i++) {
        const x = 48 + gauss() * 13, y = 48 + gauss() * 13;
        const r = rand(10, 24);
        const a = rand(0.05, 0.10);
        const col = Math.random() < 0.5 ? '180,110,80' : '120,80,80';
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0,   `rgba(${col},${a.toFixed(3)})`);
        g.addColorStop(0.6, `rgba(${col},${(a * 0.45).toFixed(3)})`);
        g.addColorStop(1,   `rgba(${col},0)`);
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }
      return s;
    }

    _buildSprites() {
      this._hotSpr = [
        this._makeGlow(255, 244, 214),
        this._makeGlow(255, 168, 88),
        this._makeGlow(196, 66, 40),
      ];
      this._plumeSpr = [this._makePlume(), this._makePlume()];
    }

    draw(ts) {
      if (ts === 0) { this._dt = 0; this._frame(); return; }
      const dt = (this._lastTs != null) ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      this._dt = dt * this.speed;
      this._t += this._dt;
      this._frame();
    }

    _frame() {
      const ctx = this.ctx, t = this._t, dt = this._dt;
      const w = this._cW, h = this._cH, u = this._u;
      const cx = this._cx, cy = this._cy;

      ctx.drawImage(this._bg, 0, 0);

      // The two hulks grind against each other in slow motion.
      const press = Math.sin(t * 0.14) * w * 0.004;
      const bw = this._bodyL.width, bh = this._bodyL.height;

      ctx.save();
      ctx.translate(cx - bw * 0.94 - press + bw / 2, cy - bh / 2 + Math.sin(t * 0.11) * h * 0.004 + bh / 2);
      ctx.rotate(Math.sin(t * 0.09) * 0.012);
      ctx.drawImage(this._bodyL, -bw / 2, -bh / 2);
      ctx.restore();

      ctx.save();
      ctx.translate(cx + bw * 0.94 + press - bw / 2, cy - bh / 2 - Math.sin(t * 0.10) * h * 0.004 + bh / 2);
      ctx.rotate(Math.sin(t * 0.08 + 2) * -0.012);
      ctx.scale(-1, 1);
      ctx.drawImage(this._bodyR, -bw / 2, -bh / 2);
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // The contact seam blazing between them, taller than it is wide.
      const throb = 0.72 + 0.18 * Math.sin(t * 0.9) + 0.10 * Math.sin(t * 3.7);
      const boost = Math.min(1.3, this.intensity);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(0.5, 1.25);
      let g = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.42);
      g.addColorStop(0,    `rgba(255,190,120,${(0.22 * throb * boost).toFixed(3)})`);
      g.addColorStop(0.45, `rgba(255,120,70,${(0.08 * throb * boost).toFixed(3)})`);
      g.addColorStop(1,    'rgba(255,120,70,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, h * 0.42, 0, TAU); ctx.fill();
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.10);
      g.addColorStop(0,   `rgba(255,248,228,${(0.85 * throb * boost).toFixed(3)})`);
      g.addColorStop(0.5, `rgba(255,205,130,${(0.35 * throb * boost).toFixed(3)})`);
      g.addColorStop(1,   'rgba(255,205,130,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, h * 0.10, 0, TAU); ctx.fill();
      ctx.restore();

      // Ejecta: sprayed from the seam, mostly up and down, decelerating
      // and cooling as it goes.
      const rate = 60 * boost;
      let toSpawn = rate * dt;
      if (Math.random() < toSpawn % 1) toSpawn += 1;
      while (toSpawn-- >= 1 && this._ejecta.length < 420) {
        const up = Math.random() < 0.5 ? -1 : 1;
        const ang = up * (Math.PI / 2 + gauss() * 0.5);
        const sp  = rand(50, 210) * u;
        this._ejecta.push({
          x: cx + gauss() * w * 0.006,
          y: cy + gauss() * h * 0.05,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          s: rand(1.4, 4.2) * u,
          life: rand(4, 7.5),
          age: 0,
        });
      }
      for (let i = this._ejecta.length - 1; i >= 0; i--) {
        const p = this._ejecta[i];
        p.age += dt;
        if (p.age > p.life) { this._ejecta.splice(i, 1); continue; }
        const drag = Math.pow(0.985, dt * 60);
        p.vx *= drag; p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const f = p.age / p.life;
        const spr = this._hotSpr[f < 0.25 ? 0 : (f < 0.6 ? 1 : 2)];
        const a = (1 - f) * (1 - f) * 0.8;
        const r = p.s * (2.2 - f * 0.8);
        ctx.globalAlpha = a;
        ctx.drawImage(spr, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;

      // The shock disc: a wide fuzzy front seen edge-on, rolling out and
      // dissolving. Gradient stops keep both of its faces soft.
      const sh = this._shock;
      if (sh.a <= 0 && t > this._nextShock) {
        sh.r = h * 0.08;
        sh.a = 0.22;
        this._nextShock = t + rand(6, 11);
      }
      if (sh.a > 0) {
        sh.r += h * 0.24 * dt;
        sh.a -= dt * 0.075;
        if (sh.a > 0.005) {
          const sig = sh.r * 0.32;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(1, 0.42);
          const rg = ctx.createRadialGradient(0, 0, Math.max(0, sh.r - sig), 0, 0, sh.r + sig);
          rg.addColorStop(0,   'rgba(255,190,140,0)');
          rg.addColorStop(0.5, `rgba(255,190,140,${(sh.a * boost).toFixed(3)})`);
          rg.addColorStop(1,   'rgba(255,190,140,0)');
          ctx.fillStyle = rg;
          ctx.beginPath(); ctx.arc(0, 0, sh.r + sig, 0, TAU); ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();

      // Vapor plumes tumbling away from the seam (normal blend, above the
      // glow so they silhouette against it).
      if (this._plumes.length < 16 && Math.random() < dt * 2.2) {
        const up = Math.random() < 0.5 ? -1 : 1;
        this._plumes.push({
          x: cx + gauss() * w * 0.008,
          y: cy + up * h * rand(0.04, 0.1),
          vx: gauss() * 8 * u,
          vy: up * rand(14, 30) * u,
          size: rand(18, 30) * u,
          grow: rand(10, 18) * u,
          rot: rand(0, TAU),
          rv: rand(-0.3, 0.3),
          life: rand(6, 10),
          age: 0,
          spr: this._plumeSpr[(Math.random() * 2) | 0],
        });
      }
      for (let i = this._plumes.length - 1; i >= 0; i--) {
        const p = this._plumes[i];
        p.age += dt;
        if (p.age > p.life) { this._plumes.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += p.grow * dt;
        p.rot += p.rv * dt;
        const f = p.age / p.life;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, f * 1.1)) * 0.5;
        ctx.drawImage(p.spr, -p.size, -p.size, p.size * 2, p.size * 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    destroy() {
      this._bg = this._bodyL = this._bodyR = this._hotSpr = this._plumeSpr =
      this._ejecta = this._plumes = this._shock = null;
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
    _inst = new CollisionTheme();
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

  window.CollisionTheme = CollisionTheme;
  window.Collision = { init, destroy };
})();
