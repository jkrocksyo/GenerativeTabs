'use strict';

(function () {
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

  const FRAG = `precision highp float;
uniform float u_time;
uniform vec2  u_res;
uniform float u_intensity;

// ── Noise ──────────────────────────────────────────────────────────────────
float h21(vec2 p){ p=fract(p*vec2(127.1,311.7)); p+=dot(p,p+19.19); return fract(p.x*p.y); }
float vn(vec2 p){
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x),u.y);
}
float fbm4(vec2 p){ float v=0.,a=.5; for(int i=0;i<4;i++){v+=a*vn(p);p=p*2.03+vec2(4.1,1.7);a*=.5;} return v; }
float fbm3(vec2 p){ float v=0.,a=.5; for(int i=0;i<3;i++){v+=a*vn(p);p=p*2.03+vec2(4.1,1.7);a*=.5;} return v; }

// ── Scene constants ─────────────────────────────────────────────────────────
// Y splits (0 = bottom of screen, 1 = top)
const float Y_SKY   = 0.36;  // sky / cloud region starts
const float Y_HOR   = 0.295; // horizon haze zone centre
const float Y_OCN   = 0.135; // ocean surface starts (cliff drop-off)
const float Y_EDGE  = 0.095; // cliff-top lip / edge
const float Y_FACE  = 0.00;  // cliff face bottom

// ── Palette (golden hour) ───────────────────────────────────────────────────
const vec2  SUN_UV   = vec2(0.13, 0.76);   // sun pos in UV space (upper-left, off-screen)
const vec3  SUN_COL  = vec3(1.00, 0.82, 0.50);
const vec3  SKY_ZEN  = vec3(0.28, 0.44, 0.74);
const vec3  SKY_MID  = vec3(0.48, 0.62, 0.84);
const vec3  SKY_HOR  = vec3(0.84, 0.64, 0.36);
const vec3  CLD_LIT  = vec3(1.00, 0.96, 0.82);
const vec3  CLD_DRK  = vec3(0.38, 0.34, 0.42);
const vec3  OCN_NEAR = vec3(0.04, 0.11, 0.22);
const vec3  OCN_MID  = vec3(0.07, 0.22, 0.40);
const vec3  OCN_FAR  = vec3(0.22, 0.44, 0.56);
const vec3  ROCK_COL = vec3(0.32, 0.27, 0.22);
const vec3  MOSS_COL = vec3(0.18, 0.28, 0.10);
const vec3  GRASS_COL= vec3(0.23, 0.36, 0.12);

// ── Sky background ──────────────────────────────────────────────────────────
vec3 skyBg(vec2 uv){
  float h = clamp((uv.y - Y_SKY) / (1.0 - Y_SKY), 0.0, 1.0);
  vec3 c  = mix(SKY_HOR, SKY_MID, smoothstep(0.0, 0.28, h));
  c       = mix(c,       SKY_ZEN, smoothstep(0.22, 0.85, h));
  // Sun halo
  float sd = length(uv - SUN_UV);
  c += SUN_COL * (exp(-sd * 9.0) * 1.3 + exp(-sd * 3.2) * 0.28);
  return c;
}

// ── Cloud density ───────────────────────────────────────────────────────────
// layer: 0 = cloud base, 1 = cloud top
float cDens(vec2 p, float layer){
  // light domain warp (precomputed outside march loop for speed)
  float base = fbm3(p * 1.3);
  float det  = vn(p * 4.8 + vec2(1.3)) * 0.15;
  float d    = base + det - (0.78 - layer * 0.10);
  return clamp(d * 2.2, 0.0, 1.0);
}

// ── Cloud march (8 steps) ───────────────────────────────────────────────────
vec4 marchClouds(vec2 uv){
  if(uv.y < Y_SKY) return vec4(0.0);
  float skyH = (uv.y - Y_SKY) / (1.0 - Y_SKY); // 0=horizon, 1=zenith

  // Clouds concentrated in mid-sky band
  float zone = smoothstep(0.0, 0.20, skyH) * (1.0 - smoothstep(0.72, 1.0, skyH));
  if(zone < 0.01) return vec4(0.0);

  float scroll = u_time * 0.013;
  vec3  col    = vec3(0.0);
  float alpha  = 0.0;
  float dith   = h21(gl_FragCoord.xy * 0.31 + u_time * 0.07) * 0.12;

  for(int i = 0; i < 8; i++){
    float fi    = (float(i) + dith) / 8.0;
    float layer = fi;                       // cloud layer height fraction
    float depth = 0.6 + fi * 3.8;          // perspective depth

    // Precompute warp offset once per step (cheaper than fbm3 twice)
    float wx = vn(vec2(fi * 1.3 + scroll * 0.4, 0.5)) * 0.25;
    vec2 wp = vec2(uv.x * depth + scroll * (1.0 + fi * 0.35) + wx,
                   layer * 1.1 + uv.x * 0.08);

    float d = cDens(wp, layer) * zone;
    if(d < 0.015) continue;

    // Lighting: bright tops, dark undersides, golden rim from sun
    float topFace = smoothstep(0.15, 0.88, layer);
    float sunFace = exp(-length(uv - SUN_UV) * 3.8);
    vec3  cCol    = mix(CLD_DRK, CLD_LIT, topFace);
    cCol = mix(cCol, CLD_LIT * SUN_COL * 1.08, sunFace * topFace * 0.52);
    cCol += SUN_COL * 0.07 * (1.0 - topFace); // warm bounce on underside

    float stepA = d * 0.28 * (1.0 - alpha);
    col   += cCol * stepA;
    alpha += stepA;
    if(alpha > 0.93) break;
  }
  return vec4(col, alpha * zone);
}

// ── God rays (cheap screen-space, 6 taps) ───────────────────────────────────
vec3 godRays(vec2 uv, vec3 base){
  float t   = u_time * 0.008;
  float occ = vn(uv * 5.0 + vec2(t * 2.0, 0.4)) * 0.45
            + vn(uv * 2.2 + vec2(t, 0.9)) * 0.3;
  float cone  = exp(-length(uv - SUN_UV) * 5.5);
  vec2  d     = normalize(uv - SUN_UV);
  float streak= max(0.0, dot(normalize(uv - (SUN_UV + d * 0.15)), d));
  streak = pow(streak, 14.0) * occ;
  return base + SUN_COL * streak * cone * 0.22 * u_intensity;
}

// ── Ocean ───────────────────────────────────────────────────────────────────
vec3 ocean(vec2 uv){
  float t    = u_time * 0.065;
  float persp= smoothstep(Y_OCN, Y_HOR + 0.02, uv.y);
  float wsc  = mix(20.0, 5.5, persp);

  float w = fbm3(uv * vec2(wsc, wsc * 1.6) + vec2(t * 1.7, t))
          + fbm3(uv * vec2(wsc * 1.3, wsc) + vec2(-t * 1.0, t * 0.8)) * 0.5;
  w /= 1.5;

  // Depth gradient
  vec3 col = mix(OCN_NEAR, OCN_MID, persp);
  col      = mix(col, OCN_FAR, smoothstep(Y_HOR - 0.02, Y_SKY, uv.y) * 0.9);

  // Wave highlights
  col += vec3(0.10, 0.20, 0.30) * w * 0.16;

  // Sun glitter track
  float glit = exp(-pow(abs(uv.x - SUN_UV.x) * 2.8, 2.0)) * (0.35 + w * 0.45);
  glit *= smoothstep(Y_OCN + 0.005, Y_HOR, uv.y);
  col += SUN_COL * glit * 0.55;

  // Near-cliff foam/spray
  float foam = smoothstep(0.70, 0.82, w)
             * smoothstep(Y_OCN + 0.012, Y_OCN + 0.002, uv.y);
  col = mix(col, vec3(0.82, 0.88, 0.92), foam * 0.38);

  // Horizon atmospheric haze
  float haze = smoothstep(Y_HOR, Y_SKY, uv.y);
  col = mix(col, skyBg(vec2(uv.x, Y_SKY + 0.01)), haze * 0.82);

  return col;
}

// ── Cliff face ──────────────────────────────────────────────────────────────
vec3 cliffFace(vec2 uv){
  vec2 cp = uv * vec2(3.2, 10.0);
  float r1 = fbm4(cp);
  float r2 = fbm3(cp * 1.7 + vec2(2.3));

  vec3 col = mix(ROCK_COL * 0.45, ROCK_COL * 0.95, 0.35 + r1 * 0.65);

  // Horizontal strata
  float s = sin(uv.y * 32.0 + r1 * 2.8) * 0.5 + 0.5;
  col = mix(col, col * vec3(0.75, 0.82, 0.90), smoothstep(0.6, 1.0, s) * 0.28);

  // Moss / lichen patches
  float m = smoothstep(0.60, 0.80, fbm3(uv * vec2(4.5, 2.8)));
  col = mix(col, MOSS_COL, m * 0.52);

  // Dark seepage streaks (vertical, water-stained)
  float seep = smoothstep(0.76, 1.0, r2)
             * smoothstep(Y_EDGE, Y_OCN - 0.01, uv.y);
  col *= 1.0 - seep * 0.42;

  // Mostly shadowed; tiny sun warmth
  col *= 0.48;
  col += SUN_COL * 0.045;
  return col;
}

// ── Cliff top (viewer's ledge) ───────────────────────────────────────────────
vec3 cliffTop(vec2 uv){
  float g = fbm4(uv * 15.0 + vec2(3.3));
  float r = fbm3(uv * 7.5  + vec2(0.7));

  vec3 col = mix(ROCK_COL, GRASS_COL, smoothstep(0.36, 0.68, g));

  // Warm afternoon light
  col *= 0.68;
  col += SUN_COL * 0.22 * smoothstep(0.30, 0.70, g);

  // Ambient occlusion at the very lip
  float ao = 1.0 - smoothstep(Y_EDGE + 0.003, Y_EDGE + 0.038, uv.y);
  col *= 1.0 - ao * 0.68;

  return col;
}

// ── Tree (Monterey-cypress silhouette, right side) ───────────────────────────
float treeAlpha(vec2 uv){
  if(uv.x < 0.64) return 0.0;

  float sway = sin(u_time * 0.36 + 0.6) * 0.007;
  float tx   = 0.81;   // trunk x-centre

  // Trunk
  float trunk = smoothstep(0.009, 0.003, abs(uv.x - tx))
              * smoothstep(Y_EDGE, Y_EDGE + 0.025, uv.y)
              * (1.0 - smoothstep(0.44, 0.50, uv.y));

  // Coastal wind bends branches rightward (away from screen-left sun/ocean)
  float bend = sway + (uv.y - 0.47) * 0.16;

  // Main foliage mass — broad, low, swept
  vec2  fc1 = uv - vec2(tx + bend, 0.56);
  fc1.x *= 1.5;
  float fn  = fbm3(uv * 17.0 + vec2(u_time * 0.025, 0.0));
  float f1  = smoothstep(0.06, -0.045, length(fc1) - 0.155 + fn * 0.09);

  // Secondary cluster, higher and more windswept
  vec2 fc2 = uv - vec2(tx + bend * 1.9 + 0.06, 0.68);
  fc2.x *= 1.25;
  float f2 = smoothstep(0.05, -0.032, length(fc2) - 0.092 + fn * 0.07);

  // Sparse outer wisp fringe
  float wisp = smoothstep(0.70, 0.77, fn)
             * smoothstep(0.07, 0.01, abs(length(fc1) - 0.16)) * 0.55;

  return clamp(trunk + f1 + f2 + wisp, 0.0, 1.0);
}

vec3 treeCol(vec2 uv){
  float lit = fbm3(uv * 11.0) * 0.45 + 0.05;
  vec3  col = vec3(0.05, 0.09, 0.03) + vec3(0.10, 0.14, 0.04) * lit;
  // Golden backlight rim from upper-left sun
  float rim = exp(-length(uv - SUN_UV) * 4.8);
  col += SUN_COL * rim * 0.65 * (0.4 + lit);
  col += SKY_MID * 0.06;  // cool sky fill on shadow side
  return col;
}

// ── Rough cliff edge (noise-displaced horizon) ───────────────────────────────
float cliffEdgeMask(vec2 uv){
  float en = fbm3(vec2(uv.x * 9.5, 0.5)) * 0.022;
  float threshold = Y_OCN + en;
  return smoothstep(threshold - 0.005, threshold + 0.005, uv.y);
}

// ── Main ────────────────────────────────────────────────────────────────────
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 col;

  // Base scene layers
  if(uv.y >= Y_SKY){
    col = skyBg(uv);
    vec4 cld = marchClouds(uv);
    col = mix(col, cld.rgb, cld.a);
    col = godRays(uv, col);
  } else if(uv.y >= Y_OCN){
    col = ocean(uv);
  } else if(uv.y >= Y_EDGE){
    col = cliffTop(uv);
  } else {
    col = cliffFace(uv);
  }

  // Cliff-edge jagged transition (noise-displaced horizontal band)
  if(abs(uv.y - Y_OCN) < 0.028){
    float em = cliffEdgeMask(uv);
    vec3  ct = cliffTop(vec2(uv.x, Y_EDGE + 0.01));
    col = mix(ct, col, em);
  }

  // Tree overlay (right two-fifths of frame, cliff top through sky)
  if(uv.x >= 0.63 && uv.y >= Y_EDGE * 0.5){
    float ta = treeAlpha(uv);
    if(ta > 0.005) col = mix(col, treeCol(uv), ta);
  }

  // Vignette
  vec2 vd = uv - 0.5;
  col *= 1.0 - dot(vd, vd) * 1.05;

  // Filmic tone map
  col  = col * 1.28 / (col + 0.82);
  col  = pow(max(col, 0.0), vec3(0.88));

  // Anti-banding dither
  col += (h21(gl_FragCoord.xy + u_time * 0.4) - 0.5) / 255.0;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('TheView shader error:', gl.getShaderInfoLog(s));
    }
    return s;
  }

  class TheViewTheme {
    constructor() {
      this.contextType = 'webgl';
      this.speed     = 1.0;
      this.intensity = 1.0;
      this.gl   = null;
      this.prog = null;
      this.buf  = null;
      this._elapsed = 0;
      this._lastTs  = null;
    }

    init(canvas, ctx, options) {
      this.canvas    = canvas;
      this.speed     = (options && options.speed)     || 1.0;
      this.intensity = (options && options.intensity) || 1.0;
      this._elapsed  = 0;
      this._lastTs   = null;

      if (this.webglFailed || !ctx || typeof ctx.drawArrays !== 'function') return;

      const gl = ctx;
      this.gl = gl;

      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER,   VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      this.prog = prog;

      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const al = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(al);
      gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);

      this.uTime      = gl.getUniformLocation(prog, 'u_time');
      this.uRes       = gl.getUniformLocation(prog, 'u_res');
      this.uIntensity = gl.getUniformLocation(prog, 'u_intensity');
    }

    draw(ts) {
      const gl = this.gl;
      if (!gl || !this.prog) return;
      if (this._lastTs !== null) {
        this._elapsed += (ts - this._lastTs) * 0.001 * this.speed;
      }
      this._lastTs = ts;
      gl.useProgram(this.prog);
      gl.uniform1f(this.uTime,      this._elapsed);
      gl.uniform2f(this.uRes,       this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uIntensity, this.intensity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    resize(_w, _h) {}
    start() {}
    stop()  {}

    destroy() {
      const gl = this.gl;
      if (!gl) return;
      if (this.buf)  gl.deleteBuffer(this.buf);
      if (this.prog) gl.deleteProgram(this.prog);
      this.buf  = null;
      this.prog = null;
      this.gl   = null;
    }
  }

  window.TheViewTheme = TheViewTheme;
})();
