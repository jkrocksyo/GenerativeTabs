'use strict';

// Torus Wave — a rotating 3D wireframe torus with a traveling wave pulse that
// circles around its tube (the tube radius oscillates as the wave travels
// around the ring). Depth-shaded blue on a dark background. Uses the shared
// ParametricSurfaceScene renderer; only the surface point function differs.

// ── Tunable parameters ──────────────────────────────────────────────────────
const TORUS_WAVE_PARAMS = {
  U_SEG:         60,    // lattice: samples around the major ring
  V_SEG:         24,    // lattice: samples around the tube
  MAJOR_R:       1.0,   // ring radius
  TUBE_R:        0.36,  // tube radius
  TUBE_WAVE_AMP: 0.13,  // how strongly the traveling wave deforms the tube
  WAVE_LOBES:    6,     // bumps traveling around the ring
  WAVE_SPEED:    1.0,   // travel speed of the pulse
  ROT_SPEED:     0.11,  // rotation around Y
  TILT:          0.95,  // fixed viewing tilt around X
  PERSP_K:       0.13,  // perspective strength
};

class TorusWaveTheme extends ParametricSurfaceScene {
  constructor() {
    super();
    const p = TORUS_WAVE_PARAMS;
    this.p = p;
    this.uSeg = p.U_SEG;             // u = major angle around the ring
    this.vSeg = p.V_SEG;             // v = minor angle around the tube
    this.uRange = [0, Math.PI * 2];
    this.vRange = [0, Math.PI * 2];
    this.rotSpeed = p.ROT_SPEED;
    this.tilt = p.TILT;
    this.perspK = p.PERSP_K;
  }

  _point(u, v, t, out) {
    const p = this.p;
    const r = p.TUBE_R + p.TUBE_WAVE_AMP * Math.sin(p.WAVE_LOBES * u + t * p.WAVE_SPEED);
    const ring = p.MAJOR_R + r * Math.cos(v);
    out[0] = ring * Math.cos(u);
    out[1] = ring * Math.sin(u);
    out[2] = r * Math.sin(v);
  }
}
