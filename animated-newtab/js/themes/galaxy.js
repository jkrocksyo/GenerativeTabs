'use strict';

class GalaxyTheme {
  constructor() {
    this.contextType = '2d';
    this.particles = [];
    this.bgStars = [];
    this.angle = 0;
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.intensity = 1.0;
    this.speed = 1.0;
    this._offscreen = null; // cached bg star layer
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.intensity = opts.intensity || 1.0;
    this.speed = opts.speed || 1.0;
    this._build();
  }

  _gauss() {
    // Box-Muller — cheap Gaussian sample
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  _build() {
    const f = this.intensity;
    const cx = this.w / 2, cy = this.h / 2;
    const armCount = 3;
    const totalParticles = Math.round(2800 * f);
    const k = 0.28; // spiral tightness

    this.particles = [];

    for (let i = 0; i < totalParticles; i++) {
      const arm = i % armCount;
      const armOffset = (arm / armCount) * Math.PI * 2;
      const t = Math.pow(Math.random(), 0.6) * 4.5 * Math.PI; // denser near center
      const r = Math.exp(k * t) * (this.w * 0.032);

      // Scatter increases with radius
      const scatter = this._gauss() * r * 0.22;
      const scatterAngle = Math.random() * Math.PI * 2;
      const sx = scatter * Math.cos(scatterAngle);
      const sy = scatter * Math.sin(scatterAngle) * 0.5; // flatten vertically a little

      const x = cx + (r + sx) * Math.cos(t + armOffset);
      const y = cy + (r + sy) * Math.sin(t + armOffset);

      // Color: warm core → cool outer
      const normR = Math.min(r / (this.w * 0.35), 1);
      let color;
      if (normR < 0.12) {
        // Core — warm white-amber
        const roll = Math.random();
        color = roll < 0.5 ? '#fff8e8' : roll < 0.8 ? '#ffd580' : '#ffae42';
      } else if (normR < 0.45) {
        // Mid arm — white to pale blue
        const roll = Math.random();
        color = roll < 0.6 ? '#ffffff' : '#cce4ff';
      } else {
        // Outer — cooler blue-white
        const roll = Math.random();
        color = roll < 0.7 ? '#d0e8ff' : '#a8c8ff';
      }

      const alpha = 0.25 + Math.random() * 0.65;
      const size  = 0.3 + Math.random() * (normR < 0.15 ? 1.6 : 0.9);

      // Differential rotation speed — inner orbits faster
      const rotSpeed = 0.00018 / Math.max(0.05, normR * 0.8 + 0.2);

      this.particles.push({ x, y, color, alpha, size, rotSpeed, normR });
    }

    // Background star field
    this.bgStars = Array.from({ length: Math.round(180 * f) }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: 0.25 + Math.random() * 0.6,
      a: 0.08 + Math.random() * 0.25,
    }));

    this.angle = 0;
    this._buildOffscreen();
  }

  _buildOffscreen() {
    // Pre-render static bg stars once
    const oc = document.createElement('canvas');
    oc.width = this.w; oc.height = this.h;
    const octx = oc.getContext('2d');
    octx.fillStyle = '#000000';
    octx.fillRect(0, 0, this.w, this.h);
    octx.fillStyle = '#ffffff';
    for (const s of this.bgStars) {
      octx.globalAlpha = s.a;
      octx.beginPath();
      octx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      octx.fill();
    }
    octx.globalAlpha = 1;
    this._offscreen = oc;
  }

  draw(ts) {
    const { ctx, w, h } = this;
    const cx = w / 2, cy = h / 2;

    // Draw static bg stars from offscreen cache
    ctx.drawImage(this._offscreen, 0, 0);

    // Rotate galaxy
    this.angle += 0.00018 * this.speed;

    ctx.save();
    ctx.translate(cx, cy);

    // Core glow
    const coreR = w * 0.045;
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
    coreGrad.addColorStop(0, 'rgba(255,240,200,0.75)');
    coreGrad.addColorStop(0.3, 'rgba(255,200,100,0.3)');
    coreGrad.addColorStop(0.7, 'rgba(255,160,50,0.08)');
    coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, Math.PI * 2);
    ctx.fill();

    // Draw particles with differential rotation
    for (const p of this.particles) {
      const px = p.x - cx, py = p.y - cy;
      const cos = Math.cos(this.angle * (1 / (p.normR * 0.8 + 0.2)));
      const sin = Math.sin(this.angle * (1 / (p.normR * 0.8 + 0.2)));
      const rx = px * cos - py * sin;
      const ry = px * sin + py * cos;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(rx, ry, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this._build();
  }

  destroy() {
    this.particles = [];
    this.bgStars = [];
    this._offscreen = null;
  }
}
