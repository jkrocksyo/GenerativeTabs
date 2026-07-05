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

  function drawTrees(ctx, trees, tileW, ox, color) {
    ctx.fillStyle = color;
    for (let tile = 0; tile <= 1; tile++) {
      const dx = ox + tile * tileW;
      for (const tr of trees) {
        const x = dx + tr.x;
        ctx.fillRect(x - tr.tw * 0.5, tr.gy - tr.h, tr.tw, tr.h * 0.55);
        ctx.beginPath();
        ctx.arc(x, tr.gy - tr.h * 0.72, tr.cr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawHouses(ctx, houses, tileW, ox, color) {
    ctx.fillStyle = color;
    for (let tile = 0; tile <= 1; tile++) {
      const dx = ox + tile * tileW;
      for (const h of houses) {
        const x = dx + h.x;
        ctx.fillRect(x - h.w * 0.5, h.gy - h.h, h.w, h.h);
        ctx.beginPath();
        ctx.moveTo(x - h.w * 0.58, h.gy - h.h);
        ctx.lineTo(x, h.gy - h.h - h.h * 0.55);
        ctx.lineTo(x + h.w * 0.58, h.gy - h.h);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function solveKnee(hx, hy, tx, ty, len, side) {
    const dx = tx - hx, dy = ty - hy;
    const d = Math.hypot(dx, dy);
    const seg = len / 2;
    if (d >= len * 0.98) return { x: (hx + tx) / 2, y: (hy + ty) / 2 };
    const base = Math.atan2(dy, dx);
    const ang = Math.acos(Math.max(-1, Math.min(1, d / (2 * seg))));
    const a = base + side * ang;
    return { x: hx + Math.cos(a) * seg, y: hy + Math.sin(a) * seg };
  }

  class SunsetBikeRideTheme {
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

      const sr = H * 0.14;
      this._sunGlow = makeGlow(sr, 'rgba(255,230,90,0.98)', 'rgba(210,50,0,0)');
      this._sunR = sr;

      const rng = (a, b) => a + Math.random() * (b - a);
      this._farPeaks = Array.from({ length: 5 }, (_, i) => ({
        cx: ((i + 0.4 + Math.random() * 0.2) / 5) * tW,
        amp: rng(0.07, 0.13),
        s2: (tW * rng(0.06, 0.11)) ** 2,
      }));
      this._midPeaks = Array.from({ length: 6 }, (_, i) => ({
        cx: ((i + 0.4 + Math.random() * 0.2) / 6) * tW,
        amp: rng(0.05, 0.10),
        s2: (tW * rng(0.04, 0.08)) ** 2,
      }));

      this._farTrees = Array.from({ length: 14 }, () => ({
        x: Math.random() * tW,
        h: H * rng(0.045, 0.08),
        tw: H * 0.013,
        cr: H * rng(0.022, 0.038),
        gy: H * 0.79,
      }));
      this._midTrees = Array.from({ length: 20 }, () => ({
        x: Math.random() * tW,
        h: H * rng(0.055, 0.1),
        tw: H * 0.015,
        cr: H * rng(0.025, 0.045),
        gy: H * 0.735,
      }));
      this._houses = Array.from({ length: 4 }, () => ({
        x: Math.random() * tW,
        w: H * rng(0.038, 0.055),
        h: H * rng(0.030, 0.045),
        gy: H * 0.735,
      }));

      this._crankA = 0; this._wheelA = 0;
    }

    draw(ts) {
      const ctx = this.ctx;
      const W = this.W, H = this.H;
      const rawDt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      const dt = rawDt * Math.max(0.1, this.speed);
      this._t += dt;
      this._scroll += W * 0.11 * dt;
      this._crankA -= dt * 3.0;
      this._wheelA -= dt * 2.55;
      const tW = this._tileW;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0,    '#130626');
      sky.addColorStop(0.38, '#671138');
      sky.addColorStop(0.68, '#d63c1e');
      sky.addColorStop(0.88, '#f5a020');
      sky.addColorStop(1,    '#f5b030');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Sun glow
      ctx.drawImage(this._sunGlow, W * 0.73 - this._sunR, H * 0.48 - this._sunR, this._sunR * 2, this._sunR * 2);

      // Far hills
      const farOx = -((this._scroll * 0.04) % tW);
      drawHillFill(ctx, W, H, this._farPeaks.map(p => ({ ...p, amp: p.amp })), tW, farOx, '#1f0c3c');
      drawTrees(ctx, this._farTrees, tW, farOx, '#180830');

      // Mid hills
      const midOx = -((this._scroll * 0.09) % tW);
      drawHillFill(ctx, W, H, this._midPeaks, tW, midOx, '#140520');
      drawTrees(ctx, this._midTrees, tW, midOx, '#0e0418');
      drawHouses(ctx, this._houses, tW, midOx, '#0e0418');

      // Road fill
      const roadY = H * 0.735;
      const rg = ctx.createLinearGradient(0, roadY, 0, H);
      rg.addColorStop(0, '#0f0b1c'); rg.addColorStop(1, '#080614');
      ctx.fillStyle = rg; ctx.fillRect(0, roadY, W, H - roadY);

      // Road dashes
      const dLen = W * 0.055, dGap = W * 0.04, period = dLen + dGap;
      const dashOx = -((this._scroll * 0.20) % period);
      ctx.fillStyle = 'rgba(255,200,80,0.48)';
      for (let x = dashOx; x < W + dLen; x += period) {
        ctx.fillRect(x, H * 0.808 - H * 0.003, dLen, H * 0.005);
      }

      this._drawCyclist(ctx, W, H);
    }

    _drawCyclist(ctx, W, H) {
      const s = H / 960;
      const cx = W * 0.37;
      const gY = H * 0.745;
      const bob = Math.sin(this._crankA * 2) * 2 * s;

      const wr = 33 * s;
      const rwX = cx - 31 * s, rwY = gY - wr;
      const fwX = cx + 50 * s, fwY = gY - wr;
      const bbX = cx + 6 * s,  bbY = gY - wr;
      const stX = bbX - 10 * s, stTopY = bbY - 37 * s + bob;
      const hdX = fwX - 18 * s, hdTopY = stTopY - 3 * s, hdBotY = fwY - wr * 0.35;

      const col = '#0c0618';
      ctx.save();
      ctx.fillStyle = col; ctx.strokeStyle = col;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      // Wheels
      this._wheel(ctx, rwX, rwY, wr, s, col);
      this._wheel(ctx, fwX, fwY, wr, s, col);

      // Frame
      ctx.lineWidth = 3.5 * s;
      ctx.beginPath();
      ctx.moveTo(stX, stTopY);   ctx.lineTo(bbX, bbY);
      ctx.moveTo(stX, stTopY);   ctx.lineTo(hdX, hdTopY);
      ctx.moveTo(bbX, bbY);      ctx.lineTo(hdX, hdBotY);
      ctx.moveTo(bbX, bbY);      ctx.lineTo(rwX, rwY);
      ctx.moveTo(stX, stTopY + 5 * s); ctx.lineTo(rwX, rwY);
      ctx.moveTo(hdX, hdTopY);   ctx.lineTo(fwX, fwY);
      ctx.moveTo(hdX, hdBotY);   ctx.lineTo(fwX, fwY);
      ctx.stroke();

      // Seat
      ctx.lineWidth = 6 * s;
      ctx.beginPath();
      ctx.moveTo(stX - 13 * s, stTopY); ctx.lineTo(stX + 7 * s, stTopY);
      ctx.stroke();

      // Handlebars
      const hbX = hdX + 7 * s, hbY = hdTopY + 2 * s;
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(hbX, hbY - 8 * s);
      ctx.bezierCurveTo(hbX + 9 * s, hbY - 3 * s, hbX + 12 * s, hbY + 1 * s, hbX + 14 * s, hbY + 5 * s);
      ctx.stroke();

      // Crank + pedals
      const cl = 18 * s;
      const p1x = bbX + Math.sin(this._crankA) * cl, p1y = bbY - Math.cos(this._crankA) * cl;
      const p2x = bbX - Math.sin(this._crankA) * cl, p2y = bbY + Math.cos(this._crankA) * cl;
      ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.stroke();
      ctx.fillRect(p1x - 4 * s, p1y - 1.5 * s, 8 * s, 3 * s);
      ctx.fillRect(p2x - 4 * s, p2y - 1.5 * s, 8 * s, 3 * s);

      // Rider body
      const hipX = stX - 3 * s, hipY = stTopY + 4 * s;
      const trX = hdX - 4 * s, trY = hdTopY - 7 * s + bob;

      ctx.lineWidth = 12 * s;
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(trX, trY); ctx.stroke();

      // Arms
      ctx.lineWidth = 7 * s;
      ctx.beginPath(); ctx.moveTo(trX, trY + 4 * s); ctx.lineTo(hbX, hbY - 3 * s); ctx.stroke();

      // Legs (IK from hip to pedal)
      const ll = 47 * s;
      const k1 = solveKnee(hipX, hipY, p1x, p1y, ll, -1);
      const k2 = solveKnee(hipX, hipY, p2x, p2y, ll, -1);
      ctx.lineWidth = 9 * s;
      // Back leg
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(k2.x, k2.y); ctx.lineTo(p2x, p2y); ctx.stroke();
      // Front leg (slightly lighter shade)
      ctx.strokeStyle = '#160a26';
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(k1.x, k1.y); ctx.lineTo(p1x, p1y); ctx.stroke();
      ctx.strokeStyle = col;

      // Head + helmet
      const hcX = trX - 2 * s, hcY = trY - 11 * s + bob;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(hcX, hcY, 9 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hcX, hcY - 3 * s, 10.5 * s, Math.PI, 0); ctx.fill();

      ctx.restore();
    }

    _wheel(ctx, cx, cy, r, s, col) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.5 * s;
      for (let i = 0; i < 8; i++) {
        const a = this._wheelA + i * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(cx, cy, 3 * s, 0, Math.PI * 2); ctx.fill();
    }

    destroy() {}
  }

  window.SunsetBikeRideTheme = SunsetBikeRideTheme;
})();
