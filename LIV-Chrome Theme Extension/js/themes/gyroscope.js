'use strict';

// Gyroscope — five nested spheres of rings, natively reimplemented in Canvas 2D
// (the original is a pure CSS/HTML transform stack — see gyroscope-standalone.html
// for the attribution). Each sphere is 5 flat rings; every sphere slowly spins
// about the view Z axis while each ring inside it independently spins about Y on
// a staggered phase, so the 5 co-radial rings read as one tumbling globe rather
// than 5 overlapping circles. Alternating spheres counter-rotate. A shared
// perspective divide makes near arcs larger and far arcs smaller, and the whole
// stack is painter-sorted by depth so the translucent wireframe interleaves
// correctly. The four outer spheres (4 rings each) tumble; the very centre is a
// still black hub ringed with a soft white border light that never moves.
//
// One projection: a point starts as a circle in the screen (XY) plane, is
// rotated about Y by the ring's own spin, rotated about Z by the sphere's spin,
// then perspective-divided about the centre. Rings are collected into one list
// and drawn far-to-near.

// ── Tunable parameters ───────────────────────────────────────────────────────
const GYRO_PARAMS = {
  N_SPHERES:       5,     // shell 0 is the still centre hub; shells 1–4 tumble
  RINGS_PER_SPHERE: 4,
  BASE_R:          1.0,   // centre-hub radius (world units); each shell doubles out
  R_GROWTH:        2.0,   // shell-to-shell radius ratio (matches 2/4/8/16/32em)
  SPIN_Z_PERIOD:   7.0,   // seconds per sphere Z revolution
  SPIN_Y_PERIOD:   7.0,   // seconds per ring Y revolution
  Y_STAGGER:       0.1,   // cycle fraction between rings in a sphere (fans the globe)
  RING_SEG:        96,    // polyline samples per ring
  PERSP_DIST:      2.6,   // perspective distance in units of outer radius (bigger = flatter)
  FIT_FRAC:        0.42,  // outer sphere radius vs min(w, h)
};

const GYRO_COLORS = {
  core: [255, 255, 255],  // ring stroke
  glow: [140, 190, 255],  // bluish bloom halo
};

class GyroscopeTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.p = Object.assign({}, GYRO_PARAMS);
    this.t = 0;
    this._lastTs = null;

    this._spheres = null;   // per-sphere {R, zDir, rings:[{seg buffer}]}
    this._rmax = 1;
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.speed = (opts && opts.speed) || 1.0;
    this.intensity = (opts && opts.intensity) || 1.0;
    this._build();
  }

  // Ring geometry is fixed in each ring's own frame: a unit circle in the XY
  // plane, sampled once. The Y/Z spins and the perspective divide are applied
  // per frame in _ringPoint / _project.
  _build() {
    const P = this.p;
    this._spheres = [];
    let R = P.BASE_R;
    this._rmax = R * Math.pow(P.R_GROWTH, P.N_SPHERES - 1);
    for (let i = 0; i < P.N_SPHERES; i++) {
      const rings = [];
      for (let j = 0; j < P.RINGS_PER_SPHERE; j++) {
        // Unit-circle samples (cosθ, sinθ) reused every frame, scaled by R.
        const cos = new Float32Array(P.RING_SEG + 1);
        const sin = new Float32Array(P.RING_SEG + 1);
        for (let s = 0; s <= P.RING_SEG; s++) {
          const a = (s / P.RING_SEG) * Math.PI * 2;
          cos[s] = Math.cos(a); sin[s] = Math.sin(a);
        }
        rings.push({ cos, sin, ringIdx: j });
      }
      this._spheres.push({
        R,
        sphereIdx: i,
        // 2nd and 4th spheres (0-based 1 & 3) counter-rotate on Z.
        zDir: (i % 2 === 1) ? -1 : 1,
        rings,
      });
      R *= P.R_GROWTH;
    }
  }

  // A ring sample: unit circle scaled to R, rotated about Y (ring spin), then
  // about Z (sphere spin). Returns world [x, y, z]; perspective is separate.
  _ringPoint(R, c, s, cY, sY, cZ, sZ) {
    const x0 = R * c, y0 = R * s;      // circle in the XY plane (z = 0)
    const x1 = x0 * cY;                // rotate about Y
    const z1 = -x0 * sY;
    const x2 = x1 * cZ - y0 * sZ;      // rotate about Z (screen plane)
    const y2 = x1 * sZ + y0 * cZ;
    return [x2, y2, z1];
  }

  // World → screen. Straight-on camera, perspective origin at centre: nearer
  // (positive z) arcs enlarge, far arcs shrink. D stays > rmax so the divide
  // never blows up.
  _project(x, y, z) {
    const persp = this._D / (this._D - z);
    return {
      sx: this._ox + x * this._scale * persp,
      sy: this._oy - y * this._scale * persp,
      z,
      persp,
    };
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

    // Frame constants.
    this._scale = Math.min(w, h) * P.FIT_FRAC / this._rmax;
    this._D = this._rmax * P.PERSP_DIST;
    this._ox = w / 2;
    this._oy = h / 2;

    // Backdrop — pure black so the additive wireframe blooms against real dark.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const coreW = Math.max(1, Math.min(w, h) * 0.0011);
    const rmax = this._rmax;

    // Collect every ring as a projected polyline + average depth, then paint
    // far-to-near so the translucent rings interleave correctly.
    const prims = [];
    const zSpeed = (Math.PI * 2) / P.SPIN_Z_PERIOD;
    const ySpeed = (Math.PI * 2) / P.SPIN_Y_PERIOD;
    for (const sph of this._spheres) {
      // Sphere 0 is the still centre hub, not a tumbling ring set — skip it here.
      if (sph.sphereIdx === 0) continue;
      const zAng = sph.zDir * zSpeed * t;
      const cZ = Math.cos(zAng), sZ = Math.sin(zAng);
      for (const ring of sph.rings) {
        // Each ring leads the previous by Y_STAGGER of a cycle (fans the globe).
        const yAng = ySpeed * t + (ring.ringIdx + 1) * P.Y_STAGGER * Math.PI * 2;
        const cY = Math.cos(yAng), sY = Math.sin(yAng);
        const n = ring.cos.length;
        const xs = new Float32Array(n), ys = new Float32Array(n);
        let zSum = 0;
        for (let s = 0; s < n; s++) {
          const p3 = this._ringPoint(sph.R, ring.cos[s], ring.sin[s], cY, sY, cZ, sZ);
          const pr = this._project(p3[0], p3[1], p3[2]);
          xs[s] = pr.sx; ys[s] = pr.sy; zSum += p3[2];
        }
        const avgZ = zSum / n;
        const depth = Math.min(1, Math.max(0, (avgZ + rmax) / (2 * rmax)));
        prims.push({ xs, ys, z: avgZ, depth });
      }
    }
    prims.sort((a, b) => a.z - b.z);

    const [gr, gg, gb] = GYRO_COLORS.glow;
    for (const pr of prims) {
      const coreA = Math.min(1, (0.32 + 0.5 * pr.depth) * this.intensity);
      const glowA = Math.min(0.9, (0.10 + 0.16 * pr.depth) * this.intensity);

      ctx.globalCompositeOperation = 'lighter';
      // Soft bloom halo underneath…
      ctx.strokeStyle = `rgba(${gr},${gg},${gb},${glowA.toFixed(3)})`;
      ctx.lineWidth = coreW * 3.5;
      this._strokePoly(pr.xs, pr.ys);
      // …and the crisp white ring on top.
      ctx.strokeStyle = `rgba(255,255,255,${coreA.toFixed(3)})`;
      ctx.lineWidth = coreW;
      this._strokePoly(pr.xs, pr.ys);
    }

    this._drawCore(coreW);
    this._drawVignette();
  }

  // The still centre: a constant black hub ringed with a soft white border
  // light. Drawn on top of the tumbling rings so it stays a clean, solid focal
  // point that never moves, regardless of what passes behind it.
  _drawCore(coreW) {
    const ctx = this.ctx;
    const ox = this._ox, oy = this._oy;
    const rCore = this._scale * this.p.BASE_R;

    // Solid black centre — masks the ring arcs crossing the middle.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(ox, oy, rCore, 0, Math.PI * 2);
    ctx.fill();

    // Soft white halo bleeding outward from the rim.
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(ox, oy, rCore * 0.55, ox, oy, rCore * 1.7);
    halo.addColorStop(0, 'rgba(255,255,255,0)');
    halo.addColorStop(0.62, 'rgba(255,255,255,0.34)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(ox, oy, rCore * 1.7, 0, Math.PI * 2);
    ctx.fill();

    // Crisp white border light.
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = coreW * 1.5;
    ctx.beginPath();
    ctx.arc(ox, oy, rCore, 0, Math.PI * 2);
    ctx.stroke();
  }

  _strokePoly(xs, ys) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let s = 1; s < xs.length; s++) ctx.lineTo(xs[s], ys[s]);
    ctx.stroke();
  }

  _drawVignette() {
    const { ctx, w, h } = this;
    ctx.globalCompositeOperation = 'source-over';
    const r = Math.hypot(w, h) / 2;
    const vg = ctx.createRadialGradient(w / 2, h / 2, r * 0.4, w / 2, h / 2, r);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  destroy() {
    this._spheres = null;
  }
}

window.GyroscopeTheme = GyroscopeTheme;
