'use strict';

class AuroraTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.intensity = 1.0;
    this.rays = [];
    this._bgCache = null;
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
    const w = this.w, h = this.h;

    const palettes = [
      [43,  255, 136],  // bright green
      [31,  209, 196],  // teal
      [138, 92,  255],  // violet
      [100, 255, 180],  // mint
      [20,  220, 160],  // sea green
      [60,  180, 255],  // ice blue
    ];

    // Static stars for background cache
    const stars = Array.from({ length: Math.round(200 * f) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.65,
      r: 0.25 + Math.random() * 0.85,
      a: 0.15 + Math.random() * 0.5,
    }));

    // Aurora rays — many thin vertical gradient strips grouped into 2–3 bands
    this.rays = [];
    const rayCount = Math.round(90 * f);

    const bandCount = 2 + (Math.random() > 0.5 ? 1 : 0);
    const bands = Array.from({ length: bandCount }, (_, i) => ({
      centerX: (0.18 + (i / (bandCount - 0.5)) * 0.64) * w,
      spread:  (0.16 + Math.random() * 0.12) * w,
    }));

    for (let i = 0; i < rayCount; i++) {
      const band  = bands[i % bands.length];
      const baseX = band.centerX + (Math.random() - 0.5) * band.spread * 2;
      const pal   = palettes[Math.floor(Math.random() * palettes.length)];

      this.rays.push({
        baseX,
        topY:       (0.02 + Math.random() * 0.16) * h,
        rayH:       (0.28 + Math.random() * 0.42) * h,
        width:      (0.005 + Math.random() * 0.02) * w,
        color:      pal,
        alpha:      0.04 + Math.random() * 0.16,
        swayAmt:    (0.007 + Math.random() * 0.022) * w,
        swayFreq:   0.03 + Math.random() * 0.10,
        swayPhase:  Math.random() * Math.PI * 2,
        heightFreq: 0.025 + Math.random() * 0.065,
        heightPhase:Math.random() * Math.PI * 2,
      });
    }

    this._buildBgCache(stars);
  }

  _buildBgCache(stars) {
    const oc = document.createElement('canvas');
    oc.width = this.w; oc.height = this.h;
    const octx = oc.getContext('2d');

    // Night sky gradient
    const bg = octx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0,    '#05060a');
    bg.addColorStop(0.5,  '#071018');
    bg.addColorStop(0.85, '#0a1a2f');
    bg.addColorStop(1,    '#0c1f38');
    octx.fillStyle = bg;
    octx.fillRect(0, 0, this.w, this.h);

    // Stars
    octx.fillStyle = '#ffffff';
    for (const s of stars) {
      octx.globalAlpha = s.a;
      octx.beginPath();
      octx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      octx.fill();
    }
    octx.globalAlpha = 1;

    // Mountain silhouette
    const hz = this.h * 0.885;
    octx.fillStyle = '#020305';
    octx.beginPath();
    octx.moveTo(0, this.h);
    for (let x = 0; x <= this.w; x += 4) {
      const y = hz
        + Math.sin(x * 0.0055)         * this.h * 0.022
        + Math.sin(x * 0.012  + 1.3)   * this.h * 0.013
        + Math.sin(x * 0.0028 + 0.7)   * this.h * 0.034;
      octx.lineTo(x, y);
    }
    octx.lineTo(this.w, this.h);
    octx.closePath();
    octx.fill();

    this._bgCache = oc;
  }

  draw(ts) {
    const { ctx, w, h } = this;
    const t = ts * 0.001;

    ctx.drawImage(this._bgCache, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const ray of this.rays) {
      // Sway horizontally
      const x = ray.baseX + Math.sin(t * ray.swayFreq + ray.swayPhase) * ray.swayAmt;
      // Pulse height slightly
      const rayH = ray.rayH * (0.82 + 0.18 * Math.sin(t * ray.heightFreq + ray.heightPhase));
      const topY = ray.topY;
      const [r, g, b] = ray.color;
      const a = ray.alpha;

      // Vertical gradient: fade in from top, peak, fade to bottom
      const grad = ctx.createLinearGradient(0, topY, 0, topY + rayH);
      grad.addColorStop(0,    `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.08, `rgba(${r},${g},${b},${(a * 0.35).toFixed(3)})`);
      grad.addColorStop(0.28, `rgba(${r},${g},${b},${a.toFixed(3)})`);
      grad.addColorStop(0.58, `rgba(${r},${g},${b},${(a * 0.6).toFixed(3)})`);
      grad.addColorStop(0.84, `rgba(${r},${g},${b},${(a * 0.12).toFixed(3)})`);
      grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);

      ctx.fillStyle = grad;
      ctx.fillRect(x - ray.width * 0.5, topY, ray.width, rayH);
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
    this.rays = [];
    this._bgCache = null;
  }
}
