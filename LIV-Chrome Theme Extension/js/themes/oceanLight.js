'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Ocean Light — looking up through deep open water. Volumetric shafts of
  // sunlight swing slowly from an unseen surface, drifting motes catch fire
  // as they cross the beams, and a band of caustic light plays just under
  // the surface. Everything is soft: the shafts are one blurred sprite
  // stretched into place, the caustics render at low resolution and
  // upscale, and the motes are the only sharp thing in frame — the way a
  // beam makes dust the sharpest thing in a dark room.
  class OceanLightTheme {
    init(canvas, ctx, opts) {
      this.canvas    = canvas;
      this.ctx       = ctx || canvas.getContext('2d');
      this.speed     = (opts && opts.speed) || 1;
      this.intensity = (opts && opts.intensity) || 1;
      this._t        = rand(0, 300);
      this._lastTs   = null;
      this._build(canvas.width, canvas.height);
    }

    resize(w, h) { this._build(w, h); }

    _build(w, h) {
      this._cW = w;
      this._cH = h;
      this._u  = Math.max(0.6, Math.min(2.4, Math.min(w, h) / 900));
      this._buildBackdrop();
      this._buildRaySprite();
      this._buildRays();
      this._buildCaustics();
      this._buildMotes();
      this._bubbles = [];
      this._bubbleIn = rand(4, 10);
    }

    _buildBackdrop() {
      const w = this._cW, h = this._cH;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const c = bg.getContext('2d');

      const sea = c.createLinearGradient(0, 0, 0, h);
      sea.addColorStop(0,    '#0d3a55');
      sea.addColorStop(0.28, '#082b42');
      sea.addColorStop(0.62, '#04182a');
      sea.addColorStop(1,    '#010a14');
      c.fillStyle = sea;
      c.fillRect(0, 0, w, h);

      // Large-scale unevenness — open water is never a clean gradient.
      for (let i = 0; i < 9; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = h * rand(0.18, 0.34);
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, Math.random() < 0.5 ? 'rgba(2,8,16,0.14)' : 'rgba(20,70,100,0.08)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }

      // Bright ceiling where the surface would be.
      const top = c.createLinearGradient(0, 0, 0, h * 0.2);
      top.addColorStop(0, 'rgba(130,200,225,0.22)');
      top.addColorStop(1, 'rgba(130,200,225,0)');
      c.fillStyle = top;
      c.fillRect(0, 0, w, h * 0.2);

      const vg = c.createRadialGradient(w / 2, h * 0.35, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(0,4,10,0)');
      vg.addColorStop(1, 'rgba(0,4,10,0.5)');
      c.fillStyle = vg;
      c.fillRect(0, 0, w, h);

      this._bg = bg;
    }

    _buildRaySprite() {
      // Gaussian lateral profile × vertical fade, baked once and stretched
      // per ray so every shaft shares the same soft falloff.
      const s = document.createElement('canvas');
      s.width = 64; s.height = 256;
      const c = s.getContext('2d');
      const gx = c.createLinearGradient(0, 0, 64, 0);
      gx.addColorStop(0,    'rgba(150,215,235,0)');
      gx.addColorStop(0.28, 'rgba(150,215,235,0.35)');
      gx.addColorStop(0.5,  'rgba(170,225,240,1)');
      gx.addColorStop(0.72, 'rgba(150,215,235,0.35)');
      gx.addColorStop(1,    'rgba(150,215,235,0)');
      c.fillStyle = gx;
      c.fillRect(0, 0, 64, 256);
      const gy = c.createLinearGradient(0, 0, 0, 256);
      gy.addColorStop(0,    'rgba(0,0,0,1)');
      gy.addColorStop(0.55, 'rgba(0,0,0,0.45)');
      gy.addColorStop(0.9,  'rgba(0,0,0,0)');
      c.globalCompositeOperation = 'destination-in';
      c.fillStyle = gy;
      c.fillRect(0, 0, 64, 256);
      this._raySprite = s;
    }

    _buildRays() {
      const w = this._cW;
      this._rays = [];
      const n = 6;
      for (let i = 0; i < n; i++) {
        this._rays.push({
          x:   w * (0.06 + (i + rand(0.1, 0.9)) / n * 0.92),
          w:   rand(0.05, 0.14) * w,
          a:   rand(0.10, 0.26),
          ph:  rand(0, TAU),
          sp:  rand(0.10, 0.22),
          len: rand(0.72, 1.0),
        });
      }
      // The shafts render small and upscale — blur for free.
      const rw = Math.max(2, Math.ceil(this._cW / 3));
      const rh = Math.max(2, Math.ceil(this._cH / 3));
      const buf = document.createElement('canvas');
      buf.width = rw; buf.height = rh;
      this._rayBuf = buf;
      this._rayCtx = buf.getContext('2d');
    }

    _buildCaustics() {
      const cw = Math.max(2, Math.ceil(this._cW / 4));
      const ch = Math.max(2, Math.ceil(this._cH * 0.16 / 4));
      const buf = document.createElement('canvas');
      buf.width = cw; buf.height = ch;
      this._caus = buf;
      this._causCtx = buf.getContext('2d');
    }

    _buildMotes() {
      const w = this._cW, h = this._cH, u = this._u;
      this._motes = [];
      const n = Math.round(85 * Math.min(1.4, this.intensity));
      for (let i = 0; i < n; i++) {
        const depth = Math.random();          // 0 near, 1 far
        this._motes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: (0.5 + (1 - depth) * 1.6) * u,
          depth,
          vx: rand(-4, -10) * (1 - depth * 0.6) * u,
          vy: rand(-1.5, 1.5) * u,
          ph: rand(0, TAU),
          sp: rand(0.3, 0.9),
        });
      }
    }

    // Global swing of the light direction — the whole fan of shafts leans
    // together like light through moving surface water.
    _slope(t) { return 0.16 + 0.07 * Math.sin(t * 0.045); }

    // How lit a point is: sum of Gaussian falloffs from each shaft's centre
    // line. Motes sample this so they flare exactly where the beams are.
    _light(x, y, t) {
      const slope = this._slope(t);
      let sum = 0;
      for (const r of this._rays) {
        const cx = r.x + y * slope;
        const halfW = r.w * (0.5 + y / this._cH * 0.7);
        const d = (x - cx) / halfW;
        if (d > -2 && d < 2) {
          const breathe = 0.6 + 0.4 * Math.sin(t * r.sp + r.ph);
          sum += Math.exp(-d * d * 2.2) * r.a * breathe * (1 - y / (this._cH * r.len * 1.15));
        }
      }
      return Math.max(0, sum);
    }

    _renderRays(t) {
      const c = this._rayCtx;
      const bw = this._rayBuf.width, bh = this._rayBuf.height;
      const slope = this._slope(t);
      const ang = Math.atan(slope);
      c.clearRect(0, 0, bw, bh);
      c.globalCompositeOperation = 'lighter';
      for (const r of this._rays) {
        const breathe = 0.6 + 0.4 * Math.sin(t * r.sp + r.ph);
        c.globalAlpha = r.a * breathe * Math.min(1.2, this.intensity);
        c.save();
        c.translate(r.x / 3, 0);
        c.rotate(ang);
        const w2 = r.w / 3;
        c.drawImage(this._raySprite, -w2 / 2, -bh * 0.05, w2, bh * r.len * 1.1);
        c.restore();
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }

    _renderCaustics(t) {
      const c = this._causCtx;
      const cw = this._caus.width, ch = this._caus.height;
      c.clearRect(0, 0, cw, ch);
      // Two interfering wave trains, squared for contrast — the classic
      // shape of light focused by ripples, without drawing any ripples.
      for (let x = 0; x < cw; x += 2) {
        const nx = x / cw;
        const v1 = Math.sin(nx * 46 + t * 0.9) + Math.sin(nx * 29 - t * 0.62 + 1.7);
        const v2 = Math.sin(nx * 71 - t * 1.15 + 3.1);
        const b = Math.pow(Math.max(0, (v1 * 0.6 + v2 * 0.4) * 0.5 + 0.35), 2.4);
        if (b < 0.02) continue;
        const g = c.createLinearGradient(0, 0, 0, ch);
        g.addColorStop(0, `rgba(180,235,250,${0.5 * b})`);
        g.addColorStop(1, 'rgba(180,235,250,0)');
        c.fillStyle = g;
        c.fillRect(x, 0, 2, ch);
      }
    }

    _step(dt) {
      const w = this._cW, h = this._cH, u = this._u, t = this._t;

      for (const m of this._motes) {
        // A slow current pushes everything left; each mote sways on its own.
        m.x += (m.vx + Math.sin(t * m.sp + m.ph) * 2 * u) * dt;
        m.y += (m.vy + Math.cos(t * m.sp * 0.7 + m.ph) * 1.2 * u) * dt;
        if (m.x < -10) m.x = w + 10;
        if (m.x > w + 10) m.x = -10;
        if (m.y < -10) m.y = h + 10;
        if (m.y > h + 10) m.y = -10;
      }

      this._bubbleIn -= dt;
      if (this._bubbleIn <= 0) {
        const bx = rand(w * 0.15, w * 0.85);
        const n = 3 + Math.floor(rand(0, 4));
        for (let i = 0; i < n; i++) {
          this._bubbles.push({
            x: bx + rand(-14, 14) * u,
            y: h + rand(0, 60) * u + i * 26 * u,
            r: rand(1.2, 3.2) * u,
            vy: rand(34, 55) * u,
            ph: rand(0, TAU),
            sp: rand(1.5, 3),
          });
        }
        this._bubbleIn = rand(7, 16);
      }
      for (let i = this._bubbles.length - 1; i >= 0; i--) {
        const b = this._bubbles[i];
        b.y -= b.vy * dt;
        b.vy *= 1 + dt * 0.06;              // bubbles accelerate as they rise
        if (b.y < h * 0.06) this._bubbles.splice(i, 1);
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
      const ctx = this.ctx, t = this._t;
      const w = this._cW, h = this._cH;

      ctx.drawImage(this._bg, 0, 0);

      this._renderCaustics(t);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.55;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this._caus, 0, 0, w, h * 0.16);
      ctx.restore();

      this._renderRays(t);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this._rayBuf, 0, 0, w, h);
      ctx.restore();

      // Motes — dim in shadow, flaring where the shafts cross them.
      for (const m of this._motes) {
        const lit = this._light(m.x, m.y, t);
        const a = 0.05 + (1 - m.depth) * 0.06 + Math.min(0.6, lit * 2.4);
        ctx.fillStyle = `rgba(205,235,245,${a})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
      }

      for (const b of this._bubbles) {
        const x = b.x + Math.sin(t * b.sp + b.ph) * 4 * this._u;
        const lit = this._light(x, b.y, t);
        const a = 0.10 + Math.min(0.4, lit * 1.8);
        ctx.strokeStyle = `rgba(200,235,250,${a})`;
        ctx.lineWidth = Math.max(0.8, 0.9 * this._u);
        ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, TAU); ctx.stroke();
        // a pinpoint of surface light on the upper rim
        ctx.fillStyle = `rgba(230,250,255,${a * 0.9})`;
        ctx.beginPath(); ctx.arc(x - b.r * 0.3, b.y - b.r * 0.4, b.r * 0.28, 0, TAU); ctx.fill();
      }
    }

    destroy() {
      this._bg = this._raySprite = this._rayBuf = this._rayCtx = null;
      this._caus = this._causCtx = null;
      this._rays = this._motes = this._bubbles = null;
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
    _inst = new OceanLightTheme();
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

  window.OceanLightTheme = OceanLightTheme;
  window.OceanLight = { init, destroy };
})();
