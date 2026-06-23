'use strict';

class StarfieldTheme {
  constructor() {
    this.contextType = '2d';
    this.stars = [];
    this.shooters = [];
    this.nextShootAt = 0;
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.intensity = 1.0;
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.intensity = opts.intensity || 1.0;
    this._build();
    this.nextShootAt = performance.now() + 15000 + Math.random() * 15000;
  }

  _build() {
    const f = this.intensity;
    this.stars = [];
    const layers = [
      // [count, speed, minSz, maxSz, minA, maxA, isFar]
      [Math.round(220 * f), 0.007, 0.25, 0.75, 0.12, 0.38, true],
      [Math.round(140 * f), 0.022, 0.5,  1.3,  0.28, 0.62, false],
      [Math.round(90  * f), 0.055, 0.9,  2.1,  0.55, 1.0,  false],
    ];

    for (const [count, speed, minSz, maxSz, minA, maxA, isFar] of layers) {
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        const color = roll < 0.74 ? '#ffffff' : roll < 0.91 ? '#cfe0ff' : '#ffe6c8';
        const sz = minSz + Math.random() * (maxSz - minSz);
        const bright = !isFar && sz > 1.4 && Math.random() < 0.35;
        this.stars.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          sz, color, bright,
          baseAlpha: minA + Math.random() * (maxA - minA),
          speed,
          twPhase: Math.random() * Math.PI * 2,
          twSpeed: 0.25 + Math.random() * 1.1,
          twAmt:   0.04 + Math.random() * 0.18,
        });
      }
    }
  }

  draw(ts) {
    const { ctx, w, h } = this;
    const t = ts * 0.001;

    ctx.fillStyle = '#000005';
    ctx.fillRect(0, 0, w, h);

    for (const s of this.stars) {
      s.x += s.speed;
      if (s.x > w + 4) s.x = -4;

      const twinkle = 1 - s.twAmt + s.twAmt * Math.sin(t * s.twSpeed + s.twPhase);
      const alpha = Math.max(0, Math.min(1, s.baseAlpha * twinkle));

      if (s.bright) {
        // Soft additive bloom ring
        const bloom = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.sz * 5.5);
        bloom.addColorStop(0, `rgba(255,255,255,${(alpha * 0.35).toFixed(3)})`);
        bloom.addColorStop(0.3, `rgba(200,220,255,${(alpha * 0.12).toFixed(3)})`);
        bloom.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.sz * 5.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.sz, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Spawn shooting star
    if (ts >= this.nextShootAt) {
      this._spawnShooter();
      this.nextShootAt = ts + 15000 + Math.random() * 15000;
    }
    this._drawShooters();
  }

  _spawnShooter() {
    const angle = (Math.random() * 30 - 15) * Math.PI / 180;
    const spd = 9 + Math.random() * 7;
    this.shooters.push({
      x: Math.random() * this.w * 0.75,
      y: Math.random() * this.h * 0.45,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd + 0.8,
      len: 90 + Math.random() * 110,
      life: 1.0,
      width: 0.9 + Math.random() * 0.6,
    });
  }

  _drawShooters() {
    const { ctx } = this;
    this.shooters = this.shooters.filter(s => {
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 0.014;
      if (s.life <= 0 || s.x > this.w + 50 || s.y > this.h + 50) return false;

      const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      const nx = s.vx / spd, ny = s.vy / spd;
      const tx = s.x - nx * s.len, ty = s.y - ny * s.len;

      const grad = ctx.createLinearGradient(s.x, s.y, tx, ty);
      grad.addColorStop(0, `rgba(255,255,255,${(s.life * 0.95).toFixed(3)})`);
      grad.addColorStop(0.12, `rgba(200,220,255,${(s.life * 0.65).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(180,210,255,0)');

      ctx.globalAlpha = s.life;
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.width * s.life;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return true;
    });
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this._build();
  }

  destroy() {
    this.stars = [];
    this.shooters = [];
  }
}
