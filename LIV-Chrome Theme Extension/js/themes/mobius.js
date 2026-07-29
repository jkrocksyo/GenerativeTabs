'use strict';

// Möbius Strip — a slowly turning wireframe Möbius band, depth-shaded blue with
// a soft "shine" band travelling around its length. The geometry is built once
// (resolution-independent: centred and normalised by its own extent), then each
// frame rotates/tilts/projects it. Segments are bucketed by depth & shine into
// Path2D groups so a frame is ~20 stroke() calls instead of ~3000.

// ── Tunable parameters ──────────────────────────────────────────────────────
const MOBIUS_PARAMS = {
  USEG:   100,   // rings around the strip's length (one full 2π loop)
  VSEG:   14,    // samples across the strip's width
  EXTRA:  5,     // extra overlap rings past 2π so the seam closes cleanly
  TILT:   0.5,   // fixed viewing tilt around X
  AX:     1.4,   // horizontal stretch
  AY:     0.85,  // vertical squash
  WIDTH:  0.84,  // strip width (in v)
  PERSP_K: 0.16, // perspective strength
  DEPTH_BUCKETS: 14,
  // Shimmer: finer alpha steps + a softer/wider band so the highlight glides
  // smoothly the whole way around instead of popping ring-to-ring.
  SHINE_BUCKETS: 20,   // alpha resolution — more = smoother glide (was 8, the "laggy" cause)
  SHINE_SIGMA:   0.55, // band half-width (rad); wider = softer, sweeps more of the strip
  SHINE_SPEED:   0.6,  // travel speed around the strip (rad/s)
};

class MobiusStripTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.p = Object.assign({}, MOBIUS_PARAMS);
    this.t = 0;
    this._lastTs = null;

    this._P = [];      // [ring][j] = [x, y, z, u]
    this._ext = 1;
    this._nrings = 0;
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.speed = opts.speed || 1.0;
    this.intensity = opts.intensity || 1.0;
    this._build();
  }

  // Build the strip once. Centre on the core rings' mean, and measure the
  // extent so the projection fits any window without a rebuild.
  _build() {
    const p = this.p;
    const USEG = p.USEG, VSEG = p.VSEG;
    const NRINGS = USEG + p.EXTRA;
    this._nrings = NRINGS;

    const P = [];
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (let i = 0; i <= NRINGS; i++) {
      P[i] = [];
      const u = (i / USEG) * 2 * Math.PI;   // continues naturally past 2π for the EXTRA rings
      for (let j = 0; j <= VSEG; j++) {
        const v = (j / VSEG - 0.5) * p.WIDTH, R = 1.0;
        const x = (R + v * Math.cos(u / 2)) * Math.cos(u) * p.AX;
        const y = (R + v * Math.cos(u / 2)) * Math.sin(u) * p.AY;
        const z = v * Math.sin(u / 2);
        P[i][j] = [x, y, z, u];
        if (i < USEG) { sx += x; sy += y; sz += z; cnt++; }  // centre using only the core rings
      }
    }
    const mx = sx / cnt, my = sy / cnt, mz = sz / cnt;
    let ext = 0;
    for (let i = 0; i <= NRINGS; i++) {
      for (let j = 0; j <= VSEG; j++) {
        const pt = P[i][j];
        pt[0] -= mx; pt[1] -= my; pt[2] -= mz;
        if (i < USEG) {
          const rr = pt[0] * pt[0] + pt[1] * pt[1] + pt[2] * pt[2];
          if (rr > ext) ext = rr;
        }
      }
    }
    this._P = P;
    this._ext = Math.sqrt(ext) || 1;
  }

  draw(ts) {
    // Delta-timed accumulation (seconds), independent of frame rate/count.
    if (this._lastTs === null) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    if (dt < 0 || dt > 0.1) dt = 0.016;
    this.t += dt * this.speed;

    const { ctx, w: W, h: H } = this;
    const p = this.p;
    const t = this.t;
    const P = this._P, ext = this._ext, NRINGS = this._nrings, VSEG = p.VSEG;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#050710';
    ctx.fillRect(0, 0, W, H);

    const cx = W * 0.44, cy = H / 2;          // shifted slightly left of centre
    const S = Math.min(W, H) * 0.90 / ext;
    const rotY = 0.55 + 0.45 * Math.sin(t * 0.13);
    const cY = Math.cos(rotY), sY = Math.sin(rotY);
    const cT = Math.cos(p.TILT), sT = Math.sin(p.TILT);

    const SC = [];
    for (let i = 0; i <= NRINGS; i++) {
      SC[i] = [];
      for (let j = 0; j <= VSEG; j++) {
        const pt = P[i][j];
        const x1 = pt[0] * cY + pt[2] * sY, z1 = -pt[0] * sY + pt[2] * cY;
        const y2 = pt[1] * cT - z1 * sT, z2 = pt[1] * sT + z1 * cT;
        const persp = 1 / (1 + (z2 + ext * 1.6) * p.PERSP_K);
        SC[i][j] = [cx + x1 * S * persp, cy - y2 * S * persp, z2, pt[3]];
      }
    }

    // Bucket segments by depth (and shine) into Path2D groups so each frame is
    // ~20 stroke() calls instead of ~3000.
    const shinePhase = (t * p.SHINE_SPEED) % (2 * Math.PI);
    const inv2s2 = 1 / (2 * p.SHINE_SIGMA * p.SHINE_SIGMA);
    const shineAt = (u) => {
      let uu = u % (2 * Math.PI); if (uu < 0) uu += 2 * Math.PI;
      const d = Math.abs(((uu - shinePhase + Math.PI) % (2 * Math.PI)) - Math.PI);
      return Math.exp(-(d * d) * inv2s2);
    };

    const DB = p.DEPTH_BUCKETS, SB = p.SHINE_BUCKETS;
    const depthPaths = Array.from({ length: DB }, () => new Path2D());
    const shinePaths = Array.from({ length: SB }, () => new Path2D());

    const addSeg = (a, b) => {
      let dn = ((a[2] + b[2]) * 0.5 / ext + 1) / 2;
      dn = Math.max(0, Math.min(1, dn));
      const db = Math.min(DB - 1, Math.floor(dn * DB));
      depthPaths[db].moveTo(a[0], a[1]);
      depthPaths[db].lineTo(b[0], b[1]);

      const sh = shineAt((a[3] + b[3]) * 0.5);
      if (sh > 0.02) {
        const sb = Math.min(SB - 1, Math.floor(sh * SB));
        shinePaths[sb].moveTo(a[0], a[1]);
        shinePaths[sb].lineTo(b[0], b[1]);
      }
    };

    for (let i = 0; i < NRINGS; i++) {
      for (let j = 0; j <= VSEG; j++) {
        if (j < VSEG) addSeg(SC[i][j], SC[i][j + 1]);
        addSeg(SC[i][j], SC[i + 1][j]);
      }
    }

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 0.9;
    for (let db = 0; db < DB; db++) {
      const dn = (db + 0.5) / DB;
      const R = 90 * (0.4 + 0.6 * dn), G = 190 * (0.4 + 0.6 * dn), Bl = 255;
      const al = 0.16 + 0.5 * dn;
      ctx.strokeStyle = `rgba(${R | 0},${G | 0},${Bl},${al.toFixed(3)})`;
      ctx.stroke(depthPaths[db]);
    }
    for (let sb = 0; sb < SB; sb++) {
      const sh = (sb + 0.5) / SB;
      const R = Math.min(255, 165 * sh + 100), G = Math.min(255, 65 * sh + 130), Bl = 255;
      ctx.strokeStyle = `rgba(${R | 0},${G | 0},${Bl},${(0.5 * sh).toFixed(3)})`;
      ctx.stroke(shinePaths[sb]);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  resize(w, h) {
    // Geometry is resolution-independent, so no rebuild needed on resize.
    this.w = w;
    this.h = h;
  }

  destroy() {
    this._P = [];
  }
}
