import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ============================================================
// CONFIG & THEME
// ============================================================
const isMobile = window.innerWidth < 768;
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

const colors = {
  dark:  { bgBase: 0x04080d },
  light: { bgBase: 0xf7f6f3 }
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
// On mobile, lock to initial viewport size to prevent address bar show/hide shifts
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setClearColor(themeColors.bgBase, 0);

// No lights, no environment map, no tone mapping needed —
// wireframe MeshBasicMaterial ignores all of these.

// ============================================================
// 2. GROUPS
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
// 3. MODEL LOADING
// ============================================================
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.173.0/examples/jsm/libs/draco/');
dracoLoader.setDecoderConfig({ type: 'wasm' });
dracoLoader.preload();
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

function createDisplayModel(root, index) {
  const dark = isDark();
  const accent = new THREE.Color((dark ? modelAccents.dark : modelAccents.light)[index]);

  const wireMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    wireframe: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const fillMaterial = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  root.traverse((child) => {
    if (!child.isMesh) return;
    // Solid fill clone underneath
    const fillMesh = child.clone();
    fillMesh.material = fillMaterial;
    child.parent.add(fillMesh);
    // Wireframe on top
    child.material = wireMaterial;
  });

  root.visible = false;
  meshGroup.add(root);

  return { root, wireMaterial, fillMaterial, index };
}

function applyModelTheme(themeName = isDark() ? 'dark' : 'light') {
  const dark = themeName === 'dark';
  displayModels.forEach((entry) => {
    const accent = new THREE.Color((dark ? modelAccents.dark : modelAccents.light)[entry.index]);
    entry.wireMaterial.color.copy(accent);
    entry.wireMaterial.needsUpdate = true;
    entry.fillMaterial.color.copy(accent);
    entry.fillMaterial.needsUpdate = true;
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

    let vis = 0;
    if (dist < 0.5) {
      vis = 1 - dist * 2;
      vis = vis * vis * (3 - 2 * vis); // smoothstep
    }

    vis *= reveal;
    const show = vis > 0.005;

    entry.root.visible = show;
    entry.wireMaterial.opacity = vis * 0.07;
    entry.fillMaterial.opacity = vis * 0.18;

    if (show && entry.root.children[0]) {
      const s = 0.92 + 0.08 * vis;
      entry.root.children[0].scale.setScalar(s);
    }
  });
}

const loadModel = (url) =>
  new Promise((resolve, reject) => {
    gltfLoader.load(url, resolve, undefined, reject);
  });

// Order: car, cityscape, server-rack, neural-net
const modelUrls = [
  new URL('../models/highres-draco.glb', import.meta.url).href,
  new URL('../models/cityscape-draco.glb', import.meta.url).href,
  new URL('../models/server-rack-draco.glb', import.meta.url).href,
  new URL('../models/neural-net-draco.glb', import.meta.url).href,
];

const sceneLoader = document.getElementById('scene-loader');

(async function loadAllModels() {
  try {
    const gltfs = await Promise.all(modelUrls.map(loadModel));

    // Per-model target sizes (default 5.8, smaller = fits viewport better)
    const modelSizes = [5.8, 5.8, 5.8, 5.0];
    for (let i = 0; i < gltfs.length; i++) {
      await new Promise((r) => setTimeout(r, 30));
      const normalized = createNormalizedModel(gltfs[i].scene, modelSizes[i] || 5.8);
      displayModels[i] = createDisplayModel(normalized, i);
    }

    // GPU pre-compile
    displayModels.forEach((m) => { m.root.visible = true; m.wireMaterial.opacity = 0.18; });
    renderer.compile(scene, camera);
    displayModels.forEach((m) => { m.root.visible = false; m.wireMaterial.opacity = 0; });

    applyModelTheme();
    ScrollTrigger.refresh();
    const st = scrollTl.scrollTrigger;
    if (st) scrollTl.progress(st.progress);
    sceneReveal.value = 1;
    syncDisplayModels();

    renderer.render(scene, camera);

    canvas.style.opacity = '1';
    canvas.style.transition = 'opacity 0.6s ease';
    if (sceneLoader) {
      sceneLoader.style.opacity = '0';
      setTimeout(() => sceneLoader.remove(), 600);
    }

    objectGroup.scale.setScalar(0.94);
    gsap.to(objectGroup.scale, { x: 1, y: 1, z: 1, duration: 2, ease: 'power3.out' });
  } catch (error) {
    document.documentElement.classList.add('scene-failed');
    if (sceneLoader) sceneLoader.remove();
    console.error(error);
  }
})();

// Fallback: remove loader after 10s even if models fail
setTimeout(() => { if (sceneLoader) { sceneLoader.style.opacity = '0'; setTimeout(() => sceneLoader.remove(), 600); } }, 10000);

// ============================================================
// 4. SUBTLE DUST PARTICLES
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
// 5. HEADER SCROLL
// ============================================================
const header = document.querySelector('.site-header');

window.addEventListener('scroll', () => {
  if (!header) return;
  if (window.scrollY > 50) header.classList.add('scrolled');
  else header.classList.remove('scrolled');
});

// ============================================================
// 6. MOUSE PARALLAX & THEME SYNC
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

  dustMat.opacity = dark ? 0.08 : 0.14;
  dustMat.color.setHex(dark ? 0x8899aa : 0xaaaaaa);
  dustMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;

  applyModelTheme(theme);
  syncDisplayModels();
  if (window._markSceneDirty) window._markSceneDirty();
};

// ============================================================
// 7. GSAP SCROLL
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

// Cinematic state ScrollTriggers removed — lights were not affecting
// wireframe MeshBasicMaterial so the tweens were pure dead GPU work.

document.querySelectorAll('.hero-section .reveal-mask').forEach((mask, i) => {
  const targets = Array.from(mask.children).filter(c => !c.classList.contains('fade-up'));
  if (!targets.length) return;
  targets.forEach((target) => {
    if (target.classList.contains('hero-title-bottom')) {
      gsap.fromTo(target,
        { clipPath: 'inset(110% 0 -10% 0)', opacity: 0 },
        { clipPath: 'inset(0% 0 -10% 0)', opacity: 1, duration: 1.4, ease: 'power4.out', delay: 0.15 + i * 0.12, force3D: true }
      );
    } else {
      gsap.from(target, { y: '120%', opacity: 0, duration: 1.4, ease: 'power4.out', delay: 0.15 + i * 0.12, force3D: true });
    }
  });
});

document.querySelectorAll('.hero-section .fade-up').forEach((el, i) => {
  gsap.fromTo(el,
    { y: 16, opacity: 0, willChange: 'transform, opacity' },
    { y: 0, opacity: 1, duration: 1.6, ease: 'expo.out', delay: 0.7 + i * 0.2, force3D: true,
      onComplete() { gsap.set(el, { willChange: 'auto' }); }
    }
  );
});

gsap.utils.toArray('.info-section .reveal-mask, .transition-section .reveal-mask').forEach((mask) => {
  const targets = Array.from(mask.children).filter(c => !c.classList.contains('fade-up'));
  if (targets.length) {
    gsap.from(targets, {
      y: '120%',
      opacity: 0,
      duration: 1.4,
      ease: 'power4.out',
      stagger: 0.1,
      force3D: true,
      scrollTrigger: { trigger: mask, start: 'top 85%', toggleActions: 'play none none none' }
    });
  }
});

gsap.utils
  .toArray('.info-section .fade-up, .transition-section .fade-up, .stats-section .fade-up')
  .forEach((el) => {
    gsap.fromTo(el,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.6, ease: 'expo.out', force3D: true,
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
      }
    );
  });

// ============================================================
// 8. STAT COUNTER ANIMATION
// ============================================================
document.querySelectorAll('.stat-number').forEach((el) => {
  const text = el.textContent.trim();
  const match = text.match(/^(\d+)(.*)$/);
  if (!match) return;
  const target = parseInt(match[1], 10);
  const suffix = match[2];
  el.textContent = '0' + suffix;

  ScrollTrigger.create({
    trigger: el,
    start: 'top 85%',
    once: true,
    onEnter: () => {
      gsap.to({ val: 0 }, {
        val: target,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate() { el.textContent = Math.round(this.targets()[0].val) + suffix; }
      });
    }
  });
});

// ============================================================
// 9. SCROLL-BASED FONT WEIGHT ON HEADINGS (variable font)
// ============================================================
{
  const stretchHeadings = gsap.utils.toArray('.info-section h2, .transition-section h2');
  stretchHeadings.forEach((el) => {
    el.style.fontWeight = '400';
  });

  const heroTop = document.querySelector('.hero-title-top');
  const heroBottom = document.querySelector('.hero-title-bottom');

  const tracked = [];
  stretchHeadings.forEach((el) => tracked.push({ el, base: 500, range: 200, cur: 500 }));
  if (heroTop) tracked.push({ el: heroTop, base: 700, range: -300, cur: 400 });
  if (heroBottom) tracked.push({ el: heroBottom, base: 500, range: 300, cur: 800 });

  function updateFontWeight() {
    const cy = window.innerHeight / 2;
    const range = window.innerHeight * 0.9;
    tracked.forEach((item) => {
      const rect = item.el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const dist = Math.abs(elCenter - cy) / range;
      const t = Math.max(0, 1 - dist);
      const eased = t * t * (3 - 2 * t);
      const targetWeight = item.base + eased * item.range;
      const diff = targetWeight - item.cur;
      item.cur += diff * 0.1;
      const rounded = Math.round(Math.max(400, Math.min(800, item.cur)));
      if (Math.abs(diff) < 0.5) { item.cur = targetWeight; return; }
      item.el.style.fontWeight = String(rounded);
    });
  }

  gsap.ticker.add(updateFontWeight);
}

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
