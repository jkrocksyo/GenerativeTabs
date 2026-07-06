'use strict';

(function () {

  const TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Koi Pond — looking straight down into deep teal water.
  // Koi are simulated as constraint chains: the head wanders, thirteen spine
  // points trail it, and the body is skinned over the spine with a width
  // profile plus a travelling undulation wave. Sun dapples drift across the
  // surface; lily pads and petals float above everything.
  const VARIANTS = [
    { base: '#efe7d8', patchCols: ['#d95f28', '#d95f28', '#23252b'] },  // kohaku / showa
    { base: '#e8862f', patchCols: ['#c04e1c', '#f5e8d8'] },             // orange
    { base: '#f2ede6', patchCols: ['#2b2d33', '#d95f28'] },             // bekko
    { base: '#e0ad3a', patchCols: ['#c98f28'] },                        // yamabuki gold
  ];

  const SEGS = 14;

  class KoiPondTheme {
    init(canvas, ctx, opts) {
      this.canvas    = canvas;
      this.ctx       = ctx || canvas.getContext('2d');
      this.speed     = (opts && opts.speed) || 1;
      this.intensity = (opts && opts.intensity) || 1;
      this._t        = rand(0, 100);
      this._lastTs   = null;
      this._ripples  = [];
      this._build(canvas.width, canvas.height);
    }

    resize(w, h) { this._build(w, h); }

    _build(w, h) {
      this._cW = w;
      this._cH = h;
      this._u  = Math.max(0.6, Math.min(2.4, Math.min(w, h) / 800));
      this._ripples.length = 0;
      this._buildWater();
      this._buildDappleSprite();
      this._buildVignette();
      this._buildKoi();
      this._buildPads();
      this._buildPetals();
    }

    _buildWater() {
      const w = this._cW, h = this._cH, u = this._u;
      const bg = document.createElement('canvas');
      bg.width = w; bg.height = h;
      const c = bg.getContext('2d');

      const g = c.createRadialGradient(w * 0.44, h * 0.36, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
      g.addColorStop(0,    '#37806e');
      g.addColorStop(0.55, '#265a4f');
      g.addColorStop(1,    '#123b34');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);

      // Depth variation — darker beds and pale shallows.
      for (let i = 0; i < 9; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = rand(180, 480) * u;
        const dg = c.createRadialGradient(x, y, 0, x, y, r);
        dg.addColorStop(0, 'rgba(6,30,26,0.22)');
        dg.addColorStop(1, 'rgba(6,30,26,0)');
        c.fillStyle = dg;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }
      for (let i = 0; i < 5; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        const r = rand(140, 360) * u;
        const lg = c.createRadialGradient(x, y, 0, x, y, r);
        lg.addColorStop(0, 'rgba(140,205,180,0.06)');
        lg.addColorStop(1, 'rgba(140,205,180,0)');
        c.fillStyle = lg;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }
      this._water = bg;
    }

    _buildDappleSprite() {
      const s = document.createElement('canvas');
      s.width = s.height = 256;
      const c = s.getContext('2d');
      const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0,   'rgba(214,255,236,0.9)');
      g.addColorStop(0.5, 'rgba(214,255,236,0.35)');
      g.addColorStop(1,   'rgba(214,255,236,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 256);
      this._dappleSprite = s;

      const u = this._u, w = this._cW, h = this._cH;
      this._dapples = [];
      for (let i = 0; i < 12; i++) {
        this._dapples.push({
          bx: Math.random() * w,
          by: Math.random() * h,
          r:  rand(160, 420) * u,
          sp: rand(0.03, 0.08),
          px: rand(0, TAU),
          py: rand(0, TAU),
          a:  rand(0.04, 0.09),
        });
      }
    }

    _buildVignette() {
      const w = this._cW, h = this._cH;
      const v = document.createElement('canvas');
      v.width = w; v.height = h;
      const c = v.getContext('2d');
      const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(2,14,12,0)');
      g.addColorStop(1, 'rgba(2,14,12,0.42)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      this._vignette = v;
    }

    _buildKoi() {
      const u = this._u, w = this._cW, h = this._cH;
      const n = Math.max(2, Math.min(5, Math.round(3 * this.intensity)));
      this._koi = [];
      for (let i = 0; i < n; i++) {
        const variant = VARIANTS[i % VARIANTS.length];
        const L = rand(110, 165) * u;
        const th = rand(0, TAU);
        const hx = w * rand(0.15, 0.85), hy = h * rand(0.15, 0.85);
        const seg = L / SEGS;
        const pts = [];
        for (let j = 0; j < SEGS; j++) {
          pts.push({ x: hx - Math.cos(th) * seg * j, y: hy - Math.sin(th) * seg * j });
        }
        const patches = [];
        const nP = 2 + ((Math.random() * (variant.patchCols.length > 1 ? 3 : 2)) | 0);
        for (let p = 0; p < nP; p++) {
          patches.push({
            i:   2 + ((Math.random() * 8) | 0),
            off: rand(-0.5, 0.5),
            sx:  rand(0.75, 1.25),
            sy:  rand(1.2, 2.0),
            col: variant.patchCols[p % variant.patchCols.length],
          });
        }
        this._koi.push({
          pts, seg,
          th,
          L,
          bodyW:  L * 0.155,
          vBase:  rand(26, 42) * u,
          phase:  rand(0, TAU),
          pa: rand(0, TAU), pb: rand(0, TAU), pc: rand(0, TAU),
          base: variant.base,
          patches,
          rippleIn: rand(3, 10),
        });
      }
    }

    _buildPads() {
      const u = this._u, w = this._cW, h = this._cH;
      const spots = [
        [0.13, 0.18], [0.87, 0.14], [0.80, 0.85], [0.10, 0.82],
      ];
      const n = Math.min(spots.length, 2 + Math.round(this.intensity));
      this._pads = [];
      for (let i = 0; i < n; i++) {
        this._pads.push({
          cx: w * spots[i][0] + rand(-20, 20) * u,
          cy: h * spots[i][1] + rand(-20, 20) * u,
          R:  rand(44, 66) * u,
          notch: rand(0, TAU),
          rot0: rand(-0.1, 0.1),
          ph: rand(0, TAU),
          flower: i === 0,
        });
      }
    }

    _buildPetals() {
      const u = this._u, w = this._cW, h = this._cH;
      this._petals = [];
      const n = 4 + Math.round(2 * this.intensity);
      for (let i = 0; i < n; i++) {
        this._petals.push({
          x: Math.random() * w,
          y: Math.random() * h,
          rot: rand(0, TAU),
          vx: rand(2.5, 6.5) * u * (Math.random() < 0.5 ? 1 : -1) * 0.6,
          vy: rand(1.5, 4) * u * 0.6,
          ph: rand(0, TAU),
        });
      }
    }

    // ── Simulation ─────────────────────────────────────────────────────────

    _step(dt) {
      const u = this._u, w = this._cW, h = this._cH;
      const t = this._t;

      for (const k of this._koi) {
        // Wandering heading with a gentle pull back from the walls.
        let dTh = 0.55 * Math.sin(t * 0.37 + k.pa) + 0.4 * Math.sin(t * 0.83 + k.pb);
        const head = k.pts[0];
        const m = 150 * u;
        const edge = Math.min(head.x, w - head.x, head.y, h - head.y);
        if (edge < m) {
          const want = Math.atan2(h / 2 - head.y, w / 2 - head.x);
          let diff = want - k.th;
          while (diff >  Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          dTh += diff * 2.4 * (1 - Math.max(0, edge) / m);
        }
        k.th += dTh * dt;

        const v = k.vBase * (0.8 + 0.3 * Math.sin(t * 0.21 + k.pc));
        head.x += Math.cos(k.th) * v * dt;
        head.y += Math.sin(k.th) * v * dt;

        // Spine follows the head, each segment at fixed length.
        for (let i = 1; i < SEGS; i++) {
          const p = k.pts[i], q = k.pts[i - 1];
          const dx = p.x - q.x, dy = p.y - q.y;
          const d = Math.hypot(dx, dy) || 1;
          p.x = q.x + (dx / d) * k.seg;
          p.y = q.y + (dy / d) * k.seg;
        }

        // Tail beat frequency tracks swim speed.
        k.phase += dt * (2.6 + v / (14 * u));

        k.rippleIn -= dt;
        if (k.rippleIn <= 0) {
          k.rippleIn = rand(5, 12);
          this._ripples.push({ x: head.x, y: head.y, age: 0, dur: rand(2.2, 3), r0: k.bodyW });
        }
      }

      for (let i = this._ripples.length - 1; i >= 0; i--) {
        const r = this._ripples[i];
        r.age += dt;
        if (r.age > r.dur) this._ripples.splice(i, 1);
      }

      for (const p of this._petals) {
        p.x += (p.vx + Math.sin(t * 0.3 + p.ph) * 2 * u) * dt;
        p.y += p.vy * dt;
        const mg = 30 * u;
        if (p.x >  w + mg) p.x = -mg;
        if (p.x < -mg)     p.x = w + mg;
        if (p.y >  h + mg) p.y = -mg;
      }
    }

    // ── Drawing ────────────────────────────────────────────────────────────

    _koiGeometry(k) {
      // Skinned spine: lateral wave + per-point normals + width profile.
      const u = this._u;
      const amp = k.bodyW * 0.28;
      const q = [], nx = [], ny = [], wd = [];
      const prof = [0.34, 0.48, 0.54, 0.56, 0.54, 0.49, 0.43, 0.36, 0.29, 0.22, 0.16, 0.11, 0.07, 0.045];
      for (let i = 0; i < SEGS; i++) {
        const a = k.pts[Math.max(0, i - 1)];
        const b = k.pts[Math.min(SEGS - 1, i + 1)];
        let tx = a.x - b.x, ty = a.y - b.y;
        const d = Math.hypot(tx, ty) || 1;
        tx /= d; ty /= d;
        const n = { x: -ty, y: tx };
        const sway = Math.sin(k.phase - i * 0.72) * amp * (0.15 + 0.85 * i / (SEGS - 1));
        q.push({
          x: k.pts[i].x + n.x * sway,
          y: k.pts[i].y + n.y * sway,
          tx, ty,
        });
        nx.push(n.x); ny.push(n.y);
        wd.push(prof[i] * k.bodyW);
      }
      return { q, nx, ny, wd };
    }

    _koiBodyPath(k, g) {
      const { q, nx, ny, wd } = g;
      const path = new Path2D();
      const nose = { x: q[0].x + q[0].tx * wd[0] * 1.5, y: q[0].y + q[0].ty * wd[0] * 1.5 };
      const L = [], R = [];
      for (let i = 0; i < SEGS; i++) {
        L.push({ x: q[i].x + nx[i] * wd[i], y: q[i].y + ny[i] * wd[i] });
        R.push({ x: q[i].x - nx[i] * wd[i], y: q[i].y - ny[i] * wd[i] });
      }
      path.moveTo(nose.x, nose.y);
      path.quadraticCurveTo(L[0].x, L[0].y, (L[0].x + L[1].x) / 2, (L[0].y + L[1].y) / 2);
      for (let i = 1; i < SEGS - 1; i++) {
        path.quadraticCurveTo(L[i].x, L[i].y, (L[i].x + L[i + 1].x) / 2, (L[i].y + L[i + 1].y) / 2);
      }
      const tail = q[SEGS - 1];
      path.quadraticCurveTo(L[SEGS - 1].x, L[SEGS - 1].y, tail.x - tail.tx * wd[SEGS - 1], tail.y - tail.ty * wd[SEGS - 1]);
      path.quadraticCurveTo(R[SEGS - 1].x, R[SEGS - 1].y, (R[SEGS - 1].x + R[SEGS - 2].x) / 2, (R[SEGS - 1].y + R[SEGS - 2].y) / 2);
      for (let i = SEGS - 2; i > 0; i--) {
        path.quadraticCurveTo(R[i].x, R[i].y, (R[i].x + R[i - 1].x) / 2, (R[i].y + R[i - 1].y) / 2);
      }
      path.quadraticCurveTo(R[0].x, R[0].y, nose.x, nose.y);
      path.closePath();
      return path;
    }

    _drawKoi(ctx, k) {
      const u = this._u;
      const g = this._koiGeometry(k);
      const body = this._koiBodyPath(k, g);
      const { q, nx, ny, wd } = g;

      // Shadow cast on the pond bed.
      ctx.save();
      ctx.translate(10 * u, 15 * u);
      ctx.filter = 'blur(' + (5 * u) + 'px)';
      ctx.fillStyle = 'rgba(3,22,18,0.28)';
      ctx.fill(body);
      ctx.restore();

      // Tail fin — two translucent fluttering lobes past the last segment.
      const te = q[SEGS - 1];
      const flut = Math.sin(k.phase - SEGS * 0.72);
      const tl = k.bodyW * 2.0;
      const bx = te.x - te.tx * wd[SEGS - 1] * 0.5;
      const by = te.y - te.ty * wd[SEGS - 1] * 0.5;
      ctx.fillStyle = k.base;
      ctx.globalAlpha = 0.5;
      for (const s of [-1, 1]) {
        const tipx = bx - te.tx * tl + nx[SEGS - 1] * (flut * k.bodyW * 0.7 + s * k.bodyW * 0.55);
        const tipy = by - te.ty * tl + ny[SEGS - 1] * (flut * k.bodyW * 0.7 + s * k.bodyW * 0.55);
        ctx.beginPath();
        ctx.moveTo(bx + nx[SEGS - 1] * s * wd[SEGS - 1] * 2, by + ny[SEGS - 1] * s * wd[SEGS - 1] * 2);
        ctx.quadraticCurveTo(
          bx - te.tx * tl * 0.5 + nx[SEGS - 1] * s * k.bodyW * 0.8,
          by - te.ty * tl * 0.5 + ny[SEGS - 1] * s * k.bodyW * 0.8,
          tipx, tipy
        );
        ctx.quadraticCurveTo(bx - te.tx * tl * 0.55, by - te.ty * tl * 0.55, bx, by);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Pectoral fins.
      const fi = 3;
      const fAng = Math.atan2(-q[fi].ty, -q[fi].tx);
      ctx.globalAlpha = 0.48;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(q[fi].x + nx[fi] * s * wd[fi] * 0.95, q[fi].y + ny[fi] * s * wd[fi] * 0.95);
        ctx.rotate(fAng + s * (1.15 + 0.2 * Math.sin(k.phase * 1.2)));
        ctx.beginPath();
        ctx.ellipse(wd[fi] * 0.9, 0, wd[fi] * 1.15, wd[fi] * 0.48, 0, 0, TAU);
        ctx.fillStyle = k.base;
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // Body, markings, sheen.
      ctx.fillStyle = k.base;
      ctx.fill(body);

      ctx.save();
      ctx.clip(body);
      for (const p of k.patches) {
        const i = Math.min(p.i, SEGS - 2);
        const px = q[i].x + nx[i] * p.off * wd[i];
        const py = q[i].y + ny[i] * p.off * wd[i];
        const ang = Math.atan2(q[i].ty, q[i].tx);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.ellipse(0, 0, wd[i] * p.sy, wd[i] * p.sx, 0, 0, TAU);
        ctx.fillStyle = p.col;
        ctx.fill();
        ctx.restore();
      }
      // Dorsal sheen down the spine.
      ctx.strokeStyle = 'rgba(255,255,252,0.10)';
      ctx.lineWidth = k.bodyW * 0.55;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(q[1].x, q[1].y);
      for (let i = 2; i < 9; i++) ctx.lineTo(q[i].x, q[i].y);
      ctx.stroke();
      // Shaded flank edge for roundness.
      ctx.strokeStyle = 'rgba(10,35,28,0.13)';
      ctx.lineWidth = k.bodyW * 0.22;
      ctx.beginPath();
      ctx.moveTo(q[1].x - nx[1] * wd[1] * 0.8, q[1].y - ny[1] * wd[1] * 0.8);
      for (let i = 2; i < 10; i++) ctx.lineTo(q[i].x - nx[i] * wd[i] * 0.8, q[i].y - ny[i] * wd[i] * 0.8);
      ctx.stroke();
      ctx.restore();
    }

    _drawPad(ctx, pad, t) {
      const u = this._u;
      const x = pad.cx + Math.sin(t * 0.05 + pad.ph) * 5 * u;
      const y = pad.cy + Math.cos(t * 0.045 + pad.ph) * 4 * u;
      const rot = pad.notch + pad.rot0 + Math.sin(t * 0.11 + pad.ph) * 0.05;
      const R = pad.R;

      ctx.fillStyle = 'rgba(3,22,18,0.30)';
      ctx.beginPath();
      ctx.ellipse(x + 5 * u, y + 8 * u, R * 1.02, R * 0.98, 0, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const gnotch = 0.4;

      const g = ctx.createRadialGradient(-R * 0.25, -R * 0.25, 0, 0, 0, R);
      g.addColorStop(0, '#4d8a52');
      g.addColorStop(1, '#26502f');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, gnotch, TAU - gnotch);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(14,44,26,0.35)';
      ctx.lineWidth = 1.2 * u;
      const veins = 9;
      for (let i = 0; i <= veins; i++) {
        const a = gnotch + 0.18 + (TAU - 2 * gnotch - 0.36) * (i / veins);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.12);
        ctx.lineTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(214,244,222,0.14)';
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.arc(0, 0, R - 1.5 * u, gnotch + 0.05, TAU - gnotch - 0.05);
      ctx.stroke();

      const hl = ctx.createRadialGradient(-R * 0.35, -R * 0.35, 0, -R * 0.35, -R * 0.35, R * 0.8);
      hl.addColorStop(0, 'rgba(255,255,238,0.10)');
      hl.addColorStop(1, 'rgba(255,255,238,0)');
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, gnotch, TAU - gnotch);
      ctx.closePath();
      ctx.fill();

      if (pad.flower) {
        const petR = R * 0.34;
        for (let ring = 0; ring < 2; ring++) {
          const nPet = ring === 0 ? 7 : 5;
          const len = petR * (ring === 0 ? 1 : 0.62);
          ctx.fillStyle = ring === 0 ? '#f3c6d2' : '#fae2e9';
          for (let i = 0; i < nPet; i++) {
            const a = (i / nPet) * TAU + ring * 0.45 + Math.sin(t * 0.2 + pad.ph) * 0.02;
            ctx.save();
            ctx.rotate(a);
            ctx.beginPath();
            ctx.ellipse(len * 0.72, 0, len * 0.7, len * 0.32, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
          }
        }
        ctx.fillStyle = '#eec14e';
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.09, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
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
      const ctx = this.ctx, t = this._t, u = this._u;
      ctx.drawImage(this._water, 0, 0);

      // Sun dapples drifting on the surface.
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const d of this._dapples) {
        const x = d.bx + Math.sin(t * d.sp + d.px) * 90 * u;
        const y = d.by + Math.cos(t * d.sp * 0.8 + d.py) * 70 * u;
        ctx.globalAlpha = d.a * (0.7 + 0.3 * Math.sin(t * 0.4 + d.px));
        ctx.drawImage(this._dappleSprite, x - d.r, y - d.r, d.r * 2, d.r * 2);
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      for (const k of this._koi) this._drawKoi(ctx, k);

      // Surface ripples.
      ctx.lineWidth = 1.6 * u;
      for (const r of this._ripples) {
        const p = r.age / r.dur;
        const rad = r.r0 + Math.pow(p, 0.65) * 95 * u;
        ctx.strokeStyle = `rgba(226,255,242,${(1 - p) * 0.26})`;
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
        ctx.strokeStyle = `rgba(226,255,242,${(1 - p) * 0.14})`;
        ctx.beginPath(); ctx.arc(r.x, r.y, rad * 0.68, 0, TAU); ctx.stroke();
      }

      for (const pad of this._pads) this._drawPad(ctx, pad, t);

      // Drifting petals, floating above it all.
      for (const p of this._petals) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot + Math.sin(t * 0.35 + p.ph) * 0.35);
        ctx.fillStyle = 'rgba(3,22,18,0.15)';
        ctx.beginPath(); ctx.ellipse(2.5 * u, 4 * u, 5 * u, 3.2 * u, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f2bfcc';
        ctx.beginPath(); ctx.ellipse(0, 0, 5 * u, 3.2 * u, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fbdde6';
        ctx.beginPath(); ctx.ellipse(-1 * u, -0.6 * u, 3 * u, 1.8 * u, 0.3, 0, TAU); ctx.fill();
        ctx.restore();
      }

      ctx.drawImage(this._vignette, 0, 0);
    }

    destroy() {
      this._water = this._vignette = this._dappleSprite = null;
      this._koi = this._pads = this._petals = null;
      this._ripples.length = 0;
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
    _inst = new KoiPondTheme();
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

  window.KoiPondTheme = KoiPondTheme;
  window.KoiPond = { init, destroy };
})();
