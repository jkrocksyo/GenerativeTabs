'use strict';

(function () {

  const W = 720, H = 380, TAU = Math.PI * 2, HZ = 250, RT = 284;
  const BLDS = [
    [10,70,40],[60,100,34],[104,55,50],[170,120,38],[218,80,30],
    [300,95,44],[354,60,36],[420,130,40],[470,75,32],[520,50,30],
  ];

  class NightCityDriveTheme {
    init(canvas, ctx, opts) {
      this.canvas   = canvas;
      this.ctx      = ctx || canvas.getContext('2d');
      this.speed    = (opts && opts.speed) || 1;
      this._t       = 0;
      this._lastTs  = null;
      this._cW      = canvas.width;
      this._cH      = canvas.height;
      this._puffs   = [];
      this._puffAcc = 0;
      this._stars   = [];
      const intMap = { low: 14, medium: 34, high: 54 };
      const starCount = intMap[(opts && opts.intensity) || 'medium'] || 34;
      for (let i = 0; i < starCount; i++)
        this._stars.push([Math.random() * W, Math.random() * 200, Math.random() * TAU]);
    }

    resize(w, h) {
      this._cW = w;
      this._cH = h;
    }

    draw(ts) {
      if (ts === 0) { this._frame(this._t); return; }
      const dt   = (this._lastTs != null) ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      const step = dt * this.speed;
      this._t   += step;

      // Spawn exhaust puff every 56 frames at 60fps (≈0.933 s)
      this._puffAcc += step;
      if (this._puffAcc >= 56 / 60) {
        this._puffAcc -= 56 / 60;
        this._puffs.push({ x: 252, y: 305, r: 2.5, a: 0.3 }); // cx-58 = 310-58
      }

      // Update puffs — per-frame increments scaled to real time
      const fs = step * 60;  // ≈1 at 60fps
      for (let p = this._puffs.length - 1; p >= 0; p--) {
        const pf = this._puffs[p];
        pf.x -= 0.5  * fs;
        pf.y -= 0.15 * fs;
        pf.r += 0.06 * fs;
        pf.a -= 0.004 * fs;
        if (pf.a <= 0) this._puffs.splice(p, 1);
      }

      this._frame(this._t);
    }

    _frame(t) {
      const ctx = this.ctx;
      const sc  = Math.max(this._cW / W, this._cH / H);
      const oX  = (this._cW - W * sc) / 2;
      const oY  = (this._cH - H * sc) / 2;

      ctx.save();
      ctx.translate(oX, oY);
      ctx.scale(sc, sc);

      // Sky
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0,   '#0A1230');
      g.addColorStop(0.7, '#16244A');
      g.addColorStop(1,   '#25355C');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Stars (twinkling)
      for (const st of this._stars) {
        const a = 0.2 + 0.4 * Math.abs(Math.sin(t * 1.2 + st[2]));
        ctx.fillStyle = `rgba(228,238,255,${a.toFixed(3)})`;
        ctx.fillRect(st[0], st[1], 1.5, 1.5);
      }

      // Horizon glow
      const hg = ctx.createLinearGradient(0, 205, 0, HZ);
      hg.addColorStop(0, 'rgba(255,190,120,0)');
      hg.addColorStop(1, 'rgba(255,190,120,0.12)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 205, W, HZ - 205);

      // City buildings (3 tiles, 560 px period)
      const o1 = (t * 5) % 560;
      this._city(ctx, -o1);
      this._city(ctx, 560 - o1);
      this._city(ctx, 1120 - o1);

      // Far hills
      this._bump(ctx, t * 14, 268, 22, 55, '#0B1228', RT);

      // Road
      ctx.fillStyle = '#0D1322';
      ctx.fillRect(0, 278, W, 6);
      ctx.fillStyle = '#141926';
      ctx.fillRect(0, RT, W, H - RT);
      ctx.fillStyle = 'rgba(255,220,170,0.08)';
      ctx.fillRect(0, RT, W, 2);

      // Road dashes
      ctx.fillStyle = 'rgba(240,220,170,0.35)';
      const dO = (t * 45) % 70;
      for (let dx = -dO; dx < W; dx += 70) ctx.fillRect(dx, 338, 26, 4);

      // Street lamps
      const o2 = (t * 45) % 380;
      this._lamp(ctx, 120 - o2);
      this._lamp(ctx, 500 - o2);
      this._lamp(ctx, 880 - o2);
      this._lamp(ctx,  12 - o2);

      // Car
      const cx = 310, cy = Math.sin(t * 3) * 0.8;

      // Exhaust puffs
      for (const pf of this._puffs) {
        ctx.fillStyle = `rgba(190,200,215,${pf.a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pf.x, pf.y + cy, pf.r, 0, TAU);
        ctx.fill();
      }

      // Headlight beam
      const bg = ctx.createLinearGradient(cx + 50, 0, cx + 165, 0);
      bg.addColorStop(0, 'rgba(255,236,190,0.28)');
      bg.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(cx + 50,  296 + cy); ctx.lineTo(cx + 50,  306 + cy);
      ctx.lineTo(cx + 165, 320 + cy); ctx.lineTo(cx + 165, 284 + cy);
      ctx.closePath();
      ctx.fill();

      // Car body (teal)
      ctx.fillStyle = '#5FA8A0';
      ctx.beginPath();
      ctx.moveTo(cx - 40, 296 + cy);
      ctx.lineTo(cx - 32, 279 + cy);
      ctx.lineTo(cx + 20, 279 + cy);
      ctx.lineTo(cx + 33, 296 + cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - 52, 294 + cy, 104, 16);
      ctx.beginPath();
      ctx.arc(cx - 52, 302 + cy, 8, 0, TAU);
      ctx.arc(cx + 52, 302 + cy, 8, 0, TAU);
      ctx.fill();

      // Windshield interior (dark)
      ctx.fillStyle = '#1B2740';
      ctx.beginPath();
      ctx.moveTo(cx - 29, 294 + cy);
      ctx.lineTo(cx - 23, 282 + cy);
      ctx.lineTo(cx + 17, 282 + cy);
      ctx.lineTo(cx + 27, 294 + cy);
      ctx.closePath();
      ctx.fill();

      // Window divider
      ctx.strokeStyle = '#5FA8A0';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 2, 281 + cy);
      ctx.lineTo(cx - 2, 295 + cy);
      ctx.stroke();

      // Headlight
      ctx.fillStyle = '#FFF0C0';
      ctx.fillRect(cx + 49, 297 + cy, 4, 6);

      // Taillight + glow
      ctx.fillStyle = '#FF5A5A';
      ctx.fillRect(cx - 54, 298 + cy, 3, 6);
      const rg = ctx.createRadialGradient(cx - 54, 301 + cy, 1, cx - 54, 301 + cy, 10);
      rg.addColorStop(0, 'rgba(255,90,90,0.4)');
      rg.addColorStop(1, 'rgba(255,90,90,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(cx - 64, 291 + cy, 20, 20);

      // Wheels
      const wa = t * 4.1;
      for (let w = 0; w < 2; w++) {
        const wx2 = cx + (w ? 34 : -30), wy = 316 + cy;
        ctx.fillStyle = '#0B0F1C';
        ctx.beginPath(); ctx.arc(wx2, wy, 11, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3A4458';
        ctx.beginPath(); ctx.arc(wx2, wy, 5, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(200,210,230,0.7)';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(wx2 + Math.cos(wa)        * 4.5, wy + Math.sin(wa)        * 4.5);
        ctx.lineTo(wx2 - Math.cos(wa)        * 4.5, wy - Math.sin(wa)        * 4.5);
        ctx.moveTo(wx2 + Math.cos(wa + 1.57) * 4.5, wy + Math.sin(wa + 1.57) * 4.5);
        ctx.lineTo(wx2 - Math.cos(wa + 1.57) * 4.5, wy - Math.sin(wa + 1.57) * 4.5);
        ctx.stroke();
      }

      ctx.restore();
    }

    _city(ctx, ox) {
      for (let b = 0; b < BLDS.length; b++) {
        const bd = BLDS[b], wx = bd[0] + ox;
        ctx.fillStyle = '#111B38';
        ctx.fillRect(wx, HZ - bd[1], bd[2], bd[1]);
        const cols = Math.floor((bd[2] - 8) / 9);
        const rows = Math.floor((bd[1] - 10) / 12);
        ctx.fillStyle = 'rgba(244,200,122,0.85)';
        for (let ci = 0; ci < cols; ci++)
          for (let rj = 0; rj < rows; rj++)
            if (((bd[0] + ci * 13 + rj * 7) % 7) < 3)
              ctx.fillRect(wx + 5 + ci * 9, HZ - bd[1] + 6 + rj * 12, 3, 4);
      }
    }

    _lamp(ctx, px) {
      ctx.fillStyle = '#0A0F1E';
      ctx.fillRect(px - 2, 180, 4, RT - 180);
      ctx.fillRect(px, 180, 26, 4);
      const lx = px + 26;

      const cg = ctx.createLinearGradient(0, 188, 0, RT + 6);
      cg.addColorStop(0, 'rgba(255,220,160,0.14)');
      cg.addColorStop(1, 'rgba(255,220,160,0.02)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(lx - 6,  188);    ctx.lineTo(lx + 6,  188);
      ctx.lineTo(lx + 36, RT + 6); ctx.lineTo(lx - 36, RT + 6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255,215,150,0.16)';
      ctx.beginPath();
      ctx.ellipse(lx, RT + 16, 54, 10, 0, 0, TAU);
      ctx.fill();

      const lg = ctx.createRadialGradient(lx, 186, 2, lx, 186, 24);
      lg.addColorStop(0, 'rgba(255,220,160,0.4)');
      lg.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(lx - 24, 162, 48, 48);

      ctx.fillStyle = '#FFD9A0';
      ctx.fillRect(lx - 5, 183, 10, 5);
    }

    _bump(ctx, off, base, amp, wl, col, toY) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, toY);
      for (let x = 0; x <= W; x += 8)
        ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + off) / wl)));
      ctx.lineTo(W, toY);
      ctx.closePath();
      ctx.fill();
    }

    destroy() {}
  }

  // ── Standalone API (used by preview HTML) ─────────────────────────────────────
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
    _inst = new NightCityDriveTheme();
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

  window.NightCityDriveTheme = NightCityDriveTheme;
  window.CityDrive = { init, destroy };
})();
