// Nathan-Kugel: ein einziger WebGL-Fragment-Shader. Kein Framework, laeuft auf iPhone Safari.
// Die App setzt nur Zielwerte (Farbe, Energie, Wirbel, Arbeitsring, Pegel), hier wird weich ueberblendet.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLevel;
uniform float uEnergy;
uniform float uWork;
uniform vec3 uColA;
uniform vec3 uColB;
uniform float uCenterY;
uniform float uRadius;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p) {
  float a = 0.5; float s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * snoise(p); p *= 2.03; a *= 0.5; }
  return s;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float m = min(uRes.x, uRes.y);
  vec2 c = vec2(uRes.x * 0.5, uRes.y * (1.0 - uCenterY));
  vec2 p = (frag - c) / m;
  float r = length(p);
  float ang = atan(p.y, p.x);
  float t = uTime;

  float breathe = 0.02 * sin(t * 1.25) * (1.0 - uEnergy * 0.6);
  float R = uRadius * (1.0 + breathe + 0.11 * uLevel);
  float wob = snoise(vec3(cos(ang) * 1.4, sin(ang) * 1.4, t * 0.55)) * (0.010 + 0.06 * uLevel);
  float Re = R * (1.0 + wob);

  vec3 col = vec3(0.0);
  float halo = exp(-max(r - Re, 0.0) * 8.5) * (0.22 + 0.5 * uEnergy + 0.7 * uLevel);
  col += uColB * halo * 0.5;

  float inside = smoothstep(Re + 0.003, Re - 0.003, r);
  if (inside > 0.0) {
    float q = clamp(r / Re, 0.0, 1.0);
    float z = sqrt(1.0 - q * q);
    vec3 n = vec3(p / Re, z);
    float a = t * 0.16;
    mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
    mat2 rot2 = mat2(cos(-a * 1.3), -sin(-a * 1.3), sin(-a * 1.3), cos(-a * 1.3));
    vec3 sp = n * 1.1;
    sp.xz = rot * sp.xz;
    vec3 sq = n * 2.2;
    sq.yz = rot2 * sq.yz;
    float n1 = snoise(sp + vec3(0.0, 0.0, t * 0.22));
    float n2 = snoise(sp * 2.1 - vec3(t * 0.17));
    float veins = pow(clamp(1.0 - abs(n1 + 0.35 * n2), 0.0, 1.0), 8.0);
    float m1 = snoise(sq + vec3(t * 0.12, 0.0, 0.0));
    float veins2 = pow(clamp(1.0 - abs(m1), 0.0, 1.0), 10.0);
    float mist = 0.5 + 0.5 * fbm(sp * 0.8 + vec3(t * 0.08));
    float fres = pow(1.0 - z, 2.4);
    vec3 body = uColA * (0.03 + 0.22 * mist * (0.4 + uEnergy));
    body += mix(uColA, uColB, 0.6) * veins * (0.5 + 0.8 * uEnergy + 0.9 * uLevel);
    body += uColB * veins2 * (0.18 + 0.4 * uEnergy + 0.6 * uLevel);
    body += uColB * fres * (0.7 + 0.9 * uLevel);
    body += mix(uColB, vec3(1.0), 0.5) * pow(z, 5.0) * (0.06 + 0.32 * uLevel + 0.1 * uEnergy);
    col = mix(col, body, inside);
  }

  col += uColB * exp(-abs(r - Re) * 170.0) * (0.3 + 0.5 * uEnergy);

  if (uWork > 0.001) {
    float rr = R * 1.42;
    float band = exp(-abs(r - rr) * 230.0);
    float seg = step(0.55, fract((ang / 6.2831853) * 28.0 - t * 0.35));
    float sweep = 0.5 + 0.5 * cos(ang - t * 2.0);
    col += uColB * band * seg * (0.2 + 0.8 * pow(sweep, 3.0)) * uWork;
    float rr2 = R * 1.62;
    float band2 = exp(-abs(r - rr2) * 400.0);
    col += uColB * band2 * 0.25 * uWork * (0.5 + 0.5 * cos(ang * 3.0 + t * 0.8));
  }

  vec2 uv = frag / uRes;
  float vig = 1.0 - smoothstep(0.2, 1.2, length(uv - 0.5) * 1.3);
  col += vec3(0.010, 0.013, 0.018) * vig;

  col = 1.0 - exp(-col * 1.6);
  col += (fract(sin(dot(frag, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const PALETTE = {
  idle:       { a: [0.24, 0.52, 0.95], b: [0.45, 0.72, 1.00], energy: 0.18, swirl: 0.6, work: 0 },
  connecting: { a: [0.30, 0.45, 0.95], b: [0.55, 0.65, 1.00], energy: 0.35, swirl: 1.8, work: 0 },
  listening:  { a: [0.18, 0.74, 1.00], b: [0.55, 0.90, 1.00], energy: 0.55, swirl: 1.0, work: 0 },
  thinking:   { a: [0.46, 0.40, 1.00], b: [0.72, 0.66, 1.00], energy: 0.62, swirl: 2.8, work: 0 },
  speaking:   { a: [0.95, 0.50, 0.14], b: [1.00, 0.68, 0.30], energy: 0.78, swirl: 1.2, work: 0 },
  working:    { a: [0.08, 0.78, 0.68], b: [0.36, 0.95, 0.84], energy: 0.50, swirl: 1.7, work: 1 },
};

export function createOrb(canvas, { centerY = 0.40, radius = 0.30 } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL nicht verfuegbar');

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  for (const name of ['uRes', 'uTime', 'uLevel', 'uEnergy', 'uWork', 'uColA', 'uColB', 'uCenterY', 'uRadius']) {
    u[name] = gl.getUniformLocation(prog, name);
  }

  const cur = { ...structuredClone(PALETTE.idle), level: 0 };
  let target = structuredClone(PALETTE.idle);
  let level = 0;
  let phase = 0;
  let last = performance.now();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  const mix = (a, b, k) => a + (b - a) * k;

  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    resize();
    const k = 1 - Math.exp(-dt * 3.2);
    for (let i = 0; i < 3; i++) {
      cur.a[i] = mix(cur.a[i], target.a[i], k);
      cur.b[i] = mix(cur.b[i], target.b[i], k);
    }
    cur.energy = mix(cur.energy, target.energy, k);
    cur.swirl = mix(cur.swirl, target.swirl, k);
    cur.work = mix(cur.work, target.work, k);
    const lk = 1 - Math.exp(-dt * (level > cur.level ? 18 : 6));
    cur.level = mix(cur.level, level, lk);
    phase += dt * cur.swirl;

    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, phase);
    gl.uniform1f(u.uLevel, Math.min(cur.level, 1));
    gl.uniform1f(u.uEnergy, cur.energy);
    gl.uniform1f(u.uWork, cur.work);
    gl.uniform3fv(u.uColA, cur.a);
    gl.uniform3fv(u.uColB, cur.b);
    gl.uniform1f(u.uCenterY, centerY);
    gl.uniform1f(u.uRadius, radius);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    setState(name) { target = structuredClone(PALETTE[name] || PALETTE.idle); },
    setLevel(v) { level = Math.max(0, Math.min(1, v)); },
    // Lage der Kugel: Mitte als Anteil der Hoehe von oben, Radius als Anteil der kurzen Bildschirmseite.
    setLayout(c, r) { centerY = c; radius = r; },
  };
}
