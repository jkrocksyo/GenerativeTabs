(function () {
  'use strict';

  function makeGlow(r, inner, outer) {
    const oc = document.createElement('canvas');
    oc.width = oc.height = r * 2;
    const g = oc.getContext('2d');
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    return oc;
  }

  function hillY(lx, tileW, peaks) {
    let y = 1;
    for (const p of peaks) {
      let dx = Math.abs(lx - p.cx);
      if (dx > tileW / 2) dx = tileW - dx;
      const bump = p.amp * Math.exp(-(dx * dx) / p.s2);
      if (bump > 0) y = Math.min(y, 1 - bump);
    }
    return y;
  }

  function drawHillFill(ctx, W, H, peaks, tileW, ox, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const step = Math.max(2, W / 400);
    const endX = ox + tileW * 2 + step;
    ctx.moveTo(ox - step, H + 2);
    for (let x = ox - step; x <= endX; x += step) {
      const lx = ((x - ox) % tileW + tileW) % tileW;
      ctx.lineTo(x, hillY(lx, tileW, peaks) * H);
    }
    ctx.lineTo(endX, H + 2);
    ctx.closePath();
    ctx.fill();
  }

  const STRIPE_COLORS = ['#c82020','#f0e8d8','#1a8870','#e8a820'];

  class HotAirBalloonTheme {
    init(canvas, ctx, opts) {
      this.canvas = canvas; this.ctx = ctx;
      this.speed = (opts && opts.speed) || 1;
      this._t = 0; this._lastTs = null; this._scroll = 0;
      this.W = canvas.width; this.H = canvas.height;
      this._rebuild();
    }

    resize(w, h) {
      if (this.W) this._scroll *= w / this.W;
      this.W = w; this.H = h;
      this._rebuild();
    }

    _rebuild() {
      const W = this.W, H = this.H;
      this._tileW = W * 2;
      const tW = this._tileW;
      const rng = (a, b) => a + Math.random() * (b - a);

      // Sun glow (small, pale, lower left)
      const sr = H * 0.09;
      this._sunGlow = makeGlow(sr, 'rgba(255,230,170,0.80)', 'rgba(255,160,60,0)');
      this._sunR = sr;

      // Three hill layers (back to front, increasingly darker)
      this._hill1Peaks = Array.from({ length: 4 }, (_, i) => ({
        cx: ((i + 0.5) / 4) * tW + rng(-0.06, 0.06) * tW,
        amp: rng(0.07, 0.14), s2: (tW * rng(0.08, 0.13)) ** 2,
      }));
      this._hill2Peaks = Array.from({ length: 5 }, (_, i) => ({
        cx: ((i + 0.5) / 5) * tW + rng(-0.05, 0.05) * tW,
        amp: rng(0.06, 0.11), s2: (tW * rng(0.06, 0.10)) ** 2,
      }));
      this._hill3Peaks = Array.from({ length: 6 }, (_, i) => ({
        cx: ((i + 0.5) / 6) * tW + rng(-0.04, 0.04) * tW,
        amp: rng(0.05, 0.09), s2: (tW * rng(0.04, 0.08)) ** 2,
      }));

      // Ground plane trees + house
      this._groundTrees = Array.from({ length: 10 }, () => ({
        x: Math.random() * tW,
        h: H * rng(0.028, 0.048),
        tw: H * 0.009,
        cr: H * rng(0.015, 0.025),
        gy: H * 0.87,
      }));
      this._groundHouses = Array.from({ length: 2 }, () => ({
        x: Math.random() * tW,
        w: H * rng(0.025, 0.035), h: H * rng(0.018, 0.026),
        gy: H * 0.87,
      }));

      // Birds (V formation, two flocks)
      this._flocks = Array.from({ length: 2 }, () => ({
        x: Math.random() * W,
        y: H * (0.12 + Math.random() * 0.20),
        spread: H * (0.018 + Math.random() * 0.012),
        count: 5 + Math.floor(Math.random() * 4),
        speed: W * (0.006 + Math.random() * 0.006),
        flapPhase: Math.random() * Math.PI * 2,
      }));

      // Burner flame state
      this._flameTimer = 4 + Math.random() * 4;
      this._flameDuration = 0;
      this._flameMaxDur = 0;

      // Balloon bob
      this._bobPhase = 0;
      this._rotPhase = 0;
    }

    draw(ts) {
      const ctx = this.ctx;
      const W = this.W, H = this.H;
      const rawDt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      const dt = rawDt * Math.max(0.1, this.speed);
      this._t += dt;
      this._scroll += W * 0.035 * dt; // very slow
      this._bobPhase += dt * 0.45;
      this._rotPhase += dt * 0.18;
      const tW = this._tileW;
      const t = this._t;

      // Flame timer
      this._flameTimer -= dt;
      if (this._flameTimer <= 0) {
        this._flameDuration = this._flameMaxDur = 0.4 + Math.random() * 0.5;
        this._flameTimer = 6 + Math.random() * 6;
      }
      if (this._flameDuration > 0) this._flameDuration -= dt;

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0,    '#1a0838');
      sky.addColorStop(0.30, '#781848');
      sky.addColorStop(0.62, '#c84828');
      sky.addColorStop(0.85, '#e89030');
      sky.addColorStop(1,    '#f0b840');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Sun (lower left, pale)
      ctx.drawImage(this._sunGlow, W * 0.15 - this._sunR, H * 0.75 - this._sunR, this._sunR * 2, this._sunR * 2);

      // Birds
      for (const flock of this._flocks) {
        flock.x += flock.speed * dt;
        if (flock.x > W + flock.spread * flock.count) {
          flock.x = -flock.spread * flock.count;
          flock.y = H * (0.10 + Math.random() * 0.22);
        }
        const flapOff = Math.sin(t * 4 + flock.flapPhase) * H * 0.008;
        ctx.strokeStyle = 'rgba(40,20,60,0.45)'; ctx.lineWidth = H * 0.003;
        for (let i = 0; i < flock.count; i++) {
          const bx = flock.x - i * flock.spread * 0.9;
          const by = flock.y + Math.abs(i) * flock.spread * 0.35;
          const ff = flapOff * (1 - i / flock.count * 0.4);
          ctx.beginPath();
          ctx.moveTo(bx - flock.spread * 0.3, by + ff);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx + flock.spread * 0.3, by + ff);
          ctx.stroke();
        }
      }

      // Hill layer 1 (farthest, haziest/palest)
      const h1Ox = -((this._scroll * 0.012) % tW);
      drawHillFill(ctx, W, H, this._hill1Peaks, tW, h1Ox, 'rgba(160,90,130,0.55)');

      // Hill layer 2 (mid)
      const h2Ox = -((this._scroll * 0.025) % tW);
      drawHillFill(ctx, W, H, this._hill2Peaks, tW, h2Ox, 'rgba(130,60,90,0.72)');

      // Hill layer 3 (nearest, darkest)
      const h3Ox = -((this._scroll * 0.05) % tW);
      drawHillFill(ctx, W, H, this._hill3Peaks, tW, h3Ox, '#8a3858');

      // Ground plane
      const gY = H * 0.87;
      const gg = ctx.createLinearGradient(0, gY, 0, H);
      gg.addColorStop(0, '#6a2840'); gg.addColorStop(1, '#4a1828');
      ctx.fillStyle = gg; ctx.fillRect(0, gY, W, H - gY);

      // River ribbon (winding across mid-ground)
      this._drawRiver(ctx, W, H, h3Ox, tW);

      // Ground trees + houses
      const gtOx = -((this._scroll * 0.05) % tW);
      ctx.fillStyle = '#4a1828';
      for (let tile = 0; tile <= 1; tile++) {
        const dx = gtOx + tile * tW;
        for (const tr of this._groundTrees) {
          const x = dx + tr.x;
          if (x < -tr.h || x > W + tr.h) continue;
          ctx.fillRect(x - tr.tw * 0.5, tr.gy - tr.h, tr.tw, tr.h * 0.5);
          ctx.beginPath(); ctx.arc(x, tr.gy - tr.h * 0.72, tr.cr, 0, Math.PI * 2); ctx.fill();
        }
        for (const ho of this._groundHouses) {
          const x = dx + ho.x;
          if (x < -ho.w || x > W + ho.w) continue;
          ctx.fillRect(x - ho.w * 0.5, ho.gy - ho.h, ho.w, ho.h);
          ctx.beginPath();
          ctx.moveTo(x - ho.w * 0.6, ho.gy - ho.h);
          ctx.lineTo(x, ho.gy - ho.h - ho.h * 0.55);
          ctx.lineTo(x + ho.w * 0.6, ho.gy - ho.h);
          ctx.closePath(); ctx.fill();
        }
      }

      // Balloon (centered)
      this._drawBalloon(ctx, W, H);
    }

    _drawRiver(ctx, W, H, ox, tW) {
      const riverY = H * 0.84;
      ctx.fillStyle = 'rgba(220,200,170,0.35)';
      for (let tile = 0; tile <= 1; tile++) {
        const dx = ox + tile * tW;
        ctx.beginPath();
        ctx.moveTo(dx, riverY);
        ctx.bezierCurveTo(
          dx + tW * 0.25, riverY - H * 0.012,
          dx + tW * 0.5,  riverY + H * 0.008,
          dx + tW * 0.75, riverY - H * 0.005
        );
        ctx.lineTo(dx + tW, riverY + H * 0.012);
        ctx.lineTo(dx + tW, riverY + H * 0.018);
        ctx.bezierCurveTo(
          dx + tW * 0.75, riverY + H * 0.006,
          dx + tW * 0.5,  riverY + H * 0.020,
          dx + tW * 0.25, riverY + H * 0.004
        );
        ctx.lineTo(dx, riverY + H * 0.012);
        ctx.closePath(); ctx.fill();
      }
    }

    _drawBalloon(ctx, W, H) {
      const s = H / 960;
      const bob = Math.sin(this._bobPhase) * 5 * s;
      const microRot = Math.sin(this._rotPhase) * 0.018;

      const bcX = W * 0.50;
      const bcY = H * 0.34 + bob;
      const envR = H * 0.155; // envelope radius

      ctx.save();
      ctx.translate(bcX, bcY);
      ctx.rotate(microRot);

      // Envelope shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.ellipse(4 * s, 6 * s, envR * 0.82, envR * 0.95, 0, 0, Math.PI * 2); ctx.fill();

      // Envelope (clipped to circle then striped)
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, envR, 0, Math.PI * 2); ctx.clip();

      const stripeW = (envR * 2) / STRIPE_COLORS.length;
      for (let i = 0; i < STRIPE_COLORS.length; i++) {
        ctx.fillStyle = STRIPE_COLORS[i];
        ctx.fillRect(-envR + i * stripeW, -envR * 1.05, stripeW, envR * 2.1);
      }
      // Slight shade at top/bottom for roundness
      const shadT = ctx.createLinearGradient(0, -envR, 0, envR);
      shadT.addColorStop(0, 'rgba(0,0,0,0.22)');
      shadT.addColorStop(0.3, 'rgba(0,0,0,0)');
      shadT.addColorStop(0.7, 'rgba(0,0,0,0)');
      shadT.addColorStop(1, 'rgba(0,0,0,0.30)');
      ctx.fillStyle = shadT; ctx.fillRect(-envR, -envR, envR * 2, envR * 2);
      // Rim
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.arc(0, 0, envR - 1, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // Bottom skirt (slightly below envelope)
      ctx.fillStyle = '#1a0838';
      ctx.beginPath();
      ctx.arc(0, envR * 0.72, envR * 0.55, 0.1, Math.PI - 0.1);
      ctx.closePath(); ctx.fill();

      // Ropes from envelope bottom to basket
      const ropeTopY = envR * 0.88;
      const basketTopY = envR + 26 * s;
      const basketW = 32 * s;
      ctx.strokeStyle = 'rgba(80,50,20,0.8)'; ctx.lineWidth = 1.5 * s;
      const ropeXs = [-basketW * 0.7, -basketW * 0.2, basketW * 0.2, basketW * 0.7];
      for (const rx of ropeXs) {
        ctx.beginPath();
        ctx.moveTo(rx * 0.35, ropeTopY);
        ctx.lineTo(rx, basketTopY);
        ctx.stroke();
      }

      // Basket
      const bkH = 24 * s;
      ctx.fillStyle = '#8a5820';
      ctx.fillRect(-basketW, basketTopY, basketW * 2, bkH);
      // Weave lines
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.2 * s;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-basketW, basketTopY + (i / 4) * bkH);
        ctx.lineTo(basketW, basketTopY + (i / 4) * bkH);
        ctx.stroke();
      }
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * basketW * 0.38, basketTopY);
        ctx.lineTo(i * basketW * 0.38, basketTopY + bkH);
        ctx.stroke();
      }
      // Basket rim
      ctx.fillStyle = '#a06828';
      ctx.fillRect(-basketW - 2 * s, basketTopY - 2 * s, basketW * 2 + 4 * s, 4 * s);

      // Burner flame
      if (this._flameDuration > 0) {
        const flamePct = this._flameDuration / this._flameMaxDur;
        const flameH = envR * 0.28 * Math.min(1, flamePct * 3);
        const flameAlpha = Math.min(1, flamePct * 2) * 0.85;
        const fg = ctx.createRadialGradient(0, ropeTopY + 8 * s, 0, 0, ropeTopY + 8 * s, flameH);
        fg.addColorStop(0, `rgba(255,255,180,${flameAlpha})`);
        fg.addColorStop(0.4, `rgba(255,160,20,${flameAlpha * 0.7})`);
        fg.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(0, ropeTopY + 8 * s, flameH, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    }

    destroy() {}
  }

  window.HotAirBalloonTheme = HotAirBalloonTheme;
})();
