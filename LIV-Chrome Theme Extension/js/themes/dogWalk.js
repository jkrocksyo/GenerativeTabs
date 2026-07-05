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

  function drawTreeRow(ctx, trees, tileW, ox) {
    for (let tile = 0; tile <= 1; tile++) {
      const dx = ox + tile * tileW;
      for (const tr of trees) {
        const x = dx + tr.x;
        ctx.fillStyle = tr.trunkCol;
        ctx.fillRect(x - tr.tw * 0.5, tr.gy - tr.h, tr.tw, tr.h * 0.55);
        ctx.fillStyle = tr.canopyCol;
        ctx.beginPath();
        ctx.arc(x, tr.gy - tr.h * 0.65, tr.cr, 0, Math.PI * 2);
        ctx.fill();
        // Second canopy cluster
        ctx.beginPath();
        ctx.arc(x - tr.cr * 0.55, tr.gy - tr.h * 0.52, tr.cr * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + tr.cr * 0.5, tr.gy - tr.h * 0.56, tr.cr * 0.68, 0, Math.PI * 2);
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

  const AUTUMN_CANOPY = ['#c45c10','#d4780a','#b84008','#e89018','#8c3a08','#c87030'];
  const LEAF_COLS = ['#d46010','#e87818','#c43808','#f09020','#b83010','#e0a028'];

  class AutumnDogWalkTheme {
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

      const sr = H * 0.13;
      this._sunGlow = makeGlow(sr, 'rgba(255,240,180,0.88)', 'rgba(240,160,60,0)');
      this._sunR = sr;

      this._farPeaks = Array.from({ length: 5 }, (_, i) => ({
        cx: ((i + 0.4 + Math.random() * 0.2) / 5) * tW,
        amp: rng(0.06, 0.11),
        s2: (tW * rng(0.06, 0.10)) ** 2,
      }));
      this._midPeaks = Array.from({ length: 7 }, (_, i) => ({
        cx: ((i + 0.4 + Math.random() * 0.2) / 7) * tW,
        amp: rng(0.05, 0.09),
        s2: (tW * rng(0.04, 0.08)) ** 2,
      }));

      const farCol = () => AUTUMN_CANOPY[Math.floor(Math.random() * 3) + 3]; // darker
      const nearCol = () => AUTUMN_CANOPY[Math.floor(Math.random() * AUTUMN_CANOPY.length)];
      this._farTrees = Array.from({ length: 12 }, () => ({
        x: Math.random() * tW,
        h: H * rng(0.06, 0.11),
        tw: H * 0.013,
        cr: H * rng(0.03, 0.05),
        gy: H * 0.80,
        trunkCol: '#5c3010',
        canopyCol: farCol(),
      }));
      this._nearTrees = Array.from({ length: 16 }, () => ({
        x: Math.random() * tW,
        h: H * rng(0.08, 0.14),
        tw: H * 0.016,
        cr: H * rng(0.04, 0.07),
        gy: H * 0.74,
        trunkCol: '#4a2808',
        canopyCol: nearCol(),
      }));

      // Scattered leaves on path
      this._pathLeaves = Array.from({ length: 30 }, () => ({
        x: Math.random() * tW,
        y: H * rng(0.755, 0.82),
        size: H * rng(0.006, 0.012),
        col: LEAF_COLS[Math.floor(Math.random() * LEAF_COLS.length)],
        rot: Math.random() * Math.PI * 2,
      }));

      // Falling leaf particles
      this._leaves = Array.from({ length: 25 }, () => this._spawnLeaf(true));

      this._walkPhase = 0;
    }

    _spawnLeaf(stagger) {
      return {
        x: Math.random() * this.W,
        y: stagger ? Math.random() * this.H * 0.85 : -10,
        vx: (Math.random() - 0.5) * this.H * 0.02,
        vy: this.H * (0.03 + Math.random() * 0.04),
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 3,
        size: this.H * (0.006 + Math.random() * 0.010),
        col: LEAF_COLS[Math.floor(Math.random() * LEAF_COLS.length)],
        swayA: (Math.random() - 0.5) * this.H * 0.015,
        swayF: 0.8 + Math.random() * 1.2,
        swayPh: Math.random() * Math.PI * 2,
      };
    }

    draw(ts) {
      const ctx = this.ctx;
      const W = this.W, H = this.H;
      const rawDt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      const dt = rawDt * Math.max(0.1, this.speed);
      this._t += dt;
      this._scroll += W * 0.08 * dt;
      this._walkPhase += dt * 1.9;
      const tW = this._tileW;

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0,    '#d8e0e8');
      sky.addColorStop(0.35, '#e8d4b0');
      sky.addColorStop(0.72, '#daa870');
      sky.addColorStop(1,    '#c89060');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Sun glow upper right
      ctx.drawImage(this._sunGlow, W * 0.82 - this._sunR, H * 0.10 - this._sunR, this._sunR * 2, this._sunR * 2);

      // Far tree layer
      const farOx = -((this._scroll * 0.04) % tW);
      drawHillFill(ctx, W, H, this._farPeaks, tW, farOx, '#c8956a');
      drawTreeRow(ctx, this._farTrees, tW, farOx);

      // Near tree layer
      const midOx = -((this._scroll * 0.09) % tW);
      drawHillFill(ctx, W, H, this._midPeaks, tW, midOx, '#b87a50');
      drawTreeRow(ctx, this._nearTrees, tW, midOx);

      // Ground / path
      const groundY = H * 0.745;
      const pg = ctx.createLinearGradient(0, groundY, 0, H);
      pg.addColorStop(0, '#c4a87a'); pg.addColorStop(0.3, '#b89460'); pg.addColorStop(1, '#a07848');
      ctx.fillStyle = pg; ctx.fillRect(0, groundY, W, H - groundY);

      // Scattered path leaves (scrolling)
      for (let tile = 0; tile <= 1; tile++) {
        const dx = midOx + tile * tW;
        for (const lf of this._pathLeaves) {
          const x = dx + lf.x;
          if (x < -lf.size * 2 || x > W + lf.size * 2) continue;
          ctx.save();
          ctx.translate(x, lf.y);
          ctx.rotate(lf.rot);
          ctx.fillStyle = lf.col;
          ctx.beginPath();
          ctx.ellipse(0, 0, lf.size, lf.size * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Update + draw falling leaves
      const t = this._t;
      for (let i = 0; i < this._leaves.length; i++) {
        const lf = this._leaves[i];
        lf.y += lf.vy * dt;
        lf.x += lf.vx * dt + lf.swayA * Math.sin(t * lf.swayF + lf.swayPh) * dt * 30;
        lf.rot += lf.rotV * dt;
        if (lf.y > H + 15) this._leaves[i] = this._spawnLeaf(false);
        ctx.save();
        ctx.translate(lf.x, lf.y);
        ctx.rotate(lf.rot);
        ctx.fillStyle = lf.col;
        ctx.beginPath();
        ctx.ellipse(0, 0, lf.size, lf.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      this._drawWalker(ctx, W, H);
      this._drawDog(ctx, W, H);
    }

    _drawWalker(ctx, W, H) {
      const s = H / 960;
      const gY = H * 0.748;
      const wx = W * 0.40;
      const ph = this._walkPhase;

      const strideX = 14 * s;
      const liftY = 16 * s;

      // Foot positions
      const lFootX = wx + Math.sin(ph) * strideX;
      const lFootY = Math.min(gY, gY - Math.max(0, Math.sin(ph)) * liftY);
      const rFootX = wx + Math.sin(ph + Math.PI) * strideX;
      const rFootY = Math.min(gY, gY - Math.max(0, Math.sin(ph + Math.PI)) * liftY);

      const hipY = gY - 60 * s;
      const hipX = wx + Math.sin(ph) * 2 * s;
      const bob  = Math.abs(Math.sin(ph)) * (-3 * s);
      const torsoY = hipY - 28 * s + bob;
      const headY  = torsoY - 24 * s + bob;

      const legLen = 66 * s;

      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      // Back leg
      const kB = solveKnee(hipX, hipY, rFootX, rFootY, legLen, 1);
      ctx.strokeStyle = '#5a3a80'; ctx.lineWidth = 9 * s;
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kB.x, kB.y); ctx.lineTo(rFootX, rFootY); ctx.stroke();

      // Coat body (purple jacket)
      ctx.fillStyle = '#6a3090';
      ctx.beginPath();
      ctx.ellipse(hipX, hipY - 10 * s, 14 * s, 28 * s, 0.05, 0, Math.PI * 2);
      ctx.fill();

      // Front leg
      const kF = solveKnee(hipX, hipY, lFootX, lFootY, legLen, 1);
      ctx.strokeStyle = '#7a4aA0'; ctx.lineWidth = 9 * s;
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kF.x, kF.y); ctx.lineTo(lFootX, lFootY); ctx.stroke();

      // Torso / coat upper
      ctx.fillStyle = '#6a3090';
      ctx.beginPath();
      ctx.ellipse(hipX - 1 * s, torsoY + 2 * s, 12 * s, 22 * s, -0.08, 0, Math.PI * 2);
      ctx.fill();

      // Leash arm
      const armSwing = Math.sin(ph + Math.PI) * 8 * s;
      const lArmX = hipX - 6 * s + armSwing, lArmY = torsoY + 10 * s;
      ctx.strokeStyle = '#7a4aA0'; ctx.lineWidth = 7 * s;
      ctx.beginPath(); ctx.moveTo(hipX, torsoY + 4 * s); ctx.lineTo(lArmX, lArmY); ctx.stroke();

      // Umbrella arm (other side)
      const uArmX = hipX + 4 * s, uArmY = torsoY - 8 * s;
      ctx.beginPath(); ctx.moveTo(hipX, torsoY); ctx.lineTo(uArmX, uArmY); ctx.stroke();

      // Umbrella stick
      const ushX = uArmX + 3 * s, ushY = uArmY - 6 * s;
      ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.moveTo(ushX, ushY); ctx.lineTo(ushX + 1 * s, ushY - 48 * s); ctx.stroke();

      // Umbrella dome
      const ucX = ushX + 1 * s, ucY = ushY - 50 * s;
      const ur = 22 * s;
      ctx.fillStyle = '#d02020';
      ctx.beginPath();
      ctx.moveTo(ucX - ur, ucY);
      ctx.quadraticCurveTo(ucX - ur * 0.5, ucY - ur * 0.95, ucX, ucY - ur * 1.1);
      ctx.quadraticCurveTo(ucX + ur * 0.5, ucY - ur * 0.95, ucX + ur, ucY);
      ctx.closePath(); ctx.fill();
      // Ribs
      ctx.strokeStyle = 'rgba(80,0,0,0.4)'; ctx.lineWidth = 1.5 * s;
      for (let i = 0; i <= 5; i++) {
        const a = Math.PI + (i / 5) * Math.PI;
        ctx.beginPath(); ctx.moveTo(ucX, ucY); ctx.lineTo(ucX + Math.cos(a) * ur, ucY + Math.sin(a) * ur * 0.35); ctx.stroke();
      }
      // Umbrella tip
      ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(ucX, ucY - ur * 1.1); ctx.lineTo(ucX, ucY - ur * 1.25); ctx.stroke();

      // Head + hair
      ctx.fillStyle = '#f0d8b0';
      ctx.beginPath(); ctx.arc(hipX - 1 * s, headY, 9 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2010';
      ctx.beginPath(); ctx.arc(hipX - 1 * s, headY - 5 * s, 10 * s, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hipX + 7 * s, headY + 2 * s, 5 * s, 8 * s, 0.5, 0, Math.PI * 2); ctx.fill();

      // Leash from hand to dog
      const dogX = W * 0.55, dogY = H * 0.762;
      ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(lArmX, lArmY + 6 * s);
      ctx.quadraticCurveTo((lArmX + dogX) / 2, (lArmY + dogY) / 2 + 12 * s, dogX, dogY - 8 * s);
      ctx.stroke();

      ctx.restore();
    }

    _drawDog(ctx, W, H) {
      const s = H / 960;
      const gY = H * 0.762;
      const dx = W * 0.55;
      const ph = this._walkPhase * 1.1; // slightly faster pace
      const strideX = 8 * s;
      const liftY = 10 * s;
      const bob = Math.abs(Math.sin(ph)) * (-2 * s);

      const bx = dx + Math.sin(ph * 0.5) * 2 * s; // slight sway
      const by = gY - 12 * s + bob;

      // Leg positions
      const lf = { x: bx + 8 * s + Math.sin(ph) * strideX,         y: Math.min(gY, gY - Math.max(0, Math.sin(ph)) * liftY) };
      const lb = { x: bx - 10 * s + Math.sin(ph + Math.PI) * strideX, y: Math.min(gY, gY - Math.max(0, Math.sin(ph + Math.PI)) * liftY) };
      const rf = { x: bx + 8 * s + Math.sin(ph + Math.PI) * strideX, y: Math.min(gY, gY - Math.max(0, Math.sin(ph + Math.PI)) * liftY) };
      const rb = { x: bx - 10 * s + Math.sin(ph) * strideX,          y: Math.min(gY, gY - Math.max(0, Math.sin(ph)) * liftY) };

      const legLen = 20 * s;
      const bCol = '#7a4a18', shadCol = '#5a3410';

      ctx.save();
      ctx.lineCap = 'round';

      // Back pair legs
      const bkl = solveKnee(bx - 10 * s, by + 6 * s, lb.x, lb.y, legLen, 1);
      const bkr = solveKnee(bx - 10 * s, by + 6 * s, rb.x, rb.y, legLen, 1);
      ctx.strokeStyle = shadCol; ctx.lineWidth = 4.5 * s;
      ctx.beginPath(); ctx.moveTo(bx - 10 * s, by + 6 * s); ctx.lineTo(bkl.x, bkl.y); ctx.lineTo(lb.x, lb.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - 10 * s, by + 6 * s); ctx.lineTo(bkr.x, bkr.y); ctx.lineTo(rb.x, rb.y); ctx.stroke();

      // Body
      ctx.fillStyle = bCol;
      ctx.beginPath(); ctx.ellipse(bx, by, 18 * s, 10 * s, 0.1, 0, Math.PI * 2); ctx.fill();

      // Front pair legs
      const fkl = solveKnee(bx + 8 * s, by + 5 * s, lf.x, lf.y, legLen, 1);
      const fkr = solveKnee(bx + 8 * s, by + 5 * s, rf.x, rf.y, legLen, 1);
      ctx.strokeStyle = bCol; ctx.lineWidth = 4.5 * s;
      ctx.beginPath(); ctx.moveTo(bx + 8 * s, by + 5 * s); ctx.lineTo(fkl.x, fkl.y); ctx.lineTo(lf.x, lf.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + 8 * s, by + 5 * s); ctx.lineTo(fkr.x, fkr.y); ctx.lineTo(rf.x, rf.y); ctx.stroke();

      // Head
      const hx = bx + 20 * s, hy = by - 5 * s;
      ctx.fillStyle = bCol;
      ctx.beginPath(); ctx.arc(hx, hy, 8 * s, 0, Math.PI * 2); ctx.fill();
      // Ear
      ctx.beginPath(); ctx.ellipse(hx - 3 * s, hy - 5 * s, 4 * s, 7 * s, -0.4, 0, Math.PI * 2); ctx.fill();
      // Snout
      ctx.fillStyle = '#8a5a28';
      ctx.beginPath(); ctx.ellipse(hx + 6 * s, hy + 2 * s, 4 * s, 3 * s, 0.2, 0, Math.PI * 2); ctx.fill();

      // Tail (wagging)
      const tailWag = Math.sin(this._t * 5) * 0.5;
      const tailBasX = bx - 17 * s, tailBasY = by - 4 * s;
      ctx.strokeStyle = bCol; ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(tailBasX, tailBasY);
      ctx.quadraticCurveTo(
        tailBasX - 10 * s, tailBasY - 12 * s,
        tailBasX - 5 * s + Math.sin(tailWag) * 14 * s,
        tailBasY - 22 * s + Math.cos(tailWag) * 6 * s
      );
      ctx.stroke();

      ctx.restore();
    }

    destroy() {}
  }

  window.AutumnDogWalkTheme = AutumnDogWalkTheme;
})();
