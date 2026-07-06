'use strict';

(function () {

  const TAU = Math.PI * 2;

  // Rainy Window — rain on glass at night, city bokeh beyond.
  // Realism comes from layers that never cheat:
  //   1. a defocused city rendered once (low-res + blur = true bokeh creaminess)
  //   2. a soft drizzle falling outside, behind the glass
  //   3. droplets that actually refract: each lenses an inverted, magnified
  //      sample of the background, with rim shading and a specular glint.
  // Running drops behave like water, not lines: they swell in place, tear
  // free as a teardrop, glide while their mass lasts, and stop.
  class RainyWindowTheme {
    init(canvas, ctx, opts) {
      this.canvas    = canvas;
      this.ctx       = ctx || canvas.getContext('2d');
      this.speed     = (opts && opts.speed) || 1;
      this.intensity = (opts && opts.intensity) || 1;
      this._t        = 0;
      this._lastTs   = null;
      this._runners  = [];
      this._spawnIn  = 1.5;
      this._drizzleIn= 0.8;
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
      this._buildRain();
      this._buildStaticDrops();
    }

    _buildBackground() {
      const w = this._cW, h = this._cH;

      // Paint the city small, then scale up with a blur — cheap, true defocus.
      const lw = Math.max(2, Math.ceil(w / 4)), lh = Math.max(2, Math.ceil(h / 4));
      const low = document.createElement('canvas');
      low.width = lw; low.height = lh;
      const lc = low.getContext('2d');
      const sx = w / lw, sy = h / lh;      // low-res → full-res, for live beacons
      this._beacons = [];

      const sky = lc.createLinearGradient(0, 0, 0, lh);
      sky.addColorStop(0,    '#0a0f1e');
      sky.addColorStop(0.5,  '#141c30');
      sky.addColorStop(0.75, '#2b2838');
      sky.addColorStop(1,    '#1a1a26');
      lc.fillStyle = sky;
      lc.fillRect(0, 0, lw, lh);

      // Urban glow rising off the skyline.
      for (const [gx, ga] of [[0.32, 0.16], [0.68, 0.20]]) {
        const g = lc.createRadialGradient(lw * gx, lh * 0.74, 0, lw * gx, lh * 0.74, lh * 0.55);
        g.addColorStop(0, `rgba(255,158,84,${ga})`);
        g.addColorStop(1, 'rgba(255,158,84,0)');
        lc.fillStyle = g;
        lc.fillRect(0, 0, lw, lh);
      }

      // Far skyline: hazier, bluer, packed tight.
      const farBase = lh * 0.72;
      for (let x = -4; x < lw;) {
        const bw = 8 + Math.random() * 22;
        const bh = lh * (0.08 + Math.random() * 0.22);
        lc.fillStyle = '#171d2d';
        lc.fillRect(x, farBase - bh, bw, bh);
        for (let wy = farBase - bh + 2; wy < farBase - 2; wy += 3) {
          for (let wx = x + 1; wx < x + bw - 2; wx += 3) {
            if (Math.random() < 0.26) {
              lc.fillStyle = `rgba(255,196,124,${0.25 + Math.random() * 0.45})`;
              lc.fillRect(wx, wy, 1.5, 1.5);
            }
          }
        }
        x += bw + 1 + (Math.random() < 0.2 ? 2 + Math.random() * 6 : 0);
      }

      // Near skyline: taller, darker, sharper window grids.
      const nearBase = lh * 0.86;
      const towers = [];
      for (let x = -6; x < lw;) {
        const bw = 15 + Math.random() * 30;
        const bh = lh * (0.16 + Math.random() * 0.46);
        const top = nearBase - bh;
        const bg2 = lc.createLinearGradient(0, top, 0, nearBase);
        bg2.addColorStop(0, '#0c101c');
        bg2.addColorStop(1, '#090c15');
        lc.fillStyle = bg2;
        lc.fillRect(x, top, bw, bh);
        towers.push({ x, bw, top, bh });

        for (let wy = top + 3; wy < nearBase - 3; wy += 3.5) {
          if (Math.random() < 0.15) continue;             // dark floor
          for (let wx = x + 2; wx < x + bw - 3; wx += 4) {
            if (Math.random() < 0.32) {
              const cool = Math.random() < 0.16;
              const a = 0.4 + Math.random() * 0.5;
              lc.fillStyle = cool ? `rgba(188,220,255,${a})` : `rgba(255,200,128,${a})`;
              lc.fillRect(wx, wy, 2, 1.6);
            }
          }
        }
        x += bw + 1 + (Math.random() < 0.25 ? 3 + Math.random() * 8 : 0);
      }

      // Neon signage on a few near towers.
      const neon = ['255,80,96', '58,200,255', '255,176,64', '125,255,176'];
      const signTowers = towers.filter(tw => tw.bh > lh * 0.24);
      for (let i = 0; i < Math.min(4, signTowers.length); i++) {
        const tw = signTowers[(Math.random() * signTowers.length) | 0];
        const col = neon[(Math.random() * neon.length) | 0];
        const sx2 = tw.x + 2 + Math.random() * Math.max(1, tw.bw - 10);
        const sy2 = tw.top + tw.bh * (0.15 + Math.random() * 0.4);
        const sw2 = 4 + Math.random() * 5, sh2 = 2 + Math.random() * 1.5;
        const g = lc.createRadialGradient(sx2 + sw2 / 2, sy2 + sh2 / 2, 0, sx2 + sw2 / 2, sy2 + sh2 / 2, 8);
        g.addColorStop(0, `rgba(${col},0.45)`);
        g.addColorStop(1, `rgba(${col},0)`);
        lc.fillStyle = g;
        lc.fillRect(sx2 - 8, sy2 - 8, sw2 + 16, sh2 + 16);
        lc.fillStyle = `rgba(${col},0.9)`;
        lc.fillRect(sx2, sy2, sw2, sh2);
      }

      // Antennas with aviation beacons on the two tallest towers
      // (beacons blink live, drawn each frame at full res).
      towers.sort((a, b) => a.top - b.top);
      for (const tw of towers.slice(0, 2)) {
        const ax = tw.x + tw.bw / 2;
        const ah2 = 7 + Math.random() * 8;
        lc.strokeStyle = '#1c2230';
        lc.lineWidth = 1;
        lc.beginPath(); lc.moveTo(ax, tw.top); lc.lineTo(ax, tw.top - ah2); lc.stroke();
        this._beacons.push({ x: ax * sx, y: (tw.top - ah2) * sy, ph: Math.random() * TAU });
      }

      // Street level: sodium wash, lamps, traffic.
      lc.fillStyle = '#0d0d13';
      lc.fillRect(0, nearBase, lw, lh - nearBase);
      const street = lc.createLinearGradient(0, nearBase - 2, 0, nearBase + lh * 0.07);
      street.addColorStop(0, 'rgba(255,172,92,0.30)');
      street.addColorStop(1, 'rgba(255,172,92,0)');
      lc.fillStyle = street;
      lc.fillRect(0, nearBase - 2, lw, lh * 0.09);

      for (let x = 4 + Math.random() * 10; x < lw; x += 15 + Math.random() * 10) {
        const g = lc.createRadialGradient(x, nearBase + 1, 0, x, nearBase + 1, 5);
        g.addColorStop(0, 'rgba(255,196,120,0.55)');
        g.addColorStop(1, 'rgba(255,196,120,0)');
        lc.fillStyle = g;
        lc.fillRect(x - 5, nearBase - 4, 10, 10);
        lc.fillStyle = '#ffe2b2';
        lc.fillRect(x - 0.5, nearBase, 1.2, 1.2);
        // Wet-asphalt smear under each lamp.
        const rg = lc.createLinearGradient(0, nearBase + 2, 0, nearBase + 2 + lh * 0.06);
        rg.addColorStop(0, 'rgba(255,190,110,0.16)');
        rg.addColorStop(1, 'rgba(255,190,110,0)');
        lc.fillStyle = rg;
        lc.fillRect(x - 1, nearBase + 2, 2, lh * 0.06);
      }
      for (let i = 0; i < 9; i++) {
        const red = Math.random() < 0.55;
        lc.fillStyle = red ? 'rgba(255,64,52,0.8)' : 'rgba(255,240,214,0.8)';
        lc.fillRect(Math.random() * lw, nearBase + lh * (0.015 + Math.random() * 0.04), 2, 1.2);
      }

      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const bc = bg.getContext('2d');
      bc.imageSmoothingEnabled = true;
      bc.imageSmoothingQuality = 'high';
      bc.filter = 'blur(' + Math.max(2, 2.4 * this._u) + 'px)';
      bc.drawImage(low, -6, -6, w + 12, h + 12);
      bc.filter = 'none';

      // Vignette baked in — the drops sample this, so they darken naturally too.
      const vg = bc.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.74);
      vg.addColorStop(0, 'rgba(8,10,16,0)');
      vg.addColorStop(1, 'rgba(8,10,16,0.34)');
      bc.fillStyle = vg;
      bc.fillRect(0, 0, w, h);

      this._bg = bg;
    }

    _buildMist() {
      const w = this._cW, h = this._cH;
      const mist = document.createElement('canvas');
      mist.width = w; mist.height = h;
      const mc = mist.getContext('2d');
      mc.fillStyle = 'rgba(176,196,212,0.09)';
      mc.fillRect(0, 0, w, h);
      // Uneven breath — condensation is thicker toward edges and corners.
      const eg = mc.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      eg.addColorStop(0, 'rgba(176,196,212,0)');
      eg.addColorStop(1, 'rgba(186,204,218,0.09)');
      mc.fillStyle = eg;
      mc.fillRect(0, 0, w, h);
      for (let i = 0; i < 22; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = (40 + Math.random() * 160) * this._u;
        const g = mc.createRadialGradient(x, y, 0, x, y, r);
        const a = 0.015 + Math.random() * 0.025;
        g.addColorStop(0, `rgba(190,206,220,${a})`);
        g.addColorStop(1, 'rgba(190,206,220,0)');
        mc.fillStyle = g;
        mc.beginPath(); mc.arc(x, y, r, 0, TAU); mc.fill();
      }
      this._mist = mist;
    }

    // Drizzle falling outside the glass — soft, fast, out of focus.
    _buildRain() {
      const w = this._cW, h = this._cH, u = this._u;
      this._rain = [];
      const n = Math.round(46 * this.intensity);
      for (let i = 0; i < n; i++) {
        this._rain.push({
          x: Math.random() * w,
          y: Math.random() * h,
          len: (26 + Math.random() * 34) * u,
          sp:  (520 + Math.random() * 320) * u,
          a:   0.03 + Math.random() * 0.06,
          wd:  (1.2 + Math.random() * 1.2) * u,
        });
      }
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
        this._paintDrop(this._dropsCtx, x, y, r, 1 + Math.random() * 0.1);
      }
    }

    // Teardrop outline: round belly, tapering tail upward when moving.
    _traceDrop(ctx, x, y, r, tail) {
      ctx.beginPath();
      if (tail < r * 0.2) {
        ctx.ellipse(x, y, r, r + tail, 0, 0, TAU);
        return;
      }
      const topY = y - r - tail;
      ctx.moveTo(x, topY);
      ctx.bezierCurveTo(x + r * 0.32, topY + tail * 0.38, x + r * 0.96, y - r * 0.72, x + r, y);
      ctx.arc(x, y, r, 0, Math.PI, false);
      ctx.bezierCurveTo(x - r * 0.96, y - r * 0.72, x - r * 0.32, topY + tail * 0.38, x, topY);
      ctx.closePath();
    }

    // A refractive droplet: inverted magnified background inside the lens,
    // dark rim, bright refracted floor, sharp specular.
    _paintDrop(ctx, x, y, r, elong) {
      const bg = this._bg;
      const tail = r * Math.max(0, elong - 1) * 2.4;
      const ry = r + tail;
      const cy = y - tail * 0.5;   // visual center of the whole drop

      // Contact shadow on the glass.
      ctx.fillStyle = 'rgba(8,12,18,0.18)';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.16, y + r * 0.2, r * 1.04, r * 1.04, 0, 0, TAU);
      ctx.fill();

      ctx.save();
      this._traceDrop(ctx, x, y, r, tail);
      ctx.clip();

      // Inverted, magnified world.
      const mag = 2.1;
      const sw = r * 2 * mag, sh = ry * 2 * mag;
      ctx.save();
      ctx.translate(x, cy);
      ctx.scale(1, -1);
      ctx.drawImage(bg, x - sw / 2, cy - sh / 2, sw, sh, -r, -ry, r * 2, ry * 2);
      ctx.restore();

      // The lens gathers light — a touch brighter than the pane.
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x - r, cy - ry, r * 2, ry * 2);

      // Dark rim where the surface curves away.
      const rim = ctx.createRadialGradient(x, cy, r * 0.5, x, cy, ry);
      rim.addColorStop(0,   'rgba(0,0,0,0)');
      rim.addColorStop(0.8, 'rgba(6,12,20,0.18)');
      rim.addColorStop(1,   'rgba(6,12,20,0.5)');
      ctx.fillStyle = rim;
      ctx.fillRect(x - r, cy - ry, r * 2, ry * 2);

      // Light pooling at the belly of the lens.
      const pool = ctx.createRadialGradient(x, y + r * 0.5, 0, x, y + r * 0.5, r * 0.8);
      pool.addColorStop(0, 'rgba(255,244,224,0.20)');
      pool.addColorStop(1, 'rgba(255,244,224,0)');
      ctx.fillStyle = pool;
      ctx.fillRect(x - r, cy - ry, r * 2, ry * 2);
      ctx.restore();

      // Specular glints, primary and faint counterpart.
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.34, y - r * 0.4, r * 0.16, r * 0.11, -0.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.3, y + r * 0.32, r * 0.09, r * 0.07, -0.6, 0, TAU);
      ctx.fill();
    }

    // ── Simulation ─────────────────────────────────────────────────────────

    _spawnRunner() {
      const w = this._cW, h = this._cH, u = this._u;
      this._runners.push({
        x: w * (0.05 + Math.random() * 0.9),
        y: h * (0.02 + Math.random() * 0.6),
        r: 1.6 * u,
        targetR: (4.2 + Math.random() * 2.2) * u,
        state: 'swell',
        swellDur: 1.2 + Math.random() * 1.8,
        swellT: 0,
        v: 0,
        wanderPh: Math.random() * TAU,
      });
    }

    _step(dt) {
      const u = this._u, h = this._cH, w = this._cW;

      // Drizzle beyond the glass.
      for (const s of this._rain) {
        s.y += s.sp * dt;
        if (s.y > h + s.len) {
          s.y = -s.len - Math.random() * h * 0.2;
          s.x = Math.random() * w;
        }
      }

      // Runners: swell in place, tear free, glide while mass lasts, stop.
      for (let i = this._runners.length - 1; i >= 0; i--) {
        const d = this._runners[i];

        if (d.state === 'swell') {
          d.swellT += dt;
          const p = Math.min(1, d.swellT / d.swellDur);
          d.r = 1.6 * u + (d.targetR - 1.6 * u) * p * p;
          if (p >= 1) d.state = 'slide';
          continue;
        }

        // Gravity scaled by how much water the drop still carries;
        // small drops cling to the glass and barely move.
        const gEff = 480 * u * Math.max(0, (d.r - 2.6 * u) / (4 * u));
        d.v += gEff * dt;
        d.v -= d.v * 2.4 * dt;                       // film drag
        const vmax = (55 + d.r * 15) * u;
        if (d.v > vmax) d.v = vmax;

        const dy = d.v * dt;
        d.y += dy;
        // The path bends gently around imperfections in the glass.
        d.x += Math.sin(d.y / (85 * u) + d.wanderPh) * dy * 0.16;

        // Mass loss: the glass keeps a little of the water as the drop slides.
        d.r -= 0.10 * u * dt + dy * 0.0045;

        // Out of water or off the pane: settle and become a resting drop.
        if (d.y > h + d.r * 2) {
          this._runners.splice(i, 1);
        } else if (d.r < 2.4 * u) {
          this._paintDrop(this._dropsCtx, d.x, d.y, Math.max(d.r, 1.8 * u), 1.15);
          this._runners.splice(i, 1);
        }
      }

      this._spawnIn -= dt * this.intensity;
      if (this._spawnIn <= 0 && this._runners.length < 8) {
        this._spawnRunner();
        this._spawnIn = 2.4 + Math.random() * 3.2;
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
          1 + Math.random() * 0.1
        );
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
      const ctx = this.ctx, u = this._u, t = this._t;
      ctx.drawImage(this._bg, 0, 0);

      // Aviation beacons blinking on the tallest towers.
      for (const b of this._beacons) {
        const a = Math.pow(0.5 + 0.5 * Math.sin(t * 1.3 + b.ph), 3);
        if (a < 0.04) continue;
        ctx.fillStyle = `rgba(255,64,58,${a * 0.22})`;
        ctx.beginPath(); ctx.arc(b.x, b.y, 7 * u, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,96,88,${a * 0.9})`;
        ctx.beginPath(); ctx.arc(b.x, b.y, 2 * u, 0, TAU); ctx.fill();
      }

      // Falling drizzle, outside — behind the mist so it stays soft.
      ctx.lineCap = 'round';
      for (const s of this._rain) {
        ctx.strokeStyle = `rgba(202,216,234,${s.a})`;
        ctx.lineWidth = s.wd;
        ctx.beginPath();
        ctx.moveTo(s.x + s.len * 0.1, s.y - s.len);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }

      ctx.drawImage(this._mist, 0, 0);
      ctx.drawImage(this._drops, 0, 0);

      for (const d of this._runners) {
        const vmax = (55 + d.r * 15) * u;
        const elong = d.state === 'slide' ? 1 + 0.5 * Math.min(1, d.v / vmax) : 1.02;
        this._paintDrop(ctx, d.x, d.y, d.r, elong);
      }
    }

    destroy() {
      this._runners.length = 0;
      this._bg = this._mist = this._drops = this._dropsCtx = this._rain = this._beacons = null;
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
