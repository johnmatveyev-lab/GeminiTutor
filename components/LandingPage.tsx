import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ── Tuning constants (match the approved design) ─────────────────────────────
const ACCENT = '#00aaff';        // particle accent color
const PARTICLE_COUNT = 28000;    // main saddle-sheet particles
const SWIRL = 2;                 // surface deformation strength
const AUTO_SPIN = true;          // slow idle rotation

const hexToRgb = (h: string): [number, number, number] => {
  let s = (h || '#5b8cff').replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const VERT = `
  uniform float uSize;
  uniform float uTime;
  attribute vec3 aColor;
  attribute float aScale;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vTw;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.7 + 0.3 * sin(uTime * 1.6 + aSeed * 6.2831);
    gl_PointSize = uSize * aScale * (300.0 / -mv.z);
    vColor = aColor;
    vTw = tw;
  }`;

const FRAG = `
  varying vec3 vColor;
  varying float vTw;
  void main(){
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    a = pow(a, 1.6);
    gl_FragColor = vec4(vColor * vTw, a);
  }`;

const buildMainGeometry = (): THREE.BufferGeometry => {
  const COUNT = PARTICLE_COUNT;
  const accent = hexToRgb(ACCENT);
  const R = 520;
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);
  const scl = new Float32Array(COUNT);
  const seed = new Float32Array(COUNT);
  const deep = [0.09, 0.16, 0.52];

  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.pow(Math.random(), 0.62); // bias toward rim
    const rad = R * rr;
    let x = Math.cos(a) * rad;
    let y = Math.sin(a) * rad;
    const nx = x / R, ny = y / R;
    // saddle surface -> butterfly / V / arc cross sections when rotated
    let z = SWIRL * ((nx * nx - ny * ny) * 200.0);
    z += SWIRL * Math.sin(nx * 5.5 + ny * 3.0) * 22.0;
    z += SWIRL * Math.cos(rr * 7.0 + a * 2.0) * 10.0;
    z += (Math.random() - 0.5) * 16.0; // sheet thickness
    x += (Math.random() - 0.5) * 10.0;
    y += (Math.random() - 0.5) * 10.0;

    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;

    // brightness: rim + occasional hot sparkle
    const m = Math.min(1, rr * 0.55 + Math.pow(Math.random(), 3.0) * 1.05);
    const dim = 0.95;
    col[i * 3] = (deep[0] + (accent[0] - deep[0]) * m) * dim;
    col[i * 3 + 1] = (deep[1] + (accent[1] - deep[1]) * m) * dim;
    col[i * 3 + 2] = (deep[2] + (accent[2] - deep[2]) * m) * dim;
    if (Math.random() < 0.03) { col[i * 3] += 0.5; col[i * 3 + 1] += 0.55; col[i * 3 + 2] += 0.6; }

    scl[i] = 0.6 + Math.random() * 1.1 + rr * 0.5;
    seed[i] = Math.random();
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return g;
};

const buildBgGeometry = (): THREE.BufferGeometry => {
  const COUNT = 16000;
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);
  const scl = new Float32Array(COUNT);
  const seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    // screen-filling ellipsoid of diffuse dust behind the ridges
    const u = Math.random(), v = Math.random();
    const a = u * Math.PI * 2;
    const ph = Math.acos(2 * v - 1);
    const rr = Math.cbrt(Math.random());
    pos[i * 3] = rr * 760 * Math.sin(ph) * Math.cos(a);
    pos[i * 3 + 1] = rr * 470 * Math.sin(ph) * Math.sin(a);
    pos[i * 3 + 2] = rr * 340 * Math.cos(ph);
    if (Math.random() < 0.08) { // faint magenta motes
      col[i * 3] = 0.34; col[i * 3 + 1] = 0.11; col[i * 3 + 2] = 0.22;
    } else {
      const b = 0.16 + Math.random() * 0.30;
      col[i * 3] = b * 0.45; col[i * 3 + 1] = b * 0.72; col[i * 3 + 2] = b * 1.4;
    }
    scl[i] = 0.55 + Math.random() * 1.2;
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  return g;
};

const ctaStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '16px 40px',
  borderRadius: 999,
  background: 'linear-gradient(180deg,#6f9bff,#3f6fff)',
  color: '#fff',
  textDecoration: 'none',
  fontSize: 19,
  fontWeight: 500,
  boxShadow: '0 10px 40px rgba(63,111,255,0.4)',
};

const sectionStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 10,
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '0 24px',
};

export const LandingPage: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scroller = scrollRef.current;
    if (!canvas || !scroller) return;

    const st = {
      alive: true,
      raf: 0,
      time: 0,
      scrollP: 0,
      mouse: { x: 0, y: 0 },
      cur: { rx: -0.72, ry: 0, rz: 0, camx: 0, camy: 0 },
      tgt: { rx: -0.72, ry: 0, rz: 0, camx: 0, camy: 0 },
    };

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 4000);
    camera.position.set(0, 0, 560);

    const group = new THREE.Group();
    const bgGroup = new THREE.Group();
    scene.add(group);
    scene.add(bgGroup);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: 6.6 }, uTime: { value: 0 } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const bgMat = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: 3.4 }, uTime: { value: 0 } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const mainGeom = buildMainGeometry();
    const bgGeom = buildBgGeometry();
    group.add(new THREE.Points(mainGeom, mat));
    bgGroup.add(new THREE.Points(bgGeom, bgMat));

    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const onScroll = () => {
      const max = (scroller.scrollHeight - scroller.clientHeight) || 1;
      st.scrollP = Math.max(0, Math.min(1, scroller.scrollTop / max));
      if (hintRef.current) hintRef.current.style.opacity = st.scrollP > 0.02 ? '0' : '1';
    };
    const onMouse = (e: MouseEvent) => {
      st.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      st.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse, { passive: true });
    scroller.addEventListener('scroll', onScroll, { passive: true });
    onResize();
    onScroll();

    const loop = () => {
      if (!st.alive) return;
      st.raf = requestAnimationFrame(loop);
      st.time += 0.016;
      const spin = AUTO_SPIN ? st.time * 0.045 : 0;

      st.tgt.ry = st.mouse.x * 0.28 + Math.sin(st.time * 0.045) * 0.16 + st.scrollP * 0.5;
      st.tgt.rx = -0.72 + st.scrollP * 0.55 + st.mouse.y * 0.16;
      st.tgt.rz = st.scrollP * Math.PI * 1.25 + spin;
      st.tgt.camx = st.mouse.x * 55;
      st.tgt.camy = -st.mouse.y * 35;

      const k = 0.055;
      st.cur.rx += (st.tgt.rx - st.cur.rx) * k;
      st.cur.ry += (st.tgt.ry - st.cur.ry) * k;
      st.cur.rz += (st.tgt.rz - st.cur.rz) * k;
      st.cur.camx += (st.tgt.camx - st.cur.camx) * 0.06;
      st.cur.camy += (st.tgt.camy - st.cur.camy) * 0.06;

      group.rotation.set(st.cur.rx, st.cur.ry, st.cur.rz);
      bgGroup.rotation.y = st.cur.ry * 0.12 + st.time * 0.006;
      bgGroup.rotation.x = st.cur.rx * 0.1;

      camera.position.x = st.cur.camx;
      camera.position.y = st.cur.camy;
      camera.lookAt(0, 0, 0);

      mat.uniforms.uTime.value = st.time;
      bgMat.uniforms.uTime.value = st.time;
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      st.alive = false;
      cancelAnimationFrame(st.raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouse);
      scroller.removeEventListener('scroll', onScroll);
      mainGeom.dispose();
      bgGeom.dispose();
      mat.dispose();
      bgMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#000',
        color: '#fff',
        fontFamily: "'Outfit', system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'block', zIndex: 0, pointerEvents: 'none' }}
      />
      {/* vignette to deepen edges */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 70% at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* NAV */}
      <header
        style={{
          position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 40px', pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, pointerEvents: 'auto' }}>
          <div style={{ position: 'relative', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                width: 17, height: 17, borderRadius: '5px 11px 5px 11px', transform: 'rotate(45deg)',
                background: 'linear-gradient(135deg,#9bb8ff 0%, #4f7cff 45%, #2348c9 100%)',
                boxShadow: '0 0 16px rgba(79,124,255,0.7)',
              }}
            />
          </div>
          <span style={{ fontSize: 25, fontWeight: 500, letterSpacing: '-0.01em', color: '#fff', whiteSpace: 'nowrap' }}>
            Gemini Tutor
          </span>
        </div>

        <div style={{ pointerEvents: 'auto' }}>
          <a
            href="/app"
            style={{
              display: 'inline-block', padding: '12px 26px', borderRadius: 999,
              background: 'linear-gradient(180deg,#6f9bff,#3f6fff)', color: '#fff',
              textDecoration: 'none', fontSize: 16, fontWeight: 500, whiteSpace: 'nowrap',
              boxShadow: '0 6px 24px rgba(63,111,255,0.35)',
            }}
          >
            Try Gemini Tutor
          </a>
        </div>
      </header>

      {/* HERO */}
      <section style={sectionStyle}>
        <h1
          style={{
            margin: 0, fontWeight: 500, lineHeight: 0.98, letterSpacing: '-0.02em',
            fontSize: 'clamp(44px,8.2vw,128px)', maxWidth: '14ch',
            textShadow: '0 2px 40px rgba(0,0,0,0.55)',
          }}
        >
          Building the world&rsquo;s most capable AI tutor.
        </h1>
        <a href="/app" style={{ ...ctaStyle, marginTop: 42 }}>Try Gemini Tutor</a>
      </section>

      {/* SCROLL SECTION 2 */}
      <section style={sectionStyle}>
        <p style={{ margin: 0, fontSize: 'clamp(15px,1.4vw,19px)', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7e8aa8', fontWeight: 500 }}>
          Every subject
        </p>
        <h2
          style={{
            margin: '18px 0 0', fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.02em',
            fontSize: 'clamp(38px,6vw,92px)', maxWidth: '16ch', textShadow: '0 2px 40px rgba(0,0,0,0.6)',
          }}
        >
          Learn anything, one question at a time.
        </h2>
      </section>

      {/* SCROLL SECTION 3 */}
      <section style={sectionStyle}>
        <h2
          style={{
            margin: 0, fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.02em',
            fontSize: 'clamp(38px,6vw,92px)', maxWidth: '15ch', textShadow: '0 2px 40px rgba(0,0,0,0.6)',
          }}
        >
          A patient mind for every learner.
        </h2>
        <a href="/app" style={{ ...ctaStyle, marginTop: 42 }}>Start learning free</a>
      </section>

      {/* scroll hint */}
      <div
        ref={hintRef}
        style={{ position: 'fixed', bottom: 26, left: 0, width: '100%', zIndex: 15, textAlign: 'center', pointerEvents: 'none', transition: 'opacity 0.4s ease' }}
      >
        <span style={{ fontSize: 14, color: '#7e8aa8', letterSpacing: '0.05em' }}>Scroll to explore &darr;</span>
      </div>
    </div>
  );
};

export default LandingPage;
