'use strict';

// Point Sphere — an interactive particle cloud that forms a rotating,
// grain-textured sphere-like shape from a deterministic (i²-seeded) chaotic
// distribution. Particles spring toward a slowly rotating "home" position,
// scatter away from the cursor, and settle back. All particles are batched
// into one Path2D and filled once per frame (per-particle fill is a perf cliff
// at this count). Coordinates are centered device pixels: (0,0) = canvas center.

// ── Tunable parameters ("slow" tuning) ──────────────────────────────────────
const POINT_SPHERE_PARAMS = {
  COUNT:            7000,   // particle count (scaled down on small viewports)
  R_FRAC:           0.36,   // cloud radius vs min(W, H)
  ROT_SPEED:        0.10,   // radians/sec added to the rotation phase
  ATTRACTION:       0.006,  // spring strength back toward home
  DAMPING:          0.88,   // velocity retained per frame
  REPEL_STRENGTH:   14,     // cursor push strength
  REPEL_RADIUS_FRAC: 0.12,  // cursor influence radius vs min(W, H)
};

class PointSphereTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.p = Object.assign({}, POINT_SPHERE_PARAMS);
    this._lastTs = null;
    this.angle = 0;
    this._reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Particle SoA buffers.
    this.count = 0;
    this.x = null; this.y = null; this.vx = null; this.vy = null;
    this.si = null; this.ci = null;   // per-particle sin(i²), cos(i²)

    // Cursor in centered device-pixel space; parked far away = no repulsion.
    this.mx = 1e9;
    this.my = 1e9;
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
    this._build();
    if (!this._reduced) this._attach();
  }

  _attach() {
    const canvas = this.canvas;
    this._onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
      this.mx = (e.clientX - rect.left) * sx - canvas.width / 2;
      this.my = (e.clientY - rect.top) * sy - canvas.height / 2;
    };
    this._onLeave = () => { this.mx = 1e9; this.my = 1e9; };
    canvas.addEventListener('pointermove', this._onMove, { passive: true });
    canvas.addEventListener('pointerleave', this._onLeave, { passive: true });
  }

  _build() {
    const p = this.p;
    const R = Math.min(this.w, this.h) * p.R_FRAC;
    // Scale count to viewport area (7000 is comfortable on desktop) × intensity.
    const areaFactor = Math.min(1, (this.w * this.h) / (1200 * 800));
    const n = Math.max(1500, Math.round(p.COUNT * areaFactor * this.intensity));
    this.count = n;

    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.si = new Float32Array(n);
    this.ci = new Float32Array(n);

    const angle = this.angle;
    for (let i = 0; i < n; i++) {
      const si = Math.sin(i * i), ci = Math.cos(i * i);
      this.si[i] = si;
      this.ci[i] = ci;
      // Start particles already at home so a single still frame is correct.
      this.x[i] = Math.sin(i + angle) * si * R;
      this.y[i] = ci * R;
    }
  }

  draw(ts) {
    if (this._lastTs === null) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    if (dt < 0 || dt > 0.1) dt = 0.016;

    const p = this.p;
    const { ctx, w: W, h: H } = this;
    const R = Math.min(W, H) * p.R_FRAC;
    const repelR = Math.min(W, H) * p.REPEL_RADIUS_FRAC;
    const cx = W / 2, cy = H / 2;

    // Rotation phase is time-based (seconds), so speed is refresh-rate agnostic.
    this.angle += p.ROT_SPEED * dt * this.speed;
    const angle = this.angle;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    const n = this.count;
    const X = this.x, Y = this.y, VX = this.vx, VY = this.vy, SI = this.si, CI = this.ci;
    const ATTR = p.ATTRACTION, DAMP = p.DAMPING, RS = p.REPEL_STRENGTH;
    const mx = this.mx, my = this.my;

    const dot = Math.max(1.2, Math.min(W, H) * 0.0016);
    const half = dot * 0.5;
    const path = new Path2D();

    for (let i = 0; i < n; i++) {
      const homeX = Math.sin(i + angle) * SI[i] * R;
      const homeY = CI[i] * R;

      let vx = VX[i], vy = VY[i];
      vx += (homeX - X[i]) * ATTR;
      vy += (homeY - Y[i]) * ATTR;

      // Cursor repulsion with linear falloff, only inside the radius.
      const dxm = X[i] - mx, dym = Y[i] - my;
      const dist = Math.sqrt(dxm * dxm + dym * dym);
      if (dist < repelR && dist > 0.0001) {
        const f = RS * (1 - dist / repelR);
        const inv = 1 / dist;
        vx += dxm * inv * f;
        vy += dym * inv * f;
      }

      vx *= DAMP; vy *= DAMP;
      const nx = X[i] + vx, ny = Y[i] + vy;
      X[i] = nx; Y[i] = ny; VX[i] = vx; VY[i] = vy;

      path.rect(cx + nx - half, cy + ny - half, dot, dot);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fill(path);
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this._build();
  }

  destroy() {
    if (this._onMove) this.canvas.removeEventListener('pointermove', this._onMove);
    if (this._onLeave) this.canvas.removeEventListener('pointerleave', this._onLeave);
    this._onMove = this._onLeave = null;
    this.x = this.y = this.vx = this.vy = this.si = this.ci = null;
  }
}
