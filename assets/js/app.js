import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

// ============================================================
// CONFIG & THEME
// ============================================================
const isMobile = window.innerWidth < 768;
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

// Cinematic Palette
const colors = {
  dark: { accentPrimary: 0xff1a40, accentSecondary: 0x00d2ff, points: 0xffffff, edges: 0xff1a40, bgBase: 0x03070b },
  light: { accentPrimary: 0xa10d24, accentSecondary: 0x0055aa, points: 0x080808, edges: 0xaa0022, bgBase: 0xf7f6f3 }
};

// ============================================================
// 1. RENDERER & SCENE
// ============================================================
const canvas = document.querySelector('#webgl-canvas');
if (!canvas) throw new Error('No #webgl-canvas found');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(isDark() ? colors.dark.bgBase : colors.light.bgBase, 0.035);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setClearColor(isDark() ? 0x030508 : 0xf4f4f4, 1);

// ============================================================
// 2. LIGHTING (Cinematic Setup)
// ============================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const rimLeft = new THREE.SpotLight(isDark() ? colors.dark.accentPrimary : colors.light.accentPrimary, 40);
rimLeft.position.set(-6, 4, -4);
rimLeft.angle = Math.PI / 4;
rimLeft.penumbra = 1.0;
scene.add(rimLeft);

const rimRight = new THREE.SpotLight(isDark() ? colors.dark.accentSecondary : colors.light.accentSecondary, 30);
rimRight.position.set(6, -4, -2);
rimRight.angle = Math.PI / 4;
rimRight.penumbra = 1.0;
scene.add(rimRight);

// ============================================================
// 3. POST-PROCESSING (Cinematic Optics)
// ============================================================
let composer = null;
let bloomPass = null;
let bokehPass = null;
let grainPass = null;

const FilmGrainShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uIntensity: { value: 0.04 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uIntensity; varying vec2 vUv;
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
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Deep, elegant bloom (not overpowering)
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.12, 0.3, 0.92);
  composer.addPass(bloomPass);

  // Cinematic Depth of Field (Rack Focus)
  bokehPass = new BokehPass(scene, camera, {
    focus: 10.0,
    aperture: 0.0001,
    maxblur: 0.02,
    width: window.innerWidth,
    height: window.innerHeight
  });
  composer.addPass(bokehPass);

  // High-end 35mm style film grain
  grainPass = new ShaderPass(FilmGrainShader);
  composer.addPass(grainPass);

  composer.addPass(new OutputPass());
}

// ============================================================
// 4. GROUPS
// ============================================================
const objectGroup = new THREE.Group();
const floatGroup = new THREE.Group();
floatGroup.add(objectGroup);
scene.add(floatGroup);

const getInitialX = () => isMobile ? 0 : Math.max(2.6, window.innerWidth * 0.0017);
let initialX = getInitialX();
objectGroup.position.set(initialX, -0.2, 0);

// ============================================================
// 5. TEXTURES & CUSTOM MATERIALS
// ============================================================
const circleCanvas = document.createElement('canvas');
circleCanvas.width = 64; circleCanvas.height = 64;
const ctx = circleCanvas.getContext('2d');
const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
gradient.addColorStop(0, 'rgba(255,255,255,1)');
gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
gradient.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
const circleTexture = new THREE.CanvasTexture(circleCanvas);

// Custom Uniforms for our breathing point shader
const customUniforms = {
  uTime: { value: 0 },
  uColor: { value: new THREE.Color(isDark() ? colors.dark.points : colors.light.points) },
  uMorph: { value: 0 }
};

// Edge lines: razor thin, elegant
const edgeMat = new THREE.LineBasicMaterial({
  color: isDark() ? colors.dark.edges : colors.light.edges,
  transparent: true,
  opacity: isDark() ? 0.2 : 0.6,
  blending: isDark() ? THREE.AdditiveBlending : THREE.NormalBlending,
  depthWrite: false,
});

// Points: Custom Shader injection for breathing life
const pointsMat = new THREE.PointsMaterial({
  map: circleTexture,
  size: 0.06,
  transparent: true,
  opacity: 1.0,
  blending: isDark() ? THREE.AdditiveBlending : THREE.NormalBlending,
  sizeAttenuation: true,
  depthWrite: false,
});

pointsMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = customUniforms.uTime;
  shader.uniforms.uCustomColor = customUniforms.uColor;
  shader.uniforms.uMorph = customUniforms.uMorph;
  shader.vertexShader = `
    uniform float uTime;
    uniform float uMorph;
    attribute vec3 pos1;
    attribute vec3 pos2;
    attribute vec3 pos3;
    varying float vPulse;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 = v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute( permute( permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }

    ${shader.vertexShader}
  `.replace(
    `#include <begin_vertex>`,
    `
    vec3 targetPos = position;
    if (uMorph < 1.0) targetPos = mix(position, pos1, uMorph);
    else if (uMorph < 2.0) targetPos = mix(pos1, pos2, uMorph - 1.0);
    else targetPos = mix(pos2, pos3, clamp(uMorph - 2.0, 0.0, 1.0));

    float fractP = fract(uMorph);
    float easeSwarm = sin(fractP * 3.14159);
    
    vec3 disp = vec3(
       snoise(targetPos * 2.1 + vec3(uTime)),
       snoise(targetPos * 2.2 + vec3(0.0, uTime, 0.0)),
       snoise(targetPos * 2.3 + vec3(0.0, 0.0, uTime))
    );
    targetPos += disp * easeSwarm * 1.5;

    vec3 transformed = targetPos;
    vPulse = sin(uTime * 1.5 + transformed.x * 5.0 + transformed.y * 3.0) * 0.5 + 0.5;
    `
  ).replace(
    `gl_PointSize = size;`,
    `gl_PointSize = size * (0.2 + vPulse * 0.8) * (1.0 + easeSwarm * 2.0);`
  );
  shader.fragmentShader = `
    uniform vec3 uCustomColor;
    varying float vPulse;
    ${shader.fragmentShader}
  `.replace(
    `vec4 diffuseColor = vec4( diffuse, opacity );`,
    `vec4 diffuseColor = vec4( uCustomColor, opacity * (0.08 + vPulse * 0.15) );`
  );
};

// ============================================================
// 6. LOAD GLB MODEL
// ============================================================
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.173.0/examples/jsm/libs/draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const maxParticles = 60000;

function extractVertices(model) {
  const positions = [];
  model.updateMatrixWorld(true);
  model.traverse((child) => {
    if (child.isMesh && child.geometry) {
      const pos = child.geometry.attributes.position;
      if (!pos) return;
      const mat = child.matrixWorld;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mat);
        positions.push(v);
      }
    }
  });

  if (positions.length === 0) {
    console.error('MODEL HAS ZERO VERTICES: ', model.uuid);
    for (let i = 0; i < maxParticles; i++) positions.push(new THREE.Vector3());
  }

  positions.sort(() => Math.random() - 0.5);

  const box = new THREE.Box3().setFromPoints(positions);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(0.01, size.x, size.y, size.z);
  const center = box.getCenter(new THREE.Vector3());
  const s = 6.0 / maxDim;

  const finalArray = new Float32Array(maxParticles * 3);
  for (let i = 0; i < maxParticles; i++) {
    const v = positions[i % positions.length].clone();
    v.sub(center).multiplyScalar(s);
    v.x += (Math.random() - 0.5) * 0.02;
    v.y += (Math.random() - 0.5) * 0.02;
    v.z += (Math.random() - 0.5) * 0.02;

    finalArray[i * 3] = v.x;
    finalArray[i * 3 + 1] = v.y;
    finalArray[i * 3 + 2] = v.z;
  }
  return finalArray;
}

const overlay = document.getElementById('loading-overlay');
edgeMat.opacity = 0;
customUniforms.uColor.value.multiplyScalar(0);

const loadModel = (url) => new Promise((resolve, reject) => {
  gltfLoader.load(url, resolve, undefined, reject);
});

Promise.all([
  loadModel('/site/assets/models/highres-draco.glb'),
  loadModel('/site/assets/models/neural-net-draco.glb'),
  loadModel('/site/assets/models/server-rack-draco.glb'),
  loadModel('/site/assets/models/cityscape-draco.glb')
]).then(([carGltf, neuralGltf, serverGltf, cityGltf]) => {

  const pos0 = extractVertices(carGltf.scene);
  const pos1 = extractVertices(neuralGltf.scene);
  const pos2 = extractVertices(serverGltf.scene);
  const pos3 = extractVertices(cityGltf.scene);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos0, 3));
  geometry.setAttribute('pos1', new THREE.BufferAttribute(pos1, 3));
  geometry.setAttribute('pos2', new THREE.BufferAttribute(pos2, 3));
  geometry.setAttribute('pos3', new THREE.BufferAttribute(pos3, 3));

  const morphPoints = new THREE.Points(geometry, pointsMat);
  objectGroup.add(morphPoints);

  // Re-scale the hero car mesh to perfectly overlay the initial points
  const box = new THREE.Box3().setFromObject(carGltf.scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = 6.0 / Math.max(size.x, size.y, size.z);

  carGltf.scene.scale.setScalar(s);
  carGltf.scene.position.sub(center.multiplyScalar(s));

  carGltf.scene.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshBasicMaterial({ visible: false });
      const edges = new THREE.EdgesGeometry(child.geometry, 35);
      child.add(new THREE.LineSegments(edges, edgeMat));
    }
  });

  objectGroup.add(carGltf.scene);

  if (overlay) overlay.classList.add('fade-out');

  objectGroup.scale.setScalar(0.9);
  gsap.to(objectGroup.scale, { x: 1, y: 1, z: 1, duration: 2.5, ease: 'power3.out' });
  gsap.to(edgeMat, { opacity: isDark() ? 0.35 : 0.2, duration: 2.0, ease: 'power2.out', delay: 0.3 });

  const targetColor = new THREE.Color(isDark() ? colors.dark.points : colors.light.points);
  gsap.to(customUniforms.uColor.value, {
    r: targetColor.r, g: targetColor.g, b: targetColor.b,
    duration: 2.0, ease: 'power2.out', delay: 0.1
  });
}).catch(console.error);

setTimeout(() => { if (overlay) overlay.classList.add('fade-out'); }, 8000);

// ============================================================
// 7. CINEMATIC FOREGROUND DUST (MACRO PARTICLES)
// ============================================================
const dustCount = isMobile ? 150 : 400;
const dustPos = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount * 3; i++) {
  dustPos[i] = (Math.random() - 0.5) * 20;
}
const dustGeom = new THREE.BufferGeometry();
dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));

const dustMat = new THREE.PointsMaterial({
  map: circleTexture,
  size: 0.08, // larger for that macro bokeh blur effect
  color: 0xffffff,
  transparent: true,
  opacity: isDark() ? 0.15 : 0.4,
  blending: isDark() ? THREE.AdditiveBlending : THREE.NormalBlending,
  depthWrite: false,
});
if (!isDark()) dustMat.color.setHex(0xaaaaaa);
const dustSystem = new THREE.Points(dustGeom, dustMat);
scene.add(dustSystem);

// HUD / UI dynamic elements update
const hudCoords = document.querySelector('.hud-coords');
const header = document.querySelector('.site-header');

window.addEventListener('scroll', () => {
  if (header) {
    if (window.scrollY > 50) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  }
});

// ============================================================
// 8. MOUSE PARALLAX & THEME SYNC
// ============================================================
const mouse = new THREE.Vector2(0, 0);
const targetMouse = new THREE.Vector2(0, 0);

if (!isMobile) {
  window.addEventListener('mousemove', (e) => {
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });
}

window.onThemeChange = function (theme) {
  const dark = theme === 'dark';
  const c = dark ? colors.dark : colors.light;

  scene.fog.color.setHex(c.bgBase);
  renderer.setClearColor(c.bgBase, 1);
  edgeMat.color.setHex(c.edges);
  edgeMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
  pointsMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;

  edgeMat.opacity = dark ? 0.2 : 0.6;
  dustMat.opacity = dark ? 0.15 : 0.4;
  dustMat.color.setHex(dark ? 0xffffff : 0xaaaaaa);
  dustMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;

  gsap.to(customUniforms.uColor.value, { r: new THREE.Color(c.points).r, g: new THREE.Color(c.points).g, b: new THREE.Color(c.points).b, duration: 1 });
  gsap.to(rimLeft.color, { r: new THREE.Color(c.accentPrimary).r, g: new THREE.Color(c.accentPrimary).g, b: new THREE.Color(c.accentPrimary).b, duration: 1 });
  gsap.to(rimRight.color, { r: new THREE.Color(c.accentSecondary).r, g: new THREE.Color(c.accentSecondary).g, b: new THREE.Color(c.accentSecondary).b, duration: 1 });

  if (bloomPass) bloomPass.strength = dark ? 0.18 : 0.08;
};

// ============================================================
// 9. GSAP SCROLL (RACK FOCUS & DOLLY)
// ============================================================
gsap.registerPlugin(ScrollTrigger);
const scrollWrapper = document.querySelector('.smooth-scroll-wrapper');

// Scroll timeline for continuous motion
const scrollTl = gsap.timeline({
  scrollTrigger: { trigger: scrollWrapper, start: 'top top', end: 'bottom bottom', scrub: 1.5, invalidateOnRefresh: true }
});

// Fly the model into view gracefully
scrollTl.fromTo(objectGroup.position, { x: () => getInitialX(), z: 0 }, { x: () => isMobile ? 0 : -1.0, z: 1.0, ease: 'power1.inOut' }, 0);
scrollTl.fromTo(objectGroup.rotation, { y: 0, x: 0, z: 0 }, { y: Math.PI * 1.8, x: 0.4, z: -0.15, ease: 'none' }, 0);
// Move dust towards camera
scrollTl.to(dustSystem.position, { z: 5, y: 2, ease: 'none' }, 0);
// Drive Morph progress and fade out structural wireframe 
scrollTl.to(customUniforms.uMorph, { value: 3.0, ease: 'none' }, 0);
scrollTl.to(edgeMat, { opacity: 0, duration: 0.05, ease: 'power1.out' }, 0.02);

// Section-driven Lighting & Bokeh Focus (Cinematic Triggers)
function triggerCinematicState(state) {
  const dark = isDark();
  const c = dark ? colors.dark : colors.light;

  switch (state) {
    case 'hero':
      gsap.to(rimLeft, { intensity: 40, duration: 1.5 });
      gsap.to(rimRight, { intensity: 30, duration: 1.5 });
      if (bokehPass) gsap.to(bokehPass.uniforms.focus, { value: 10.0, duration: 1.5, ease: 'power2.out' });
      if (bloomPass) gsap.to(bloomPass, { strength: dark ? 0.18 : 0.08, duration: 1.5 });
      break;

    case 'dissolve':
      // Rack Focus: Blur the model deeply as text appears
      if (bokehPass) gsap.to(bokehPass.uniforms.focus, { value: 3.0, duration: 2.0, ease: 'power3.inOut' });
      gsap.to(rimLeft, { intensity: 10, duration: 2.0 });
      gsap.to(rimRight, { intensity: 50, duration: 2.0 });
      break;

    case 'autonomous':
      // Snap focus back sharply
      if (bokehPass) gsap.to(bokehPass.uniforms.focus, { value: 6.0, duration: 1.5, ease: 'back.out(1.2)' });
      gsap.to(rimLeft.color, { r: 1.0, g: 0.1, b: 0.2, duration: 1.5 }); // Deep Red
      gsap.to(rimRight.color, { r: 0.0, g: 0.8, b: 1.0, duration: 1.5 }); // Cyan
      gsap.to(rimLeft, { intensity: 60, duration: 1.5 });
      break;

    case 'networks':
      // Soft, wide focus. Colors shift to deep blue/purple network vibe
      if (bokehPass) gsap.to(bokehPass.uniforms.focus, { value: 7.5, duration: 2.0, ease: 'sine.inOut' });
      gsap.to(rimLeft.color, { r: 0.4, g: 0.1, b: 1.0, duration: 2.0 }); // Purple
      gsap.to(rimRight.color, { r: 0.0, g: 1.0, b: 0.8, duration: 2.0 }); // Teal
      if (bloomPass) gsap.to(bloomPass, { strength: dark ? 0.25 : 0.1, duration: 2.0 });
      break;

    case 'final':
      // Fade out into blur
      if (bokehPass) gsap.to(bokehPass.uniforms.focus, { value: 2.0, duration: 2.5 });
      gsap.to(rimLeft, { intensity: 10, duration: 2.5 });
      gsap.to(rimRight, { intensity: 10, duration: 2.5 });
      if (bloomPass) gsap.to(bloomPass, { strength: 0.05, duration: 2.5 });
      break;
  }
}

document.querySelectorAll('[data-scene-state]').forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 55%',
    end: 'bottom 45%',
    onEnter: () => triggerCinematicState(section.dataset.sceneState),
    onEnterBack: () => triggerCinematicState(section.dataset.sceneState),
  });
});

// Hero text animations — immediate on page load, no scroll reverse
document.querySelectorAll('.hero-section .reveal-mask').forEach((mask, i) => {
  gsap.from(mask.children, {
    y: '120%', opacity: 0, duration: 1.4, ease: 'power4.out',
    delay: 0.15 + i * 0.12,
  });
});

document.querySelectorAll('.hero-section .fade-up').forEach((el, i) => {
  gsap.from(el, {
    y: 30, opacity: 0, duration: 1.2, ease: 'power3.out',
    delay: 0.4 + i * 0.15,
  });
});

// Scroll-triggered text animations (non-hero sections)
gsap.utils.toArray('.info-section .reveal-mask, .transition-section .reveal-mask').forEach(mask => {
  gsap.from(mask.children, {
    y: '120%', opacity: 0, duration: 1.4, ease: 'power4.out', stagger: 0.1,
    scrollTrigger: { trigger: mask, start: 'top 85%', toggleActions: 'play none none none' }
  });
});

gsap.utils.toArray('.info-section .fade-up, .transition-section .fade-up, .stats-section .fade-up').forEach(el => {
  gsap.from(el, {
    y: 30, opacity: 0, duration: 1.2, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
  });
});

// ============================================================
// 10. RENDER LOOP
// ============================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  customUniforms.uTime.value = t;

  // Gentle, cinematic float
  floatGroup.position.y = Math.sin(t * 0.8) * 0.1;
  floatGroup.rotation.z = Math.sin(t * 0.4) * 0.02;

  // Dust slowly drifts
  dustSystem.rotation.y = t * 0.02;
  dustSystem.rotation.x = t * 0.01;

  if (grainPass) grainPass.uniforms.uTime.value = t;

  // Smooth mouse follow (Parallax)
  if (!isMobile) {
    mouse.lerp(targetMouse, 0.04);
    camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.04;
    camera.position.y += (mouse.y * 0.5 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  }

  // Update dynamic HUD (if still present)
  if (hudCoords) {
    const lat = (41.40338 + Math.sin(t * 0.2) * 0.001).toFixed(5);
    const lng = (2.17403 + Math.cos(t * 0.2) * 0.001).toFixed(5);
    const zIndex = (camera.position.z).toFixed(2);
    hudCoords.innerHTML = `${lat}N ${lng}E / Z:${zIndex}`;
  }

  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  initialX = getInitialX();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight);
    if (bokehPass) {
      bokehPass.uniforms['aspect'].value = window.innerWidth / window.innerHeight;
    }
  }
});

canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
canvas.addEventListener('webglcontextrestored', () => { animate(); });
