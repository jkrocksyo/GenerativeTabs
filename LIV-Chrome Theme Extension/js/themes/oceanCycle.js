/* ═══════════════════════════════════════════════════════════════════
   LiV — OCEAN CYCLE
   Original scene by Margarita. Ported into LiV's ThemeEngine.

   A raymarched ocean under a procedural sky, rendered entirely in a
   single fullscreen fragment shader. No geometry, no textures, no
   assets, no network. One WebGL canvas and this file.

   The palette (pre-dawn / dawn / midday / dusk / night) is driven by the
   viewer's real local clock by default, so the scene matches the sky
   outside; the settings buttons can instead pin it to a fixed time of day.

   ENGINE INTEGRATION
   ThemeEngine owns the rAF loop, the frame-rate cap, the
   visibility-pause (background tabs cost zero) and prefers-reduced-
   motion (draws a single frame, then stops). So this file no longer
   carries its own loop / idle throttle / resize / visibility code —
   only what runs inside init()/draw()/resize().

   PERFORMANCE
   This is a per-pixel raymarch, so it is fill-rate bound. The levers,
   in order of impact:
     1. render resolution        TIERS[].scale x the quality slider
     2. shader loop bounds       TIERS[].trace / octG / octF
     3. frame-rate cap           handled by the engine (fps setting)
   Resolution is downscaled below the display so the raymarch stays
   affordable on weak GPUs. Resolution and loop bounds are chosen
   together from the quality slider (see TIERS); the loop bounds are
   #defines (not uniforms) so the shader is compiled per init() with
   the tier baked in — cheap, since a quality change re-inits anyway.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Tunables ──────────────────────────────────────────────────
  const DT_MAX  = 0.05;  // clamp per-frame dt so tab-switches don't jump the waves
  const DPR_CAP = 2;     // never raymarch above 2x, whatever the slider says

  // Quality tiers. The raymarch is fill-rate bound, so both the render
  // resolution (scale) AND the shader loop bounds (trace / octG / octF) drop
  // together at low quality — that is what makes the low end genuinely cheap
  // rather than just smaller. The tier is picked from the quality slider in
  // init(); the engine re-inits on a quality change, so the shader is simply
  // recompiled with the right #defines.
  const TIERS = {
    eco:  { scale: 0.60, trace: 4, octG: 2, octF: 3 },
    std:  { scale: 0.85, trace: 6, octG: 3, octF: 4 },
    high: { scale: 1.00, trace: 8, octG: 3, octF: 5 }
  };
  const tierFor = q => (q <= 1.0 ? TIERS.eco : q <= 2.0 ? TIERS.std : TIERS.high);

  const PI = Math.PI;
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smoother = x => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };

  // ── Shaders ───────────────────────────────────────────────────
  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

  const FS = `
precision highp float;

#define TRACE_STEPS __TRACE__
#define OCT_GEO     __OCTG__
#define OCT_FRAG    __OCTF__

uniform vec2  uR;
uniform float uT;      // seconds since start
uniform float uA;      // palette stop A (0..4)
uniform float uB;      // palette stop B (0..4)
uniform float uBl;     // A -> B blend, eased on the JS side
uniform float uDusk;   // weight of the DUSK stop
uniform float uStars;  // star visibility (NIGHT + PRE-DAWN weight)
uniform float uSunA;   // sun arc angle, radians
uniform float uSeaT;   // accumulated wave phase (integrated on the JS side, so a
                       // changing wave speed never multiplies absolute time)

// ═══ CONSTANTS ═══════════════════════════════════════════════════
const float PI = 3.14159265359;

const vec2  HASH_DOT   = vec2(127.1, 311.7);
const float HASH_SCALE = 43758.5453123;

// Sea octave
const mat2  SEA_OCT_M        = mat2(1.6, 1.2, -1.2, 1.6);
const float SEA_OCT_POWER    = 0.65;
const float SEA_UV_X_SCALE   = 0.75;
const float SEA_FREQ_BASE    = 0.16;
const float SEA_FREQ_MUL     = 1.9;
const float SEA_AMP_MUL      = 0.22;
const float SEA_CHOPPY_BLEND = 0.20;
const float SEA_TRACE_FAR    = 1000.0;

// Camera
const float CAM_HEIGHT      = 5.2;
const float CAM_BREATH_AMP  = 0.09;  // slow vertical drift, adds life
const float CAM_BREATH_RATE = 0.055;
const float CAM_DRIFT_SPEED = 0.5;
const float CAM_PITCH       = 0.20;
const float CAM_FOCAL       = -1.8;
const float CAM_BARREL      = 0.10;

// Sky gradient
const float SKY_GRAD_EXP  = 0.42;
const float SKY_GRAD_DUSK = 0.22;  // steeper: purple overhead, orange low

// Clouds
const float CLOUD_FREQ_A    = 5.5;
const float CLOUD_FREQ_B    = 8.0;
const float CLOUD_TIME_A    = 0.012;
const float CLOUD_TIME_B    = 0.008;
const float CLOUD_THRESH_LO = 0.62;
const float CLOUD_THRESH_HI = 0.86;
const float CLOUD_BLEND_A   = 0.65;
const float CLOUD_BLEND_B   = 0.35;
const float CLOUD_HOR_LO    = -0.02;
const float CLOUD_HOR_HI    = 0.24;
const float CLOUD_AMT       = 0.07;
const float CLOUD_DARKEN    = 0.97;
const float CLOUD_MIX       = 0.35;
const vec3  CLOUD_COL_DAY   = vec3(1.00, 0.82, 0.65);
const vec3  CLOUD_COL_NIGHT = vec3(0.30, 0.36, 0.52);

// Sun
const float SUN_ARC_X       = -0.75;
const float SUN_ARC_Y_SCALE = 0.38;
const float SUN_GLOW_LO     = -0.10;
const float SUN_GLOW_HI     = 0.06;
const float SUN_HALO_EXP_A  = 380.0; const float SUN_HALO_SCL_A = 2.4;
const float SUN_HALO_EXP_B  = 22.0;  const float SUN_HALO_SCL_B = 0.16;
const float SUN_HALO_EXP_C  = 5.0;   const float SUN_HALO_SCL_C = 0.09;
const float SUN_HALO_EXP_D  = 3.0;   const float SUN_HALO_SCL_D = 0.035;
const float SUN_DISK_LO     = 0.99940;
const float SUN_DISK_HI     = 0.99990;
const float SUN_DISK_SCL    = 1.6;
const float SUN_HORIZON_FALL = 24.0;
const float SUN_HORIZON_SCL  = 0.09;

// Moon
const vec3  MOON_DIR_RAW    = vec3(-0.14, 0.42, -1.0);
const float MOON_THRESHOLD  = 0.04;
const float MOON_DISK_LO    = 0.99985;
const float MOON_DISK_HI    = 0.99998;
const float MOON_DISK_SCL   = 3.5;
const vec3  MOON_COL_DISK   = vec3(0.95, 0.97, 1.00);
const vec3  MOON_COL_CORONA = vec3(0.88, 0.92, 1.00);
const float MOON_CORONA_EXP = 820.0; const float MOON_CORONA_SCL = 5.0;
const vec3  MOON_COL_HALO1  = vec3(0.65, 0.75, 0.95);
const float MOON_HALO1_EXP  = 60.0;  const float MOON_HALO1_SCL  = 0.18;
const vec3  MOON_COL_HALO2  = vec3(0.40, 0.52, 0.82);
const float MOON_HALO2_EXP  = 12.0;  const float MOON_HALO2_SCL  = 0.07;

// Stars
const float STAR_HOR_LO    = 0.00;  // stars begin right at the sea horizon
const float STAR_HOR_HI    = 0.035; // reach full strength just above it, so the starfield
                                    // fills the whole sky and meets the ocean as a crisp
                                    // horizon edge (the "rectangle of sky" over the water)
const float STAR_SCALE     = 1.40;  // lower than before: three depth layers now sum together
const float STAR_THRESHOLD = 0.02;
const float STAR_TINT      = 0.55;  // how far stars stray from white toward blue / amber
const float STAR_DRIFT      = 0.0015; // steady rightward parallax drift (deep-space feel).
                                      // A single direction, so stars move together instead
                                      // of swirling every which way like a rotation does.
const float STAR_SCINT_BASE = 0.25;   // twinkle rate floor
const float STAR_SCINT_VAR  = 0.50;   // per-star twinkle spread
const float STAR_DENSITY    = 80.0;   // grid cells across the field (fewer = bigger/sparser)
const float STAR_FILL       = 0.40;   // fraction of cells that hold a star, PER depth layer
const float STAR_JITTER     = 0.50;   // sub-cell placement spread (keeps a soft-edge margin)
const float STAR_RADIUS_MIN = 0.07;   // faint-star soft radius (cell units)
const float STAR_RADIUS_MAX = 0.16;   // bright-star soft radius
const float STAR_DIM        = 0.18;   // faint-star brightness
const float STAR_BRIGHT     = 1.00;   // rare bright-star brightness

// Horizon mist
const float HZ_MIST_FALL = 38.0;
const float HZ_MIST_SCL  = 0.09;

// Sea surface
const float SEA_HORIZON_BLEND = -0.05;
const float SEA_HORIZON_EXP   = 0.30;
const float SEA_MIX_THRESHOLD = 0.001;
const float SEA_NORMAL_EPS_K  = 0.10;
const float FRESNEL_EXP       = 3.0;
const float FRESNEL_SCL       = 0.65;
const float REFL_SUN_EXP_A    = 140.0; const float REFL_SUN_SCL_A = 3.0;
const float REFL_SUN_EXP_B    = 18.0;  const float REFL_SUN_SCL_B = 0.10;
const vec3  REFL_MOON_COL_A = vec3(0.90, 0.94, 1.00);
const float REFL_MOON_EXP_A = 320.0;   const float REFL_MOON_SCL_A = 2.40;
const vec3  REFL_MOON_COL_B = vec3(0.72, 0.82, 0.98);
const float REFL_MOON_EXP_B = 28.0;    const float REFL_MOON_SCL_B = 0.42;
const vec3  REFL_MOON_COL_C = vec3(0.50, 0.62, 0.88);
const float REFL_MOON_EXP_C = 6.0;     const float REFL_MOON_SCL_C = 0.12;
const float DIFF_WRAP      = 0.4;
const float DIFF_LIFT      = 0.6;
const float DIFF_EXP       = 80.0;
const float DIFF_WATER_SCL = 0.12;
const float SSS_ATTEN_K    = 0.001;
const float SSS_SCL        = 0.18;
const float SPEC_EXP       = 60.0;
const float GLITTER_UV_SCL = 18.0;
const float GLITTER_TIME_U = 0.55;
const float GLITTER_TIME_V = 0.22;
const float GLITTER_THRESH = 0.94;
const float GLITTER_SCL    = 0.09;
const vec3  MSPEC_COL_A = vec3(0.88, 0.93, 1.00);
const float MSPEC_EXP_A = 380.0; const float MSPEC_SCL_A = 0.55;
const vec3  MSPEC_COL_B = vec3(0.70, 0.80, 0.97);
const float MSPEC_EXP_B = 22.0;  const float MSPEC_SCL_B = 0.14;
const float FOG_SCALE = 1.6;

// Post
const float HOR_EDGE_LO    = -0.008;
const float HOR_EDGE_HI    = 0.018;
const float HOR_BLEND      = 0.25;
const float GRAIN_UV_SCL   = 0.5;
const float GRAIN_TIME_SCL = 0.0;    // 0 = static grain. Animated grain (was 12)
                                     // reshuffled 12x/sec and read as fast-moving
                                     // speckle across the dark night sky.
const float GRAIN_STR      = 0.002;
const float GAMMA          = 0.78;

// ═══ PALETTE STOPS ═══════════════════════════════════════════════
// index: 0 DAWN · 1 MIDDAY · 2 DUSK · 3 NIGHT · 4 PRE-DAWN
const vec3 SKY_TOP_DAWN    = vec3(0.42, 0.60, 0.90);
const vec3 SKY_TOP_DAY     = vec3(0.04, 0.22, 0.62);
const vec3 SKY_TOP_DUSK    = vec3(0.14, 0.04, 0.26);
const vec3 SKY_TOP_NIGHT   = vec3(0.01, 0.01, 0.05);
const vec3 SKY_TOP_PREDAWN = vec3(0.38, 0.40, 0.64);

const vec3 SKY_HOR_DAWN    = vec3(0.98, 0.50, 0.12);
const vec3 SKY_HOR_DAY     = vec3(0.50, 0.68, 0.92);
const vec3 SKY_HOR_DUSK    = vec3(0.98, 0.22, 0.02);
const vec3 SKY_HOR_NIGHT   = vec3(0.02, 0.02, 0.06);
const vec3 SKY_HOR_PREDAWN = vec3(0.70, 0.52, 0.64);

const vec3 SUN_COL_DAWN    = vec3(1.00, 0.88, 0.35);
const vec3 SUN_COL_DAY     = vec3(1.00, 0.96, 0.80);
const vec3 SUN_COL_DUSK    = vec3(1.00, 0.28, 0.04);
const vec3 SUN_COL_NIGHT   = vec3(0.72, 0.78, 0.98);
const vec3 SUN_COL_PREDAWN = vec3(0.90, 0.55, 0.62);

const vec3 SEA_BASE_DAWN    = vec3(0.08, 0.04, 0.02);
const vec3 SEA_BASE_DAY     = vec3(0.02, 0.10, 0.26);
const vec3 SEA_BASE_DUSK    = vec3(0.09, 0.05, 0.03);
const vec3 SEA_BASE_NIGHT   = vec3(0.01, 0.01, 0.04);
const vec3 SEA_BASE_PREDAWN = vec3(0.02, 0.02, 0.06);

const vec3 SEA_WATER_DAWN    = vec3(0.82, 0.55, 0.32);
const vec3 SEA_WATER_DAY     = vec3(0.42, 0.82, 0.88);
const vec3 SEA_WATER_DUSK    = vec3(0.32, 0.18, 0.08);
const vec3 SEA_WATER_NIGHT   = vec3(0.20, 0.32, 0.62);
const vec3 SEA_WATER_PREDAWN = vec3(0.25, 0.28, 0.54);

const vec3 FOG_COL_DAWN    = vec3(0.92, 0.65, 0.45);
const vec3 FOG_COL_DAY     = vec3(0.60, 0.76, 0.94);
const vec3 FOG_COL_DUSK    = vec3(0.30, 0.10, 0.06);
const vec3 FOG_COL_NIGHT   = vec3(0.01, 0.01, 0.04);
const vec3 FOG_COL_PREDAWN = vec3(0.60, 0.46, 0.58);

const float SEA_H_DAWN = 0.62, SEA_H_DAY = 0.48, SEA_H_DUSK = 0.72;
const float SEA_H_NIGHT = 0.48, SEA_H_PREDAWN = 0.42;

const float SEA_CH_DAWN = 1.00, SEA_CH_DAY = 0.75, SEA_CH_DUSK = 1.25;
const float SEA_CH_NIGHT = 0.75, SEA_CH_PREDAWN = 0.68;

const float SEA_SPD_DAWN = 0.80, SEA_SPD_DAY = 0.65, SEA_SPD_DUSK = 0.90;
const float SEA_SPD_NIGHT = 0.55, SEA_SPD_PREDAWN = 0.48;

const float FOG_DEN_DAWN = 0.012, FOG_DEN_DAY = 0.010, FOG_DEN_DUSK = 0.014;
const float FOG_DEN_NIGHT = 0.028, FOG_DEN_PREDAWN = 0.010;

const float MOON_AMT_DAWN = 0.10, MOON_AMT_DAY = 0.00, MOON_AMT_DUSK = 0.00;
const float MOON_AMT_NIGHT = 0.80, MOON_AMT_PREDAWN = 0.62;

// ═══ PALETTE BLEND ═══════════════════════════════════════════════
// Pick one of five stops by index (uA / uB are integers 0..4), then
// cross-fade A -> B by uBl. The step() ladder selects exactly the
// indexed stop for integer inputs.
vec3 pickC(vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4, float i) {
  vec3 r = c0;
  r = mix(r, c1, step(0.5, i));
  r = mix(r, c2, step(1.5, i));
  r = mix(r, c3, step(2.5, i));
  r = mix(r, c4, step(3.5, i));
  return r;
}
float pickF(float c0, float c1, float c2, float c3, float c4, float i) {
  float r = c0;
  r = mix(r, c1, step(0.5, i));
  r = mix(r, c2, step(1.5, i));
  r = mix(r, c3, step(2.5, i));
  r = mix(r, c4, step(3.5, i));
  return r;
}
vec3 sCol(vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4) {
  return mix(pickC(c0,c1,c2,c3,c4,uA), pickC(c0,c1,c2,c3,c4,uB), uBl);
}
float sF(float c0, float c1, float c2, float c3, float c4) {
  return mix(pickF(c0,c1,c2,c3,c4,uA), pickF(c0,c1,c2,c3,c4,uB), uBl);
}

float hash(vec2 p) { return fract(sin(dot(p, HASH_DOT)) * HASH_SCALE); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f * (3.0 - 2.0*f);
  float a = hash(i),             b = hash(i + vec2(1,0));
  float c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float snoise(vec2 p) { return noise(p) * 2.0 - 1.0; }

// ═══ SEA ═════════════════════════════════════════════════════════
float sea_octave(vec2 uv, float choppy) {
  uv += snoise(uv);
  vec2 wv  = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  wv = mix(wv, swv, wv);
  return pow(1.0 - pow(wv.x * wv.y, SEA_OCT_POWER), choppy);
}

float seaMap(vec3 p, float seaH, float ch, float seaT) {
  float freq = SEA_FREQ_BASE, amp = seaH, choppy = ch;
  vec2 uv = p.xz; uv.x *= SEA_UV_X_SCALE;
  float d, h = 0.0;
  for (int i = 0; i < OCT_GEO; i++) {
    d  = sea_octave((uv + seaT) * freq, choppy);
    d += sea_octave((uv - seaT) * freq, choppy);
    h += d * amp;
    uv *= SEA_OCT_M; freq *= SEA_FREQ_MUL; amp *= SEA_AMP_MUL;
    choppy = mix(choppy, 1.0, SEA_CHOPPY_BLEND);
  }
  return p.y - h;
}

float seaMapFine(vec3 p, float seaH, float ch, float seaT) {
  float freq = SEA_FREQ_BASE, amp = seaH, choppy = ch;
  vec2 uv = p.xz; uv.x *= SEA_UV_X_SCALE;
  float d, h = 0.0;
  for (int i = 0; i < OCT_FRAG; i++) {
    d  = sea_octave((uv + seaT) * freq, choppy);
    d += sea_octave((uv - seaT) * freq, choppy);
    h += d * amp;
    uv *= SEA_OCT_M; freq *= SEA_FREQ_MUL; amp *= SEA_AMP_MUL;
    choppy = mix(choppy, 1.0, SEA_CHOPPY_BLEND);
  }
  return p.y - h;
}

float seaTrace(vec3 ori, vec3 dir, out vec3 p, float seaH, float ch, float seaT) {
  float tm = 0.0, tx = SEA_TRACE_FAR;
  float hx = seaMap(ori + dir * tx, seaH, ch, seaT);
  if (hx > 0.0) { p = ori + dir * tx; return tx; }
  float hm = seaMap(ori, seaH, ch, seaT);
  float tmid = 0.0;
  for (int i = 0; i < TRACE_STEPS; i++) {
    tmid = mix(tm, tx, hm / (hm - hx));
    p = ori + dir * tmid;
    float hmid = seaMap(p, seaH, ch, seaT);
    if (hmid < 0.0) { tx = tmid; hx = hmid; }
    else            { tm = tmid; hm = hmid; }
  }
  return tmid;
}

vec3 seaNormal(vec3 p, float eps, float seaH, float ch, float seaT) {
  vec3 n;
  n.y = seaMapFine(p, seaH, ch, seaT);
  n.x = seaMapFine(vec3(p.x + eps, p.y, p.z), seaH, ch, seaT) - n.y;
  n.z = seaMapFine(vec3(p.x, p.y, p.z + eps), seaH, ch, seaT) - n.y;
  n.y = eps;
  return normalize(n);
}

// ═══ STARS ═══════════════════════════════════════════════════════
// One depth layer of the starfield: a stable jittered grid of soft, tinted
// stars drifting right at its own rate. main() sums several of these at
// different densities / drift speeds so nearer stars slide past farther ones —
// the parallax is what gives the flat grid a sense of depth.
vec3 starLayer(vec2 dir, float density, float drift, float bScale, float rMin, float rMax) {
  vec2 sp   = (dir - vec2(uT * drift, 0.0)) * density;
  vec2 cell = floor(sp);
  vec2 f    = fract(sp) - 0.5;
  float h   = hash(cell + 3.7);
  float present = step(1.0 - STAR_FILL, h);
  vec2  jit = (vec2(hash(cell + 11.5), hash(cell + 23.1)) - 0.5) * STAR_JITTER;
  float mag = hash(cell + 5.9);                       // magnitude class 0..1
  float radius = mix(rMin, rMax, pow(mag, 4.0));
  float core   = smoothstep(radius, 0.0, length(f - jit)) * present;
  float bright = core * mix(STAR_DIM, STAR_BRIGHT, pow(mag, 6.0)) * bScale;
  float scint  = STAR_SCINT_BASE + h * STAR_SCINT_VAR; // gentle per-star twinkle
  bright *= 0.85 + 0.15 * sin(uT * scint + h * 19.7);
  // Subtle stellar colour: cool blue-white ↔ warm amber, mostly white.
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.88, 0.72), hash(cell + 7.3));
  return vec3(bright) * mix(vec3(1.0), tint, STAR_TINT);
}

// ═══ MAIN ════════════════════════════════════════════════════════
void main() {
  vec2 uv = (gl_FragCoord.xy - uR * 0.5) / uR.y;

  float seaH  = sF(SEA_H_DAWN, SEA_H_DAY, SEA_H_DUSK, SEA_H_NIGHT, SEA_H_PREDAWN);
  float seaCh = sF(SEA_CH_DAWN, SEA_CH_DAY, SEA_CH_DUSK, SEA_CH_NIGHT, SEA_CH_PREDAWN);
  float seaT  = uSeaT;  // wave phase, integrated in JS with the day's current speed

  vec3 skyTop   = sCol(SKY_TOP_DAWN,   SKY_TOP_DAY,   SKY_TOP_DUSK,   SKY_TOP_NIGHT,   SKY_TOP_PREDAWN);
  vec3 skyHori  = sCol(SKY_HOR_DAWN,   SKY_HOR_DAY,   SKY_HOR_DUSK,   SKY_HOR_NIGHT,   SKY_HOR_PREDAWN);
  vec3 sunCol   = sCol(SUN_COL_DAWN,   SUN_COL_DAY,   SUN_COL_DUSK,   SUN_COL_NIGHT,   SUN_COL_PREDAWN);
  vec3 seaBase  = sCol(SEA_BASE_DAWN,  SEA_BASE_DAY,  SEA_BASE_DUSK,  SEA_BASE_NIGHT,  SEA_BASE_PREDAWN);
  vec3 seaWater = sCol(SEA_WATER_DAWN, SEA_WATER_DAY, SEA_WATER_DUSK, SEA_WATER_NIGHT, SEA_WATER_PREDAWN);
  vec3 fogCol   = sCol(FOG_COL_DAWN,   FOG_COL_DAY,   FOG_COL_DUSK,   FOG_COL_NIGHT,   FOG_COL_PREDAWN);
  float fogDen  = sF(FOG_DEN_DAWN, FOG_DEN_DAY, FOG_DEN_DUSK, FOG_DEN_NIGHT, FOG_DEN_PREDAWN);

  // ── Sun / moon ───────────────────────────────────────────
  vec3 sunDir = normalize(vec3(cos(uSunA) * SUN_ARC_X,
                               sin(uSunA) * SUN_ARC_Y_SCALE,
                               -1.0));
  vec3 moonDir = normalize(MOON_DIR_RAW);
  float moonAmt = sF(MOON_AMT_DAWN, MOON_AMT_DAY, MOON_AMT_DUSK, MOON_AMT_NIGHT, MOON_AMT_PREDAWN);
  float sunAbove = step(0.0, sunDir.y);
  float sunGlow  = smoothstep(SUN_GLOW_LO, SUN_GLOW_HI, sunDir.y);

  // ── Camera ───────────────────────────────────────────────
  float camY = CAM_HEIGHT + sin(uT * CAM_BREATH_RATE) * CAM_BREATH_AMP;
  vec3 ori = vec3(0.0, camY, uT * CAM_DRIFT_SPEED);
  vec3 rd  = normalize(vec3(uv.x, uv.y - CAM_PITCH, CAM_FOCAL));
  rd.z += length(uv) * CAM_BARREL;
  rd = normalize(rd);

  // ── Sky ──────────────────────────────────────────────────
  vec3 skyCol;
  {
    float elev = clamp(rd.y, 0.0, 1.0);
    float gradExp = mix(SKY_GRAD_EXP, SKY_GRAD_DUSK, uDusk);
    skyCol = mix(skyHori, skyTop, pow(elev, gradExp));

    // Dusk crimson mid-band
    if (uDusk > 0.01) {
      float midBand = exp(-pow((elev - 0.12) / 0.09, 2.0));
      skyCol = mix(skyCol, vec3(0.78, 0.10, 0.04), midBand * 0.55 * uDusk);
    }

    // Clouds
    float cn1 = noise(vec2(rd.x * CLOUD_FREQ_A + rd.y * 3.0, uT * CLOUD_TIME_A));
    float cn2 = noise(vec2(rd.x * CLOUD_FREQ_B - rd.y * 4.0, uT * CLOUD_TIME_B));
    float clouds = smoothstep(CLOUD_THRESH_LO, CLOUD_THRESH_HI,
                              cn1 * CLOUD_BLEND_A + cn2 * CLOUD_BLEND_B);
    clouds *= smoothstep(CLOUD_HOR_LO, CLOUD_HOR_HI, rd.y) * CLOUD_AMT;
    vec3 cloudC = mix(CLOUD_COL_DAY, CLOUD_COL_NIGHT, uStars);
    skyCol = mix(skyCol, mix(skyCol * CLOUD_DARKEN, cloudC, CLOUD_MIX), clouds);

    // Sun glows + disk
    float sd = max(dot(rd, sunDir), 0.0);
    skyCol += sunCol * pow(sd, SUN_HALO_EXP_A) * SUN_HALO_SCL_A * sunGlow;
    skyCol += sunCol * pow(sd, SUN_HALO_EXP_B) * SUN_HALO_SCL_B * sunGlow;
    skyCol += sunCol * pow(sd, SUN_HALO_EXP_C) * SUN_HALO_SCL_C * sunGlow;
    skyCol += sunCol * pow(sd, SUN_HALO_EXP_D) * SUN_HALO_SCL_D * sunGlow;
    skyCol += sunCol * smoothstep(SUN_DISK_LO, SUN_DISK_HI, sd) * SUN_DISK_SCL * sunGlow;
    skyCol += sunCol * exp(-abs(rd.y) * SUN_HORIZON_FALL) * SUN_HORIZON_SCL * sunGlow;

    // Moon
    if (moonAmt > MOON_THRESHOLD) {
      float md = max(dot(rd, moonDir), 0.0);
      skyCol += MOON_COL_DISK   * smoothstep(MOON_DISK_LO, MOON_DISK_HI, md) * MOON_DISK_SCL * moonAmt;
      skyCol += MOON_COL_CORONA * pow(md, MOON_CORONA_EXP) * MOON_CORONA_SCL * moonAmt;
      skyCol += MOON_COL_HALO1  * pow(md, MOON_HALO1_EXP)  * MOON_HALO1_SCL  * moonAmt;
      skyCol += MOON_COL_HALO2  * pow(md, MOON_HALO2_EXP)  * MOON_HALO2_SCL  * moonAmt;
    }

    // Stars — three parallax depth layers. Nearer stars are sparser, larger,
    // brighter and drift faster; farther stars are dense, tiny, dim and slow.
    // Sliding past each other at different rates is what reads as 3D depth
    // rather than a flat sheet of dots. Each star is soft-edged and faintly
    // colour-tinted (see starLayer).
    if (uStars > STAR_THRESHOLD) {
      vec3 stars = vec3(0.0);
      stars += starLayer(rd.xy, STAR_DENSITY * 0.62, STAR_DRIFT * 1.70, 1.00,
                         STAR_RADIUS_MIN * 1.5, STAR_RADIUS_MAX * 1.6);   // near
      stars += starLayer(rd.xy, STAR_DENSITY * 1.00, STAR_DRIFT * 1.00, 0.75,
                         STAR_RADIUS_MIN,       STAR_RADIUS_MAX);         // mid
      stars += starLayer(rd.xy, STAR_DENSITY * 1.70, STAR_DRIFT * 0.50, 0.50,
                         STAR_RADIUS_MIN * 0.7, STAR_RADIUS_MAX * 0.75);  // far
      skyCol += stars * smoothstep(STAR_HOR_LO, STAR_HOR_HI, rd.y) * uStars * STAR_SCALE;
    }

    // Horizon mist
    skyCol += fogCol * exp(-abs(rd.y) * HZ_MIST_FALL) * HZ_MIST_SCL;
  }

  // ── Sea ──────────────────────────────────────────────────
  float seaMix = pow(smoothstep(0.0, SEA_HORIZON_BLEND, rd.y), SEA_HORIZON_EXP);
  vec3 col;

  if (seaMix > SEA_MIX_THRESHOLD) {
    vec3 p;
    seaTrace(ori, rd, p, seaH, seaCh, seaT);
    vec3 dist = p - ori;
    float eps = dot(dist, dist) * SEA_NORMAL_EPS_K / uR.x;
    vec3 n = seaNormal(p, eps, seaH, seaCh, seaT);
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), FRESNEL_EXP) * FRESNEL_SCL;

    vec3 reflDir = reflect(rd, n);
    float rElev = clamp(reflDir.y, 0.0, 1.0);
    vec3 reflSky = mix(skyHori, skyTop, pow(rElev, SKY_GRAD_EXP));

    float rSun = max(dot(reflDir, sunDir), 0.0);
    reflSky += sunCol * pow(rSun, REFL_SUN_EXP_A) * REFL_SUN_SCL_A * sunGlow;
    reflSky += sunCol * pow(rSun, REFL_SUN_EXP_B) * REFL_SUN_SCL_B * sunGlow;

    if (moonAmt > MOON_THRESHOLD) {
      float rMoon = max(dot(reflDir, moonDir), 0.0);
      reflSky += REFL_MOON_COL_A * pow(rMoon, REFL_MOON_EXP_A) * REFL_MOON_SCL_A * moonAmt;
      reflSky += REFL_MOON_COL_B * pow(rMoon, REFL_MOON_EXP_B) * REFL_MOON_SCL_B * moonAmt;
      reflSky += REFL_MOON_COL_C * pow(rMoon, REFL_MOON_EXP_C) * REFL_MOON_SCL_C * moonAmt;
    }

    float diff = pow(dot(n, sunDir) * DIFF_WRAP + DIFF_LIFT, DIFF_EXP) * sunGlow;
    vec3 refracted = seaBase + diff * seaWater * DIFF_WATER_SCL;
    vec3 waterCol = mix(refracted, reflSky, fresnel);

    float atten = max(1.0 - dot(dist, dist) * SSS_ATTEN_K, 0.0);
    waterCol += seaWater * (p.y - seaH) * SSS_SCL * atten;

    float specNrm = (SPEC_EXP + 8.0) / (PI * 8.0);
    float spec = pow(max(dot(reflect(-sunDir, n), -rd), 0.0), SPEC_EXP) * specNrm;
    waterCol += sunCol * spec * sunAbove;

    float glitter = noise(p.xz * GLITTER_UV_SCL + vec2(uT * GLITTER_TIME_U, uT * GLITTER_TIME_V));
    waterCol += sunCol * smoothstep(GLITTER_THRESH, 1.0, glitter) * GLITTER_SCL * sunGlow * sunAbove;

    if (moonAmt > MOON_THRESHOLD) {
      float ms = max(dot(reflect(-moonDir, n), -rd), 0.0);
      waterCol += MSPEC_COL_A * pow(ms, MSPEC_EXP_A) * MSPEC_SCL_A * moonAmt;
      waterCol += MSPEC_COL_B * pow(ms, MSPEC_EXP_B) * MSPEC_SCL_B * moonAmt;
    }

    waterCol = mix(waterCol, fogCol, 1.0 - exp(-length(dist) * fogDen * FOG_SCALE));
    col = mix(skyCol, waterCol, seaMix);
  } else {
    col = skyCol;
  }

  // ── Post ─────────────────────────────────────────────────
  col = mix(fogCol, col, smoothstep(HOR_EDGE_LO, HOR_EDGE_HI, rd.y) * HOR_BLEND
          + (1.0 - HOR_BLEND));
  col += (hash(gl_FragCoord.xy * GRAIN_UV_SCL + floor(uT * GRAIN_TIME_SCL)) - 0.5) * GRAIN_STR;
  gl_FragColor = vec4(clamp(pow(col, vec3(GAMMA)), 0.0, 1.0), 1.0);
}
`;

  // ── The cycle ─────────────────────────────────────────────────
  // KEYS decides which palette stop is active at a given hour of the day; the
  // palette cross-fades between neighbouring keys. The hour itself comes from
  // the viewer's real clock ('real' mode) or a fixed pinned phase.
  // Stops: 0 DAWN · 1 MIDDAY · 2 DUSK · 3 NIGHT · 4 PRE-DAWN.
  const KEYS = [
    { h: 0.0,  a: 3 },
    { h: 4.3,  a: 3 },
    { h: 5.8,  a: 4 },
    { h: 6.8,  a: 0 },
    { h: 8.6,  a: 0 },
    { h: 11.0, a: 1 },
    { h: 16.5, a: 1 },
    { h: 19.4, a: 2 },
    { h: 20.6, a: 2 },
    { h: 21.9, a: 3 },
    { h: 24.0, a: 3 }
  ];

  const SUNRISE = 6.5;
  const SUNSET  = 19.5;

  const cycleAt = (hour) => {
    let i = 0;
    while (i < KEYS.length - 2 && hour >= KEYS[i + 1].h) i++;
    const k0 = KEYS[i], k1 = KEYS[i + 1];
    const t = clamp01((hour - k0.h) / Math.max(1e-6, k1.h - k0.h));
    return { a: k0.a, b: k1.a, bl: smoother(t) };
  };

  const stopWeight = (st, idx) =>
    (st.a === idx ? 1 - st.bl : 0) + (st.b === idx ? st.bl : 0);

  // Continuous sun arc: 0 at sunrise (east horizon), PI at sunset (west
  // horizon), swinging below the horizon the rest of the loop. Deliberately
  // no `hour < SUNRISE ? hour + 24` wrap — that wrap put a discontinuity
  // right at sunrise, so the sun and its glow popped in as a hard cut
  // instead of lifting smoothly off the water. Below the horizon the sun
  // contributes nothing (sunGlow / sunAbove gate it), so the invisible jump
  // at the midnight loop wrap doesn't matter.
  const sunAngleAt = (hour) => (PI * (hour - SUNRISE)) / (SUNSET - SUNRISE);

  // Persistent clock, shared across every theme instance (the live background,
  // the settings live-preview, and the fresh instance created on each quality /
  // intensity re-init). Keeping it at module scope keeps the waves continuous
  // across a re-init and keeps the preview in step with the background.
  //   t    wave / animation seconds (speed-scaled, always advancing)
  //   seaT wave phase, integrated with the day's current wave speed
  //   last previous draw timestamp, for the dt guard
  const clock = { t: 0, seaT: 0, last: null };

  // Wave speed per palette stop, mirroring the shader's SEA_SPD_* constants.
  // Integrated into clock.seaT (not multiplied by absolute time) so a change in
  // speed during a transition can't spike the wave phase.
  // index: 0 DAWN · 1 MIDDAY · 2 DUSK · 3 NIGHT · 4 PRE-DAWN
  const SEA_SPD = [0.80, 0.65, 0.90, 0.55, 0.48];

  // ── Time-of-day mode ──────────────────────────────────────────
  // 'real' (default) drives the palette straight from the viewer's local clock,
  // so the scene matches the sky outside. A phase key HOLDS the scene at that
  // time of day — it does not cycle onward — so a chosen time stays put. Buttons
  // in the settings preview switch between them; `mode` is module-scope so the
  // background and the preview always agree.
  const PHASE_HOURS = {
    preDawn: 4.8,
    dawn:    6.6,
    midday:  10.5,
    dusk:    19.3,
    night:   22.5
  };
  let mode = 'real';

  // Viewer's local time as a fractional hour in [0,24).
  const realHour = () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  };

  const applyMode = (m) => {
    if (m === 'real' || PHASE_HOURS[m] != null) mode = m;
  };

  // ── Compile ───────────────────────────────────────────────────
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }

  // ── Theme ─────────────────────────────────────────────────────
  class OceanCycleTheme {
    constructor() { this.contextType = 'webgl'; }

    init(canvas, _ctx, options) {
      this.canvas = canvas;
      this.opts = options || {};
      this.speed = (options && options.speed) || 1.0;
      // Adopt the caller's time-of-day mode only when it actually passes one.
      // The live background and the settings preview do; picker thumbnails
      // don't, so those throwaway instances can't change a pinned live scene.
      if (options && options.oceanTime) applyMode(options.oceanTime);

      const quality = (options && options.quality) || 1.5;
      // A small canvas means a picker thumbnail or the settings live-preview
      // tile. scenePreview draws ~120 settle frames there, all synchronously,
      // which is what makes opening the menu hitch; the scene is deterministic
      // and needs no settling, so force the cheapest tier for those.
      const small = (canvas.clientWidth || 9999) <= 512;
      const tier  = small ? TIERS.eco : tierFor(quality);
      this.dpr = Math.min(quality, DPR_CAP) * tier.scale;

      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      this.gl = gl;
      if (!gl) return;

      const src = FS.replace('__TRACE__', tier.trace)
                    .replace('__OCTG__',  tier.octG)
                    .replace('__OCTF__',  tier.octF);
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, src));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(prog));
        return;
      }
      gl.useProgram(prog);
      this.prog = prog;

      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.disable(gl.DITHER);

      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const al = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(al);
      gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);

      this.uR     = gl.getUniformLocation(prog, 'uR');
      this.uT     = gl.getUniformLocation(prog, 'uT');
      this.uA     = gl.getUniformLocation(prog, 'uA');
      this.uB     = gl.getUniformLocation(prog, 'uB');
      this.uBl    = gl.getUniformLocation(prog, 'uBl');
      this.uDusk  = gl.getUniformLocation(prog, 'uDusk');
      this.uStars = gl.getUniformLocation(prog, 'uStars');
      this.uSunA  = gl.getUniformLocation(prog, 'uSunA');
      this.uSeaT  = gl.getUniformLocation(prog, 'uSeaT');

      this.resize();
    }

    // Own the canvas sizing: raymarch resolution is the canvas's CSS box
    // scaled by this.dpr (quality slider, capped, times the tier scale).
    // Reading the element's client box (not the pixel args the engine passes,
    // nor the window) keeps it correct in all three drivers: full-screen via
    // the engine, the small offscreen thumbnail, and the settings live-preview.
    resize() {
      if (!this.gl) return;
      const cw = this.canvas.clientWidth  || window.innerWidth;
      const ch = this.canvas.clientHeight || window.innerHeight;
      const w = Math.max(1, Math.floor(cw * this.dpr));
      const h = Math.max(1, Math.floor(ch * this.dpr));
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }

    draw(ts) {
      const gl = this.gl;
      if (!gl) return;

      // Robust dt against the shared module clock. Only advance on a strictly
      // forward step: the engine passes draw(0) for a single static / reduced-
      // motion frame, and scenePreview passes a fresh 0-based timeline — a raw
      // (ts - last) there goes hugely negative and ran the day backwards into
      // night (the "static mode becomes night" bug). Clamp big gaps too so a
      // tab-switch doesn't lurch the waves.
      let dt = 0;
      if (clock.last != null && ts > clock.last) dt = Math.min((ts - clock.last) / 1000, DT_MAX);
      clock.last = ts;
      const sp = this.speed || 1;
      clock.t += dt * sp;  // waves always advance, in both modes

      // 'real' tracks the viewer's local clock; a pinned phase HOLDS at that
      // time of day (no cycling), so a chosen time stays exactly where it is.
      const hour = mode === 'real' ? realHour() : PHASE_HOURS[mode];
      const st = cycleAt(hour);

      // Integrate the wave phase with the CURRENT wave speed. Multiplying
      // absolute time by a speed that changes during a transition is what made
      // the waves briefly race; integrating keeps the rate change smooth.
      const seaSpd = SEA_SPD[st.a] * (1 - st.bl) + SEA_SPD[st.b] * st.bl;
      clock.seaT += dt * sp * seaSpd;

      gl.useProgram(this.prog);
      gl.uniform2f(this.uR, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uT, clock.t);
      gl.uniform1f(this.uA, st.a);
      gl.uniform1f(this.uB, st.b);
      gl.uniform1f(this.uBl, st.bl);
      gl.uniform1f(this.uDusk, stopWeight(st, 2));
      gl.uniform1f(this.uStars, stopWeight(st, 3) + stopWeight(st, 4));
      gl.uniform1f(this.uSunA, sunAngleAt(hour));
      gl.uniform1f(this.uSeaT, clock.seaT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // Live switch from the settings time-of-day buttons.
    setDayTime(m) { applyMode(m); }

    start() {}
    stop()  {}

    destroy() {
      const gl = this.gl;
      if (!gl) return;
      gl.deleteBuffer(this.buf);
      gl.deleteProgram(this.prog);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.gl = null;
    }
  }

  // Ordered list the settings UI renders as time-of-day buttons. 'real' is the
  // default (follows the viewer's clock); the rest pin the loop to a phase.
  OceanCycleTheme.DAY_TIMES = [
    { key: 'real',    label: 'Real Time' },
    { key: 'preDawn', label: 'Pre-Dawn' },
    { key: 'dawn',    label: 'Dawn' },
    { key: 'midday',  label: 'Midday' },
    { key: 'dusk',    label: 'Dusk' },
    { key: 'night',   label: 'Night' }
  ];

  window.OceanCycleTheme = OceanCycleTheme;
})();
