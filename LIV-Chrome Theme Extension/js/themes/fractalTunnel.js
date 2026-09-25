// Fractal Tunnel
// Original scene by Daniel Muñoz. Raw WebGL2 for LiV (zero dependencies).
//
// Performance strategy:
//   1. Renders at a reduced internal resolution and lets the browser upscale.
//      The tunnel is soft and foggy, so this is nearly invisible.
//   2. Adaptive resolution: drops the render scale if frames run long,
//      creeps back up (never above the last known-bad level) when there is headroom.
//   3. Capped at 30 fps. The camera glides slowly, so 60 fps buys almost nothing.
//   4. Shader: surface detail noise only evaluated near surfaces, one warp noise
//      layer removed, slightly looser hit threshold.
//   5. Stops completely when the tab is hidden; a still frame under reduced motion.
//
// LiV integration note: the factory below (createFractalTunnel) is kept verbatim
// except for dropping ES-module `export`s. It is wrapped by FractalTunnelTheme so
// it plugs into LiV's ThemeEngine (init/draw/resize/destroy) without touching the
// shader or the performance logic. Because it needs its own WebGL2 canvas, the
// live scene injects that canvas and hides the engine's; picker thumbnails / the
// settings preview get a cheap static approximation instead.
(function () {
  'use strict';

  const FRACTAL_TUNNEL_PRESETS = {
    frost:    { light: [0.88, 0.93, 0.965], shadow: [0.20, 0.26, 0.34], glow: [0.35, 0.55, 0.75], grain: 0.03 },
    ember:    { light: [1.00, 0.87, 0.70],  shadow: [0.24, 0.13, 0.10], glow: [0.90, 0.48, 0.22], grain: 0.035 },
    nocturne: { light: [0.74, 0.79, 0.96],  shadow: [0.05, 0.07, 0.13], glow: [0.50, 0.38, 0.90], grain: 0.04 },
  };

  const DEFAULTS = {
    preset: "frost",
    targetFps: 30,        // frame cap
    scaleStart: 0.55,     // internal resolution as a fraction of CSS pixels
    scaleMin: 0.35,
    scaleMax: 0.75,
    mouseEase: 0.05,      // per 60 Hz frame (time-corrected)
    paletteEase: 0.04,    // per 60 Hz frame (time-corrected)
    stillTime: 12.0,      // frame shown under prefers-reduced-motion
  };

  const VERT = `#version 300 es
layout(location = 0) in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

  const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;
uniform vec3  uLight;
uniform vec3  uShadow;
uniform vec3  uGlow;
uniform float uGrain;

out vec4 fragColor;

#define MAX_STEPS 64
#define MAX_DIST 28.0
#define SECTORS 6.0
#define Z_PERIOD 4.0
#define TAU 6.2831853

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i + vec3(0.0,0.0,0.0)), hash3(i + vec3(1.0,0.0,0.0)), f.x),
        mix(hash3(i + vec3(0.0,1.0,0.0)), hash3(i + vec3(1.0,1.0,0.0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0.0,0.0,1.0)), hash3(i + vec3(1.0,0.0,1.0)), f.x),
        mix(hash3(i + vec3(0.0,1.0,1.0)), hash3(i + vec3(1.0,1.0,1.0)), f.x), f.y),
    f.z);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }

float map(vec3 p, out float orbit, float rt) {
  float axialR = length(p.xy);
  float zEvo = p.z * 0.11;

  // mirrored polar fold: seamless sectors
  float ang = TAU / SECTORS;
  float a = atan(p.y, p.x + 1e-4); // epsilon avoids atan(0,0) NaN on the axis
  a = abs(mod(a, ang) - ang * 0.5);
  p.xy = vec2(cos(a), sin(a)) * axialR;

  // periodic in Z: infinite tunnel
  p.z = mod(p.z, Z_PERIOD) - Z_PERIOD * 0.5;
  p.x -= 2.0;

  // LOD: no noise far away (fog hides it)
  float lod = clamp((20.0 - rt) / 14.0, 0.0, 1.0);
  if (lod > 0.01) {
    vec3 wp = p * 1.6 + vec3(0.0, 0.0, uTime * 0.15);
    vec2 w = vec2(vnoise(wp), vnoise(wp + 11.3)) - 0.5;
    p.xy += w * (0.1 * lod);
  }

  // peristalsis: frequency is a multiple of TAU/Z_PERIOD so the seam stays continuous
  p.x += sin(p.z * (3.0 * TAU / Z_PERIOD) - uTime) * 0.04;

  vec3 texP = p;
  float scale = 1.0;
  orbit = 1e9;
  float dCoarse = 1e9, dMid = 1e9, dFine = 1e9, dVein = 1e9, dUltra = 1e9;
  mat2 rYZ = rot(0.42 + 0.22 * sin(zEvo));
  mat2 rXZ = rot(-0.23 + 0.22 * cos(zEvo * 1.1));
  vec3 ifsOff = vec3(2.1 + 0.22 * sin(zEvo * 0.7), 1.35, 0.95 + 0.18 * cos(zEvo));

  for (int i = 0; i < 9; i++) {
    p = abs(p);
    if (p.x < p.y) p.xy = p.yx;
    if (p.x < p.z) p.xz = p.zx;
    p.yz *= rYZ;
    p.xz *= rXZ;
    p = p * 2.0 - ifsOff;
    scale *= 2.0;
    orbit = min(orbit, length(p));
    if (i == 2) dCoarse = (length(p.xy) - (0.34 + 0.10 * sin(zEvo * 0.8))) / scale;
    else if (i == 4) dMid   = (length(p.xy) - (0.22 + 0.07 * sin(zEvo * 1.3 + 1.0))) / scale;
    else if (i == 6) dFine  = (length(p.xy) - (0.12 + 0.04 * sin(zEvo * 2.1))) / scale;
    else if (i == 7) dVein  = (length(p.xy) - (0.10 + 0.03 * sin(zEvo * 2.4))) / scale;
    else if (i == 8) dUltra = (length(p.xy) - (0.09 + 0.03 * sin(zEvo * 2.7))) / scale;
  }
  float d = smin(dCoarse, dMid, 0.20);
  d = smin(d, dFine, 0.11);
  d = smin(d, dVein, 0.08);
  d = smin(d, dUltra, 0.06);

  // surface grain only matters right at the surface: skip it everywhere else
  if (lod > 0.01 && d < 0.08) {
    d -= (vnoise(texP * 7.0 + vec3(0.0, 0.0, uTime * 0.1)) - 0.5) * (0.008 * lod);
  }

  // keep a clear channel around the flight axis
  return smax(d, 0.5 - axialR, 0.3);
}

float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;

  float glide = uTime * 0.42 + 0.15 * sin(uTime * 0.20);
  vec3 ro = vec3(0.0, 0.0, glide);
  vec3 rd = normalize(vec3(uv + uMouse * 0.35, 1.5));
  rd.xy *= rot(uTime * 0.012);

  float t = 0.0, steps = 0.0, orbit = 0.0, o;
  for (int i = 0; i < MAX_STEPS; i++) {
    float d = map(ro + rd * t, o, t);
    orbit = o;
    if (d < 0.0015 * (1.0 + t) || t > MAX_DIST) break;
    t += d * 0.78;
    steps += 1.0;
  }

  // step-count AO
  float ao = 1.0 - steps / float(MAX_STEPS);
  float breath = 0.85 + 0.15 * sin(uTime * 0.63);

  vec3 col = mix(uShadow, uLight, pow(ao, 2.2));
  col += uGlow * exp(-orbit * 1.5) * 0.25 * breath;
  col += uLight * 0.18 * exp(-orbit * 7.0);

  float fog = 1.0 - exp(-t * 0.075);
  col = mix(col, uLight, fog * 0.5);

  vec2 axisUV = uv + uMouse * 0.35;
  float shaft = exp(-abs(axisUV.x) * 9.0) * exp(-abs(axisUV.y) * 0.9);
  float axis = length(axisUV);
  col += uLight * 0.16 * exp(-axis * 4.0) * breath;
  col += uLight * 0.85 * shaft * (0.3 + 0.7 * fog) * breath;

  // NaN scrub: max(NaN, x) returns x. Must run before the light core.
  col = max(col, uShadow * 0.55);

  // guaranteed light core (mix, not additive) covers the degenerate axis
  col = mix(col, uLight, exp(-axis * 9.0));
  col = min(col, uLight * 1.045);

  // post: gentle vignette + film grain
  vec2 q = gl_FragCoord.xy / uResolution;
  float vig = pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.14);
  col *= mix(0.82, 1.0, vig);
  col += (grainHash(gl_FragCoord.xy + fract(uTime * 7.13) * 431.0) - 0.5) * uGrain;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

  /**
   * Creates the Fractal Tunnel scene on a full-viewport canvas.
   * The canvas should be sized by CSS (position:fixed; inset:0; width:100%; height:100%).
   * Returns { start, stop, destroy, setPreset, stats }.
   */
  function createFractalTunnel(canvas, options = {}) {
    const cfg = { ...DEFAULTS, ...options };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const gl = canvas.getContext("webgl2", {
      antialias: false, alpha: false, depth: false, stencil: false,
      // preserveDrawingBuffer: keep the last frame between composites. The scene
      // caps at 30 fps, so on the compositor frames it doesn't redraw, this stops
      // the buffer from being shown cleared (black). Negligible cost at this
      // reduced internal resolution.
      preserveDrawingBuffer: true, powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 not available");

    let program, vao, buffer, U = {};

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error(log);
      }
      return s;
    }

    function initGL() {
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG);
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);

      // one oversized triangle covers the screen (cheaper than a quad)
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      U = {};
      ["uTime", "uResolution", "uMouse", "uLight", "uShadow", "uGlow", "uGrain"]
        .forEach((n) => (U[n] = gl.getUniformLocation(program, n)));
      resize(true);
    }

    // ---------- resolution ----------
    let scale = cfg.scaleStart;
    let ceiling = cfg.scaleMax;

    function resize(force = false) {
      const cssW = canvas.clientWidth || window.innerWidth;
      const cssH = canvas.clientHeight || window.innerHeight;
      const w = Math.max(1, Math.round(cssW * scale));
      const h = Math.max(1, Math.round(cssH * scale));
      if (force || canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(U.uResolution, w, h);
        // Setting canvas.width/height reallocates the drawing buffer and clears
        // it. Repaint in the SAME tick so the compositor never shows the empty
        // (black) buffer — that clear-then-wait was the source of the black
        // flashes during adaptive-resolution changes. Does not alter the fps
        // cap or the adaptive-scale decision, only avoids a blank frame.
        if (program) draw(time, 0);
      }
    }

    // ---------- state ----------
    const mouse = [0, 0];
    const mouseTarget = [0, 0];
    // cfg.preset may be a preset name OR a resolved preset object (custom colour).
    let target = (cfg.preset && cfg.preset.light) ? cfg.preset
               : (FRACTAL_TUNNEL_PRESETS[cfg.preset] || FRACTAL_TUNNEL_PRESETS.frost);
    const pal = {
      light: [...target.light], shadow: [...target.shadow], glow: [...target.glow], grain: target.grain,
    };
    const stats = { fps: 0, scale };

    const ease = (e, dt) => 1 - Math.pow(1 - e, dt * 60); // frame-rate independent easing
    const lerp3 = (a, b, k) => { a[0] += (b[0] - a[0]) * k; a[1] += (b[1] - a[1]) * k; a[2] += (b[2] - a[2]) * k; };

    function draw(time, dt) {
      const kp = reduced ? 1 : ease(cfg.paletteEase, dt);
      lerp3(pal.light, target.light, kp);
      lerp3(pal.shadow, target.shadow, kp);
      lerp3(pal.glow, target.glow, kp);
      pal.grain += (target.grain - pal.grain) * kp;

      const km = ease(cfg.mouseEase, dt);
      mouse[0] += (mouseTarget[0] - mouse[0]) * km;
      mouse[1] += (mouseTarget[1] - mouse[1]) * km;

      gl.uniform1f(U.uTime, time);
      gl.uniform2f(U.uMouse, reduced ? 0 : mouse[0], reduced ? 0 : mouse[1]);
      gl.uniform3fv(U.uLight, pal.light);
      gl.uniform3fv(U.uShadow, pal.shadow);
      gl.uniform3fv(U.uGlow, pal.glow);
      gl.uniform1f(U.uGrain, reduced ? 0 : pal.grain);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // ---------- adaptive resolution ----------
    const WINDOW = 30; // drawn frames per measurement
    let winSum = 0, winCount = 0, goodWindows = 0, skipWindows = 1;

    function resetAdapt() { winSum = 0; winCount = 0; goodWindows = 0; skipWindows = 1; }

    function adapt(intervalMs) {
      winSum += intervalMs;
      if (++winCount < WINDOW) return;
      const avg = winSum / winCount;
      winSum = 0; winCount = 0;
      stats.fps = Math.round(1000 / avg);
      if (skipWindows > 0) { skipWindows--; return; } // ignore warm-up / shader compile

      const budget = 1000 / cfg.targetFps;
      if (avg > budget * 1.25 && scale > cfg.scaleMin) {
        ceiling = Math.max(cfg.scaleMin, scale * 0.95); // remember: this level was too slow
        scale = Math.max(cfg.scaleMin, scale * 0.85);
        goodWindows = 0;
        resize();
      } else if (avg < budget * 1.08) {
        if (++goodWindows >= 4 && scale < ceiling) {
          scale = Math.min(ceiling, scale * 1.08);
          goodWindows = 0;
          resize();
        }
      } else {
        goodWindows = 0;
      }
      stats.scale = scale;
    }

    // ---------- loop ----------
    let raf = 0, running = false, time = 0, lastDraw = 0;

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const interval = 1000 / cfg.targetFps;
      if (lastDraw && now - lastDraw < interval - 2) return; // frame cap
      const elapsed = lastDraw ? now - lastDraw : interval;
      lastDraw = now;
      const dt = Math.min(elapsed / 1000, 0.1); // a stall never jumps the camera
      time += dt;
      draw(time, dt);
      adapt(elapsed);
    }

    function start() {
      if (reduced) { resize(); draw(cfg.stillTime, 1); return; }
      if (running || document.hidden) return;
      running = true;
      lastDraw = 0;
      resetAdapt();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    // Accepts a preset name OR a preset object (used for custom colours).
    function setPreset(nameOrPreset) {
      const p = typeof nameOrPreset === 'string' ? FRACTAL_TUNNEL_PRESETS[nameOrPreset] : nameOrPreset;
      if (!p || !p.light) return;
      target = p;
      if (reduced) draw(cfg.stillTime, 1);
    }

    // Live frame-rate cap change (follows LiV's fps setting).
    function setFps(v) { if (v > 0) cfg.targetFps = v; }

    // ---------- listeners ----------
    const onPointer = (e) => {
      mouseTarget[0] = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTarget[1] = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onResize = () => { resize(); if (reduced) draw(cfg.stillTime, 1); };
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    const onLost = (e) => { e.preventDefault(); stop(); };
    const onRestored = () => { initGL(); start(); };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    function destroy() {
      stop();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    }

    initGL();
    return { start, stop, destroy, setPreset, setFps, stats };
  }

  // Build a tunnel preset object from a single custom hex colour.
  function tunnelPresetFromHex(hex) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (!Number.isFinite(n)) return FRACTAL_TUNNEL_PRESETS.frost;
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mixW = (v, t) => v + (1 - v) * t;
    return {
      light:  [mixW(r, 0.82), mixW(g, 0.82), mixW(b, 0.82)],  // bright tint
      shadow: [r * 0.20, g * 0.20, b * 0.20],                 // dark version
      glow:   [r, g, b],                                      // the chosen colour
      grain:  0.035,
    };
  }
  // Resolve a stored value (preset name OR '#hex') to a preset OBJECT.
  function tunnelPresetObj(v) {
    if (FRACTAL_TUNNEL_PRESETS[v]) return FRACTAL_TUNNEL_PRESETS[v];
    if (typeof v === 'string' && v[0] === '#') return tunnelPresetFromHex(v);
    return FRACTAL_TUNNEL_PRESETS.frost;
  }

  // ── LiV wrapper ──────────────────────────────────────────────────
  class FractalTunnelTheme {
    constructor() { this.contextType = '2d'; }  // engine hands us a throwaway 2d canvas

    init(engineCanvas, ctx, opts) {
      this.engineCanvas = engineCanvas;
      this.ctx = ctx;
      this.preset = (opts && opts.scenePalette) || 'frost';  // preset name OR '#hex'
      this._fps = (opts && opts.fps) || DEFAULTS.targetFps;

      // The real background lives in #canvas-container. Any OTHER real container
      // (the settings home preview, preset cards) also runs the real tunnel so
      // the preview is accurate. Only the offscreen snapshot canvas (parent =
      // <body>) — used to bake the tiny grid thumbnails — gets the static frame,
      // because that path captures the 2D canvas and can't read a WebGL2 one.
      const parent = engineCanvas.parentElement;
      this._live = !!(parent && parent.id === 'canvas-container');
      const snapshot = parent === document.body;

      if (snapshot || !parent) {
        const cw = engineCanvas.clientWidth || engineCanvas.width;
        const ch = engineCanvas.clientHeight || engineCanvas.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        engineCanvas.width  = Math.max(1, Math.round(cw * dpr));
        engineCanvas.height = Math.max(1, Math.round(ch * dpr));
        // Render one REAL tunnel frame offscreen and blit it into the snapshot 2D
        // canvas, so the grid thumbnail is accurate. preserveDrawingBuffer keeps
        // the frame readable for drawImage. Falls back to the gradient if WebGL2
        // is unavailable.
        try {
          const off = document.createElement('canvas');
          off.style.cssText = `position:fixed;left:-99999px;top:0;width:${Math.max(1, cw)}px;height:${Math.max(1, ch)}px;`;
          document.body.appendChild(off);
          this._snapOff = off;
          this._snapScene = createFractalTunnel(off, { preset: tunnelPresetObj(this.preset), targetFps: 30 });
        } catch (e) {
          if (this._snapOff) { this._snapOff.remove(); this._snapOff = null; }
          this._snapScene = null;
          this._paintStatic();
        }
        return;
      }

      // Own WebGL2 canvas filling the parent (absolute:inset:0 works both for the
      // fixed #canvas-container and a positioned preview tile). The scene sets its
      // own internal resolution — do NOT set width/height here.
      const c = document.createElement('canvas');
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      engineCanvas.style.display = 'none';
      parent.appendChild(c);
      this._canvas = c;
      try {
        this.scene = createFractalTunnel(c, { preset: tunnelPresetObj(this.preset), targetFps: this._fps });
      } catch (e) {
        // WebGL2 unavailable — fall back to a static frame on the engine canvas.
        c.remove();
        this._canvas = null;
        engineCanvas.style.display = '';
        this._paintStatic();
        return;
      }
      this.scene.start();
    }

    _paintStatic() {
      const ctx = this.ctx, w = this.engineCanvas.width, h = this.engineCanvas.height;
      if (!ctx) return;
      const p = tunnelPresetObj(this.preset);
      const rgb = a => `rgb(${Math.round(a[0]*255)},${Math.round(a[1]*255)},${Math.round(a[2]*255)})`;
      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      g.addColorStop(0.0, rgb(p.light));
      g.addColorStop(0.32, rgb(p.glow));
      g.addColorStop(1.0, rgb(p.shadow));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const core = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.13);
      core.addColorStop(0, rgb(p.light));
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    // The live/preview tunnel self-runs. For the snapshot, blit the real offscreen
    // frame each draw() so scenePreview captures an accurate thumbnail.
    draw() {
      if (this._snapScene && this._snapOff && this.ctx) {
        try { this.ctx.drawImage(this._snapOff, 0, 0, this.engineCanvas.width, this.engineCanvas.height); }
        catch (e) { /* buffer not ready yet */ }
      }
    }
    resize() { if (!this.scene && !this._snapScene) this._paintStatic(); }

    setPreset(name) {
      this.preset = name;
      if (this.scene) this.scene.setPreset(tunnelPresetObj(name));
      else this._paintStatic();
    }

    // Follow LiV's fps setting live.
    setFps(v) { this._fps = v; if (this.scene) this.scene.setFps(v); }

    get stats() { return this.scene ? this.scene.stats : null; }

    start() {}
    stop()  {}

    destroy() {
      if (this.scene) { try { this.scene.destroy(); } catch (e) { /* ignore */ } this.scene = null; }
      if (this._snapScene) { try { this._snapScene.destroy(); } catch (e) { /* ignore */ } this._snapScene = null; }
      if (this._snapOff) { this._snapOff.remove(); this._snapOff = null; }
      if (this._canvas) { this._canvas.remove(); this._canvas = null; }
      if (this.engineCanvas) this.engineCanvas.style.display = '';
    }
  }

  window.FRACTAL_TUNNEL_PRESETS = FRACTAL_TUNNEL_PRESETS;
  window.createFractalTunnel = createFractalTunnel;
  window.FractalTunnelTheme = FractalTunnelTheme;
})();
