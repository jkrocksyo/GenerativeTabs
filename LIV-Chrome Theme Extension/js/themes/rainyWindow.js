'use strict';

(function () {

  const TAU = Math.PI * 2;

  // Rainy Window — rain on glass at night, city bokeh beyond.
  // Realism comes from three layers that never cheat:
  //   1. a defocused city rendered once (low-res + blur = true bokeh creaminess)
  //   2. a persistent condensation-mist canvas that running drops wipe clean
  //   3. droplets that actually refract: each lenses an inverted, magnified
  //      sample of the background, with rim shading and a specular glint.
  class RainyWindowTheme {
    init(canvas, ctx, opts) {
      this.canvas    = canvas;
      this.ctx       = ctx || canvas.getContext('2d');
      this.speed     = (opts && opts.speed) || 1;
      this.intensity = (opts && opts.intensity) || 1;
      this._t        = 0;
      this._lastTs   = null;
      this._runners  = [];
      this._spawnIn  = 1.2;
      this._drizzleIn= 0.5;
      this._mistIn   = 0;
      this._dryIn    = 0;
      this._build(canvas.width, canvas.height);
    }

    resize(w, h) {
      this._build(w, h);
    }

    // ── Scene construction ─────────────────────────────────────────────────

    _build(w, h) {
      this._cW = w;
      this._cH = h;
      this._u  = Math.max(0.7, Math.min(2.5, w / 1400));
      this._runners.length = 0;
      this._buildBackground();
      this._buildMist();
      this._buildStaticDrops();
      this._preWipeTrails();
    }

    _buildBackground() {
      const w = this._cW, h = this._cH;

      // Paint the city small, then scale up with a blur — cheap, true defocus.
      const lw = Math.max(2, Math.ceil(w / 6)), lh = Math.max(2, Math.ceil(h / 6));
      const low = document.createElement('canvas');
      low.width = lw; low.height = lh;
      const lc = low.getContext('2d');

      const sky = lc.createLinearGradient(0, 0, 0, lh);
      sky.addColorStop(0,    '#131a28');
      sky.addColorStop(0.45, '#1d2637');
      sky.addColorStop(0.72, '#33333c');
      sky.addColorStop(0.86, '#2a2833');
      sky.addColorStop(1,    '#191c25');
      lc.fillStyle = sky;
      lc.fillRect(0, 0, lw, lh);

      // Warm haze low in the frame — sodium glow of a wet street.
      const haze = lc.createRadialGradient(lw * 0.5, lh * 0.78, lh * 0.05, lw * 0.5, lh * 0.78, lh * 0.7);
      haze.addColorStop(0, 'rgba(214,140,72,0.28)');
      haze.addColorStop(1, 'rgba(214,140,72,0)');
      lc.fillStyle = haze;
      lc.fillRect(0, 0, lw, lh);

      // Bokeh discs. Warm palette dominates; a few cool accents and taillights.
      const palette = [
        ['255,183,94',  5], ['255,214,160', 4], ['255,141,77', 3],
        ['232,196,120', 3], ['217,79,58',   2], ['159,216,255', 2],
        ['255,242,207', 2], ['111,178,232', 1],
      ];
      const bag = [];
      palette.forEach(([c, n]) => { for (let i = 0; i < n; i++) bag.push(c); });

      const count = Math.round(64 + Math.random() * 12);
      for (let i = 0; i < count; i++) {
        const col = bag[(Math.random() * bag.length) | 0];
        // Lights cluster in the lower two thirds (street level, windows).
        const y = lh * (0.28 + Math.pow(Math.random(), 0.65) * 0.66);
        const x = Math.random() * lw;
        const r = (2 + Math.pow(Math.random(), 2) * 13) * (lw / 320);
        const a = r > 8 * (lw / 320) ? 0.22 + Math.random() * 0.2 : 0.4 + Math.random() * 0.45;
        const g = lc.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0,    `rgba(${col},${a})`);
        g.addColorStop(0.65, `rgba(${col},${a * 0.75})`);
        g.addColorStop(1,    `rgba(${col},0)`);
        lc.fillStyle = g;
        lc.beginPath(); lc.arc(x, y, r, 0, TAU); lc.fill();
      }

      // Vertical smears — reflections stretched on wet asphalt.
      for (let i = 0; i < 9; i++) {
        const col = bag[(Math.random() * bag.length) | 0];
        const x = Math.random() * lw;
        const y = lh * (0.72 + Math.random() * 0.18);
        const len = lh * (0.06 + Math.random() * 0.1);
        const g = lc.createLinearGradient(0, y, 0, y + len);
        g.addColorStop(0, `rgba(${col},0.25)`);
        g.addColorStop(1, `rgba(${col},0)`);
        lc.fillStyle = g;
        lc.fillRect(x - lw * 0.006, y, lw * 0.012, len);
      }

      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const bc = bg.getContext('2d');
      bc.imageSmoothingEnabled = true;
      bc.imageSmoothingQuality = 'high';
      bc.filter = 'blur(' + Math.max(2, 3 * this._u) + 'px)';
      bc.drawImage(low, -8, -8, w + 16, h + 16);
      bc.filter = 'none';

      // Vignette baked in — the drops sample this, so they darken naturally too.
      const vg = bc.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
      vg.addColorStop(0, 'rgba(6,8,14,0)');
      vg.addColorStop(1, 'rgba(6,8,14,0.5)');
      bc.fillStyle = vg;
      bc.fillRect(0, 0, w, h);

      this._bg = bg;
    }

    _buildMist() {
      const w = this._cW, h = this._cH;
      const mist = document.createElement('canvas');
      mist.width = w; mist.height = h;
      const mc = mist.getContext('2d');
      mc.fillStyle = 'rgba(176,196,212,0.12)';
      mc.fillRect(0, 0, w, h);
      // Uneven breath — condensation is thicker toward edges and corners.
      const eg = mc.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      eg.addColorStop(0, 'rgba(176,196,212,0)');
      eg.addColorStop(1, 'rgba(186,204,218,0.10)');
      mc.fillStyle = eg;
      mc.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = (40 + Math.random() * 160) * this._u;
        const g = mc.createRadialGradient(x, y, 0, x, y, r);
        const a = 0.02 + Math.random() * 0.03;
        g.addColorStop(0, `rgba(190,206,220,${a})`);
        g.addColorStop(1, 'rgba(190,206,220,0)');
        mc.fillStyle = g;
        mc.beginPath(); mc.arc(x, y, r, 0, TAU); mc.fill();
      }
      this._mist = mist;
      this._mistCtx = mc;
    }

    _buildStaticDrops() {
      const w = this._cW, h = this._cH, u = this._u;
      const layer = document.createElement('canvas');
      layer.width = w; layer.height = h;
      this._drops = layer;
      this._dropsCtx = layer.getContext('2d');

      const count = Math.min(280, Math.round(130 * this.intensity * (w * h) / (1400 * 900 * u * u)));
      const placed = [];
      for (let i = 0; i < count; i++) {
        const r = u * (1.1 + Math.pow(Math.random(), 2.2) * 5.5);
        let x, y, ok = false;
        for (let tries = 0; tries < 6 && !ok; tries++) {
          x = Math.random() * w;
          y = Math.random() * h;
          ok = true;
          for (let j = 0; j < placed.length; j++) {
            const p = placed[j];
            const dx = p.x - x, dy = p.y - y;
            if (dx * dx + dy * dy < (p.r + r + 3 * u) * (p.r + r + 3 * u)) { ok = false; break; }
          }
        }
        if (!ok) continue;
        placed.push({ x, y, r });
        this._paintDrop(this._dropsCtx, x, y, r, 1 + Math.random() * 0.15);
      }
    }

    // A refractive droplet: inverted magnified background inside an elliptical
    // lens, dark rim, bright refracted floor, sharp specular.
    _paintDrop(ctx, x, y, r, elong) {
      const bg = this._bg;
      const ry = r * elong;

      // Contact shadow on the glass.
      ctx.fillStyle = 'rgba(8,12,18,0.20)';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.16, y + ry * 0.22, r * 1.04, ry * 1.04, 0, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, y, r, ry, 0, 0, TAU);
      ctx.clip();

      // Inverted, magnified world.
      const mag = 2.1;
      const sw = r * 2 * mag, sh = ry * 2 * mag;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, -1);
      ctx.drawImage(bg, x - sw / 2, y - sh / 2, sw, sh, -r, -ry, r * 2, ry * 2);
      ctx.restore();

      // The lens gathers light — a touch brighter than the pane.
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x - r, y - ry, r * 2, ry * 2);

      // Dark rim where the surface curves away.
      const rim = ctx.createRadialGradient(x, y, r * 0.5, x, y, r);
      rim.addColorStop(0,   'rgba(0,0,0,0)');
      rim.addColorStop(0.8, 'rgba(6,12,20,0.18)');
      rim.addColorStop(1,   'rgba(6,12,20,0.5)');
      ctx.fillStyle = rim;
      ctx.fillRect(x - r, y - ry, r * 2, ry * 2);

      // Light pooling at the bottom of the lens.
      const pool = ctx.createRadialGradient(x, y + ry * 0.55, 0, x, y + ry * 0.55, r * 0.8);
      pool.addColorStop(0, 'rgba(255,244,224,0.20)');
      pool.addColorStop(1, 'rgba(255,244,224,0)');
      ctx.fillStyle = pool;
      ctx.fillRect(x - r, y - ry, r * 2, ry * 2);
      ctx.restore();

      // Specular glints, primary and faint counterpart.
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.34, y - ry * 0.4, r * 0.16, ry * 0.11, -0.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.3, y + ry * 0.32, r * 0.09, ry * 0.07, -0.6, 0, TAU);
      ctx.fill();
    }

    _wipeMist(x0, y0, x1, y1, width) {
      const mc = this._mistCtx;
      mc.save();
      mc.globalCompositeOperation = 'destination-out';
      mc.strokeStyle = 'rgba(0,0,0,0.85)';
      mc.lineCap = 'round';
      mc.lineWidth = width;
      mc.beginPath();
      mc.moveTo(x0, y0);
      mc.lineTo(x1, y1 + 0.01);
      mc.stroke();
      // Soft edge pass so the wipe doesn't look stamped.
      mc.strokeStyle = 'rgba(0,0,0,0.3)';
      mc.lineWidth = width * 1.7;
      mc.stroke();
      mc.restore();
    }

    // Old trails so the very first frame already tells the story.
    _preWipeTrails() {
      const w = this._cW, h = this._cH, u = this._u;
      const n = 3;
      for (let i = 0; i < n; i++) {
        let x = w * (0.15 + Math.random() * 0.7);
        let y = -10;
        const wob = 2 + Math.random() * 3;
        const width = (7 + Math.random() * 5) * u;
        const endY = h * (0.5 + Math.random() * 0.5);
        while (y < endY) {
          const ny = y + 14 * u;
          const nx = x + Math.sin(y / (40 * u)) * wob * u + (Math.random() - 0.5) * 2 * u;
          this._wipeMist(x, y, nx, ny, width);
          if (Math.random() < 0.3) {
            this._paintDrop(this._dropsCtx, nx + (Math.random() - 0.5) * width, ny, u * (1 + Math.random() * 1.6), 1.1);
          }
          x = nx; y = ny;
        }
        // The drop that made the trail, resting where it died.
        this._paintDrop(this._dropsCtx, x, y, (2.5 + Math.random() * 1.5) * u, 1.2);
      }
    }

    // ── Simulation ─────────────────────────────────────────────────────────

    _spawnRunner() {
      const w = this._cW, u = this._u;
      this._runners.push({
        x: w * (0.05 + Math.random() * 0.9),
        y: this._cH * Math.random() * 0.5 - 20 * u,
        r: (3.6 + Math.random() * 3) * u,
        p1: Math.random() * TAU,
        p2: Math.random() * TAU,
        p3: Math.random() * TAU,
        travel: 0,
        nextResidue: (14 + Math.random() * 26) * u,
      });
    }

    _step(dt) {
      const u = this._u, h = this._cH;
      const t = this._t;

      // Runners: stick-slip descent, wobble, mass loss, residue.
      for (let i = this._runners.length - 1; i >= 0; i--) {
        const d = this._runners[i];
        const slip = Math.max(0, 0.25 + 0.6 * Math.sin(t * 1.3 + d.p1) + 0.5 * Math.sin(t * 3.7 + d.p2));
        const vy = (46 + d.r * 7) * u * slip;
        const vx = Math.sin(t * 0.9 + d.p3) * 9 * u * slip;
        const ny = d.y + vy * dt;
        const nx = d.x + vx * dt;
        if (vy * dt > 0.05) this._wipeMist(d.x, d.y, nx, ny, d.r * 2.4);

        d.travel += vy * dt;
        if (d.travel > d.nextResidue) {
          d.travel = 0;
          d.nextResidue = (14 + Math.random() * 30) * u;
          this._paintDrop(this._dropsCtx, nx + (Math.random() - 0.5) * d.r * 1.6, ny - d.r, u * (0.9 + Math.random() * 1.7), 1.15);
          d.r = Math.max(d.r - 0.22 * u, 0);
        }
        d.x = nx; d.y = ny;

        if (d.y > h + d.r * 2 || d.r < 2 * u) {
          if (d.r >= 2 * u) this._paintDrop(this._dropsCtx, d.x, d.y, d.r, 1.25);
          this._runners.splice(i, 1);
        }
      }

      this._spawnIn -= dt * this.intensity;
      if (this._spawnIn <= 0 && this._runners.length < 7) {
        this._spawnRunner();
        this._spawnIn = 2.2 + Math.random() * 3.5;
      }

      // Fresh drizzle settling on the pane.
      this._drizzleIn -= dt * this.intensity;
      if (this._drizzleIn <= 0) {
        this._drizzleIn = 1.6 + Math.random() * 1.8;
        this._paintDrop(
          this._dropsCtx,
          Math.random() * this._cW,
          Math.random() * this._cH,
          u * (0.9 + Math.pow(Math.random(), 1.8) * 2.4),
          1 + Math.random() * 0.15
        );
      }

      // Condensation slowly re-fogs wiped trails (batched: sub-1% alpha
      // fills round to nothing in 8-bit compositing).
      this._mistIn += dt;
      if (this._mistIn > 1.6) {
        this._mistIn = 0;
        this._mistCtx.fillStyle = 'rgba(176,196,212,0.005)';
        this._mistCtx.fillRect(0, 0, this._cW, this._cH);
      }

      // Old droplets slowly dry off so a long-lived tab reaches equilibrium
      // instead of whiting out the pane.
      this._dryIn += dt;
      if (this._dryIn > 12) {
        this._dryIn = 0;
        const dc = this._dropsCtx;
        dc.save();
        dc.globalCompositeOperation = 'destination-out';
        dc.fillStyle = 'rgba(0,0,0,0.06)';
        dc.fillRect(0, 0, this._cW, this._cH);
        dc.restore();
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
      const ctx = this.ctx;
      ctx.drawImage(this._bg, 0, 0);
      ctx.drawImage(this._mist, 0, 0);
      ctx.drawImage(this._drops, 0, 0);
      for (let i = 0; i < this._runners.length; i++) {
        const d = this._runners[i];
        // Wet tail above the running drop.
        const tail = ctx.createLinearGradient(0, d.y - d.r * 4.5, 0, d.y);
        tail.addColorStop(0, 'rgba(210,225,240,0)');
        tail.addColorStop(1, 'rgba(210,225,240,0.16)');
        ctx.fillStyle = tail;
        ctx.beginPath();
        ctx.moveTo(d.x - d.r * 0.5, d.y);
        ctx.lineTo(d.x, d.y - d.r * 4.5);
        ctx.lineTo(d.x + d.r * 0.5, d.y);
        ctx.closePath();
        ctx.fill();
        this._paintDrop(ctx, d.x, d.y, d.r, 1.3);
      }
    }

    destroy() {
      this._runners.length = 0;
      this._bg = this._mist = this._mistCtx = this._drops = this._dropsCtx = null;
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
    _inst = new RainyWindowTheme();
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

  window.RainyWindowTheme = RainyWindowTheme;
  window.RainyWindow = { init, destroy };
})();
