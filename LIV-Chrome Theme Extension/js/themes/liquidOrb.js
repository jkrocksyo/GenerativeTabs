(function () {
  // Liquid Orb — a glassy, slowly-deforming raymarched blob with swirling
  // liquid inside and a glow that stays OUTSIDE the silhouette. The cursor
  // softly pushes the whole orb around (a spring-damped position offset, not a
  // surface warp, so the SDF stays valid for marching). The colour look is one
  // of seven named presets, switchable live from the background picker.
  //
  // Ported to WebGL1 / GLSL ES 1.00 to match LiV's ThemeEngine (which only
  // hands themes a `webgl` context). Based on "Liquid Gooey Orb Shader" by
  // Tamino Martinius (CodePen, MIT). Attribution retained per the license.

  // ── Colour presets ───────────────────────────────────────────────────────────
  // Each is the original CodePen tuning. LiV bumps the radius up and the glow up
  // uniformly (see deriveLook) so every preset reads bigger and punchier.
  const PRESETS = [
    { name: 'Aurora',   values: { radius: 0.30, deform: 0.36, frequency: 2.0, morphSpeed: 1.30, rotSpeed: 0.12, specular: 1.0, shininess: 140, glowStrength: 0.70, colorBlue: '#4099FF', colorMagenta: '#E633BF', glowA: '#33B5FF', glowB: '#E24DD0', liquidSpeed: 0.50, liquidScale: 2.20, liquidBright: 1.00, filament: 1.40, core: 0.30, background: '#070A18' } },
    { name: 'Ember',    values: { radius: 0.32, deform: 0.30, frequency: 2.1, morphSpeed: 1.40, rotSpeed: 0.10, specular: 1.2, shininess: 120, glowStrength: 0.85, colorBlue: '#FFC24D', colorMagenta: '#FF3B2F', glowA: '#FF7A18', glowB: '#FF2D55', liquidSpeed: 0.75, liquidScale: 2.40, liquidBright: 1.10, filament: 1.90, core: 0.40, background: '#160806' } },
    { name: 'Toxic',    values: { radius: 0.28, deform: 0.44, frequency: 2.3, morphSpeed: 1.50, rotSpeed: 0.18, specular: 1.0, shininess: 160, glowStrength: 0.75, colorBlue: '#9CFF4D', colorMagenta: '#00E5A0', glowA: '#57FF3C', glowB: '#00FFC8', liquidSpeed: 0.85, liquidScale: 2.60, liquidBright: 1.00, filament: 1.70, core: 0.25, background: '#04120C' } },
    { name: 'Ice',      values: { radius: 0.34, deform: 0.20, frequency: 1.8, morphSpeed: 1.18, rotSpeed: 0.08, specular: 1.5, shininess: 210, glowStrength: 0.60, colorBlue: '#9CE3FF', colorMagenta: '#E6F7FF', glowA: '#6FD2FF', glowB: '#BFEFFF', liquidSpeed: 0.32, liquidScale: 2.00, liquidBright: 0.90, filament: 1.00, core: 0.35, background: '#0A1424' } },
    { name: 'Plasma',   values: { radius: 0.28, deform: 0.40, frequency: 2.4, morphSpeed: 1.60, rotSpeed: 0.20, specular: 1.0, shininess: 130, glowStrength: 0.95, colorBlue: '#B14DFF', colorMagenta: '#FF2DA0', glowA: '#9B5CFF', glowB: '#FF3DBE', liquidSpeed: 1.00, liquidScale: 2.80, liquidBright: 1.20, filament: 2.10, core: 0.30, background: '#10061C' } },
    { name: 'Ghost',    values: { radius: 0.32, deform: 0.30, frequency: 2.0, morphSpeed: 1.25, rotSpeed: 0.10, specular: 1.6, shininess: 220, glowStrength: 0.55, colorBlue: '#C2CBE6', colorMagenta: '#8893B5', glowA: '#AEB8D8', glowB: '#6E7799', liquidSpeed: 0.45, liquidScale: 2.20, liquidBright: 0.85, filament: 1.20, core: 0.20, background: '#070709' } },
    { name: 'Daylight', values: { radius: 0.30, deform: 0.34, frequency: 2.0, morphSpeed: 1.30, rotSpeed: 0.12, specular: 1.0, shininess: 150, glowStrength: 0.80, colorBlue: '#2D6CFF', colorMagenta: '#B43CF0', glowA: '#3A82FF', glowB: '#A84DFF', liquidSpeed: 0.50, liquidScale: 2.20, liquidBright: 1.05, filament: 1.50, core: 0.30, background: '#EEF2F8' } },
  ];
  const RADIUS_BOOST = 0.10;   // ~0.30 → ~0.40
  const GLOW_BOOST   = 0.45;   // ~0.70 → ~1.15

  function deriveLook(name) {
    const p = PRESETS.find(pr => pr.name === name) || PRESETS[0];
    return Object.assign({}, p.values, {
      radius: p.values.radius + RADIUS_BOOST,
      glowStrength: p.values.glowStrength + GLOW_BOOST,
    });
  }

  // ── Cursor repulsion (spring-damped position offset, capped so it stays on) ──
  const MAX_OFFSET = 0.75;   // cap so the orb can't leave the canvas
  const SPRING     = 8.0;    // damped-lerp stiffness (per second)

  const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main(){ v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const FRAG = `precision highp float;
varying vec2 v_uv;

uniform float u_time;
uniform vec2  u_res;
uniform vec3  u_offset;
uniform float u_radius;
uniform float u_deform;
uniform float u_freq;
uniform float u_morphSpeed;
uniform float u_rotSpeed;
uniform float u_specular;
uniform float u_shininess;
uniform float u_glowStrength;
uniform vec3  u_colBlue;
uniform vec3  u_colMag;
uniform vec3  u_glowA;
uniform vec3  u_glowB;
uniform float u_liquidSpeed;
uniform float u_liquidScale;
uniform float u_liquidBright;
uniform float u_filament;
uniform float u_core;
uniform vec3  u_bg;
uniform float u_blend;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

float blobField(vec3 p){
  float t = u_time * u_morphSpeed;
  float f = u_freq;
  float d = 0.0;
  d += sin(p.x * 2.6 * f + t * 1.00);
  d += sin(p.y * 2.9 * f - t * 0.80 + 1.3);
  d += sin(p.z * 3.2 * f + t * 1.20 + 2.7);
  d += sin((p.x + p.z) * 2.2 * f - t * 0.90 + 4.1);
  d += sin((p.y - p.x) * 2.4 * f + t * 0.70 + 0.6);
  return d * 0.2;
}

float mapBlob(vec3 p){
  float t = u_time * u_rotSpeed;
  p.xy *= rot(t * 0.7);
  p.yz *= rot(t * 0.5);
  float r = u_radius + u_deform * blobField(p);
  return length(p) - r;
}

vec3 calcNormal(vec3 p){
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    mapBlob(p + e.xyy) - mapBlob(p - e.xyy),
    mapBlob(p + e.yxy) - mapBlob(p - e.yxy),
    mapBlob(p + e.yyx) - mapBlob(p - e.yyx)));
}

float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i + vec3(0.0,0.0,0.0)), hash13(i + vec3(1.0,0.0,0.0)), f.x),
                 mix(hash13(i + vec3(0.0,1.0,0.0)), hash13(i + vec3(1.0,1.0,0.0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0.0,0.0,1.0)), hash13(i + vec3(1.0,0.0,1.0)), f.x),
                 mix(hash13(i + vec3(0.0,1.0,1.0)), hash13(i + vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
}
float fbm3(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ v += a * vnoise3(p); p *= 2.03; a *= 0.5; } return v; }

float liquid(vec3 p){
  float t = u_time * u_liquidSpeed;
  p *= u_liquidScale;
  p.xy *= rot(t * 0.15);
  p.yz *= rot(t * 0.10);
  vec3 w = vec3(fbm3(p + t * 0.2), fbm3(p + vec3(4.3, 1.2, -t * 0.15)), fbm3(p.zxy + vec3(7.7, 2.3, t * 0.10)));
  return fbm3(p + 1.8 * w);
}

void main(){
  vec2 p = v_uv * 2.0 - 1.0;
  p.x *= u_res.x / u_res.y;

  // Cursor repulsion translates the whole orb by shifting the camera origin,
  // which keeps the SDF itself untouched (and valid for raymarching).
  vec3 ro = vec3(-u_offset.x, -u_offset.y, 3.0);
  vec3 rd = normalize(vec3(p, -1.8));

  float t = 0.0;
  bool hit = false;
  vec3 pos = ro;
  float minD = 1e3;
  for (int i = 0; i < 160; i++) {
    pos = ro + rd * t;
    float d = mapBlob(pos);
    minD = min(minD, d);
    if (d < 0.001) { hit = true; break; }
    t += d * 0.40;
    if (t > 6.0) break;
  }

  vec3 E = vec3(0.0);

  if (hit) {
    vec3 n = calcNormal(pos);
    vec3 v = -rd;
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);

    vec3 rp = pos + rd * 0.04;
    float trans = 1.0;
    vec3 inner = vec3(0.0);
    for (int k = 0; k < 10; k++) {
      float raw = liquid(rp);
      float dens = smoothstep(0.30, 0.70, raw);
      float fil = pow(1.0 - abs(2.0 * raw - 1.0), 5.0);
      vec3 c = mix(u_colMag, u_colBlue, 0.5 + 0.5 * sin(raw * 6.0 + u_time * 0.3 + rp.y * 2.5));
      vec3 emit = c * dens * 0.55 + c * fil * u_filament + vec3(1.0) * pow(fil, 3.0) * u_filament * 0.4;
      emit += u_colBlue * smoothstep(0.5, 0.0, length(rp)) * u_core;
      inner += trans * emit * 0.17;
      trans *= 0.84;
      rp += rd * 0.11;
      if (length(rp) > 1.0) break;
    }
    E += inner * (1.0 - fres * 0.6) * u_liquidBright;

    vec3 rim = mix(u_colMag, u_colBlue, 0.5 + 0.5 * (n.x * 0.7 + n.y * 0.45));
    E += rim * fres * 1.3;
    vec3 l1 = normalize(vec3(0.6, 0.85, 0.6));
    vec3 l2 = normalize(vec3(-0.7, 0.25, 0.55));
    vec3 h1 = normalize(l1 + v);
    vec3 h2 = normalize(l2 + v);
    E += vec3(1.0) * pow(max(dot(n, h1), 0.0), u_shininess) * 1.3 * u_specular;
    E += vec3(0.8, 0.9, 1.0) * pow(max(dot(n, h2), 0.0), u_shininess * 0.45) * 0.6 * u_specular;
  } else {
    float g = exp(-minD * 5.5);
    float ang = atan(rd.y, rd.x);
    vec3 gc = mix(u_glowA, u_glowB, 0.5 + 0.5 * sin(ang * 3.0 + u_time * 0.5));
    E += (gc * g * 1.4 + vec3(0.6, 0.8, 1.0) * pow(g, 3.0) * 0.7) * u_glowStrength;
  }

  vec3 glowCol = u_bg + E;
  float cov = clamp(max(E.r, max(E.g, E.b)), 0.0, 1.0);
  vec3 inkCol = mix(u_bg, E / (1.0 + E), cov);
  vec3 col = mix(glowCol, inkCol, u_blend);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }

  function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function luminance(rgb) { return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]; }

  class LiquidOrbTheme {
    constructor() {
      this.contextType = 'webgl';
      this.speed = 1.0;
      // Spring-damped position offset in the shader's aspect-corrected p-space.
      this._off = { x: 0, y: 0 };
      // Cursor position (same space); active=false parks it (no push).
      this._cur = { x: 0, y: 0, active: false };
      this._onMove = null;
      this._onLeave = null;
      // No persistent hover on touch devices — skip repulsion rather than fake it.
      this._touch = window.matchMedia('(hover: none)').matches;
    }

    init(canvas, _ctx, options) {
      this.canvas = canvas;
      const opts = options || {};
      this.speed = opts.speed || 1.0;
      this._intensity = opts.intensity || 1.0;
      this.dpr = Math.min(opts.quality || 2, 3);
      this._preset = opts.scenePalette || 'Aurora';
      this._lastTs = null;
      this._scaledTime = 0;

      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      this.gl = gl;
      if (!gl) return;

      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      this.prog = prog;

      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const al = gl.getAttribLocation(prog, 'a_pos');
      gl.enableVertexAttribArray(al);
      gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);

      this.U = {};
      const names = ['u_time', 'u_res', 'u_offset', 'u_radius', 'u_deform', 'u_freq',
        'u_morphSpeed', 'u_rotSpeed', 'u_specular', 'u_shininess', 'u_glowStrength',
        'u_colBlue', 'u_colMag', 'u_glowA', 'u_glowB', 'u_liquidSpeed', 'u_liquidScale',
        'u_liquidBright', 'u_filament', 'u_core', 'u_bg', 'u_blend'];
      for (const nm of names) this.U[nm] = gl.getUniformLocation(prog, nm);

      this._applyLook(deriveLook(this._preset));
      this.resize(canvas.clientWidth, canvas.clientHeight);
      if (!this._touch) this._attach();
    }

    // Push a colour look into the shader's static uniforms (also drives the
    // repulsion radius, which scales with the orb's size).
    _applyLook(look) {
      const gl = this.gl;
      if (!gl) return;
      gl.useProgram(this.prog);
      gl.uniform1f(this.U.u_radius, look.radius);
      gl.uniform1f(this.U.u_deform, look.deform);
      gl.uniform1f(this.U.u_freq, look.frequency);
      gl.uniform1f(this.U.u_morphSpeed, look.morphSpeed);
      gl.uniform1f(this.U.u_rotSpeed, look.rotSpeed);
      gl.uniform1f(this.U.u_specular, look.specular);
      gl.uniform1f(this.U.u_shininess, look.shininess);
      gl.uniform1f(this.U.u_glowStrength, look.glowStrength * this._intensity);
      gl.uniform3fv(this.U.u_colBlue, hexToRgb(look.colorBlue));
      gl.uniform3fv(this.U.u_colMag, hexToRgb(look.colorMagenta));
      gl.uniform3fv(this.U.u_glowA, hexToRgb(look.glowA));
      gl.uniform3fv(this.U.u_glowB, hexToRgb(look.glowB));
      gl.uniform1f(this.U.u_liquidSpeed, look.liquidSpeed);
      gl.uniform1f(this.U.u_liquidScale, look.liquidScale);
      gl.uniform1f(this.U.u_liquidBright, look.liquidBright);
      gl.uniform1f(this.U.u_filament, look.filament);
      gl.uniform1f(this.U.u_core, look.core);
      const bg = hexToRgb(look.background);
      gl.uniform3fv(this.U.u_bg, bg);
      // Dark background → glow blend; light background → ink blend.
      gl.uniform1f(this.U.u_blend, Math.min(Math.max((luminance(bg) - 0.35) / 0.30, 0), 1));
      // Repulsion scales with the orb's radius.
      this._influence = look.radius * 1.5;
      this._pushScale = look.radius * 1.4;
    }

    // Switch palette live (from the picker), no context recreation, no flash.
    setPreset(name) {
      this._preset = name;
      this._applyLook(deriveLook(name));
    }

    _attach() {
      const canvas = this.canvas;
      this._onMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        let px = (e.clientX - rect.left) / rect.width * 2.0 - 1.0;
        let py = -((e.clientY - rect.top) / rect.height * 2.0 - 1.0);
        px *= rect.width / rect.height;   // match the shader's aspect correction
        this._cur.x = px;
        this._cur.y = py;
        this._cur.active = true;
      };
      this._onLeave = () => { this._cur.active = false; };
      canvas.addEventListener('pointermove', this._onMove, { passive: true });
      canvas.addEventListener('pointerleave', this._onLeave, { passive: true });
    }

    resize(w, h) {
      if (!this.gl) return;
      this.canvas.width = Math.max(1, Math.floor(w * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(h * this.dpr));
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    draw(ts) {
      const gl = this.gl;
      if (!gl) return;
      const rawDt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      this._scaledTime += rawDt * (this.speed || 1);

      // Target offset: push the orb away from the cursor when it's close enough.
      let tx = 0, ty = 0;
      if (this._cur.active) {
        const dx = this._off.x - this._cur.x;
        const dy = this._off.y - this._cur.y;
        const d = Math.hypot(dx, dy);
        if (d < this._influence && d > 1e-4) {
          const strength = (1 - d / this._influence) * this._pushScale;   // stronger the closer it gets
          tx = (dx / d) * strength;
          ty = (dy / d) * strength;
          const tl = Math.hypot(tx, ty);
          if (tl > MAX_OFFSET) { tx = tx / tl * MAX_OFFSET; ty = ty / tl * MAX_OFFSET; }
        }
      }
      // Damped lerp toward target (drifts back to 0 when the cursor leaves).
      const k = 1 - Math.exp(-(rawDt || 0.016) * SPRING);
      this._off.x += (tx - this._off.x) * k;
      this._off.y += (ty - this._off.y) * k;

      gl.useProgram(this.prog);
      gl.uniform1f(this.U.u_time, this._scaledTime);
      gl.uniform2f(this.U.u_res, this.canvas.width, this.canvas.height);
      gl.uniform3f(this.U.u_offset, this._off.x, this._off.y, 0.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    start() {}
    stop() {}

    destroy() {
      if (this._onMove) this.canvas.removeEventListener('pointermove', this._onMove);
      if (this._onLeave) this.canvas.removeEventListener('pointerleave', this._onLeave);
      this._onMove = this._onLeave = null;
      const gl = this.gl;
      if (!gl) return;
      gl.deleteBuffer(this.buf);
      gl.deleteProgram(this.prog);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.gl = null;
    }
  }

  // (The picker's swatches come from the shared INTERACTIVE_PALETTES table, which
  // uses these same preset names — see interactivePalettes.js.)
  window.LiquidOrbTheme = LiquidOrbTheme;
})();
