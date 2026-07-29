'use strict';

// Harmonic Surface — a rotating wireframe of a radius-modulated sphere whose
// longitude/latitude lobe counts slowly "breathe" (drift in and out of phase),
// shaded warm gold by depth on a dark background. Self-contained projection
// (kept as authored — distinct palette/constants from the shared renderer).

// ── Tunable parameters ──────────────────────────────────────────────────────
const HARMONIC_SURFACE_PARAMS = {
  LAT_N:      30,    // lattice: samples pole-to-pole
  LON_N:      50,    // lattice: samples around the equator
  AMP:        0.42,  // radius modulation depth
  SCALE:      0.32,  // fit factor vs min(W, H)
  ROT_SPEED:  0.10,  // rotation around Y (rad/s)
  TILT:       0.52,  // fixed viewing tilt around X
  PERSP_K:    0.16,  // perspective strength
};

class HarmonicSurfaceTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.p = Object.assign({}, HARMONIC_SURFACE_PARAMS);
    this.t = 0;
    this._lastTs = null;
    this._P = [];   // reused lattice of projected points
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.speed = opts.speed || 1.0;
    this.intensity = opts.intensity || 1.0;
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
    const latN = p.LAT_N, lonN = p.LON_N;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0c0805';
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2, S = Math.min(W, H) * p.SCALE;
    const A = p.AMP;
    const m  = 3 + 1.4 * Math.sin(t * 0.02);        // longitude lobe count, breathing
    const nn = 2 + 1.4 * Math.sin(t * 0.016 + 1);   // latitude lobe count, breathing (phase-offset)
    const rotY = t * p.ROT_SPEED, tilt = p.TILT;
    const cY = Math.cos(rotY), sY = Math.sin(rotY);
    const cT = Math.cos(tilt), sT = Math.sin(tilt);

    const P = this._P;
    for (let i = 0; i <= latN; i++) {
      const row = P[i] || (P[i] = []);
      const phi = (i / latN) * Math.PI;
      for (let j = 0; j <= lonN; j++) {
        const th = (j / lonN) * Math.PI * 2;
        const rr = 1 + A * Math.sin(m * th) * Math.sin(nn * phi);
        const x = rr * Math.sin(phi) * Math.cos(th);
        const y = rr * Math.cos(phi);
        const z = rr * Math.sin(phi) * Math.sin(th);
        const x1 = x * cY + z * sY, z1 = -x * sY + z * cY;
        const y2 = y * cT - z1 * sT, z2 = y * sT + z1 * cT;
        const persp = 1 / (1 + (z2 + 3.0) * p.PERSP_K);
        row[j] = [cx + x1 * S * persp, cy + y2 * S * persp, z2];
      }
    }

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1;
    const seg = (a, b) => {
      let dn = ((a[2] + b[2]) * 0.5 + 1.5) / 3.0;
      dn = Math.max(0, Math.min(1, dn));
      ctx.strokeStyle = `rgba(${Math.round(200 + 55 * dn)},${Math.round(150 + 90 * dn)},${Math.round(70 + 120 * dn)},${0.12 + 0.5 * dn})`;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    };
    for (let i = 0; i <= latN; i++) {
      for (let j = 0; j <= lonN; j++) {
        if (j < lonN) seg(P[i][j], P[i][j + 1]);
        if (i < latN) seg(P[i][j], P[i + 1][j]);
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  destroy() {
    this._P = [];
  }
}
