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

  // Pre-render a cone-of-light sprite for streetlamps
  function makeLampCone(W, H) {
    const cw = W * 0.12, ch = H * 0.35;
    const oc = document.createElement('canvas');
    oc.width = Math.ceil(cw); oc.height = Math.ceil(ch);
    const g = oc.getContext('2d');
    const gr = g.createRadialGradient(cw / 2, 0, 0, cw / 2, 0, Math.hypot(cw / 2, ch));
    gr.addColorStop(0, 'rgba(255,220,120,0.22)');
    gr.addColorStop(0.6, 'rgba(255,180,60,0.07)');
    gr.addColorStop(1, 'rgba(255,160,40,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(cw / 2, 0);
    g.lineTo(cw, ch);
    g.lineTo(0, ch);
    g.closePath();
    g.fill();
    return { img: oc, w: cw, h: ch };
  }

  class NightCityDriveTheme {
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

      // Stars (fixed, no parallax)
      this._stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H * 0.6,
        r: H * rng(0.001, 0.003),
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: rng(0.5, 2.0),
      }));

      // City skyline buildings
      this._skylineA = this._genBuildings(tW, H, 0.58, 0.12, 18, 0.022, 0.05); // far
      this._skylineB = this._genBuildings(tW, H, 0.65, 0.10, 14, 0.030, 0.07); // near

      // Streetlamps
      this._lamps = Array.from({ length: 8 }, (_, i) => ({
        x: ((i + 0.5) / 8) * tW + rng(-0.04, 0.04) * tW,
        postH: H * rng(0.16, 0.22),
        postW: H * 0.008,
      }));

      // Lamp cone sprite
      this._lampCone = makeLampCone(W, H);

      // Headlight cone (pre-render)
      const lcR = H * 0.18;
      this._hlGlow = makeGlow(lcR, 'rgba(255,240,180,0.55)', 'rgba(255,200,80,0)');
      this._hlR = lcR;

      // Exhaust particles
      this._exhaust = [];

      this._wheelA = 0;
    }

    _genBuildings(tW, H, baseY, winDensity, count, minW, maxW) {
      const buildings = [];
      const groundY = H * baseY;
      let x = 0;
      for (let i = 0; i < count; i++) {
        const w = H * (minW + Math.random() * (maxW - minW));
        const h = groundY * (0.18 + Math.random() * 0.55);
        const winCols = Math.max(1, Math.floor(w / (H * 0.018)));
        const winRows = Math.max(1, Math.floor(h / (H * 0.025)));
        const windows = [];
        for (let r = 0; r < winRows; r++) {
          for (let c = 0; c < winCols; c++) {
            const lit = Math.random() < 0.55;
            const flicker = lit && Math.random() < 0.06;
            windows.push({ r, c, lit, flicker, phase: Math.random() * Math.PI * 2 });
          }
        }
        buildings.push({ x: x + Math.random() * H * 0.02, w, h, groundY, windows, winCols, winRows });
        x += w + H * (0.008 + Math.random() * 0.018);
        if (x > tW) break;
      }
      return buildings;
    }

    _spawnExhaust(carX, carY) {
      this._exhaust.push({
        x: carX, y: carY,
        vx: -this.W * 0.06 - Math.random() * this.W * 0.03,
        vy: (Math.random() - 0.5) * this.H * 0.015,
        alpha: 0.35 + Math.random() * 0.15,
        r: this.H * (0.008 + Math.random() * 0.008),
        life: 1.0,
      });
    }

    draw(ts) {
      const ctx = this.ctx;
      const W = this.W, H = this.H;
      const rawDt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      const dt = rawDt * Math.max(0.1, this.speed);
      this._t += dt;
      this._scroll += W * 0.12 * dt;
      this._wheelA -= dt * 3.2;
      const tW = this._tileW;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#030610');
      sky.addColorStop(0.55, '#060f28');
      sky.addColorStop(1, '#0c1a3a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Stars
      const t = this._t;
      for (const s of this._stars) {
        const tw = 0.6 + 0.4 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
        ctx.fillStyle = `rgba(255,255,255,${0.5 * tw})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }

      // Far skyline
      const farOx = -((this._scroll * 0.035) % tW);
      this._drawBuildings(ctx, W, H, this._skylineA, tW, farOx, t);

      // Near skyline
      const nearOx = -((this._scroll * 0.08) % tW);
      this._drawBuildings(ctx, W, H, this._skylineB, tW, nearOx, t);

      // Road
      const roadY = H * 0.68;
      const rg = ctx.createLinearGradient(0, roadY, 0, H);
      rg.addColorStop(0, '#0e1020'); rg.addColorStop(1, '#070810');
      ctx.fillStyle = rg; ctx.fillRect(0, roadY, W, H - roadY);

      // Streetlamps + cones
      const lampOx = -((this._scroll * 0.14) % tW);
      const cone = this._lampCone;
      for (let tile = 0; tile <= 1; tile++) {
        const dx = lampOx + tile * tW;
        for (const lp of this._lamps) {
          const x = dx + lp.x;
          if (x < -cone.w && x > W + lp.postW) continue;
          const baseY = roadY;
          const lampTopY = baseY - lp.postH;
          // Light cone
          ctx.drawImage(cone.img, x - cone.w / 2, lampTopY, cone.w, cone.h);
          // Ground puddle glow
          const pg = ctx.createRadialGradient(x, baseY, 0, x, baseY, cone.w * 0.7);
          pg.addColorStop(0, 'rgba(255,200,80,0.08)');
          pg.addColorStop(1, 'rgba(255,160,40,0)');
          ctx.fillStyle = pg;
          ctx.beginPath(); ctx.ellipse(x, baseY, cone.w * 0.7, cone.w * 0.18, 0, 0, Math.PI * 2); ctx.fill();
          // Post
          ctx.fillStyle = '#1a1830';
          ctx.fillRect(x - lp.postW * 0.5, lampTopY, lp.postW, lp.postH);
          // Lamp head
          ctx.fillStyle = '#2a2640';
          ctx.fillRect(x - lp.postW * 1.8, lampTopY - lp.postW * 1.5, lp.postW * 3.6, lp.postW * 1.5);
          // Lamp bulb glow
          const lg = makeGlow(lp.postW * 3, 'rgba(255,230,140,0.9)', 'rgba(255,180,60,0)');
          ctx.drawImage(lg, x - lp.postW * 3, lampTopY - lp.postW * 3, lp.postW * 6, lp.postW * 6);
        }
      }

      // Road dashes
      const dLen = W * 0.055, dGap = W * 0.04, period = dLen + dGap;
      const dashOx = -((this._scroll * 0.22) % period);
      ctx.fillStyle = 'rgba(255,255,180,0.35)';
      for (let x = dashOx; x < W + dLen; x += period) {
        ctx.fillRect(x, H * 0.815 - H * 0.003, dLen, H * 0.005);
      }

      // Exhaust + car
      const carX = W * 0.36;
      const carY = roadY - H * 0.001;
      if (dt > 0 && Math.random() < 0.25) this._spawnExhaust(carX - H * 0.105, carY - H * 0.025);
      this._updateExhaust(ctx, dt);
      this._drawCar(ctx, W, H, carX, carY);
    }

    _drawBuildings(ctx, W, H, buildings, tW, ox, t) {
      for (let tile = 0; tile <= 1; tile++) {
        const dx = ox + tile * tW;
        for (const b of buildings) {
          const bx = dx + b.x;
          if (bx + b.w < 0 || bx > W) continue;
          // Building body
          ctx.fillStyle = '#0c1228';
          ctx.fillRect(bx, b.groundY - b.h, b.w, b.h);
          // Windows
          if (b.winCols > 0 && b.winRows > 0) {
            const ww = b.w / (b.winCols + 1) * 0.7;
            const wh = b.h / (b.winRows + 1) * 0.55;
            const xpad = (b.w - ww * b.winCols) / (b.winCols + 1);
            const ypad = (b.h - wh * b.winRows) / (b.winRows + 1);
            for (const win of b.windows) {
              if (!win.lit) continue;
              let a = 1.0;
              if (win.flicker) a = 0.5 + 0.5 * Math.sin(t * 3 + win.phase);
              const wx = bx + xpad + win.c * (ww + xpad);
              const wy = b.groundY - b.h + ypad + win.r * (wh + ypad);
              ctx.fillStyle = `rgba(255,210,120,${0.55 * a})`;
              ctx.fillRect(wx, wy, ww, wh);
            }
          }
        }
      }
    }

    _updateExhaust(ctx, dt) {
      for (let i = this._exhaust.length - 1; i >= 0; i--) {
        const p = this._exhaust[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r  *= 1 + dt * 1.2;
        p.life -= dt * 1.8;
        if (p.life <= 0) { this._exhaust.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(180,180,200,${p.alpha * p.life * 0.5})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    _drawCar(ctx, W, H, cx, groundY) {
      const s = H / 960;

      // Teal hatchback silhouette (side view, driving right)
      const carW = 130 * s;
      const carH = 46 * s;
      const wr = 17 * s;
      const carTop = groundY - carH - wr * 0.7;
      const carLeft = cx - carW * 0.45;

      ctx.save();

      // Headlight cone (forward)
      ctx.drawImage(this._hlGlow, cx + carW * 0.45 - this._hlR * 0.25, groundY - wr - carH * 0.45 - this._hlR * 0.5, this._hlR * 2, this._hlR * 2);

      // Car body
      ctx.fillStyle = '#1a6860';
      ctx.beginPath();
      ctx.moveTo(carLeft, groundY - wr * 0.8);
      ctx.lineTo(carLeft + carW * 0.08, carTop + carH * 0.4);
      ctx.lineTo(carLeft + carW * 0.22, carTop);
      ctx.lineTo(carLeft + carW * 0.70, carTop);
      ctx.lineTo(carLeft + carW * 0.88, carTop + carH * 0.45);
      ctx.lineTo(carLeft + carW, groundY - wr * 0.8);
      ctx.closePath();
      ctx.fill();

      // Window
      ctx.fillStyle = '#0e3830';
      ctx.beginPath();
      ctx.moveTo(carLeft + carW * 0.25, carTop + carH * 0.12);
      ctx.lineTo(carLeft + carW * 0.25, carTop + carH * 0.38);
      ctx.lineTo(carLeft + carW * 0.68, carTop + carH * 0.38);
      ctx.lineTo(carLeft + carW * 0.84, carTop + carH * 0.14);
      ctx.closePath();
      ctx.fill();
      // Window shine
      ctx.strokeStyle = 'rgba(100,200,180,0.18)';
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();

      // Wheels
      const rw1x = carLeft + carW * 0.20, rw1y = groundY - wr * 0.55;
      const rw2x = carLeft + carW * 0.78, rw2y = groundY - wr * 0.55;
      this._wheel(ctx, rw1x, rw1y, wr, s);
      this._wheel(ctx, rw2x, rw2y, wr, s);

      // Headlight (front)
      ctx.fillStyle = 'rgba(255,240,160,0.85)';
      ctx.beginPath();
      ctx.ellipse(carLeft + carW * 0.97, carTop + carH * 0.68, 4 * s, 3 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Brake light (rear, small red glow)
      ctx.fillStyle = 'rgba(255,60,40,0.7)';
      ctx.beginPath();
      ctx.ellipse(carLeft + 5 * s, carTop + carH * 0.62, 3 * s, 2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Rear glow
      const rg = ctx.createRadialGradient(carLeft + 5 * s, carTop + carH * 0.62, 0, carLeft + 5 * s, carTop + carH * 0.62, 14 * s);
      rg.addColorStop(0, 'rgba(255,40,20,0.3)'); rg.addColorStop(1, 'rgba(255,40,20,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(carLeft + 5 * s, carTop + carH * 0.62, 14 * s, 0, Math.PI * 2); ctx.fill();

      ctx.restore();
    }

    _wheel(ctx, cx, cy, r, s) {
      ctx.fillStyle = '#101020';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1838'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.5 * s;
      for (let i = 0; i < 6; i++) {
        const a = this._wheelA + i * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.15, cy + Math.sin(a) * r * 0.15);
        ctx.lineTo(cx + Math.cos(a) * r * 0.68, cy + Math.sin(a) * r * 0.68); ctx.stroke();
      }
      ctx.fillStyle = '#1a1838';
      ctx.beginPath(); ctx.arc(cx, cy, 3 * s, 0, Math.PI * 2); ctx.fill();
    }

    destroy() {}
  }

  window.NightCityDriveTheme = NightCityDriveTheme;
})();
