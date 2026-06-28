'use strict';

class HyperspaceTheme {
  constructor() {
    this.contextType = '2d';
    this.stars = [];
    this.canvas = null; this.ctx = null;
    this.w = 0; this.h = 0;
    this.intensity = 1.0;
    this.speed = 1.0;
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

  _build() {
    const count = Math.round(380 * this.intensity);
    this.stars = Array.from({ length: count }, () => this._newStar(true));
  }

  _newStar(scatter = false) {
    const roll = Math.random();
    const color = roll < 0.65 ? [255, 255, 255]
      : roll < 0.82 ? [180, 220, 255]
      : [255, 240, 190];
    return {
      theta: Math.random() * Math.PI * 2,
      r: scatter ? 5 + Math.random() * Math.max(this.w, this.h) * 0.5 : 2 + Math.random() * 30,
      speed: 0.006 + Math.random() * 0.010,
      color,
      alpha: 0.5 + Math.random() * 0.5,
      width: 0.35 + Math.random() * 1.1,
    };
  }

  draw(ts) {
    const { ctx, w, h } = this;
    const cx = w / 2, cy = h / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy) * 1.12;

    // Partial fade creates motion-blur trails
    ctx.fillStyle = 'rgba(0, 0, 8, 0.2)';
    ctx.fillRect(0, 0, w, h);

    ctx.lineCap = 'round';
    for (const s of this.stars) {
      const prevR = s.r;
      s.r += s.r * s.speed * this.speed;

      if (s.r > maxR) {
        Object.assign(s, this._newStar(false));
        continue;
      }

      const prog = Math.min(1, prevR / (maxR * 0.25));
      const x1 = cx + Math.cos(s.theta) * prevR;
      const y1 = cy + Math.sin(s.theta) * prevR;
      const x2 = cx + Math.cos(s.theta) * s.r;
      const y2 = cy + Math.sin(s.theta) * s.r;
      const [r, g, b] = s.color;

      ctx.globalAlpha = s.alpha * prog;
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = s.width * (0.4 + prog * 2.0);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this._build();
  }

  destroy() { this.stars = []; }
}
