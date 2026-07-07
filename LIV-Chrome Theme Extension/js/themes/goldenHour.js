'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Quasi-Gaussian sample in roughly [-2, 2].
  function gauss() {
    return Math.random() + Math.random() + Math.random() + Math.random() - 2;
  }

  // Golden Hour — the last minutes of sun over open water. The sky and a
  // big sun half-sunk into the horizon are painted once; the life of the
  // scene is in three things: banks of lobed cumulus lit from below
  // (fire-lit billows underneath, shaded tops, frayed edges) drifting at
  // parallax speeds, the glitter path — hundreds of horizontal glints with
  // a Gaussian spread around the sun line, fused near the horizon, long
  // and sparse near the viewer — and a loose line of birds that crosses
  // the sky now and then.
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
      this._sunY = h * 0.685;
      this._buildBackdrop();
      this._buildClouds();
      this._buildGlints();
      this._buildBirds();
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

      // Sun bloom, then a big low disc half-sunk into the horizon.
      const passes = [
        [h * 0.62, 'rgba(255,158,84,0.16)'],
        [h * 0.26, 'rgba(255,178,100,0.30)'],
        [h * 0.12, 'rgba(255,208,140,0.48)'],
      ];
      for (const [r, col] of passes) {
        const g = c.createRadialGradient(this._sunX, this._sunY, 0, this._sunX, this._sunY, r);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(255,158,84,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(this._sunX, this._sunY, r, 0, TAU); c.fill();
      }
      c.save();
      c.beginPath(); c.rect(0, 0, w, hz + 1); c.clip();
      c.translate(this._sunX, this._sunY);
      c.scale(1, 0.94);
      const sd = c.createRadialGradient(0, 0, 0, 0, 0, h * 0.075);
      sd.addColorStop(0,    'rgba(255,242,210,0.98)');
      sd.addColorStop(0.72, 'rgba(255,226,172,0.96)');
      sd.addColorStop(1,    'rgba(255,204,132,0.88)');
      c.fillStyle = sd;
      c.beginPath(); c.arc(0, 0, h * 0.075, 0, TAU); c.fill();
      c.restore();

      // Reflected column under the sun, widening with depth. Painted in
      // thin slices, each a horizontal gradient centered on the sun line,
      // so the edges fall off softly instead of forming a trapezoid.
      const slices = 42;
      for (let i = 0; i < slices; i++) {
        const f  = i / (slices - 1);
        const y0 = hz + f * (h - hz);
        const sh = (h - hz) / (slices - 1) + 1;
        const half = w * (0.045 + f * 0.20);
        const a = 0.28 * Math.pow(1 - f, 1.4) + 0.02;
        const g = c.createLinearGradient(this._sunX - half, 0, this._sunX + half, 0);
        g.addColorStop(0,   'rgba(255,170,92,0)');
        g.addColorStop(0.5, `rgba(255,170,92,${a})`);
        g.addColorStop(1,   'rgba(255,170,92,0)');
        c.fillStyle = g;
        c.fillRect(this._sunX - half, y0, half * 2, sh);
      }

      const vg = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.42, w / 2, h * 0.5, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(10,6,14,0)');
      vg.addColorStop(1, 'rgba(10,6,14,0.4)');
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);

      this._bg = bg;
    }

    // Painted the Night Train way: lobed cumulus cells built from dozens
    // of small faint puffs at low resolution, then upscaled so the grain
    // fuses into soft vapor. The sun is below these clouds, so the lit
    // billows go along the underside and the shading along the top.
    _makeCloudSprite(pw, ph, body, lit) {
      // Paint at roughly a third of the final size (these banks are much
      // bigger on screen than Night Train's), so the upscale stays gentle
      // and never shows its grid.
      const lh = Math.max(40, Math.min(140, Math.round(ph / 3)));
      const lw = Math.max(80, Math.min(560, Math.round(lh * pw / ph)));
      const low = document.createElement('canvas');
      low.width = lw; low.height = lh;
      const lc = low.getContext('2d');
      const puff = (x, y, r, sx, col, a) => {
        const g = lc.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0,   `rgba(${col},${a.toFixed(3)})`);
        g.addColorStop(0.6, `rgba(${col},${(a * 0.45).toFixed(3)})`);
        g.addColorStop(1,   `rgba(${col},0)`);
        lc.save();
        lc.translate(x, y); lc.scale(sx, 1); lc.translate(-x, -y);
        lc.fillStyle = g;
        lc.beginPath(); lc.arc(x, y, r, 0, TAU); lc.fill();
        lc.restore();
      };

      // A handful of lobe cells strung loosely left to right.
      const nc = 3 + ((Math.random() * 3) | 0);
      const cells = [];
      for (let j = 0; j < nc; j++) {
        cells.push({
          x: lw * (0.20 + 0.60 * j / (nc - 1) + (Math.random() - 0.5) * 0.12),
          y: lh * (0.45 + Math.random() * 0.16),
          r: lh * (0.16 + Math.random() * 0.16),
        });
      }
      const pick = () => cells[(Math.random() * nc) | 0];

      // Body: dense cores thinning toward the edges.
      for (let k = 0; k < 44; k++) {
        const cl = pick();
        puff(cl.x + gauss() * cl.r * 1.5, cl.y + gauss() * cl.r * 0.55,
             cl.r * (0.45 + Math.random() * 0.5), 1.3 + Math.random() * 0.5,
             body, 0.060 + Math.random() * 0.045);
      }
      // Fire-lit billows along the underside, facing the sun.
      for (let k = 0; k < 26; k++) {
        const cl = pick();
        const ang = Math.PI * (0.15 + Math.random() * 0.70);
        puff(cl.x + Math.cos(ang) * cl.r * (0.7 + Math.random() * 0.7),
             cl.y + Math.sin(ang) * cl.r * (0.8 + Math.random() * 0.5),
             cl.r * (0.20 + Math.random() * 0.30), 1.2 + Math.random() * 0.5,
             lit, 0.075 + Math.random() * 0.055);
      }
      // Shaded tops where the light can't reach.
      for (let k = 0; k < 10; k++) {
        const cl = pick();
        puff(cl.x + (Math.random() - 0.5) * cl.r * 2.2,
             cl.y - cl.r * (0.45 + Math.random() * 0.35),
             cl.r * (0.30 + Math.random() * 0.30), 2.0,
             '20,12,26', 0.040 + Math.random() * 0.025);
      }
      // Stray tufts so the silhouette frays at the edges.
      for (let k = 0; k < 7; k++) {
        puff(lw * (0.06 + Math.random() * 0.88), lh * (0.28 + Math.random() * 0.44),
             lh * (0.05 + Math.random() * 0.07), 1.6 + Math.random(),
             body, 0.035 + Math.random() * 0.025);
      }

      const s = document.createElement('canvas');
      s.width = pw; s.height = ph;
      const c = s.getContext('2d');
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.filter = `blur(${Math.max(1, ph * 0.012).toFixed(1)}px)`;
      c.drawImage(low, 0, 0, pw, ph);
      c.filter = 'none';
      return s;
    }

    _buildClouds() {
      const w = this._cW, h = this._cH;
      // Far high cloud is dim violet; the nearer, lower banks catch more fire.
      const layers = [
        { n: 5, y: [0.08, 0.30], sc: [0.10, 0.16], v: 2.0, a: 0.70, body: '86,62,88',  lit: '255,150,110' },
        { n: 4, y: [0.30, 0.48], sc: [0.15, 0.24], v: 3.6, a: 0.85, body: '74,50,72',  lit: '255,160,100' },
        { n: 3, y: [0.46, 0.60], sc: [0.22, 0.34], v: 5.6, a: 0.95, body: '56,38,58',  lit: '255,170,96'  },
      ];
      this._clouds = [];
      for (const L of layers) {
        for (let i = 0; i < L.n; i++) {
          const sc = rand(L.sc[0], L.sc[1]);
          const pw = Math.max(8, Math.round(w * sc * 1.9));
          const ph = Math.max(6, Math.round(h * sc * 0.72));
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

    _buildBirds() {
      const w = this._cW, h = this._cH, u = this._u;
      // A loose line of birds that crosses the sky, then a long gap
      // offscreen before the next pass.
      this._birds = [];
      for (let i = 0; i < 5; i++) {
        this._birds.push({
          dx:   i * w * 0.045 + rand(-0.012, 0.012) * w,
          dy:   (i - 2) * h * 0.018 + rand(-0.01, 0.01) * h,
          s:    (5.5 + rand(0, 2.5)) * u,
          ph:   rand(0, TAU),
          rate: rand(7.5, 9.5),
          gph:  rand(0, TAU),
        });
      }
      this._birdSpan = w * 1.9;
      this._birdV    = w * 0.028;
      this._birdY    = h * rand(0.18, 0.34);
    }

    // Two-segment wings pivoting at the shoulder: each wing is one
    // quadratic from shoulder to wingtip with the elbow as the control
    // point, so tips swing above and below the body instead of hinging
    // at it. The beat is phase-warped (slow downstroke, quick flick up)
    // and the outer wing lags the inner, which makes the tip whip.
    // glide (0..1) relaxes the flap into a shallow held V.
    _bird(ctx, x, y, s, beat, glide) {
      const warp  = p => Math.sin(p + 0.6 * Math.sin(p));
      const inner = (1 - glide) * warp(beat) * 0.9        + glide * 0.35;
      const outer = (1 - glide) * warp(beat - 0.9) * 1.15 + glide * 0.15;
      const by = y + (1 - glide) * warp(beat) * s * 0.12;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.16, by);
      ctx.lineTo(x + s * 0.20, by);
      for (const d of [-1, 1]) {
        const ex = x  + d * Math.cos(inner) * s * 0.55;
        const ey = by - Math.sin(inner) * s * 0.55;
        ctx.moveTo(x, by);
        ctx.quadraticCurveTo(ex, ey,
          ex + d * Math.cos(outer) * s * 0.60,
          ey - Math.sin(outer) * s * 0.60);
      }
      ctx.stroke();
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

      // Birds crossing right to left, silhouetted against the sky.
      ctx.strokeStyle = 'rgba(44,26,34,0.85)';
      ctx.lineWidth   = Math.max(1, 1.1 * this._u);
      ctx.lineCap     = 'round';
      const head = w + w * 0.1 - ((t * this._birdV) % this._birdSpan);
      for (const b of this._birds) {
        const bx = head + b.dx;
        if (bx < -b.s * 2 || bx > w + b.s * 4) continue;
        const by = this._birdY + b.dy + Math.sin(t * 0.9 + b.ph) * 4 * this._u;
        const glide = Math.min(1, Math.max(0, (Math.sin(t * 0.33 + b.gph) - 0.55) * 4));
        this._bird(ctx, bx, by, b.s, t * b.rate + b.ph, glide);
      }

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
      this._bg = this._clouds = this._glints = this._birds = null;
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
