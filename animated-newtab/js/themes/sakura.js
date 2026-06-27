(function () {
  // ── Background: gradient + shimmer + warm vignette ────────────────────────
  const BG_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}';
  const BG_FRAG = `precision mediump float;
uniform vec2 u_res;
uniform float u_time;
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  vec3 top=vec3(0.788,0.839,0.910); // #c9d6e8 lavender-blue
  vec3 mid=vec3(0.949,0.769,0.808); // #f2c4ce blush pink
  vec3 bot=vec3(0.992,0.941,0.910); // #fdf0e8 warm cream
  vec3 col=uv.y>.5?mix(mid,top,(uv.y-.5)*2.):mix(bot,mid,uv.y*2.);
  // Ambient shimmer ±2%, 10s period
  col=clamp(col+sin(u_time*.6283)*.02,0.,1.);
  // Warm vignette
  vec2 vq=uv-.5;
  col=mix(col,vec3(0.72,0.58,0.46),clamp(dot(vq,vq)*2.8*.18,0.,1.));
  gl_FragColor=vec4(col,1.);
}`;

  // ── Petal pass ────────────────────────────────────────────────────────────
  // Per-vertex: pos(2) uv(2) col(3) alpha(1) feather(1)  →  STRIDE=9
  const PETAL_VERT = `
attribute vec2 a_pos;attribute vec2 a_uv;attribute vec3 a_col;
attribute float a_alpha;attribute float a_feather;
varying vec2 v_uv;varying vec3 v_col;varying float v_alpha;varying float v_feather;
void main(){gl_Position=vec4(a_pos,0,1);v_uv=a_uv;v_col=a_col;v_alpha=a_alpha;v_feather=a_feather;}`;
  const PETAL_FRAG = `precision mediump float;
varying vec2 v_uv;varying vec3 v_col;varying float v_alpha;varying float v_feather;
void main(){
  float d=length(v_uv);
  float a=smoothstep(1.0,v_feather,d)*v_alpha;
  if(a<0.005)discard;
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

  const COLORS = [
    [0.976,0.745,0.780], // #f9bec7
    [0.957,0.627,0.710], // #f4a0b5
    [0.992,0.878,0.910], // #fde0e8
    [0.910,0.627,0.706], // #e8a0b4
    [1.000,0.941,0.953], // #fff0f3
  ];
  const COUNT  = 100;
  const STRIDE = 9;

  class SakuraPetalsTheme {
    constructor() { this.contextType = 'webgl'; }

    init(canvas, _ctx, opts) {
      this.canvas = canvas;
      this.dpr    = Math.min(window.devicePixelRatio || 1, 2);
      this.speed  = (opts && opts.speed) || 1.0;
      this._lastTs= null;
      this._scaledTime = 0;
      this.W = 1; this.H = 1;

      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      this.gl = gl; if (!gl) return;

      this.bgProg = mkProg(gl, BG_VERT, BG_FRAG);
      this.pProg  = mkProg(gl, PETAL_VERT, PETAL_FRAG);

      // Background fullscreen triangle
      this.bgBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);

      // Cache locations
      this.bgLoc = {
        a:    gl.getAttribLocation(this.bgProg, 'a'),
        res:  gl.getUniformLocation(this.bgProg, 'u_res'),
        time: gl.getUniformLocation(this.bgProg, 'u_time'),
      };
      this.pLoc = {
        pos:     gl.getAttribLocation(this.pProg, 'a_pos'),
        uv:      gl.getAttribLocation(this.pProg, 'a_uv'),
        col:     gl.getAttribLocation(this.pProg, 'a_col'),
        alpha:   gl.getAttribLocation(this.pProg, 'a_alpha'),
        feather: gl.getAttribLocation(this.pProg, 'a_feather'),
      };

      // Dynamic petal VBO
      this.pBuf  = gl.createBuffer();
      this.pData = new Float32Array(COUNT * 6 * STRIDE);

      this.petals = [];
      this.resize(canvas.clientWidth, canvas.clientHeight);
    }

    _spawn(p, stagger) {
      const dpr   = this.dpr;
      const layer = Math.floor(Math.random() * 3);
      p.layer      = layer;
      p.spawnX     = Math.random() * this.W;
      p.y          = stagger ? Math.random() * this.H : -40 - Math.random() * 300;
      p.vy         = (40 + Math.random() * 50) * dpr;
      p.swayAmp    = (15 + Math.random() * 25) * dpr;
      p.swayPeriod = 2 + Math.random() * 3;
      p.swayPhase  = Math.random() * Math.PI * 2;
      p.rot        = Math.random() * Math.PI * 2;
      p.rotSpd     = (0.3 + Math.random() * 0.9) * (Math.random() < 0.5 ? 1 : -1);

      const c = COLORS[Math.floor(Math.random() * COLORS.length)];
      const j = (Math.random() - 0.5) * 0.05;
      p.r = Math.min(1, c[0] + j);
      p.g = Math.min(1, c[1] + j);
      p.b = Math.min(1, c[2] + j);

      if (layer === 0) {          // back: small, faint, sharper edge
        p.hw     = (4 + Math.random() * 3) * dpr;
        p.alpha  = 0.25 + Math.random() * 0.15;
        p.feather= 0.62;
      } else if (layer === 1) {   // mid: normal
        p.hw     = (7 + Math.random() * 4) * dpr;
        p.alpha  = 0.50 + Math.random() * 0.20;
        p.feather= 0.44;
      } else {                    // front: large, opaque, soft (bokeh feel)
        p.hw     = (11 + Math.random() * 5) * dpr;
        p.alpha  = 0.70 + Math.random() * 0.20;
        p.feather= 0.20;
      }
      p.hh = p.hw * (1.65 + Math.random() * 0.35); // elongated petal
    }

    _initParticles() {
      this.petals = [];
      for (let i = 0; i < COUNT; i++) {
        const p = {};
        this._spawn(p, true);
        this.petals.push(p);
      }
      // Sort back→front so depth compositing is correct
      this.petals.sort((a, b) => a.layer - b.layer);
    }

    resize(w, h) {
      this.W = Math.max(1, Math.floor(w * this.dpr));
      this.H = Math.max(1, Math.floor(h * this.dpr));
      this.canvas.width  = this.W;
      this.canvas.height = this.H;
      if (this.gl) this.gl.viewport(0, 0, this.W, this.H);
      this._initParticles();
    }

    draw(ts) {
      const gl = this.gl; if (!gl) return;
      const rawDt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      const dt = rawDt * (this.speed || 1);
      this._scaledTime += dt;
      const t = this._scaledTime;

      // Update petals
      for (const p of this.petals) {
        p.rot += p.rotSpd * dt;
        p.y   += p.vy * dt;
        p.x    = p.spawnX + Math.sin(t * (Math.PI * 2 / p.swayPeriod) + p.swayPhase) * p.swayAmp;
        if (p.y > this.H + 60) this._spawn(p, false);
      }

      // ── Background ───────────────────────────────────────────────────────
      gl.disable(gl.BLEND);
      gl.useProgram(this.bgProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf);
      const bA = this.bgLoc.a;
      gl.enableVertexAttribArray(bA);
      gl.vertexAttribPointer(bA, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(this.bgLoc.res,  this.W, this.H);
      gl.uniform1f(this.bgLoc.time, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // ── Petals ───────────────────────────────────────────────────────────
      const buf = this.pData;
      const W = this.W, H = this.H;
      let off = 0;

      for (const p of this.petals) {
        const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
        const hw = p.hw, hh = p.hh;
        // 4 corner positions (local) + their UVs
        const LX = [-hw,  hw,  hw, -hw];
        const LY = [-hh, -hh,  hh,  hh];
        const UX = [-1,   1,   1,  -1];
        const UY = [-1,  -1,   1,   1];
        // Pre-transform corners to NDC
        const VX = new Array(4), VY = new Array(4);
        for (let i = 0; i < 4; i++) {
          VX[i] = (LX[i]*cos - LY[i]*sin + p.x) / W * 2 - 1;
          VY[i] = 1 - (LX[i]*sin + LY[i]*cos + p.y) / H * 2;
        }
        // Two triangles [0,1,2] [0,2,3]
        for (const vi of [0,1,2,0,2,3]) {
          buf[off++]=VX[vi]; buf[off++]=VY[vi];
          buf[off++]=UX[vi]; buf[off++]=UY[vi];
          buf[off++]=p.r; buf[off++]=p.g; buf[off++]=p.b;
          buf[off++]=p.alpha;
          buf[off++]=p.feather;
        }
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.pProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buf, gl.DYNAMIC_DRAW);

      const bs = STRIDE * 4;
      const L  = this.pLoc;
      gl.enableVertexAttribArray(L.pos);     gl.vertexAttribPointer(L.pos,     2, gl.FLOAT, false, bs,  0);
      gl.enableVertexAttribArray(L.uv);      gl.vertexAttribPointer(L.uv,      2, gl.FLOAT, false, bs,  8);
      gl.enableVertexAttribArray(L.col);     gl.vertexAttribPointer(L.col,     3, gl.FLOAT, false, bs, 16);
      gl.enableVertexAttribArray(L.alpha);   gl.vertexAttribPointer(L.alpha,   1, gl.FLOAT, false, bs, 28);
      gl.enableVertexAttribArray(L.feather); gl.vertexAttribPointer(L.feather, 1, gl.FLOAT, false, bs, 32);

      gl.drawArrays(gl.TRIANGLES, 0, COUNT * 6);
      gl.disable(gl.BLEND);
    }

    start() {}
    stop()  {}

    destroy() {
      const gl = this.gl; if (!gl) return;
      gl.deleteProgram(this.bgProg);
      gl.deleteProgram(this.pProg);
      gl.deleteBuffer(this.bgBuf);
      gl.deleteBuffer(this.pBuf);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.gl = null;
    }
  }

  window.SakuraPetalsTheme = SakuraPetalsTheme;
})();
