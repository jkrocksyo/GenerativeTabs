'use strict';

// Geometric Tiles — a centered grid of small outlined squares with a gentle
// ambient wobble, plus a cursor-driven wave: tiles near the pointer tilt open
// with a soft squared falloff. Cheap (a few hundred save/rotate/stroke calls),
// so no batching needed. Coordinates are canvas pixels; the cursor is tracked
// in the same space with an "active" flag (skip influence entirely when idle).

// ── Tunable parameters ──────────────────────────────────────────────────────
const GEOMETRIC_TILES_PARAMS = {
  TCOLS:             22,
  TROWS:             13,
  IDLE_AMP:          0.06,   // ambient wobble amplitude (radians)
  IDLE_SPEED:        0.6,    // ambient wobble speed
  INFLUENCE_FRAC:    0.28,   // cursor influence radius vs min(W, H)
  INFLUENCE_MAX_ROT: 1.15,   // max added rotation (~66°)
  TILE_FRACTION:     0.34,   // square side relative to cell size
};

class GeometricTilesTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.p = Object.assign({}, GEOMETRIC_TILES_PARAMS);
    this.t = 0;
    this._lastTs = null;
    this._reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.mx = 0; this.my = 0; this.mouseActive = false;
    this._onMove = null;
    this._onLeave = null;
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.speed = opts.speed || 1.0;
    this.intensity = opts.intensity || 1.0;
    if (!this._reduced) this._attach();
  }

  _attach() {
    const canvas = this.canvas;
    this._onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
      this.mx = (e.clientX - rect.left) * sx;
      this.my = (e.clientY - rect.top) * sy;
      this.mouseActive = true;
    };
    this._onLeave = () => { this.mouseActive = false; };
    canvas.addEventListener('pointermove', this._onMove, { passive: true });
    canvas.addEventListener('pointerleave', this._onLeave, { passive: true });
  }

  draw(ts) {
    if (this._lastTs === null) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    if (dt < 0 || dt > 0.1) dt = 0.016;
    this.t += dt * this.speed;

    const p = this.p;
    const { ctx, w: W, h: H } = this;
    const t = this.t;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    const tileSize = Math.min(W / p.TCOLS, H / p.TROWS);
    const ox = (W - p.TCOLS * tileSize) / 2;
    const oy = (H - p.TROWS * tileSize) / 2;
    const side = tileSize * p.TILE_FRACTION;
    const infR = Math.min(W, H) * p.INFLUENCE_FRAC;

    const active = this.mouseActive && !this._reduced;

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, Math.min(W, H) * 0.0015);

    for (let r = 0; r < p.TROWS; r++) {
      for (let c = 0; c < p.TCOLS; c++) {
        const ccx = ox + c * tileSize + tileSize / 2;
        const ccy = oy + r * tileSize + tileSize / 2;

        let rot = this._reduced
          ? 0
          : Math.sin(t * p.IDLE_SPEED + (c + r) * 0.35) * p.IDLE_AMP;

        if (active) {
          const dx = ccx - this.mx, dy = ccy - this.my;
          const d = Math.sqrt(dx * dx + dy * dy);
          const influence = Math.max(0, 1 - d / infR);
          rot += influence * influence * p.INFLUENCE_MAX_ROT;
        }

        ctx.save();
        ctx.translate(ccx, ccy);
        ctx.rotate(rot);
        ctx.strokeRect(-side / 2, -side / 2, side, side);
        ctx.restore();
      }
    }
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  destroy() {
    if (this._onMove) this.canvas.removeEventListener('pointermove', this._onMove);
    if (this._onLeave) this.canvas.removeEventListener('pointerleave', this._onLeave);
    this._onMove = this._onLeave = null;
  }
}
