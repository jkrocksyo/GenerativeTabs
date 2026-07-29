'use strict';

// Maurer Rose — a rose curve traced by connecting points stepped at a fixed
// angle (the classic Maurer construction). The stepping angle D_DEG is what
// decides which points connect to which, so it is NEVER animated — only the
// petal parameter `n` and a rigid `spin` drift, very slowly (~42 min cycles),
// which makes the figure morph gracefully instead of tearing apart.

// ── Tunable parameters ──────────────────────────────────────────────────────
const MAURER_ROSE_PARAMS = {
  D_DEG:    71,     // classic Maurer stepping angle — fixed, do not animate
  N_POINTS: 360,    // number of stepped points
  RADIUS:   0.42,   // curve radius vs min(W, H)
  N_BASE:   4.5,    // petal parameter centre
  N_AMP:    2.5,    // petal parameter swing
  // The rose is hypersensitive to `n` — it reshuffles hugely for a tiny change
  // — so the petal rate dominates the perceived speed. Kept very low so the
  // figure morphs gently rather than churning.
  N_RATE:   0.0006, // petal cycle rate (full cycle ≈ 2.9 hr)
  SPIN_RATE: 0.0007,// rigid rotation rate (full turn ≈ 2.5 hr)
};

class MaurerRoseTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.p = Object.assign({}, MAURER_ROSE_PARAMS);
    this.t = 0;
    this._lastTs = null;
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.speed = opts.speed || 1.0;
    this.intensity = opts.intensity || 1.0;
  }

  // Trace the rose once with the given stroke style (used for the soft glow
  // underlay and the crisp overlay).
  _tracePath(cx, cy, R, n, spin) {
    const ctx = this.ctx;
    const D = this.p.D_DEG, N = this.p.N_POINTS;
    ctx.beginPath();
    for (let k = 0; k <= N; k++) {
      const th = (k * D) * Math.PI / 180;
      const r = Math.cos(n * th);
      const x = cx + (r * Math.cos(th + spin)) * R;
      const y = cy + (r * Math.sin(th + spin)) * R;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
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

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0a0610';
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * p.RADIUS;
    const n    = p.N_BASE + p.N_AMP * Math.sin(t * p.N_RATE);   // petal parameter, slow
    const spin = t * p.SPIN_RATE;                                // rigid rotation, slow
    const hue  = 210 + 30 * Math.sin(t * 0.003);                 // slow color drift

    ctx.globalCompositeOperation = 'lighter';

    // Soft, wide glow underlay.
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = `hsla(${hue},75%,60%,0.10)`;
    this._tracePath(cx, cy, R, n, spin);

    // Crisp bright overlay.
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = `hsla(${hue + 30},90%,72%,0.75)`;
    this._tracePath(cx, cy, R, n, spin);

    ctx.globalCompositeOperation = 'source-over';
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  destroy() {}
}
