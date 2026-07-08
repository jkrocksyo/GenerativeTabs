(function () {
  // ── Background: winter night gradient + stars + ground glow ──────────────
  const BG_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}';
  const BG_FRAG = `precision mediump float;
uniform vec2 u_res;uniform float u_time;
float hash(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  vec3 gnd=vec3(0.102,0.118,0.141); // #1a1e24 snow-covered ground
  vec3 hor=vec3(0.078,0.118,0.180); // #141e2e horizon blue-grey
  vec3 sky=vec3(0.027,0.035,0.059); // #07090f zenith navy-black
  // Organic snow surface — slow undulation across x
  float wave=0.006*sin(uv.x*7.3+u_time*0.08)
            +0.003*sin(uv.x*14.1+u_time*0.13+1.7)
            +0.004*sin(uv.x*3.2+u_time*0.05+3.1);
  float horizon=0.05+wave;
  float blend=smoothstep(horizon,horizon+0.028,uv.y);
  float skyT=clamp((uv.y-horizon)/max(1.0-horizon,0.001),0.,1.);
  vec3 col=mix(gnd,mix(hor,sky,skyT*skyT),blend);
  // Ground glow — snow luminance fades up from surface
  col+=vec3(0.88,0.93,1.0)*(1.-smoothstep(0.,0.10,uv.y))*0.09;
  // Stars in upper sky (y > 35%)
  float sMask=step(0.35,uv.y);
  vec2 sg=floor(uv*80.+vec2(17.3,41.7));
  float sh=hash(sg);
  float sb=smoothstep(0.982,1.,sh)*sMask;
  vec2 sf=fract(uv*80.+vec2(17.3,41.7))-.5;
  float tw=0.60+0.40*sin(u_time*(0.2+hash(sg+vec2(.1,0.))*.3)+hash(sg+vec2(.2,0.))*6.283);
  col+=vec3(0.90,0.95,1.0)*sb*tw*exp(-length(sf)*45.)*0.30;
  gl_FragColor=vec4(col,1.);
}`;

  // ── Snowflake pass ────────────────────────────────────────────────────────
  // Per-vertex: pos(2) uv(2) col(3) alpha(1) soft(1)  →  STRIDE=9
  const SNOW_VERT = `
attribute vec2 a_pos;attribute vec2 a_uv;attribute vec3 a_col;
attribute float a_alpha;attribute float a_soft;
varying vec2 v_uv;varying vec3 v_col;varying float v_alpha;varying float v_soft;
void main(){gl_Position=vec4(a_pos,0,1);v_uv=a_uv;v_col=a_col;v_alpha=a_alpha;v_soft=a_soft;}`;

  const SNOW_FRAG = `precision mediump float;
varying vec2 v_uv;varying vec3 v_col;varying float v_alpha;varying float v_soft;
void main(){
  float d=length(v_uv);
  if(d>1.)discard;
  float a=v_alpha*exp(-d*d*v_soft);
  if(a<0.004)discard;
  gl_FragColor=vec4(v_col,a);
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

  const STRIDE = 9;

  class FallingSnowTheme {
    constructor() { this.contextType = 'webgl'; }

    init(canvas, _ctx, opts) {
      this.canvas  = canvas;
      this.dpr     = Math.min(window.devicePixelRatio || 1, 2);
      this.speed   = (opts && opts.speed) || 1.0;
      const intMap = {
        low:    { back:  80, mid:  48, front: 16 },
        medium: { back: 200, mid: 120, front: 40 },
        high:   { back: 320, mid: 192, front: 64 },
      };
      const ic = intMap[(opts && opts.intensity) || 'medium'] || intMap.medium;
      this._backCount  = ic.back;
      this._midCount   = ic.mid;
      this._frontCount = ic.front;
      this._totalQuads = this._backCount + this._midCount + this._frontCount * 2;
      this._lastTs = null;
      this._scaledTime = 0;
      this.W = 1; this.H = 1;
      this._windPeriod = 30 + Math.random() * 30; // 30–60s gentle breeze cycle

      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      this.gl = gl; if (!gl) return;

      this.bgProg   = mkProg(gl, BG_VERT,   BG_FRAG);
      this.snowProg = mkProg(gl, SNOW_VERT, SNOW_FRAG);

      this.bgBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);

      this.bgLoc = {
        a:    gl.getAttribLocation(this.bgProg,  'a'),
        res:  gl.getUniformLocation(this.bgProg,  'u_res'),
        time: gl.getUniformLocation(this.bgProg,  'u_time'),
      };
      this.snowLoc = {
        pos:   gl.getAttribLocation(this.snowProg, 'a_pos'),
        uv:    gl.getAttribLocation(this.snowProg, 'a_uv'),
        col:   gl.getAttribLocation(this.snowProg, 'a_col'),
        alpha: gl.getAttribLocation(this.snowProg, 'a_alpha'),
        soft:  gl.getAttribLocation(this.snowProg, 'a_soft'),
      };

      this.snowBuf  = gl.createBuffer();
      this.snowData = new Float32Array(this._totalQuads * 6 * STRIDE);
      this.flakes   = [];

      this.resize(canvas.clientWidth, canvas.clientHeight);
    }

    _spawnFlake(f, layer, stagger) {
      const dpr = this.dpr;
      const W = this.W, H = this.H;
      f.layer = layer;

      if      (layer === 0) f.baseR = (0.5 + Math.random() * 1.0) * dpr; // 0.5–1.5px
      else if (layer === 1) f.baseR = (1.5 + Math.random() * 1.5) * dpr; // 1.5–3px
      else                  f.baseR = (4.0 + Math.random() * 4.0) * dpr; // 4–8px

      f.bx = Math.random() * W;
      f.by = stagger ? Math.random() * H : -f.baseR;

      const spd = layer === 0 ? 20 + Math.random() * 20   // 20–40px/s
                : layer === 1 ? 45 + Math.random() * 30   // 45–75px/s
                              : 80 + Math.random() * 40;  // 80–120px/s
      f.vy = spd * dpr;

      f.swayAmp    = (layer === 0 ? Math.random() * 3
                    : layer === 1 ? 8  + Math.random() * 12
                                  : 15 + Math.random() * 20) * dpr;
      f.swayPeriod = layer === 0 ? 5 + Math.random() * 5
                   : layer === 1 ? 3 + Math.random() * 3
                                 : 2 + Math.random() * 4;
      f.swayPhase  = Math.random() * Math.PI * 2;
      // Secondary sway — incommensurate period creates a non-repeating organic path
      f.swayAmp2    = f.swayAmp * (0.25 + Math.random() * 0.30);
      f.swayPeriod2 = f.swayPeriod * (1.31 + Math.random() * 0.82);
      f.swayPhase2  = Math.random() * Math.PI * 2;
      // Vertical turbulence — flake speeds up/slows as it passes through air pockets
      f.turbAmp   = f.vy * (0.06 + Math.random() * 0.10);
      f.turbFreq  = 2 * Math.PI / (1.5 + Math.random() * 3.0);
      f.turbPhase = Math.random() * Math.PI * 2;
      f.sx = 0;

      f.alpha = layer === 0 ? 0.20 + Math.random() * 0.15  // 0.20–0.35
              : layer === 1 ? 0.45 + Math.random() * 0.20  // 0.45–0.65
                            : 0.70 + Math.random() * 0.20; // 0.70–0.90

      if (layer === 2) f.haloAlpha = 0.07 + Math.random() * 0.07; // 0.07–0.14

      // Pure white to very pale blue-white (#f0f5ff)
      const tc = Math.random();
      f.r = 0.940 + tc * 0.060;
      f.g = 0.961 + tc * 0.039;
      f.b = 1.0;
    }

    _initFlakes() {
      this.flakes = [];
      for (let i = 0; i < this._backCount;  i++) { const f = {}; this._spawnFlake(f, 0, true); this.flakes.push(f); }
      for (let i = 0; i < this._midCount;   i++) { const f = {}; this._spawnFlake(f, 1, true); this.flakes.push(f); }
      for (let i = 0; i < this._frontCount; i++) { const f = {}; this._spawnFlake(f, 2, true); this.flakes.push(f); }
    }

    resize(w, h) {
      this.W = Math.max(1, Math.floor(w * this.dpr));
      this.H = Math.max(1, Math.floor(h * this.dpr));
      this.canvas.width  = this.W;
      this.canvas.height = this.H;
      if (this.gl) this.gl.viewport(0, 0, this.W, this.H);
      this._initFlakes();
    }

    draw(ts) {
      const gl = this.gl; if (!gl) return;
      const rawDt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      const dt = rawDt * (this.speed || 1);
      this._scaledTime += dt;
      const t = this._scaledTime;

      const W = this.W, H = this.H;
      const gndY    = H * 0.95;   // canvas-pixel y matching UV horizon 0.05
      const fadeLen = H * 0.15;   // flakes fade over 15% of canvas height above ground
      const maxWind = 15 * this.dpr;
      // Two-harmonic wind — breaks the perfect sine into something more irregular
      const windVx  = maxWind * (0.72 * Math.sin(t * 2*Math.PI / this._windPeriod)
                               + 0.28 * Math.sin(t * 2*Math.PI / (this._windPeriod * 0.41)));

      // ── Background ────────────────────────────────────────────────────────
      gl.disable(gl.BLEND);
      gl.useProgram(this.bgProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf);
      gl.enableVertexAttribArray(this.bgLoc.a);
      gl.vertexAttribPointer(this.bgLoc.a, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(this.bgLoc.res,  W, H);
      gl.uniform1f(this.bgLoc.time, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // ── Update flakes ─────────────────────────────────────────────────────
      for (const f of this.flakes) {
        const wm = f.layer === 0 ? 0.3 : f.layer === 1 ? 0.6 : 1.0;
        f.bx += windVx * wm * dt;
        const turb = f.turbAmp * Math.sin(t * f.turbFreq + f.turbPhase);
        f.by += (f.vy + turb) * dt;

        // Pre-compute two-frequency sway for this frame (reused in all VBO passes)
        f.sx = f.swayAmp  * Math.sin(t * 2*Math.PI/f.swayPeriod  + f.swayPhase)
             + f.swayAmp2 * Math.sin(t * 2*Math.PI/f.swayPeriod2 + f.swayPhase2);

        // Horizontal wrap
        const margin = f.baseR + 5;
        if (f.bx < -margin)     f.bx += W + margin * 2;
        if (f.bx > W + margin)  f.bx -= W + margin * 2;

        // Respawn above top once flake dissolves into ground
        if (f.by > gndY + f.baseR) {
          f.by = -f.baseR;
          f.bx = Math.random() * W;
        }
      }

      // ── Build VBO: back → mid → front halos → front dots ──────────────────
      const buf = this.snowData;
      let off = 0;

      const pushQuad = (x, y, r, cr, cg, cb, alpha, soft) => {
        const x0 = x-r, x1 = x+r, y0 = y-r, y1 = y+r;
        const nx0 = x0/W*2-1, nx1 = x1/W*2-1;
        const ny1 = 1-y0/H*2, ny0 = 1-y1/H*2;
        const PX=[nx0,nx1,nx1,nx0,nx1,nx0], PY=[ny0,ny0,ny1,ny0,ny1,ny1];
        const UX=[ -1,  1,  1, -1,  1, -1], UY=[ -1, -1,  1, -1,  1,  1];
        for (let v=0;v<6;v++) {
          buf[off++]=PX[v]; buf[off++]=PY[v];
          buf[off++]=UX[v]; buf[off++]=UY[v];
          buf[off++]=cr;    buf[off++]=cg;    buf[off++]=cb;
          buf[off++]=alpha; buf[off++]=soft;
        }
      };

      // Back layer — tiny tight dots
      for (let i = 0; i < this._backCount; i++) {
        const f = this.flakes[i];
        const fa = Math.max(0, 1 - Math.max(0, f.by - (gndY - fadeLen)) / fadeLen);
        pushQuad(f.bx+f.sx, f.by, f.baseR, f.r, f.g, f.b, f.alpha * fa, 4.5);
      }
      // Mid layer — medium soft dots
      const midEnd = this._backCount + this._midCount;
      for (let i = this._backCount; i < midEnd; i++) {
        const f = this.flakes[i];
        const fa = Math.max(0, 1 - Math.max(0, f.by - (gndY - fadeLen)) / fadeLen);
        pushQuad(f.bx+f.sx, f.by, f.baseR, f.r, f.g, f.b, f.alpha * fa, 3.5);
      }
      // Front halos (wide, faint — rendered before dots so dots appear on top)
      for (let i = midEnd; i < midEnd+this._frontCount; i++) {
        const f = this.flakes[i];
        const fa = Math.max(0, 1 - Math.max(0, f.by - (gndY - fadeLen)) / fadeLen);
        pushQuad(f.bx+f.sx, f.by, f.baseR*2.8, f.r, f.g, f.b, f.haloAlpha * fa, 1.0);
      }
      // Front dots (on top of halos)
      for (let i = midEnd; i < midEnd+this._frontCount; i++) {
        const f = this.flakes[i];
        const fa = Math.max(0, 1 - Math.max(0, f.by - (gndY - fadeLen)) / fadeLen);
        pushQuad(f.bx+f.sx, f.by, f.baseR, f.r, f.g, f.b, f.alpha * fa, 3.0);
      }

      // ── Draw snowflakes ───────────────────────────────────────────────────
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.snowProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.snowBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buf, gl.DYNAMIC_DRAW);

      const bs = STRIDE * 4;
      const L  = this.snowLoc;
      gl.enableVertexAttribArray(L.pos);   gl.vertexAttribPointer(L.pos,   2, gl.FLOAT, false, bs,  0);
      gl.enableVertexAttribArray(L.uv);    gl.vertexAttribPointer(L.uv,    2, gl.FLOAT, false, bs,  8);
      gl.enableVertexAttribArray(L.col);   gl.vertexAttribPointer(L.col,   3, gl.FLOAT, false, bs, 16);
      gl.enableVertexAttribArray(L.alpha); gl.vertexAttribPointer(L.alpha, 1, gl.FLOAT, false, bs, 28);
      gl.enableVertexAttribArray(L.soft);  gl.vertexAttribPointer(L.soft,  1, gl.FLOAT, false, bs, 32);

      gl.drawArrays(gl.TRIANGLES, 0, this._totalQuads * 6);
      gl.disable(gl.BLEND);
    }

    start()  {}
    stop()   {}

    destroy() {
      const gl = this.gl; if (!gl) return;
      gl.deleteProgram(this.bgProg);
      gl.deleteProgram(this.snowProg);
      gl.deleteBuffer(this.bgBuf);
      gl.deleteBuffer(this.snowBuf);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.gl = null;
    }
  }

  window.FallingSnowTheme = FallingSnowTheme;
})();
