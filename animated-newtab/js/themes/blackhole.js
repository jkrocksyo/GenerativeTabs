(function () {
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

  const FRAG = `precision highp float;
uniform vec2 u_res; uniform float u_time;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
float fbm(vec2 p){ float v=0.,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.03; a*=0.5; } return v; }
vec3 grade(float t){ t=clamp(t,0.,1.);
  vec3 c0=vec3(0.0),c1=vec3(0.55,0.16,0.01),c2=vec3(1.0,0.45,0.04),c3=vec3(1.0,0.72,0.18),c4=vec3(1.0,0.90,0.52),c5=vec3(1.0,1.0,0.93);
  if(t<0.2)return mix(c0,c1,t/0.2);
  else if(t<0.42)return mix(c1,c2,(t-0.2)/0.22);
  else if(t<0.64)return mix(c2,c3,(t-0.42)/0.22);
  else if(t<0.84)return mix(c3,c4,(t-0.64)/0.2);
  return mix(c4,c5,(t-0.84)/0.16); }
mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
void main(){
  vec2 frag=gl_FragCoord.xy;
  vec2 p=(frag-0.5*u_res)/u_res.y;
  float r=length(p); float ang=atan(p.y,p.x);
  float tilt=0.38; float squash=0.28; float Rs=0.205;
  vec2 pr=rot(-tilt)*p;
  vec2 pd=vec2(pr.x,pr.y/squash);
  float rd=length(pd); float ad=atan(pd.y,pd.x);
  vec3 col=vec3(0.0);

  // ── Deep space background (renders behind everything, drifts left→right) ─
  // Parallax drift: distant stars slowest, foreground fastest
  float sd1=u_time*0.0009; float sd2=u_time*0.003; float sd3=u_time*0.007;
  // Layer 1: dense faint distant stars
  vec2 mp1=p-vec2(sd1,0.0);
  vec2 sg1=floor(mp1*280.+vec2(17.3,41.7));
  float sb1=smoothstep(0.988,1.0,hash(sg1));
  vec2 sf1=fract(mp1*280.+vec2(17.3,41.7))-.5;
  col+=vec3(0.85,0.92,1.0)*sb1*exp(-length(sf1)*35.)*0.65;
  // Layer 2: mid-field stars with colour tint variation
  vec2 mp2=p-vec2(sd2,0.0);
  vec2 sg2=floor(mp2*260.+vec2(53.1,87.4));
  float sha2=hash(sg2); float sb2=smoothstep(0.980,1.0,sha2);
  vec2 sf2=fract(mp2*260.+vec2(53.1,87.4))-.5;
  float stc2=hash(sg2+0.5);
  vec3 sc2=stc2<0.6?vec3(1.0,1.0,1.0):stc2<0.82?vec3(0.70,0.84,1.0):vec3(1.0,0.88,0.65);
  col+=sc2*sb2*exp(-length(sf2)*38.)*1.0;
  // Layer 3: sparse bright stars with soft glow and subtle twinkle
  vec2 mp3=p-vec2(sd3,0.0);
  vec2 sg3=floor(mp3*145.+vec2(123.4,67.8));
  float sha3=hash(sg3); float sb3=smoothstep(0.973,1.0,sha3);
  vec2 sf3=fract(mp3*145.+vec2(123.4,67.8))-.5; float sl3=length(sf3);
  float stc3=hash(sg3+0.7);
  vec3 sc3=stc3<0.5?vec3(1.0,1.0,1.0):stc3<0.75?vec3(0.65,0.80,1.0):vec3(1.0,0.87,0.60);
  float tw3=0.88+0.12*sin(u_time*(0.3+sha3*0.7)+sha3*6.28);
  col+=sc3*sb3*tw3*(exp(-sl3*20.)+exp(-sl3*7.)*0.25)*1.6;
  // Subtle deep-space nebula dust (slow drift)
  float sneb=fbm(p*1.6+vec2(-u_time*0.0008+0.3,0.7));
  col+=vec3(0.03,0.02,0.08)*sneb*0.55;

  float flow=u_time*0.33;
  float shear=rd*2.2;
  vec2 sdir=vec2(cos(ad+shear-flow),sin(ad+shear-flow));
  float streak=fbm(sdir*1.2+rd*6.0);
  streak=streak*0.4+0.72;
  float inner=Rs*1.05; float outer=0.82;
  float band=smoothstep(inner,inner+0.018,rd)*(1.0-smoothstep(outer*0.52,outer,rd));
  float hot=mix(2.2,0.55,smoothstep(inner,outer,rd));
  float solidify=1.0-0.45*smoothstep(inner+0.02,outer*0.6,rd);
  float disk=band*streak*hot*solidify;
  float frontMask=smoothstep(0.04,-0.04,pr.y);
  float backMask=1.0-frontMask;
  float emBack=disk*backMask;
  col+=grade(clamp(emBack*0.55,0.,1.))*emBack;
  col*=smoothstep(Rs-0.004,Rs+0.004,r);
  float envB=smoothstep(Rs-0.002,Rs+0.007,r)*(1.0-smoothstep(Rs*1.10,Rs*1.32,r));
  float ringB=envB*streak*1.8;
  col+=grade(clamp(ringB*0.55,0.,1.))*ringB;
  float prd=(r-Rs)/0.006;
  float pflow=0.78+0.42*fbm(vec2(cos(ang),sin(ang))*2.0+flow);
  float pring=exp(-prd*prd)*pflow;
  col+=grade(0.95)*pring*2.0;
  float emFront=disk*frontMask;
  col+=grade(clamp(emFront*0.55,0.,1.))*emFront;
  float bloom=exp(-r*3.0)*0.45+exp(-abs(pr.y)*9.0)*exp(-max(0.0,r-Rs)*4.0)*0.3;
  col+=grade(0.8)*bloom*0.55;
  vec2 q=(frag/u_res-0.5); q.x*=u_res.x/u_res.y;
  col*=smoothstep(1.0,0.25,length(q));
  col*=1.3; col=col/(col+vec3(1.0)); col=pow(col,vec3(0.82));
  col+=(hash(frag+u_time)-0.5)/255.0;
  gl_FragColor=vec4(col,1.0);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }

  class BlackHoleTheme {
    constructor() { this.contextType = 'webgl'; }

    init(canvas, _ctx, options) {
      this.canvas = canvas;
      this.opts = options || {};
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      this.gl = gl; if (!gl) return;
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog); gl.useProgram(prog);
      this.prog = prog;
      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
      const al = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(al);
      gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
      this.uRes  = gl.getUniformLocation(prog, 'u_res');
      this.uTime = gl.getUniformLocation(prog, 'u_time');
      this.t = 0;
      this.resize(canvas.clientWidth, canvas.clientHeight);
    }

    resize(w, h) {
      if (!this.gl) return;
      this.canvas.width  = Math.max(1, Math.floor(w * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(h * this.dpr));
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    draw(ts) {
      const gl = this.gl; if (!gl) return;
      if (!this._t0) this._t0 = ts;
      this.t = (ts - this._t0) / 1000;
      gl.useProgram(this.prog);
      gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uTime, this.t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    start() {}
    stop()  {}

    destroy() {
      const gl = this.gl; if (!gl) return;
      gl.deleteBuffer(this.buf);
      gl.deleteProgram(this.prog);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      this.gl = null;
    }
  }

  window.BlackHoleTheme = BlackHoleTheme;
})();
