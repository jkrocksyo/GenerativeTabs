'use strict';

(function () {

  const W = 720, H = 380, TAU = Math.PI * 2, RT = 306, patW = 480;

  class SunsetBikeRideTheme {
    init(canvas, ctx, opts) {
      this.canvas = canvas;
      this.ctx    = ctx || canvas.getContext('2d');
      this.speed  = (opts && opts.speed) || 1;
      this._t     = 0;
      this._lastTs = null;
      this._cW    = canvas.width;
      this._cH    = canvas.height;
    }

    resize(w, h) {
      this._cW = w;
      this._cH = h;
    }

    draw(ts) {
      if (ts === 0) { this._frame(this._t); return; }
      const dt = (this._lastTs != null) ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      this._t += dt * this.speed;
      this._frame(this._t);
    }

    _frame(t) {
      const ctx  = this.ctx;
      const sc   = Math.max(this._cW / W, this._cH / H);
      const offX = (this._cW - W * sc) / 2;
      const offY = (this._cH - H * sc) / 2;

      ctx.save();
      ctx.translate(offX, offY);
      ctx.scale(sc, sc);

      // Sky
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0,    '#4E3466');
      g.addColorStop(0.42, '#B75C7F');
      g.addColorStop(0.72, '#EE8A5F');
      g.addColorStop(1,    '#F8BE79');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Sun glow
      const sg = ctx.createRadialGradient(515, 172, 10, 515, 172, 95);
      sg.addColorStop(0, 'rgba(255,226,170,0.55)');
      sg.addColorStop(1, 'rgba(255,226,170,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(410, 70, 210, 205);

      // Sun disk
      ctx.fillStyle = '#FFE7BC';
      ctx.beginPath();
      ctx.arc(515, 172, 32, 0, TAU);
      ctx.fill();

      // Clouds
      ctx.fillStyle = 'rgba(255,214,190,0.4)';
      const cl = [[4, 84, 68, 11, 0], [6, 126, 48, 8, 320], [5, 58, 40, 7, 640]];
      for (let c = 0; c < 3; c++) {
        const cd = cl[c];
        const cx = W + 150 - ((t * cd[0] + cd[4]) % (W + 300));
        ctx.beginPath();
        ctx.ellipse(cx, cd[1], cd[2], cd[3], 0, 0, TAU);
        ctx.fill();
      }

      // Birds
      ctx.strokeStyle = '#2E2143';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      for (let i = 0; i < 3; i++) {
        const bx = W + 70 - ((t * 22 + i * 270) % (W + 140));
        const by = 96 + i * 22 + Math.sin(t * 1.3 + i) * 5;
        const f  = Math.sin(t * 7 + i * 2) * 3.5;
        ctx.beginPath();
        ctx.moveTo(bx - 7, by);
        ctx.quadraticCurveTo(bx - 3, by - 4 - f, bx,     by);
        ctx.quadraticCurveTo(bx + 3, by - 4 - f, bx + 7, by);
        ctx.stroke();
      }

      // Far hills, mid hills
      this._hills(ctx, t * 9,        262, 42, 112, '#7A527E');
      this._hills(ctx, t * 22 + 300, 288, 46,  76, '#4E3760');

      // Trees + bushes (tiled, scrolling)
      const o = (t * 70) % patW;
      for (let k = -1; k < 3; k++) {
        const px = k * patW - o;
        this._tree(ctx, 70  + px);
        this._tree(ctx, 292 + px);
        this._bush(ctx, 180 + px, 11);
        this._bush(ctx, 424 + px,  9);
      }

      // Road
      ctx.fillStyle = '#3A2A52';
      ctx.fillRect(0, RT - 8, W, 8);
      ctx.fillStyle = '#2B2144';
      ctx.fillRect(0, RT, W, H - RT);
      ctx.fillStyle = 'rgba(248,190,121,0.22)';
      ctx.fillRect(0, RT, W, 2);

      // Road dashes
      ctx.fillStyle = 'rgba(255,220,180,0.4)';
      const dO = (t * 230) % 64;
      for (let dx = -dO; dx < W; dx += 64) ctx.fillRect(dx, 342, 30, 4);

      // Bicycle + rider
      this._bike(ctx, t);

      ctx.restore();
    }

    _hills(ctx, off, base, amp, wl, col) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, RT + 1);
      for (let x = 0; x <= W; x += 8)
        ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + off) / wl)));
      ctx.lineTo(W, RT + 1);
      ctx.closePath();
      ctx.fill();
    }

    _tree(ctx, x) {
      ctx.fillStyle = '#2A1C42';
      ctx.fillRect(x - 3, RT - 58, 6, 58);
      ctx.beginPath();
      ctx.arc(x,      RT - 62, 20, 0, TAU);
      ctx.arc(x - 13, RT - 50, 13, 0, TAU);
      ctx.arc(x + 13, RT - 50, 13, 0, TAU);
      ctx.fill();
    }

    _bush(ctx, x, r) {
      ctx.fillStyle = '#2A1C42';
      ctx.beginPath();
      ctx.arc(x, RT - r + 2, r, 0, TAU);
      ctx.fill();
    }

    _wheel(ctx, x, aY, wr, an, col) {
      ctx.strokeStyle = col;
      ctx.lineWidth   = 4.5;
      ctx.beginPath();
      ctx.arc(x, aY, wr, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(248,190,121,0.45)';
      ctx.lineWidth   = 1.5;
      for (let s = 0; s < 3; s++) {
        const a = an + s * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * (wr - 3), aY + Math.sin(a) * (wr - 3));
        ctx.lineTo(x - Math.cos(a) * (wr - 3), aY - Math.sin(a) * (wr - 3));
        ctx.stroke();
      }

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, aY, 3, 0, TAU);
      ctx.fill();
    }

    _bike(ctx, t) {
      const col = '#191026';
      const raX = 232, frX = 296, aY = 322, wr = 19, CKx = 258, CKy = 318;
      const an = t * 7;

      this._wheel(ctx, raX, aY, wr, an, col);
      this._wheel(ctx, frX, aY, wr, an, col);

      // Frame
      ctx.strokeStyle = col;
      ctx.lineWidth   = 4;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(raX, aY);  ctx.lineTo(CKx, CKy);
      ctx.moveTo(CKx, CKy); ctx.lineTo(246, 290);
      ctx.moveTo(raX, aY);  ctx.lineTo(246, 290);
      ctx.moveTo(CKx, CKy); ctx.lineTo(288, 296);
      ctx.moveTo(288, 296); ctx.lineTo(frX, aY);
      ctx.moveTo(288, 296); ctx.lineTo(282, 286);
      ctx.moveTo(282, 286); ctx.lineTo(292, 284);
      ctx.stroke();

      // Seat
      ctx.fillStyle = col;
      ctx.fillRect(238, 286, 17, 5);

      // Pedal arms
      const pa = t * 7;
      const p1 = [CKx + Math.cos(pa) * 11, CKy + Math.sin(pa) * 11];
      const p2 = [CKx - Math.cos(pa) * 11, CKy - Math.sin(pa) * 11];
      const hip = [247, 288];
      const sh  = [272, 268];

      // Back leg (darker)
      ctx.strokeStyle = '#241736';
      ctx.lineWidth   = 6;
      ctx.beginPath();
      ctx.moveTo(hip[0], hip[1]);
      ctx.quadraticCurveTo(hip[0] + 15, (hip[1] + p2[1]) / 2, p2[0], p2[1]);
      ctx.stroke();

      // Torso
      ctx.strokeStyle = col;
      ctx.lineWidth   = 7;
      ctx.beginPath();
      ctx.moveTo(hip[0], hip[1]);
      ctx.lineTo(sh[0], sh[1]);
      ctx.stroke();

      // Front leg
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(hip[0], hip[1]);
      ctx.quadraticCurveTo(hip[0] + 15, (hip[1] + p1[1]) / 2, p1[0], p1[1]);
      ctx.stroke();

      // Arm
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(sh[0], sh[1]);
      ctx.lineTo(290, 285);
      ctx.stroke();

      // Head
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(279, 261, 8, 0, TAU);
      ctx.fill();

      // Pedals
      ctx.strokeStyle = col;
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.moveTo(p1[0] - 5, p1[1]); ctx.lineTo(p1[0] + 5, p1[1]);
      ctx.moveTo(p2[0] - 5, p2[1]); ctx.lineTo(p2[0] + 5, p2[1]);
      ctx.stroke();
    }

    destroy() {}
  }

  // ── Standalone API (used by preview index.html) ───────────────────────────────
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
    _inst = new SunsetBikeRideTheme();
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

  window.SunsetBikeRideTheme = SunsetBikeRideTheme;
  window.BikeRide = { init, destroy };
})();
