import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// --- 1. Basic Setup ---
const canvas = document.querySelector('#webgl-canvas');
if (!canvas) throw new Error('No #webgl-canvas found');

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,          // transparent bg so body background shows through
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// --- 2. Lighting ---
const ambientLight = new THREE.AmbientLight(0xfff5e0, 0.8); // warm ambient
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight.position.set(6, 8, 5);
scene.add(dirLight);

// Warm fill from below-left
const fillLight = new THREE.DirectionalLight(0xffe0b0, 1.0);
fillLight.position.set(-5, -3, 3);
scene.add(fillLight);

// Accent red — brand colour
const pointLight = new THREE.PointLight(0xEE1C24, 4, 18);
pointLight.position.set(-3, -2, 2);
scene.add(pointLight);

// Cool rim for contrast
const rimLight = new THREE.PointLight(0xaaccff, 1.5, 15);
rimLight.position.set(4, 4, -3);
scene.add(rimLight);

// --- 3. Object Group ---
const objectGroup = new THREE.Group();
scene.add(objectGroup);

// ==========================================================
// TO ADD YOUR BLENDER MODEL:
//   1. Delete the PLACEHOLDER MESH block below.
//   2. Uncomment the loader block.
//   3. Place your exported model.glb in /assets/models/
// ==========================================================

// --- LOAD GLB MODEL ---
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
// Cardboard / kraft paper material
const cardboardMat = new THREE.MeshStandardMaterial({
  color: 0xc8a97e,       // warm kraft brown
  roughness: 0.92,
  metalness: 0.0,
  envMapIntensity: 0.3,
});

// Wireframe overlay on top — gives the "schematic mesh" feel
const wireMat = new THREE.MeshBasicMaterial({
  color: 0x7a5c3a,       // darker brown lines
  wireframe: true,
  transparent: true,
  opacity: 0.25,
});

loader.load('/site/assets/models/highres-draco.glb', (gltf) => {
  const model = gltf.scene;

  // Fit model into view automatically
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 5 / maxDim;
  model.scale.setScalar(scale);
  model.position.sub(center.multiplyScalar(scale));
  model.position.y -= 0.5;

  // Collect meshes first, then apply — avoids traverse re-visiting added children
  const meshes = [];
  model.traverse((child) => { if (child.isMesh) meshes.push(child); });

  meshes.forEach((child) => {
    child.material = cardboardMat;
    child.castShadow = true;

    const wire = new THREE.Mesh(child.geometry, wireMat);
    wire.scale.setScalar(1.002);
    child.add(wire);
  });

  objectGroup.add(model);
}, undefined, (err) => {
  console.error('GLB load error:', err);
});

// Floating particles
const particlesCount = 400;
const posArray = new Float32Array(particlesCount * 3);
for (let i = 0; i < particlesCount * 3; i++) posArray[i] = (Math.random() - 0.5) * 18;
const particlesGeom = new THREE.BufferGeometry();
particlesGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMat = new THREE.PointsMaterial({
  size: 0.025,
  color: isDark() ? 0xffffff : 0x111111,
  transparent: true,
  opacity: isDark() ? 0.35 : 0.2
});
const particleMesh = new THREE.Points(particlesGeom, particlesMat);
scene.add(particleMesh);
// -------------------------

// --- 4. Theme change handler (called by header.html toggleTheme) ---
window.onThemeChange = function (theme) {
  const dark = theme === 'dark';
  particlesMat.color.setHex(dark ? 0xffffff : 0x111111);
  particlesMat.opacity = dark ? 0.35 : 0.2;
};

// --- 5. GSAP Scroll Animations ---
gsap.registerPlugin(ScrollTrigger);

const scrollWrapper = document.querySelector('.smooth-scroll-wrapper');

gsap.to(objectGroup.rotation, {
  y: Math.PI * 2,
  x: 0.5,
  ease: 'none',
  scrollTrigger: {
    trigger: scrollWrapper,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.5
  }
});

gsap.to(objectGroup.position, {
  z: 2,
  y: 1,
  ease: 'none',
  scrollTrigger: {
    trigger: scrollWrapper,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.5
  }
});

gsap.to(particleMesh.position, {
  y: 3,
  ease: 'none',
  scrollTrigger: {
    trigger: scrollWrapper,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 2
  }
});

gsap.to(pointLight.position, {
  x: 3,
  y: 2,
  ease: 'none',
  scrollTrigger: {
    trigger: scrollWrapper,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 3
  }
});

// Intro text entrance
gsap.from('.split-text', {
  y: 60,
  opacity: 0,
  duration: 1.6,
  ease: 'power4.out',
  delay: 0.3
});
gsap.from('.fade-in-text', {
  y: 25,
  opacity: 0,
  duration: 1.6,
  ease: 'power4.out',
  delay: 0.7,
  stagger: 0.2
});

// Section content fade-in on scroll
gsap.utils.toArray('.info-section .content-block').forEach((block) => {
  gsap.from(block, {
    y: 40,
    opacity: 0,
    duration: 1.2,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: block,
      start: 'top 80%',
      toggleActions: 'play none none none'
    }
  });
});

// --- 6. Render Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  objectGroup.rotation.y += 0.003;

  particleMesh.rotation.y = t * 0.015;
  particleMesh.rotation.x = t * 0.008;

  pointLight.intensity = 5 + Math.sin(t * 1.5) * 1.5;

  renderer.render(scene, camera);
}
animate();

// --- 7. Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
