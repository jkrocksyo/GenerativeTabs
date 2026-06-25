'use strict';

class MeteorShowerTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null; this.ctx = null;
    this.w = 0; this.h = 0;
    this.intensity = 1.0;
    this.speed = 1.0;
    this.stars = [];
    this.meteors = [];
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas; this.ctx = ctx;
    this.w = canvas.width; this.h = canvas.height;
    this.intensity = opts.intensity || 1.0;
    this.speed = opts.speed || 1.0;
    this._build();
  }

  _build() {
    const f = this.intensity;

    this.stars = Array.from({ length: Math.round(200 * f) }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: 0.2 + Math.random() * 0.8,
      a: 0.1 + Math.random() * 0.45,
      twPhase: Math.random() * Math.PI * 2,
      twSpeed: 0.18 + Math.random() * 0.6,
      twAmt:   0.03 + Math.random() * 0.10,
    }));

    // Always-on pool: scatter across full screen at startup so it's immediately dense
    const count = Math.round(55 * f);
    this.meteors = Array.from({ length: count }, () => this._newMeteor(true));
  }

  _newMeteor(scatter = false) {
    const isBig   = Math.random() < 0.07;
    const angle   = (32 + Math.random() * 18) * Math.PI / 180;
    const spd     = (isBig ? 3.5 + Math.random() * 3.5 : 6 + Math.random() * 11) * Math.max(0.5, this.intensity);
    const len     = isBig ? 180 + Math.random() * 160 : 55 + Math.random() * 110;
    const alpha   = isBig ? 0.7 + Math.random() * 0.3 : 0.35 + Math.random() * 0.55;
    const width   = isBig ? 1.6 + Math.random() * 1.0 : 0.45 + Math.random() * 0.7;
    const head    = isBig ? [255, 200, 110] : [255, 255, 255];
    const tail    = isBig ? [255, 100, 20]  : [160, 200, 255];

    let x, y;
    if (scatter) {
      // Distribute across and above the screen so it looks full on first frame
      x = Math.random() * this.w * 1.8 - this.w * 0.4;
      y = Math.random() * this.h * 1.1 - this.h * 0.5;
    } else {
      // Respawn: enter from top or left edge
      if (Math.random() < 0.62) {
        x = Math.random() * this.w * 1.4 - this.w * 0.2;
        y = -len - Math.random() * 60;
      } else {
        x = -len - Math.random() * 60;
        y = Math.random() * this.h * 0.85;
      }
    }

    return { x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, len, alpha, width, head, tail, isBig };
  }

  draw(ts) {
    const { ctx, w, h } = this;
    const t = ts * 0.001;

    ctx.fillStyle = '#000308';
    ctx.fillRect(0, 0, w, h);

    // Twinkling stars
    for (const s of this.stars) {
      const tw = 1 - s.twAmt + s.twAmt * Math.sin(t * s.twSpeed + s.twPhase);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Meteor streaks
    ctx.lineCap = 'round';
    for (const m of this.meteors) {
      m.x += m.vx * this.speed;
      m.y += m.vy * this.speed;

      // Reset when fully off-screen (with tail buffer)
      if (m.x - m.len > w || m.y - m.len > h) {
        Object.assign(m, this._newMeteor(false));
        continue;
      }

      const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      const nx = m.vx / spd, ny = m.vy / spd;
      const tx = m.x - nx * m.len, ty = m.y - ny * m.len;

      const [hr, hg, hb] = m.head;
      const [tr, tg, tb] = m.tail;

      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0,    `rgba(${hr},${hg},${hb},${m.alpha.toFixed(3)})`);
      grad.addColorStop(0.12, `rgba(${tr},${tg},${tb},${(m.alpha * 0.55).toFixed(3)})`);
      grad.addColorStop(1,    `rgba(${tr},${tg},${tb},0)`);

      ctx.globalAlpha = 1;
      ctx.strokeStyle = grad;
      ctx.lineWidth = m.width;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Glow on large meteors
      if (m.isBig) {
        const gr = m.width * 4;
        const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, gr);
        glow.addColorStop(0, `rgba(${hr},${hg},${hb},${(m.alpha * 0.6).toFixed(3)})`);
        glow.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(m.x, m.y, gr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  }

  resize(w, h) { this.w = w; this.h = h; this._build(); }
  destroy() { this.stars = []; this.meteors = []; }
}
