'use strict';

// Harmonic Sphere — a sphere whose surface carries a traveling ripple wrapping
// around it (a standing pattern pole-to-pole combined with a traveling wave
// around the equator), rendered as a rotating wireframe. Same visual language
// and shared renderer as Torus Wave; only the surface point function differs.

// ── Tunable parameters ──────────────────────────────────────────────────────
const HARMONIC_SPHERE_PARAMS = {
  LAT_SEG:     28,    // lattice: samples pole-to-pole (colatitude φ)
  LON_SEG:     44,    // lattice: samples around the equator (azimuth θ)
  RIPPLE_AMP:  0.22,  // radius modulation depth
  LON_LOBES:   6,     // traveling lobes around the equator
  LAT_LOBES:   5,     // standing lobes pole-to-pole
  WAVE_SPEED:  1.0,   // travel speed of the ripple
  ROT_SPEED:   0.12,  // rotation around Y
  TILT:        0.5,   // fixed viewing tilt around X
  PERSP_K:     0.13,  // perspective strength
};

class HarmonicSphereTheme extends ParametricSurfaceScene {
  constructor() {
    super();
    const p = HARMONIC_SPHERE_PARAMS;
    this.p = p;
    this.uSeg = p.LAT_SEG;          // u = φ (colatitude, 0..π)
    this.vSeg = p.LON_SEG;          // v = θ (azimuth, 0..2π)
    this.uRange = [0, Math.PI];
    this.vRange = [0, Math.PI * 2];
    this.rotSpeed = p.ROT_SPEED;
    this.tilt = p.TILT;
    this.perspK = p.PERSP_K;
  }

  _point(phi, theta, t, out) {
    const p = this.p;
    const r = 1 + p.RIPPLE_AMP
      * Math.sin(p.LON_LOBES * theta + t * p.WAVE_SPEED)
      * Math.sin(p.LAT_LOBES * phi);
    const sinP = Math.sin(phi);
    out[0] = r * sinP * Math.cos(theta);
    out[1] = r * Math.cos(phi);
    out[2] = r * sinP * Math.sin(theta);
  }
}
