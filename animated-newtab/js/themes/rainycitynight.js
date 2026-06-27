(function () {
  'use strict';

  // ─── Background vertex (full-screen triangle) ─────────────────────────────
  const BG_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}';

  // ─── Sprite vertex ────────────────────────────────────────────────────────
  const SP_VERT = `attribute vec2 a_pos;attribute vec2 a_uv;attribute vec3 a_col;
attribute float a_alpha;attribute float a_soft;
varying vec2 v_uv;varying vec3 v_col;varying float v_alpha;varying float v_soft;
void main(){gl_Position=vec4(a_pos,0,1);v_uv=a_uv;v_col=a_col;v_alpha=a_alpha;v_soft=a_soft;}`;

  // ─── Sprite fragment (rain, cars, splash) ─────────────────────────────────
  // soft=0: solid quad; soft>0: Gaussian radial falloff with that exponent
  const SP_FRAG = `precision mediump float;
varying vec2 v_uv;varying vec3 v_col;varying float v_alpha;varying float v_soft;
void main(){
  float a=v_alpha;
  if(v_soft>0.){float d=length(v_uv);if(d>1.)discard;a*=exp(-d*d*v_soft);}
  if(a<0.004)discard;
  gl_FragColor=vec4(v_col,a);
}`;

  // ─── Background fragment (city scene) ────────────────────────────────────
  const BG_FRAG = `precision mediump float;
uniform vec2 u_res;uniform float u_time;

float h1(float n){return fract(sin(n)*43758.5453);}
float h2(float x,float y){return fract(sin(x*127.1+y*311.7)*43758.5453);}

// Slow neon flicker: mostly on, dips occasionally, rarely cuts out
float flick(float s,float t){
  float f=(0.82+0.12*sin(t*4.1+s*6.28))*(0.88+0.10*sin(t*9.7+s*2.17));
  return clamp(f*step(0.06,fract(h1(s+floor(t*0.27))*3.7+t*0.09)),0.,1.);
}

void main(){
  vec2 uv=gl_FragCoord.xy/u_res; // (0,0)=bottom-left
  float sY=0.18; // street occupies uv.y < sY

  // ── Sky ──────────────────────────────────────────────────────────────────
  vec3 col=mix(vec3(0.067,0.094,0.145),vec3(0.024,0.031,0.063),
               pow(smoothstep(sY,1.,uv.y),2.));

  // ── City glow: orange-amber left-of-centre ────────────────────────────────
  float d1=length((uv-vec2(0.34,sY+0.09))*vec2(1.0,2.1));
  col+=vec3(1.0,0.549,0.227)*max(0.,1.-d1/0.55)*max(0.,1.-d1/0.55)*0.30;

  // ── City glow: blue-purple right ─────────────────────────────────────────
  float d2=length((uv-vec2(0.72,sY+0.13))*vec2(0.95,1.9));
  col+=vec3(0.42,0.31,0.88)*max(0.,1.-d2/0.43)*max(0.,1.-d2/0.43)*0.20;

  // ── Back buildings (22 columns, very dark, distant) ───────────────────────
  float bxb=floor(uv.x*22.);
  float rB=0.22+h1(bxb*7.31+101.3)*0.16; // roof y: 0.22-0.38
  if(uv.y<rB&&uv.y>=sY) col=vec3(0.051,0.059,0.078);

  // ── Mid buildings (14 columns) with lit windows ───────────────────────────
  float bxm=floor(uv.x*14.);
  float rM=0.38+h1(bxm*13.7+57.1)*0.23; // roof y: 0.38-0.61
  if(uv.y<rM&&uv.y>=sY){
    col=vec3(0.067,0.082,0.125);
    float wx=fract(uv.x*14.),wy=(uv.y-sY)/max(rM-sY,0.001);
    float wgx=floor(wx*6.),wgy=floor(wy*14.);
    float wfx=fract(wx*6.),wfy=fract(wy*14.);
    if(wfx>0.12&&wfx<0.88&&wfy>0.08&&wfy<0.92){
      if(h2(bxm*6.+wgx,wgy+bxm*0.1)<0.30){ // 30% lit
        float ct=h2(bxm+wgx*0.3+500.,wgy+500.);
        vec3 wc=ct<0.6?vec3(1.0,0.894,0.627):ct<0.9?vec3(0.784,0.878,1.0):vec3(0.55,0.95,0.60);
        col=wc*0.72;
      }
    }
  }

  // ── Front buildings (7 columns) biased to screen edges ───────────────────
  float bxf=floor(uv.x*7.);
  float rF=0.55+h1(bxf*19.3+303.7)*0.32; // roof y: 0.55-0.87
  float edgeFac=1.-smoothstep(0.,0.32,min(uv.x,1.-uv.x));
  if(uv.y<rF&&uv.y>=sY&&h1(bxf*5.77+999.)<0.25+edgeFac*0.60){
    col=vec3(0.039,0.047,0.063);
    float wx=fract(uv.x*7.),wy=(uv.y-sY)/max(rF-sY,0.001);
    // Finer window grid on front buildings (5 cols x 10 rows = smaller windows)
    float wgx=floor(wx*5.),wgy=floor(wy*10.);
    float wfx=fract(wx*5.),wfy=fract(wy*10.);
    if(wfx>0.12&&wfx<0.88&&wfy>0.10&&wfy<0.90){
      if(h2(bxf*5.+wgx+7000.,wgy+bxf*0.2+7000.)<0.16){
        float ct=h2(bxf+wgx*0.1+8000.,wgy+8000.);
        col=(ct<0.65?vec3(1.0,0.894,0.627):vec3(0.784,0.878,1.0))*0.55;
      }
    }
  }

  // ── Neon signs ────────────────────────────────────────────────────────────
  // Sign 1: Hot pink — rectangle outline + 3 horizontal bars
  {
    vec2 lb=vec2(0.12,0.24),rt=vec2(0.21,0.31);
    float fl=flick(1.,u_time);
    vec3 sc=vec3(1.0,0.176,0.471);
    float gd=length((uv-(lb+rt)*0.5)/vec2(0.20,0.13));
    col+=sc*max(0.,1.-gd)*fl*0.28;
    if(uv.x>lb.x&&uv.x<rt.x&&uv.y>lb.y&&uv.y<rt.y){
      vec2 nuv=(uv-lb)/(rt-lb);
      if(nuv.x<0.07||nuv.x>0.93||abs(nuv.y-0.25)<0.09||abs(nuv.y-0.5)<0.09||abs(nuv.y-0.75)<0.09)
        col=sc*(0.75+fl*0.25);
    }
  }
  // Sign 2: Cyan — rectangle outline + centre bar
  {
    vec2 lb=vec2(0.40,0.25),rt=vec2(0.49,0.32);
    float fl=flick(2.,u_time);
    vec3 sc=vec3(0.0,0.898,1.0);
    float gd=length((uv-(lb+rt)*0.5)/vec2(0.18,0.11));
    col+=sc*max(0.,1.-gd)*fl*0.28;
    if(uv.x>lb.x&&uv.x<rt.x&&uv.y>lb.y&&uv.y<rt.y){
      vec2 nuv=(uv-lb)/(rt-lb);
      if(nuv.x<0.07||nuv.x>0.93||nuv.y<0.07||nuv.y>0.93||abs(nuv.y-0.5)<0.09)
        col=sc*(0.75+fl*0.25);
    }
  }
  // Sign 3: Warm orange — horizontal bar stack
  {
    vec2 lb=vec2(0.60,0.26),rt=vec2(0.68,0.33);
    float fl=flick(3.,u_time);
    vec3 sc=vec3(1.0,0.420,0.102);
    float gd=length((uv-(lb+rt)*0.5)/vec2(0.15,0.10));
    col+=sc*max(0.,1.-gd)*fl*0.25;
    if(uv.x>lb.x&&uv.x<rt.x&&uv.y>lb.y&&uv.y<rt.y){
      vec2 nuv=(uv-lb)/(rt-lb);
      if(nuv.y<0.08||nuv.y>0.92||abs(nuv.y-0.35)<0.09||abs(nuv.y-0.65)<0.09)
        col=sc*(0.75+fl*0.25);
    }
  }
  // Sign 4: Hot pink — rectangle outline + 2 bars
  {
    vec2 lb=vec2(0.78,0.23),rt=vec2(0.85,0.30);
    float fl=flick(4.,u_time);
    vec3 sc=vec3(1.0,0.176,0.471);
    float gd=length((uv-(lb+rt)*0.5)/vec2(0.13,0.10));
    col+=sc*max(0.,1.-gd)*fl*0.25;
    if(uv.x>lb.x&&uv.x<rt.x&&uv.y>lb.y&&uv.y<rt.y){
      vec2 nuv=(uv-lb)/(rt-lb);
      if(nuv.x<0.07||nuv.x>0.93||abs(nuv.y-0.33)<0.09||abs(nuv.y-0.67)<0.09)
        col=sc*(0.75+fl*0.25);
    }
  }

  // ── Wet street (bottom 18%) ───────────────────────────────────────────────
  if(uv.y<sY){
    col=vec3(0.047,0.047,0.063);
    float sp=uv.y/sY; // 0=bottom, 1=top of street
    // Ripple displacement on x
    float rx=uv.x+0.003*sin(uv.x*150.+u_time*10.);
    float fl1=flick(1.,u_time),fl2=flick(2.,u_time),fl3=flick(3.,u_time),fl4=flick(4.,u_time);
    // Sign reflection smears (vertical, blurred columns)
    col+=vec3(1.0,0.176,0.471)*max(0.,1.-abs(rx-0.165)/0.065)*(1.-sp*0.4)*fl1*0.22;
    col+=vec3(0.0,0.898,1.0 )*max(0.,1.-abs(rx-0.445)/0.060)*(1.-sp*0.4)*fl2*0.22;
    col+=vec3(1.0,0.420,0.102)*max(0.,1.-abs(rx-0.640)/0.052)*(1.-sp*0.4)*fl3*0.20;
    col+=vec3(1.0,0.176,0.471)*max(0.,1.-abs(rx-0.815)/0.042)*(1.-sp*0.4)*fl4*0.18;
    // Ambient orange reflection near horizon
    col+=vec3(1.0,0.549,0.227)*max(0.,sp-0.5)*0.06;
  }

  // ── Atmospheric fog (mid-scene) ───────────────────────────────────────────
  float fog=smoothstep(sY,sY+0.20,uv.y)*(1.-smoothstep(0.65,1.,uv.y));
  col+=vec3(0.055,0.075,0.110)*fog*0.14;

  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

  // ─── WebGL helpers ────────────────────────────────────────────────────────
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('RainyCityNight shader:', gl.getShaderInfoLog(s));
    return s;
  }
  function mkProg(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER,   vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    return p;
  }

  // ─── Constants ────────────────────────────────────────────────────────────
  const RAIN_COUNT = 350;
  const MAX_CARS   = 6;
  const MAX_SPLASH = 30;
  const STRIDE     = 9; // 2 pos + 2 uv + 3 col + 1 alpha + 1 soft (floats)

  const RAIN_ANGLE = 0.22; // ~12.6° from vertical
  const SIN_A = Math.sin(RAIN_ANGLE);
  const COS_A = Math.cos(RAIN_ANGLE);

  // ─── Theme class ─────────────────────────────────────────────────────────
  class RainyCityNightTheme {
    constructor() { this.contextType = 'webgl'; }

    init(canvas, _ctx, opts) {
      this.canvas  = canvas;
      this.dpr     = Math.min(window.devicePixelRatio || 1, 2);
      this.speed   = (opts && opts.speed) || 1.0;
      this._lastTs = null;
      this._scaledTime = 0;
      this.W       = 1;
      this.H       = 1;

      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      this.gl = gl;
      if (!gl) return;

      this.bgProg = mkProg(gl, BG_VERT, BG_FRAG);
      this.spProg  = mkProg(gl, SP_VERT, SP_FRAG);

      // Full-screen triangle
      this.bgBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);

      this.bgLoc = {
        a:    gl.getAttribLocation(this.bgProg, 'a'),
        res:  gl.getUniformLocation(this.bgProg, 'u_res'),
        time: gl.getUniformLocation(this.bgProg, 'u_time'),
      };
      this.spLoc = {
        pos:   gl.getAttribLocation(this.spProg, 'a_pos'),
        uv:    gl.getAttribLocation(this.spProg, 'a_uv'),
        col:   gl.getAttribLocation(this.spProg, 'a_col'),
        alpha: gl.getAttribLocation(this.spProg, 'a_alpha'),
        soft:  gl.getAttribLocation(this.spProg, 'a_soft'),
      };

      this.spBuf = gl.createBuffer();

      // Pre-allocated sprite buffer
      // Per car: body(6) + 2 HL cores(12) + 2 HL glows(12) + 2 TL cores(12)
      //          + 2 TL glows(12) + cone(6) + refl(6) = 66 verts
      const maxVerts = RAIN_COUNT * 6 + MAX_CARS * 66 + MAX_SPLASH * 6;
      this.spData = new Float32Array(maxVerts * STRIDE);

      // Particle pools (no per-frame allocation)
      this.rain     = Array.from({ length: RAIN_COUNT }, () => ({}));
      this.cars     = Array.from({ length: MAX_CARS   }, () => ({}));
      this.splashes = Array.from({ length: MAX_SPLASH }, () => ({ life: 0 }));

      this.resize(canvas.width, canvas.height);
    }

    resize(w, h) {
      this.W = Math.max(1, w);
      this.H = Math.max(1, h);
      if (this.gl) this.gl.viewport(0, 0, this.W, this.H);
      this._initRain();
      this._initCars();
    }

    // ── Particle initialisation ───────────────────────────────────────────

    _initRain() {
      for (const r of this.rain) this._respawnRain(r, true);
    }

    _respawnRain(r, stagger) {
      const W = this.W, H = this.H, dpr = this.dpr;
      r.len = (8 + Math.random() * 10) * dpr;
      r.x   = Math.random() * W;
      r.y   = stagger ? Math.random() * H : -r.len;
      r.vy  = (400 + Math.random() * 200) * dpr;
      // Slight leftward lean + random per-streak drift
      r.vx  = -r.vy * SIN_A + (Math.random() - 0.5) * 15 * dpr;
      r.alpha = 0.25 + Math.random() * 0.30;
      const tc = Math.random();
      r.r = 0.84 + tc * 0.16;
      r.g = 0.90 + tc * 0.10;
      r.b = 1.0;
    }

    _initCars() {
      for (const c of this.cars) this._respawnCar(c, true);
    }

    _respawnCar(c, immediate) {
      const W = this.W, H = this.H, dpr = this.dpr;
      c.dir   = Math.random() < 0.5 ? 1 : -1;
      c.speed = (80 + Math.random() * 120) * dpr;
      c.w     = (55 + Math.random() * 25) * dpr;
      c.h     = (12 + Math.random() * 7)  * dpr;
      c.y     = H * (0.83 + Math.random() * 0.05);
      c.x     = immediate
        ? Math.random() * W
        : (c.dir > 0 ? -c.w * 2 : W + c.w * 2);
    }

    _spawnSplash(x, y) {
      for (const sp of this.splashes) {
        if (sp.life > 0) continue;
        const spd   = (25 + Math.random() * 35) * this.dpr;
        const angle = 0.3 + Math.random() * 2.5; // mostly sideways upward
        sp.x  = x + (Math.random() - 0.5) * 4 * this.dpr;
        sp.y  = y;
        sp.vx = Math.cos(angle) * spd * (Math.random() < 0.5 ? 1 : -1);
        sp.vy = -Math.abs(Math.sin(angle)) * spd;
        sp.life = 1.0;
        sp.size = 0.8 + Math.random() * 0.6;
        sp.r = 0.87; sp.g = 0.93; sp.b = 1.0;
        return;
      }
    }

    // ── VBO push helpers ─────────────────────────────────────────────────

    _pushAARect(buf, off, x0, y0, x1, y1, r, g, b, alpha, soft) {
      const W = this.W, H = this.H;
      const nx0 = x0/W*2-1, nx1 = x1/W*2-1;
      const ny0 = 1-y1/H*2, ny1 = 1-y0/H*2; // note: y-flip
      const vs = [
        nx0,ny0,0,0, nx1,ny0,1,0, nx1,ny1,1,1,
        nx0,ny0,0,0, nx1,ny1,1,1, nx0,ny1,0,1,
      ];
      for (let i = 0; i < 6; i++) {
        const b4 = i * 4;
        buf[off++] = vs[b4]; buf[off++] = vs[b4+1];
        buf[off++] = vs[b4+2]; buf[off++] = vs[b4+3];
        buf[off++] = r; buf[off++] = g; buf[off++] = b;
        buf[off++] = alpha; buf[off++] = soft;
      }
      return off;
    }

    _pushCircle(buf, off, cx, cy, radius, r, g, b, alpha, soft) {
      const W = this.W, H = this.H;
      const x0 = cx-radius, x1 = cx+radius;
      const y0 = cy-radius, y1 = cy+radius;
      const nx0 = x0/W*2-1, nx1 = x1/W*2-1;
      const ny0 = 1-y1/H*2, ny1 = 1-y0/H*2;
      const vs = [
        nx0,ny0,-1,-1, nx1,ny0,1,-1, nx1,ny1,1,1,
        nx0,ny0,-1,-1, nx1,ny1,1,1,  nx0,ny1,-1,1,
      ];
      for (let i = 0; i < 6; i++) {
        const b4 = i * 4;
        buf[off++] = vs[b4]; buf[off++] = vs[b4+1];
        buf[off++] = vs[b4+2]; buf[off++] = vs[b4+3];
        buf[off++] = r; buf[off++] = g; buf[off++] = b;
        buf[off++] = alpha; buf[off++] = soft;
      }
      return off;
    }

    _pushStreak(buf, off, centerX, centerY, w, h, r, g, b, alpha) {
      const W = this.W, H = this.H;
      const hl = h * 0.5, hw = w * 0.5;
      // Along-streak offset and perpendicular offset (screen-space, y-down)
      const sx = SIN_A * hl, sy = COS_A * hl;
      const px = COS_A * hw, py = -SIN_A * hw;
      // 4 corners (pixel-space, y-down)
      const t1x = centerX - sx - px, t1y = centerY - sy - py;
      const t2x = centerX - sx + px, t2y = centerY - sy + py;
      const b2x = centerX + sx + px, b2y = centerY + sy + py;
      const b1x = centerX + sx - px, b1y = centerY + sy - py;
      // Convert to NDC
      const nx1 = t1x/W*2-1, ny1 = 1-t1y/H*2;
      const nx2 = t2x/W*2-1, ny2 = 1-t2y/H*2;
      const nx3 = b2x/W*2-1, ny3 = 1-b2y/H*2;
      const nx4 = b1x/W*2-1, ny4 = 1-b1y/H*2;
      const pos = [nx1,ny1, nx2,ny2, nx3,ny3, nx1,ny1, nx3,ny3, nx4,ny4];
      for (let i = 0; i < 6; i++) {
        buf[off++] = pos[i*2]; buf[off++] = pos[i*2+1];
        buf[off++] = 0; buf[off++] = 0;
        buf[off++] = r; buf[off++] = g; buf[off++] = b;
        buf[off++] = alpha; buf[off++] = 0; // solid
      }
      return off;
    }

    _drawCar(buf, off, c) {
      const dpr = this.dpr;
      const hw = c.w * 0.5, hh = c.h * 0.5;
      const x0 = c.x - hw, x1 = c.x + hw;
      const y0 = c.y - hh, y1 = c.y + hh;

      // Body
      off = this._pushAARect(buf, off, x0, y0, x1, y1, 0.039, 0.047, 0.055, 0.95, 0);

      const frontX = c.dir > 0 ? x1 : x0;
      const rearX  = c.dir > 0 ? x0 : x1;
      const ly1 = c.y - hh * 0.38;
      const ly2 = c.y + hh * 0.38;
      const lr  = 3 * dpr;

      // Headlights: tight bright core then wide glow
      off = this._pushCircle(buf, off, frontX, ly1, lr,     1.0, 0.98, 0.90, 0.95, 5.0);
      off = this._pushCircle(buf, off, frontX, ly2, lr,     1.0, 0.98, 0.90, 0.95, 5.0);
      off = this._pushCircle(buf, off, frontX, ly1, lr*3.5, 1.0, 0.95, 0.75, 0.30, 1.5);
      off = this._pushCircle(buf, off, frontX, ly2, lr*3.5, 1.0, 0.95, 0.75, 0.30, 1.5);

      // Taillights
      off = this._pushCircle(buf, off, rearX, ly1, lr,     1.0, 0.08, 0.04, 0.92, 5.0);
      off = this._pushCircle(buf, off, rearX, ly2, lr,     1.0, 0.08, 0.04, 0.92, 5.0);
      off = this._pushCircle(buf, off, rearX, ly1, lr*2.5, 0.85, 0.04, 0.02, 0.24, 1.5);
      off = this._pushCircle(buf, off, rearX, ly2, lr*2.5, 0.85, 0.04, 0.02, 0.24, 1.5);

      // Headlight cone: faint wedge in direction of travel
      const coneLen = c.w * 1.7;
      const coneH   = c.h * 2.1;
      const cx0 = c.dir > 0 ? frontX : frontX - coneLen;
      const cx1 = c.dir > 0 ? frontX + coneLen : frontX;
      off = this._pushAARect(buf, off, cx0, c.y - coneH*0.5, cx1, c.y + coneH*0.5,
                             1.0, 0.95, 0.75, 0.13, 0);

      // Street reflection smear below the car
      const rfW = c.w * 0.5;
      const rfX0 = c.x - rfW*0.5, rfX1 = c.x + rfW*0.5;
      off = this._pushAARect(buf, off, rfX0, y1, rfX1, Math.min(this.H, y1 + 18*dpr),
                             0.75, 0.55, 0.28, 0.10, 0);

      return off;
    }

    // ── Main draw ─────────────────────────────────────────────────────────

    draw(ts) {
      const gl = this.gl; if (!gl) return;
      const rawDt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      const dt = rawDt * (this.speed || 1);
      this._scaledTime += dt;
      const t = this._scaledTime;

      const W = this.W, H = this.H, dpr = this.dpr;
      const streetPx = H * 0.82; // y-down street top in physical pixels

      // ── Update rain ──
      for (const r of this.rain) {
        const prevY = r.y;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        // Splash on street impact
        if (prevY < streetPx && r.y >= streetPx && Math.random() < 0.28)
          this._spawnSplash(r.x, streetPx);
        // Respawn
        if (r.y > H + r.len) this._respawnRain(r, false);
        if (r.x < -30) r.x += W + 60;
        else if (r.x > W + 30) r.x -= W + 60;
      }

      // ── Update cars ──
      for (const c of this.cars) {
        c.x += c.dir * c.speed * dt;
        const mg = c.w * 3;
        if (c.dir > 0 && c.x > W + mg) {
          c.x = -c.w * 2;
          c.y = H * (0.83 + Math.random() * 0.05);
          c.speed = (80 + Math.random() * 120) * dpr;
        } else if (c.dir < 0 && c.x < -mg) {
          c.x = W + c.w * 2;
          c.y = H * (0.83 + Math.random() * 0.05);
          c.speed = (80 + Math.random() * 120) * dpr;
        }
      }

      // ── Update splashes ──
      for (const sp of this.splashes) {
        if (sp.life <= 0) continue;
        sp.x  += sp.vx * dt;
        sp.y  += sp.vy * dt;
        sp.vy += 260 * dpr * dt; // gravity pulls splash back down
        sp.life -= dt * 8;       // ~0.12s lifetime
        if (sp.life < 0) sp.life = 0;
      }

      // ── Draw background ──
      gl.disable(gl.BLEND);
      gl.useProgram(this.bgProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf);
      gl.enableVertexAttribArray(this.bgLoc.a);
      gl.vertexAttribPointer(this.bgLoc.a, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(this.bgLoc.res, W, H);
      gl.uniform1f(this.bgLoc.time, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // ── Build sprite VBO ──
      const buf = this.spData;
      let off = 0;

      for (const r of this.rain)
        off = this._pushStreak(buf, off, r.x, r.y, 1.5*dpr, r.len, r.r, r.g, r.b, r.alpha);

      for (const c of this.cars)
        off = this._drawCar(buf, off, c);

      for (const sp of this.splashes) {
        if (sp.life <= 0) continue;
        const sr = 2.5 * dpr * sp.size;
        off = this._pushCircle(buf, off, sp.x, sp.y, sr, sp.r, sp.g, sp.b, sp.life * 0.60, 2.0);
      }

      // ── Draw sprites ──
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.spProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spBuf);
      gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, off), gl.DYNAMIC_DRAW);

      const bs = STRIDE * 4;
      const L  = this.spLoc;
      gl.enableVertexAttribArray(L.pos);   gl.vertexAttribPointer(L.pos,   2, gl.FLOAT, false, bs,  0);
      gl.enableVertexAttribArray(L.uv);    gl.vertexAttribPointer(L.uv,    2, gl.FLOAT, false, bs,  8);
      gl.enableVertexAttribArray(L.col);   gl.vertexAttribPointer(L.col,   3, gl.FLOAT, false, bs, 16);
      gl.enableVertexAttribArray(L.alpha); gl.vertexAttribPointer(L.alpha, 1, gl.FLOAT, false, bs, 28);
      gl.enableVertexAttribArray(L.soft);  gl.vertexAttribPointer(L.soft,  1, gl.FLOAT, false, bs, 32);

      gl.drawArrays(gl.TRIANGLES, 0, off / STRIDE);
      gl.disable(gl.BLEND);
    }

    start() {}
    stop()  {}

    destroy() {
      const gl = this.gl; if (!gl) return;
      gl.deleteProgram(this.bgProg);
      gl.deleteProgram(this.spProg);
      gl.deleteBuffer(this.bgBuf);
      gl.deleteBuffer(this.spBuf);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.gl = null;
    }
  }

  window.RainyCityNightTheme = RainyCityNightTheme;
})();
