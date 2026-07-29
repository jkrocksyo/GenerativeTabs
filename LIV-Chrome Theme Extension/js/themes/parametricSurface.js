'use strict';

// Shared renderer for rotating parametric-surface wireframes (Torus Wave,
// Harmonic Sphere, …). A subclass supplies ONLY:
//   - lattice resolution (uSeg × vSeg) and parameter ranges (uRange, vRange)
//   - viewing params: rotSpeed, tilt, perspK
//   - a _point(u, v, t, out) that writes the surface point into out[0..2]
// Everything below — build lattice → center → normalize by extent → rotate
// around Y → tilt around X → perspective-project → depth-shaded wireframe — is
// shared and identical across scenes.

class ParametricSurfaceScene {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.t = 0;
    this._lastTs = null;

    // Defaults; every subclass overrides these in its own constructor.
    this.uSeg = 48;
    this.vSeg = 24;
    this.uRange = [0, Math.PI * 2];
    this.vRange = [0, Math.PI * 2];
    this.rotSpeed = 0.11;
    this.tilt = 0.9;
    this.perspK = 0.13;

    this._nu = 0;
    this._nv = 0;
    this._raw = null;   // centered lattice points (x,y,z) flat
    this._sx = null;    // projected screen x per point
    this._sy = null;
    this._sz = null;    // post-tilt z per point (for depth shading)
    this._tmp = new Float32Array(3);
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.speed = opts.speed || 1.0;
    this.intensity = opts.intensity || 1.0;
    this._alloc();
  }

  // Lattice includes both endpoints → (uSeg+1)×(vSeg+1). Density eases down on
  // small viewports so the wire stays light there.
  _alloc() {
    const shortSide = Math.min(this.w, this.h);
    const f = shortSide < 700 ? Math.max(0.5, shortSide / 700) : 1;
    this._nu = Math.max(8, Math.round(this.uSeg * f)) + 1;
    this._nv = Math.max(8, Math.round(this.vSeg * f)) + 1;
    const n = this._nu * this._nv;
    this._raw = new Float32Array(n * 3);
    this._sx = new Float32Array(n);
    this._sy = new Float32Array(n);
    this._sz = new Float32Array(n);
  }

  // Subclasses implement this — the only thing that differs between scenes.
  _point(u, v, t, out) { out[0] = out[1] = out[2] = 0; }

  draw(ts) {
    // Delta-timed accumulation: independent of frame rate / frame count, works
    // with real timestamps or the preview's synthetic steps; big gaps clamped.
    if (this._lastTs === null) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    if (dt < 0 || dt > 0.1) dt = 0.016;
    this.t += dt * this.speed;

    const { ctx, w, h } = this;
    const t = this.t;
    const NU = this._nu, NV = this._nv;
    const count = NU * NV;
    const raw = this._raw;
    const out = this._tmp;

    // Opaque dark backdrop, fully redrawn each frame (clean surface, no trail).
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#070b16');
    bg.addColorStop(1, '#02030a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 1) Build the lattice, accumulate the mean.
    const u0 = this.uRange[0], du = (this.uRange[1] - this.uRange[0]) / (NU - 1);
    const v0 = this.vRange[0], dv = (this.vRange[1] - this.vRange[0]) / (NV - 1);
    let mx = 0, my = 0, mz = 0;
    for (let i = 0; i < NU; i++) {
      const u = u0 + i * du;
      for (let j = 0; j < NV; j++) {
        const v = v0 + j * dv;
        this._point(u, v, t, out);
        const k = (i * NV + j) * 3;
        raw[k] = out[0]; raw[k + 1] = out[1]; raw[k + 2] = out[2];
        mx += out[0]; my += out[1]; mz += out[2];
      }
    }
    mx /= count; my /= count; mz /= count;

    // 2) Center on the mean, and 3) find the extent (max distance from center)
    //    so the shape fits regardless of its own geometry.
    let ext2 = 0;
    for (let k = 0; k < count * 3; k += 3) {
      const x = raw[k] - mx, y = raw[k + 1] - my, z = raw[k + 2] - mz;
      raw[k] = x; raw[k + 1] = y; raw[k + 2] = z;
      const d2 = x * x + y * y + z * z;
      if (d2 > ext2) ext2 = d2;
    }
    const ext = Math.sqrt(ext2) || 1;

    // 4) Rotate around Y, 5) tilt around X, 6) perspective-project.
    const ay = this.rotSpeed * t;
    const cosY = Math.cos(ay), sinY = Math.sin(ay);
    const cosT = Math.cos(this.tilt), sinT = Math.sin(this.tilt);
    const scale = Math.min(w, h) * 0.60 / ext;
    const cx = w / 2, cy = h / 2;
    const sxA = this._sx, syA = this._sy, szA = this._sz;
    for (let pI = 0; pI < count; pI++) {
      const k = pI * 3;
      const x = raw[k], y = raw[k + 1], z = raw[k + 2];
      const xr = x * cosY + z * sinY;         // rotate around Y
      const zr = -x * sinY + z * cosY;
      const yt = y * cosT - zr * sinT;         // tilt around X
      const zt = y * sinT + zr * cosT;
      const persp = 1 / (1 + (zt + ext * 1.6) * this.perspK);
      sxA[pI] = cx + xr * scale * persp;
      syA[pI] = cy + yt * scale * persp;
      szA[pI] = zt;
    }

    // 7) Draw the wireframe (segments to i+1 and j+1), depth-shaded, additive.
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0013);
    const invDen = 1 / (2 * ext);
    for (let i = 0; i < NU; i++) {
      for (let j = 0; j < NV; j++) {
        const pI = i * NV + j;
        const px = sxA[pI], py = syA[pI], pz = szA[pI];
        if (i < NU - 1) {
          const q = pI + NV;
          this._seg(px, py, sxA[q], syA[q], (pz + szA[q]) * 0.5, ext, invDen);
        }
        if (j < NV - 1) {
          const q = pI + 1;
          this._seg(px, py, sxA[q], syA[q], (pz + szA[q]) * 0.5, ext, invDen);
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Shared depth ramp: near = bright/warm, far = dim/blue.
  _seg(x1, y1, x2, y2, zAvg, ext, invDen) {
    let d = (zAvg + ext) * invDen;      // depth 0–1 across [-ext, ext]
    if (d < 0) d = 0; else if (d > 1) d = 1;
    const r = Math.round(60 + 110 * d + 60 * d * d);
    const g = Math.round(150 + 70 * d + 30 * d * d);
    const a = (0.22 + 0.6 * d).toFixed(3);
    const ctx = this.ctx;
    ctx.strokeStyle = `rgba(${r},${g},255,${a})`;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this._alloc();
  }

  destroy() {
    this._raw = this._sx = this._sy = this._sz = null;
  }
}
