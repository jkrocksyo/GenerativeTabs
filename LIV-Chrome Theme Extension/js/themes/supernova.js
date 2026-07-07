'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function gauss() {
    return Math.random() + Math.random() + Math.random() + Math.random() - 2;
  }

  // Supernova — a star that is still going off. The explosion never ends:
  // hundreds of filament particles ride a self-similar expansion (speed
  // proportional to distance, the way real remnants expand), stretching
  // radially as they fly, white-gold near the core and dimming through
  // orange to deep crimson before they dissolve and are reborn inside.
  // Billowy shell clumps follow more slowly, and every several seconds a
  // light echo — a wave of brightness — races out through the debris.
  // The core itself breathes, and occasionally spikes into a flare.
  class SupernovaTheme {
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
      this._cy = h * 0.46;
      this._innerR = h * 0.05;
      this._maxR   = Math.hypot(Math.max(this._cx, w - this._cx), Math.max(this._cy, h - this._cy)) * 1.02;
      this._buildBackdrop();
      this._buildSprites();
      this._buildFilaments();
      this._buildClumps();
      this._frontOff = rand(0, 1);
      this._dt = 0;
    }

    _buildBackdrop() {
      const w = this._cW, h = this._cH;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const c = bg.getContext('2d');

      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0,   '#020208');
      g.addColorStop(0.5, '#05040c');
      g.addColorStop(1,   '#010107');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);

      // Cold wisps of the progenitor's old winds, far out.
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = h * rand(0.14, 0.32);
        const gg = c.createRadialGradient(x, y, 0, x, y, r);
        const col = Math.random() < 0.5 ? '60,70,120' : '100,60,100';
        gg.addColorStop(0, `rgba(${col},${rand(0.02, 0.045).toFixed(3)})`);
        gg.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = gg;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }

      const u = this._u;
      for (let i = 0; i < 160; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const dx = x - this._cx, dy = y - this._cy;
        if (dx * dx + dy * dy < (h * 0.14) * (h * 0.14)) continue;
        c.fillStyle = `rgba(212,220,246,${rand(0.07, 0.5).toFixed(3)})`;
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

    _makeClumpSprite(col) {
      const s = document.createElement('canvas');
      s.width = s.height = 96;
      const c = s.getContext('2d');
      for (let i = 0; i < 16; i++) {
        const x = 48 + gauss() * 13, y = 48 + gauss() * 13;
        const r = rand(9, 22);
        const a = rand(0.05, 0.10);
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
      this._filSpr = [
        this._makeGlow(255, 246, 216),   // fresh, near the core
        this._makeGlow(255, 172, 92),    // mid-flight
        this._makeGlow(200, 64, 52),     // fading crimson rim
      ];
      this._clumpSpr = [
        this._makeClumpSprite('210,110,60'),
        this._makeClumpSprite('160,70,70'),
      ];
    }

    _buildFilaments() {
      const u = this._u;
      this._fils = [];
      const n = Math.round(250 * this.intensity);
      for (let i = 0; i < n; i++) {
        this._fils.push({
          th: rand(0, TAU),
          r: this._innerR * Math.pow(this._maxR / this._innerR, Math.random()),
          a: rand(0.25, 0.6),
          w: rand(1.0, 2.6) * u,
          jig: rand(-0.06, 0.06),         // slight off-radial tilt
        });
      }
    }

    _buildClumps() {
      this._clumps = [];
      for (let i = 0; i < 38; i++) {
        this._clumps.push({
          th: rand(0, TAU),
          r: this._innerR * Math.pow(this._maxR / this._innerR, Math.random()),
          a: rand(0.10, 0.22),
          s: rand(0.05, 0.11),
          rot: rand(0, TAU),
          rv: rand(-0.1, 0.1),
          spr: this._clumpSpr[(Math.random() * 2) | 0],
        });
      }
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
      const h = this._cH, u = this._u;
      const cx = this._cx, cy = this._cy;
      const inner = this._innerR, maxR = this._maxR;

      ctx.drawImage(this._bg, 0, 0);

      const boost = Math.min(1.3, this.intensity);
      // The core flares every so often on top of its slow breathing.
      const flare = 1 + Math.pow(Math.max(0, Math.sin(t * 0.21 + 1)), 14) * 1.6;
      const breath = (0.8 + 0.2 * Math.sin(t * 0.6)) * flare;

      // The light echo: a front racing out through the debris.
      const frontR = ((t * 0.11 + this._frontOff) % 1.15) * maxR * 1.1;
      const frontSig = maxR * 0.07;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Shell clumps behind the filaments.
      for (const p of this._clumps) {
        p.r *= Math.exp(0.030 * dt);          // slower than the filaments
        if (p.r > maxR) { p.r = inner * rand(1, 1.6); p.th = rand(0, TAU); }
        p.rot += p.rv * dt;
        const x = cx + Math.cos(p.th) * p.r;
        const y = cy + Math.sin(p.th) * p.r;
        const f = Math.min(1, (p.r - inner) / (maxR - inner));
        const echo = Math.exp(-Math.pow((p.r - frontR) / frontSig, 2)) * 0.5;
        const a = (p.a * (1 - f * 0.75) + echo * 0.14) * boost;
        const size = h * p.s * (0.6 + f * 1.3);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = a;
        ctx.drawImage(p.spr, -size, -size, size * 2, size * 2);
        ctx.restore();
      }

      // Filaments: stretched radially, speed proportional to distance.
      for (const p of this._fils) {
        p.r *= Math.exp(0.052 * dt);
        if (p.r > maxR) {
          p.r = inner * rand(1, 1.4);
          p.th = rand(0, TAU);
          p.a = rand(0.25, 0.6);
        }
        const x = cx + Math.cos(p.th) * p.r;
        const y = cy + Math.sin(p.th) * p.r;
        const f = Math.min(1, (p.r - inner) / (maxR - inner));
        const fadeIn  = Math.min(1, (p.r - inner) / (inner * 0.6));
        const fadeOut = Math.pow(1 - f, 0.7);
        const echo = Math.exp(-Math.pow((p.r - frontR) / frontSig, 2));
        const a = (p.a * fadeIn * fadeOut * (0.55 + 0.25 * breath * (1 - f)) + echo * 0.5) * boost;
        if (a < 0.012) continue;
        const spr = this._filSpr[f < 0.3 ? 0 : (f < 0.62 ? 1 : 2)];
        const len = Math.min(h * 0.055, (4 + p.r * 0.055)) * u * (1 + echo * 0.7);
        const th  = p.w * (1 + echo);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.th + p.jig);
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(spr, -len, -th * 2, len * 2, th * 4);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // The core: layered breathing glow, no edge anywhere.
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.34);
      g.addColorStop(0,    `rgba(255,210,150,${(0.18 * breath * boost).toFixed(3)})`);
      g.addColorStop(0.35, `rgba(255,150,90,${(0.07 * breath * boost).toFixed(3)})`);
      g.addColorStop(1,    'rgba(255,150,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, h * 0.34, 0, TAU); ctx.fill();

      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.085);
      g.addColorStop(0,   `rgba(255,252,240,${Math.min(1, 0.9 * breath * boost).toFixed(3)})`);
      g.addColorStop(0.4, `rgba(255,220,160,${(0.4 * breath * boost).toFixed(3)})`);
      g.addColorStop(1,   'rgba(255,220,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, h * 0.085, 0, TAU); ctx.fill();

      ctx.restore();
    }

    destroy() {
      this._bg = this._filSpr = this._clumpSpr = this._fils = this._clumps = null;
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
    _inst = new SupernovaTheme();
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

  window.SupernovaTheme = SupernovaTheme;
  window.Supernova = { init, destroy };
})();
