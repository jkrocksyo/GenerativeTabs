'use strict';

(function () {

  const W = 720, H = 380, TAU = Math.PI * 2;

  const CLOUD_DEFS = [
    { sp: 4, ph:   0, y:  70, rx: 52, ry: 8 },
    { sp: 3, ph: 380, y: 112, rx: 40, ry: 6 },
    { sp: 5, ph: 190, y:  88, rx: 46, ry: 7 },
  ];

  class HotAirBalloonTheme {
    init(canvas, ctx, opts) {
      this.canvas  = canvas;
      this.ctx     = ctx || canvas.getContext('2d');
      this.speed   = (opts && opts.speed) || 1;
      const intMap = { low: 1, medium: 3, high: 5 };
      this._birdCount  = intMap[(opts && opts.intensity) || 'medium'] || 3;
      this._cloudCount = { low: 1, medium: 2, high: 3 }[(opts && opts.intensity) || 'medium'] || 2;
      this._t      = 0;
      this._lastTs = null;
      this._cW     = canvas.width;
      this._cH     = canvas.height;
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
      const ctx = this.ctx;
      const sc  = Math.max(this._cW / W, this._cH / H);
      const oX  = (this._cW - W * sc) / 2;
      const oY  = (this._cH - H * sc) / 2;

      ctx.save();
      ctx.translate(oX, oY);
      ctx.scale(sc, sc);

      // Sky
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0,    '#AFC3E3');
      g.addColorStop(0.5,  '#F2CFAF');
      g.addColorStop(0.78, '#F5AE84');
      g.addColorStop(1,    '#F1A177');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Sun glow
      const sg = ctx.createRadialGradient(170, 238, 6, 170, 238, 85);
      sg.addColorStop(0, 'rgba(255,231,194,0.65)');
      sg.addColorStop(1, 'rgba(255,231,194,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(80, 150, 180, 180);

      // Sun disk
      ctx.fillStyle = '#FFE7C2';
      ctx.beginPath();
      ctx.arc(170, 238, 26, 0, TAU);
      ctx.fill();

      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let ci = 0; ci < this._cloudCount; ci++) {
        const cd = CLOUD_DEFS[ci];
        const wx = W + 90 - ((t * cd.sp + cd.ph) % (W + 180));
        ctx.beginPath(); ctx.ellipse(wx, cd.y, cd.rx, cd.ry, 0, 0, TAU); ctx.fill();
      }

      // Birds
      ctx.strokeStyle = '#7A5B54';
      ctx.lineWidth   = 1.8;
      ctx.lineCap     = 'round';
      for (let i2 = 0; i2 < this._birdCount; i2++) {
        const bx = W + 60 - ((t * 16 + i2 * 250) % (W + 120));
        const by = 205 + i2 * 11 + Math.sin(t * 1.1 + i2) * 3;
        const glide = Math.min(1, Math.max(0, (Math.sin(t * 0.31 + i2 * 2.2) - 0.55) * 4));
        this._bird(ctx, bx, by, 7, t * 8 + i2 * 2.1, glide);
      }

      // Small background balloon
      const mx = (W + 70) - ((t * 6 + 200) % (W + 140));
      const my = 120 + Math.sin(t * 0.3) * 4;
      ctx.fillStyle = '#7FB3C8';
      ctx.beginPath(); ctx.ellipse(mx, my, 10, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6E4A33';
      ctx.fillRect(mx - 2.5, my + 15, 5, 4);
      ctx.strokeStyle = 'rgba(110,74,51,0.7)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(mx - 8, my + 7); ctx.lineTo(mx - 2.5, my + 15);
      ctx.moveTo(mx + 8, my + 7); ctx.lineTo(mx + 2.5, my + 15);
      ctx.stroke();

      // Hills (3 parallax layers)
      this._bump(ctx, t * 3,       250, 14, 130, '#E9B896');
      this._bump(ctx, t * 5 + 180, 262, 20,  90, '#D89678');
      this._bump(ctx, t * 8 + 340, 280, 26,  70, '#B97C66');

      // Meadow
      ctx.fillStyle = '#7E9161';
      ctx.fillRect(0, 296, W, H - 296);

      // Rolling field path (beige wave + white highlight)
      const o8 = t * 8;
      ctx.strokeStyle = '#EED2A4';
      ctx.lineWidth   = 9;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      for (let rx = 0; rx <= W; rx += 10) ctx.lineTo(rx, 320 + Math.sin((rx + o8) / 85) * 13);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      for (let rx2 = 0; rx2 <= W; rx2 += 10) ctx.lineTo(rx2, 320 + Math.sin((rx2 + o8) / 85) * 13);
      ctx.stroke();

      // Ground details (tiling at 300 px)
      const o9  = (t * 8) % 300;
      const tps = [40, 120, 210, 260];
      const tss = [4, 3, 5, 3];
      for (let k = -1; k < 4; k++) {
        const gx = k * 300 - o9;
        for (let tr = 0; tr < 4; tr++) {
          const tx = tps[tr] + gx;
          ctx.strokeStyle = '#4E5C3A';
          ctx.lineWidth   = 1.5;
          ctx.beginPath(); ctx.moveTo(tx, 352); ctx.lineTo(tx, 346); ctx.stroke();
          ctx.fillStyle = '#5C6E44';
          ctx.beginPath(); ctx.arc(tx, 344, tss[tr], 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#B9927A';
        ctx.fillRect(gx + 170, 300, 10, 8);
        ctx.fillStyle = '#8A5F4C';
        ctx.beginPath();
        ctx.moveTo(gx + 168, 300);
        ctx.lineTo(gx + 175, 294);
        ctx.lineTo(gx + 182, 300);
        ctx.closePath();
        ctx.fill();
      }

      // Main balloon (bobs + rocks gently)
      const bobY = Math.sin(t * 0.35) * 8;
      const rot2 = Math.sin(t * 0.28) * 0.03;
      ctx.save();
      ctx.translate(430, 150 + bobY);
      ctx.rotate(rot2);

      // Envelope: striped ellipse (clip-masked)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, -28, 46, 52, 0, 0, TAU);
      ctx.clip();
      const gc = ['#E2574C', '#F2C14E', '#7FB3C8', '#F4E3CE'];
      for (let s2 = 0; s2 < 7; s2++) {
        ctx.fillStyle = gc[s2 % 4];
        ctx.fillRect(-49 + s2 * 14, -84, 14, 116);
      }
      ctx.restore();

      // Skirt
      ctx.fillStyle = '#E2574C';
      ctx.beginPath();
      ctx.moveTo(-14, 18); ctx.lineTo(14, 18);
      ctx.lineTo(8, 34);   ctx.lineTo(-8, 34);
      ctx.closePath();
      ctx.fill();

      // Burner flame (intermittent, driven by two incommensurate sines)
      if (Math.sin(t * 9) + Math.sin(t * 23) > 1.2) {
        const fg = ctx.createRadialGradient(0, 42, 1, 0, 42, 14);
        fg.addColorStop(0, 'rgba(255,200,94,0.5)');
        fg.addColorStop(1, 'rgba(255,200,94,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(-14, 28, 28, 28);
        ctx.fillStyle = '#FFC85E';
        ctx.beginPath();
        ctx.moveTo(-3, 50); ctx.lineTo(3, 50); ctx.lineTo(0, 40);
        ctx.closePath();
        ctx.fill();
      }

      // Ropes
      ctx.strokeStyle = '#6E4A33';
      ctx.lineWidth   = 1.2;
      ctx.beginPath();
      ctx.moveTo(-8, 34); ctx.lineTo(-9, 52);
      ctx.moveTo(-3, 35); ctx.lineTo(-3, 52);
      ctx.moveTo( 3, 35); ctx.lineTo( 3, 52);
      ctx.moveTo( 8, 34); ctx.lineTo( 9, 52);
      ctx.stroke();

      // Basket
      ctx.fillStyle = '#8A5A38';
      ctx.fillRect(-11, 52, 22, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(-11, 57, 22, 2);
      ctx.fillRect(-11, 62, 22, 2);

      // Passengers
      ctx.fillStyle = '#4A3428';
      ctx.beginPath(); ctx.arc(-4, 50, 2.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#C0504D';
      ctx.beginPath(); ctx.arc( 4, 50, 2.5, 0, TAU); ctx.fill();

      ctx.restore();  // balloon translate/rotate
      ctx.restore();  // scene scale/translate
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

    _bump(ctx, off, base, amp, wl, col) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8)
        ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + off) / wl)));
      ctx.lineTo(W, H);
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
    _inst = new HotAirBalloonTheme();
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

  window.HotAirBalloonTheme = HotAirBalloonTheme;
  window.HotAirBalloon = { init, destroy };
})();
