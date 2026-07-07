'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function gauss() {
    return Math.random() + Math.random() + Math.random() + Math.random() - 2;
  }

  // Eruption — a volcano at night, watched from far enough away that the
  // whole cone fits under the stars. Nothing here is drawn as a shape: the
  // mountain is a noise-perturbed profile painted at a third of the screen
  // resolution and upscaled soft, the lava is hundreds of glow particles
  // on real ballistic arcs that cool from white through orange to dying
  // red, and the smoke is a column of slowly tumbling puff sprites, each
  // lit from below by the crater while it is young and hot. The crater
  // breathes between long quiet spells and short violent bursts.
  class EruptionTheme {
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
      this._craterX = w * 0.52;
      this._craterY = h * 0.52;
      this._buildBackdrop();
      this._buildSprites();
      this._lava  = [];
      this._smoke = [];
      // Burst state: quiet emission with violent spells.
      this._burst    = 0;             // 0 quiet → 1 full burst
      this._burstEnd = 0;
      this._nextBurst = this._t + rand(4, 9);
      this._dt = 0;
    }

    _buildBackdrop() {
      const w = this._cW, h = this._cH;
      const lw = Math.max(240, Math.round(w / 3));
      const lh = Math.max(140, Math.round(h / 3));
      const low = document.createElement('canvas');
      low.width = lw; low.height = lh;
      const c = low.getContext('2d');

      // Night sky, warming faintly toward the crater's neighbourhood.
      const sky = c.createLinearGradient(0, 0, 0, lh);
      sky.addColorStop(0,    '#04030a');
      sky.addColorStop(0.45, '#0a0610');
      sky.addColorStop(0.78, '#180c12');
      sky.addColorStop(1,    '#221014');
      c.fillStyle = sky;
      c.fillRect(0, 0, lw, lh);

      const cx = lw * 0.52, cy = lh * 0.52;

      // The permanent glow the eruption throws on the air above it.
      let g = c.createRadialGradient(cx, cy, 0, cx, cy, lh * 0.55);
      g.addColorStop(0, 'rgba(255,120,60,0.14)');
      g.addColorStop(1, 'rgba(255,120,60,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, lh * 0.55, 0, TAU); c.fill();
      g = c.createRadialGradient(cx, cy, 0, cx, cy, lh * 0.2);
      g.addColorStop(0, 'rgba(255,150,80,0.20)');
      g.addColorStop(1, 'rgba(255,150,80,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, lh * 0.2, 0, TAU); c.fill();

      // The cone: a profile with fractal jitter, never a straight slope.
      // Two octaves of sine plus a random walk keep every run different.
      const ph1 = rand(0, TAU), ph2 = rand(0, TAU);
      let wob = 0;
      c.beginPath();
      c.moveTo(-4, lh + 4);
      for (let x = -4; x <= lw + 4; x += 2) {
        const d = Math.abs(x - cx) / (lw * 0.58);
        let y = cy + Math.pow(Math.min(1, d), 1.3) * (lh - cy + 4);
        wob += (Math.random() - 0.5) * 0.9;
        wob *= 0.92;
        y += Math.sin(x * 0.055 + ph1) * lh * 0.012
           + Math.sin(x * 0.021 + ph2) * lh * 0.02 * Math.min(1, d * 2)
           + wob;
        // The crater mouth dips just at the summit.
        const dc = Math.abs(x - cx) / (lw * 0.02);
        if (dc < 1) y += (1 - dc) * lh * 0.016;
        c.lineTo(x, y);
      }
      c.lineTo(lw + 4, lh + 4);
      c.closePath();
      const rock = c.createLinearGradient(0, cy, 0, lh);
      rock.addColorStop(0, '#0d0709');
      rock.addColorStop(1, '#030203');
      c.fillStyle = rock;
      c.fill();

      // Warm light the crater spills on its own upper slopes.
      for (let i = 0; i < 8; i++) {
        const dx = gauss() * lw * 0.03;
        const px = cx + dx;
        const py = cy + Math.abs(dx) * 0.5 + rand(0.005, 0.03) * lh;
        const r = lh * rand(0.02, 0.06);
        const gg = c.createRadialGradient(px, py, 0, px, py, r);
        gg.addColorStop(0, `rgba(255,110,50,${rand(0.08, 0.18).toFixed(3)})`);
        gg.addColorStop(1, 'rgba(255,110,50,0)');
        c.fillStyle = gg;
        c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
      }

      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const bc = bg.getContext('2d');
      bc.imageSmoothingEnabled = true;
      bc.imageSmoothingQuality = 'high';
      bc.filter = 'blur(1.2px)';
      bc.drawImage(low, 0, 0, w, h);
      bc.filter = 'none';

      // Stars at full resolution so they stay pin-sharp above the haze.
      const u = this._u;
      for (let i = 0; i < 110; i++) {
        const x = Math.random() * w;
        const y = Math.pow(Math.random(), 1.3) * h * 0.42;
        const dx = x - this._craterX, dy = y - this._craterY;
        if (dx * dx + dy * dy < (h * 0.22) * (h * 0.22)) continue;
        const a = rand(0.10, 0.55) * (1 - y / (h * 0.5));
        bc.fillStyle = `rgba(214,222,244,${a.toFixed(3)})`;
        const s = rand(0.5, 1.4) * Math.min(u, 1.5);
        bc.fillRect(x, y, s, s);
      }

      const vg = bc.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.45, w / 2, h * 0.5, Math.max(w, h) * 0.85);
      vg.addColorStop(0, 'rgba(2,1,4,0)');
      vg.addColorStop(1, 'rgba(2,1,4,0.5)');
      bc.fillStyle = vg;
      bc.fillRect(0, 0, w, h);

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

    // A smoke puff painted twice from one layout: once in ash gray, once
    // in ember orange, so a young puff can be lit from below by drawing
    // the warm copy additively on top of the gray one.
    _makeSmokePair() {
      const paint = (col) => {
        const s = document.createElement('canvas');
        s.width = s.height = 96;
        const c = s.getContext('2d');
        for (const p of layout) {
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0,   `rgba(${col},${p.a.toFixed(3)})`);
          g.addColorStop(0.6, `rgba(${col},${(p.a * 0.45).toFixed(3)})`);
          g.addColorStop(1,   `rgba(${col},0)`);
          c.fillStyle = g;
          c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
        }
        return s;
      };
      const layout = [];
      for (let i = 0; i < 20; i++) {
        layout.push({
          x: 48 + gauss() * 14,
          y: 48 + gauss() * 12,
          r: rand(10, 26),
          a: rand(0.05, 0.11),
        });
      }
      return { gray: paint('96,92,98'), warm: paint('255,140,70') };
    }

    _buildSprites() {
      this._lavaSpr = [
        this._makeGlow(255, 242, 205),   // fresh out of the vent
        this._makeGlow(255, 165, 85),    // cooling
        this._makeGlow(190, 62, 36),     // almost rock again
      ];
      this._smokeSpr = [this._makeSmokePair(), this._makeSmokePair()];
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
      const cx = this._craterX, cy = this._craterY;

      // Burst clock.
      if (this._burst > 0 && t > this._burstEnd) {
        this._burst = Math.max(0, this._burst - dt * 1.6);
      } else if (this._burst === 0 && t > this._nextBurst) {
        this._burst = 1;
        this._burstEnd  = t + rand(1.4, 3.2);
        this._nextBurst = this._burstEnd + rand(5, 12);
      }
      const vigor = 0.25 + this._burst * 0.75;          // emission strength

      ctx.drawImage(this._bg, 0, 0);

      // Smoke column: spawn, rise, tumble, fade.
      if (this._smoke.length < 46 && Math.random() < dt * (5 + this._burst * 9)) {
        this._smoke.push({
          x: cx + gauss() * 5 * u,
          y: cy - 4 * u,
          vx: rand(9, 20) * u,                          // prevailing wind
          vy: -rand(26, 46) * u,
          size: rand(26, 40) * u,
          grow: rand(14, 26) * u,
          rot: rand(0, TAU),
          rv: rand(-0.25, 0.25),
          life: rand(8, 13),
          age: 0,
          spr: this._smokeSpr[(Math.random() * 2) | 0],
          amax: rand(0.4, 0.7),
        });
      }
      for (let i = this._smoke.length - 1; i >= 0; i--) {
        const p = this._smoke[i];
        p.age += dt;
        if (p.age > p.life) { this._smoke.splice(i, 1); continue; }
        p.x += (p.vx + Math.sin(t * 0.4 + p.rot) * 4 * u) * dt;
        p.y += p.vy * dt;
        p.vy *= Math.pow(0.96, dt * 60);                // column slows as it climbs
        p.size += p.grow * dt;
        p.rot += p.rv * dt;
        const f = p.age / p.life;
        const a = p.amax * Math.sin(Math.PI * Math.min(1, f * 1.15)) * (0.55 + 0.45 * (1 - f));
        const heat = Math.exp(-p.age / 1.6) * vigor;    // young puffs glow from below
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = a;
        ctx.drawImage(p.spr.gray, -p.size, -p.size, p.size * 2, p.size * 2);
        if (heat > 0.02) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * heat * 1.1;
          ctx.drawImage(p.spr.warm, -p.size, -p.size, p.size * 2, p.size * 2);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // Crater glow, breathing with the eruption.
      const flare = (0.5 + 0.5 * this._burst) * (0.85 + 0.15 * Math.sin(t * 7.3) * this._burst)
                  * Math.min(1.3, this.intensity);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.3);
      g.addColorStop(0, `rgba(255,130,60,${(0.13 * flare).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,130,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, h * 0.3, 0, TAU); ctx.fill();
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.05);
      g.addColorStop(0, `rgba(255,210,140,${(0.55 * flare).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,160,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, h * 0.05, 0, TAU); ctx.fill();

      // The lava fountain: ballistic embers.
      const rate = 130 * vigor * Math.min(1.3, this.intensity);
      let toSpawn = rate * dt + (Math.random() < (rate * dt) % 1 ? 1 : 0);
      while (toSpawn-- >= 1 && this._lava.length < 520) {
        const ang = -Math.PI / 2 + gauss() * 0.16;
        const sp  = rand(90, 260) * (0.7 + this._burst * 0.5) * u;
        this._lava.push({
          x: cx + gauss() * 3.5 * u,
          y: cy,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          s: rand(1.6, 4.6) * u,
          life: rand(2.2, 3.6),
          age: 0,
        });
      }
      const grav = 170 * u;
      for (let i = this._lava.length - 1; i >= 0; i--) {
        const p = this._lava[i];
        p.age += dt;
        // Dead when cold, or when it comes back down onto the cone.
        if (p.age > p.life || (p.vy > 0 && p.y > cy + Math.abs(p.x - cx) * 0.5 + h * 0.02)) {
          this._lava.splice(i, 1); continue;
        }
        p.vy += grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const f = p.age / p.life;                       // 0 white-hot → 1 dark
        const spr = this._lavaSpr[f < 0.28 ? 0 : (f < 0.6 ? 1 : 2)];
        const a = (1 - f * f) * 0.9;
        const r = p.s * (2.6 - f * 1.1);
        ctx.globalAlpha = a;
        ctx.drawImage(spr, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    destroy() {
      this._bg = this._lavaSpr = this._smokeSpr = this._lava = this._smoke = null;
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
    _inst = new EruptionTheme();
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

  window.EruptionTheme = EruptionTheme;
  window.Eruption = { init, destroy };
})();
