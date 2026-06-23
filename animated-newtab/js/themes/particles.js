'use strict';

class ParticlesTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.intensity = 1.0;
    this.orbs = [];
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.intensity = opts.intensity || 1.0;
    this._build();
  }

  _build() {
    const f = this.intensity;
    const n = Math.round(95 * f);
    this.orbs = [];

    const colors = [
      [100, 160, 255],  // soft blue
      [130, 100, 255],  // violet
      [80,  200, 220],  // cyan
      [160, 120, 255],  // lavender
      [100, 220, 180],  // teal
    ];

    for (let i = 0; i < n; i++) {
      const [r, g, b] = colors[i % colors.length];
      const speed = (0.08 + Math.random() * 0.18) * Math.max(0.5, f);
      const angle = Math.random() * Math.PI * 2;
      this.orbs.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: [r, g, b],
        radius: 1.8 + Math.random() * 3.2,
        baseAlpha: 0.35 + Math.random() * 0.45,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.4 + Math.random() * 0.8,
        pulseAmt: 0.08 + Math.random() * 0.14,
      });
    }
  }

  draw(ts) {
    const { ctx, w, h } = this;
    const t = ts * 0.001;

    // Shifting dark background
    const bgPhase = t * 0.03;
    const bg = ctx.createRadialGradient(
      w * (0.5 + 0.15 * Math.sin(bgPhase)),
      h * (0.5 + 0.12 * Math.cos(bgPhase * 0.7)),
      0,
      w * 0.5, h * 0.5,
      Math.max(w, h) * 0.75
    );
    bg.addColorStop(0, '#0e1022');
    bg.addColorStop(0.6, '#070710');
    bg.addColorStop(1, '#040408');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Update positions
    for (const o of this.orbs) {
      o.x += o.vx;
      o.y += o.vy;
      // Wrap around
      if (o.x < -10) o.x = w + 10;
      if (o.x > w + 10) o.x = -10;
      if (o.y < -10) o.y = h + 10;
      if (o.y > h + 10) o.y = -10;
    }

    // Connection lines (capped distance, capped count)
    const maxDist = Math.min(w, h) * 0.14;
    const maxConnPerOrb = 4;

    ctx.lineWidth = 0.6;
    ctx.lineCap = 'round';

    for (let i = 0; i < this.orbs.length; i++) {
      const a = this.orbs[i];
      let connCount = 0;
      for (let j = i + 1; j < this.orbs.length && connCount < maxConnPerOrb; j++) {
        const b = this.orbs[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const strength = (1 - dist / maxDist) * 0.18;
          const [ar, ag, ab] = a.r;
          ctx.strokeStyle = `rgba(${ar},${ag},${ab},${strength.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          connCount++;
        }
      }
    }

    // Draw orbs with glow
    for (const o of this.orbs) {
      const pulse = 1 - o.pulseAmt + o.pulseAmt * Math.sin(t * o.pulseSpeed + o.pulsePhase);
      const alpha = o.baseAlpha * pulse;
      const [r, g, b] = o.r;
      const rad = o.radius * pulse;

      // Glow
      const glow = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, rad * 5);
      glow.addColorStop(0, `rgba(${r},${g},${b},${(alpha * 0.4).toFixed(3)})`);
      glow.addColorStop(0.3, `rgba(${r},${g},${b},${(alpha * 0.12).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(o.x, o.y, rad * 5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(o.x, o.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    // Clamp positions to new bounds
    for (const o of this.orbs) {
      o.x = Math.min(o.x, w);
      o.y = Math.min(o.y, h);
    }
  }

  destroy() {
    this.orbs = [];
  }
}
