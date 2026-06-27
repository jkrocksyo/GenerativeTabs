(function () {
  'use strict';

  const BG_VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0,1);}';

  const BG_FRAG = `precision mediump float;
uniform vec2 u_res;
uniform float u_time;

float hash(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+45.32);return fract(p.x*p.y);}

// Layered sin-based wet-surface distortion
vec2 wetDistort(vec2 uv,float t){
  vec2 d=vec2(0.);
  float a=0.0038,f=2.7;
  d+=a*vec2(sin(uv.x*f+t*.34+1.7),cos(uv.y*f+t*.27));      a*=.5;f*=2.1;
  d+=a*vec2(sin(uv.x*f+t*.63+3.1),cos(uv.y*f+t*.49+1.4));  a*=.5;f*=2.2;
  d+=a*vec2(sin(uv.x*f+t*.91+5.2),cos(uv.y*f+t*.78+2.8));
  return d;
}

void main(){
  vec2 uv=gl_FragCoord.xy/u_res;
  float t=u_time;

  // ── Wet-surface distortion ─────────────────────────────────────────────────
  vec2 dUV=uv+wetDistort(uv,t);

  // ── Perspective ray → ground intersection ──────────────────────────────────
  // Camera at y=1 looking mostly down, phi=0.20 forward tilt
  vec2 ndc=dUV*2.-1.;
  float phi=0.20,cp=cos(phi),sp=sin(phi),tanFov=0.65;
  // Ray in world space (y up):
  //   screenUp = (0, sin(phi), cos(phi))
  //   right    = (1, 0, 0)
  //   forward  = (0,-cos(phi), sin(phi))
  float ry=-cp+ndc.y*sp*tanFov;
  float rx= ndc.x*tanFov;
  float rz= sp+ndc.y*cp*tanFov;
  float gT=min(-1./min(ry,-.001),40.); // distance to ground (camera h=1)
  vec2 gp=vec2(rx,rz)*gT;              // world XZ ground position

  // ── Street grid ────────────────────────────────────────────────────────────
  float freq=3.2;
  vec2 cell=gp*freq;
  vec2 cellF=fract(cell);
  vec2 cellId=floor(cell);
  vec2 dLine=min(cellF,1.-cellF); // distance from nearest street line (0=on line)
  float streetW=0.10,aaW=0.035;
  float sX=1.-smoothstep(streetW-aaW,streetW+aaW,dLine.x);
  float sZ=1.-smoothstep(streetW-aaW,streetW+aaW,dLine.y);
  float isStreet=max(sX,sZ);
  float notStreet=1.-isStreet;

  // ── Base city colors ───────────────────────────────────────────────────────
  vec3 blockCol=vec3(.031,.031,.055);  // #080810 dark blue-black
  vec3 streetCol=vec3(.110,.085,.045); // warm dark brown
  vec3 col=mix(blockCol,streetCol,isStreet);
  col+=vec3(.085,.062,.028)*isStreet*isStreet; // faint amber street glow

  // ── Window dots in blocks ──────────────────────────────────────────────────
  vec2 bUV=clamp((cellF-streetW)/(1.-2.*streetW),0.,1.); // position inside block
  vec2 sub=bUV*5.;
  vec2 subId=floor(sub)+cellId*5.;
  vec2 subF=fract(sub)-.5; // centered -0.5..0.5
  float lit=step(.88,hash(subId*.13+vec2(5.,3.)));
  float inWin=step(abs(subF.x),.28)*step(abs(subF.y),.28);
  float wct=hash(subId*.07);
  vec3 wc=wct<.55?vec3(1.,.87,.60):wct<.85?vec3(.78,.88,1.):vec3(.50,.90,.55);
  col+=wc*.060*notStreet*lit*inWin;

  // ── Neon light pools at intersections (4 nearest) ──────────────────────────
  for(int di=0;di<=1;di++){
    for(int dj=0;dj<=1;dj++){
      vec2 iId=floor(cell)+vec2(float(di),float(dj));
      vec2 iPos=iId/freq;
      float dist=length(gp-iPos);
      float poolR=0.13;
      float glow=max(0.,1.-dist/poolR); glow=glow*glow;
      float ch=hash(iId*.11+vec2(1.3,2.7));
      float neonMask=step(.67,ch); // ~33% of intersections lit
      float ph=ch*6.28;
      float pulse=.85+.15*sin(t*(.38+ch*.52)+ph);
      vec3 nc=ch<.78?vec3(1.,.126,.376):ch<.89?vec3(0.,.831,1.):vec3(1.,.549,.125);
      col+=nc*glow*.32*pulse*neonMask;
    }
  }

  // ── Car light trails (12 cars, pure math) ─────────────────────────────────
  // Street lines at world pos k/freq for integer k; cars ride on these lines.
  for(int i=0;i<12;i++){
    float fi=float(i);
    float h1=hash(vec2(fi,7.3));
    float h2=hash(vec2(fi,13.7));
    float h3=hash(vec2(fi,19.1));
    float speed=.06+h1*.11;
    float dir=h2<.5?1.:-1.;
    bool xAxis=mod(fi,4.)<2.; // x-moving vs z-moving

    // Which street: integer index maps to street at world = streetIdx/freq
    float streetIdx=floor(mod(fi*.5,5.))-2.; // -2,-1,0,1,2 → 5 streets
    float streetPos=streetIdx/freq;

    vec2 carPos,carDir;
    if(xAxis){
      float cx=mod(dir*t*speed+h3*2.,2.)-1.;
      carPos=vec2(cx,streetPos);
      carDir=vec2(dir,0.);
    } else {
      float cz=mod(dir*t*speed+h3*3.,3.)-1.;
      carPos=vec2(streetPos,cz);
      carDir=vec2(0.,dir);
    }

    vec2 rel=gp-carPos;
    float dLong=dot(rel,carDir);            // signed: + ahead, - behind
    float dLat=rel.x*carDir.y-rel.y*carDir.x; // perpendicular

    // Tight glow dot (headlights visible from above)
    float dotGlow=exp(-(dLong*dLong+dLat*dLat)/.00010);

    // Streak tail behind the car; aheadSq kills the glow in front
    float aheadSq=max(0.,dLong)*max(0.,dLong);
    float behindDist=max(0.,-dLong);
    float streakGlow=exp(-(dLat*dLat/.000035+behindDist*behindDist/.0055+aheadSq/.000025));

    vec3 headCol=vec3(1.,.96,.82);  // pale yellow-white headlights
    vec3 tailCol=vec3(.95,.05,.02); // deep red taillights
    col+=headCol*dotGlow*.28+tailCol*streakGlow*.11;
  }

  // ── Rain noise (diagonal animated stripe field) ────────────────────────────
  float rainPhase=fract(dUV.x*44.-dUV.y*15.-t*9.8);
  col+=vec3(step(.962,rainPhase)*.085);

  // ── Atmospheric fog (far distance) ────────────────────────────────────────
  float fogT=smoothstep(6.,13.,gT);
  vec3 fogCol=vec3(.078,.094,.125); // #141820
  col=mix(col,fogCol,fogT*.65);

  // ── Cloud shadow (slow large-scale FBM over world) ────────────────────────
  float cx2=gp.x*.65+t*.022;
  float cz2=gp.y*.50+t*.016;
  float cloud=.5+.22*sin(cx2*1.4+.7)+.15*sin(cz2*2.2+1.2)
              +.09*sin(cx2*2.9+cz2*2.5+2.1)+.04*sin(cx2*5.3+cz2*4.1+.8);
  col*=(.89+.11*cloud); // ±11% luminance variation

  // ── Atmospheric perspective: far edge fades to haze ───────────────────────
  float topFade=smoothstep(.55,1.,uv.y)*.14;
  col+=vec3(.050,.065,.110)*topFade;

  // ── Cinematic color grade ─────────────────────────────────────────────────
  float br=dot(col,vec3(.299,.587,.114));
  col+=vec3(0.,.055,.095)*(1.-br)*.09;                              // cyan push in shadows
  col+=vec3(.07,.045,0.)*smoothstep(.1,.5,br)*smoothstep(.9,.5,br)*.10; // amber midtones

  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

  // ─── WebGL helpers ────────────────────────────────────────────────────────
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('AerialCityNight shader:', gl.getShaderInfoLog(s));
    return s;
  }
  function mkProg(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    return p;
  }

  class AerialCityNightTheme {
    constructor() { this.contextType = 'webgl'; }

    init(canvas, _ctx, opts) {
      this.canvas  = canvas;
      this.dpr     = Math.min(window.devicePixelRatio || 1, 2);
      this.speed   = (opts && opts.speed) || 1.0;
      this._lastTs = null;
      this._scaledTime = 0;
      this.W = 1; this.H = 1;

      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      this.gl = gl;
      if (!gl) return;

      this.prog = mkProg(gl, BG_VERT, BG_FRAG);

      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);

      this.loc = {
        a:    gl.getAttribLocation(this.prog, 'a'),
        res:  gl.getUniformLocation(this.prog, 'u_res'),
        time: gl.getUniformLocation(this.prog, 'u_time'),
      };

      this.resize(canvas.width, canvas.height);
    }

    resize(w, h) {
      this.W = Math.max(1, w);
      this.H = Math.max(1, h);
      if (this.gl) this.gl.viewport(0, 0, this.W, this.H);
    }

    draw(ts) {
      const gl = this.gl; if (!gl) return;
      const rawDt = this._lastTs ? Math.min((ts - this._lastTs) / 1000, 0.05) : 0;
      this._lastTs = ts;
      this._scaledTime += rawDt * (this.speed || 1);
      const t = this._scaledTime;

      gl.useProgram(this.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.enableVertexAttribArray(this.loc.a);
      gl.vertexAttribPointer(this.loc.a, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(this.loc.res, this.W, this.H);
      gl.uniform1f(this.loc.time, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    start() {}
    stop()  {}

    destroy() {
      const gl = this.gl; if (!gl) return;
      gl.deleteProgram(this.prog);
      gl.deleteBuffer(this.buf);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.gl = null;
    }
  }

  window.AerialCityNightTheme = AerialCityNightTheme;
})();
