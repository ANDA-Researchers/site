import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ============================================================
// CONFIG & THEME
// ============================================================
const isMobile = window.innerWidth < 768;
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

const colors = {
  dark: {
    accentPrimary: 0xff314f,
    accentSecondary: 0x35d6ff,
    bgBase: 0x04080d
  },
  light: {
    accentPrimary: 0xb3122a,
    accentSecondary: 0x0b67c2,
    bgBase: 0xf7f6f3
  }
};

// Per-model accent colors: car=red, city=gold, server=green, neural=cyan
const modelAccents = {
  dark:  [0xff4433, 0xddaa22, 0x1a8866, 0x33bbdd],
  light: [0xaa1122, 0x996611, 0x0a6650, 0x0a6699]
};

const getThemeColors = () => (isDark() ? colors.dark : colors.light);

// ============================================================
// 1. RENDERER & SCENE
// ============================================================
const canvas = document.querySelector('#webgl-canvas');
if (!canvas) throw new Error('No #webgl-canvas found');

const themeColors = getThemeColors();
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(themeColors.bgBase, isDark() ? 0.008 : 0.006);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 0, isMobile ? 11.4 : 10.6);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  premultipliedAlpha: false,
  antialias: !isMobile,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = isDark() ? 1.15 : 1.1;
renderer.setClearColor(themeColors.bgBase, 0);

// ============================================================
// 2. ENVIRONMENT MAP (studio lighting, no HDRI file needed)
// ============================================================
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
const envMap = pmremGenerator.fromScene(new RoomEnvironment()).texture;
scene.environment = envMap;
pmremGenerator.dispose();

// ============================================================
// 3. LIGHTING
// ============================================================
const ambientLight = new THREE.AmbientLight(0xffffff, isDark() ? 0.5 : 1.0);
scene.add(ambientLight);

const hemisphereLight = new THREE.HemisphereLight(
  isDark() ? 0x8ab4ff : 0xffffff,
  isDark() ? 0x112233 : 0xd8d0c5,
  isDark() ? 0.7 : 1.2
);
scene.add(hemisphereLight);

const keyLight = new THREE.DirectionalLight(0xffffff, isDark() ? 1.8 : 2.0);
keyLight.position.set(4.5, 3.4, 7.5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(isDark() ? 0x6699ff : 0xffffff, isDark() ? 0.7 : 0.8);
fillLight.position.set(-5.2, 1.8, 4.5);
scene.add(fillLight);

// Extra bottom fill to prevent dark undersides
const bottomFill = new THREE.DirectionalLight(0xffffff, isDark() ? 0.3 : 0.5);
bottomFill.position.set(0, -4, 3);
scene.add(bottomFill);

const rimLeft = new THREE.SpotLight(themeColors.accentPrimary, isDark() ? 20 : 14);
rimLeft.position.set(-6, 4, -1);
rimLeft.angle = Math.PI / 4;
rimLeft.penumbra = 1;
scene.add(rimLeft);

const rimRight = new THREE.SpotLight(themeColors.accentSecondary, isDark() ? 16 : 10);
rimRight.position.set(6, -2.5, 1.5);
rimRight.angle = Math.PI / 4;
rimRight.penumbra = 1;
scene.add(rimRight);

// ============================================================
// 4. GROUPS
// ============================================================
const objectGroup = new THREE.Group();
const meshGroup = new THREE.Group();
const floatGroup = new THREE.Group();

objectGroup.add(meshGroup);
floatGroup.add(objectGroup);
scene.add(floatGroup);

// Shifted further right so it doesn't touch left-aligned text
const getInitialX = () => (isMobile ? 0.3 : Math.max(2.2, window.innerWidth * 0.0016));
let initialX = getInitialX();
objectGroup.position.set(initialX, isMobile ? -0.08 : -0.03, 0);
objectGroup.rotation.set(0.08, -0.32, 0);

// ============================================================
// 5. MODEL LOADING
// ============================================================
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.173.0/examples/jsm/libs/draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const displayModels = [];
const sceneReveal = { value: 0 };
const morphProgress = { value: 0 };

function createNormalizedModel(root, targetSize = 5.8) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = targetSize / Math.max(0.01, size.x, size.y, size.z);

  const wrapper = new THREE.Group();
  wrapper.position.copy(center).multiplyScalar(-scale);
  wrapper.scale.setScalar(scale);
  wrapper.add(root);
  return wrapper;
}

function getModelMaterial(index, dark) {
  const accent = new THREE.Color((dark ? modelAccents.dark : modelAccents.light)[index]);
  if (dark) {
    // Dark: emissive-driven color (glowing from within), subtle surface detail
    return {
      color: accent.clone().multiplyScalar(0.15),
      emissive: accent,
      emissiveIntensity: 0.3,
      metalness: 0.35,
      roughness: 0.45,
      envMapIntensity: 0.6,
    };
  }
  // Light: deep saturated color, near-zero env reflection to prevent washout
  return {
    color: accent,
    emissive: accent.clone().multiplyScalar(0.3),
    emissiveIntensity: 0.5,
    metalness: 0.1,
    roughness: 0.6,
    envMapIntensity: 0.1,
  };
}

function createDisplayModel(root, index) {
  const dark = isDark();
  const accent = new THREE.Color((dark ? modelAccents.dark : modelAccents.light)[index]);

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  root.traverse((child) => {
    if (!child.isMesh) return;
    // High threshold = only sharp creases shown = sparse clean edges
    const edges = new THREE.EdgesGeometry(child.geometry, 30);
    const lineSegments = new THREE.LineSegments(edges, edgeMaterial);
    lineSegments.position.copy(child.position);
    lineSegments.rotation.copy(child.rotation);
    lineSegments.scale.copy(child.scale);
    child.parent.add(lineSegments);
    child.visible = false;
  });

  root.visible = false;
  meshGroup.add(root);

  return { root, wireMaterial: edgeMaterial, index };
}

function applyModelTheme(themeName = isDark() ? 'dark' : 'light') {
  const dark = themeName === 'dark';

  displayModels.forEach((entry) => {
    const accent = new THREE.Color((dark ? modelAccents.dark : modelAccents.light)[entry.index]);
    entry.wireMaterial.color.copy(accent);
    entry.wireMaterial.needsUpdate = true;
  });
}

// Smooth sequential transitions: one model at a time, smooth fade + scale.
function syncDisplayModels() {
  if (displayModels.length === 0) return;

  const phase = THREE.MathUtils.clamp(morphProgress.value, 0, displayModels.length - 1);
  const reveal = sceneReveal.value;
  if (reveal < 0.001) return;

  displayModels.forEach((entry, index) => {
    const dist = Math.abs(phase - index);

    // Each model fades over a 0.5 range — but only the closest model shows.
    // This prevents overlap while keeping smooth transitions.
    let vis = 0;
    if (dist < 0.5) {
      // Smooth fade: fully visible at dist=0, gone at dist=0.5
      vis = 1 - dist * 2;
      vis = vis * vis * (3 - 2 * vis); // smoothstep
    }

    vis *= reveal;
    const show = vis > 0.005;

    entry.root.visible = show;
    entry.wireMaterial.opacity = vis * 0.7;

    // Scale effect: slightly smaller during fade, full size when visible
    if (show && entry.root.children[0]) {
      const s = 0.92 + 0.08 * vis;
      entry.root.children[0].scale.setScalar(s);
    }
  });
}

const overlay = document.getElementById('loading-overlay');

const loadModel = (url) =>
  new Promise((resolve, reject) => {
    gltfLoader.load(url, resolve, undefined, reject);
  });

// Order: car, cityscape, server-rack, neural-net (swapped 2 & 4)
const modelUrls = [
  new URL('../models/highres-draco.glb', import.meta.url).href,
  new URL('../models/cityscape-draco.glb', import.meta.url).href,
  new URL('../models/server-rack-draco.glb', import.meta.url).href,
  new URL('../models/neural-net-draco.glb', import.meta.url).href
];

function revealScene() {
  applyModelTheme();
  syncDisplayModels();
  if (overlay) overlay.classList.add('fade-out');
  objectGroup.scale.setScalar(0.94);
  gsap.to(objectGroup.scale, { x: 1, y: 1, z: 1, duration: 2, ease: 'power3.out' });
  gsap.to(sceneReveal, {
    value: 1,
    duration: 1.8,
    ease: 'power2.out',
    onUpdate: syncDisplayModels
  });
}

// Progressive loading: show after first model, load rest in background
loadModel(modelUrls[0])
  .then((gltf) => {
    displayModels.push(createDisplayModel(createNormalizedModel(gltf.scene), 0));
    revealScene();
    // Load remaining models in background
    return Promise.all(modelUrls.slice(1).map(loadModel));
  })
  .then((gltfs) => {
    gltfs.forEach((gltf, i) => {
      displayModels.push(createDisplayModel(createNormalizedModel(gltf.scene), i + 1));
    });
    applyModelTheme();
    syncDisplayModels();
  })
  .catch((error) => {
    document.documentElement.classList.add('scene-failed');
    if (overlay) overlay.classList.add('fade-out');
    console.error(error);
  });

setTimeout(() => {
  if (overlay) overlay.classList.add('fade-out');
}, 8000);

// ============================================================
// 6. SUBTLE DUST PARTICLES
// ============================================================
const dustCount = isMobile ? 40 : 80;
const dustPos = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  dustPos[i * 3] = (Math.random() - 0.5) * 22;
  dustPos[i * 3 + 1] = (Math.random() - 0.5) * 22;
  dustPos[i * 3 + 2] = (Math.random() - 0.5) * 14;
}

const dustGeom = new THREE.BufferGeometry();
dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));

const dustMat = new THREE.PointsMaterial({
  size: isMobile ? 0.02 : 0.025,
  color: isDark() ? 0x8899aa : 0xaaaaaa,
  transparent: true,
  opacity: isDark() ? 0.08 : 0.14,
  blending: isDark() ? THREE.AdditiveBlending : THREE.NormalBlending,
  depthWrite: false,
  sizeAttenuation: true
});

const dustSystem = new THREE.Points(dustGeom, dustMat);
scene.add(dustSystem);

// ============================================================
// 7. HEADER SCROLL
// ============================================================
const header = document.querySelector('.site-header');

window.addEventListener('scroll', () => {
  if (!header) return;
  if (window.scrollY > 50) header.classList.add('scrolled');
  else header.classList.remove('scrolled');
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
  scene.fog.density = dark ? 0.008 : 0.006;
  renderer.setClearColor(c.bgBase, 0);
  renderer.toneMappingExposure = dark ? 1.15 : 1.1;

  ambientLight.intensity = dark ? 0.5 : 1.0;
  hemisphereLight.color.setHex(dark ? 0x8ab4ff : 0xffffff);
  hemisphereLight.groundColor.setHex(dark ? 0x112233 : 0xd8d0c5);
  hemisphereLight.intensity = dark ? 0.7 : 1.2;
  keyLight.intensity = dark ? 1.8 : 2.0;
  fillLight.color.setHex(dark ? 0x6699ff : 0xffffff);
  fillLight.intensity = dark ? 0.7 : 0.8;
  bottomFill.intensity = dark ? 0.4 : 0.5;

  gsap.to(rimLeft.color, {
    r: new THREE.Color(c.accentPrimary).r,
    g: new THREE.Color(c.accentPrimary).g,
    b: new THREE.Color(c.accentPrimary).b,
    duration: 1
  });
  gsap.to(rimRight.color, {
    r: new THREE.Color(c.accentSecondary).r,
    g: new THREE.Color(c.accentSecondary).g,
    b: new THREE.Color(c.accentSecondary).b,
    duration: 1
  });
  rimLeft.intensity = dark ? 20 : 14;
  rimRight.intensity = dark ? 16 : 10;

  dustMat.opacity = dark ? 0.08 : 0.14;
  dustMat.color.setHex(dark ? 0x8899aa : 0xaaaaaa);
  dustMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;

  applyModelTheme(theme);
  syncDisplayModels();
};

// ============================================================
// 9. GSAP SCROLL
// ============================================================
gsap.registerPlugin(ScrollTrigger);
const scrollWrapper = document.querySelector('.smooth-scroll-wrapper');

const scrollTl = gsap.timeline({
  scrollTrigger: {
    trigger: scrollWrapper,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
    invalidateOnRefresh: true
  }
});

scrollTl.fromTo(
  objectGroup.position,
  { x: () => getInitialX(), y: () => (isMobile ? -0.08 : -0.03), z: 0 },
  { x: () => (isMobile ? 0.2 : -0.1), y: 0.02, z: 0.55, ease: 'sine.inOut' },
  0
);

scrollTl.fromTo(
  objectGroup.rotation,
  { y: -0.32, x: 0.08, z: 0 },
  { y: Math.PI * 0.95, x: 0.18, z: -0.05, ease: 'none' },
  0
);

scrollTl.to(dustSystem.position, { z: 3.5, y: 1.2, ease: 'none' }, 0);
scrollTl.to(morphProgress, { value: 3, ease: 'none' }, 0);

function triggerCinematicState(state) {
  const dark = isDark();
  const c = dark ? colors.dark : colors.light;

  switch (state) {
    case 'hero':
      gsap.to(keyLight, { intensity: dark ? 2.3 : 1.7, duration: 1.2 });
      gsap.to(fillLight, { intensity: dark ? 0.7 : 0.45, duration: 1.2 });
      gsap.to(rimLeft, { intensity: dark ? 15 : 8, duration: 1.2 });
      gsap.to(rimRight, { intensity: dark ? 12 : 6, duration: 1.2 });
      break;

    case 'dissolve':
      gsap.to(keyLight, { intensity: dark ? 2.0 : 1.4, duration: 1.2 });
      gsap.to(fillLight, { intensity: dark ? 0.9 : 0.6, duration: 1.2 });
      gsap.to(rimLeft, { intensity: dark ? 10 : 6, duration: 1.2 });
      gsap.to(rimRight, { intensity: dark ? 16 : 10, duration: 1.2 });
      break;

    case 'autonomous':
      gsap.to(keyLight, { intensity: dark ? 2.4 : 1.8, duration: 1.2 });
      gsap.to(fillLight, { intensity: dark ? 0.6 : 0.4, duration: 1.2 });
      gsap.to(rimLeft.color, {
        r: new THREE.Color(c.accentPrimary).r,
        g: new THREE.Color(c.accentPrimary).g,
        b: new THREE.Color(c.accentPrimary).b,
        duration: 1.2
      });
      gsap.to(rimRight.color, {
        r: new THREE.Color(c.accentSecondary).r,
        g: new THREE.Color(c.accentSecondary).g,
        b: new THREE.Color(c.accentSecondary).b,
        duration: 1.2
      });
      gsap.to(rimLeft, { intensity: dark ? 18 : 12, duration: 1.2 });
      gsap.to(rimRight, { intensity: dark ? 10 : 6, duration: 1.2 });
      break;

    case 'networks':
      gsap.to(keyLight, { intensity: dark ? 2.0 : 1.5, duration: 1.2 });
      gsap.to(fillLight, { intensity: dark ? 1.0 : 0.7, duration: 1.2 });
      gsap.to(rimLeft.color, { r: 0.2, g: 0.6, b: 1, duration: 1.2 });
      gsap.to(rimRight.color, { r: 0.05, g: 0.85, b: 0.65, duration: 1.2 });
      gsap.to(rimLeft, { intensity: dark ? 14 : 8, duration: 1.2 });
      gsap.to(rimRight, { intensity: dark ? 16 : 10, duration: 1.2 });
      break;

    case 'final':
      gsap.to(keyLight, { intensity: dark ? 1.6 : 1.2, duration: 1.4 });
      gsap.to(fillLight, { intensity: dark ? 0.5 : 0.35, duration: 1.4 });
      gsap.to(rimLeft, { intensity: dark ? 10 : 5, duration: 1.4 });
      gsap.to(rimRight, { intensity: dark ? 10 : 5, duration: 1.4 });
      break;
  }
}

document.querySelectorAll('[data-scene-state]').forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 55%',
    end: 'bottom 45%',
    onEnter: () => triggerCinematicState(section.dataset.sceneState),
    onEnterBack: () => triggerCinematicState(section.dataset.sceneState)
  });
});

document.querySelectorAll('.hero-section .reveal-mask').forEach((mask, i) => {
  gsap.from(mask.children, {
    y: '120%',
    opacity: 0,
    duration: 1.4,
    ease: 'power4.out',
    delay: 0.15 + i * 0.12
  });
});

document.querySelectorAll('.hero-section .fade-up').forEach((el, i) => {
  gsap.from(el, {
    y: 30,
    opacity: 0,
    duration: 1.2,
    ease: 'power3.out',
    delay: 0.4 + i * 0.15
  });
});

gsap.utils.toArray('.info-section .reveal-mask, .transition-section .reveal-mask').forEach((mask) => {
  gsap.from(mask.children, {
    y: '120%',
    opacity: 0,
    duration: 1.4,
    ease: 'power4.out',
    stagger: 0.1,
    scrollTrigger: { trigger: mask, start: 'top 85%', toggleActions: 'play none none none' }
  });
});

gsap.utils
  .toArray('.info-section .fade-up, .transition-section .fade-up, .stats-section .fade-up')
  .forEach((el) => {
    gsap.from(el, {
      y: 30,
      opacity: 0,
      duration: 1.2,
      ease: 'power3.out',
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

  syncDisplayModels();

  floatGroup.position.y = Math.sin(t * 0.8) * 0.08;
  floatGroup.rotation.z = Math.sin(t * 0.35) * 0.012;

  dustSystem.rotation.y = t * 0.012;
  dustSystem.rotation.x = t * 0.005;

  if (!isMobile) {
    mouse.lerp(targetMouse, 0.04);
    camera.position.x += (mouse.x * 0.32 - camera.position.x) * 0.04;
    camera.position.y += (mouse.y * 0.22 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  initialX = getInitialX();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
});

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
});

canvas.addEventListener('webglcontextrestored', () => {
  animate();
});
