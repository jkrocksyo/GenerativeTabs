'use strict';

class AuroraTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.intensity = 1.0;
    this.stars = [];
    this.curtains = [];
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
    const w = this.w, h = this.h;
    const f = this.intensity;

    // Static stars in upper sky
    const starCount = Math.round(200 * f);
    this.stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.62,
      r: 0.25 + Math.random() * 0.8,
      a: 0.15 + Math.random() * 0.5,
    }));

    // Aurora curtains
    const curtainCount = Math.round(3 * Math.max(0.5, f));
    const palettes = [
      { r: 43,  g: 255, b: 136 }, // green
      { r: 31,  g: 209, b: 196 }, // teal
      { r: 138, g: 92,  b: 255 }, // violet
      { r: 15,  g: 240, b: 200 }, // cyan-green
    ];

    this.curtains = [];
    for (let i = 0; i < curtainCount; i++) {
      const pal = palettes[i % palettes.length];
      // Each curtain has a band of control points defining its "bottom edge"
      // The curtain hangs from top to this undulating bottom line
      const col = palettes[(i + 2) % palettes.length];
      this.curtains.push({
        // horizontal center (0–1)
        cx: 0.15 + (i / curtainCount) * 0.7 + (Math.random() - 0.5) * 0.1,
        // vertical center (0–1) — upper half
        cy: 0.15 + Math.random() * 0.35,
        // width and height as fractions of viewport
        hw: 0.28 + Math.random() * 0.22,
        hh: 0.20 + Math.random() * 0.18,
        pal, col,
        alpha: 0.28 + Math.random() * 0.22,
        // wave parameters for left and right edges
        wavePhase:  Math.random() * Math.PI * 2,
        wavePhase2: Math.random() * Math.PI * 2,
        waveSpeed:  0.00022 + Math.random() * 0.00018,
        waveAmp:    0.03 + Math.random() * 0.04,
        // horizontal drift
        driftSpd: (Math.random() - 0.5) * 0.000055,
        driftX: 0,
      });
    }

    this._buildBgCache();
  }

  _buildBgCache() {
    // Pre-render the static sky gradient + stars
    const oc = document.createElement('canvas');
    oc.width = this.w; oc.height = this.h;
    const octx = oc.getContext('2d');

    // Night sky gradient
    const bg = octx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, '#05060a');
    bg.addColorStop(0.45, '#071018');
    bg.addColorStop(0.8, '#0a1a2f');
    bg.addColorStop(1, '#0c1f35');
    octx.fillStyle = bg;
    octx.fillRect(0, 0, this.w, this.h);

    // Static stars
    octx.fillStyle = '#ffffff';
    for (const s of this.stars) {
      octx.globalAlpha = s.a;
      octx.beginPath();
      octx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      octx.fill();
    }
    octx.globalAlpha = 1;

    // Horizon silhouette — low mountain ridge
    const hz = this.h * 0.88;
    octx.fillStyle = '#020305';
    octx.beginPath();
    octx.moveTo(0, this.h);
    // bumpy horizon using sinusoidal mountains
    for (let x = 0; x <= this.w; x += 6) {
      const ridge = hz
        + Math.sin(x * 0.0055) * this.h * 0.022
        + Math.sin(x * 0.012 + 1.3) * this.h * 0.013
        + Math.sin(x * 0.0028 + 0.7) * this.h * 0.032;
      octx.lineTo(x, ridge);
    }
    octx.lineTo(this.w, this.h);
    octx.closePath();
    octx.fill();

    this._bgCache = oc;
  }

  _curtainPath(ctx, c, ts) {
    const w = this.w, h = this.h;
    const cx = (c.cx + c.driftX) * w;
    const cy = c.cy * h;
    const hw = c.hw * w;   // half-width
    const hh = c.hh * h;  // half-height

    // Number of vertical slices
    const slices = 32;
    const t = ts * 0.001;

    ctx.beginPath();
    // Build curtain as a filled polygon: top strip → bottom undulating edge
    // Left column, top to bottom
    const topY = cy - hh * 0.1; // almost flat top
    const pts = [];
    for (let i = 0; i <= slices; i++) {
      const frac = i / slices;
      const x = cx - hw + frac * hw * 2;
      // Undulate the bottom height for organic look
      const wave = Math.sin(frac * Math.PI * 3 + c.wavePhase + t * c.waveSpeed * 1000)
                 + 0.5 * Math.sin(frac * Math.PI * 7 + c.wavePhase2 + t * c.waveSpeed * 1700);
      const bottomY = cy + hh * (0.6 + 0.4 * wave * c.waveAmp * 10);
      pts.push({ x, topY, bottomY });
    }

    // Draw top edge (flat-ish)
    ctx.moveTo(pts[0].x, pts[0].topY);
    for (let i = 1; i <= slices; i++) ctx.lineTo(pts[i].x, pts[i].topY);
    // Draw bottom edge (undulating), reversed
    for (let i = slices; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].bottomY);
    ctx.closePath();
  }

  draw(ts) {
    const { ctx, w, h } = this;
    ctx.drawImage(this._bgCache, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const c of this.curtains) {
      c.driftX += c.driftSpd;
      c.wavePhase += c.waveSpeed;

      // Create vertical gradient for the curtain
      const cy = c.cy * h;
      const hh = c.hh * h;
      const topY = cy - hh * 0.1;
      const botY = cy + hh;
      const grad = ctx.createLinearGradient(0, topY, 0, botY);
      const { r, g, b } = c.pal;
      const { r: r2, g: g2, b: b2 } = c.col;
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.15, `rgba(${r},${g},${b},${c.alpha * 0.6})`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},${c.alpha})`);
      grad.addColorStop(0.75, `rgba(${r2},${g2},${b2},${c.alpha * 0.7})`);
      grad.addColorStop(1, `rgba(${r2},${g2},${b2},0)`);

      this._curtainPath(ctx, c, ts);
      ctx.fillStyle = grad;
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
    this.stars = [];
    this.curtains = [];
    this._bgCache = null;
  }
}
