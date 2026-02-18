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

  const VERT = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    uniform float u_time;
    uniform vec2 u_res;

    /* Chebyshev T6(x) = 32x^6 - 48x^4 + 18x^2 - 1 */
    float T6(float x) {
      float x2 = x * x;
      return x2 * (x2 * (32.0 * x2 - 48.0) + 18.0) - 1.0;
    }

    /* Chmutov-6 implicit surface */
    float surf(vec3 p) {
      return T6(p.x) + T6(p.y) + T6(p.z);
    }

    /* Central-difference normal */
    vec3 calcNormal(vec3 p) {
      vec2 e = vec2(0.001, 0.0);
      return normalize(vec3(
        surf(p + e.xyy) - surf(p - e.xyy),
        surf(p + e.yxy) - surf(p - e.yxy),
        surf(p + e.yyx) - surf(p - e.yyx)
      ));
    }

    /* Ray vs axis-aligned box */
    vec2 boxHit(vec3 ro, vec3 rd, vec3 b) {
      vec3 inv = 1.0 / rd;
      vec3 t1 = (-b - ro) * inv;
      vec3 t2 = ( b - ro) * inv;
      vec3 mn = min(t1, t2);
      vec3 mx = max(t1, t2);
      return vec2(max(max(mn.x, mn.y), mn.z),
                  min(min(mx.x, mx.y), mx.z));
    }

    mat3 rotY(float a) {
      float s = sin(a), c = cos(a);
      return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
    }

    mat3 rotX(float a) {
      float s = sin(a), c = cos(a);
      return mat3(1, 0, 0, 0, c, -s, 0, s, c);
    }

    /* ---- procedural grid texture ---- */

    float hash21(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    vec2 sphereUV(vec3 p) {
      vec3 n = normalize(p);
      return vec2(
        atan(n.z, n.x) * 0.15915 + 0.5,
        asin(clamp(n.y, -1.0, 1.0)) * 0.31831 + 0.5
      );
    }

    /* Returns rgb = emissive squares, a = grid line mask */
    vec4 cellTexture(vec2 uv, float time) {
      float gs = 14.0;
      vec2 cell = floor(uv * gs);
      vec2 cuv  = fract(uv * gs);

      /* Grid lines — smooth anti-aliased edges */
      float lw = 0.04;
      float gx = smoothstep(0.0, lw, cuv.x) * smoothstep(0.0, lw, 1.0 - cuv.x);
      float gy = smoothstep(0.0, lw, cuv.y) * smoothstep(0.0, lw, 1.0 - cuv.y);
      float grid = 1.0 - gx * gy;

      /* Per-cell deterministic random */
      float h1 = hash21(cell);
      float h2 = hash21(cell + 73.0);
      float h3 = hash21(cell + 157.0);
      float h4 = hash21(cell + 241.0);

      /* Flicker phase & speed unique per cell */
      float flick = sin(time * (0.4 + h1 * 2.5) + h2 * 6.2832);

      /* Animated square size */
      float sz = 0.12 + 0.28 * (0.5 + 0.5 * sin(time * (0.2 + h3 * 0.8) + h4 * 6.2832));

      /* Variable aspect ratio per cell */
      float ax = sz * (0.6 + 0.8 * h2);
      float ay = sz * (0.6 + 0.8 * h3);

      /* Square mask with on/off flicker, some cells always off */
      float sq = step(abs(cuv.x - 0.5), ax) * step(abs(cuv.y - 0.5), ay)
               * step(-0.1, flick)
               * step(0.15, h1);

      /* Colour: white / cyan / blue depending on cell hash */
      vec3 sqCol = mix(
        mix(vec3(0.85, 0.9, 1.0), vec3(0.0, 0.83, 0.67), step(0.3, h1)),
        vec3(0.3, 0.28, 0.9),
        step(0.6, h1)
      );

      /* Pulsing brightness */
      sqCol *= 0.4 + 0.6 * (0.5 + 0.5 * flick);

      return vec4(sq * sqCol, grid);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);

      /* Slow tumble */
      float t = u_time * 0.15;
      mat3 rot = rotY(t) * rotX(t * 0.618);

      /* Camera — orbit around origin */
      vec3 ro  = rot * vec3(0.0, 0.0, 2.4);
      vec3 fwd = normalize(-ro);
      vec3 rgt = normalize(cross(fwd, rot * vec3(0.0, 1.0, 0.0)));
      vec3 up  = cross(rgt, fwd);
      vec3 rd  = normalize(fwd * 1.3 + rgt * uv.x + up * uv.y);

      /* Bounding box test */
      vec2 bb = boxHit(ro, rd, vec3(1.05));

      /* Background — matches --bg #0a0a0f */
      vec3 col = vec3(0.039, 0.039, 0.059);

      if (bb.x < bb.y && bb.y > 0.0) {
        float tN = max(bb.x, 0.001);
        float tF = bb.y;
        float dt = (tF - tN) / 80.0;

        float prev = surf(ro + rd * tN);
        vec3  hitPos;
        bool  hit  = false;
        float glow = 0.0;

        for (int i = 1; i <= 80; i++) {
          float tc  = tN + dt * float(i);
          vec3  p   = ro + rd * tc;
          float val = surf(p);

          /* Volumetric glow — accumulates near-surface energy */
          glow += 0.012 / (1.0 + abs(val) * 12.0);

          if (prev * val < 0.0) {
            /* Bisection refinement (8 iters ≈ 1/256 dt precision) */
            float a = tc - dt, b = tc;
            float fa = prev;
            for (int j = 0; j < 8; j++) {
              float mid = 0.5 * (a + b);
              float fm  = surf(ro + rd * mid);
              if (fa * fm < 0.0) { b = mid; }
              else { a = mid; fa = fm; }
            }
            hitPos = ro + rd * 0.5 * (a + b);
            hit = true;
            break;
          }
          prev = val;
        }

        /* Palette — site accent colours */
        vec3 purple = vec3(0.42, 0.39, 1.0);
        vec3 cyan   = vec3(0.0, 0.83, 0.67);

        if (hit) {
          vec3 n = calcNormal(hitPos);
          vec3 v = -rd;

          /* Key + fill lights */
          vec3  l1 = normalize(vec3(1.0, 1.2, 0.8));
          vec3  l2 = normalize(vec3(-0.6, -0.3, -1.0));
          float d1 = max(dot(n, l1), 0.0);
          float d2 = max(dot(n, l2), 0.0);

          /* Blinn-Phong specular */
          float spec = pow(max(dot(n, normalize(l1 + v)), 0.0), 48.0);

          /* Fresnel rim */
          float fres = pow(1.0 - abs(dot(n, v)), 3.0);

          /* Colour varies with surface orientation */
          vec3 base = mix(purple, cyan,
            0.5 + 0.5 * dot(n, rot * vec3(0.0, 1.0, 0.0)));

          col  = base * (d1 * 0.45 + d2 * 0.12 + 0.08);
          col += spec * vec3(0.9, 0.9, 1.0) * 0.5;
          col += fres * mix(purple, cyan,
            0.5 + 0.3 * sin(u_time * 0.25)) * 0.45;

          /* Spherically-projected procedural texture */
          vec2 texUV = sphereUV(hitPos);
          vec4 tex   = cellTexture(texUV, u_time);
          col += vec3(0.06, 0.1, 0.35) * tex.a;   /* blue grid glow  */
          col += tex.rgb * 0.3;                     /* square emissive */
        }

        /* Atmospheric glow halo */
        col += glow * mix(purple, cyan, 0.4) * 0.1;
      }

      /* Vignette */
      vec2 vc = gl_FragCoord.xy / u_res - 0.5;
      col *= 1.0 - 0.35 * dot(vc, vc);

      /* Tonemap + gamma */
      col = col / (col + 0.8);
      col = pow(col, vec3(0.92));

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* ---- compile & link ---- */

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  /* ---- fullscreen quad ---- */

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes  = gl.getUniformLocation(prog, 'u_res');

  /* ---- sizing ---- */

  let w, h;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const nw = (canvas.clientWidth  * dpr) | 0;
    const nh = (canvas.clientHeight * dpr) | 0;
    if (canvas.width !== nw || canvas.height !== nh) {
      canvas.width  = w = nw;
      canvas.height = h = nh;
      gl.viewport(0, 0, w, h);
    }
  }

  /* ---- pause when off-screen ---- */

  let visible = true;
  new IntersectionObserver(
    (e) => { visible = e[0].isIntersecting; },
    { threshold: 0 }
  ).observe(canvas);

  /* ---- render loop ---- */

  function frame(ms) {
    if (visible) {
      resize();
      gl.uniform1f(uTime, ms * 0.001);
      gl.uniform2f(uRes, w, h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
