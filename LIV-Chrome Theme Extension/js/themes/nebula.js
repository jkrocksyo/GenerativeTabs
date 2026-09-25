'use strict';

// Vertex shader — fullscreen passthrough quad
const NEBULA_VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Fragment shader — layered FBM nebula + star field
const NEBULA_FRAG = `
precision mediump float;
uniform float u_time;
uniform vec2  u_res;
uniform vec3  u_c1;   // deep base
uniform vec3  u_c2;   // broad haze
uniform vec3  u_c3;   // main cloud
uniform vec3  u_c4;   // highlight streaks

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i),           b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0,1.0)), d = hash(i + vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    amp *= 0.5;
    p = p * 2.0 + vec2(1.7, 9.2);
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  // Correct for aspect ratio
  uv.x *= u_res.x / u_res.y;
  uv *= 1.4;

  float t = u_time * 0.028;

  // Domain-warped FBM for cloud shapes
  vec2 q = vec2(fbm(uv + t), fbm(uv + vec2(5.2, 1.3)));
  vec2 r = vec2(
    fbm(uv + 1.2 * q + vec2(1.7, 9.2) + 0.13 * t),
    fbm(uv + 1.2 * q + vec2(8.3, 2.8) + 0.11 * t)
  );
  float f = fbm(uv + 1.5 * r);

  // Palette (driven from the chosen colour preset)
  vec3 c1 = u_c1, c2 = u_c2, c3 = u_c3, c4 = u_c4;

  float f2 = f * f;
  float f3 = f2 * f;
  vec3 col = c1;
  col = mix(col, c2, clamp(f  * 2.0,  0.0, 1.0));
  col = mix(col, c3, clamp(f2 * 3.0,  0.0, 1.0));
  col = mix(col, c4, clamp(f3 * 5.0 - 1.5, 0.0, 1.0));
  col *= 0.85 + 0.15 * f;

  // Star field overlaid in shader
  vec2 starUV = gl_FragCoord.xy / u_res * 80.0;
  vec2 sc = floor(starUV);
  vec2 sf = fract(starUV);
  float sr = hash(sc);
  vec2 sp = vec2(hash(sc + 0.1), hash(sc + 0.2));
  float sd = length(sf - sp);
  float star = smoothstep(0.06, 0.0, sd) * step(0.965, sr) * (0.5 + 0.5 * hash(sc + 3.1));
  col += vec3(star * 0.9);

  gl_FragColor = vec4(col, 1.0);
}
`;

// Colour presets reuse the shared Interactive palettes so Nebula Drift's swatch
// picker matches the rest of the app. The base tone (c1) is always dark and
// derived from the main colour — never from the palette's background — so a
// light-background palette (e.g. Daylight) can't invert the nebula into a
// washed-out light cloud.
const NEBULA_DEFAULT_COLS = {
  c1: [0.06, 0.03, 0.14], c2: [0.23, 0.04, 0.38],
  c3: [0.71, 0.09, 0.62], c4: [0.02, 0.50, 0.72]
};
function _nebHexRgb(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return Number.isFinite(n) ? [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] : [1, 1, 1];
}
function _nebColors(name) {
  const pal = window.interactivePalette ? window.interactivePalette(name) : null;
  if (!pal) return NEBULA_DEFAULT_COLS;
  const dot = _nebHexRgb(pal.dot), acc = _nebHexRgb(pal.accent);
  const c1 = [dot[0] * 0.10, dot[1] * 0.10, dot[2] * 0.10];  // always-dark, tinted base
  const c2 = [c1[0] + (dot[0] - c1[0]) * 0.55, c1[1] + (dot[1] - c1[1]) * 0.55, c1[2] + (dot[2] - c1[2]) * 0.55];
  return { c1, c2, c3: dot, c4: acc };
}

class NebulaTheme {
  constructor() {
    this.contextType = 'webgl';
    this.webglFailed = false;
    this.gl = null;
    this.program = null;
    this.buf = null;
    this.uTime = null;
    this.uRes = null;
    this.w = 0;
    this.h = 0;
    // Canvas-2D fallback state
    this.ctx2d = null;
    this.clouds = [];
    this.fallbackStars = [];
    this.intensity = 1.0;
    this.speed = 1.0;
    this.uC1 = this.uC2 = this.uC3 = this.uC4 = null;
    this._cols = NEBULA_DEFAULT_COLS;
  }

  init(canvas, ctx, opts) {
    this.canvas = canvas;
    this.w = canvas.width;
    this.h = canvas.height;
    this.intensity = opts.intensity || 1.0;
    this.speed = opts.speed || 1.0;
    this._cols = _nebColors(opts.scenePalette);

    if (!this.webglFailed) {
      this._initGL(ctx);
    } else {
      this._initFallback(ctx);
    }
  }

  // ── WebGL path ───────────────────────────────────────────────────────────

  _compileShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('Shader compile error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  _initGL(gl) {
    this.gl = gl;
    const vert = this._compileShader(gl, gl.VERTEX_SHADER, NEBULA_VERT);
    const frag = this._compileShader(gl, gl.FRAGMENT_SHADER, NEBULA_FRAG);
    if (!vert || !frag) { this._fallbackToCanvas(); return; }

    const prog = gl.createProgram();
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Program link error:', gl.getProgramInfoLog(prog));
      this._fallbackToCanvas();
      return;
    }

    this.program = prog;
    this.uTime = gl.getUniformLocation(prog, 'u_time');
    this.uRes  = gl.getUniformLocation(prog, 'u_res');
    this.uC1 = gl.getUniformLocation(prog, 'u_c1');
    this.uC2 = gl.getUniformLocation(prog, 'u_c2');
    this.uC3 = gl.getUniformLocation(prog, 'u_c3');
    this.uC4 = gl.getUniformLocation(prog, 'u_c4');

    // Fullscreen quad
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1,  1,-1, -1,1,
       1,-1,  1, 1, -1,1
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, this.w, this.h);
    this._glReady = true;
  }

  _fallbackToCanvas() {
    // WebGL failed mid-init; rebuild canvas as 2D (caller's canvas is still WebGL)
    // Best we can do: switch context by creating a new 2D canvas in same spot
    const canvas2 = document.createElement('canvas');
    canvas2.id = 'bg-canvas';
    canvas2.width = this.canvas.width;
    canvas2.height = this.canvas.height;
    canvas2.style.width = '100vw';
    canvas2.style.height = '100vh';
    this.canvas.parentNode && this.canvas.parentNode.replaceChild(canvas2, this.canvas);
    this.canvas = canvas2;
    this.ctx2d = canvas2.getContext('2d');
    this.webglFailed = true;
    this._glReady = false;
    this._initFallback(this.ctx2d);
  }

  // ── Canvas-2D fallback ────────────────────────────────────────────────────

  _initFallback(ctx) {
    this.ctx2d = ctx;
    const n = Math.round(5 * this.intensity);
    this.clouds = [];
    for (let i = 0; i < n; i++) {
      this.clouds.push({
        x: Math.random(), y: Math.random(),
        rx: 0.25 + Math.random() * 0.35, ry: 0.18 + Math.random() * 0.28,
        color: ['rgba(58,12,163,', 'rgba(181,23,158,', 'rgba(6,182,212,', 'rgba(112,26,117,'][i % 4],
        alpha: 0.12 + Math.random() * 0.18,
        vx: (Math.random() - 0.5) * 0.00008,
        vy: (Math.random() - 0.5) * 0.00005,
        scaleT: Math.random() * Math.PI * 2,
        scaleSpd: 0.0004 + Math.random() * 0.0003,
      });
    }
    const sc = Math.round(120 * this.intensity);
    this.fallbackStars = Array.from({ length: sc }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: 0.3 + Math.random() * 1.0,
      a: 0.3 + Math.random() * 0.7,
    }));
  }

  _drawFallback(ts) {
    const ctx = this.ctx2d;
    const w = this.w, h = this.h;
    ctx.fillStyle = '#0a0514';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const c of this.clouds) {
      c.x += c.vx * this.speed; c.y += c.vy * this.speed;
      if (c.x < -0.4) c.x = 1.2;
      if (c.x > 1.2) c.x = -0.4;
      if (c.y < -0.3) c.y = 1.2;
      if (c.y > 1.2) c.y = -0.3;
      c.scaleT += c.scaleSpd * this.speed;
      const scale = 1 + 0.12 * Math.sin(c.scaleT);
      const cx = c.x * w, cy = c.y * h;
      const rx = c.rx * w * scale, ry = c.ry * h * scale;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      grad.addColorStop(0, c.color + c.alpha + ')');
      grad.addColorStop(0.4, c.color + (c.alpha * 0.4) + ')');
      grad.addColorStop(1, c.color + '0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    for (const s of this.fallbackStars) {
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Common interface ─────────────────────────────────────────────────────

  draw(ts) {
    if (this._glReady && this.gl) {
      const gl = this.gl;
      gl.useProgram(this.program);
      gl.uniform1f(this.uTime, ts * 0.001 * this.speed);
      gl.uniform2f(this.uRes, this.w, this.h);
      gl.uniform3fv(this.uC1, this._cols.c1);
      gl.uniform3fv(this.uC2, this._cols.c2);
      gl.uniform3fv(this.uC3, this._cols.c3);
      gl.uniform3fv(this.uC4, this._cols.c4);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else {
      this._drawFallback(ts);
    }
  }

  resize(w, h) {
    this.w = w; this.h = h;
    if (this._glReady && this.gl) this.gl.viewport(0, 0, w, h);
  }

  // Live colour swap from the palette swatches (WebGL picks it up next frame).
  setPreset(name) { this._cols = _nebColors(name); }

  destroy() {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
      if (this.buf) this.gl.deleteBuffer(this.buf);
    }
    this.clouds = [];
    this.fallbackStars = [];
  }
}

// Lazy-loader hook: expose the class on window so it can be resolved by name.
window.NebulaTheme = NebulaTheme;
