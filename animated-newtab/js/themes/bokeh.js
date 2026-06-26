(function () {
  // ── Background: deep night gradient ──────────────────────────────────────
  const BG_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}';
  const BG_FRAG = `precision mediump float;
uniform vec2 u_res;
void main(){
  float t=gl_FragCoord.y/u_res.y;
  vec3 top=vec3(0.0314,0.0314,0.0627); // #080810 cool dark
  vec3 bot=vec3(0.0627,0.0471,0.0941); // #100c18 warm purple-black
  gl_FragColor=vec4(mix(bot,top,t),1.);
}`;

  // ── Bokeh orb pass ────────────────────────────────────────────────────────
  // Per-vertex: pos(2) uv(2) col(3) alpha(1)  →  STRIDE=8
  const ORB_VERT = `
attribute vec2 a_pos;attribute vec2 a_uv;attribute vec3 a_col;attribute float a_alpha;
varying vec2 v_uv;varying vec3 v_col;varying float v_alpha;
void main(){gl_Position=vec4(a_pos,0,1);v_uv=a_uv;v_col=a_col;v_alpha=a_alpha;}`;

  const ORB_FRAG = `precision mediump float;
varying vec2 v_uv;varying vec3 v_col;varying float v_alpha;
void main(){
  float d=length(v_uv);
  if(d>1.)discard;
  // Lens bokeh: flat disc fill with smooth circular edge + subtle center warmth
  float fill   =1.-smoothstep(0.68,1.0,d); // uniform disc, soft circular edge
  float bloom  =exp(-d*d*2.2);             // very soft center glow
  float falloff=fill*0.82+bloom*0.28;
  gl_FragColor=vec4(v_col,v_alpha*min(1.,falloff));
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

  // Weighted color selection: 50% warm, 30% cool, 20% neutral
  function pickColor() {
    const r = Math.random() * 100;
    if (r < 20) return [1.000, 0.973, 0.941]; // warm white   #fff8f0
    if (r < 37) return [1.000, 0.851, 0.502]; // soft gold    #ffd980
    if (r < 54) return [1.000, 0.702, 0.278]; // pale amber   #ffb347
    if (r < 69) return [0.910, 0.941, 1.000]; // blue-white   #e8f0ff
    if (r < 84) return [0.831, 0.784, 1.000]; // soft lavender #d4c8ff
    return              [1.000, 0.796, 0.643]; // warm peach   #ffcba4
  }

  const COUNT  = 65;
  const STRIDE = 8;

  class BokehLightsTheme {
    constructor() { this.contextType = 'webgl'; }

    init(canvas, _ctx) {
      this.canvas  = canvas;
      this.dpr     = Math.min(window.devicePixelRatio || 1, 2);
      this._t0     = null;
      this._lastTs = null;
      this.W = 1; this.H = 1;
      this._pulsePeriod = 6 + Math.random() * 4; // 6–10s master breathe

      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      this.gl = gl; if (!gl) return;

      this.bgProg  = mkProg(gl, BG_VERT,  BG_FRAG);
      this.orbProg = mkProg(gl, ORB_VERT, ORB_FRAG);

      this.bgBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);

      this.bgLoc = {
        a:   gl.getAttribLocation(this.bgProg,  'a'),
        res: gl.getUniformLocation(this.bgProg,  'u_res'),
      };
      this.orbLoc = {
        pos:   gl.getAttribLocation(this.orbProg, 'a_pos'),
        uv:    gl.getAttribLocation(this.orbProg, 'a_uv'),
        col:   gl.getAttribLocation(this.orbProg, 'a_col'),
        alpha: gl.getAttribLocation(this.orbProg, 'a_alpha'),
      };

      this.orbBuf  = gl.createBuffer();
      this.orbData = new Float32Array(COUNT * 6 * STRIDE);
      this.orbs    = [];

      this.resize(canvas.clientWidth, canvas.clientHeight);
    }

    _spawn(o) {
      const dpr = this.dpr;
      const W = this.W, H = this.H;
      const cx = W / 2, cy = H / 2;

      // Layer: 0=back 40%, 1=mid 35%, 2=front 25%
      const lr = Math.random();
      o.layer = lr < 0.40 ? 0 : lr < 0.75 ? 1 : 2;

      // Radius — skewed toward medium/large (60% at 40px+)
      if      (o.layer === 0) o.baseR = (18 + Math.random() * 22) * dpr; // 18–40px
      else if (o.layer === 1) o.baseR = (30 + Math.random() * 35) * dpr; // 30–65px
      else                    o.baseR = (50 + Math.random() * 40) * dpr; // 50–90px

      // Starting position — center-biased 60%, full-screen 40%
      if (Math.random() < 0.6) {
        o.bx = cx + (Math.random() - 0.5) * W * 0.7;
        o.by = cy + (Math.random() - 0.5) * H * 0.7;
      } else {
        o.bx = Math.random() * W;
        o.by = Math.random() * H;
      }

      // Drift velocity (px/s) — faster layers in front
      const spd = (o.layer === 0 ? 4  + Math.random() * 3
                 : o.layer === 1 ? 6  + Math.random() * 4
                                 : 8  + Math.random() * 6) * dpr;
      const ang = Math.random() * Math.PI * 2;
      o.vx = Math.cos(ang) * spd;
      o.vy = Math.sin(ang) * spd;

      // Wobble — independent x and y sine offsets
      o.wobbleAmp    = (8  + Math.random() * 18) * dpr;
      o.wobbleFreq   = (2 * Math.PI) / (6 + Math.random() * 9); // period 6–15s
      o.wobblePhaseX = Math.random() * Math.PI * 2;
      o.wobblePhaseY = Math.random() * Math.PI * 2;

      // Focus pulse — radius oscillates ±15–30%, opacity inversely correlated
      o.pulseAmp    = 0.15 + Math.random() * 0.15;
      o.pulsePeriod = 4    + Math.random() * 6;   // 4–10s
      o.pulsePhase  = Math.random() * Math.PI * 2;

      // Color
      const [r, g, b] = pickColor();
      o.r = r; o.g = g; o.b = b;

      // Opacity
      o.baseAlpha = o.layer === 0 ? 0.12 + Math.random() * 0.16  // 0.12–0.28
                  : o.layer === 1 ? 0.20 + Math.random() * 0.20  // 0.20–0.40
                                  : 0.28 + Math.random() * 0.27; // 0.28–0.55
    }

    _initOrbs() {
      this.orbs = [];
      for (let i = 0; i < COUNT; i++) {
        const o = {};
        this._spawn(o);
        this.orbs.push(o);
      }
      // Sort back → front for correct depth compositing
      this.orbs.sort((a, b) => a.layer - b.layer);
    }

    resize(w, h) {
      this.W = Math.max(1, Math.floor(w * this.dpr));
      this.H = Math.max(1, Math.floor(h * this.dpr));
      this.canvas.width  = this.W;
      this.canvas.height = this.H;
      if (this.gl) this.gl.viewport(0, 0, this.W, this.H);
      this._initOrbs();
    }

    draw(ts) {
      const gl = this.gl; if (!gl) return;
      if (!this._t0) this._t0 = ts;
      const t  = (ts - this._t0) / 1000;
      const dt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0.016;
      this._lastTs = ts;

      // Master breathing pulse ±4%
      const masterPulse = 1 + 0.04 * Math.sin(t * (2 * Math.PI / this._pulsePeriod));
      const W = this.W, H = this.H;

      // ── Background ────────────────────────────────────────────────────────
      gl.disable(gl.BLEND);
      gl.useProgram(this.bgProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf);
      gl.enableVertexAttribArray(this.bgLoc.a);
      gl.vertexAttribPointer(this.bgLoc.a, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(this.bgLoc.res, W, H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // ── Update orbs and build VBO ─────────────────────────────────────────
      const buf = this.orbData;
      let off = 0;

      for (const o of this.orbs) {
        // Drift
        o.bx += o.vx * dt;
        o.by += o.vy * dt;

        // Seamless wrap
        if      (o.bx - o.baseR >  W) o.bx = -o.baseR;
        else if (o.bx + o.baseR <  0) o.bx =  W + o.baseR;
        if      (o.by - o.baseR >  H) o.by = -o.baseR;
        else if (o.by + o.baseR <  0) o.by =  H + o.baseR;

        // Wobble offset
        const wx = Math.sin(t * o.wobbleFreq        + o.wobblePhaseX) * o.wobbleAmp;
        const wy = Math.sin(t * o.wobbleFreq * 0.71 + o.wobblePhaseY) * o.wobbleAmp;
        const x  = o.bx + wx;
        const y  = o.by + wy;

        // Focus pulse
        const psin     = Math.sin(t * (2 * Math.PI / o.pulsePeriod) + o.pulsePhase);
        const curR     = o.baseR * (1 + o.pulseAmp * psin);
        const curAlpha = Math.min(1, o.baseAlpha * (1 - 0.12 * psin) * masterPulse);

        // Build quad in NDC (WebGL y=0 is bottom, screen y=0 is top)
        const x0 = x - curR,  x1 = x + curR;
        const y0 = y - curR,  y1 = y + curR;
        const nx0 =  x0 / W * 2 - 1,  nx1 = x1 / W * 2 - 1;
        const ny1 = 1 - y0 / H * 2,   ny0 = 1 - y1 / H * 2;

        // Two triangles: BL, BR, TR, BL, TR, TL
        const PX = [nx0, nx1, nx1, nx0, nx1, nx0];
        const PY = [ny0, ny0, ny1, ny0, ny1, ny1];
        const UX = [ -1,   1,   1,  -1,   1,  -1];
        const UY = [ -1,  -1,   1,  -1,   1,   1];

        for (let v = 0; v < 6; v++) {
          buf[off++] = PX[v]; buf[off++] = PY[v];
          buf[off++] = UX[v]; buf[off++] = UY[v];
          buf[off++] = o.r;   buf[off++] = o.g;  buf[off++] = o.b;
          buf[off++] = curAlpha;
        }
      }

      // ── Draw orbs (additive blend — glowing lights) ───────────────────────
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(this.orbProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.orbBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buf, gl.DYNAMIC_DRAW);

      const bs = STRIDE * 4;
      const L  = this.orbLoc;
      gl.enableVertexAttribArray(L.pos);   gl.vertexAttribPointer(L.pos,   2, gl.FLOAT, false, bs,  0);
      gl.enableVertexAttribArray(L.uv);    gl.vertexAttribPointer(L.uv,    2, gl.FLOAT, false, bs,  8);
      gl.enableVertexAttribArray(L.col);   gl.vertexAttribPointer(L.col,   3, gl.FLOAT, false, bs, 16);
      gl.enableVertexAttribArray(L.alpha); gl.vertexAttribPointer(L.alpha, 1, gl.FLOAT, false, bs, 28);

      gl.drawArrays(gl.TRIANGLES, 0, COUNT * 6);
      gl.disable(gl.BLEND);
    }

    start()  {}
    stop()   {}

    destroy() {
      const gl = this.gl; if (!gl) return;
      gl.deleteProgram(this.bgProg);
      gl.deleteProgram(this.orbProg);
      gl.deleteBuffer(this.bgBuf);
      gl.deleteBuffer(this.orbBuf);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.gl = null;
    }
  }

  window.BokehLightsTheme = BokehLightsTheme;
})();
