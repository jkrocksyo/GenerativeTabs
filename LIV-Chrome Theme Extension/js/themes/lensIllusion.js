'use strict';

// Lens Illusion — a plain dot grid that bulges outward around the cursor like a
// magnifying lens: each dot is pushed away from the cursor proportionally to
// its own distance from it, so the whole plane reads as a deformable surface
// rather than dots sliding toward a point. A faint idle "breathe" shimmers the
// dot sizes. All dots batch into one Path2D and fill once (per-dot fill is a
// perf cliff). Coordinates are canvas pixels; cursor tracked with an active flag.

// ── Tunable parameters ──────────────────────────────────────────────────────
const LENS_ILLUSION_PARAMS = {
  LROWS:          28,     // rows across the height set the dot spacing; columns fill the width
  WARP_FRAC:      0.24,   // lens radius vs min(W, H)
  BULGE_STRENGTH: 0.9,    // how strongly dots push outward at the cursor
  BREATHE_AMP:    0.02,   // idle size shimmer amplitude
  BREATHE_SPEED:  0.5,    // idle size shimmer speed
};

class LensIllusionTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.p = Object.assign({}, LENS_ILLUSION_PARAMS);
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
    this._palette = interactivePalette(opts.scenePalette);
    if (!this._reduced) this._attach();
  }

  // Switch colour palette live (from the picker).
  setPreset(name) { this._palette = interactivePalette(name); }

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

    const pal = this._palette;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);

    // Spacing is driven by the row count over the height; columns are then
    // derived to tile the full width (plus one dot of overscan each side) so
    // there is never blank space on wide displays.
    const spacing = H / p.LROWS;
    const cols = Math.ceil(W / spacing) + 2;
    const rows = p.LROWS + 2;
    const ox = (W - (cols - 1) * spacing) / 2;
    const oy = (H - (rows - 1) * spacing) / 2;
    const warpR = Math.min(W, H) * p.WARP_FRAC;
    const baseDot = Math.max(1.2, Math.min(W, H) * 0.0018);

    const active = this.mouseActive && !this._reduced;
    const mx = this.mx, my = this.my;

    const path = new Path2D();
    for (let r = 0; r < rows; r++) {
      const gy = oy + r * spacing;
      for (let c = 0; c < cols; c++) {
        const gx = ox + c * spacing;

        let px = gx, py = gy;
        if (active) {
          const dx = gx - mx, dy = gy - my;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < warpR && d >= 0.01) {
            const k = 1 - d / warpR;
            const factor = k * k;                 // smooth falloff, 1 at cursor
            const push = 1 + p.BULGE_STRENGTH * factor;
            px = mx + dx * push;                  // push away, proportional to own distance
            py = my + dy * push;
          }
        }

        const breathe = this._reduced
          ? 1
          : 1 + p.BREATHE_AMP * Math.sin(t * p.BREATHE_SPEED + gx * 0.01 + gy * 0.01);
        const s = baseDot * breathe;
        const half = s * 0.5;
        path.rect(px - half, py - half, s, s);
      }
    }

    // Grade the dot field from the primary colour to its accent across the frame.
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, pal.dot);
    grad.addColorStop(1, pal.accent);
    ctx.fillStyle = grad;
    ctx.fill(path);
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
