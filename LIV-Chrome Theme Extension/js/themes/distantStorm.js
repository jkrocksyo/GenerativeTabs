'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Quasi-Gaussian sample in roughly [-2, 2].
  function gauss() {
    return Math.random() + Math.random() + Math.random() + Math.random() - 2;
  }

  // Distant Storm — a storm cell parked on the sea horizon, far enough away
  // to be silent. The cloud bank is painted once; lightning never appears
  // as a bolt, only as soft bursts of light inside the cloud mass (a radial
  // glow masked by the bank's own alpha), each strike a run of one to three
  // Gaussian pulses. The water answers with a smeared column of light and
  // the rain veils under the cell backlight for a moment.
  class DistantStormTheme {
    init(canvas, ctx, opts) {
      this.canvas    = canvas;
      this.ctx       = ctx || canvas.getContext('2d');
      this.speed     = (opts && opts.speed) || 1;
      this.intensity = (opts && opts.intensity) || 1;
      this._t        = rand(0, 600);
      this._lastTs   = null;
      this._flashes  = [];
      this._flashIn  = rand(1.5, 4);
      this._build(canvas.width, canvas.height);
    }

    resize(w, h) { this._build(w, h); }

    _build(w, h) {
      this._cW = w;
      this._cH = h;
      this._u  = Math.max(0.6, Math.min(2.4, Math.min(w, h) / 900));
      this._hor     = h * 0.68;
      this._bankTop = h * 0.36;
      this._buildBackdrop();
      this._buildBank();
      this._buildVeils();
      this._buildShimmer();
    }

    _buildBackdrop() {
      const w = this._cW, h = this._cH, hz = this._hor, u = this._u;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const c = bg.getContext('2d');

      const sky = c.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0,    '#01030a');
      sky.addColorStop(0.6,  '#060d1c');
      sky.addColorStop(1,    '#0b1526');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, hz + 1);

      // Clear sky above the storm keeps its stars.
      for (let i = 0; i < 130; i++) {
        const x = Math.random() * w;
        const y = Math.pow(Math.random(), 1.3) * this._bankTop * 0.92;
        c.fillStyle = `rgba(210,225,255,${rand(0.12, 0.7)})`;
        c.beginPath(); c.arc(x, y, rand(0.3, 1.1) * u, 0, TAU); c.fill();
      }

      const sea = c.createLinearGradient(0, hz, 0, h);
      sea.addColorStop(0,   '#0a1424');
      sea.addColorStop(0.3, '#060d1a');
      sea.addColorStop(1,   '#01030a');
      c.fillStyle = sea;
      c.fillRect(0, hz, w, h - hz);

      // A pale seam where sea meets the storm.
      const hl = c.createLinearGradient(0, hz - 3 * u, 0, hz + 6 * u);
      hl.addColorStop(0, 'rgba(120,150,190,0)');
      hl.addColorStop(0.5, 'rgba(120,150,190,0.12)');
      hl.addColorStop(1, 'rgba(120,150,190,0)');
      c.fillStyle = hl;
      c.fillRect(0, hz - 3 * u, w, 9 * u);

      const vg = c.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.4, w / 2, h * 0.5, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(0,2,6,0)');
      vg.addColorStop(1, 'rgba(0,2,6,0.5)');
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);

      this._bg = bg;

      this._twinkles = [];
      for (let i = 0; i < 20; i++) {
        this._twinkles.push({
          x: Math.random() * w,
          y: Math.pow(Math.random(), 1.3) * this._bankTop * 0.85,
          r: rand(0.5, 1.3) * u,
          ph: rand(0, TAU),
          sp: rand(1.2, 2.6),
        });
      }
    }

    _buildBank() {
      // The bank lives on its own transparent canvas so its alpha doubles as
      // the mask that keeps lightning inside the cloud.
      const w = this._cW, hz = this._hor, top = this._bankTop;
      const bh = Math.ceil(hz - top);
      const bank = document.createElement('canvas');
      bank.width = w; bank.height = bh;
      const c = bank.getContext('2d');

      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const f = r / (rows - 1);                     // 0 top → 1 horizon
        const y = bh * (0.22 + f * 0.72);
        const n = 10 + r * 4;
        // darker and denser toward the waterline
        const shade = Math.round(20 - f * 9);
        const col = `${shade},${shade + 5},${shade + 14}`;
        for (let i = 0; i < n; i++) {
          const x = w * (i / n) + gauss() * w * 0.04;
          const rad = bh * (0.16 + f * 0.16) * rand(0.7, 1.3);
          const g = c.createRadialGradient(x, y, 0, x, y, rad);
          g.addColorStop(0,   `rgba(${col},0.75)`);
          g.addColorStop(0.7, `rgba(${col},0.4)`);
          g.addColorStop(1,   `rgba(${col},0)`);
          c.fillStyle = g;
          c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
        }
      }
      // Moonlight grazing the anvil tops.
      c.globalCompositeOperation = 'source-atop';
      const rim = c.createLinearGradient(0, 0, 0, bh);
      rim.addColorStop(0,    'rgba(150,175,215,0.16)');
      rim.addColorStop(0.35, 'rgba(150,175,215,0.03)');
      rim.addColorStop(1,    'rgba(0,0,0,0)');
      c.fillStyle = rim;
      c.fillRect(0, 0, w, bh);
      c.globalCompositeOperation = 'source-over';

      this._bank = bank;

      // Low-res buffer the flashes render into before masking.
      const fb = document.createElement('canvas');
      fb.width = Math.max(2, Math.ceil(w / 3));
      fb.height = Math.max(2, Math.ceil(bh / 3));
      this._flashBuf = fb;
      this._flashCtx = fb.getContext('2d');
    }

    _buildVeils() {
      const w = this._cW;
      this._veils = [];
      for (let i = 0; i < 3; i++) {
        this._veils.push({
          x: w * rand(0.1, 0.9),
          wdt: w * rand(0.07, 0.13),
          slant: rand(-0.12, 0.12),
          v: rand(1.5, 3.5) * this._u * (Math.random() < 0.5 ? -1 : 1),
          a: rand(0.05, 0.09),
          ph: rand(0, TAU),
        });
      }
    }

    _buildShimmer() {
      const w = this._cW, h = this._cH, hz = this._hor, u = this._u;
      this._shimmer = [];
      for (let i = 0; i < 26; i++) {
        this._shimmer.push({
          x: Math.random() * w,
          y: hz + Math.pow(Math.random(), 1.5) * (h - hz) * 0.85 + 4 * u,
          len: rand(10, 34) * u,
          ph: rand(0, TAU),
          sp: rand(0.5, 1.4),
        });
      }
    }

    // A strike is 1–3 Gaussian pulses; the summed brightness drives the
    // cloud glow, the water column and the veil backlight together.
    _spawnFlash() {
      const w = this._cW;
      const bh = this._hor - this._bankTop;
      const dur = rand(0.5, 1.2);
      const pulses = [];
      const n = 1 + Math.floor(rand(0, 3));
      for (let i = 0; i < n; i++) {
        pulses.push({
          at:  rand(0.05, dur * 0.7),
          len: rand(0.05, 0.13),
          amp: rand(0.5, 1) * (i === 0 ? 1 : 0.7),
        });
      }
      this._flashes.push({
        x: w * rand(0.12, 0.88),
        y: bh * rand(0.35, 0.8),
        r: bh * rand(0.5, 0.9),
        life: 0,
        dur,
        pulses,
        // one strike in three is far away — barely more than a glow
        dim: Math.random() < 0.33 ? rand(0.25, 0.5) : 1,
      });
    }

    _flashBrightness(f) {
      let b = 0;
      for (const p of f.pulses) {
        const d = (f.life - p.at) / p.len;
        b += p.amp * Math.exp(-d * d);
      }
      return b * f.dim;
    }

    _step(dt) {
      this._flashIn -= dt;
      if (this._flashIn <= 0) {
        this._spawnFlash();
        this._flashIn = rand(3, 9) / Math.max(0.5, this.intensity);
      }
      for (let i = this._flashes.length - 1; i >= 0; i--) {
        const f = this._flashes[i];
        f.life += dt;
        if (f.life > f.dur) this._flashes.splice(i, 1);
      }
      for (const v of this._veils) {
        v.x += v.v * dt;
        const w = this._cW;
        if (v.x < -v.wdt) v.x = w + v.wdt;
        if (v.x > w + v.wdt) v.x = -v.wdt;
      }
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
      const w = this._cW, h = this._cH, hz = this._hor, top = this._bankTop;
      const bh = hz - top;

      ctx.drawImage(this._bg, 0, 0);

      for (const s of this._twinkles) {
        const a = 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
        ctx.fillStyle = `rgba(210,225,255,${a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }

      ctx.drawImage(this._bank, 0, top);

      // Lightning inside the mass.
      if (this._flashes.length) {
        const c = this._flashCtx;
        const fw = this._flashBuf.width, fh = this._flashBuf.height;
        c.clearRect(0, 0, fw, fh);
        c.globalCompositeOperation = 'lighter';
        let total = 0;
        for (const f of this._flashes) {
          const b = this._flashBrightness(f);
          if (b < 0.02) continue;
          total += b;
          const x = f.x / 3, y = f.y / 3, r = f.r / 3;
          const g = c.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0,   `rgba(205,218,255,${Math.min(1, b)})`);
          g.addColorStop(0.4, `rgba(170,190,245,${Math.min(1, b) * 0.4})`);
          g.addColorStop(1,   'rgba(170,190,245,0)');
          c.fillStyle = g;
          c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        }
        c.globalCompositeOperation = 'destination-in';
        c.drawImage(this._bank, 0, 0, fw, fh);
        c.globalCompositeOperation = 'source-over';

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(this._flashBuf, 0, top, w, bh);
        ctx.restore();

        // The sea answers: a smeared column of light under each strike.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const f of this._flashes) {
          const b = this._flashBrightness(f);
          if (b < 0.03) continue;
          const cw = f.r * 1.3;
          const g = ctx.createLinearGradient(0, hz, 0, h * 0.96);
          g.addColorStop(0, `rgba(160,180,235,${0.16 * Math.min(1, b)})`);
          g.addColorStop(1, 'rgba(160,180,235,0)');
          ctx.fillStyle = g;
          ctx.fillRect(f.x - cw / 2, hz, cw, h - hz);
        }
        ctx.restore();
        this._lastGlow = total;
      } else {
        this._lastGlow = 0;
      }

      // Rain hanging under the cell, backlit whenever lightning runs.
      for (const v of this._veils) {
        let a = v.a * (0.75 + 0.25 * Math.sin(t * 0.3 + v.ph));
        for (const f of this._flashes) {
          const d = (v.x - f.x) / (f.r * 1.5);
          a += this._flashBrightness(f) * 0.10 * Math.exp(-d * d);
        }
        const g = ctx.createLinearGradient(0, top + bh * 0.5, 0, hz + 4 * u);
        g.addColorStop(0, `rgba(120,140,180,${a})`);
        g.addColorStop(1, 'rgba(120,140,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(v.x - v.wdt / 2, top + bh * 0.5);
        ctx.lineTo(v.x + v.wdt / 2, top + bh * 0.5);
        ctx.lineTo(v.x + v.wdt / 2 + v.slant * bh, hz + 4 * u);
        ctx.lineTo(v.x - v.wdt / 2 + v.slant * bh, hz + 4 * u);
        ctx.closePath();
        ctx.fill();
      }

      // Cold glints on the water, lifting a little when the sky lights up.
      const lift = Math.min(0.08, (this._lastGlow || 0) * 0.05);
      for (const s of this._shimmer) {
        const a = 0.025 + 0.045 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)) + lift;
        ctx.fillStyle = `rgba(170,195,235,${a})`;
        const x = s.x + Math.sin(t * 0.22 + s.ph) * 6 * u;
        ctx.fillRect(x - s.len / 2, s.y, s.len, 1.3 * u);
      }
    }

    destroy() {
      this._bg = this._bank = this._flashBuf = this._flashCtx = null;
      this._flashes = this._veils = this._shimmer = this._twinkles = null;
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
    _inst = new DistantStormTheme();
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

  window.DistantStormTheme = DistantStormTheme;
  window.DistantStorm = { init, destroy };
})();
