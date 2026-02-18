// ========================================
// Navigation
// ========================================

const nav = document.getElementById('nav');
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.querySelector('.nav-links');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
});

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  navToggle.classList.toggle('active');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('active');
  });
});

// ========================================
// Scroll animations (Intersection Observer)
// ========================================

const observerOptions = {
  root: null,
  rootMargin: '0px 0px -60px 0px',
  threshold: 0.1,
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animationPlayState = 'running';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.timeline-item').forEach(item => {
  item.style.animationPlayState = 'paused';
  observer.observe(item);
});

// ========================================
// Hero canvas — raytraced Chmutov surface
// ========================================

(function () {
  const canvas = document.getElementById('hero-canvas');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return;

  /* =============== SHADERS =============== */

  const VERT = `attribute vec2 a_pos;
    void main(){gl_Position=vec4(a_pos,0,1);}`;

  /* --- Scene: Chmutov raytracer + env bg --- */
  const SCENE_FRAG = `precision highp float;
    uniform float u_time;
    uniform vec2  u_res;

    float T6(float x){float x2=x*x;return x2*(x2*(32.0*x2-48.0)+18.0)-1.0;}
    float surf(vec3 p){return T6(p.x)+T6(p.y)+T6(p.z);}
    vec3 calcNormal(vec3 p){
      vec2 e=vec2(0.001,0.0);
      return normalize(vec3(surf(p+e.xyy)-surf(p-e.xyy),
        surf(p+e.yxy)-surf(p-e.yxy),surf(p+e.yyx)-surf(p-e.yyx)));}
    vec2 boxHit(vec3 ro,vec3 rd,vec3 b){
      vec3 inv=1.0/rd,t1=(-b-ro)*inv,t2=(b-ro)*inv,
        mn=min(t1,t2),mx=max(t1,t2);
      return vec2(max(max(mn.x,mn.y),mn.z),min(min(mx.x,mx.y),mx.z));}
    mat3 rotY(float a){float s=sin(a),c=cos(a);return mat3(c,0,s,0,1,0,-s,0,c);}
    mat3 rotX(float a){float s=sin(a),c=cos(a);return mat3(1,0,0,0,c,-s,0,s,c);}
    float hash21(vec2 p){p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
    vec2 sphereUV(vec3 p){vec3 n=normalize(p);
      return vec2(atan(n.z,n.x)*0.15915+0.5,asin(clamp(n.y,-1.0,1.0))*0.31831+0.5);}

    vec4 cellTexture(vec2 uv,float time){
      float gs=14.0;vec2 cuv=fract(uv*gs);float lw=0.04;
      float gx=smoothstep(0.0,lw,cuv.x)*smoothstep(0.0,lw,1.0-cuv.x);
      float gy=smoothstep(0.0,lw,cuv.y)*smoothstep(0.0,lw,1.0-cuv.y);
      float grid=1.0-gx*gy;
      vec3 em=vec3(0.0);

      /* Offset squares */
      vec2 suv=uv*11.0+vec2(0.37,0.23);vec2 sc=floor(suv);vec2 scuv=fract(suv);
      float h1=hash21(sc),h2=hash21(sc+73.0),h3=hash21(sc+157.0),h4=hash21(sc+241.0);
      float fl=sin(time*(0.4+h1*2.5)+h2*6.2832);
      float sz=0.15+0.35*(0.5+0.5*sin(time*(0.2+h3*0.8)+h4*6.2832));
      vec2 ctr=vec2(0.25+0.5*h2,0.25+0.5*h3);
      float sq=step(abs(scuv.x-ctr.x),sz*(0.5+0.9*h4))
              *step(abs(scuv.y-ctr.y),sz*(0.5+0.9*h1))
              *step(-0.1,fl)*step(0.15,h1);
      vec3 sqC=mix(mix(vec3(0.85,0.9,1),vec3(0,0.83,0.67),step(0.3,h1)),
        vec3(0.3,0.28,0.9),step(0.6,h1));
      em+=sq*sqC*(0.4+0.6*(0.5+0.5*fl));

      /* Horizontal bars — 4 layers */
      for(int hL=0;hL<4;hL++){
        float hO=float(hL)*5.13;
        float hR=floor(uv.y*16.0+hO),hyf=fract(uv.y*16.0+hO);
        float hh1=hash21(vec2(hR,42.0+hO)),hh2=hash21(vec2(hR,99.0+hO)),hh3=hash21(vec2(hR,177.0+hO));
        float hF=sin(time*(0.3+hh1*3.0)+hh2*6.28);
        float hS=hh2*0.3,hE=hS+0.25+hh3*0.5;
        float hB=smoothstep(0.0,0.02,0.08-abs(hyf-0.5))*step(hS,uv.x)*step(uv.x,hE)
                 *step(0.35,hh1)*step(-0.2,hF);
        em+=hB*mix(vec3(0.6,0.85,1),vec3(0,1,0.85),hh3)*(1.6+0.8*hF);
      }
      /* Vertical bars — 4 layers */
      for(int vL=0;vL<4;vL++){
        float vO=float(vL)*6.37;
        float vC=floor(uv.x*18.0+vO),vxf=fract(uv.x*18.0+vO);
        float vh1=hash21(vec2(vC,137.0+vO)),vh2=hash21(vec2(vC,211.0+vO)),vh3=hash21(vec2(vC,293.0+vO));
        float vF=sin(time*(0.4+vh1*2.5)+vh2*6.28);
        float vS=vh2*0.3,vE=vS+0.25+vh3*0.5;
        float vB=smoothstep(0.0,0.02,0.06-abs(vxf-0.5))*step(vS,uv.y)*step(uv.y,vE)
                 *step(0.35,vh1)*step(-0.2,vF);
        em+=vB*mix(vec3(0.7,0.7,1),vec3(0,0.95,0.8),vh3)*(1.6+0.8*vF);
      }
      return vec4(em,grid);
    }

    void main(){
      vec2 uv=(gl_FragCoord.xy-0.5*u_res)/min(u_res.x,u_res.y);
      float t=u_time*0.15;
      mat3 rot=rotY(t)*rotX(t*0.618);
      vec3 ro=rot*vec3(0,0,2.4);
      vec3 fwd=normalize(-ro),rgt=normalize(cross(fwd,rot*vec3(0,1,0))),up=cross(rgt,fwd);
      vec3 rd=normalize(fwd*1.3+rgt*uv.x+up*uv.y);
      vec2 bb=boxHit(ro,rd,vec3(1.05));

      /* Bright environment background */
      vec3 col=vec3(0.75,0.78,0.85);
      float yg=0.5+0.5*rd.y;
      col+=mix(vec3(0.0,0.05,0.08),vec3(0.1,0.05,0.15),yg);
      float cl1=sin(rd.x*2.5+0.3)*sin(rd.y*3.5-0.5)*sin(rd.z*2.0+u_time*0.04);
      float cl2=sin(rd.x*1.8-1.0+u_time*0.03)*sin(rd.y*2.2+0.7)*sin(rd.z*2.5);
      float cl3=sin(rd.x*3.2+0.7+u_time*0.05)*sin(rd.y*1.8-0.3)*sin(rd.z*3.0+0.5);
      col+=vec3(0.08,0.03,0.12)*smoothstep(0.1,0.7,cl1);
      col+=vec3(0.02,0.1,0.07)*smoothstep(0.15,0.75,cl2);
      col+=vec3(0.05,0.02,0.08)*smoothstep(0.2,0.8,cl3);

      if(bb.x<bb.y&&bb.y>0.0){
        float tN=max(bb.x,0.001),tF=bb.y,dt=(tF-tN)/80.0;
        float prev=surf(ro+rd*tN);vec3 hitPos;bool hit=false;float glow=0.0;
        for(int i=1;i<=80;i++){
          float tc=tN+dt*float(i);vec3 p=ro+rd*tc;float val=surf(p);
          glow+=0.012/(1.0+abs(val)*12.0);
          if(prev*val<0.0){
            float a=tc-dt,b=tc,fa=prev;
            for(int j=0;j<8;j++){float mid=0.5*(a+b);float fm=surf(ro+rd*mid);
              if(fa*fm<0.0){b=mid;}else{a=mid;fa=fm;}}
            hitPos=ro+rd*0.5*(a+b);hit=true;break;}
          prev=val;}
        vec3 purple=vec3(0.42,0.39,1),cyan=vec3(0,0.83,0.67);
        if(hit){
          vec3 n=calcNormal(hitPos),v=-rd;
          vec3 l1=normalize(vec3(1,1.2,0.8)),l2=normalize(vec3(-0.6,-0.3,-1));
          float d1=max(dot(n,l1),0.0),d2=max(dot(n,l2),0.0);
          float spec=pow(max(dot(n,normalize(l1+v)),0.0),48.0);
          float fres=pow(1.0-abs(dot(n,v)),3.0);
          vec3 base=mix(purple,cyan,0.5+0.5*dot(n,rot*vec3(0,1,0)));
          col=base*(d1*0.45+d2*0.12+0.08);
          col+=spec*vec3(0.9,0.9,1)*0.5;
          col+=fres*mix(purple,cyan,0.5+0.3*sin(u_time*0.25))*0.45;
          vec2 texUV=sphereUV(hitPos);vec4 tex=cellTexture(texUV,u_time);
          col+=vec3(0.06,0.1,0.35)*tex.a;
          col+=tex.rgb*0.45;
          float fogD=length(hitPos-ro);
          col=mix(col,vec3(0.8,0.82,0.88),smoothstep(1.2,3.6,fogD)*0.35);}
        col+=glow*mix(purple,cyan,0.4)*0.1;}
      /* Output half-brightness for HDR headroom in UNSIGNED_BYTE FBO */
      gl_FragColor=vec4(col*0.5,1.0);}`;

  /* --- Bright-pass: threshold for bloom --- */
  const BRIGHT_FRAG = `precision highp float;
    uniform sampler2D u_tex;
    uniform vec2 u_res;
    void main(){
      vec2 uv=gl_FragCoord.xy/u_res;
      vec3 c=texture2D(u_tex,uv).rgb;
      float lum=dot(c,vec3(0.299,0.587,0.114));
      c*=smoothstep(0.08,0.25,lum);
      gl_FragColor=vec4(c,1.0);}`;

  /* --- Separable Gaussian blur (9-tap, wide) --- */
  const BLUR_FRAG = `precision highp float;
    uniform sampler2D u_tex;
    uniform vec2 u_res;
    uniform vec2 u_dir;
    void main(){
      vec2 uv=gl_FragCoord.xy/u_res;
      vec3 c=texture2D(u_tex,uv).rgb*0.227027;
      c+=(texture2D(u_tex,uv+u_dir).rgb+texture2D(u_tex,uv-u_dir).rgb)*0.1945946;
      c+=(texture2D(u_tex,uv+u_dir*2.0).rgb+texture2D(u_tex,uv-u_dir*2.0).rgb)*0.1216216;
      c+=(texture2D(u_tex,uv+u_dir*3.0).rgb+texture2D(u_tex,uv-u_dir*3.0).rgb)*0.054054;
      c+=(texture2D(u_tex,uv+u_dir*4.0).rgb+texture2D(u_tex,uv-u_dir*4.0).rgb)*0.016216;
      gl_FragColor=vec4(c,1.0);}`;

  /* --- Composite: scene + bloom, tonemap, gamma --- */
  const COMP_FRAG = `precision highp float;
    uniform sampler2D u_scene;
    uniform sampler2D u_bloom;
    uniform vec2 u_res;
    void main(){
      vec2 uv=gl_FragCoord.xy/u_res;
      vec3 c=texture2D(u_scene,uv).rgb*2.0;
      c+=texture2D(u_bloom,uv).rgb*3.0;
      vec2 vc=uv-0.5;c*=1.0-0.35*dot(vc,vc);
      c=c/(c+0.8);c=pow(c,vec3(0.92));
      gl_FragColor=vec4(c,1.0);}`;

  /* =============== UTILITIES =============== */

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s); return null;
    }
    return s;
  }

  function createProg(fSrc) {
    const v = compileShader(gl.VERTEX_SHADER, VERT);
    const f = compileShader(gl.FRAGMENT_SHADER, fSrc);
    if (!v || !f) return null;
    const p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('Link error:', gl.getProgramInfoLog(p)); return null;
    }
    return p;
  }

  function makeFBO(width, height) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb };
  }

  function destroyFBO(fbo) {
    if (!fbo) return;
    gl.deleteTexture(fbo.tex);
    gl.deleteFramebuffer(fbo.fb);
  }

  /* =============== PROGRAMS =============== */

  const pScene = createProg(SCENE_FRAG);
  const pBright = createProg(BRIGHT_FRAG);
  const pBlur = createProg(BLUR_FRAG);
  const pComp = createProg(COMP_FRAG);
  if (!pScene || !pBright || !pBlur || !pComp) return;

  /* Uniform locations */
  const loc = {
    sTime: gl.getUniformLocation(pScene, 'u_time'),
    sRes:  gl.getUniformLocation(pScene, 'u_res'),
    bTex:  gl.getUniformLocation(pBright, 'u_tex'),
    bRes:  gl.getUniformLocation(pBright, 'u_res'),
    lTex:  gl.getUniformLocation(pBlur, 'u_tex'),
    lRes:  gl.getUniformLocation(pBlur, 'u_res'),
    lDir:  gl.getUniformLocation(pBlur, 'u_dir'),
    cScene: gl.getUniformLocation(pComp, 'u_scene'),
    cBloom: gl.getUniformLocation(pComp, 'u_bloom'),
    cRes:   gl.getUniformLocation(pComp, 'u_res'),
  };

  /* =============== QUAD =============== */

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function quad() { gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

  /* =============== FBOs =============== */

  let w, h, bw, bh, fboScene, fboBloomA, fboBloomB, needFBOs = true;

  function rebuildFBOs() {
    destroyFBO(fboScene); destroyFBO(fboBloomA); destroyFBO(fboBloomB);
    fboScene  = makeFBO(w, h);
    bw = Math.max(w >> 1, 1); bh = Math.max(h >> 1, 1);
    fboBloomA = makeFBO(bw, bh);
    fboBloomB = makeFBO(bw, bh);
    needFBOs = false;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const nw = (canvas.clientWidth * dpr) | 0;
    const nh = (canvas.clientHeight * dpr) | 0;
    if (canvas.width !== nw || canvas.height !== nh) {
      canvas.width = w = nw;
      canvas.height = h = nh;
      needFBOs = true;
    }
  }

  /* =============== VISIBILITY =============== */

  let visible = true;
  new IntersectionObserver(
    (e) => { visible = e[0].isIntersecting; },
    { threshold: 0 }
  ).observe(canvas);

  /* =============== RENDER LOOP =============== */

  const BLUR_SCALE = 2.5; // wider = softer bloom

  function frame(ms) {
    if (visible) {
      resize();
      if (needFBOs) rebuildFBOs();
      const time = ms * 0.001;

      /* 1. Scene → FBO */
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboScene.fb);
      gl.viewport(0, 0, w, h);
      gl.useProgram(pScene);
      gl.uniform1f(loc.sTime, time);
      gl.uniform2f(loc.sRes, w, h);
      quad();

      /* 2. Bright-pass → bloom A (half res) */
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboBloomA.fb);
      gl.viewport(0, 0, bw, bh);
      gl.useProgram(pBright);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fboScene.tex);
      gl.uniform1i(loc.bTex, 0);
      gl.uniform2f(loc.bRes, bw, bh);
      quad();

      /* 3–4. Two-pass Gaussian blur (iteration 1) */
      gl.useProgram(pBlur);
      gl.uniform1i(loc.lTex, 0);
      gl.uniform2f(loc.lRes, bw, bh);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fboBloomB.fb);
      gl.bindTexture(gl.TEXTURE_2D, fboBloomA.tex);
      gl.uniform2f(loc.lDir, BLUR_SCALE / bw, 0);
      quad();

      gl.bindFramebuffer(gl.FRAMEBUFFER, fboBloomA.fb);
      gl.bindTexture(gl.TEXTURE_2D, fboBloomB.tex);
      gl.uniform2f(loc.lDir, 0, BLUR_SCALE / bh);
      quad();

      /* 5–6. Blur iteration 2 for wider bloom */
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboBloomB.fb);
      gl.bindTexture(gl.TEXTURE_2D, fboBloomA.tex);
      gl.uniform2f(loc.lDir, BLUR_SCALE / bw, 0);
      quad();

      gl.bindFramebuffer(gl.FRAMEBUFFER, fboBloomA.fb);
      gl.bindTexture(gl.TEXTURE_2D, fboBloomB.tex);
      gl.uniform2f(loc.lDir, 0, BLUR_SCALE / bh);
      quad();

      /* 7. Composite → screen */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(pComp);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fboScene.tex);
      gl.uniform1i(loc.cScene, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fboBloomA.tex);
      gl.uniform1i(loc.cBloom, 1);
      gl.uniform2f(loc.cRes, w, h);
      quad();
    }
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();

