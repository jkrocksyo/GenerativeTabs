'use strict';

// Double Pendulum — a live chaotic double-pendulum simulation. The two arms are
// bright lines (pivot→bob1→bob2); the lower bob leaves a fading colored trail
// (old = dim/blue, new = bright/warm) so the chaos reads as a path. No two runs
// look alike. Background is fully redrawn each frame; only the trail persists.

// ── Tunable parameters ──────────────────────────────────────────────────────
const DOUBLE_PENDULUM_PARAMS = {
  m1: 1, m2: 1,          // masses
  L1: 1, L2: 1,          // arm lengths (unitless; scaled to ARM_PX on screen)
  G: 9.8,                // gravity
  ARM_FRAC: 0.20,        // ARM_PX = min(W, H) * ARM_FRAC
  SUBSTEPS: 6,           // integration substeps per frame (stiff/chaotic sim)
  TRAIL_LEN: 420,        // trailing points from the lower bob
  TH1_0: 2.4, TH2_0: 2.5,// initial angles (classic "small perturbation" start)
  PIVOT_Y: 0.42,         // pivot height as a fraction of H
};

class DoublePendulumTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.p = Object.assign({}, DOUBLE_PENDULUM_PARAMS);
    this._lastTs = null;
    this._prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._settled = false;

    this._reset();
  }

  _reset() {
    const p = this.p;
    this.th1 = p.TH1_0;
    this.th2 = p.TH2_0;
    this.w1 = 0;
    this.w2 = 0;
    this.trail = [];   // {x, y} of the lower bob, oldest → newest
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.speed = opts.speed || 1.0;
    this.intensity = opts.intensity || 1.0;
    this._lastTs = null;
    this._settled = false;
    this._reset();
  }

  // One semi-implicit Euler step (standard double-pendulum equations).
  _step(h) {
    const p = this.p;
    const { m1, m2, L1, L2, G } = p;
    const th1 = this.th1, th2 = this.th2, w1 = this.w1, w2 = this.w2;
    const d = th1 - th2;
    const cosd = Math.cos(d), sind = Math.sin(d);

    const den1 = (m1 + m2) * L1 - m2 * L1 * cosd * cosd;
    const a1 = (m2 * L1 * w1 * w1 * sind * cosd
              + m2 * G * Math.sin(th2) * cosd
              + m2 * L2 * w2 * w2 * sind
              - (m1 + m2) * G * Math.sin(th1)) / den1;

    const den2 = (L2 / L1) * den1;
    const a2 = (-m2 * L2 * w2 * w2 * sind * cosd
              + (m1 + m2) * G * Math.sin(th1) * cosd
              - (m1 + m2) * L1 * w1 * w1 * sind
              - (m1 + m2) * G * Math.sin(th2)) / den2;

    this.w1 = w1 + a1 * h;   // semi-implicit: velocities first, then angles
    this.w2 = w2 + a2 * h;
    this.th1 = th1 + this.w1 * h;
    this.th2 = th2 + this.w2 * h;
  }

  _bobPos() {
    const p = this.p;
    const ARM = Math.min(this.w, this.h) * p.ARM_FRAC;
    const pivotX = this.w / 2, pivotY = this.h * p.PIVOT_Y;
    const x1 = pivotX + Math.sin(this.th1) * ARM;
    const y1 = pivotY + Math.cos(this.th1) * ARM;
    const x2 = x1 + Math.sin(this.th2) * ARM;
    const y2 = y1 + Math.cos(this.th2) * ARM;
    return { pivotX, pivotY, x1, y1, x2, y2, ARM };
  }

  // Advance the sim by dt seconds, then record the lower bob into the trail.
  _advanceFrame(dt) {
    const p = this.p;
    const hStep = dt / p.SUBSTEPS;
    for (let s = 0; s < p.SUBSTEPS; s++) this._step(hStep);

    const { x2, y2 } = this._bobPos();
    this.trail.push({ x: x2, y: y2 });
    const maxLen = this._prefersReduced ? Math.min(160, p.TRAIL_LEN) : p.TRAIL_LEN;
    while (this.trail.length > maxLen) this.trail.shift();
  }

  draw(ts) {
    const { ctx, w, h } = this;

    // Delta time, clamped so a tab-resume spike can't blow up the integrator.
    // On resume we've reset _lastTs (see init/visibility), so no gap is integrated.
    if (this._lastTs === null) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    if (dt < 0) dt = 0;
    if (dt > 0.02) dt = 0.02;
    dt *= this.speed;

    if (this._prefersReduced) {
      // The engine won't loop under reduced motion, so build a representative
      // frozen frame once (a settled chaotic path) instead of a bare still.
      if (!this._settled) {
        this._settled = true;
        for (let fr = 0; fr < 600; fr++) this._advanceFrame(0.016);
      }
    } else {
      this._advanceFrame(dt);
    }

    // Background solid each frame (only the trail buffer persists).
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0a0d1a');
    bg.addColorStop(1, '#03040b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const { pivotX, pivotY, x1, y1, x2, y2 } = this._bobPos();

    // Trail: oldest dim/blue → newest bright/warm, additive so it glows.
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0022);
    ctx.lineCap = 'round';
    const tr = this.trail, n = tr.length;
    for (let i = 1; i < n; i++) {
      const f = i / n; // 0 old → 1 new
      const r = Math.round(70 + 185 * f);
      const g = Math.round(120 + 90 * f);
      const b = Math.round(255 - 110 * f);
      const a = (0.06 + 0.6 * f).toFixed(3);
      ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
      ctx.beginPath();
      ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
      ctx.lineTo(tr[i].x, tr[i].y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Arms.
    ctx.strokeStyle = 'rgba(222,236,255,0.92)';
    ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.004);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Pivot dot + the two bobs (lower bob larger, warm).
    const bobR = Math.max(2, Math.min(w, h) * 0.006);
    ctx.fillStyle = 'rgba(200,215,255,0.9)';
    this._dot(pivotX, pivotY, bobR * 0.6);
    ctx.fillStyle = 'rgba(185,208,255,0.95)';
    this._dot(x1, y1, bobR * 0.95);
    ctx.fillStyle = 'rgba(255,236,208,0.98)';
    this._dot(x2, y2, bobR * 1.45);
  }

  _dot(x, y, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    // Trail points are in old screen coordinates; drop them so the path doesn't
    // jump. The sim state (angles) is resolution-independent and continues.
    this.trail = [];
  }

  destroy() {
    this.trail = [];
  }
}
