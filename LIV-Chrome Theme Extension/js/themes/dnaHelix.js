'use strict';

// DNA Helix — a slow double helix drifting upward, natively reimplemented in
// Canvas 2D (the original is a pure CSS/HTML transform stack — see
// dnaHelix-standalone.html for attribution). Two backbones of glowing balls run
// 180° out of phase along a vertical axis; base-pair rungs join them. The
// backbone offset and depth come straight from a sine/cosine of a per-row phase
// (phase = worldY·twist + time·rot), so the whole thing is one cheap parametric
// curve, not a stack of 3D-transformed DOM layers.
//
// The scroll loops seamlessly with no reset seam: every row's Y is wrapped into
// a fixed window each frame and the phase is a pure function of that wrapped Y,
// so a row that wraps top→bottom lands exactly where the helix continues — the
// rows are identical, so the jump is invisible. This is intentionally light:
// modest ball count, one radial gradient per ball, no per-pixel work, no
// stacked filters.

// ── Tunable parameters ───────────────────────────────────────────────────────
const DNA_PARAMS = {
  Y_SPACING:     1.0,   // world distance between base pairs
  VISIBLE_PAIRS: 8.5,   // how many pairs span the viewport height (density)
  HELIX_R:       1.55,  // horizontal radius of the backbones (world)
  BALL_R:        0.34,  // ball radius (world)
  TWIST:         0.6,   // helix turns per Y_SPACING
  SCROLL_SPEED:  0.42,  // base pairs per second the helix drifts upward (slow)
  ROT_SPEED:     0.035, // extra axial rotation, turns per second
  PERSP_DIST:    3.0,   // perspective distance in units of HELIX_R (bigger = flatter)
  RUNG_W:        0.11,  // rung thickness (world)
};

const DNA_COLORS = {
  aBody: [70, 220, 226],  // cyan backbone
  aGlow: [40, 110, 255],  // blue halo
  bBody: [235, 84, 70],   // warm backbone
  bGlow: [255, 55, 55],   // red halo
  rungA: [70, 150, 235],
  rungMid: [225, 228, 238],
  rungB: [225, 100, 88],
};

class DnaHelixTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.p = Object.assign({}, DNA_PARAMS);
    this.t = 0;
    this._lastTs = null;
    this._prims = [];
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.speed = (opts && opts.speed) || 1.0;
    this.intensity = (opts && opts.intensity) || 1.0;
  }

  draw(ts) {
    if (this._lastTs === null) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    if (dt < 0 || dt > 0.1) dt = 0.016;
    this.t += dt * this.speed;

    const { ctx, w, h } = this;
    const P = this.p;
    const t = this.t;

    this._drawBackground();

    const scale = h / (P.VISIBLE_PAIRS * P.Y_SPACING);
    const cx = w / 2, cy = h / 2;
    const D = P.HELIX_R * P.PERSP_DIST;
    const twist = P.TWIST * Math.PI * 2;
    const rot = t * P.ROT_SPEED * Math.PI * 2;
    const rmax = P.HELIX_R;

    // A row lattice tall enough to cover the viewport plus margin, scrolled and
    // wrapped so the helix loops without a seam.
    const worldHalf = (h / scale) / 2 + P.Y_SPACING * 2;
    const count = Math.ceil((worldHalf * 2) / P.Y_SPACING) + 1;
    const totalSpan = count * P.Y_SPACING;
    const top = -totalSpan / 2;
    const scroll = t * P.SCROLL_SPEED * P.Y_SPACING;

    const prims = this._prims;
    prims.length = 0;

    for (let i = 0; i < count; i++) {
      let wy = i * P.Y_SPACING - scroll;
      wy = ((wy - top) % totalSpan + totalSpan) % totalSpan + top;   // wrap into window
      const phase = wy * twist + rot;

      const a = this._node(phase, wy, cx, cy, scale, D, rmax);
      const b = this._node(phase + Math.PI, wy, cx, cy, scale, D, rmax);

      // Rung sits at mid-depth (the two backbones are opposite, so avg z ≈ 0).
      prims.push({ kind: 'rung', a, b, z: (a.z + b.z) * 0.5 });
      prims.push({ kind: 'ball', node: a, strand: 0, z: a.z });
      prims.push({ kind: 'ball', node: b, strand: 1, z: b.z });
    }

    prims.sort((p, q) => p.z - q.z);
    for (let i = 0; i < prims.length; i++) {
      const pr = prims[i];
      if (pr.kind === 'rung') this._drawRung(pr.a, pr.b);
      else this._drawBall(pr.node, pr.strand);
    }

    this._drawVignette();
  }

  _node(phase, wy, cx, cy, scale, D, rmax) {
    const x = Math.sin(phase) * this.p.HELIX_R;
    const z = Math.cos(phase) * this.p.HELIX_R;
    const persp = D / (D - z);
    return {
      sx: cx + x * scale * persp,
      sy: cy + wy * scale,
      r: this.p.BALL_R * scale * persp,
      persp,
      z,
      depth: (z + rmax) / (2 * rmax),   // 0 far … 1 near
    };
  }

  _drawBall(n, strand) {
    const ctx = this.ctx;
    const body = strand === 0 ? DNA_COLORS.aBody : DNA_COLORS.bBody;
    const glow = strand === 0 ? DNA_COLORS.aGlow : DNA_COLORS.bGlow;
    const shade = 0.55 + 0.45 * n.depth;      // near balls brighter
    const r = n.r;

    // Faint additive halo — the box-shadow/drop-shadow stand-in, kept subtle.
    ctx.globalCompositeOperation = 'lighter';
    const haloR = r * 1.55;
    const halo = ctx.createRadialGradient(n.sx, n.sy, r * 0.5, n.sx, n.sy, haloR);
    const ga = (0.04 + 0.07 * n.depth) * this.intensity;
    halo.addColorStop(0, `rgba(${glow[0]},${glow[1]},${glow[2]},${ga.toFixed(3)})`);
    halo.addColorStop(1, `rgba(${glow[0]},${glow[1]},${glow[2]},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(n.sx, n.sy, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Lit sphere: highlight offset to upper-left, body mid, dark rim.
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(
      n.sx - r * 0.35, n.sy - r * 0.35, r * 0.1,
      n.sx, n.sy, r);
    const hi = c => Math.min(255, Math.round(c * shade + 90));
    const mid = c => Math.round(c * shade);
    const rim = c => Math.round(c * shade * 0.4);
    g.addColorStop(0, `rgb(${hi(body[0])},${hi(body[1])},${hi(body[2])})`);
    g.addColorStop(0.55, `rgb(${mid(body[0])},${mid(body[1])},${mid(body[2])})`);
    g.addColorStop(1, `rgb(${rim(body[0])},${rim(body[1])},${rim(body[2])})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Tiny specular pip.
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,255,255,${(0.5 * shade).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(n.sx - r * 0.32, n.sy - r * 0.32, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawRung(a, b) {
    const ctx = this.ctx;
    const C = DNA_COLORS;
    const persp = (a.persp + b.persp) * 0.5;
    const depth = (a.depth + b.depth) * 0.5;
    ctx.globalCompositeOperation = 'source-over';
    const grad = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
    const al = (0.35 + 0.35 * depth).toFixed(3);
    grad.addColorStop(0, `rgba(${C.rungA[0]},${C.rungA[1]},${C.rungA[2]},${al})`);
    grad.addColorStop(0.5, `rgba(${C.rungMid[0]},${C.rungMid[1]},${C.rungMid[2]},${al})`);
    grad.addColorStop(1, `rgba(${C.rungB[0]},${C.rungB[1]},${C.rungB[2]},${al})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = this.p.RUNG_W * (this.h / (this.p.VISIBLE_PAIRS * this.p.Y_SPACING)) * persp;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }

  _drawBackground() {
    const { ctx, w, h } = this;
    ctx.globalCompositeOperation = 'source-over';
    // Deep red → black → deep blue, tilted ~-15° like the CSS gradient. Colours
    // are pre-deepened so no runtime contrast filter is needed.
    const dx = h * 0.13;
    const bg = ctx.createLinearGradient(w / 2 - dx, 0, w / 2 + dx, h);
    bg.addColorStop(0, '#3a0000');
    bg.addColorStop(0.5, '#000000');
    bg.addColorStop(1, '#001a33');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  _drawVignette() {
    const { ctx, w, h } = this;
    ctx.globalCompositeOperation = 'source-over';
    const r = Math.hypot(w, h) / 2;
    const vg = ctx.createRadialGradient(w / 2, h / 2, r * 0.55, w / 2, h / 2, r);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  destroy() {
    this._prims = [];
  }
}

window.DnaHelixTheme = DnaHelixTheme;
