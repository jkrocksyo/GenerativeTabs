'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Misty Valley — dawn over folded ridgelines. The scene is five overlapping
  // ridge silhouettes fading into a warm horizon, painted once; all of the
  // motion lives in the fog banks that drift through the gaps between them.
  // Each bank is a handful of large soft blobs rendered at quarter
  // resolution and upscaled, so the mist has no edges anywhere — it just
  // thickens and thins as the blobs slide past each other.
  class MistyValleyTheme {
    init(canvas, ctx, opts) {
      this.canvas    = canvas;
      this.ctx       = ctx || canvas.getContext('2d');
      this.speed     = (opts && opts.speed) || 1;
      this.intensity = (opts && opts.intensity) || 1;
      this._t        = rand(0, 400);
      this._lastTs   = null;
      this._build(canvas.width, canvas.height);
    }

    resize(w, h) { this._build(w, h); }

    _build(w, h) {
      this._cW = w;
      this._cH = h;
      this._u  = Math.max(0.6, Math.min(2.4, Math.min(w, h) / 900));
      this._sunX = w * 0.60;
      this._sunY = h * 0.545;
      this._buildSky();
      this._buildRidges();
      this._buildFog();
      this._buildWisps();
    }

    _buildSky() {
      const w = this._cW, h = this._cH;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const c = bg.getContext('2d');

      const sky = c.createLinearGradient(0, 0, 0, h * 0.62);
      sky.addColorStop(0,    '#161c33');
      sky.addColorStop(0.45, '#3d3452');
      sky.addColorStop(0.78, '#8a5a58');
      sky.addColorStop(1,    '#cf7e4e');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, h * 0.62 + 1);

      // Whatever the nearest ridge doesn't cover reads as valley floor haze.
      const low = c.createLinearGradient(0, h * 0.62, 0, h);
      low.addColorStop(0, '#b06a48');
      low.addColorStop(0.4, '#5a3a44');
      low.addColorStop(1, '#191225');
      c.fillStyle = low;
      c.fillRect(0, h * 0.62, w, h * 0.38);

      // Sun bloom in three widening passes, then the disc itself.
      const passes = [
        [h * 0.52, 'rgba(255,166,104,0.16)'],
        [h * 0.18, 'rgba(255,186,124,0.30)'],
        [h * 0.055, 'rgba(255,214,164,0.55)'],
      ];
      for (const [r, col] of passes) {
        const g = c.createRadialGradient(this._sunX, this._sunY, 0, this._sunX, this._sunY, r);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(255,166,104,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(this._sunX, this._sunY, r, 0, TAU); c.fill();
      }
      c.fillStyle = 'rgba(255,236,205,0.9)';
      c.beginPath(); c.arc(this._sunX, this._sunY, h * 0.024, 0, TAU); c.fill();

      const vg = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.4, w / 2, h * 0.5, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(8,6,14,0)');
      vg.addColorStop(1, 'rgba(8,6,14,0.42)');
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);

      this._sky = bg;
    }

    _buildRidges() {
      const w = this._cW, h = this._cH;
      // Far to near: lighter and gentler at the horizon, darker and bolder
      // close up — plain atmospheric perspective.
      const specs = [
        { base: 0.575, amp: 0.030, k: 1.9, col: '#8a5e60', rim: 0.10 },
        { base: 0.615, amp: 0.042, k: 2.6, col: '#6b4756', rim: 0.07 },
        { base: 0.665, amp: 0.055, k: 2.2, col: '#4b3348', rim: 0.05 },
        { base: 0.735, amp: 0.075, k: 1.7, col: '#302439', rim: 0 },
        { base: 0.845, amp: 0.105, k: 1.3, col: '#171126', rim: 0 },
      ];
      this._ridges = specs.map((s, i) => {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const c = cv.getContext('2d');
        const p1 = rand(0, TAU), p2 = rand(0, TAU), p3 = rand(0, TAU);
        const pts = [];
        for (let x = 0; x <= w; x += 6) {
          const nx = x / w;
          pts.push(h * (
            s.base
            - s.amp * (0.5 + 0.5 * Math.sin(nx * s.k * TAU * 0.5 + p1))
            - s.amp * 0.45 * (0.5 + 0.5 * Math.sin(nx * s.k * TAU * 1.3 + p2))
            - s.amp * 0.16 * (0.5 + 0.5 * Math.sin(nx * s.k * TAU * 3.7 + p3))
          ));
        }
        c.fillStyle = s.col;
        c.beginPath();
        c.moveTo(0, h);
        pts.forEach((y, j) => c.lineTo(j * 6, y));
        c.lineTo(w, h);
        c.closePath();
        c.fill();
        if (s.rim > 0) {
          // Far crests catch the sunrise along their tops.
          c.strokeStyle = `rgba(255,190,130,${s.rim})`;
          c.lineWidth = 1.6 * this._u;
          c.beginPath();
          pts.forEach((y, j) => j ? c.lineTo(j * 6, y) : c.moveTo(0, y));
          c.stroke();
        }
        return cv;
      });
    }

    _buildFog() {
      const w = this._cW, h = this._cH;
      // One drifting bank per gap; nearer banks ride lower, move faster and
      // lean cooler as they leave the sunlight behind.
      const bands = [
        { top: 0.545, hgt: 0.095, tint: '236,196,164', drift: 3.2, alpha: 0.34 },
        { top: 0.600, hgt: 0.115, tint: '224,186,168', drift: 4.6, alpha: 0.32 },
        { top: 0.665, hgt: 0.140, tint: '200,178,186', drift: 6.4, alpha: 0.30 },
        { top: 0.760, hgt: 0.170, tint: '176,168,192', drift: 8.8, alpha: 0.26 },
      ];
      this._fog = bands.map(b => {
        const bw = Math.max(2, Math.ceil(w / 4));
        const bh = Math.max(2, Math.ceil(h * b.hgt / 4));
        const buf = document.createElement('canvas');
        buf.width = bw; buf.height = bh;
        const blobs = [];
        for (let i = 0; i < 6; i++) {
          blobs.push({
            x: Math.random() * bw,
            y: bh * rand(0.35, 0.8),
            rx: bw * rand(0.14, 0.30),
            ry: bh * rand(0.5, 0.95),
            ph: rand(0, TAU),
            sp: rand(0.05, 0.14),
            k: rand(0.6, 1),
          });
        }
        return { ...b, buf, ctx: buf.getContext('2d'), blobs };
      });
    }

    _buildWisps() {
      const w = this._cW, h = this._cH;
      this._wisps = [];
      for (let i = 0; i < 3; i++) {
        this._wisps.push({
          x: Math.random() * w,
          y: h * rand(0.10, 0.34),
          rx: w * rand(0.14, 0.26),
          ry: h * rand(0.012, 0.026),
          v: rand(2, 4.5) * this._u,
          a: rand(0.04, 0.08),
        });
      }
    }

    _renderFogBand(f, t) {
      const c = f.ctx;
      const bw = f.buf.width, bh = f.buf.height;
      c.clearRect(0, 0, bw, bh);
      for (const b of f.blobs) {
        const x = (((b.x + t * f.drift / 4) % (bw * 1.4)) + bw * 1.4) % (bw * 1.4) - bw * 0.2;
        const breathe = 0.65 + 0.35 * Math.sin(t * b.sp + b.ph);
        const g = c.createRadialGradient(x, b.y, 0, x, b.y, b.rx);
        g.addColorStop(0, `rgba(${f.tint},${f.alpha * b.k * breathe})`);
        g.addColorStop(1, `rgba(${f.tint},0)`);
        c.fillStyle = g;
        c.save();
        c.translate(x, b.y);
        c.scale(1, b.ry / b.rx);
        c.translate(-x, -b.y);
        c.beginPath(); c.arc(x, b.y, b.rx, 0, TAU); c.fill();
        c.restore();
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

      ctx.drawImage(this._sky, 0, 0);

      // The sun breathes just enough to feel lit, not blinking.
      const pulse = 0.05 + 0.04 * Math.sin(t * 0.3);
      const pg = ctx.createRadialGradient(this._sunX, this._sunY, 0, this._sunX, this._sunY, h * 0.26);
      pg.addColorStop(0, `rgba(255,186,124,${pulse})`);
      pg.addColorStop(1, 'rgba(255,186,124,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(this._sunX, this._sunY, h * 0.26, 0, TAU); ctx.fill();

      // High thin cloud drifting across the dawn.
      for (const s of this._wisps) {
        const x = (((s.x + t * s.v) % (w + s.rx * 2)) + w + s.rx * 2) % (w + s.rx * 2) - s.rx;
        const g = ctx.createRadialGradient(x, s.y, 0, x, s.y, s.rx);
        g.addColorStop(0, `rgba(235,205,190,${s.a})`);
        g.addColorStop(1, 'rgba(235,205,190,0)');
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(x, s.y);
        ctx.scale(1, s.ry / s.rx);
        ctx.translate(-x, -s.y);
        ctx.beginPath(); ctx.arc(x, s.y, s.rx, 0, TAU); ctx.fill();
        ctx.restore();
      }

      // Ridge, fog, ridge, fog … so every bank sits inside its own valley.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      for (let i = 0; i < this._ridges.length; i++) {
        ctx.drawImage(this._ridges[i], 0, 0);
        if (i < this._fog.length) {
          const f = this._fog[i];
          this._renderFogBand(f, t);
          ctx.drawImage(f.buf, 0, h * f.top, w, h * f.hgt);
        }
      }
    }

    destroy() {
      this._sky = this._ridges = this._fog = this._wisps = null;
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
    _inst = new MistyValleyTheme();
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

  window.MistyValleyTheme = MistyValleyTheme;
  window.MistyValley = { init, destroy };
})();
