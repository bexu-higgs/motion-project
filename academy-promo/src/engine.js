// Liquid-glass WebGL2 renderer.
// Everything is a pure function of time: scenes.js builds a frame description
// (camera + sprite list) and Engine.draw() turns it into pixels.
//
// Layers, in compositing order:
//   bg      procedural wallpaper (gradient + drifting light blobs + ripples)
//   frost   frosted glass panels: refract a blurred copy of the wallpaper
//   content flat RGBA things that sit on panels (labels, screenshots, fills)
//   glass   clear thick glass (headlines, sphere, drops): refract everything below
//   overlay additive light (particles, rays, glows)
'use strict';

window.Engine = (() => {
  let gl, canvas, W, H, DW, DH, TS;
  const P = {};            // shader programs
  const T = {};            // render targets
  let quad, tri;
  const texCache = new Map();

  // ---------------------------------------------------------------- math
  const M4 = {
    ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
          o[c * 4 + r] = s;
        }
      return o;
    },
    persp(fovy, asp, n, f) {
      const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
      return o;
    },
    lookAt(e, c, u) {
      let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
      let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
      let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
      l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
        -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
    },
    T: (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]),
    S: (x, y, z) => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]),
    RX(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); },
    RY(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); },
    RZ(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  };
  const D2R = Math.PI / 180;

  // local transform of a node {x,y,z,rx,ry,rz (deg), s, sx, sy, px, py (pivot)}
  function localM(o) {
    let m = M4.T(o.x || 0, o.y || 0, o.z || 0);
    if (o.ry) m = M4.mul(m, M4.RY(o.ry * D2R));
    if (o.rx) m = M4.mul(m, M4.RX(o.rx * D2R));
    if (o.rz) m = M4.mul(m, M4.RZ(o.rz * D2R));
    const s = o.s == null ? 1 : o.s;
    const sx = s * (o.sx == null ? 1 : o.sx), sy = s * (o.sy == null ? 1 : o.sy);
    if (sx !== 1 || sy !== 1) m = M4.mul(m, M4.S(sx, sy, s));
    if (o.px || o.py) m = M4.mul(m, M4.T(-(o.px || 0), -(o.py || 0), 0));
    return m;
  }
  function worldM(o) {
    const m = localM(o);
    return o.parent ? M4.mul(worldM(o.parent), m) : m;
  }
  function parentOpacity(o) {
    let a = 1, p = o.parent;
    while (p) { if (p.opacity != null) a *= p.opacity; p = p.parent; }
    return a;
  }

  // ---------------------------------------------------------------- GL utils
  function compile(vs, fs) {
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const locs = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      locs[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
    }
    return { p, u: locs };
  }
  function target(w, h, fmts) {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const texs = fmts.map((f, i) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, f, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
      return t;
    });
    gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO incomplete ' + st);
    return { fbo, texs, w, h };
  }
  function bindTarget(t) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
    gl.viewport(0, 0, t ? t.w : W, t ? t.h : H);
  }
  function useTex(prog, name, unit, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.u[name], unit);
  }
  function fullscreen(prog) {
    gl.bindVertexArray(tri);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------------------------------------------------------------- shaders
  const VS_FULL = `#version 300 es
  layout(location=0) in vec2 aPos; out vec2 vUv;
  void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

  const VS_SPRITE = `#version 300 es
  layout(location=0) in vec2 aPos;
  uniform mat4 uMVP; uniform vec2 uHalf; uniform vec2 uCenter;
  out vec2 vLocal;
  void main(){ vLocal = uCenter + aPos*2.0*uHalf; gl_Position = uMVP*vec4(vLocal,0.,1.); }`;

  const SDF_LIB = `
  float sdRRect(vec2 p, vec2 b, float r){ r=min(r,min(b.x,b.y)); vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
  float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.); return length(pa-ba*h); }
  float smin(float a, float b, float k){ float h=max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*0.25; }
  `;

  // background wallpaper
  const FS_BG = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform float uT; uniform vec2 uDesign; uniform vec2 uCam; uniform float uBright;
  uniform vec4 uRip[8]; uniform int uNR;
  vec3 glow(vec2 q, vec2 c, float r){ vec2 d = q-c; return vec3(exp(-dot(d,d)/r)); }
  vec3 wall(vec2 p){
    // iOS dark wallpaper: black, with slow purple and green light
    float t = uT;
    float ax = uDesign.x/uDesign.y/1.7778;          // keep glows in frame for 9:16
    vec2 q = p + 0.025*vec2(sin(p.y*2.3 + t*0.17), cos(p.x*2.1 - t*0.13));
    vec3 col = vec3(0.010, 0.010, 0.016);
    col += vec3(0.020, 0.012, 0.040) * (0.6 - p.y);                                   // faint violet wash from the top
    col += vec3(0.47, 0.22, 1.00) * 0.42 * glow(q, vec2((-0.58 + 0.10*sin(t*0.11))*ax,  0.34 + 0.07*cos(t*0.09)), 0.11);
    col += vec3(0.33, 0.12, 0.72) * 0.30 * glow(q, vec2(( 0.62 + 0.09*cos(t*0.08))*ax,  0.46 + 0.05*sin(t*0.12)), 0.13);
    col += vec3(0.62, 0.95, 0.22) * 0.24 * glow(q, vec2(( 0.50 + 0.12*sin(t*0.07+1.0))*ax, -0.46 + 0.05*cos(t*0.15)), 0.07);
    col += vec3(0.20, 0.80, 0.45) * 0.10 * glow(q, vec2((-0.72 + 0.08*cos(t*0.10))*ax, -0.52 + 0.04*sin(t*0.13)), 0.07);
    col += vec3(0.55, 0.25, 0.95) * 0.08 * glow(q, vec2(( 0.05 + 0.20*sin(t*0.05))*ax, -0.05), 0.20);
    return col;
  }
  void main(){
    vec2 p = (vUv-0.5)*uDesign/uDesign.y;
    p -= uCam*0.06/uDesign.y;
    vec2 disp = vec2(0); float crest = 0.0;
    for (int i=0;i<8;i++){
      if (i>=uNR) break;
      vec4 r = uRip[i];          // x,y (normalized like p), age (s), amplitude
      vec2 d = p - r.xy; float dist = length(d); float age = r.z;
      if (age <= 0.0) continue;
      float front = age*0.55;
      float x = dist - front;
      float env = exp(-x*x/0.012) * exp(-age*1.1) * r.w;
      float wv = sin(x*48.0) * env;
      disp += normalize(d+1e-5) * wv * 0.012;
      crest += cos(x*48.0) * env;
    }
    vec3 col = wall(p + disp);
    col += crest*0.035*vec3(0.75,0.65,1.0);
    o = vec4(col*uBright, 1.0);
  }`;

  const FS_DOWN = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel;
  void main(){ vec4 c = texture(uSrc, vUv+uTexel*vec2(-0.5,-0.5)) + texture(uSrc, vUv+uTexel*vec2(0.5,-0.5)) + texture(uSrc, vUv+uTexel*vec2(-0.5,0.5)) + texture(uSrc, vUv+uTexel*vec2(0.5,0.5)); o = c*0.25; }`;

  // separable gaussian, 13 taps (linear-sampled 25-wide kernel)
  const FS_BLUR = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uDir;
  void main(){
    float w[7] = float[](0.1176,0.2215,0.1700,0.1050,0.0520,0.0205,0.0065);
    vec4 c = texture(uSrc, vUv)*w[0];
    for(int i=1;i<7;i++){ float off = float(i)*2.0-0.5; c += (texture(uSrc, vUv+uDir*off)+texture(uSrc, vUv-uDir*off))*w[i]; }
    o = c/ (w[0] + 2.0*(0.2215+0.1700+0.1050+0.0520+0.0205+0.0065));
  }`;

  // coverage of both glass layers -> RG, for shadows
  const FS_COV = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uA, uB; uniform vec2 uTexel;
  float s(sampler2D t){ return 0.25*(texture(t,vUv+uTexel*vec2(-1,-1)).a+texture(t,vUv+uTexel*vec2(1,-1)).a+texture(t,vUv+uTexel*vec2(-1,1)).a+texture(t,vUv+uTexel*vec2(1,1)).a); }
  void main(){ o = vec4(s(uA), s(uB), 0., 1.); }`;

  // write glass G-buffer (normal.xy, height, coverage) + tint
  const FS_GBUF = `#version 300 es
  precision highp float;
  in vec2 vLocal;
  layout(location=0) out vec4 o0; layout(location=1) out vec4 o1;
  uniform int uKind; uniform vec4 uP0, uP1, uP2; uniform vec2 uPts[48]; uniform int uN;
  uniform sampler2D uTex; uniform vec2 uTexHalf;
  uniform mat3 uRot; uniform float uDepth, uOpacity, uRefrK; uniform vec4 uTint;
  ${SDF_LIB}
  // signed distance + its gradient (analytic where cheap)
  float sdfg(vec2 p, out float bevel, out vec2 grad){
    if (uKind==1){ // rounded rect (+ optional circular hole)
      bevel = uP0.w;
      vec2 b = uP0.xy; float r = min(uP0.z, min(b.x,b.y));
      vec2 sp = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
      vec2 q = abs(p)-b+r;
      float d;
      if (q.x > 0.0 && q.y > 0.0){ float l = length(q); d = l - r; grad = sp*q/max(l,1e-5); }
      else if (q.x > q.y){ d = q.x - r; grad = vec2(sp.x, 0.0); }
      else { d = q.y - r; grad = vec2(0.0, sp.y); }
      if (uP1.z > 0.0){
        vec2 hp = p-uP1.xy; float hl = length(hp); float dh = -(hl-uP1.z);
        if (dh > d){ d = dh; grad = -hp/max(hl,1e-5); }
      }
      return d;
    }
    if (uKind==2){ // arc / ring: R, half thickness, a0, a1
      bevel = uP1.x;
      float R=uP0.x, th=uP0.y, a0=uP0.z, a1=uP0.w;
      float l = length(p); vec2 nr = p/max(l,1e-5);
      float span = a1-a0;
      bool inArc = span >= 6.2831;
      if (!inArc){ float ang = atan(p.y,p.x); inArc = mod(ang-a0, 6.2831853) <= span; }
      if (inArc){ grad = (l > R ? 1.0 : -1.0)*nr; return abs(l-R)-th; }
      vec2 c0 = R*vec2(cos(a0),sin(a0)), c1 = R*vec2(cos(a1),sin(a1));
      vec2 e0 = p-c0, e1 = p-c1; float l0 = length(e0), l1 = length(e1);
      if (l0 < l1){ grad = e0/max(l0,1e-5); return l0-th; }
      grad = e1/max(l1,1e-5); return l1-th;
    }
    if (uKind==3){ // polyline stroke
      bevel = uP0.y; float best = 1e9; vec2 bv = vec2(1,0);
      for (int i=0;i<47;i++){
        if (i>=uN-1) break;
        vec2 a = uPts[i], ba = uPts[i+1]-a, pa = p-a;
        float hh = clamp(dot(pa,ba)/max(dot(ba,ba),1e-6), 0., 1.);
        vec2 v = pa-ba*hh; float l2 = dot(v,v);
        if (l2 < best){ best = l2; bv = v; }
      }
      float l = sqrt(best); grad = bv/max(l,1e-5);
      return l - uP0.x;
    }
    float e = 0.6;
    if (uKind==4){ // metaballs: pts[2i]=center, pts[2i+1].x=radius
      bevel = uP0.y;
      float d = 1e9, dx = 1e9, dy = 1e9;
      for (int i=0;i<24;i++){
        if (i>=uN) break;
        vec2 c = uPts[2*i]; float r = uPts[2*i+1].x;
        d = smin(d, length(p-c)-r, uP0.x);
        dx = smin(dx, length(p+vec2(e,0.)-c)-r, uP0.x);
        dy = smin(dy, length(p+vec2(0.,e)-c)-r, uP0.x);
      }
      grad = vec2(dx-d, dy-d)/e;
      return d;
    }
    // 5: rosette (seal): R, amplitude, petals
    bevel = uP1.x;
    float a = atan(p.y,p.x), l = length(p);
    float rr = uP0.x + uP0.y*cos(a*uP0.z);
    float drr = -uP0.y*uP0.z*sin(a*uP0.z);
    vec2 nr = p/max(l,1e-5), tg = vec2(-nr.y, nr.x);
    grad = normalize(nr - tg*drr/max(l,1e-3));
    return (l - rr)*0.92;
  }
  void main(){
    float fw = max(length(fwidth(vLocal))*0.7071, 1e-4);
    float cov, h; vec2 g;
    if (uKind==0){
      vec2 tuv = vLocal/(2.0*uTexHalf)+0.5;
      if (tuv.x<0.||tuv.y<0.||tuv.x>1.||tuv.y>1.) discard;
      vec4 s = texture(uTex, tuv);
      if (s.r <= 0.0) discard;
      cov = s.r; h = s.g; g = s.ba;
    } else {
      float bv; vec2 grad;
      float d = sdfg(vLocal, bv, grad);
      if (d > fw*1.5) discard;
      cov = clamp(0.5 - d/fw, 0., 1.);
      float s = clamp(-d/max(bv,1e-3), 0., 1.);
      float u = 1.0-s;
      h = sqrt(1.0 - 0.96*u*u);
      float dhds = 0.96*u/max(h,1e-3);
      g = -grad*dhds;
    }
    if (cov <= 0.0) discard;
    vec3 n = normalize(uRot * normalize(vec3(-g*uDepth, 1.0)));
    if (n.z < 0.0) n = -n;
    float a = cov*uOpacity;
    o0 = vec4(n.xy, h*uRefrK, 1.0)*a;
    o1 = vec4(uTint.rgb*uTint.a, uTint.a)*a;
  }`;

  // frosted glass composite
  const FS_FROST = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uBg, uBgBlur, uG0, uG1, uShadow;
  uniform vec2 uDesign; uniform vec3 uL; uniform vec4 uSweep; uniform float uSweepAmp;
  uniform float uRefr;
  vec3 sat(vec3 c, float s){ float l = dot(c, vec3(0.2126,0.7152,0.0722)); return mix(vec3(l), c, s); }
  void main(){
    vec3 bg = texture(uBg, vUv).rgb;
    vec2 sh = texture(uShadow, vUv + vec2(-6.0/uDesign.x, 16.0/uDesign.y)).rg;
    vec4 g = texture(uG0, vUv);
    float c = g.a;
    bg *= 1.0 - (sh.r*0.30 + sh.g*0.26)*(1.0 - c);
    if (c < 0.002){ o = vec4(bg,1.); return; }
    vec2 n2 = g.xy/c; float hz = g.z/c;
    float l2 = min(dot(n2,n2), 0.999);
    vec3 n = vec3(n2, sqrt(1.0-l2));
    vec2 off = -n2*uRefr*max(hz, 1.0)/uDesign;
    vec3 fr;
    fr.r = texture(uBgBlur, vUv+off*0.92).r;
    fr.g = texture(uBgBlur, vUv+off).g;
    fr.b = texture(uBgBlur, vUv+off*1.10).b;
    vec3 sharp = texture(uBg, vUv+off*1.6).rgb;
    float edge = smoothstep(0.10, 0.80, sqrt(l2));
    fr = mix(fr, sharp, edge*0.55);
    fr = sat(fr, 1.20)*0.92 + 0.012;
    vec4 tt = texture(uG1, vUv); float ts = clamp(tt.a/c, 0., 1.); vec3 tp = tt.rgb/c;
    vec3 col = fr*(1.0-ts) + tp;
    vec3 L = normalize(uL); vec3 Hh = normalize(L + vec3(0,0,1));
    float nh = max(dot(n,Hh),0.);
    float spec = pow(nh, 120.0)*0.9 + pow(nh, 16.0)*0.05;
    vec2 ld = normalize(L.xy);
    float facing = dot(n2/max(sqrt(l2),1e-4), ld);
    float rimLit = edge*smoothstep(-0.3, 1.0, facing);
    float rimBack = edge*smoothstep(0.3, 1.0, -facing);
    float fres = pow(1.0-n.z, 3.0);
    col += vec3(1.0)*(spec + 0.42*rimLit*edge + 0.16*rimBack + 0.10*fres);
    col *= 1.0 - 0.10*edge*smoothstep(0.0,1.0,-facing);
    vec2 sp = (vUv-0.5)*uDesign/uDesign.y;
    float sw = exp(-pow((dot(sp, uSweep.xy)-uSweep.z)/uSweep.w, 2.0));
    col += sw*uSweepAmp*(0.06 + 0.55*fres + 0.25*edge);
    o = vec4(mix(bg, col, c), 1.0);
  }`;

  // clear glass composite (refracts everything rendered so far)
  const FS_GLASS = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 o;
  uniform sampler2D uSrc, uG0, uG1, uShadow;
  uniform vec2 uDesign; uniform vec3 uL; uniform vec4 uSweep; uniform float uSweepAmp;
  uniform float uRefr;
  void main(){
    vec3 base = texture(uSrc, vUv).rgb;
    vec4 g = texture(uG0, vUv);
    float c = g.a;
    if (c < 0.002){ o = vec4(base,1.); return; }
    vec2 n2 = g.xy/c; float hz = g.z/c; float h = min(hz, 1.0);
    float l2 = min(dot(n2,n2), 0.999);
    vec3 n = vec3(n2, sqrt(1.0-l2));
    vec2 off = -n2*uRefr*(0.35+0.65*hz)/uDesign;
    vec3 col;
    col.r = texture(uSrc, vUv+off*0.90).r;
    col.g = texture(uSrc, vUv+off).g;
    col.b = texture(uSrc, vUv+off*1.12).b;
    vec4 tt = texture(uG1, vUv); float ts = clamp(tt.a/c, 0., 1.); vec3 tp = tt.rgb/c;
    col = col*(1.0-ts) + tp;
    float edge = smoothstep(0.12, 0.90, sqrt(l2));
    vec3 L = normalize(uL); vec3 Hh = normalize(L + vec3(0,0,1));
    float nh = max(dot(n,Hh),0.);
    float spec = pow(nh, 140.0)*1.1 + pow(nh, 22.0)*0.10;
    vec2 ld = normalize(L.xy);
    float facing = dot(n2/max(sqrt(l2),1e-4), ld);
    float rimLit = edge*smoothstep(-0.2, 1.0, facing);
    float rimBack = edge*smoothstep(0.2, 1.0, -facing);
    float fres = pow(1.0-n.z, 2.5);
    // body: slight brightening + soft inner glow, darker absorbing edge on the far side
    col = col*1.02 + 0.02 + 0.04*h;
    col *= 1.0 - 0.22*edge*smoothstep(-0.1, 1.0, -facing);
    col += vec3(1.0)*(spec + 0.66*rimLit*edge + 0.22*rimBack + 0.12*fres);
    vec2 sp = (vUv-0.5)*uDesign/uDesign.y;
    float sw = exp(-pow((dot(sp, uSweep.xy)-uSweep.z)/uSweep.w, 2.0));
    col += sw*uSweepAmp*(0.22 + 0.9*fres + 0.5*h);
    o = vec4(mix(base, col, c), 1.0);
  }`;

  // flat sprites: labels, screenshots, fills, glows, rays
  const FS_FLAT = `#version 300 es
  precision highp float;
  in vec2 vLocal; out vec4 o;
  uniform int uMode; uniform sampler2D uTex; uniform vec2 uTexHalf;
  uniform vec4 uColor, uColor2, uP0, uP1; uniform float uOpacity;
  uniform vec2 uPts[48]; uniform int uN;
  ${SDF_LIB}
  void main(){
    float fw = max(length(fwidth(vLocal))*0.7071, 1e-4);
    vec4 c = vec4(0);
    if (uMode==0){
      vec2 tuv = vLocal/(2.0*uTexHalf)+0.5;
      if (tuv.x<0.||tuv.y<0.||tuv.x>1.||tuv.y>1.) discard;
      c = texture(uTex, vec2(tuv.x, 1.0-tuv.y), uP1.x)*vec4(uColor.rgb*uColor.a, uColor.a);   // texture is premultiplied
      if (uP0.z > 0.0){ float d = sdRRect(vLocal, uP0.xy, uP0.z); c *= clamp(0.5-d/fw, 0., 1.); }
    } else if (uMode==1){
      float d = sdRRect(vLocal, uP0.xy, uP0.z); float a = clamp(0.5-d/fw,0.,1.);
      float gx = clamp(vLocal.x/(2.0*uP0.x)+0.5, 0., 1.);
      vec4 col = mix(uColor, uColor2, gx); c = vec4(col.rgb*col.a, col.a)*a;
    } else if (uMode==2){
      // liquid fill inside a pill: uP0 = halfW, halfH, r; uP1 = fill, time, wave amp
      float d = sdRRect(vLocal, uP0.xy, uP0.z); float a = clamp(0.5-d/fw,0.,1.);
      float front = -uP0.x + 2.0*uP0.x*uP1.x + (sin(vLocal.y*0.10 + uP1.y*5.0) + 0.6*sin(vLocal.y*0.047 - uP1.y*3.3))*uP1.z;
      float df = vLocal.x - front; float fa = clamp(0.5 - df/fw, 0., 1.);
      float gx = clamp((vLocal.x+uP0.x)/(2.0*uP0.x), 0., 1.);
      vec3 col = mix(uColor.rgb, uColor2.rgb, gx);
      float vy = vLocal.y/uP0.y;
      col *= 0.80 + 0.30*smoothstep(-1.0, 1.0, vy);
      col += 0.06*sin(vLocal.x*0.045 - uP1.y*4.0);
      col += vec3(1.0)*uP1.w*exp(-pow(df/(uP0.y*0.18+2.0),2.0));
      col += vec3(1.0)*0.18*exp(-pow((vy-0.55)/0.18,2.0));
      float al = a*fa*uColor.a;
      c = vec4(col*al, al);
    } else if (uMode==3){
      vec2 q = vLocal/uP0.xy; float g = exp(-dot(q,q));
      c = vec4(uColor.rgb*uColor.a*g, uColor.a*g*uP0.z);
    } else if (uMode==4){
      float ang = atan(vLocal.x, vLocal.y) + uP1.x; float r = length(vLocal);
      float ray = pow(0.5+0.5*cos(ang*uP0.x), uP0.y) * (0.55+0.45*sin(ang*uP0.x*0.37 + uP1.y));
      float fall = exp(-r/uP0.z) * smoothstep(0.0, 30.0, r);
      float cone = uP1.z > 0.0 ? smoothstep(uP1.z, uP1.z*0.55, abs(atan(vLocal.x, vLocal.y))) : 1.0;
      float a = ray*fall*cone;
      c = vec4(uColor.rgb*uColor.a*a, 0.0);
    } else if (uMode==5){
      float r = length(vLocal); float g = exp(-pow((r-uP0.x)/uP0.y, 2.0));
      c = vec4(uColor.rgb*uColor.a*g, uColor.a*g);
    } else if (uMode==6 || uMode==7){
      // solid stroke: 6 = polyline (uPts), 7 = arc (R, a0, a1); uP0.x = half width, uP0.y = glow radius
      float d;
      if (uMode==6){
        d = 1e9;
        for (int i=0;i<47;i++){ if (i>=uN-1) break; d = min(d, sdSeg(vLocal, uPts[i], uPts[i+1])); }
      } else {
        float R=uP1.x, a0=uP1.y, a1=uP1.z;
        float l = length(vLocal);
        float ang = atan(vLocal.y, vLocal.x);
        if (a1-a0 >= 6.2831 || mod(ang-a0, 6.2831853) <= a1-a0) d = abs(l-R);
        else d = min(length(vLocal-R*vec2(cos(a0),sin(a0))), length(vLocal-R*vec2(cos(a1),sin(a1))));
      }
      d -= uP0.x;
      float cov = clamp(0.5 - d/fw, 0., 1.);
      float gl = uP0.y > 0.0 ? exp(-max(d,0.0)*max(d,0.0)/(uP0.y*uP0.y))*0.45 : 0.0;
      float a = max(cov, gl*uP0.z);
      c = vec4(uColor.rgb*uColor.a*a, uColor.a*a);
    }
    o = c*uOpacity;
  }`;

  const FS_BRIGHT = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uSrc; uniform vec2 uTexel;
  void main(){
    vec3 c = vec3(0);
    for (int i=-1;i<=1;i+=2) for (int j=-1;j<=1;j+=2) c += texture(uSrc, vUv+uTexel*vec2(i,j)).rgb;
    c *= 0.25;
    float l = dot(c, vec3(0.2126,0.7152,0.0722));
    o = vec4(c*smoothstep(0.62, 1.15, l), 1.0);
  }`;

  const FS_FINAL = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o;
  uniform sampler2D uSrc, uBloom; uniform vec2 uDesign; uniform float uFrame; uniform float uFade;
  float hash(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
  void main(){
    vec3 c = texture(uSrc, vUv).rgb;
    c += texture(uBloom, vUv).rgb*0.55;
    vec2 q = (vUv-0.5)*uDesign/max(uDesign.x,uDesign.y);
    c *= 1.0 - 0.32*dot(q,q)*2.0;
    c = c/(1.0 + 0.10*max(c-0.85, 0.0));
    c = mix(vec3(dot(c, vec3(0.2126,0.7152,0.0722))), c, 1.04);
    c *= uFade;
    float n = hash(gl_FragCoord.xy + fract(uFrame*0.6180339)*97.0) + hash(gl_FragCoord.yx*1.37 + uFrame) - 1.0;
    c += n*(1.2/255.0);
    o = vec4(clamp(c,0.,1.), 1.0);
  }`;

  // copy to the canvas (stills / live preview)
  const FS_SHOW = `#version 300 es
  precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uSrc;
  void main(){ o = vec4(texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0).rgb, 1.0); }`;

  // pack the frame as planar yuv420p (BT.709, limited range) so the readback is 2.7x smaller.
  // Output texel row r (bottom-up in GL = memory order of readPixels) holds bytes [r*W, (r+1)*W) of the frame.
  const FS_PACK = `#version 300 es
  precision highp float; out vec4 o; uniform sampler2D uSrc; uniform ivec2 uSize;
  vec3 px(int x, int y){ return texelFetch(uSrc, ivec2(x, uSize.y-1-y), 0).rgb; }   // y counted from the top
  float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
  vec2 chroma(int i, int j){
    vec3 c = (px(2*j,2*i)+px(2*j+1,2*i)+px(2*j,2*i+1)+px(2*j+1,2*i+1))*0.25;
    float y = luma(c);
    return vec2((c.b-y)/1.8556, (c.r-y)/1.5748);
  }
  void main(){
    int W = uSize.x, H = uSize.y;
    int x = int(gl_FragCoord.x), r = int(gl_FragCoord.y);
    vec4 v;
    if (r < H){
      for (int k=0;k<4;k++) v[k] = (16.0 + 219.0*luma(px(4*x+k, r)))/255.0;
    } else {
      int rr = r - H; int q = H/4; bool isV = rr >= q; if (isV) rr -= q;
      int half8 = W/8;
      int i = 2*rr + (x >= half8 ? 1 : 0);
      int j0 = 4*(x >= half8 ? x-half8 : x);
      for (int k=0;k<4;k++){ vec2 cc = chroma(i, j0+k); v[k] = (128.0 + 224.0*(isV ? cc.y : cc.x))/255.0; }
    }
    o = v;
  }`;

  // ---------------------------------------------------------------- textures
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  const mctx = makeCanvas(8, 8).getContext('2d');
  function font(o, scale) { return `${o.weight || 900} ${o.size * scale}px ${o.family || 'Nunito'}`; }
  function measure(text, o, scale = 1) {
    mctx.font = font(o, scale);
    mctx.letterSpacing = ((o.track || 0) * scale) + 'px';
    const m = mctx.measureText(text);
    return m.width - (text.length ? (o.track || 0) * scale : 0);
  }
  function capMetrics(o, scale) {
    mctx.font = font(o, scale);
    const m = mctx.measureText('HXE0');
    return { asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
  }

  function uploadRGBA8(canvasEl, mip = true) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvasEl);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  // Felzenszwalb-Huttenlocher squared euclidean distance transform
  function edt(grid, w, h) {
    const INF = 1e20, n = Math.max(w, h);
    const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    const pass = (len) => {
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < len; q++) {
        let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    };
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
      pass(h);
      for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
      pass(w);
      for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
    }
  }

  // shape canvas (white on transparent) -> float texture (coverage, height, slope.x, slope.y)
  function glassFromCanvas(cv, bevelPx) {
    const w = cv.width, h = cv.height;
    const img = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const N = w * h;
    const inside = new Float64Array(N), outside = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const a = img[i * 4 + 3];
      inside[i] = a >= 128 ? 1e20 : 0;
      outside[i] = a >= 128 ? 0 : 1e20;
    }
    edt(inside, w, h); edt(outside, w, h);
    // signed distance (px, positive inside), then a gaussian smooth of the SDF itself: this removes the
    // stair-step ridges a binary EDT leaves on the bevel slopes
    let sd = new Float32Array(N);
    for (let i = 0; i < N; i++) sd[i] = inside[i] > 0 ? Math.sqrt(inside[i]) - 0.5 : -(Math.sqrt(outside[i]) - 0.5);
    // three running-sum box blurs per axis ~ gaussian; sigma grows with the bevel so long
    // staircase periods on shallow-angle edges are flattened too
    const sigma = Math.max(2.0, bevelPx * 0.06);
    const rad = Math.max(1, Math.round((Math.sqrt(12 * sigma * sigma / 3 + 1) - 1) / 2));
    const tmp = new Float32Array(N);
    const boxH = (src, dst) => {
      const k = 1 / (2 * rad + 1);
      for (let y = 0; y < h; y++) {
        const o = y * w;
        let acc = 0;
        for (let x = -rad; x <= rad; x++) acc += src[o + Math.min(Math.max(x, 0), w - 1)];
        for (let x = 0; x < w; x++) {
          dst[o + x] = acc * k;
          acc += src[o + Math.min(x + rad + 1, w - 1)] - src[o + Math.max(x - rad, 0)];
        }
      }
    };
    const boxV = (src, dst) => {
      const k = 1 / (2 * rad + 1);
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = -rad; y <= rad; y++) acc += src[Math.min(Math.max(y, 0), h - 1) * w + x];
        for (let y = 0; y < h; y++) {
          dst[y * w + x] = acc * k;
          acc += src[Math.min(y + rad + 1, h - 1) * w + x] - src[Math.max(y - rad, 0) * w + x];
        }
      }
    };
    for (let it = 0; it < 3; it++) { boxH(sd, tmp); boxV(tmp, sd); }
    const hh = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const s = Math.min(Math.max(sd[i] / bevelPx, 0), 1);
      const u = 1 - s;
      hh[i] = sd[i] > -0.5 ? Math.sqrt(1 - 0.96 * u * u) : 0;
    }
    const out = new Float32Array(N * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = ((h - 1 - y) * w + x) * 4;           // flip rows: texture v=0 is the bottom
      // slope from the smooth SDF: dh/ds * grad(sd)
      const s = Math.min(Math.max(sd[i] / bevelPx, 0), 1), u = 1 - s;
      const dhds = s < 1 && sd[i] > -1 ? 0.96 * u / Math.max(Math.sqrt(1 - 0.96 * u * u), 1e-3) : 0;
      const dx = (sd[y * w + Math.min(x + 1, w - 1)] - sd[y * w + Math.max(x - 1, 0)]) * 0.5;
      const dy = -(sd[Math.min(y + 1, h - 1) * w + x] - sd[Math.max(y - 1, 0) * w + x]) * 0.5;
      const gx = dhds * dx, gy = dhds * dy;
      out[o] = img[i * 4 + 3] / 255; out[o + 1] = hh[i]; out[o + 2] = gx; out[o + 3] = gy;
    }
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, out);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  // text drawn into a canvas centred on its cap height. Returns {cv, halfW, halfH}
  function textCanvas(text, o, scale, pad) {
    const w = measure(text, o, scale);
    const { asc } = capMetrics(o, scale);
    const desc = o.size * scale * 0.28;
    const P = Math.ceil(pad * scale);
    const cw = Math.ceil(w + 2 * P), ch = Math.ceil(asc * 2 + 2 * P + desc * 0);
    const cv = makeCanvas(cw, ch);
    const c = cv.getContext('2d');
    c.font = font(o, scale);
    c.letterSpacing = ((o.track || 0) * scale) + 'px';
    c.fillStyle = o.color || '#fff';
    if (o.grad) {
      // o.grad: [[stop, color], ...]; vertical by default, o.gradH for left->right
      const g = o.gradH ? c.createLinearGradient(P, 0, P + w, 0) : c.createLinearGradient(0, ch / 2 - asc / 2, 0, ch / 2 + asc / 2);
      for (const [st, col] of o.grad) g.addColorStop(st, col);
      c.fillStyle = g;
    }
    c.textBaseline = 'alphabetic';
    c.fillText(text, P, ch / 2 + asc / 2);
    return { cv, halfW: cw / scale / 2, halfH: ch / scale / 2, w: w / scale };
  }

  // glass text: {tex, halfW, halfH, w}
  function glassText(text, o) {
    const key = 'G|' + text + '|' + JSON.stringify(o);
    if (texCache.has(key)) return texCache.get(key);
    const scale = o.texScale || TS;
    const bevel = o.bevel || o.size * 0.10;
    const { cv, halfW, halfH, w } = textCanvas(text, o, scale, bevel + 6);
    const r = { tex: glassFromCanvas(cv, bevel * scale), halfW, halfH, w };
    texCache.set(key, r);
    return r;
  }
  // glass letters of a line, each with its x centre relative to the line centre
  function glassLetters(text, o) {
    const total = measure(text, o);
    const res = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ' ') continue;
      const pre = measure(text.slice(0, i), o) + (i ? (o.track || 0) : 0);
      const cw = measure(ch, o);
      res.push(Object.assign({ ch, i, cx: pre + cw / 2 - total / 2 }, glassText(ch, o)));
    }
    return { letters: res, w: total };
  }
  // glass from an arbitrary path drawing callback (draws white shapes in unit space)
  function glassShape(key, halfW, halfH, bevel, draw) {
    if (texCache.has(key)) return texCache.get(key);
    const scale = TS, pad = bevel + 6;
    const cw = Math.ceil((halfW + pad) * 2 * scale), ch = Math.ceil((halfH + pad) * 2 * scale);
    const cv = makeCanvas(cw, ch);
    const c = cv.getContext('2d');
    c.translate(cw / 2, ch / 2); c.scale(scale, -scale);
    c.fillStyle = '#fff'; c.strokeStyle = '#fff';
    draw(c);
    const r = { tex: glassFromCanvas(cv, bevel * scale), halfW: cw / scale / 2, halfH: ch / scale / 2 };
    texCache.set(key, r);
    return r;
  }
  function flatText(text, o) {
    const key = 'F|' + text + '|' + JSON.stringify(o);
    if (texCache.has(key)) return texCache.get(key);
    const scale = o.texScale || TS * (o.size > 60 ? 1.45 : 1.25);
    const { cv, halfW, halfH, w } = textCanvas(text, o, scale, 4);
    const r = { tex: uploadRGBA8(cv), halfW, halfH, w };
    texCache.set(key, r);
    return r;
  }
  function flatShape(key, halfW, halfH, draw, scale = TS * 1.25) {
    if (texCache.has(key)) return texCache.get(key);
    const cw = Math.ceil(halfW * 2 * scale), ch = Math.ceil(halfH * 2 * scale);
    const cv = makeCanvas(cw, ch);
    const c = cv.getContext('2d');
    c.translate(cw / 2, ch / 2); c.scale(scale, scale);
    draw(c);
    const r = { tex: uploadRGBA8(cv), halfW, halfH };
    texCache.set(key, r);
    return r;
  }
  function image(key, img) {
    if (texCache.has(key)) return texCache.get(key);
    const r = { tex: uploadRGBA8(img), aspect: img.width / img.height };
    texCache.set(key, r);
    return r;
  }

  // ---------------------------------------------------------------- init
  function init(cv, opts) {
    canvas = cv; W = opts.W; H = opts.H; DW = opts.DW; DH = opts.DH;
    TS = opts.texScale || (W / DW) * 1.7;
    canvas.width = W; canvas.height = H;
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true, depth: false, stencil: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float unavailable');
    gl.getExtension('OES_texture_float_linear');

    P.bg = compile(VS_FULL, FS_BG);
    P.down = compile(VS_FULL, FS_DOWN);
    P.blur = compile(VS_FULL, FS_BLUR);
    P.cov = compile(VS_FULL, FS_COV);
    P.gbuf = compile(VS_SPRITE, FS_GBUF);
    P.frost = compile(VS_FULL, FS_FROST);
    P.glass = compile(VS_FULL, FS_GLASS);
    P.flat = compile(VS_SPRITE, FS_FLAT);
    P.bright = compile(VS_FULL, FS_BRIGHT);
    P.final = compile(VS_FULL, FS_FINAL);
    P.show = compile(VS_FULL, FS_SHOW);
    P.pack = compile(VS_FULL, FS_PACK);

    tri = gl.createVertexArray(); gl.bindVertexArray(tri);
    let b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    quad = gl.createVertexArray(); gl.bindVertexArray(quad);
    b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const F16 = gl.RGBA16F, U8 = gl.RGBA8;
    const hw = Math.ceil(W / 2), hh = Math.ceil(H / 2), qw = Math.ceil(W / 4), qh = Math.ceil(H / 4), ew = Math.ceil(W / 8), eh = Math.ceil(H / 8);
    T.bg = target(hw, hh, [F16]);
    T.bgQ = target(qw, qh, [F16]);
    T.bgQ2 = target(qw, qh, [F16]);
    T.bgE = target(ew, eh, [F16]);
    T.bgE2 = target(ew, eh, [F16]);
    T.gF = target(W, H, [F16, U8]);
    T.gG = target(W, H, [F16, U8]);
    T.cov = target(qw, qh, [U8]);
    T.cov2 = target(qw, qh, [U8]);
    T.A = target(W, H, [F16]);
    T.B = target(W, H, [F16]);
    T.bl = target(qw, qh, [U8]);
    T.bl2 = target(qw, qh, [U8]);
    T.out = target(W, H, [F16]);
    if (W % 8 === 0 && H % 4 === 0) T.yuv = target(W / 4, H * 3 / 2, [U8]);
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return { W, H, DW, DH, TS, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?' };
  }

  // ---------------------------------------------------------------- drawing
  let PV, V;
  function blur(src, tmp, passes, spread) {
    gl.useProgram(P.blur.p);
    for (let i = 0; i < passes; i++) {
      bindTarget(tmp); useTex(P.blur, 'uSrc', 0, src.texs[0]);
      gl.uniform2f(P.blur.u.uDir, spread / src.w, 0); fullscreen();
      bindTarget(src); useTex(P.blur, 'uSrc', 0, tmp.texs[0]);
      gl.uniform2f(P.blur.u.uDir, 0, spread / src.h); fullscreen();
    }
  }
  function down(src, dst) {
    gl.useProgram(P.down.p); bindTarget(dst);
    useTex(P.down, 'uSrc', 0, src.texs[0]);
    gl.uniform2f(P.down.u.uTexel, 1 / src.w, 1 / src.h);
    fullscreen();
  }

  function spriteMatrices(s) {
    const M = worldM(s);
    const VM = M4.mul(V, M);
    // rotation part, columns normalised (drop scale)
    const R = new Float32Array(9);
    for (let c = 0; c < 3; c++) {
      const l = Math.hypot(VM[c * 4], VM[c * 4 + 1], VM[c * 4 + 2]) || 1;
      for (let r = 0; r < 3; r++) R[c * 3 + r] = VM[c * 4 + r] / l;
    }
    return { MVP: M4.mul(PV, M), R, zv: VM[14] };
  }

  const KIND = { tex: 0, rrect: 1, arc: 2, poly: 3, blobs: 4, rosette: 5 };
  function drawG(list, box) {
    const pr = P.gbuf; gl.useProgram(pr.p); gl.bindVertexArray(quad);
    for (const s of list) {
      const op = (s.opacity == null ? 1 : s.opacity) * parentOpacity(s);
      if (op <= 0.001) continue;
      const kind = KIND[s.kind];
      gl.uniformMatrix4fv(pr.u.uMVP, false, s._m.MVP);
      gl.uniformMatrix3fv(pr.u.uRot, false, s._m.R);
      gl.uniform1i(pr.u.uKind, kind);
      gl.uniform1f(pr.u.uDepth, s.depth == null ? 0.75 : s.depth);
      gl.uniform1f(pr.u.uOpacity, op);
      gl.uniform1f(pr.u.uRefrK, s.refr == null ? 1 : s.refr);
      const tint = s.tint || [1, 1, 1, s.layer === 'frost' ? 0.06 : 0.03];
      gl.uniform4f(pr.u.uTint, tint[0], tint[1], tint[2], tint[3]);
      let hw, hh, cx = 0, cy = 0;
      if (kind === 0) {
        hw = s.tex.halfW; hh = s.tex.halfH;
        gl.uniform2f(pr.u.uTexHalf, hw, hh);
        useTex(pr, 'uTex', 0, s.tex.tex);
      } else if (kind === 1) {
        hw = s.w / 2 + 3; hh = s.h / 2 + 3;
        gl.uniform4f(pr.u.uP0, s.w / 2, s.h / 2, s.r == null ? Math.min(s.w, s.h) / 2 : s.r, s.bevel || 20);
        const hole = s.hole || [0, 0, 0];
        gl.uniform4f(pr.u.uP1, hole[0], hole[1], hole[2], 0);
      } else if (kind === 2) {
        hw = hh = s.R + s.th + 3;
        gl.uniform4f(pr.u.uP0, s.R, s.th, s.a0 == null ? 0 : s.a0, s.a1 == null ? 7 : s.a1);
        gl.uniform4f(pr.u.uP1, s.bevel || s.th, 0, 0, 0);
      } else if (kind === 3) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        const flat = new Float32Array(96);
        s.pts.slice(0, 48).forEach((p, i) => { flat[i * 2] = p[0]; flat[i * 2 + 1] = p[1]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
        const m = s.th + 3;
        hw = (x1 - x0) / 2 + m; hh = (y1 - y0) / 2 + m;
        cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
        gl.uniform2fv(pr.u.uPts, flat);
        gl.uniform1i(pr.u.uN, Math.min(s.pts.length, 48));
        gl.uniform4f(pr.u.uP0, s.th, s.bevel || s.th, 0, 0);
      } else if (kind === 4) {
        let ext = 0;
        const flat = new Float32Array(96);
        s.balls.slice(0, 24).forEach((b, i) => { flat[i * 4] = b[0]; flat[i * 4 + 1] = b[1]; flat[i * 4 + 2] = b[2]; ext = Math.max(ext, Math.abs(b[0]) + b[2], Math.abs(b[1]) + b[2]); });
        hw = hh = ext + (s.k || 40) + 4;
        gl.uniform2fv(pr.u.uPts, flat);
        gl.uniform1i(pr.u.uN, Math.min(s.balls.length, 24));
        gl.uniform4f(pr.u.uP0, s.k || 40, s.bevel || 40, 0, 0);
      } else {
        hw = hh = s.R + s.amp + 4;
        gl.uniform4f(pr.u.uP0, s.R, s.amp, s.petals, 0);
        gl.uniform4f(pr.u.uP1, s.bevel || 20, 0, 0, 0);
      }
      gl.uniform2f(pr.u.uHalf, hw, hh);
      gl.uniform2f(pr.u.uCenter, cx, cy);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (box) growBox(box, s._m.MVP, cx, cy, hw, hh);
    }
  }
  // grow a pixel-space bbox by the projected corners of a sprite quad
  function growBox(box, mvp, cx, cy, hw, hh) {
    for (const [x, y] of [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx - hw, cy + hh], [cx + hw, cy + hh]]) {
      const X = mvp[0] * x + mvp[4] * y + mvp[12], Y = mvp[1] * x + mvp[5] * y + mvp[13], Wc = mvp[3] * x + mvp[7] * y + mvp[15];
      if (Wc <= 1e-3) { box[0] = 0; box[1] = 0; box[2] = W; box[3] = H; continue; }
      const px = (X / Wc * 0.5 + 0.5) * W, py = (Y / Wc * 0.5 + 0.5) * H;
      box[0] = Math.min(box[0], px); box[1] = Math.min(box[1], py); box[2] = Math.max(box[2], px); box[3] = Math.max(box[3], py);
    }
  }

  const MODE = { tex: 0, fill: 1, liquid: 2, glow: 3, rays: 4, ring: 5, stroke: 6, arc: 7 };
  function drawFlat(list) {
    const pr = P.flat; gl.useProgram(pr.p); gl.bindVertexArray(quad);
    for (const s of list) {
      const op = (s.opacity == null ? 1 : s.opacity) * parentOpacity(s);
      if (op <= 0.001) continue;
      const mode = MODE[s.kind];
      if (s.blend === 'add') gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(pr.u.uMVP, false, s._m.MVP);
      gl.uniform1i(pr.u.uMode, mode);
      gl.uniform1f(pr.u.uOpacity, op);
      const c = s.color || [1, 1, 1, 1], c2 = s.color2 || c;
      gl.uniform4f(pr.u.uColor, c[0], c[1], c[2], c[3]);
      gl.uniform4f(pr.u.uColor2, c2[0], c2[1], c2[2], c2[3]);
      let hw, hh, cx = 0, cy = 0;
      if (mode === 0) {
        if (s.tex.aspect) { hw = s.w / 2; hh = s.h / 2; } else { hw = s.tex.halfW; hh = s.tex.halfH; }
        gl.uniform2f(pr.u.uTexHalf, hw, hh);
        gl.uniform4f(pr.u.uP0, hw, hh, s.r || 0, 0);
        gl.uniform4f(pr.u.uP1, s.blur || 0, 0, 0, 0);
        useTex(pr, 'uTex', 0, s.tex.tex);
      } else if (mode === 1 || mode === 2) {
        hw = s.w / 2 + 2; hh = s.h / 2 + 2;
        gl.uniform4f(pr.u.uP0, s.w / 2, s.h / 2, s.r == null ? Math.min(s.w, s.h) / 2 : s.r, 0);
        gl.uniform4f(pr.u.uP1, s.fill == null ? 1 : s.fill, s.time || 0, s.wave || 0, s.glint == null ? 0.55 : s.glint);
      } else if (mode === 3) {
        hw = s.sx3 * 2.2; hh = s.sy3 * 2.2;
        gl.uniform4f(pr.u.uP0, s.sx3, s.sy3, s.alphaK || 0, 0);
      } else if (mode === 4) {
        hw = hh = s.size;
        gl.uniform4f(pr.u.uP0, s.count || 9, s.sharp || 6, s.fall || 300, 0);
        gl.uniform4f(pr.u.uP1, s.rot || 0, s.time || 0, s.cone || 0, 0);
      } else if (mode === 5) {
        hw = hh = s.R + s.wd * 3;
        gl.uniform4f(pr.u.uP0, s.R, s.wd, 0, 0);
      } else if (mode === 6) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        const flat = new Float32Array(96);
        s.pts.slice(0, 48).forEach((p, i) => { flat[i * 2] = p[0]; flat[i * 2 + 1] = p[1]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
        const m = s.th + (s.glowR || 0) * 2.2 + 3;
        hw = (x1 - x0) / 2 + m; hh = (y1 - y0) / 2 + m; cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
        gl.uniform2fv(pr.u.uPts, flat); gl.uniform1i(pr.u.uN, Math.min(s.pts.length, 48));
        gl.uniform4f(pr.u.uP0, s.th, s.glowR || 0, s.glowK == null ? 1 : s.glowK, 0);
      } else {
        hw = hh = s.R + s.th + (s.glowR || 0) * 2.2 + 3;
        gl.uniform4f(pr.u.uP0, s.th, s.glowR || 0, s.glowK == null ? 1 : s.glowK, 0);
        gl.uniform4f(pr.u.uP1, s.R, s.a0 == null ? 0 : s.a0, s.a1 == null ? 7 : s.a1, 0);
      }
      gl.uniform2f(pr.u.uHalf, hw, hh);
      gl.uniform2f(pr.u.uCenter, cx, cy);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  function clearTarget(t) {
    bindTarget(t);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // frame: {t, frame, cam:{x,y,z,tx,ty,tz,fov,roll}, ripples:[[x,y,age,amp]], light:[x,y,z],
  //         sweep:{dir:[x,y], pos, width, amp}, fade, bright, sprites:[...]}
  const px1 = new Float32Array(4);
  let PROF = null;
  function mark(name) {
    if (!PROF) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.A.fbo);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px1);
    const n = performance.now(); PROF.push([name, n - PROF.last]); PROF.last = n;
  }
  function draw(F) {
    PROF = F.prof ? Object.assign([], { last: performance.now() }) : null;
    const cam = F.cam;
    const fov = (cam.fov || 30) * D2R;
    const proj = M4.persp(fov, DW / DH, 10, 20000);
    const up = [Math.sin(cam.roll || 0), Math.cos(cam.roll || 0), 0];
    V = M4.lookAt([cam.x, cam.y, cam.z], [cam.tx || 0, cam.ty || 0, cam.tz || 0], up);
    PV = M4.mul(proj, V);

    const layers = { under: [], frost: [], glass: [], content: [], overlay: [] };
    const rootZ = new Map();
    for (const s of F.sprites) {
      s._m = spriteMatrices(s);
      let root = s, chain = s.z || 0;
      while (root.parent) { root = root.parent; chain += root.z || 0; }
      if (!rootZ.has(root)) rootZ.set(root, root === s ? s._m.zv : M4.mul(V, worldM(root))[14]);
      s._rz = rootZ.get(root); s._cz = chain;
      layers[s.layer].push(s);
    }
    // back-to-front: whole groups by depth, then by stacking inside a group
    for (const k in layers) layers[k].sort((a, b) => (Math.abs(a._rz - b._rz) > 1 ? a._rz - b._rz : 0) || (a._cz - b._cz) || ((a.order || 0) - (b.order || 0)));

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // 1. wallpaper
    gl.useProgram(P.bg.p); bindTarget(T.bg);
    gl.uniform1f(P.bg.u.uT, F.t);
    gl.uniform2f(P.bg.u.uDesign, DW, DH);
    gl.uniform2f(P.bg.u.uCam, cam.x, cam.y);
    gl.uniform1f(P.bg.u.uBright, F.bright == null ? 1 : F.bright);
    const rip = new Float32Array(32); const rs = (F.ripples || []).slice(0, 8);
    rs.forEach((r, i) => rip.set(r, i * 4));
    gl.uniform4fv(P.bg.u.uRip, rip); gl.uniform1i(P.bg.u.uNR, rs.length);
    fullscreen(); mark('bg');
    // light that lives "behind" the glass (glass refracts it)
    if (layers.under.length) { gl.enable(gl.BLEND); drawFlat(layers.under); gl.disable(gl.BLEND); }

    // 2. frosted copy of the wallpaper
    down(T.bg, T.bgQ);
    down(T.bgQ, T.bgE);
    blur(T.bgE, T.bgE2, 2, 0.9); mark('bgblur');
    // 3. G-buffers
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    clearTarget(T.gF); drawG(layers.frost); mark('gF');
    const gbox = [1e9, 1e9, -1e9, -1e9];
    clearTarget(T.gG); drawG(layers.glass, gbox); mark('gG');
    gl.disable(gl.BLEND);
    // 4. soft shadows from coverage
    gl.useProgram(P.cov.p); bindTarget(T.cov);
    useTex(P.cov, 'uA', 0, T.gF.texs[0]); useTex(P.cov, 'uB', 1, T.gG.texs[0]);
    gl.uniform2f(P.cov.u.uTexel, 1 / W, 1 / H);
    fullscreen();
    blur(T.cov, T.cov2, 2, 1.1); mark('cov');

    const light = F.light || [-0.45, 0.75, 0.55];
    const sw = F.sweep || { dir: [1, 0], pos: -9, width: 0.1, amp: 0 };
    // 5. frost composite -> A
    let pr = P.frost; gl.useProgram(pr.p); bindTarget(T.A);
    useTex(pr, 'uBg', 0, T.bg.texs[0]); useTex(pr, 'uBgBlur', 1, T.bgE.texs[0]);
    useTex(pr, 'uG0', 2, T.gF.texs[0]); useTex(pr, 'uG1', 3, T.gF.texs[1]); useTex(pr, 'uShadow', 4, T.cov.texs[0]);
    gl.uniform2f(pr.u.uDesign, DW, DH); gl.uniform3f(pr.u.uL, light[0], light[1], light[2]);
    const sl = Math.hypot(sw.dir[0], sw.dir[1]) || 1;
    gl.uniform4f(pr.u.uSweep, sw.dir[0] / sl, sw.dir[1] / sl, sw.pos, sw.width); gl.uniform1f(pr.u.uSweepAmp, sw.amp * 0.6);
    gl.uniform1f(pr.u.uRefr, F.frostRefr || 22);
    fullscreen(); mark('frost');
    // 6. content on A
    gl.enable(gl.BLEND); bindTarget(T.A); drawFlat(layers.content); gl.disable(gl.BLEND); mark('content');
    // 7. clear glass composite -> B (copy A, then shade only where glass sprites are)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.A.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.B.fbo);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    const bx0 = Math.max(0, Math.floor(gbox[0]) - 4), by0 = Math.max(0, Math.floor(gbox[1]) - 4);
    const bx1 = Math.min(W, Math.ceil(gbox[2]) + 4), by1 = Math.min(H, Math.ceil(gbox[3]) + 4);
    pr = P.glass; gl.useProgram(pr.p); bindTarget(T.B);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(bx0, by0, Math.max(0, bx1 - bx0), Math.max(0, by1 - by0));
    useTex(pr, 'uSrc', 0, T.A.texs[0]); useTex(pr, 'uG0', 1, T.gG.texs[0]); useTex(pr, 'uG1', 2, T.gG.texs[1]); useTex(pr, 'uShadow', 3, T.cov.texs[0]);
    gl.uniform2f(pr.u.uDesign, DW, DH); gl.uniform3f(pr.u.uL, light[0], light[1], light[2]);
    gl.uniform4f(pr.u.uSweep, sw.dir[0] / sl, sw.dir[1] / sl, sw.pos, sw.width); gl.uniform1f(pr.u.uSweepAmp, sw.amp);
    gl.uniform1f(pr.u.uRefr, F.glassRefr || 34);
    if (bx1 > bx0 && by1 > by0) fullscreen();
    gl.disable(gl.SCISSOR_TEST); mark('glass');
    // 8. overlay light
    gl.enable(gl.BLEND); bindTarget(T.B); drawFlat(layers.overlay); gl.disable(gl.BLEND); mark('overlay');
    // 9. bloom
    gl.useProgram(P.bright.p); bindTarget(T.bl);
    useTex(P.bright, 'uSrc', 0, T.B.texs[0]); gl.uniform2f(P.bright.u.uTexel, 1 / W, 1 / H);
    fullscreen();
    blur(T.bl, T.bl2, 2, 1.0); mark('bloom');
    // 10. final
    pr = P.final; gl.useProgram(pr.p); bindTarget(T.out);
    useTex(pr, 'uSrc', 0, T.B.texs[0]); useTex(pr, 'uBloom', 1, T.bl.texs[0]);
    gl.uniform2f(pr.u.uDesign, DW, DH); gl.uniform1f(pr.u.uFrame, F.frame || 0); gl.uniform1f(pr.u.uFade, F.fade == null ? 1 : F.fade);
    fullscreen(); mark('final');
    return PROF;
  }

  // draw the last frame onto the canvas
  function show() {
    gl.useProgram(P.show.p); bindTarget(null);
    useTex(P.show, 'uSrc', 0, T.out.texs[0]);
    fullscreen();
  }
  // RGBA, bottom-up (W*H*4 bytes)
  function readPixels(buf) {
    show();
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  }
  // yuv420p, top-down (W*H*3/2 bytes)
  function readYUV(buf) {
    gl.useProgram(P.pack.p); bindTarget(T.yuv);
    useTex(P.pack, 'uSrc', 0, T.out.texs[0]);
    gl.uniform2i(P.pack.u.uSize, W, H);
    fullscreen();
    gl.readPixels(0, 0, W / 4, H * 3 / 2, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  }
  function finish() { gl.finish(); }

  return { init, draw, show, readPixels, readYUV, finish, glassText, glassLetters, glassShape, flatText, flatShape, image, measure, M4 };
})();
