'use strict';

(function () {

  const TAU = Math.PI * 2;

  // ── Reference coordinate space (720 × 460) ───────────────────────────────
  // All drawing constants live here; a ctx transform scales them to fill any
  // actual canvas at render time.
  const W = 720, H = 460;

  const hubX = 175, hubY = 182, groundY = 352, FIELD_TOP = 298;
  const towerBandL = hubX - 34, towerBandR = hubX + 34;
  const towerBandT = FIELD_TOP - 2, towerBandB = groundY + 4;

  const BAND_COLORS = ['#E0574A','#EE9350','#F0D868','#7BC46E','#5FA0DE','#6E6ED0','#B478C8'];
  const bandH = (H - FIELD_TOP) / BAND_COLORS.length;

  // Cloud and bird defs match the reference (second cloud sp was cut off → 1.0)
  const CLOUD_DEFS = [
    { x: 120, y:  70, s: 1.10, sp: 1.4 },
    { x: 420, y:  50, s: 0.85, sp: 1.0 },
    { x: 600, y: 100, s: 0.95, sp: 1.6 },
    { x: 280, y: 100, s: 0.70, sp: 1.3 },
  ];

  const BIRD_DEFS = [
    { x: 150, y:  90, sp: 9, ph: 0.0 },
    { x: 200, y: 110, sp: 8, ph: 1.4 },
  ];

  // ── Flower field pre-generation ──────────────────────────────────────────
  // Exact replication of the reference seeding logic.
  function buildFlowers(subRows) {
    subRows = subRows || 3;
    const flowers = [];
    const n = BAND_COLORS.length;
    for (let b = 0; b < n; b++) {
      const yTop = FIELD_TOP + b * bandH;
      const depthFactor = b / (n - 1);
      const baseSize = 3 + depthFactor * 3;
      for (let sr = 0; sr < subRows; sr++) {
        const yBase = yTop + 3 + (bandH - 6) * ((sr + 0.5) / 3);
        for (let x = 8; x <= W - 4; x += 10 + depthFactor * 4) {
          const fx = x + (Math.random() - 0.5) * 6;
          const fy = yBase + (Math.random() - 0.5) * 4;
          if (fx >= towerBandL && fx <= towerBandR &&
              fy >= towerBandT && fy <= towerBandB) continue;
          flowers.push({
            x: fx, y: fy,
            col: BAND_COLORS[b],
            size: baseSize + Math.random() * 0.9,
            ph:  Math.random() * TAU,
            rot: Math.random() * TAU,
          });
        }
      }
    }
    flowers.sort((a, b) => a.y - b.y);
    return flowers;
  }

  // ── Theme class ──────────────────────────────────────────────────────────

  class WindmillRainbowFieldTheme {

    init(canvas, ctx, opts) {
      this.canvas  = canvas;
      this.ctx     = ctx || canvas.getContext('2d');
      this.speed   = (opts && opts.speed) || 1;
      const intMap = { low: 1, medium: 3, high: 5 };
      const subRows = intMap[(opts && opts.intensity) || 'medium'] || 3;
      this._t      = 0;   // main time (flower sway, birds, sun)
      this._sails  = 0;   // sail angle — frozen in reduced-motion
      this._lastTs = null;
      this._reducedMotion =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Deep-copy mutable state so restarts don't share positions
      this._clouds  = CLOUD_DEFS.map(c => Object.assign({}, c));
      this._birds   = BIRD_DEFS.map(b => Object.assign({}, b));
      this._flowers = buildFlowers(subRows);

      this._build(canvas.width, canvas.height);
    }

    resize(w, h) { this._build(w, h); }

    _build(cW, cH) {
      this._cW = cW;
      this._cH = cH;
      // Cover-scale: fill the canvas, keeping 720×460 proportions
      const sc = Math.max(cW / W, cH / H);
      this._scale = sc;
      this._ox = (cW - W * sc) / 2;
      this._oy = (cH - H * sc) / 2;
    }

    draw(ts) {
      // Compute dt; treat ts===0 as a static paint (engine reduced-motion call)
      let dt = 0;
      if (ts > 0 && this._lastTs !== null) {
        dt = Math.min((ts - this._lastTs) / 1000, 0.05) * (this.speed || 1);
      }
      if (ts > 0) this._lastTs = ts;

      const rm = this._reducedMotion;
      this._t += dt;
      if (!rm) {
        this._sails += dt * 0.5;
        for (const c of this._clouds) {
          c.x -= c.sp * dt;
          if (c.x < -90) c.x = W + 90;
        }
        for (const bd of this._birds) {
          bd.x -= bd.sp * dt;
          if (bd.x < -20) bd.x = W + 20;
        }
      }

      const ctx = this.ctx;
      ctx.save();
      ctx.translate(this._ox, this._oy);
      ctx.scale(this._scale, this._scale);
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      this._render(ctx, rm);
      ctx.restore();
    }

    _render(ctx, rm) {
      const t         = this._t;
      const swayScale = rm ? 0.5 : 1.0;

      // ── Sky ────────────────────────────────────────────────────────────
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0,    '#6FA0C8');
      sky.addColorStop(0.45, '#A8C8D8');
      sky.addColorStop(0.72, '#E8D8B0');
      sky.addColorStop(1,    '#D8C888');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // ── Sun ────────────────────────────────────────────────────────────
      const sg = ctx.createRadialGradient(560, 120, 10, 560, 120, 150);
      sg.addColorStop(0, 'rgba(255,240,200,0.5)');
      sg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(430, 10, 260, 260);
      ctx.fillStyle = 'rgba(255,248,220,0.85)';
      ctx.beginPath(); ctx.arc(560, 120, 32, 0, TAU); ctx.fill();

      // ── Clouds ─────────────────────────────────────────────────────────
      ctx.fillStyle = '#FDFDFB';
      for (const c of this._clouds) this._sharpCloud(ctx, c.x, c.y, c.s);

      // ── Birds ──────────────────────────────────────────────────────────
      for (const bd of this._birds) {
        const by = bd.y + Math.sin(t * 0.6 + bd.ph) * 4;
        const fw = Math.sin(t * 4   + bd.ph) * 3;
        ctx.strokeStyle = 'rgba(40,40,50,0.5)';
        ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bd.x - 8, by + fw);
        ctx.quadraticCurveTo(bd.x - 3, by - 2, bd.x,     by);
        ctx.quadraticCurveTo(bd.x + 3, by - 2, bd.x + 8, by + fw);
        ctx.stroke();
      }

      // ── Hills ──────────────────────────────────────────────────────────
      this._hillLayer(ctx, 280, 24, 160, '#B8C8A8');
      this._hillLayer(ctx, 295, 20, 110, '#9CBA84');

      // ── Field base ─────────────────────────────────────────────────────
      const fg = ctx.createLinearGradient(0, FIELD_TOP, 0, H);
      fg.addColorStop(0, '#84AE64');
      fg.addColorStop(1, '#5A8C42');
      ctx.fillStyle = fg;
      ctx.fillRect(0, FIELD_TOP, W, H - FIELD_TOP);

      // ── Flowers behind windmill ─────────────────────────────────────────
      for (const fl of this._flowers) {
        if (fl.y < groundY) this._drawFlower(ctx, fl, t, swayScale);
      }

      // ── Tower shadow ───────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.beginPath();
      ctx.ellipse(hubX + 30, groundY + 8, 90, 16, 0, 0, TAU);
      ctx.fill();

      // ── Tower body ─────────────────────────────────────────────────────
      const twG = ctx.createLinearGradient(hubX - 42, 0, hubX + 42, 0);
      twG.addColorStop(0,    '#F0E6CC');
      twG.addColorStop(0.55, '#DCCEA8');
      twG.addColorStop(1,    '#B8A480');
      ctx.fillStyle = twG;
      ctx.beginPath();
      ctx.moveTo(hubX - 30, groundY); ctx.lineTo(hubX - 20, hubY + 10);
      ctx.lineTo(hubX + 20, hubY + 10); ctx.lineTo(hubX + 30, groundY);
      ctx.closePath(); ctx.fill();

      // Horizontal banding
      ctx.strokeStyle = 'rgba(120,100,70,0.25)'; ctx.lineWidth = 1;
      for (let band = 0; band < 5; band++) {
        const by = groundY - band * 30;
        ctx.beginPath();
        ctx.moveTo(hubX - 30 + band * 2, by);
        ctx.lineTo(hubX + 30 - band * 2, by);
        ctx.stroke();
      }

      // Arched base
      ctx.fillStyle = '#5A4028';
      ctx.beginPath();
      ctx.moveTo(hubX - 9, groundY); ctx.lineTo(hubX - 9, groundY - 30);
      ctx.quadraticCurveTo(hubX, groundY - 40, hubX + 9, groundY - 30);
      ctx.lineTo(hubX + 9, groundY); ctx.closePath(); ctx.fill();

      // Windows
      ctx.fillStyle = 'rgba(120,150,170,0.7)';
      ctx.fillRect(hubX - 18, groundY -  90, 10, 12);
      ctx.fillRect(hubX +  8, groundY - 140, 10, 12);

      // ── Cap ────────────────────────────────────────────────────────────
      ctx.fillStyle = '#5A4A38';
      ctx.beginPath();
      ctx.moveTo(hubX - 24, hubY + 14);
      ctx.quadraticCurveTo(hubX - 26, hubY - 6,  hubX - 6, hubY - 22);
      ctx.quadraticCurveTo(hubX + 14, hubY - 30, hubX + 30, hubY - 6);
      ctx.quadraticCurveTo(hubX + 34, hubY + 10, hubX + 24, hubY + 14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(hubX - 20, hubY + 10);
      ctx.quadraticCurveTo(hubX - 18, hubY - 4,  hubX - 4, hubY - 16);
      ctx.lineTo(hubX + 2, hubY - 10);
      ctx.quadraticCurveTo(hubX - 10, hubY, hubX - 14, hubY + 12);
      ctx.closePath(); ctx.fill();

      // ── Sails ──────────────────────────────────────────────────────────
      ctx.save();
      ctx.translate(hubX + 2, hubY - 4);
      ctx.rotate(this._sails);
      for (let s = 0; s < 4; s++) {
        ctx.save(); ctx.rotate(s * (TAU / 4));
        const sailG = ctx.createLinearGradient(-8, 0, 8, 0);
        sailG.addColorStop(0,   '#C8B888');
        sailG.addColorStop(0.5, '#EDE0C0');
        sailG.addColorStop(1,   '#B8A67A');
        ctx.fillStyle = sailG;
        ctx.beginPath();
        ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
        ctx.lineTo(9, -104); ctx.lineTo(4, -122); ctx.lineTo(-4, -122); ctx.lineTo(-9, -104);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(90,70,45,0.4)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -118); ctx.stroke();
        ctx.strokeStyle = 'rgba(90,70,45,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
        ctx.lineTo(9, -104); ctx.lineTo(4, -122); ctx.lineTo(-4, -122); ctx.lineTo(-9, -104);
        ctx.closePath(); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#2E241A';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
      ctx.restore();

      // ── Foreground flowers (in front of tower base) ───────────────────
      for (const fl of this._flowers) {
        if (fl.y >= groundY) this._drawFlower(ctx, fl, t, swayScale);
      }
    }

    _hillLayer(ctx, base, amp, wl, col) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x / wl)));
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }

    _cloudBlobPath(ctx, cx, cy, scale, flatten, xStretch) {
      const baseR = 24 * scale;
      const ringR = baseR * 0.6, satR = baseR * 0.7;
      ctx.moveTo(cx + baseR, cy); ctx.arc(cx, cy, baseR, 0, TAU);
      for (let i = 0; i < 8; i++) {
        const ang = i * (TAU / 8);
        const sx  = cx + Math.cos(ang) * ringR * xStretch;
        const sy  = cy + Math.sin(ang) * ringR * flatten;
        ctx.moveTo(sx + satR, sy); ctx.arc(sx, sy, satR, 0, TAU);
      }
    }

    _sharpCloud(ctx, cx, cy, s) {
      ctx.beginPath();
      this._cloudBlobPath(ctx, cx, cy, s, 0.6, 1.25);
      ctx.fill();
    }

    _drawFlower(ctx, fl, t, swayScale) {
      const sway = Math.sin(t * 0.55 + fl.ph) * 1.4 * swayScale;
      ctx.save();
      ctx.translate(fl.x + sway, fl.y);
      ctx.rotate(fl.rot + Math.sin(t * 0.4 + fl.ph) * 0.06 * swayScale);
      for (let p = 0; p < 5; p++) {
        const pa = p * (TAU / 5);
        ctx.fillStyle = fl.col;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(pa) * fl.size * 0.62, Math.sin(pa) * fl.size * 0.62,
          fl.size * 0.62, fl.size * 0.34, pa, 0, TAU
        );
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(0.6) * fl.size * 0.5, Math.sin(0.6) * fl.size * 0.5,
        fl.size * 0.5, fl.size * 0.26, 0.6, 0, TAU
      );
      ctx.fill();
      ctx.fillStyle = '#F4E070';
      ctx.beginPath(); ctx.arc(0, 0, fl.size * 0.34, 0, TAU); ctx.fill();
      ctx.restore();
    }

    destroy() { /* no GPU resources */ }
  }

  // ── Standalone wrapper (index.html / windmill-preview.html) ─────────────

  let _inst = null, _raf = null, _boundResize = null, _boundVis = null;

  function _debounce(fn, ms) {
    let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
  }

  function init(canvas) {
    if (_inst) destroy();

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    function resize() {
      canvas.width  = Math.floor(window.innerWidth  * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;';
      if (_inst) _inst.resize(canvas.width, canvas.height);
    }
    resize();

    const ctx = canvas.getContext('2d');
    _inst = new WindmillRainbowFieldTheme();
    _inst.init(canvas, ctx, { speed: 1 });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function loop(ts) { _raf = requestAnimationFrame(loop); _inst.draw(ts); }

    _boundResize = _debounce(resize, 150);
    _boundVis    = () => {
      if (document.hidden) { cancelAnimationFrame(_raf); _raf = null; }
      else if (!_raf)      { _raf = requestAnimationFrame(loop); }
    };

    window.addEventListener('resize',           _boundResize);
    document.addEventListener('visibilitychange', _boundVis);

    if (reduced) { _inst.draw(0); }
    else         { _raf = requestAnimationFrame(loop); }
  }

  function destroy() {
    if (_raf)         { cancelAnimationFrame(_raf); _raf = null; }
    if (_inst)        { _inst.destroy(); _inst = null; }
    if (_boundResize) { window.removeEventListener('resize',            _boundResize); _boundResize = null; }
    if (_boundVis)    { document.removeEventListener('visibilitychange', _boundVis);   _boundVis    = null; }
  }

  window.WindmillRainbowFieldTheme = WindmillRainbowFieldTheme;
  window.WindmillRainbowField      = { init, destroy };

})();
