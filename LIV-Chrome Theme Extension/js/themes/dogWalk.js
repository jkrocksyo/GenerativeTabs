'use strict';

(function () {

  const W = 720, H = 380, TAU = Math.PI * 2, GT = 298, patW = 520, patW2 = 420;
  const LC  = ['#C46A3C', '#D9973F', '#A8532F', '#8F5B2E'];
  const LV  = [[30,322],[90,338],[160,328],[210,342],[280,320],[330,334],[390,326]];

  class AutumnDogWalkTheme {
    init(canvas, ctx, opts) {
      this.canvas  = canvas;
      this.ctx     = ctx || canvas.getContext('2d');
      this.speed   = (opts && opts.speed) || 1;
      const intMap = { low: 10, medium: 24, high: 40 };
      this._leafCount = intMap[(opts && opts.intensity) || 'medium'] || 24;
      this._t      = 0;
      this._lastTs = null;
      this._cW     = canvas.width;
      this._cH     = canvas.height;
      this._initLeaves();
    }

    _initLeaves() {
      this._fall = [];
      for (let i = 0; i < this._leafCount; i++) {
        this._fall.push({
          x:   Math.random() * (W + 100) - 20,
          y:   Math.random() * H,
          vy:  0.6 + Math.random() * 0.7,
          ph:  Math.random() * TAU,
          rot: Math.random() * TAU,
          rs:  (Math.random() - 0.5) * 0.08,
          c:   LC[i % 4],
        });
      }
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
      this._updateLeaves(step);
      this._frame(this._t);
    }

    _updateLeaves(step) {
      const t  = this._t;
      const fs = step * 60;  // ≈1 at 60fps; scales per-frame increments to real time
      for (const fl of this._fall) {
        fl.y   += fl.vy * fs;
        fl.x   += (-0.5 + Math.sin(t * 1.6 + fl.ph) * 0.9) * fs;
        fl.rot += fl.rs * fs;
        if (fl.y > 346) {
          fl.y = -10;
          fl.x = Math.random() * (W + 100) - 20;
        }
      }
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
      g.addColorStop(0, '#EFDCB4');
      g.addColorStop(1, '#F7EAD0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Sun glow
      const sg = ctx.createRadialGradient(560, 104, 6, 560, 104, 70);
      sg.addColorStop(0, 'rgba(255,255,255,0.55)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(480, 30, 160, 150);

      // Far hill
      this._bump(ctx, t * 8, 252, 24, 72, '#C9B27E');

      // Scrolling trees
      const o = (t * 40) % patW;
      for (let k = -1; k < 3; k++) {
        const ox = k * patW - o;
        this._tree(ctx, 80  + ox, 1);
        this._tree(ctx, 250 + ox, 0.8);
        this._tree(ctx, 420 + ox, 1.1);
      }

      // Ground layers
      ctx.fillStyle = '#C2A968';
      ctx.fillRect(0, GT, W, H - GT);
      ctx.fillStyle = '#CBA878';
      ctx.fillRect(0, 316, W, 32);
      ctx.fillStyle = 'rgba(120,90,55,0.25)';
      ctx.fillRect(0, 316, W, 2);
      ctx.fillRect(0, 346, W, 2);

      // Ground leaves (scrolling)
      const o2 = (t * 84) % patW2;
      for (let k2 = -1; k2 < 3; k2++) {
        for (let li = 0; li < LV.length; li++) {
          const lx = LV[li][0] + k2 * patW2 - o2;
          if (lx > -20 && lx < W + 20) {
            ctx.save();
            ctx.translate(lx, LV[li][1]);
            ctx.rotate(li * 0.9);
            ctx.fillStyle = LC[li % 4];
            ctx.beginPath();
            ctx.ellipse(0, 0, 5, 2.4, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // Dog
      const dp  = t * 8, dx0 = 308, dby = 326 + Math.sin(dp * 2);
      ctx.strokeStyle = '#8A6A4C';
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      const legOff = [4, 10, 22, 28];
      for (let dl = 0; dl < 4; dl++) {
        const lx2 = dx0 + legOff[dl];
        const ft  = this._seg(lx2, dby + 4, Math.sin(dp + dl * Math.PI / 2) * 0.5, 13);
        ctx.beginPath();
        ctx.moveTo(lx2, dby + 4);
        ctx.lineTo(ft[0], ft[1]);
        ctx.stroke();
      }
      // Tail
      ctx.beginPath();
      ctx.moveTo(dx0 - 1, dby - 4);
      ctx.lineTo(dx0 - 8, dby - 14 + Math.sin(t * 9) * 4);
      ctx.stroke();
      // Body
      ctx.fillStyle = '#8A6A4C';
      ctx.beginPath();
      ctx.ellipse(dx0 + 16, dby, 17, 8, 0, 0, TAU);
      ctx.fill();
      // Head
      ctx.beginPath();
      ctx.arc(dx0 + 34, dby - 8, 8, 0, TAU);
      ctx.fill();
      // Snout
      ctx.beginPath();
      ctx.arc(dx0 + 41, dby - 6, 3.5, 0, TAU);
      ctx.fill();
      // Ear (wagging)
      ctx.save();
      ctx.translate(dx0 + 34, dby - 15);
      ctx.rotate(Math.sin(t * 4) * 0.25);
      ctx.fillStyle = '#6E523A';
      ctx.beginPath();
      ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.lineTo(0, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Person — compute shared coords before drawing
      const wp   = t * 5.2;
      const bob  = Math.sin(wp * 2) * 1.4;
      const hipX = 214, hipY = 344 - 50 + bob;
      const a1   = Math.sin(wp) * 0.5;
      const a2   = Math.sin(wp + Math.PI) * 0.5;

      const f1 = this._limb(ctx, hipX, hipY, a1, 20, a1 - (0.15 + 0.45 * Math.max(0, Math.sin(wp))),           18, 7, '#565064');
      const f2 = this._limb(ctx, hipX, hipY, a2, 20, a2 - (0.15 + 0.45 * Math.max(0, Math.sin(wp + Math.PI))), 18, 7, '#4A4557');

      // Shoes
      ctx.fillStyle = '#3B332F';
      ctx.beginPath(); ctx.arc(f1[0], f1[1], 4.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(f2[0], f2[1], 4.2, 0, TAU); ctx.fill();

      const shBx = hipX - 3, shBy = hipY - 22;
      const hL   = this._seg(shBx, shBy, Math.sin(wp + Math.PI) * 0.45 + 0.12, 20);

      // Sleeve (leash arm)
      ctx.strokeStyle = '#6B5080';
      ctx.lineWidth   = 6;
      ctx.beginPath();
      ctx.moveTo(shBx, shBy);
      ctx.lineTo(hL[0], hL[1]);
      ctx.stroke();

      // Body / coat
      ctx.fillStyle = '#7A5C8E';
      ctx.beginPath();
      ctx.moveTo(hipX - 13, hipY + 20); ctx.lineTo(hipX + 13, hipY + 20);
      ctx.lineTo(hipX + 9,  hipY - 24); ctx.lineTo(hipX - 9,  hipY - 24);
      ctx.closePath();
      ctx.fill();

      // Face
      ctx.fillStyle = '#EDB48C';
      ctx.beginPath(); ctx.arc(hipX + 2, hipY - 33, 8.5, 0, TAU); ctx.fill();

      // Hair + hat dome
      ctx.fillStyle = '#4A3428';
      ctx.beginPath(); ctx.arc(hipX + 2, hipY - 35, 8.5, Math.PI, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(hipX - 6, hipY - 40, 4, 0, TAU); ctx.fill();

      // Hat brim
      ctx.fillStyle = '#C0504D';
      ctx.fillRect(hipX - 6, hipY - 27, 14, 5);

      const sx  = Math.sin(t * 1.4) * 2;
      const ux  = hipX + 11 + sx, uy = hipY - 56;
      const hnd = [hipX + 15, hipY - 12];

      // Umbrella arm
      ctx.strokeStyle = '#7A5C8E';
      ctx.lineWidth   = 6;
      ctx.beginPath();
      ctx.moveTo(hipX + 2, hipY - 22);
      ctx.lineTo(hnd[0], hnd[1]);
      ctx.stroke();

      // Umbrella handle
      ctx.strokeStyle = '#4A3A30';
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.moveTo(hnd[0], hnd[1]);
      ctx.lineTo(ux, uy - 40);
      ctx.stroke();

      // Umbrella canopy
      ctx.fillStyle = '#C0504D';
      ctx.beginPath();
      ctx.moveTo(ux - 36, uy);
      ctx.arc(ux, uy, 36, Math.PI, TAU);
      for (let ui = 1; ui <= 4; ui++)
        ctx.quadraticCurveTo(ux + 36 - (ui - 0.5) * 18, uy + 7, ux + 36 - ui * 18, uy);
      ctx.closePath();
      ctx.fill();

      // Leash from hand to dog collar
      ctx.strokeStyle = '#5A4636';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(hL[0], hL[1]);
      ctx.quadraticCurveTo(
        (hL[0] + dx0 + 28) / 2, (hL[1] + dby - 8) / 2 + 16,
        dx0 + 28, dby - 8
      );
      ctx.stroke();

      // Falling leaves
      for (const fl of this._fall) {
        ctx.save();
        ctx.translate(fl.x, fl.y);
        ctx.rotate(fl.rot);
        ctx.fillStyle = fl.c;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.5, 2.6, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    _bump(ctx, off, base, amp, wl, col) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, GT + 1);
      for (let x = 0; x <= W; x += 8)
        ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x + off) / wl)));
      ctx.lineTo(W, GT + 1);
      ctx.closePath();
      ctx.fill();
    }

    _tree(ctx, x, s) {
      ctx.fillStyle = '#6B4A36';
      ctx.fillRect(x - 4, GT - 56 * s, 8, 56 * s);
      ctx.fillStyle = '#C46A3C';
      ctx.beginPath(); ctx.arc(x,           GT - 64 * s, 24 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#D9973F';
      ctx.beginPath(); ctx.arc(x - 16 * s,  GT - 52 * s, 15 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#B25733';
      ctx.beginPath(); ctx.arc(x + 15 * s,  GT - 54 * s, 14 * s, 0, TAU); ctx.fill();
    }

    _seg(x, y, a, l) {
      return [x + Math.sin(a) * l, y + Math.cos(a) * l];
    }

    _limb(ctx, x, y, a1, l1, a2, l2, w, col) {
      const k = this._seg(x, y, a1, l1);
      const f = this._seg(k[0], k[1], a2, l2);
      ctx.strokeStyle = col;
      ctx.lineWidth   = w;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(k[0], k[1]);
      ctx.lineTo(f[0], f[1]);
      ctx.stroke();
      return f;
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
    _inst = new AutumnDogWalkTheme();
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

  window.AutumnDogWalkTheme = AutumnDogWalkTheme;
  window.DogWalk = { init, destroy };
})();
