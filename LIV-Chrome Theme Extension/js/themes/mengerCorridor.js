// Menger corridor: endless flight through a Menger sponge fractal.
// Raw WebGL2, zero dependencies.
//
// Performance strategy:
//   1. Renders below native resolution and lets the browser upscale.
//   2. Adaptive resolution: drops the scale if frames run long, creeps back
//      up (never above the last known-bad level) when there is headroom.
//   3. Capped at 30 fps; the camera glides slowly so 60 buys nothing.
//   4. Stops completely when the tab is hidden; still frame under reduced motion.
//
// LiV integration note: the factory (createMengerCorridor) is kept as written
// except for dropping the ES-module `export`, adding a live fps setter, and two
// black-frame fixes carried over from Fractal Tunnel (repaint-on-resize +
// preserveDrawingBuffer) so adaptive-resolution changes don't flash black. The
// shader and the fps-cap / adaptive-scale / visibility / reduced-motion logic are
// unchanged. MengerCorridorTheme wraps it into LiV's ThemeEngine; because it needs
// its own WebGL2 canvas it injects that canvas (hiding the engine's) for the live
// background and any preview tile, and renders a real frame offscreen for the
// grid-thumbnail snapshot.
(function () {
  'use strict';

  const DEFAULTS = {
    targetFps: 30,
    scaleStart: 0.75,
    scaleMin: 0.45,
    scaleMax: 0.95,
    mouseEase: 0.05,
    stillTime: 12.0,
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
uniform vec3  uGlow;   // corridor light/glow colour (from the chosen preset)

out vec4 fragColor;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

float hash2(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*0.1031);
  p3 += dot(p3, p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
float vnoise2(vec2 p){
  vec2 i=floor(p), f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x),
             mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),f.x), f.y);
}
vec3 aces(vec3 x){ return clamp(x*(2.51*x+0.03)/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }

vec3 finish(vec3 col){
  col = pow(aces(col), vec3(1.0/2.2));
  vec2 q = gl_FragCoord.xy/uResolution;
  float vig = pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.15);
  col *= mix(0.78, 1.0, vig);
  col += (hash2(gl_FragCoord.xy + fract(uTime*7.13)*431.0) - 0.5)*0.03;
  return clamp(col, 0.0, 1.0);
}

// Menger sponge: 4 iterations of cross-subtraction on a repeating unit cell.
float map(vec3 p){
  float d = -1e9, s = 1.0;
  for(int m=0; m<4; m++){
    vec3 a = mod(p*s, 2.0) - 1.0;
    s *= 3.0;
    vec3 r = abs(1.0 - 3.0*abs(a));
    float da = max(r.x, r.y), db = max(r.y, r.z), dc = max(r.z, r.x);
    d = max(d, (min(da, min(db, dc)) - 1.0)/s);
  }
  return d;
}

vec3 nrm(vec3 p){
  const vec2 k = vec2(1.0,-1.0);
  float e = 0.0008;
  return normalize(k.xyy*map(p+k.xyy*e) + k.yyx*map(p+k.yyx*e)
                 + k.yxy*map(p+k.yxy*e) + k.xxx*map(p+k.xxx*e));
}

void main(){
  vec2 uv = (gl_FragCoord.xy*2.0 - uResolution)/uResolution.y;
  float T = uTime;

  vec3 ro = vec3(0.04*sin(T*0.31), 0.035*sin(T*0.23), T*0.2);
  vec3 rd = normalize(vec3(uv + uMouse*0.25, 1.6));
  rd.xy *= rot(T*0.025);

  float t = 0.0;
  bool hit = false;
  for(int i=0; i<96; i++){
    float d = map(ro + rd*t);
    if(d < 0.0004*(1.0 + t*3.0)){ hit = true; break; }
    t += d;
    if(t > 12.0) break;
  }

  vec3 glow = uGlow;
  vec3 fogC = mix(vec3(0.012,0.012,0.02), glow*1.6, pow(max(rd.z,0.0), 10.0));
  fogC += glow*0.05*pow(max(rd.z,0.0), 3.0);

  vec3 col = fogC;
  if(hit){
    vec3 p = ro + rd*t;
    vec3 n = nrm(p);

    float ao = 0.0, sc = 1.0;
    for(int i=1; i<=4; i++){
      float h = 0.01*float(i);
      ao += (h - map(p + n*h))*sc;
      sc *= 0.6;
    }
    ao = clamp(1.0 - 14.0*ao, 0.0, 1.0);

    // key light rides ahead of the camera down the corridor
    vec3 lp = vec3(0.0, 0.0, ro.z + 1.6);
    vec3 L = lp - p;
    float ld = length(L);
    L /= ld;
    float dif = max(dot(n, L), 0.0)/(1.0 + ld*ld*6.0);

    float grain = 0.85 + 0.3*vnoise2(p.xy*37.0 + p.z*19.0);
    vec3 stone = vec3(0.5, 0.43, 0.35)*grain;
    vec3 amb = vec3(0.05,0.07,0.11)*(0.6 + 0.4*n.y)*ao;

    col = stone*(glow*1.5*dif*(0.2 + 0.8*ao) + amb);
    col = mix(col, fogC, 1.0 - exp(-t*0.26));
  }

  fragColor = vec4(finish(col), 1.0);
}
`;

  /**
   * Creates the Menger corridor scene on a full-viewport canvas.
   * The canvas should be sized by CSS (position:fixed; inset:0; width:100%; height:100%).
   * Returns { start, stop, destroy, setFps, stats }.
   */
  function createMengerCorridor(canvas, options = {}) {
    const cfg = { ...DEFAULTS, ...options };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const gl = canvas.getContext("webgl2", {
      antialias: false, alpha: false, depth: false, stencil: false,
      // Keep the last frame between composites so the 30 fps cap can't show a
      // cleared (black) buffer on the compositor frames it doesn't redraw.
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
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      U = {};
      ["uTime","uResolution","uMouse","uGlow"].forEach((n) => (U[n] = gl.getUniformLocation(program, n)));
      resize(true);
    }

    let scale = cfg.scaleStart;
    let ceiling = cfg.scaleMax;
    let resMul = 1;      // quality slider multiplier on render resolution
    let speed = 1;       // animation-speed multiplier
    let paused = false;  // static-mode freeze

    function resize(force = false) {
      const cssW = canvas.clientWidth || window.innerWidth;
      const cssH = canvas.clientHeight || window.innerHeight;
      const w = Math.max(1, Math.round(cssW*scale*resMul));
      const h = Math.max(1, Math.round(cssH*scale*resMul));
      if (force || canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(U.uResolution, w, h);
        // Reallocating the buffer clears it; repaint in the same tick so the
        // compositor never shows the blank (black) buffer during adaptive resize.
        if (program) draw(time, 0);
      }
    }

    const mouse = [0, 0];
    const mouseTarget = [0, 0];
    const EMBER = [1.0, 0.55, 0.25];
    const glow = [...(cfg.glow || EMBER)];        // current, eased
    let glowTarget = [...(cfg.glow || EMBER)];    // destination
    const stats = { fps: 0, scale };

    function draw(time, dt) {
      const k = 1 - Math.pow(1 - cfg.mouseEase, dt*60); // frame-rate independent
      mouse[0] += (mouseTarget[0] - mouse[0])*k;
      mouse[1] += (mouseTarget[1] - mouse[1])*k;

      const gk = 1 - Math.pow(1 - 0.04, dt*60);         // smooth colour transitions
      glow[0] += (glowTarget[0] - glow[0])*gk;
      glow[1] += (glowTarget[1] - glow[1])*gk;
      glow[2] += (glowTarget[2] - glow[2])*gk;

      gl.uniform1f(U.uTime, time);
      gl.uniform2f(U.uMouse, reduced ? 0 : mouse[0], reduced ? 0 : mouse[1]);
      gl.uniform3f(U.uGlow, glow[0], glow[1], glow[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    const WINDOW = 30;
    let winSum = 0, winCount = 0, goodWindows = 0, skipWindows = 1;

    function resetAdapt() { winSum = 0; winCount = 0; goodWindows = 0; skipWindows = 1; }

    function adapt(intervalMs) {
      winSum += intervalMs;
      if (++winCount < WINDOW) return;
      const avg = winSum/winCount;
      winSum = 0; winCount = 0;
      stats.fps = Math.round(1000/avg);
      if (skipWindows > 0) { skipWindows--; return; } // ignore warm-up / shader compile

      const budget = 1000/cfg.targetFps;
      if (avg > budget*1.25 && scale > cfg.scaleMin) {
        ceiling = Math.max(cfg.scaleMin, scale*0.95); // remember: this level was too slow
        scale = Math.max(cfg.scaleMin, scale*0.85);
        goodWindows = 0;
        resize();
      } else if (avg < budget*1.08) {
        if (++goodWindows >= 4 && scale < ceiling) {
          scale = Math.min(ceiling, scale*1.08);
          goodWindows = 0;
          resize();
        }
      } else {
        goodWindows = 0;
      }
      stats.scale = scale;
    }

    let raf = 0, running = false, time = 0, lastDraw = 0;

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const interval = 1000/cfg.targetFps;
      if (lastDraw && now - lastDraw < interval - 2) return; // frame cap
      const elapsed = lastDraw ? now - lastDraw : interval;
      lastDraw = now;
      const dt = Math.min(elapsed/1000, 0.1); // a stall never jumps the camera
      time += dt * speed;
      draw(time, dt);
      adapt(elapsed);
    }

    function start() {
      if (reduced) { resize(); draw(cfg.stillTime, 1); return; }
      if (running || document.hidden || paused) return;
      running = true;
      lastDraw = 0;
      resetAdapt();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function setFps(v) { if (v > 0) cfg.targetFps = v; }  // follow LiV's fps setting
    function setSpeed(v) { if (v >= 0) speed = v; }
    function setQuality(q) { resMul = Math.max(0.4, Math.min(2, (q || 1.5) / 1.5)); resize(); }
    function setStatic(on) { paused = !!on; if (paused) stop(); else if (!reduced) start(); }
    function setGlow(rgb) { if (rgb && rgb.length === 3) { glowTarget = [rgb[0], rgb[1], rgb[2]]; if (reduced) draw(cfg.stillTime, 1); } }

    const onPointer = (e) => {
      mouseTarget[0] = (e.clientX/window.innerWidth)*2 - 1;
      mouseTarget[1] = -((e.clientY/window.innerHeight)*2 - 1);
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
    return { start, stop, destroy, setFps, setGlow, setSpeed, setQuality, setStatic, stats };
  }

  // ── Colour presets ────────────────────────────────────────────────
  // The scene's glow colour (drives corridor lighting + fog). Names below match
  // the swatches registered in newtab.js SCENE_PALETTES.mengerCorridor.
  const MENGER_PRESETS = {
    ember:  [1.00, 0.55, 0.25],  // warm orange (default)
    ice:    [0.42, 0.72, 1.00],  // cool blue
    toxic:  [0.55, 1.00, 0.45],  // green
    violet: [0.72, 0.45, 1.00],  // purple
    gold:   [1.00, 0.82, 0.35],  // gold
  };
  function mengerGlow(v) {
    if (Array.isArray(v)) return v;
    if (MENGER_PRESETS[v]) return MENGER_PRESETS[v];
    if (typeof v === 'string' && v[0] === '#') {          // custom hex
      let h = v.replace('#', '');
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      const n = parseInt(h, 16);
      if (Number.isFinite(n)) return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    return MENGER_PRESETS.ember;
  }

  // ── LiV wrapper ──────────────────────────────────────────────────
  class MengerCorridorTheme {
    constructor() { this.contextType = '2d'; }  // engine hands us a throwaway 2d canvas

    init(engineCanvas, ctx, opts) {
      this.engineCanvas = engineCanvas;
      this.ctx = ctx;
      this._fps = (opts && opts.fps) || DEFAULTS.targetFps;
      this.preset = (opts && opts.scenePalette) || 'ember';  // preset name OR '#hex'

      const parent = engineCanvas.parentElement;
      this._live = !!(parent && parent.id === 'canvas-container');
      const snapshot = !parent || parent === document.body;

      if (snapshot) {
        const cw = engineCanvas.clientWidth || engineCanvas.width;
        const ch = engineCanvas.clientHeight || engineCanvas.height;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        engineCanvas.width  = Math.max(1, Math.round(cw * dpr));
        engineCanvas.height = Math.max(1, Math.round(ch * dpr));
        // Render one real frame offscreen and blit it, so the grid thumbnail is
        // accurate; fall back to a gradient if WebGL2 is unavailable.
        try {
          const off = document.createElement('canvas');
          off.style.cssText = `position:fixed;left:-99999px;top:0;width:${Math.max(1, cw)}px;height:${Math.max(1, ch)}px;`;
          document.body.appendChild(off);
          this._snapOff = off;
          this._snapScene = createMengerCorridor(off, { targetFps: 30, glow: mengerGlow(this.preset) });
        } catch (e) {
          if (this._snapOff) { this._snapOff.remove(); this._snapOff = null; }
          this._snapScene = null;
          this._paintStatic();
        }
        return;
      }

      const c = document.createElement('canvas');
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      engineCanvas.style.display = 'none';
      parent.appendChild(c);
      this._canvas = c;
      try {
        this.scene = createMengerCorridor(c, { targetFps: this._fps, glow: mengerGlow(this.preset) });
      } catch (e) {
        c.remove();
        this._canvas = null;
        engineCanvas.style.display = '';
        this._paintStatic();
        return;
      }
      if (opts && opts.speed != null) this.scene.setSpeed(opts.speed);
      if (opts && opts.quality != null) this.scene.setQuality(opts.quality);
      this.scene.start();
      if (opts && opts.staticMode) this.scene.setStatic(true);
    }

    _paintStatic() {
      const ctx = this.ctx, w = this.engineCanvas.width, h = this.engineCanvas.height;
      if (!ctx) return;
      const d = Math.max(w, h);
      const gc = mengerGlow(this.preset);
      const r = Math.round(gc[0] * 255), g_ = Math.round(gc[1] * 255), b = Math.round(gc[2] * 255);
      ctx.fillStyle = '#080810';
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, d * 0.5);
      g.addColorStop(0.0, `rgba(${r},${g_},${b},0.95)`);
      g.addColorStop(0.35, `rgba(${Math.round(r*0.6)},${Math.round(g_*0.6)},${Math.round(b*0.6)},0.35)`);
      g.addColorStop(1.0, 'rgba(8,8,16,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, d * 0.2, w * 0.5, h * 0.5, d * 0.72);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    draw() {
      if (this._snapScene && this._snapOff && this.ctx) {
        try { this.ctx.drawImage(this._snapOff, 0, 0, this.engineCanvas.width, this.engineCanvas.height); }
        catch (e) { /* buffer not ready */ }
      }
    }
    resize() { if (!this.scene && !this._snapScene) this._paintStatic(); }

    setFps(v)     { this._fps = v; if (this.scene) this.scene.setFps(v); }
    setSpeed(v)   { if (this.scene) this.scene.setSpeed(v); }
    setQuality(q) { if (this.scene) this.scene.setQuality(q); }
    setStatic(on) { if (this.scene) this.scene.setStatic(on); }

    // Live colour swap from the palette swatches (preset name or '#hex').
    setPreset(name) {
      this.preset = name;
      if (this.scene) this.scene.setGlow(mengerGlow(name));
      else if (!this.scene && !this._snapScene) this._paintStatic();
    }

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

  window.createMengerCorridor = createMengerCorridor;
  window.MengerCorridorTheme = MengerCorridorTheme;
})();
