/**
 * Kentsel Sürüş — Three.js WebGL oyunu
 * - GitHub Pages: göreli importmap + ./ yolları
 * - Sabit zaman adımı + delta time
 * - Instancing, LOD/mesafe kırpma, gölge & post-proses kalite katmanları
 */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// ——————————————————————————————————————————————————————————————
// Ortam & ayarlar (localStorage + mobil algı)
// ——————————————————————————————————————————————————————————————

const IS_TOUCH = "ontouchstart" in window || navigator.maxTouchPoints > 0;
const UA_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const STORAGE_KEY = "kentsel-surus-settings-v1";
const defaultSettings = () => ({
  quality: "medium",
  mobileMode: UA_MOBILE || IS_TOUCH,
  ssao: true
});

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

function saveSettings(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

let settings = loadSettings();

// ——————————————————————————————————————————————————————————————
// DOM
// ——————————————————————————————————————————————————————————————

const el = {
  app: document.getElementById("app"),
  loading: document.getElementById("screen-loading"),
  loadingBar: document.getElementById("loading-bar"),
  loadingStatus: document.getElementById("loading-status"),
  start: document.getElementById("screen-start"),
  settings: document.getElementById("screen-settings"),
  pause: document.getElementById("screen-pause"),
  hud: document.getElementById("hud"),
  touchUi: document.getElementById("touch-ui"),
  minimap: document.getElementById("minimap"),
  hudSpeed: document.getElementById("hud-speed"),
  hudFps: document.getElementById("hud-fps"),
  hudNitro: document.getElementById("hud-nitro-fill"),
  hudDamage: document.getElementById("hud-damage"),
  missionText: document.getElementById("mission-text"),
  btnPlay: document.getElementById("btn-play"),
  btnOpenSettingsStart: document.getElementById("btn-open-settings-start"),
  btnSettingsBack: document.getElementById("btn-settings-back"),
  btnSettingsSave: document.getElementById("btn-settings-save"),
  btnPause: document.getElementById("btn-pause"),
  btnCamera: document.getElementById("btn-camera"),
  btnReset: document.getElementById("btn-reset"),
  btnResume: document.getElementById("btn-resume"),
  btnSettingsPause: document.getElementById("btn-settings-pause"),
  setQuality: document.getElementById("set-quality"),
  setMobile: document.getElementById("set-mobile-mode"),
  setSsao: document.getElementById("set-ssao"),
  joystickZone: document.getElementById("joystick-zone"),
  joystickKnob: document.getElementById("joystick-knob")
};

const mapCtx = el.minimap.getContext("2d");

// ——————————————————————————————————————————————————————————————
// Sabitler
// ——————————————————————————————————————————————————————————————

const WORLD_SIZE = 280;
const FIXED_DT = 1 / 60;
const MAX_SPEED = 68;
const SPAWN = new THREE.Vector3(0, 0.2, -35);

/** 10 sokak parçası — küçük şehir ızgarası (yatay + dikey) */
const STREETS = [
  { x: 0, z: -100, w: 300, d: 14 },
  { x: 0, z: -50, w: 300, d: 14 },
  { x: 0, z: 0, w: 300, d: 18 },
  { x: 0, z: 50, w: 300, d: 14 },
  { x: 0, z: 100, w: 300, d: 14 },
  { x: -110, z: 0, w: 14, d: 260 },
  { x: -55, z: 0, w: 14, d: 260 },
  { x: 0, z: 0, w: 14, d: 300 },
  { x: 55, z: 0, w: 14, d: 260 },
  { x: 110, z: 0, w: 14, d: 260 }
];

// ——————————————————————————————————————————————————————————————
// Üçgen / renderer / composer
// ——————————————————————————————————————————————————————————————

const renderer = new THREE.WebGLRenderer({
  antialias: !(settings.mobileMode || UA_MOBILE),
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(qualityPixelRatio());
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMappingExposure = 1.12;
el.app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b4e8);
scene.fog = new THREE.Fog(0x9ecfff, 55, qualityFogFar());

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.12, 950);
camera.position.copy(SPAWN).add(new THREE.Vector3(0, 5, 12));

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

let ssaoPass = null;
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  bloomStrength(),
  0.42,
  0.88
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());
composer.setSize(window.innerWidth, window.innerHeight);

const clock = new THREE.Clock();

// ——————————————————————————————————————————————————————————————
// Kalite yardımcıları
// ——————————————————————————————————————————————————————————————

function qualityPixelRatio() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const m = settings.mobileMode ? 0.75 : 1;
  if (settings.quality === "low") return Math.min(dpr * 0.85 * m, 1.15);
  if (settings.quality === "medium") return Math.min(dpr * m, IS_TOUCH ? 1.25 : 1.45);
  return Math.min(dpr * 1.05 * m, IS_TOUCH ? 1.35 : 1.75);
}

function qualityFogFar() {
  if (settings.mobileMode) return 220 + (settings.quality === "high" ? 40 : 0);
  if (settings.quality === "low") return 200;
  if (settings.quality === "medium") return 320;
  return 380;
}

function bloomStrength() {
  const base = settings.quality === "high" ? 0.42 : settings.quality === "medium" ? 0.32 : 0.22;
  return settings.mobileMode ? base * 0.65 : base;
}

function shadowMapSize() {
  if (settings.mobileMode || settings.quality === "low") return 1024;
  return 2048;
}

function rebuildPostChain() {
  while (composer.passes.length) composer.removePass(composer.passes[0]);
  composer.addPass(renderPass);
  if (ssaoPass) {
    try {
      ssaoPass.dispose();
    } catch {
      /* eski sürümlerde yok */
    }
    ssaoPass = null;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const useSsao =
    settings.quality === "high" &&
    settings.ssao &&
    !settings.mobileMode;
  if (useSsao) {
    ssaoPass = new SSAOPass(scene, camera, w, h);
    ssaoPass.kernelRadius = 8;
    ssaoPass.minDistance = 0.02;
    ssaoPass.maxDistance = 0.12;
    ssaoPass.output = SSAOPass.OUTPUT.Default;
    composer.addPass(ssaoPass);
  }
  bloomPass.resolution.set(w, h);
  bloomPass.strength = bloomStrength();
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  composer.setSize(w, h);
}

// ——————————————————————————————————————————————————————————————
// Işıklar (gündüz + yumuşak gölgeler)
// ——————————————————————————————————————————————————————————————

const hemi = new THREE.HemisphereLight(0xb8dcff, 0x3a4a2a, 0.82);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3dd, 1.28);
sun.position.set(-120, 180, 60);
sun.castShadow = true;
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.02;
function applyShadowCamera() {
  const s = shadowMapSize();
  sun.shadow.mapSize.set(s, s);
  const b = 220;
  sun.shadow.camera.left = -b;
  sun.shadow.camera.right = b;
  sun.shadow.camera.top = b;
  sun.shadow.camera.bottom = -b;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 520;
}
applyShadowCamera();
scene.add(sun);

// Ambiyans: HDR benzeri — ACES + hafif bloom (yukarıda)

// ——————————————————————————————————————————————————————————————
// Harita: zemin, yollar, çizgiler, kavşaklar
// ——————————————————————————————————————————————————————————————

const grassMat = new THREE.MeshStandardMaterial({
  color: 0x3f5a3a,
  roughness: 1,
  metalness: 0
});
const grass = new THREE.Mesh(new THREE.PlaneGeometry(720, 720), grassMat);
grass.rotation.x = -Math.PI / 2;
grass.position.y = 0;
grass.receiveShadow = true;
scene.add(grass);

const roadMat = new THREE.MeshStandardMaterial({
  color: 0x1e232c,
  roughness: 0.92,
  metalness: 0.05
});
const roadEdgeMat = new THREE.MeshStandardMaterial({
  color: 0x2a313d,
  roughness: 0.9,
  metalness: 0.03
});

/** Basit dikdörtgen yol (düşük poligon) */
function addRoad(rect) {
  const { x, z, w, d } = rect;
  const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(x, 0.02, z);
  road.receiveShadow = true;
  scene.add(road);

  if (w > d) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.04, d * 0.92), roadEdgeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(x, 0.025, z);
    scene.add(stripe);
    // Kesik çizgi efekti — çok segment yerine tek şerit (performans)
  } else {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, d * 0.04), roadEdgeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(x, 0.025, z);
    scene.add(stripe);
  }
}

STREETS.forEach(addRoad);

// ——————————————————————————————————————————————————————————————
// Instancing: binalar (tek birim kutu — InstancedMesh tek geometri kuralı)
// ——————————————————————————————————————————————————————————————

const buildingUnit = new THREE.BoxGeometry(1, 1, 1);
const buildingMat = new THREE.MeshStandardMaterial({
  color: 0x8a96a8,
  roughness: 0.78,
  metalness: 0.14
});
const dummy = new THREE.Object3D();
/** @type {{ x: number, z: number, halfW: number, halfD: number, sx: number, sy: number, sz: number, yaw: number }[]} */
const buildingData = [];
const BUILD_COUNT = 140;
const instBuildings = new THREE.InstancedMesh(buildingUnit, buildingMat, BUILD_COUNT);
instBuildings.castShadow = true;
instBuildings.receiveShadow = true;
scene.add(instBuildings);

function placeBuildings() {
  const rng = (s) => {
    const x = Math.sin(s * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  let bIdx = 0;
  for (let i = 0; i < 220 && bIdx < BUILD_COUNT; i += 1) {
    const t = i + 0.37;
    const side = rng(t) > 0.5 ? 1 : -1;
    const along = (rng(t + 1) - 0.5) * 240;
    const x = side * (86 + rng(t + 3) * 40);
    const z = along;
    if (Math.abs(x) < 24 && Math.abs(z) < 24) continue;
    const w = 7 + rng(t + 4) * 5;
    const h = 14 + rng(t + 5) * 22;
    const d = 7 + rng(t + 6) * 5;
    const yaw = (rng(t + 7) - 0.5) * 0.12;
    dummy.position.set(x, h * 0.5, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    instBuildings.setMatrixAt(bIdx, dummy.matrix);
    buildingData.push({
      x,
      z,
      halfW: w * 0.5 + 0.4,
      halfD: d * 0.5 + 0.4,
      sx: w,
      sy: h,
      sz: d,
      yaw
    });
    bIdx += 1;
  }
  instBuildings.count = bIdx;
  instBuildings.instanceMatrix.needsUpdate = true;
}
placeBuildings();

// ——————————————————————————————————————————————————————————————
// Instancing: ağaç (silindir + kon birleşik geometri)
// ——————————————————————————————————————————————————————————————

const trunkG = new THREE.CylinderGeometry(0.35, 0.5, 2.2, 5);
trunkG.translate(0, 1.1, 0);
const crownG = new THREE.ConeGeometry(2.1, 3.2, 6);
crownG.translate(0, 3.2, 0);
const treeGeo = mergeGeometries([trunkG, crownG]);
const treeMat = new THREE.MeshStandardMaterial({ color: 0x4a8c4a, roughness: 0.9 });
const TREE_COUNT = 200;
const instTrees = new THREE.InstancedMesh(treeGeo, treeMat, TREE_COUNT);
instTrees.castShadow = true;
instTrees.receiveShadow = true;
scene.add(instTrees);

/** Her örnek için konum + dönüş (LOD güncellenirken aynı kalır) */
const treeData = [];
(() => {
  let k = 0;
  const rnd = (n) => ((n * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < TREE_COUNT; i += 1) {
    const u = rnd(i + 1);
    const v = rnd(i + 2);
    const x = (u - 0.5) * 640;
    const z = (v - 0.5) * 640;
    if (isOnRoad(x, z)) continue;
    if (Math.hypot(x, z) < 24) continue;
    const rot = rnd(i + 3) * Math.PI * 2;
    const sc = 0.85 + rnd(i + 4) * 0.35;
    dummy.position.set(x, 0, z);
    dummy.rotation.y = rot;
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    instTrees.setMatrixAt(k, dummy.matrix);
    treeData.push({ x, z, rot, sc });
    k += 1;
  }
  instTrees.count = k;
  instTrees.instanceMatrix.needsUpdate = true;
})();

// ——————————————————————————————————————————————————————————————
// Park halindeki araçlar (instance)
// ——————————————————————————————————————————————————————————————

const parkedGeo = new THREE.BoxGeometry(2, 0.9, 4.2);
const parkedMat = new THREE.MeshStandardMaterial({
  color: 0x6688aa,
  roughness: 0.55,
  metalness: 0.35
});
const PARKED_COUNT = 72;
const instParked = new THREE.InstancedMesh(parkedGeo, parkedMat, PARKED_COUNT);
instParked.castShadow = true;
instParked.receiveShadow = true;
scene.add(instParked);

const parkedBodies = [];
(() => {
  let k = 0;
  const rnd = (n) => ((n * 8121 + 13411) % 99991) / 99991;
  for (let i = 0; i < PARKED_COUNT; i += 1) {
    const side = rnd(i) > 0.5 ? 1 : -1;
    const z = (rnd(i + 1) - 0.5) * 200;
    const x = side * (22 + rnd(i + 2) * 80);
    if (!isOnRoad(x, z)) continue;
    dummy.position.set(x, 0.45, z);
    dummy.rotation.y = (rnd(i + 3) * 0.2 - 0.1) * (side > 0 ? 1 : -1);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    instParked.setMatrixAt(k, dummy.matrix);
    parkedBodies.push({
      x,
      z,
      r: 2.4,
      yaw: dummy.rotation.y
    });
    k += 1;
  }
  instParked.count = k;
  instParked.instanceMatrix.needsUpdate = true;
})();

// ——————————————————————————————————————————————————————————————
// Trafik ışıkları
// ——————————————————————————————————————————————————————————————

const trafficLights = [];
function makeTrafficLight(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 6.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a515a })
  );
  pole.position.y = 3.2;
  pole.castShadow = true;
  g.add(pole);
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.6, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x282e36 })
  );
  box.position.y = 7;
  g.add(box);
  g.position.set(x, 0, z);
  scene.add(g);
  trafficLights.push({ group: g, t: Math.random() * 10, phase: Math.random() > 0.5 ? 0 : 1 });
}

[[-40, 0], [40, 0], [0, 40], [0, -40], [-90, 50], [90, -50]].forEach(([x, z]) =>
  makeTrafficLight(x, z)
);

// ——————————————————————————————————————————————————————————————
// Trafik AI (basit kutular)
// ——————————————————————————————————————————————————————————————

const trafficMeshes = [];
const trafficData = [];
function spawnTraffic(n) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc2c7d4, roughness: 0.6, metalness: 0.2 });
  for (let i = 0; i < n; i += 1) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2, 1.1, 4), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    const axis = i % 2 === 0 ? "x" : "z";
    const lane = axis === "x" ? (i % 4 < 2 ? 28 : -28) : (i % 4 < 2 ? 35 : -35);
    const dir = i % 2 === 0 ? 1 : -1;
    if (axis === "x") {
      m.position.set(-200 * dir, 0.55, lane);
      m.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      m.position.set(lane, 0.55, -200 * dir);
      m.rotation.y = dir > 0 ? 0 : Math.PI;
    }
    scene.add(m);
    trafficMeshes.push(m);
    trafficData.push({
      mesh: m,
      axis,
      dir,
      lane,
      speed: 12 + (i % 5) * 2,
      stopT: 0
    });
  }
}
spawnTraffic(settings.mobileMode ? 10 : 14);

// ——————————————————————————————————————————————————————————————
// Oyuncu arabası — düşük poli, parlak gövde
// ——————————————————————————————————————————————————————————————

function createPlayerCar() {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: 0xff3355,
    roughness: 0.35,
    metalness: 0.55
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.72, 4.25), paint);
  body.position.y = 1.16;
  body.castShadow = true;
  g.add(body);

  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x0c1a28,
    roughness: 0.25,
    metalness: 0.65
  });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.6, 1.85), cabinMat);
  cabin.position.set(0, 1.64, -0.12);
  cabin.castShadow = true;
  g.add(cabin);

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.96 });
  const wGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10);
  wGeo.rotateZ(Math.PI / 2);
  const positions = [
    [-0.95, 0.74, 1.38],
    [0.95, 0.74, 1.38],
    [-0.95, 0.74, -1.38],
    [0.95, 0.74, -1.38]
  ];
  const wheels = positions.map(([x, y, z], wi) => {
    const w = new THREE.Mesh(wGeo, wheelMat);
    w.position.set(x, y, z);
    w.castShadow = true;
    g.add(w);
    return { mesh: w, front: wi < 2 };
  });

  const brakeMat = new THREE.MeshStandardMaterial({
    color: 0xff2222,
    emissive: 0x220000
  });
  const bGeo = new THREE.BoxGeometry(0.22, 0.08, 0.28);
  const bl = new THREE.Mesh(bGeo, brakeMat);
  const br = new THREE.Mesh(bGeo, brakeMat);
  bl.position.set(-0.64, 1.12, -2.1);
  br.position.set(0.64, 1.12, -2.1);
  g.add(bl, br);

  const spotL = new THREE.SpotLight(0xdef6ff, 0, 42, Math.PI / 6, 0.55, 1.4);
  const spotR = new THREE.SpotLight(0xdef6ff, 0, 42, Math.PI / 6, 0.55, 1.4);
  spotL.position.set(-0.62, 1.1, 2.05);
  spotR.position.set(0.62, 1.1, 2.05);
  spotL.target.position.set(-0.62, 0.2, 18);
  spotR.target.position.set(0.62, 0.2, 18);
  g.add(spotL, spotR, spotL.target, spotR.target);
  spotL.castShadow = false;
  spotR.castShadow = false;

  g.position.copy(SPAWN);
  scene.add(g);

  return {
    root: g,
    body,
    paint,
    wheels,
    brakeMat,
    brakeL: bl,
    brakeR: br,
    headlights: [spotL, spotR],
    vel: new THREE.Vector3(),
    speed: 0,
    yaw: 0,
    steer: 0,
    nitro: 1,
    damage: 0,
    travel: 0,
    driftTime: 0
  };
}

const player = createPlayerCar();

// ——————————————————————————————————————————————————————————————
// Fren izi + duman
// ——————————————————————————————————————————————————————————————

const SKID_MAX = 1400;
const skidPos = new Float32Array(SKID_MAX * 3);
const skidGeo = new THREE.BufferGeometry();
skidGeo.setAttribute("position", new THREE.BufferAttribute(skidPos, 3));
let skidPtr = 0;
const skidLine = new THREE.LineSegments(
  skidGeo,
  new THREE.LineBasicMaterial({ color: 0x151515, transparent: true, opacity: 0.78 })
);
scene.add(skidLine);

const SMOKE_N = settings.mobileMode ? 70 : 110;
const smokeGeo = new THREE.BufferGeometry();
const smokePos = new Float32Array(SMOKE_N * 3);
const smokeLife = new Float32Array(SMOKE_N);
smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePos, 3));
const smokePts = new THREE.Points(
  smokeGeo,
  new THREE.PointsMaterial({
    size: settings.mobileMode ? 0.5 : 0.62,
    color: 0xd5dae0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  })
);
scene.add(smokePts);

// ——————————————————————————————————————————————————————————————
// Kamera modları
// ——————————————————————————————————————————————————————————————

const camModes = [
  { offset: new THREE.Vector3(0, 4.8, -9.2), look: new THREE.Vector3(0, 1.2, 6), fov: 65 },
  { offset: new THREE.Vector3(0, 1.38, 0.35), look: new THREE.Vector3(0, 1.25, 10), fov: 72 }
];
let camIndex = 0;

// ——————————————————————————————————————————————————————————————
// Ses (Web Audio — motor + nitro)
// ——————————————————————————————————————————————————————————————

const listener = new THREE.AudioListener();
camera.add(listener);
const ctx = listener.context;
const master = ctx.createGain();
master.gain.value = 0.001;
master.connect(ctx.destination);

const engineOsc = ctx.createOscillator();
engineOsc.type = "sawtooth";
engineOsc.frequency.value = 70;
const engineGain = ctx.createGain();
engineGain.gain.value = 0;
engineOsc.connect(engineGain);
engineGain.connect(master);
engineOsc.start();

const nitroGain = ctx.createGain();
nitroGain.gain.value = 0;
const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
const ch = buf.getChannelData(0);
for (let i = 0; i < ch.length; i += 1) ch[i] = (Math.random() * 2 - 1) * 0.35;
const nitroBuf = ctx.createBufferSource();
nitroBuf.buffer = buf;
nitroBuf.loop = true;
const hp = ctx.createBiquadFilter();
hp.type = "highpass";
hp.frequency.value = 800;
nitroBuf.connect(hp);
hp.connect(nitroGain);
nitroGain.connect(master);
nitroBuf.start();

async function unlockAudio() {
  if (ctx.state !== "running") await ctx.resume();
  master.gain.setTargetAtTime(0.7, ctx.currentTime, 0.05);
}

// ——————————————————————————————————————————————————————————————
// Girdi: klavye + sanal joystick + pedallar
// ——————————————————————————————————————————————————————————————

const keys = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
  ShiftLeft: false
};

let steerTouch = 0;
let throttleTouch = 0;

window.addEventListener(
  "keydown",
  (e) => {
    if (e.repeat) return;
    if (e.code === "KeyP") togglePause();
    if (e.code === "KeyC") cycleCamera();
    if (e.code === "KeyR") resetCar(true);
    if (keys[e.code] !== undefined) keys[e.code] = true;
  },
  { passive: true }
);
window.addEventListener(
  "keyup",
  (e) => {
    if (keys[e.code] !== undefined) keys[e.code] = false;
  },
  { passive: true }
);

function bindPedals() {
  document.querySelectorAll(".pedal").forEach((btn) => {
    const code = btn.dataset.code;
    const down = (ev) => {
      ev.preventDefault();
      if (keys[code] !== undefined) keys[code] = true;
    };
    const up = (ev) => {
      ev.preventDefault();
      if (keys[code] !== undefined) keys[code] = false;
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  });
}
bindPedals();

/** Sanal joystick */
const joy = { active: false, cx: 0, cy: 0, maxR: 52 };
function joystickSetup() {
  const zone = el.joystickZone;
  const knob = el.joystickKnob;
  const rect = () => zone.getBoundingClientRect();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const onMove = (clientX, clientY) => {
    const r = rect();
    const mx = clientX - r.left - r.width / 2;
    const my = clientY - r.top - r.height / 2;
    const dist = Math.hypot(mx, my);
    const nx = dist > joy.maxR ? (mx / dist) * joy.maxR : mx;
    const ny = dist > joy.maxR ? (my / dist) * joy.maxR : my;
    knob.style.transform = `translate(${nx}px, ${ny}px)`;
    steerTouch = clamp(nx / joy.maxR, -1, 1);
    throttleTouch = clamp(-ny / joy.maxR, -1, 1);
  };
  const end = () => {
    joy.active = false;
    knob.style.transform = "translate(0px, 0px)";
    steerTouch = 0;
    throttleTouch = 0;
  };
  zone.addEventListener("pointerdown", (e) => {
    joy.active = true;
    try {
      zone.setPointerCapture(e.pointerId);
    } catch {
      /* bazı tarayıcılar */
    }
    onMove(e.clientX, e.clientY);
  });
  zone.addEventListener("pointermove", (e) => {
    if (!joy.active) return;
    onMove(e.clientX, e.clientY);
  });
  zone.addEventListener("pointerup", end);
  zone.addEventListener("pointercancel", end);
}

// ——————————————————————————————————————————————————————————————
// Oyun durumu
// ——————————————————————————————————————————————————————————————

let paused = false;
let running = false;
let accumulator = 0;

const missions = [
  { id: 1, text: "400 m ilerle (serbest sürüş)", type: "dist", target: 400, done: false },
  { id: 2, text: "Kavşaktaki noktaya ulaş", type: "cp", pos: new THREE.Vector3(-40, 0, 0), r: 16, done: false },
  { id: 3, text: "Nitro ile 4 saniye hızlan", type: "nitro", target: 4, done: false }
];
let missionIndex = 0;
/** Nitro görevi: toplam nitro kullanım süresi (sn) */
let nitroMissionAccum = 0;

function currentMission() {
  return missions[missionIndex] || null;
}

function advanceMission() {
  const m = missions[missionIndex];
  if (!m) return;
  m.done = true;
  missionIndex += 1;
  const next = currentMission();
  el.missionText.textContent = next ? next.text : "Tüm görevler tamamlandı — şehir senin.";
}

// ——————————————————————————————————————————————————————————————
// Yardımcılar: yol testi, trafik ışığı
// ——————————————————————————————————————————————————————————————

function isOnRoad(x, z) {
  for (const s of STREETS) {
    if (Math.abs(x - s.x) <= s.w * 0.5 && Math.abs(z - s.z) <= s.d * 0.5) return true;
  }
  return false;
}

function trafficLightState() {
  const t = performance.now() * 0.001;
  const cycle = 9;
  return (t % cycle) / cycle < 0.45;
}

function shouldStopAtLight(pos, axis) {
  const red = trafficLightState();
  if (!red) return false;
  for (const L of trafficLights) {
    const lx = L.group.position.x;
    const lz = L.group.position.z;
    const dx = Math.abs(pos.x - lx);
    const dz = Math.abs(pos.z - lz);
    if (dx < 12 && dz < 12) {
      if (axis === "x" && dz < 6) return Math.abs(pos.x - lx) < 10;
      if (axis === "z" && dx < 6) return Math.abs(pos.z - lz) < 10;
    }
  }
  return false;
}

// ——————————————————————————————————————————————————————————————
// LOD / render mesafesi — örnekleri sıfır ölçekle (draw culling benzeri)
// ——————————————————————————————————————————————————————————————

function updateLOD() {
  const px = player.root.position.x;
  const pz = player.root.position.z;
  const treeDist = settings.quality === "low" ? 95 : settings.mobileMode ? 110 : 150;
  for (let i = 0; i < instTrees.count; i += 1) {
    const td = treeData[i];
    const d = Math.hypot(td.x - px, td.z - pz);
    const show = d < treeDist;
    dummy.position.set(td.x, 0, td.z);
    dummy.rotation.y = td.rot;
    dummy.scale.setScalar(show ? td.sc : 0);
    dummy.updateMatrix();
    instTrees.setMatrixAt(i, dummy.matrix);
  }
  instTrees.instanceMatrix.needsUpdate = true;

  const pd = settings.mobileMode ? 75 : 105;
  for (let i = 0; i < instParked.count; i += 1) {
    const p = parkedBodies[i];
    if (!p) continue;
    const d = Math.hypot(p.x - px, p.z - pz);
    const show = d < pd;
    dummy.position.set(p.x, 0.45, p.z);
    dummy.rotation.y = p.yaw;
    dummy.scale.setScalar(show ? 1 : 0);
    dummy.updateMatrix();
    instParked.setMatrixAt(i, dummy.matrix);
  }
  instParked.instanceMatrix.needsUpdate = true;

  const bd = settings.mobileMode ? 120 : 180;
  for (let i = 0; i < instBuildings.count; i += 1) {
    const b = buildingData[i];
    const d = Math.hypot(b.x - px, b.z - pz);
    const show = d < bd;
    const hy = show ? b.sy * 0.5 : 0;
    dummy.position.set(b.x, hy, b.z);
    dummy.rotation.set(0, b.yaw, 0);
    dummy.scale.set(show ? b.sx : 0, show ? b.sy : 0, show ? b.sz : 0);
    dummy.updateMatrix();
    instBuildings.setMatrixAt(i, dummy.matrix);
  }
  instBuildings.instanceMatrix.needsUpdate = true;
}

// ——————————————————————————————————————————————————————————————
// Çarpışma: park + trafik + basit AABB bina
// ——————————————————————————————————————————————————————————————

function collideWorld() {
  const p = player.root.position;
  const prevSpeed = player.speed;

  for (const pk of parkedBodies) {
    if (!pk || pk.r < 0.1) continue;
    const dx = p.x - pk.x;
    const dz = p.z - pk.z;
    if (Math.hypot(dx, dz) < pk.r + 1.1) {
      const push = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(0.55);
      p.add(push);
      player.speed *= -0.15;
      applyDamage(0.04 + Math.abs(prevSpeed) * 0.002);
    }
  }

  for (const t of trafficData) {
    const tp = t.mesh.position;
    const d = p.distanceTo(tp);
    if (d < 2.8) {
      const push = p.clone().sub(tp).normalize().multiplyScalar(0.7);
      p.add(push);
      player.speed *= -0.2;
      t.speed *= 0.4;
      applyDamage(0.05 + Math.abs(prevSpeed) * 0.003);
    }
  }

  for (const b of buildingData) {
    const dx = Math.abs(p.x - b.x);
    const dz = Math.abs(p.z - b.z);
    if (dx < b.halfW && dz < b.halfD) {
      const push = new THREE.Vector3(p.x - b.x, 0, p.z - b.z);
      if (push.lengthSq() < 0.001) push.set(1, 0, 0);
      push.normalize().multiplyScalar(0.95);
      p.add(push);
      player.speed *= 0.1;
      applyDamage(0.08);
    }
  }
}

function applyDamage(amount) {
  player.damage = THREE.MathUtils.clamp(player.damage + amount, 0, 1);
  const c = new THREE.Color(0xff3355).lerp(new THREE.Color(0x331111), player.damage);
  player.paint.color.copy(c);
}

// ——————————————————————————————————————————————————————————————
// Efektler: iz, duman
// ——————————————————————————————————————————————————————————————

function addSkid(x, z) {
  if (skidPtr >= SKID_MAX - 2) skidPtr = 0;
  skidPos[skidPtr * 3] = x;
  skidPos[skidPtr * 3 + 1] = 0.03;
  skidPos[skidPtr * 3 + 2] = z;
  skidPtr += 1;
  skidPos[skidPtr * 3] = x + (Math.random() - 0.5) * 0.35;
  skidPos[skidPtr * 3 + 1] = 0.03;
  skidPos[skidPtr * 3 + 2] = z + (Math.random() - 0.5) * 0.35;
  skidPtr += 1;
  skidGeo.attributes.position.needsUpdate = true;
}

function emitSmoke() {
  for (let k = 0; k < 3; k += 1) {
    let idx = -1;
    for (let i = 0; i < SMOKE_N; i += 1) {
      if (smokeLife[i] <= 0) {
        idx = i;
        break;
      }
    }
    if (idx < 0) return;
    smokePos[idx * 3] = player.root.position.x + (Math.random() - 0.5) * 1.2;
    smokePos[idx * 3 + 1] = 0.45;
    smokePos[idx * 3 + 2] = player.root.position.z + (Math.random() - 0.5) * 1.2;
    smokeLife[idx] = 1.2;
  }
  smokeGeo.attributes.position.needsUpdate = true;
}

function updateSmoke(dt) {
  for (let i = 0; i < SMOKE_N; i += 1) {
    if (smokeLife[i] <= 0) continue;
    smokeLife[i] -= dt;
    smokePos[i * 3 + 1] += dt * 2.2;
    smokePos[i * 3] += (Math.random() - 0.5) * dt * 1.8;
    smokePos[i * 3 + 2] += (Math.random() - 0.5) * dt * 1.8;
    if (smokeLife[i] <= 0) smokePos[i * 3 + 1] = -99;
  }
  smokeGeo.attributes.position.needsUpdate = true;
}

// ——————————————————————————————————————————————————————————————
// Trafik güncelleme
// ——————————————————————————————————————————————————————————————

function updateTraffic(dt) {
  for (const t of trafficData) {
    const p = t.mesh.position;
    const stop = shouldStopAtLight(p, t.axis);
    let sp = t.speed;
    if (stop) sp = Math.max(0, sp - 28 * dt);
    else sp = Math.min(t.speed, sp + 10 * dt);
    if (t.axis === "x") {
      p.x += t.dir * sp * dt;
      p.z = t.lane;
      if (Math.abs(p.x) > 230) p.x = -230 * t.dir;
    } else {
      p.z += t.dir * sp * dt;
      p.x = t.lane;
      if (Math.abs(p.z) > 230) p.z = -230 * t.dir;
    }
  }
}

function updateTrafficLightsVisual(dt) {
  const red = trafficLightState();
  for (const L of trafficLights) {
    L.phase = red ? 1 : 0;
    L.group.position.y = 0;
    const head = L.group.children[1];
    if (head && head.material && head.material.emissive) {
      head.material.emissive.setHex(red ? 0x330000 : 0x002200);
    }
  }
}

// ——————————————————————————————————————————————————————————————
// Araba fiziği (hafif arcade + drift)
// ——————————————————————————————————————————————————————————————

function getInputSteer() {
  let s = 0;
  if (keys.KeyA) s += 1;
  if (keys.KeyD) s -= 1;
  if (Math.abs(steerTouch) > 0.05) s += steerTouch;
  return THREE.MathUtils.clamp(s, -1, 1);
}

function getInputThrottle() {
  let t = 0;
  if (keys.KeyW) t += 1;
  if (keys.KeyS) t -= 0.75;
  if (Math.abs(throttleTouch) > 0.08) t += throttleTouch;
  return THREE.MathUtils.clamp(t, -1, 1);
}

function integrateCar(dt) {
  const onRoad = isOnRoad(player.root.position.x, player.root.position.z);
  const gripHand = keys.Space ? 0.42 : 1;
  const drag = (onRoad ? 2.6 : 6.0) * (1 + player.damage * 0.35);

  const throttle = getInputThrottle();
  const nitro = keys.ShiftLeft && player.nitro > 0.04;
  const engine = 17 * throttle * (nitro ? 1.65 : 1);

  player.speed += engine * dt;
  if (throttle <= 0 && player.speed > 0) player.speed -= 9 * dt * Math.sign(player.speed);
  player.speed -= player.speed * drag * dt * 0.028;

  const max = MAX_SPEED * (nitro ? 1.08 : 1) * (1 - player.damage * 0.12);
  player.speed = THREE.MathUtils.clamp(player.speed, -14, max);

  const steerIn = getInputSteer();
  player.steer = THREE.MathUtils.lerp(player.steer, steerIn, dt * 7.5);

  const spd = Math.abs(player.speed);
  const driftActive = keys.Space && spd > 10 && Math.abs(player.steer) > 0.25;
  if (driftActive) {
    addSkid(player.root.position.x, player.root.position.z);
    emitSmoke();
    player.driftTime += dt;
  } else {
    player.driftTime = Math.max(0, player.driftTime - dt * 0.5);
  }

  const yawRate = player.steer * (0.017 + 0.018 * (1 - THREE.MathUtils.clamp(spd / 55, 0, 1))) * gripHand;
  player.yaw += yawRate * Math.sign(player.speed || throttle || 1);
  player.root.rotation.y = player.yaw;

  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);
  const ox = player.root.position.x;
  const oz = player.root.position.z;
  player.root.position.x += fx * player.speed * dt;
  player.root.position.z += fz * player.speed * dt;
  const moved = Math.hypot(player.root.position.x - ox, player.root.position.z - oz);
  player.travel += moved;

  // Süspansiyon hissi
  const bob = Math.sin(performance.now() * 0.01 + spd * 0.15) * 0.035;
  player.body.position.y = 1.16 + bob + (keys.Space ? -0.04 : 0);
  player.body.rotation.z = -player.steer * (0.07 + spd * 0.0015);
  player.body.rotation.x = -throttle * 0.04;

  for (const w of player.wheels) {
    w.mesh.rotation.x += player.speed * dt * 2.1;
    if (w.front) w.mesh.rotation.y = -player.steer * 0.48;
  }

  // Far + fren lambası
  const nightBias = 0.25;
  const headInt = 0.65 + nightBias;
  player.headlights.forEach((sp) => {
    sp.intensity = headInt;
  });
  const braking = keys.KeyS && player.speed > 0.4;
  player.brakeMat.emissive.setHex(braking ? 0xaa0000 : 0x110000);

  if (nitro) {
    player.nitro = Math.max(0, player.nitro - dt * 0.2);
    nitroMissionAccum += dt;
  } else {
    player.nitro = Math.min(1, player.nitro + dt * 0.06);
  }

  // Sınır
  player.root.position.x = THREE.MathUtils.clamp(player.root.position.x, -WORLD_SIZE, WORLD_SIZE);
  player.root.position.z = THREE.MathUtils.clamp(player.root.position.z, -WORLD_SIZE, WORLD_SIZE);

  collideWorld();

  updateAudio(spd, nitro);
  updateMissions(dt);
}

function updateAudio(spd, nitro) {
  const norm = THREE.MathUtils.clamp(spd / MAX_SPEED, 0, 1);
  engineOsc.frequency.setTargetAtTime(65 + norm * 210, ctx.currentTime, 0.05);
  engineGain.gain.setTargetAtTime(running ? 0.035 + norm * 0.07 : 0, ctx.currentTime, 0.08);
  nitroGain.gain.setTargetAtTime(nitro ? 0.04 : 0, ctx.currentTime, 0.05);
}

function updateMissions(dt) {
  const m = currentMission();
  if (!m || m.done) return;
  if (m.type === "dist") {
    if (player.travel >= m.target) advanceMission();
  } else if (m.type === "cp") {
    const d = player.root.position.distanceTo(m.pos);
    if (d < m.r) advanceMission();
  } else if (m.type === "nitro") {
    if (nitroMissionAccum >= m.target) advanceMission();
  }
}

// ——————————————————————————————————————————————————————————————
// Kamera takip
// ——————————————————————————————————————————————————————————————

function updateCamera(dt) {
  const mode = camModes[camIndex];
  const yaw = player.yaw;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const off = mode.offset.clone().applyQuaternion(q);
  const target = player.root.position.clone().add(off);
  camera.position.lerp(target, dt * 4.8);
  const lookAt = player.root.position.clone().add(mode.look.clone().applyQuaternion(q));
  camera.lookAt(lookAt);
  camera.fov = THREE.MathUtils.lerp(camera.fov, mode.fov + Math.min(12, Math.abs(player.speed)) * 0.35, dt * 2);
  camera.updateProjectionMatrix();
}

function cycleCamera() {
  camIndex = (camIndex + 1) % camModes.length;
}

function resetCar(fullHeal) {
  player.root.position.copy(SPAWN);
  player.root.rotation.y = 0;
  player.speed = 0;
  player.yaw = 0;
  player.steer = 0;
  if (fullHeal) {
    player.damage = 0;
    player.paint.color.setHex(0xff3355);
  }
}

// ——————————————————————————————————————————————————————————————
// HUD + mini harita
// ——————————————————————————————————————————————————————————————

let fpsAcc = { n: 0, t: 0 };
function updateHud(dt) {
  const kmh = Math.round(Math.abs(player.speed * 3.6));
  el.hudSpeed.innerHTML = `${kmh} <span class="unit">km/h</span>`;
  el.hudNitro.style.transform = `scaleX(${player.nitro})`;
  el.hudDamage.textContent = `${Math.round(player.damage * 100)}%`;

  fpsAcc.n += 1;
  fpsAcc.t += dt;
  if (fpsAcc.t > 0.35) {
    el.hudFps.textContent = String(Math.round(fpsAcc.n / fpsAcc.t));
    fpsAcc.n = 0;
    fpsAcc.t = 0;
  }
}

function drawMinimap() {
  const w = el.minimap.width;
  const h = el.minimap.height;
  mapCtx.fillStyle = "rgba(6,10,16,0.92)";
  mapCtx.fillRect(0, 0, w, h);
  mapCtx.save();
  mapCtx.translate(w / 2, h / 2);
  const s = 0.32;
  mapCtx.scale(s, s);
  mapCtx.fillStyle = "#2b3b1e";
  mapCtx.fillRect(-400, -400, 800, 800);
  mapCtx.fillStyle = "#2c3038";
  for (const r of STREETS) {
    mapCtx.fillRect(r.x - r.w * 0.5, r.z - r.d * 0.5, r.w, r.d);
  }
  mapCtx.fillStyle = "#f0e68c";
  for (const t of trafficData) {
    const p = t.mesh.position;
    mapCtx.fillRect(p.x - 2, p.z - 2, 4, 4);
  }
  mapCtx.fillStyle = "#7a8cac";
  for (let i = 0; i < instParked.count; i += 1) {
    const pk = parkedBodies[i];
    if (!pk) continue;
    mapCtx.fillRect(pk.x - 1.5, pk.z - 1.5, 3, 3);
  }
  mapCtx.fillStyle = "#40d6ff";
  const px = player.root.position.x;
  const pz = player.root.position.z;
  mapCtx.beginPath();
  mapCtx.moveTo(px + Math.sin(player.yaw) * 6, pz + Math.cos(player.yaw) * 6);
  mapCtx.lineTo(px + Math.sin(player.yaw + 2.4) * 4, pz + Math.cos(player.yaw + 2.4) * 4);
  mapCtx.lineTo(px + Math.sin(player.yaw - 2.4) * 4, pz + Math.cos(player.yaw - 2.4) * 4);
  mapCtx.closePath();
  mapCtx.fill();
  mapCtx.restore();
}

// ——————————————————————————————————————————————————————————————
// Ana döngü
// ——————————————————————————————————————————————————————————————

function tick(dt) {
  integrateCar(dt);
  updateTraffic(dt);
  updateTrafficLightsVisual(dt);
  updateCamera(dt);
  updateSmoke(dt);
  updateHud(dt);
  updateLOD();
  drawMinimap();
}

function togglePause(force) {
  paused = typeof force === "boolean" ? force : !paused;
  el.pause.classList.toggle("screen-visible", paused && running);
}

function onFrame() {
  const dtRaw = Math.min(clock.getDelta(), 0.05);
  if (running && !paused) {
    accumulator += dtRaw;
    while (accumulator >= FIXED_DT) {
      tick(FIXED_DT);
      accumulator -= FIXED_DT;
    }
  }
  composer.render();
  requestAnimationFrame(onFrame);
}

// ——————————————————————————————————————————————————————————————
// Yükleme simülasyonu + ağır başlangıç
// ——————————————————————————————————————————————————————————————

function setLoad(p, label) {
  const pct = Math.round(p * 100);
  el.loadingBar.style.width = `${pct}%`;
  el.loadingStatus.textContent = `${pct}% ${label}`;
}

async function bootSequence() {
  setLoad(0.1, "Renderer");
  await new Promise((r) => setTimeout(r, 30));
  setLoad(0.35, "Harita & instancing");
  await new Promise((r) => setTimeout(r, 40));
  setLoad(0.55, "Post-processing");
  rebuildPostChain();
  await new Promise((r) => setTimeout(r, 40));
  setLoad(0.75, "Girdi & ses");
  joystickSetup();
  setLoad(1, "Hazır");
  await new Promise((r) => setTimeout(r, 120));
  el.loading.classList.remove("screen-visible");
  el.start.classList.add("screen-visible");
}

// ——————————————————————————————————————————————————————————————
// Menü bağlama
// ——————————————————————————————————————————————————————————————

function applySettingsToForm() {
  el.setQuality.value = settings.quality;
  el.setMobile.checked = settings.mobileMode;
  el.setSsao.checked = settings.ssao;
}

function readFormSettings() {
  settings.quality = el.setQuality.value;
  settings.mobileMode = el.setMobile.checked;
  settings.ssao = el.setSsao.checked;
  saveSettings(settings);
  renderer.setPixelRatio(qualityPixelRatio());
  scene.fog.far = qualityFogFar();
  scene.fog.near = 55;
  applyShadowCamera();
  rebuildPostChain();
}

/** Ayarlar ekranına duraklatmadan mı yoksa ana menüden mi girildi */
let settingsOpenedFromPause = false;

el.btnOpenSettingsStart.addEventListener("click", () => {
  settingsOpenedFromPause = false;
  applySettingsToForm();
  el.start.classList.remove("screen-visible");
  el.settings.classList.add("screen-visible");
});

el.btnSettingsBack.addEventListener("click", () => {
  el.settings.classList.remove("screen-visible");
  if (settingsOpenedFromPause) {
    el.pause.classList.add("screen-visible");
  } else {
    el.start.classList.add("screen-visible");
  }
});

el.btnSettingsSave.addEventListener("click", () => {
  readFormSettings();
  el.settings.classList.remove("screen-visible");
  if (settingsOpenedFromPause) {
    el.pause.classList.add("screen-visible");
    settingsOpenedFromPause = false;
  } else {
    el.start.classList.add("screen-visible");
  }
});

el.btnPlay.addEventListener("click", async () => {
  await unlockAudio();
  readFormSettings();
  el.start.classList.remove("screen-visible");
  el.hud.classList.remove("hidden");
  el.touchUi.classList.toggle("active", IS_TOUCH || UA_MOBILE);
  missionIndex = 0;
  missions.forEach((m) => {
    m.done = false;
  });
  player.travel = 0;
  nitroMissionAccum = 0;
  el.missionText.textContent = currentMission()?.text || "";
  running = true;
  paused = false;
});

el.btnPause.addEventListener("click", () => togglePause());
el.btnResume.addEventListener("click", () => togglePause(false));
el.btnCamera.addEventListener("click", () => cycleCamera());
el.btnReset.addEventListener("click", () => resetCar(true));

el.btnSettingsPause.addEventListener("click", () => {
  settingsOpenedFromPause = true;
  applySettingsToForm();
  el.pause.classList.remove("screen-visible");
  el.settings.classList.add("screen-visible");
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.resolution.set(window.innerWidth, window.innerHeight);
  if (ssaoPass) {
    ssaoPass.setSize(window.innerWidth, window.innerHeight);
  }
});

// İlk gösterim
applySettingsToForm();
bootSequence();
onFrame();
