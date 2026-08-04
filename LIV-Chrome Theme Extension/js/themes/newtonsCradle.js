'use strict';

// Newton's Cradle — a live five-ball momentum simulation. The leftmost ball is
// pulled back and released; gravity swings it down and an equal-mass elastic
// collision passes the momentum through the resting chain to kick the far ball
// out. No damping, so it never runs down — the swing is perpetual. Polished
// steel balls (gradient + specular highlight), an A-frame stand, V-strings and
// contact shadows on a dark table. The background is fully redrawn each frame.

// ── Tunable parameters ──────────────────────────────────────────────────────
const NEWTONS_CRADLE_PARAMS = {
  N: 5,               // number of balls
  BALL_R_FRAC: 0.058, // ball radius as a fraction of canvas width — wider screens
                      // get proportionally bigger balls (the touching row fills
                      // more width). Kept as a pure fraction so a small preview
                      // canvas renders a faithful scaled-down copy, not zoomed in.
  BALL_R_MAX_H: 0.13, // …but capped to this fraction of height so the stand
                      // always fits vertically on short/wide viewports.
  L_PER_R: 4.0,       // string length in ball-radii (smaller ⇒ squatter stand)
  TABLE_FRAC: 0.86,   // table surface height as a fraction of H (fixed floor)
  TABLE_GAP_R: 0.6,   // clearance between the balls and the table, in ball-radii
  BAR_OVERHANG_R: 0.6,// top bar extends this many ball-radii past the outer balls
  BEAM_W_R: 0.15,     // A-frame beam half-thickness in ball-radii
  LEG_SPREAD: 1.28,   // how far the feet splay outward past the top bar
  PULL: -0.7,         // start angle of the leftmost ball (radians)
  G: 7.5,             // gravity constant driving the restoring torque
  SUBSTEPS: 6,        // physics substeps per frame
  RELAX_PASSES: 4,    // collision relaxation passes per substep (chain reactions)
};

class NewtonsCradleTheme {
  constructor() {
    this.contextType = '2d';
    this.canvas = null;
    this.ctx = null;
    this.w = 0;
    this.h = 0;
    this.speed = 1.0;
    this.intensity = 1.0;

    this.p = Object.assign({}, NEWTONS_CRADLE_PARAMS);
    this._lastTs = null;
    this._prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Per-ball simulation state (filled by _initGeom).
    this.anchorX = [];
    this.angle = [];
    this.angVel = [];
    this.ballR = 0;
    this.L = 0;
    this.barY = 0;
    this.tableY = 0;
  }

  // Lay out the stand + balls for the current size and reset the swing so the
  // leftmost ball starts pulled back. Ball radius scales with width; the string
  // length and stand height are derived from it, so the whole apparatus stays
  // proportional (medium balls, short strings) instead of a tall thin sliver.
  _initGeom() {
    const p = this.p, W = this.w, H = this.h;
    const R = Math.min(W * p.BALL_R_FRAC, H * p.BALL_R_MAX_H);
    this.ballR = R;
    this.L = R * p.L_PER_R;

    // The table is a fixed floor; the stand is built upward from it so the balls
    // hang just above the table and the bar height follows the string length
    // (longer strings raise the bar), rather than stretching to the viewport.
    this.tableY = H * p.TABLE_FRAC;
    const ballCenterY = this.tableY - R * p.TABLE_GAP_R - R;   // ball rests a gap above the floor
    this.barY = Math.max(H * 0.06, ballCenterY - 6 - this.L);  // string top = barY + 6

    this.anchorX = [];
    this.angle = [];
    this.angVel = [];
    const cx = W / 2;
    for (let i = 0; i < p.N; i++) {
      this.anchorX.push(cx + (i - (p.N - 1) / 2) * (2 * R));   // balls just touch at rest
      this.angle.push(i === 0 ? p.PULL : 0);   // pull the leftmost ball back to start
      this.angVel.push(0);
    }
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.w = canvas.width;
    this.h = canvas.height;
    this.speed = opts.speed || 1.0;
    this.intensity = opts.intensity || 1.0;
    this._lastTs = null;
    this._initGeom();
  }

  // Advance the sim by dt seconds. Gravity supplies an undamped restoring torque
  // (this is what keeps the cradle perpetual); collisions between touching balls
  // are equal-mass elastic, so their horizontal velocities simply swap. Several
  // relaxation passes let a chain reaction resolve within a single sub-step.
  _physicsStep(dt) {
    const p = this.p;
    const { N, SUBSTEPS, RELAX_PASSES, G } = p;
    const BALL_R = this.ballR;
    const dtSub = dt / SUBSTEPS, L = this.L;
    const angle = this.angle, angVel = this.angVel, anchorX = this.anchorX;

    for (let s = 0; s < SUBSTEPS; s++) {
      for (let i = 0; i < N; i++) {
        const accel = -(G / L) * 820 * Math.sin(angle[i]);
        angVel[i] += accel * dtSub;
        angle[i] += angVel[i] * dtSub;
      }
      for (let pass = 0; pass < RELAX_PASSES; pass++) {
        for (let i = 0; i < N - 1; i++) {
          const xi  = anchorX[i]   + L * Math.sin(angle[i]);
          const xi1 = anchorX[i + 1] + L * Math.sin(angle[i + 1]);
          let vxi  = angVel[i]     * L * Math.cos(angle[i]);
          let vxi1 = angVel[i + 1] * L * Math.cos(angle[i + 1]);
          if ((xi1 - xi) <= 2 * BALL_R + 0.6 && (vxi - vxi1) > 0.001) {
            const tmp = vxi; vxi = vxi1; vxi1 = tmp;   // equal-mass elastic: swap
            angVel[i]     = vxi  / (L * Math.cos(angle[i])     || 1);
            angVel[i + 1] = vxi1 / (L * Math.cos(angle[i + 1]) || 1);
          }
        }
      }
    }
  }

  draw(ts) {
    const { ctx, w: W, h: H, p } = this;

    // Delta time, clamped so a tab-resume spike can't blow up the integrator.
    if (this._lastTs === null) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;
    if (dt < 0) dt = 0;
    dt *= this.speed;

    // Reduced motion: hold the released-ball start frame instead of swinging.
    if (!this._prefersReduced) this._physicsStep(Math.min(dt, 0.024));

    const cx = W / 2;
    const N = p.N, BALL_R = this.ballR, L = this.L, barY = this.barY, tableY = this.tableY;
    const barHalfW = (this.anchorX[N - 1] - this.anchorX[0]) / 2 + BALL_R * p.BAR_OVERHANG_R;
    const beamW = BALL_R * p.BEAM_W_R;

    // Deep, cool vertical background — a modern slate-to-ink gradient instead of
    // flat black, so the chrome has a coloured environment to reflect.
    const bgG = ctx.createLinearGradient(0, 0, 0, H);
    bgG.addColorStop(0, '#1a2033'); bgG.addColorStop(0.55, '#10141f'); bgG.addColorStop(1, '#080a11');
    ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);

    // Soft ambient glow pooled behind the swinging row — gives the scene depth
    // and a subtle accent colour without any hard shapes.
    const glowY = tableY - BALL_R * 1.4;
    const glow = ctx.createRadialGradient(cx, glowY, BALL_R * 0.5, cx, glowY, W * 0.55);
    glow.addColorStop(0, 'rgba(90,130,190,0.20)');
    glow.addColorStop(0.5, 'rgba(60,90,150,0.08)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    // Table — a subtle reflective dark surface that fades into the background.
    const tg = ctx.createLinearGradient(0, tableY, 0, H);
    tg.addColorStop(0, '#161b28'); tg.addColorStop(1, '#080a11');
    ctx.fillStyle = tg; ctx.fillRect(0, tableY, W, H - tableY);
    const edge = ctx.createLinearGradient(0, tableY, W, tableY);
    edge.addColorStop(0, 'rgba(120,150,200,0)');
    edge.addColorStop(0.5, 'rgba(120,150,200,0.25)');
    edge.addColorStop(1, 'rgba(120,150,200,0)');
    ctx.fillStyle = edge; ctx.fillRect(0, tableY, W, 1.5);

    const ballX = [], ballY = [];
    for (let i = 0; i < N; i++) {
      ballX.push(this.anchorX[i] + Math.sin(this.angle[i]) * L);
      ballY.push(barY + 6 + Math.cos(this.angle[i]) * L);
    }

    // Contact shadows on the table.
    for (let i = 0; i < N; i++) {
      const sh = ctx.createRadialGradient(ballX[i], tableY + 12, 2, ballX[i], tableY + 12, BALL_R * 0.9);
      sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.translate(ballX[i], tableY + 12); ctx.scale(1, 0.26);
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, BALL_R * 0.9, 0, 7); ctx.fill(); ctx.restore();
    }

    // A-frame stand.
    const beam = (x1, y1, x2, y2, wd, c1, c2) => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len * wd, ny = dx / len * wd;
      const g2 = ctx.createLinearGradient(x1 + nx, y1 + ny, x1 - nx, y1 - ny);
      g2.addColorStop(0, c1); g2.addColorStop(0.5, c2); g2.addColorStop(1, c1);
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x2 + nx, y2 + ny);
      ctx.lineTo(x2 - nx, y2 - ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.closePath(); ctx.fill();
    };
    beam(cx - barHalfW, barY, cx - barHalfW * p.LEG_SPREAD, tableY, beamW, '#2c3340', '#8b95a8');
    beam(cx + barHalfW, barY, cx + barHalfW * p.LEG_SPREAD, tableY, beamW, '#2c3340', '#8b95a8');
    beam(cx - barHalfW, barY, cx + barHalfW, barY, beamW * 1.12, '#252b36', '#9aa4b8');

    // Rounded knuckle over each top corner so the leg and the bar read as one
    // welded frame instead of three overlapping rectangles with a notch.
    const joint = (jx, jy) => {
      const r = beamW * 1.4;
      const jg = ctx.createRadialGradient(jx - r * 0.35, jy - r * 0.35, r * 0.1, jx, jy, r);
      jg.addColorStop(0, '#cfd6e4'); jg.addColorStop(0.5, '#7c8598'); jg.addColorStop(1, '#252b36');
      ctx.fillStyle = jg; ctx.beginPath(); ctx.arc(jx, jy, r, 0, 7); ctx.fill();
    };
    joint(cx - barHalfW, barY);
    joint(cx + barHalfW, barY);

    // Strings (a V per ball).
    const gap = 10;
    ctx.strokeStyle = 'rgba(150,170,205,0.55)'; ctx.lineWidth = 1.1;
    for (let i = 0; i < N; i++) {
      ctx.beginPath(); ctx.moveTo(this.anchorX[i] - gap, barY + 8); ctx.lineTo(ballX[i], ballY[i] - BALL_R * 0.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.anchorX[i] + gap, barY + 8); ctx.lineTo(ballX[i], ballY[i] - BALL_R * 0.15); ctx.stroke();
    }

    // Chrome balls — a cool-toned body, a bright specular hotspot, a coloured
    // accent rim light bouncing up from below, and a crisp gloss edge. No
    // collision flash: the surface stays steady so there is no flicker.
    for (let i = 0; i < N; i++) {
      const bx = ballX[i], by = ballY[i];

      // Body: light cool crown → mid steel → deep shadowed base. The dark base
      // plus a bright crown reads as polished, reflective chrome.
      const bg = ctx.createRadialGradient(bx - BALL_R * 0.35, by - BALL_R * 0.42, BALL_R * 0.05, bx, by, BALL_R);
      bg.addColorStop(0, '#eef3fb'); bg.addColorStop(0.32, '#b9c3d6');
      bg.addColorStop(0.68, '#5a6577'); bg.addColorStop(1, '#161b26');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, BALL_R, 0, 7); ctx.fill();

      // Accent bounce light — a soft teal crescent on the lower-right edge, as if
      // the glow beneath the row is reflecting back up into the metal.
      const rim = ctx.createRadialGradient(
        bx + BALL_R * 0.5, by + BALL_R * 0.55, BALL_R * 0.15,
        bx + BALL_R * 0.5, by + BALL_R * 0.55, BALL_R * 0.85);
      rim.addColorStop(0, 'rgba(90,180,205,0.45)');
      rim.addColorStop(1, 'rgba(90,180,205,0)');
      ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(bx, by, BALL_R, 0, 7); ctx.fill();

      // Crisp gloss edge — a thin bright arc on the upper rim for a modern,
      // product-render sheen.
      ctx.strokeStyle = 'rgba(230,240,255,0.35)'; ctx.lineWidth = Math.max(1, BALL_R * 0.04);
      ctx.beginPath(); ctx.arc(bx, by, BALL_R * 0.97, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke();

      // Bright specular hotspot.
      const hi = ctx.createRadialGradient(bx - BALL_R * 0.36, by - BALL_R * 0.42, 0, bx - BALL_R * 0.36, by - BALL_R * 0.42, BALL_R * 0.26);
      hi.addColorStop(0, 'rgba(255,255,255,0.98)'); hi.addColorStop(0.6, 'rgba(255,255,255,0.35)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hi; ctx.beginPath(); ctx.arc(bx - BALL_R * 0.36, by - BALL_R * 0.42, BALL_R * 0.26, 0, 7); ctx.fill();
    }
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    // Geometry (bar/table/string) scales with H, so re-lay it out. This resets
    // the swing, which is fine — a resize is a fresh start.
    this._initGeom();
  }

  destroy() {}
}
