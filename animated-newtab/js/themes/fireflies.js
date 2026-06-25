(function () {
  // ── Background: sky + FBM treeline + fog + ambient glow ──────────────────
  const BG_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}';
  const BG_FRAG = `precision highp float;
uniform vec2 u_res;

float h2(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),u.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),u.x),u.y);}
float fbm4(vec2 p){return .5*n2(p)+.25*n2(p*2.02)+.125*n2(p*4.08)+.0625*n2(p*8.14);}

void main(){
  vec2 uv=gl_FragCoord.xy/u_res; // y=0 bottom, y=1 top
  // Sky gradient: dark navy top → dark green-black bottom
  vec3 col=mix(vec3(0.051,0.102,0.059),vec3(0.039,0.039,0.102),uv.y);

  // ── Treeline — 3 FBM depth layers ─────────────────────────────────────────
  // Background layer: tallest, faint greenish-dark
  float tl1=0.32+fbm4(vec2(uv.x*4.0,0.5))*0.10;
  col=mix(col,vec3(0.035,0.065,0.035),smoothstep(tl1+.012,tl1-.008,uv.y));
  // Mid layer
  float tl2=0.25+fbm4(vec2(uv.x*6.5+12.,0.5))*0.08;
  col=mix(col,vec3(0.018,0.032,0.018),smoothstep(tl2+.009,tl2-.006,uv.y));
  // Foreground: shortest, near-black
  float tl3=0.17+fbm4(vec2(uv.x*9.0+25.,0.5))*0.06;
  col=mix(col,vec3(0.006,0.009,0.006),smoothstep(tl3+.006,tl3-.004,uv.y));

  // ── Ambient glow: collective firefly warmth ────────────────────────────────
  float gd=length(vec2((uv.x-.5)*2.2,(uv.y-.28)*3.0));
  col+=vec3(0.30,0.45,0.12)*exp(-gd*gd*3.5)*0.055;

  // ── Ground fog: cool blue-white at base ───────────────────────────────────
  float fog=smoothstep(0.14,0.0,uv.y)*0.11;
  col=mix(col,vec3(0.65,0.70,0.78),fog);

  gl_FragColor=vec4(col,1.);
}`;

  // ── Firefly pass: soft radial glow quads, additive blend ─────────────────
  // Per-vertex: pos(2) uv(2) col(3) alpha(1)  →  STRIDE=8
  const FF_VERT = `
attribute vec2 a_pos;attribute vec2 a_uv;attribute vec3 a_col;attribute float a_alpha;
varying vec2 v_uv;varying vec3 v_col;varying float v_alpha;
void main(){gl_Position=vec4(a_pos,0,1);v_uv=a_uv;v_col=a_col;v_alpha=a_alpha;}`;
  const FF_FRAG = `precision mediump float;
varying vec2 v_uv;varying vec3 v_col;varying float v_alpha;
void main(){
  float d=length(v_uv);
  if(d>1.0)discard;
  float glow=exp(-d*3.5)*v_alpha;
  vec3 col=v_col*(1.0+1.5*exp(-d*6.0));
  gl_FragColor=vec4(col,glow);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }
  function mkProg(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p); return p;
  }

  const FF_COLORS = [
    [0.784,1.000,0.376], // #c8ff60
    [0.894,1.000,0.506], // #e4ff81
    [1.000,1.000,0.667], // #ffffaa
    [0.902,1.000,0.569], // #e6ff91
    [1.000,0.961,0.502], // #fff580
  ];
  const COUNT  = 75;
  const STRIDE = 8;

  class ForestFirefliesTheme {
    constructor() { this.contextType = 'webgl'; }

    init(canvas, _ctx) {
      this.canvas = canvas;
      this.dpr    = Math.min(window.devicePixelRatio || 1, 2);
      this._t0    = null;
      this._lastTs= null;
      this.W = 1; this.H = 1;

      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      this.gl = gl; if (!gl) return;

      this.bgProg = mkProg(gl, BG_VERT, BG_FRAG);
      this.ffProg = mkProg(gl, FF_VERT, FF_FRAG);

      // Background fullscreen triangle
      this.bgBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);

      // Cache locations
      this.bgLoc = {
        a:   gl.getAttribLocation(this.bgProg, 'a'),
        res: gl.getUniformLocation(this.bgProg, 'u_res'),
      };
      this.ffLoc = {
        pos:   gl.getAttribLocation(this.ffProg, 'a_pos'),
        uv:    gl.getAttribLocation(this.ffProg, 'a_uv'),
        col:   gl.getAttribLocation(this.ffProg, 'a_col'),
        alpha: gl.getAttribLocation(this.ffProg, 'a_alpha'),
      };

      // Dynamic firefly VBO
      this.ffBuf  = gl.createBuffer();
      this.ffData = new Float32Array(COUNT * 6 * STRIDE);

      this.flies = [];
      this.resize(canvas.clientWidth, canvas.clientHeight);
    }

    _spawnFly(f, stagger) {
      const dpr = this.dpr;
      f.x = Math.random() * this.W;
      // Distribute across mid and lower portion (where treeline is)
      f.y = stagger
        ? (0.05 + Math.random() * 0.80) * this.H
        : (0.05 + Math.random() * 0.80) * this.H;

      const spd = (1 + Math.random() * 5) * dpr;
      const ang = Math.random() * Math.PI * 2;
      f.vx = Math.cos(ang) * spd;
      f.vy = Math.sin(ang) * spd - 1.5 * dpr; // slight upward bias

      f.wobbleAmp   = (5 + Math.random() * 12) * dpr;
      f.wobbleFreq  = 0.5 + Math.random() * 1.0;
      f.wobblePhase = Math.random() * Math.PI * 2;

      const c = FF_COLORS[Math.floor(Math.random() * FF_COLORS.length)];
      const j = (Math.random() - 0.5) * 0.04;
      f.r = Math.min(1, c[0] + j);
      f.g = Math.min(1, c[1] + j);
      f.b = Math.min(1, c[2] + j);

      f.size = (4 + Math.random() * 6) * dpr; // radius 4–10px

      // Blink cycle (all timings in seconds)
      f.fadeIn  = 0.4 + Math.random() * 0.4;
      f.hold    = 0.1 + Math.random() * 0.3;
      f.fadeOut = 0.4 + Math.random() * 0.4;
      f.dark    = 1.0 + Math.random() * 3.0;
      f.period  = f.fadeIn + f.hold + f.fadeOut + f.dark;
      // Stagger blink phase so fireflies don't sync
      f.blinkT  = Math.random() * f.period;

      f.alpha   = 0;
      f.dispX   = f.x;
    }

    _initFlies() {
      this.flies = [];
      for (let i = 0; i < COUNT; i++) {
        const f = {};
        this._spawnFly(f, true);
        this.flies.push(f);
      }
    }

    resize(w, h) {
      this.W = Math.max(1, Math.floor(w * this.dpr));
      this.H = Math.max(1, Math.floor(h * this.dpr));
      this.canvas.width  = this.W;
      this.canvas.height = this.H;
      if (this.gl) this.gl.viewport(0, 0, this.W, this.H);
      this._initFlies();
    }

    draw(ts) {
      const gl = this.gl; if (!gl) return;
      if (!this._t0) this._t0 = ts;
      const t  = (ts - this._t0) / 1000;
      const dt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0.016;
      this._lastTs = ts;

      // Update fireflies
      for (const f of this.flies) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.dispX = f.x + Math.sin(t * f.wobbleFreq + f.wobblePhase) * f.wobbleAmp;

        // Wrap horizontally, respawn vertically if needed
        if (f.x < -30) f.x = this.W + 30;
        if (f.x > this.W + 30) f.x = -30;
        if (f.y < -30 || f.y > this.H + 30) this._spawnFly(f, true);

        // Blink
        f.blinkT = (f.blinkT + dt) % f.period;
        let bm = f.blinkT;
        if      (bm < f.fadeIn)                        f.alpha = bm / f.fadeIn;
        else if (bm < f.fadeIn + f.hold)               f.alpha = 1.0;
        else if (bm < f.fadeIn + f.hold + f.fadeOut)  f.alpha = 1.0 - (bm - f.fadeIn - f.hold) / f.fadeOut;
        else                                            f.alpha = 0.0;
      }

      // ── Background ───────────────────────────────────────────────────────
      gl.disable(gl.BLEND);
      gl.useProgram(this.bgProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf);
      const bA = this.bgLoc.a;
      gl.enableVertexAttribArray(bA);
      gl.vertexAttribPointer(bA, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(this.bgLoc.res, this.W, this.H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // ── Fireflies ─────────────────────────────────────────────────────────
      const buf = this.ffData;
      const W = this.W, H = this.H;
      let off = 0;

      for (const f of this.flies) {
        if (f.alpha < 0.005) {
          // Write 6 degenerate vertices (all zero) to keep buffer aligned
          for (let k = 0; k < 6 * STRIDE; k++) buf[off++] = 0;
          continue;
        }
        const r = f.size;
        const cx = f.dispX, cy = f.y;
        const LX = [-r,  r,  r, -r];
        const LY = [-r, -r,  r,  r];
        const UX = [-1,  1,  1, -1];
        const UY = [-1, -1,  1,  1];
        const VX = new Array(4), VY = new Array(4);
        for (let i = 0; i < 4; i++) {
          VX[i] = (cx + LX[i]) / W * 2 - 1;
          VY[i] = 1 - (cy + LY[i]) / H * 2;
        }
        for (const vi of [0,1,2,0,2,3]) {
          buf[off++]=VX[vi]; buf[off++]=VY[vi];
          buf[off++]=UX[vi]; buf[off++]=UY[vi];
          buf[off++]=f.r; buf[off++]=f.g; buf[off++]=f.b;
          buf[off++]=f.alpha;
        }
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive for glow
      gl.useProgram(this.ffProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ffBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buf, gl.DYNAMIC_DRAW);

      const bs = STRIDE * 4;
      const L  = this.ffLoc;
      gl.enableVertexAttribArray(L.pos);   gl.vertexAttribPointer(L.pos,   2, gl.FLOAT, false, bs,  0);
      gl.enableVertexAttribArray(L.uv);    gl.vertexAttribPointer(L.uv,    2, gl.FLOAT, false, bs,  8);
      gl.enableVertexAttribArray(L.col);   gl.vertexAttribPointer(L.col,   3, gl.FLOAT, false, bs, 16);
      gl.enableVertexAttribArray(L.alpha); gl.vertexAttribPointer(L.alpha, 1, gl.FLOAT, false, bs, 28);

      gl.drawArrays(gl.TRIANGLES, 0, COUNT * 6);
      gl.disable(gl.BLEND);
    }

    start() {}
    stop()  {}

    destroy() {
      const gl = this.gl; if (!gl) return;
      gl.deleteProgram(this.bgProg);
      gl.deleteProgram(this.ffProg);
      gl.deleteBuffer(this.bgBuf);
      gl.deleteBuffer(this.ffBuf);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.gl = null;
    }
  }

  window.ForestFirefliesTheme = ForestFirefliesTheme;
})();
