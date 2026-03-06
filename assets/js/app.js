import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ============================================================
// CONFIG
// ============================================================
const isMobile = window.innerWidth < 768;
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

// ============================================================
// 1. RENDERER & SCENE
// ============================================================
const canvas = document.querySelector('#webgl-canvas');
if (!canvas) throw new Error('No #webgl-canvas found');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: isMobile ? 'default' : 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// ============================================================
// 2. LIGHTING (no RoomEnvironment — wireframe doesn't need it)
// ============================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const redRim = new THREE.SpotLight(0xEE1C24, 30);
redRim.position.set(-5, 5, -5);
redRim.angle = Math.PI / 3;
redRim.penumbra = 0.8;
scene.add(redRim);

const cyanRim = new THREE.SpotLight(0x00e5ff, 20);
cyanRim.position.set(5, -5, -3);
cyanRim.angle = Math.PI / 3;
cyanRim.penumbra = 0.8;
scene.add(cyanRim);

// ============================================================
// 3. POST-PROCESSING (desktop only)
// ============================================================
let composer = null;
let bloomPass = null;
let chromaticPass = null;
let grainPass = null;

const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.0012 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - 0.5;
      float d = length(dir);
      float offset = uIntensity * d;
      float r = texture2D(tDiffuse, vUv + dir * offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - dir * offset).b;
      gl_FragColor = vec4(r, g, b, texture2D(tDiffuse, vUv).a);
    }
  `
};

const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uIntensity: { value: 0.025 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float grain = (hash(vUv * 1000.0 + uTime) - 0.5) * uIntensity;
      gl_FragColor = vec4(color.rgb + grain, color.a);
    }
  `
};

if (!isMobile) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    isDark() ? 0.12 : 0.06, 0.3, 0.95
  );
  composer.addPass(bloomPass);

  chromaticPass = new ShaderPass(ChromaticAberrationShader);
  composer.addPass(chromaticPass);

  grainPass = new ShaderPass(FilmGrainShader);
  composer.addPass(grainPass);

  composer.addPass(new OutputPass());
}

// ============================================================
// 4. GROUPS
// objectGroup: GSAP scroll drives position + rotation (ONLY GSAP touches this)
// floatGroup: render loop drives idle float on y (sin wave)
// floatGroup contains objectGroup; scene contains floatGroup
// ============================================================
const objectGroup = new THREE.Group();
const floatGroup = new THREE.Group();
floatGroup.add(objectGroup);
scene.add(floatGroup);

// Set initial position IMMEDIATELY — before GSAP registers it
const initialX = isMobile ? 0 : 2.5;
objectGroup.position.set(initialX, -0.2, 0);

// ============================================================
// 5. ROUND PARTICLE TEXTURE (canvas-generated soft circle)
// ============================================================
const circleCanvas = document.createElement('canvas');
circleCanvas.width = 64;
circleCanvas.height = 64;
const ctx = circleCanvas.getContext('2d');
const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
gradient.addColorStop(0, 'rgba(255,255,255,1)');
gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)');
gradient.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 64, 64);
const circleTexture = new THREE.CanvasTexture(circleCanvas);

// ============================================================
// 6. MATERIALS — Wireframe mesh-net look
// ============================================================

// Ghost surface: nearly invisible, just hints at the shape
// MUST use NormalBlending — additive stacks overlapping faces into a white blob
const ghostMat = new THREE.MeshBasicMaterial({
  color: isDark() ? 0xEE1C24 : 0x999999,
  transparent: true,
  opacity: isDark() ? 0.015 : 0.04,
  blending: THREE.NormalBlending,
  depthWrite: false,
});

// Edge lines: structural edges only — the main mesh-net look
// Start with NormalBlending — switch to Additive after assembly (prevents red blob)
const edgeMat = new THREE.LineBasicMaterial({
  color: isDark() ? 0xEE1C24 : 0x222222,
  transparent: true,
  opacity: isDark() ? 0.45 : 0.45,
  blending: THREE.NormalBlending,
});

// Vertex points: tiny dots at each vertex for sparkle
// Start with NormalBlending — switch to Additive after assembly
const pointsMat = new THREE.PointsMaterial({
  map: circleTexture,
  color: isDark() ? 0x00e5ff : 0x555555,
  size: 0.008,
  transparent: true,
  opacity: isDark() ? 0.4 : 0.35,
  blending: THREE.NormalBlending,
  sizeAttenuation: true,
  depthWrite: false,
});

// ============================================================
// 6. LOAD GLB MODEL — wireframe mesh-net style
// ============================================================
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.173.0/examples/jsm/libs/draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// All materials start invisible for fade-in entrance
ghostMat.opacity = 0;
edgeMat.opacity = 0;
pointsMat.opacity = 0;

const overlay = document.getElementById('loading-overlay');

gltfLoader.load('/site/assets/models/highres-draco.glb', (gltf) => {
  const model = gltf.scene;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const s = 5.5 / maxDim;
  model.scale.setScalar(s);
  model.position.sub(center.multiplyScalar(s));

  // Pre-compute edges behind overlay (heavy work hidden from user)
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.material = ghostMat;

    const edges = new THREE.EdgesGeometry(child.geometry, 40);
    child.add(new THREE.LineSegments(edges, edgeMat));

    const ptsGeom = child.geometry.clone();
    child.add(new THREE.Points(ptsGeom, pointsMat));
  });

  objectGroup.add(model);

  const darkNow = isDark();

  // Set final blending modes
  if (darkNow) {
    edgeMat.blending = THREE.AdditiveBlending;
    pointsMat.blending = THREE.AdditiveBlending;
  }

  // Dismiss overlay, then fade everything in
  if (overlay) overlay.classList.add('fade-out');

  // Simple, clean fade-in with slight scale
  objectGroup.scale.setScalar(0.95);
  gsap.to(objectGroup.scale, { x: 1, y: 1, z: 1, duration: 1.8, ease: 'power2.out', delay: 0.2 });
  gsap.to(edgeMat, { opacity: darkNow ? 0.45 : 0.45, duration: 1.5, ease: 'power2.out', delay: 0.2 });
  gsap.to(pointsMat, { opacity: darkNow ? 0.4 : 0.35, duration: 1.5, ease: 'power2.out', delay: 0.4 });
  gsap.to(ghostMat, { opacity: darkNow ? 0.015 : 0.04, duration: 1.5, delay: 0.6 });
}, undefined, (err) => {
  console.error('GLB load error:', err);
  if (overlay) overlay.classList.add('fade-out');
});

// Safety net: dismiss overlay after 10s even if model fails
setTimeout(() => { if (overlay) overlay.classList.add('fade-out'); }, 10000);

// ============================================================
// 7. BACKGROUND PARTICLES — tiny pinpoint stars
// ============================================================
const particlesCount = isMobile ? 400 : 1200;
const posArray = new Float32Array(particlesCount * 3);
for (let i = 0; i < particlesCount * 3; i++) {
  posArray[i] = (Math.random() - 0.5) * 30;
}

const particlesGeom = new THREE.BufferGeometry();
particlesGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

const bgParticlesMat = new THREE.PointsMaterial({
  map: circleTexture,
  size: isDark() ? 0.025 : 0.04,
  color: isDark() ? 0xffffff : 0x777777,
  transparent: true,
  opacity: isDark() ? 0.5 : 0.3,
  sizeAttenuation: true,
  blending: isDark() ? THREE.AdditiveBlending : THREE.NormalBlending,
  depthWrite: false,
});

const bgParticles = new THREE.Points(particlesGeom, bgParticlesMat);
scene.add(bgParticles);

// ============================================================
// 8. MOUSE INTERACTIVITY (desktop only)
// ============================================================
const mouse = new THREE.Vector2(0, 0);
const targetMouse = new THREE.Vector2(0, 0);
const baseLightPos = { redX: -5, redY: 5, cyanX: 5, cyanY: -5 };

if (!isMobile) {
  window.addEventListener('mousemove', (e) => {
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });
}

// ============================================================
// 9. THEME CHANGE SYNC
// ============================================================
window.onThemeChange = function (theme) {
  const dark = theme === 'dark';

  // Ghost surface (always NormalBlending to prevent additive stacking)
  ghostMat.color.setHex(dark ? 0xEE1C24 : 0x999999);
  ghostMat.opacity = dark ? 0.015 : 0.04;

  // Edges
  edgeMat.color.setHex(dark ? 0xEE1C24 : 0x222222);
  edgeMat.opacity = dark ? 0.45 : 0.45;
  edgeMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;

  // Points
  pointsMat.color.setHex(dark ? 0x00e5ff : 0x555555);
  pointsMat.opacity = dark ? 0.4 : 0.35;
  pointsMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;

  // Background particles
  bgParticlesMat.color.setHex(dark ? 0xffffff : 0x777777);
  bgParticlesMat.size = dark ? 0.025 : 0.04;
  bgParticlesMat.opacity = dark ? 0.5 : 0.3;
  bgParticlesMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;

  // Post-processing
  if (bloomPass) bloomPass.strength = dark ? 0.12 : 0.06;
};

// ============================================================
// 10. GSAP SCROLL ANIMATIONS
// ============================================================
gsap.registerPlugin(ScrollTrigger);
const scrollWrapper = document.querySelector('.smooth-scroll-wrapper');

// Scroll progress tracker (for chromatic aberration)
gsap.to({}, {
  scrollTrigger: {
    trigger: scrollWrapper,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,
    onUpdate: (self) => {
      if (chromaticPass) {
        chromaticPass.uniforms.uIntensity.value = 0.0008 + Math.sin(self.progress * Math.PI) * 0.0015;
      }
    }
  }
});

// Model position: smooth sweep from right to left
// Use fromTo so GSAP knows the exact start value — no fighting with async load
gsap.fromTo(objectGroup.position,
  { x: initialX, z: 0 },
  {
    x: isMobile ? 0 : -2.5,
    z: 2,
    ease: 'power1.inOut',
    scrollTrigger: {
      trigger: scrollWrapper,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.5,
    }
  }
);

// Model rotation: smooth continuous spin — NO idle rotation in render loop
gsap.fromTo(objectGroup.rotation,
  { y: 0, x: 0, z: 0 },
  {
    y: Math.PI * 2.5,
    x: 0.3,
    z: -0.2,
    ease: 'none',
    scrollTrigger: {
      trigger: scrollWrapper,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.5,
    }
  }
);

// Background particles drift up
gsap.to(bgParticles.position, {
  y: 3,
  ease: 'none',
  scrollTrigger: { trigger: scrollWrapper, start: 'top top', end: 'bottom bottom', scrub: 2 }
});

// --- Section-driven lighting states ---
function transitionToState(state) {
  const dark = isDark();
  switch (state) {
    case 'hero':
      gsap.to(redRim, { intensity: 30, duration: 1 });
      gsap.to(cyanRim, { intensity: 20, duration: 1 });
      gsap.to(edgeMat, { opacity: dark ? 0.45 : 0.45, duration: 1 });
      break;
    case 'dissolve':
      if (bloomPass) gsap.to(bloomPass, { strength: dark ? 0.18 : 0.08, duration: 1.5 });
      break;
    case 'autonomous':
      gsap.to(redRim, { intensity: 50, duration: 1 });
      gsap.to(cyanRim, { intensity: 10, duration: 1 });
      gsap.to(edgeMat.color, { r: 0.93, g: 0.11, b: 0.14, duration: 1 });
      break;
    case 'network-transition':
      gsap.to(edgeMat, { opacity: dark ? 0.55 : 0.5, duration: 1 });
      break;
    case 'networks':
      gsap.to(redRim, { intensity: 15, duration: 1 });
      gsap.to(cyanRim, { intensity: 40, duration: 1 });
      gsap.to(edgeMat.color, { r: 0.0, g: 0.9, b: 1.0, duration: 1 });
      break;
    case 'stats':
      gsap.to(redRim, { intensity: 25, duration: 1 });
      gsap.to(cyanRim, { intensity: 25, duration: 1 });
      if (bloomPass) gsap.to(bloomPass, { strength: dark ? 0.12 : 0.06, duration: 1 });
      break;
    case 'join':
      gsap.to(redRim, { intensity: 30, duration: 1 });
      gsap.to(cyanRim, { intensity: 30, duration: 1 });
      gsap.to(edgeMat.color, { r: dark ? 0.93 : 0.27, g: dark ? 0.11 : 0.27, b: dark ? 0.14 : 0.27, duration: 1 });
      break;
    case 'final':
      gsap.to(redRim, { intensity: 15, duration: 1.5 });
      gsap.to(cyanRim, { intensity: 10, duration: 1.5 });
      gsap.to(edgeMat, { opacity: dark ? 0.2 : 0.15, duration: 1.5 });
      if (bloomPass) gsap.to(bloomPass, { strength: dark ? 0.08 : 0.04, duration: 1.5 });
      break;
  }
}

document.querySelectorAll('[data-scene-state]').forEach((section) => {
  const state = section.dataset.sceneState;
  ScrollTrigger.create({
    trigger: section,
    start: 'top 60%',
    end: 'bottom 40%',
    onEnter: () => transitionToState(state),
    onEnterBack: () => transitionToState(state),
  });
});

// --- Text entrance animations ---
gsap.utils.toArray('.kinetic-heading .line').forEach((line, i) => {
  gsap.from(line, {
    y: '110%', opacity: 0, duration: 1.2, ease: 'power4.out',
    delay: 0.15 + i * 0.12,
  });
});

gsap.from('.accent-dot', { scale: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)', delay: 0.6 });
gsap.from('.hero-subtitle', { y: 25, opacity: 0, duration: 1.4, ease: 'power4.out', delay: 0.5 });
gsap.from('.lab-badge', { y: 15, opacity: 0, duration: 1.2, ease: 'power4.out', delay: 0.7 });
gsap.from('.scroll-indicator', { opacity: 0, duration: 1.5, ease: 'power2.out', delay: 1.2 });

gsap.utils.toArray('.transition-section .large-quote').forEach((quote) => {
  gsap.fromTo(quote, { y: 30, opacity: 0 }, {
    y: 0, opacity: 1, duration: 1.2, ease: 'power3.out',
    scrollTrigger: { trigger: quote, start: 'top 75%', toggleActions: 'play none none reverse' }
  });
});

gsap.utils.toArray('.info-section .content-block').forEach((block) => {
  gsap.from(block, {
    y: 40, opacity: 0, duration: 1.2, ease: 'power3.out',
    scrollTrigger: { trigger: block, start: 'top 80%', toggleActions: 'play none none none' }
  });
});

gsap.utils.toArray('.stat-number').forEach((el) => {
  const target = parseInt(el.dataset.count, 10);
  const obj = { val: 0 };
  gsap.to(obj, {
    val: target, duration: 2, ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
    onUpdate: () => { el.textContent = Math.round(obj.val) + '+'; }
  });
});

gsap.from('.stat-item', {
  y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.15,
  scrollTrigger: { trigger: '.stats-section', start: 'top 75%', toggleActions: 'play none none none' }
});

// ============================================================
// 11. RENDER LOOP
// ============================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Idle float only (no rotation — GSAP handles rotation via scroll)
  floatGroup.position.y = Math.sin(t * 1.5) * 0.08;

  // Slow particle field rotation
  bgParticles.rotation.y = t * 0.015;
  bgParticles.rotation.x = t * 0.008;

  // Film grain time
  if (grainPass) grainPass.uniforms.uTime.value = t;

  // Mouse interactivity (desktop only)
  if (!isMobile) {
    mouse.lerp(targetMouse, 0.05);

    // Subtle float group tilt from mouse (doesn't fight with GSAP on objectGroup)
    floatGroup.rotation.x += (mouse.y * 0.06 - floatGroup.rotation.x) * 0.02;
    floatGroup.rotation.z += (-mouse.x * 0.03 - floatGroup.rotation.z) * 0.02;

    // Lights follow mouse gently
    redRim.position.x += (baseLightPos.redX + mouse.x * 2 - redRim.position.x) * 0.01;
    redRim.position.y += (baseLightPos.redY + mouse.y * 1.5 - redRim.position.y) * 0.01;
    cyanRim.position.x += (baseLightPos.cyanX + mouse.x * 1.5 - cyanRim.position.x) * 0.01;
    cyanRim.position.y += (baseLightPos.cyanY + mouse.y * 2 - cyanRim.position.y) * 0.01;
  }

  // Render
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}
animate();

// ============================================================
// 12. RESIZE
// ============================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
// 13. WEBGL CONTEXT LOSS
// ============================================================
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
canvas.addEventListener('webglcontextrestored', () => { animate(); });
