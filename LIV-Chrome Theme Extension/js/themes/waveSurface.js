'use strict';

// Wave Surface — a slowly rotating 3D wireframe of a radial standing wave,
// drawn in a 30° isometric projection and coloured blue→cyan by height.
//
// z(x,y,t) = AMPLITUDE * sin(FREQ*r - t*PHASE_SPEED) * exp(-DECAY*r),
// with r = hypot(x,y). The whole (x,y) domain also spins about the origin at
// ROT_SPEED, which is what makes the graph turn. Fully procedural, one rAF
// loop (driven by the engine), delta-timed, reduced-motion + hidden aware.

// ── Tunable parameters ──────────────────────────────────────────────────────
const WAVE_SURFACE_PARAMS = {
  GRID_N:       26,    // lattice resolution (samples per side)
  AMPLITUDE:    0.34,  // wave height
  FREQ:         8,     // ring frequency
  PHASE_SPEED:  1.4,   // outward ripple speed
  DECAY:        1.3,   // radial falloff
  ROT_SPEED:    0.05,  // domain rotation (rad/s)
  HEIGHT_SCALE: 1.5,   // vertical exaggeration in screen space
  SCALE:        0.34,  // fit factor vs min(W, H)
  VERT_ANCHOR:  0.56,  // vertical centre of the plot (fraction of H)
};

class WaveSurfaceTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.p = Object.assign({}, WAVE_SURFACE_PARAMS);

    this.t = 0;           // accumulated scene time (seconds), not frame count
    this._lastTs = null;  // previous timestamp for delta-timing

    this.gridN = this.p.GRID_N;
    this._verts = null;   // reused flat buffer of {sx, sy, tn} per lattice point
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.speed = opts.speed || 1.0;
    this.intensity = opts.intensity || 1.0;
    this._resizeGrid();
  }

  // Lattice density scales down on small viewports so the wire stays light
  // there; large windows keep the full resolution.
  _resizeGrid() {
    const shortSide = Math.min(this.w, this.h);
    let n = this.p.GRID_N;
    if (shortSide < 700) n = Math.max(14, Math.round(this.p.GRID_N * shortSide / 700));
    this.gridN = n;

    // Flat buffer: [sx, sy, tn] per vertex, reused every frame.
    this._verts = new Float32Array(n * n * 3);
  }

  draw(ts) {
    // Delta-timed accumulation: independent of frame rate / frame count, and
    // works whether the engine feeds real timestamps or the preview's synthetic
    // 0,33,66… steps. Big gaps (tab resume, first frame) are clamped.
    if (this._lastTs === null) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    if (dt < 0 || dt > 0.1) dt = 0.016;
    this.t += dt * this.speed;

    const { ctx, w, h } = this;
    const p = this.p;
    const t = this.t;
    const n = this.gridN;

    // Opaque dark backdrop (a hair of vertical gradient to avoid flat banding).
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#070b16');
    bg.addColorStop(1, '#02030a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // ── Projection setup (30° isometric) ──
    const c30 = Math.cos(Math.PI / 6);
    const s30 = Math.sin(Math.PI / 6);
    const S = Math.min(w, h) * p.SCALE;
    const cx = w / 2;
    const cy = h * p.VERT_ANCHOR;

    const theta = p.ROT_SPEED * t;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    const amp = p.AMPLITUDE;
    const invSpan = 2 / (n - 1);
    const V = this._verts;

    // Project every lattice point once, caching screen coords + normalised
    // height for the wire pass.
    for (let i = 0; i < n; i++) {
      const x = -1 + i * invSpan;
      for (let j = 0; j < n; j++) {
        const y = -1 + j * invSpan;
        const r = Math.hypot(x, y);
        const z = amp * Math.sin(p.FREQ * r - t * p.PHASE_SPEED) * Math.exp(-p.DECAY * r);

        // Rotate the domain, then project.
        const Xr = x * cosT - y * sinT;
        const Yr = x * sinT + y * cosT;
        const sx = cx + (Xr - Yr) * c30 * S;
        const sy = cy + (Xr + Yr) * s30 * S - z * S * p.HEIGHT_SCALE;

        const k = (i * n + j) * 3;
        V[k]     = sx;
        V[k + 1] = sy;
        V[k + 2] = (z + amp) / (2 * amp); // tn ∈ [0,1]
      }
    }

    // ── Wire pass: additive so overlapping strands glow ──
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0016);
    ctx.lineCap = 'round';

    // Segments along i (rows) and along j (columns). Per-segment colour is the
    // average of its two vertices' heights — cheaper than a gradient per
    // segment and visually indistinguishable at this line width.
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const k = (i * n + j) * 3;
        const ax = V[k], ay = V[k + 1], atn = V[k + 2];

        if (i < n - 1) {
          const k2 = ((i + 1) * n + j) * 3;
          this._segment(ax, ay, V[k2], V[k2 + 1], (atn + V[k2 + 2]) * 0.5);
        }
        if (j < n - 1) {
          const k2 = (i * n + (j + 1)) * 3;
          this._segment(ax, ay, V[k2], V[k2 + 1], (atn + V[k2 + 2]) * 0.5);
        }
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  _segment(x1, y1, x2, y2, tn) {
    const ctx = this.ctx;
    const rr = Math.round(90 + 140 * tn);
    const gg = Math.round(170 + 70 * tn);
    const a = (0.28 + 0.35 * tn).toFixed(3);
    ctx.strokeStyle = `rgba(${rr},${gg},255,${a})`;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this._resizeGrid();
  }

  destroy() {
    this._verts = null;
  }
}
