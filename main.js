
// main.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/UnrealBloomPass.js";

const MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const WORLD_HALF = 320;
const FIXED_DT = 1 / 60;

const ui = {
  speed: document.querySelector("#speed"),
  rpm: document.querySelector("#rpm"),
  gear: document.querySelector("#gear"),
  fps: document.querySelector("#fps"),
  minimap: document.querySelector("#minimap"),
  startOverlay: document.querySelector("#overlay-baslangic"),
  pauseOverlay: document.querySelector("#overlay-pause"),
  startBtn: document.querySelector("#baslat-btn"),
  continueBtn: document.querySelector("#devam-btn"),
  pauseBtn: document.querySelector("#duraklat-btn"),
  cameraBtn: document.querySelector("#kamera-btn"),
  quality: document.querySelector("#kalite"),
  night: document.querySelector("#gece")
};

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x7da1c2, 90, 500);

const renderer = new THREE.WebGLRenderer({ antialias: !MOBILE, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.3 : 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.querySelector("#oyun-kabugu").prepend(renderer.domElement);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1300);
camera.position.set(0, 4, 9);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), MOBILE ? 0.35 : 0.48, 0.45, 0.84);
composer.addPass(bloom);

const hemi = new THREE.HemisphereLight(0xa8d4ff, 0x274015, 0.75);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff5d8, 1.25);
sun.position.set(-70, 120, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
sun.shadow.camera.left = -170;
sun.shadow.camera.right = 170;
sun.shadow.camera.top = 170;
sun.shadow.camera.bottom = -170;
scene.add(sun);

const neonLights = [];
const roadMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.9, metalness: 0.02 });
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 900),
  new THREE.MeshStandardMaterial({ color: 0x3d4a2f, roughness: 1, metalness: 0 })
);
ground.rotation.x = -Math.PI * 0.5;
ground.receiveShadow = true;
scene.add(ground);

const world = {
  roadRects: [],
  trafficLights: [],
  trafficCars: [],
  pedestrians: [],
  skidMeshes: []
};

function addRoad(x, z, w, d) {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(x, 0.02, z);
  road.receiveShadow = true;
  scene.add(road);
  world.roadRects.push({ x, z, w, d });

  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.06, d * 0.94),
    new THREE.MeshBasicMaterial({ color: 0xf2f2a8 })
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(x, 0.03, z);
  scene.add(lane);
}

const streets = [
  [0, 0, 230, 20],
  [0, -70, 230, 20],
  [0, 70, 230, 20],
  [-90, 0, 20, 230],
  [90, 0, 20, 230],
  [-170, -40, 20, 140],
  [170, 40, 20, 140],
  [0, 160, 210, 18],
  [0, -160, 210, 18],
  [0, 0, 20, 230]
];
streets.forEach((s) => addRoad(...s));

function createBuilding(x, z, h, color = 0x8792a0) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.14 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(12, h, 12), mat);
  mesh.position.set(x, h * 0.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

for (let i = -7; i <= 7; i += 1) {
  if (Math.abs(i) < 2) continue;
  createBuilding(i * 22, -112, 20 + Math.random() * 30, 0x738195);
  createBuilding(i * 22, 112, 16 + Math.random() * 26, 0x68758d);
  createBuilding(-120, i * 20, 14 + Math.random() * 18, 0x8f7c74);
  createBuilding(120, i * 20, 18 + Math.random() * 22, 0x779487);
}

function createBridge() {
  const bridge = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(130, 4, 18),
    new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.6, metalness: 0.3 })
  );
  deck.position.set(0, 8, 158);
  deck.castShadow = true;
  deck.receiveShadow = true;
  bridge.add(deck);

  for (let i = -2; i <= 2; i += 1) {
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 16, 8), new THREE.MeshStandardMaterial({ color: 0x9fa8b2 }));
    pylon.position.set(i * 28, 3, 158);
    pylon.castShadow = true;
    bridge.add(pylon);
  }
  scene.add(bridge);
}
createBridge();

function createTunnel() {
  const tunnel = new THREE.Group();
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(18, 10, 72),
    new THREE.MeshStandardMaterial({ color: 0x2b3037, roughness: 0.9 })
  );
  roof.position.set(-171, 7, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  tunnel.add(roof);
  scene.add(tunnel);
}
createTunnel();

function addStreetLight(x, z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 8, 8), new THREE.MeshStandardMaterial({ color: 0x60686f }));
  pole.position.set(x, 4, z);
  pole.castShadow = true;
  scene.add(pole);

  const lamp = new THREE.PointLight(0xffefbd, 0.7, 36);
  lamp.position.set(x, 7.6, z);
  scene.add(lamp);
  neonLights.push(lamp);
}

for (let i = -5; i <= 5; i += 1) {
  addStreetLight(i * 34, 30);
  addStreetLight(i * 34, -30);
}

function createTrafficLight(x, z, axis = "x") {
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 7, 8), new THREE.MeshStandardMaterial({ color: 0x4d545d }));
  pole.position.y = 3.5;
  grp.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.9), new THREE.MeshStandardMaterial({ color: 0x222831 }));
  head.position.set(0, 6.2, 0);
  grp.add(head);

  const red = new THREE.PointLight(0xff2230, 0, 10);
  red.position.set(0, 6.6, 0.5);
  const green = new THREE.PointLight(0x44ff60, 0, 10);
  green.position.set(0, 5.8, 0.5);
  grp.add(red, green);
  grp.position.set(x, 0, z);
  scene.add(grp);

  world.trafficLights.push({
    axis,
    mesh: grp,
    red,
    green,
    timer: Math.random() * 7
  });
}

createTrafficLight(90, 10, "x");
createTrafficLight(-90, -10, "x");
createTrafficLight(10, 70, "z");
createTrafficLight(-10, -70, "z");

function createGasStation() {
  const station = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(40, 0.7, 28), new THREE.MeshStandardMaterial({ color: 0x585c65 }));
  base.position.set(145, 0.35, -96);
  base.receiveShadow = true;
  station.add(base);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(38, 1.4, 18), new THREE.MeshStandardMaterial({ color: 0x91a6ba, metalness: 0.2 }));
  roof.position.set(145, 6.8, -96);
  roof.castShadow = true;
  station.add(roof);
  scene.add(station);
}
createGasStation();

function createParking() {
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(42, 26), new THREE.MeshStandardMaterial({ color: 0x20252d, roughness: 1 }));
  lot.position.set(-144, 0.015, -100);
  lot.rotation.x = -Math.PI * 0.5;
  lot.receiveShadow = true;
  scene.add(lot);
}
createParking();

for (let i = 0; i < 28; i += 1) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 2.8, 6), new THREE.MeshStandardMaterial({ color: 0x6d4f3a }));
  trunk.position.y = 1.4;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(2.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3d6a3d }));
  crown.position.y = 3.5;
  tree.add(trunk, crown);
  tree.position.set((Math.random() - 0.5) * 560, 0, (Math.random() - 0.5) * 560);
  scene.add(tree);
}

function createCar(color = 0xff3f55) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.7, 4.2),
    new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.4 })
  );
  body.position.y = 1.18;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.62, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x253746, metalness: 0.6, roughness: 0.2 })
  );
  cabin.position.set(0, 1.65, -0.15);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  wheelGeo.rotateZ(Math.PI * 0.5);
  const wheelSpots = [
    [-0.94, 0.74, 1.35],
    [0.94, 0.74, 1.35],
    [-0.94, 0.74, -1.35],
    [0.94, 0.74, -1.35]
  ];
  const wheels = wheelSpots.map(([x, y, z], idx) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, y, z);
    w.castShadow = true;
    group.add(w);
    return { mesh: w, front: idx < 2 };
  });

  const steeringWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.03, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x111319, metalness: 0.2, roughness: 0.7 })
  );
  steeringWheel.position.set(-0.32, 1.52, 0.2);
  steeringWheel.rotation.set(Math.PI / 2.5, 0, Math.PI / 2);
  group.add(steeringWheel);

  const brakeGeo = new THREE.BoxGeometry(0.2, 0.08, 0.3);
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0x220000 });
  const bl = new THREE.Mesh(brakeGeo, brakeMat);
  const br = new THREE.Mesh(brakeGeo, brakeMat);
  bl.position.set(-0.62, 1.14, -2.12);
  br.position.set(0.62, 1.14, -2.12);
  group.add(bl, br);

  const headL = new THREE.SpotLight(0xd6f4ff, 0.0, 38, Math.PI / 6, 0.65, 1.5);
  const headR = new THREE.SpotLight(0xd6f4ff, 0.0, 38, Math.PI / 6, 0.65, 1.5);
  headL.position.set(-0.65, 1.18, 2.1);
  headR.position.set(0.65, 1.18, 2.1);
  headL.target.position.set(-0.65, 0.8, 12);
  headR.target.position.set(0.65, 0.8, 12);
  group.add(headL, headR, headL.target, headR.target);

  return {
    group,
    body,
    steeringWheel,
    wheels,
    brakeMat,
    headlights: [headL, headR]
  };
}

const playerCar = createCar();
playerCar.group.position.set(0, 0.1, -20);
scene.add(playerCar.group);

const control = {
  KeyW: false,
  KeyA: false,
  KeyS: false,
  KeyD: false,
  Space: false,
  ShiftLeft: false
};

const carState = {
  speed: 0,
  yaw: 0,
  steer: 0,
  rpm: 900,
  gear: 0,
  engineOn: false,
  suspended: false,
  nitro: 1,
  cameraIndex: 0,
  shake: 0
};

const gears = {
  ratios: [-2.9, 0, 2.8, 2.1, 1.65, 1.3, 1.02, 0.84],
  maxSpeed: [-45, 0, 48, 88, 125, 165, 205, 248]
};

const cameraModes = [
  { offset: new THREE.Vector3(0, 5.4, -10.2), lookAt: new THREE.Vector3(0, 1.6, 7.5), fov: 66 },
  { offset: new THREE.Vector3(0, 1.45, 0.6), lookAt: new THREE.Vector3(0, 1.3, 8.4), fov: 74 },
  { offset: new THREE.Vector3(0, 1.75, 3.1), lookAt: new THREE.Vector3(0, 1.3, 17), fov: 68 }
];

const map2d = ui.minimap.getContext("2d");
const clock = new THREE.Clock();
let accumulator = 0;
let paused = false;
let fpsCounter = { frames: 0, time: 0 };

const skidGeo = new THREE.BufferGeometry();
const skidMax = 1200;
const skidPositions = new Float32Array(skidMax * 3);
skidGeo.setAttribute("position", new THREE.BufferAttribute(skidPositions, 3));
const skidLine = new THREE.LineSegments(skidGeo, new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8 }));
scene.add(skidLine);
let skidIndex = 0;

const smokeGeo = new THREE.BufferGeometry();
const smokeCount = MOBILE ? 80 : 120;
const smokePos = new Float32Array(smokeCount * 3);
const smokeLife = new Float32Array(smokeCount);
smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePos, 3));
const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ size: 0.65, color: 0xd3d7dc, transparent: true, opacity: 0.45 }));
scene.add(smoke);

function spawnTrafficCar() {
  const car = createCar(Math.random() > 0.5 ? 0x49b9ff : 0xffc54c);
  car.group.scale.setScalar(0.88);
  scene.add(car.group);
  const routeType = Math.random() > 0.5 ? "x" : "z";
  const dir = Math.random() > 0.5 ? 1 : -1;
  const lane = routeType === "x" ? (Math.random() > 0.5 ? 70 : -70) : (Math.random() > 0.5 ? 90 : -90);
  car.group.position.set(routeType === "x" ? -210 * dir : lane, 0.1, routeType === "z" ? -210 * dir : lane);
  world.trafficCars.push({
    car,
    routeType,
    dir,
    lane,
    speed: 14 + Math.random() * 16
  });
}

for (let i = 0; i < 8; i += 1) spawnTrafficCar();

function spawnPedestrian() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.7, 0.4),
    new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0xe6d17a : 0x8ad6ff })
  );
  mesh.castShadow = true;
  const pathX = Math.random() > 0.5;
  mesh.position.set(pathX ? -170 + Math.random() * 340 : (Math.random() > 0.5 ? 104 : -104), 0.9, pathX ? (Math.random() > 0.5 ? 84 : -84) : -170 + Math.random() * 340);
  scene.add(mesh);
  world.pedestrians.push({
    mesh,
    axis: pathX ? "x" : "z",
    dir: Math.random() > 0.5 ? 1 : -1,
    speed: 1 + Math.random() * 0.8
  });
}

for (let i = 0; i < (MOBILE ? 10 : 16); i += 1) spawnPedestrian();

const listener = new THREE.AudioListener();
camera.add(listener);
const audioCtx = listener.context;
const engineGain = audioCtx.createGain();
engineGain.gain.value = 0.0;
engineGain.connect(audioCtx.destination);
const engineOsc = audioCtx.createOscillator();
engineOsc.type = "sawtooth";
engineOsc.frequency.value = 60;
engineOsc.connect(engineGain);
engineOsc.start();

const nitroGain = audioCtx.createGain();
nitroGain.gain.value = 0;
nitroGain.connect(audioCtx.destination);
const nitroNoise = audioCtx.createBufferSource();
const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
const data = noiseBuffer.getChannelData(0);
for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.6;
nitroNoise.buffer = noiseBuffer;
nitroNoise.loop = true;
const filter = audioCtx.createBiquadFilter();
filter.type = "highpass";
filter.frequency.value = 900;
nitroNoise.connect(filter);
filter.connect(nitroGain);
nitroNoise.start();

function isRoad(x, z) {
  for (const r of world.roadRects) {
    if (Math.abs(x - r.x) <= r.w * 0.5 && Math.abs(z - r.z) <= r.d * 0.5) return true;
  }
  return false;
}

function emitSkid(x, y, z) {
  if (skidIndex >= skidMax - 2) skidIndex = 0;
  skidPositions[skidIndex * 3 + 0] = x;
  skidPositions[skidIndex * 3 + 1] = y + 0.02;
  skidPositions[skidIndex * 3 + 2] = z;
  skidPositions[(skidIndex + 1) * 3 + 0] = x + (Math.random() - 0.5) * 0.25;
  skidPositions[(skidIndex + 1) * 3 + 1] = y + 0.02;
  skidPositions[(skidIndex + 1) * 3 + 2] = z + (Math.random() - 0.5) * 0.25;
  skidIndex += 2;
  skidGeo.attributes.position.needsUpdate = true;
}

function emitSmoke(carPos) {
  for (let i = 0; i < 2; i += 1) {
    let idx = -1;
    for (let j = 0; j < smokeCount; j += 1) {
      if (smokeLife[j] <= 0) {
        idx = j;
        break;
      }
    }
    if (idx < 0) return;
    smokePos[idx * 3] = carPos.x + (Math.random() - 0.5) * 1.4;
    smokePos[idx * 3 + 1] = 0.55;
    smokePos[idx * 3 + 2] = carPos.z + (Math.random() - 0.5) * 1.4;
    smokeLife[idx] = 1.4;
  }
  smokeGeo.attributes.position.needsUpdate = true;
}

function updateSmoke(dt) {
  for (let i = 0; i < smokeCount; i += 1) {
    if (smokeLife[i] <= 0) continue;
    smokeLife[i] -= dt;
    smokePos[i * 3 + 1] += dt * 1.8;
    smokePos[i * 3] += (Math.random() - 0.5) * dt * 2.4;
    smokePos[i * 3 + 2] += (Math.random() - 0.5) * dt * 2.4;
    if (smokeLife[i] <= 0) {
      smokePos[i * 3 + 1] = -50;
    }
  }
  smokeGeo.attributes.position.needsUpdate = true;
}

function updateTrafficLights(dt) {
  for (const t of world.trafficLights) {
    t.timer += dt;
    const redOn = (t.timer % 8) < 4;
    t.red.intensity = redOn ? 1.6 : 0;
    t.green.intensity = redOn ? 0 : 1.4;
    t.mesh.children[1].material.emissive = new THREE.Color(redOn ? 0x550000 : 0x003300);
  }
}

function getTrafficStop(axis, x, z) {
  for (const l of world.trafficLights) {
    if (l.axis !== axis) continue;
    const redOn = (l.timer % 8) < 4;
    if (!redOn) continue;
    const dx = Math.abs(x - l.mesh.position.x);
    const dz = Math.abs(z - l.mesh.position.z);
    if (dx < 8 && dz < 8) return true;
  }
  return false;
}

function updateTraffic(dt) {
  for (const item of world.trafficCars) {
    const p = item.car.group.position;
    const stop = getTrafficStop(item.routeType, p.x, p.z);
    const curSpeed = stop ? Math.max(0, item.speed - 20 * dt) : item.speed;
    item.speed = stop ? curSpeed : Math.min(22, item.speed + 6 * dt);
    if (item.routeType === "x") {
      p.x += item.dir * item.speed * dt;
      p.z = item.lane;
      item.car.group.rotation.y = item.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (Math.abs(p.x) > 240) p.x = -240 * item.dir;
    } else {
      p.z += item.dir * item.speed * dt;
      p.x = item.lane;
      item.car.group.rotation.y = item.dir > 0 ? 0 : Math.PI;
      if (Math.abs(p.z) > 240) p.z = -240 * item.dir;
    }
  }
}

function updatePedestrians(dt) {
  for (const p of world.pedestrians) {
    if (p.axis === "x") {
      p.mesh.position.x += p.dir * p.speed * dt;
      if (Math.abs(p.mesh.position.x) > 180) p.dir *= -1;
    } else {
      p.mesh.position.z += p.dir * p.speed * dt;
      if (Math.abs(p.mesh.position.z) > 180) p.dir *= -1;
    }
  }
}

function clampWorld(pos) {
  pos.x = THREE.MathUtils.clamp(pos.x, -WORLD_HALF, WORLD_HALF);
  pos.z = THREE.MathUtils.clamp(pos.z, -WORLD_HALF, WORLD_HALF);
}

function resolveCollision() {
  const pos = playerCar.group.position;
  for (const t of world.trafficCars) {
    const d = pos.distanceTo(t.car.group.position);
    if (d < 2.25) {
      carState.speed *= -0.18;
      carState.shake = Math.max(carState.shake, 0.55);
      const push = pos.clone().sub(t.car.group.position).normalize().multiplyScalar(0.5);
      pos.add(push);
    }
  }
}

function calcGear(speedKmh) {
  if (speedKmh < -1) return -1;
  if (speedKmh < 2) return 0;
  if (speedKmh < 42) return 1;
  if (speedKmh < 78) return 2;
  if (speedKmh < 115) return 3;
  if (speedKmh < 152) return 4;
  if (speedKmh < 190) return 5;
  return 6;
}

function updateCar(dt) {
  const onRoad = isRoad(playerCar.group.position.x, playerCar.group.position.z);
  const grip = control.Space ? 0.45 : 1.0;
  const drag = onRoad ? 2.8 : 5.6;
  const accelBase = onRoad ? 16 : 8.5;
  const nitroBoost = control.ShiftLeft && carState.nitro > 0.05 ? 1.75 : 1;

  if (control.KeyW) carState.speed += accelBase * nitroBoost * dt;
  if (control.KeyS) {
    if (carState.speed > 0.6) {
      carState.speed -= 21 * dt;
    } else {
      carState.speed -= 9 * dt;
    }
  }
  carState.speed -= carState.speed * drag * dt * 0.035;

  const maxForward = control.ShiftLeft ? 76 : 66;
  carState.speed = THREE.MathUtils.clamp(carState.speed, -13, maxForward);

  const steerTarget = (control.KeyA ? 1 : 0) + (control.KeyD ? -1 : 0);
  carState.steer = THREE.MathUtils.lerp(carState.steer, steerTarget, dt * 6.8);

  const speedFactor = THREE.MathUtils.clamp(Math.abs(carState.speed) / 60, 0, 1);
  carState.yaw += carState.steer * (0.018 + 0.02 * (1 - speedFactor)) * grip * Math.sign(carState.speed || 1);
  playerCar.group.rotation.y = carState.yaw;

  const forward = new THREE.Vector3(Math.sin(carState.yaw), 0, Math.cos(carState.yaw));
  playerCar.group.position.addScaledVector(forward, carState.speed * dt);
  clampWorld(playerCar.group.position);

  const isDrifting = Math.abs(carState.steer) > 0.4 && Math.abs(carState.speed) > 12 && control.Space;
  if (isDrifting) {
    emitSkid(playerCar.group.position.x, 0, playerCar.group.position.z);
    emitSmoke(playerCar.group.position);
  }

  playerCar.body.rotation.z = -carState.steer * (0.08 + Math.abs(carState.speed) * 0.002);
  playerCar.body.position.y = 1.18 + Math.sin(performance.now() * 0.012 + Math.abs(carState.speed) * 0.2) * 0.03;

  for (const w of playerCar.wheels) {
    w.mesh.rotation.x += carState.speed * dt * 1.9;
    if (w.front) w.mesh.rotation.y = -carState.steer * 0.45;
  }
  playerCar.steeringWheel.rotation.y = carState.steer * 0.85;

  const kmh = carState.speed * 3.6;
  carState.gear = calcGear(kmh);
  const gearIdx = carState.gear + 1;
  const ratio = gears.ratios[gearIdx] || 0;
  const wheelRpm = Math.abs(kmh) * 28;
  carState.rpm = THREE.MathUtils.clamp(850 + wheelRpm * Math.max(0.35, Math.abs(ratio) * 0.2), 850, 7600);

  const braking = control.KeyS && carState.speed > 0.5;
  playerCar.brakeMat.emissive.setHex(braking ? 0x990000 : 0x110000);
  playerCar.headlights.forEach((h) => {
    h.intensity = 0.7 + parseFloat(ui.night.value) * 2.2;
  });

  if (control.ShiftLeft && Math.abs(carState.speed) > 10 && carState.nitro > 0) {
    carState.nitro = Math.max(0, carState.nitro - dt * 0.22);
    carState.shake = Math.min(1, carState.shake + dt * 1.4);
  } else {
    carState.nitro = Math.min(1, carState.nitro + dt * 0.07);
    carState.shake = Math.max(0, carState.shake - dt * 0.9);
  }

  resolveCollision();
}

function updateCamera(dt) {
  const cfg = cameraModes[carState.cameraIndex];
  const yaw = playerCar.group.rotation.y;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

  const desiredPos = cfg.offset.clone().applyQuaternion(q).add(playerCar.group.position);
  const desiredLook = cfg.lookAt.clone().applyQuaternion(q).add(playerCar.group.position);

  camera.position.lerp(desiredPos, dt * 4.4);
  camera.lookAt(desiredLook);
  camera.fov = THREE.MathUtils.lerp(camera.fov, cfg.fov + Math.abs(carState.speed) * 0.14, dt * 2.8);

  if (carState.shake > 0.02) {
    camera.position.x += (Math.random() - 0.5) * 0.07 * carState.shake;
    camera.position.y += (Math.random() - 0.5) * 0.07 * carState.shake;
  }
  camera.updateProjectionMatrix();
}

function updateSkyAndLights() {
  const night = parseFloat(ui.night.value);
  const dayColor = new THREE.Color(0x7da6cf);
  const nightColor = new THREE.Color(0x070b18);
  scene.background = dayColor.clone().lerp(nightColor, night);
  scene.fog.color.copy(scene.background);
  hemi.intensity = 0.8 - night * 0.45;
  sun.intensity = 1.3 - night * 0.95;
  neonLights.forEach((l) => {
    l.intensity = 0.45 + night * 1.8;
  });
  bloom.strength = MOBILE ? 0.26 + night * 0.32 : 0.38 + night * 0.35;
  renderer.toneMappingExposure = 1.03 + night * 0.22;
}

function updateAudio() {
  const rpmNorm = carState.rpm / 7600;
  engineOsc.frequency.setTargetAtTime(60 + rpmNorm * 230, audioCtx.currentTime, 0.04);
  engineGain.gain.setTargetAtTime(carState.engineOn ? 0.04 + rpmNorm * 0.07 : 0.0, audioCtx.currentTime, 0.08);
  nitroGain.gain.setTargetAtTime(control.ShiftLeft && carState.nitro > 0.05 ? 0.045 : 0, audioCtx.currentTime, 0.06);
}

function drawMinimap() {
  const w = ui.minimap.width;
  const h = ui.minimap.height;
  map2d.clearRect(0, 0, w, h);
  map2d.fillStyle = "rgba(12,16,21,0.92)";
  map2d.fillRect(0, 0, w, h);

  map2d.save();
  map2d.translate(w / 2, h / 2);
  map2d.scale(0.28, 0.28);
  map2d.fillStyle = "#30494f";
  for (const r of world.roadRects) {
    map2d.fillRect(r.x - r.w / 2, r.z - r.d / 2, r.w, r.d);
  }
  map2d.fillStyle = "#f5d970";
  for (const t of world.trafficCars) {
    map2d.fillRect(t.car.group.position.x - 2, t.car.group.position.z - 2, 4, 4);
  }
  map2d.fillStyle = "#7ce2ff";
  map2d.beginPath();
  map2d.arc(playerCar.group.position.x, playerCar.group.position.z, 4.5, 0, Math.PI * 2);
  map2d.fill();
  map2d.restore();
}

function updateHud(dt) {
  const kmh = Math.max(0, Math.round(Math.abs(carState.speed * 3.6)));
  ui.speed.innerHTML = `${kmh} <span>km/sa</span>`;
  ui.rpm.innerHTML = `${Math.round(carState.rpm)} <span>RPM</span>`;
  ui.gear.textContent = carState.gear === -1 ? "R" : carState.gear === 0 ? "N" : carState.gear.toString();

  fpsCounter.frames += 1;
  fpsCounter.time += dt;
  if (fpsCounter.time > 0.25) {
    ui.fps.textContent = Math.round(fpsCounter.frames / fpsCounter.time).toString();
    fpsCounter.frames = 0;
    fpsCounter.time = 0;
  }
}

function updateFrustumCulling() {
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(matrix);
  for (const b of scene.children) {
    if (!b.isMesh || b.geometry.type !== "BoxGeometry") continue;
    b.visible = frustum.intersectsObject(b);
  }
}

function tick(dt) {
  updateSkyAndLights();
  updateTrafficLights(dt);
  updateTraffic(dt);
  updatePedestrians(dt);
  updateCar(dt);
  updateCamera(dt);
  updateSmoke(dt);
  updateAudio();
  updateHud(dt);
  drawMinimap();
  updateFrustumCulling();
}

function animate() {
  const dtRaw = Math.min(clock.getDelta(), 0.05);
  if (!paused && carState.engineOn) {
    accumulator += dtRaw;
    while (accumulator >= FIXED_DT) {
      tick(FIXED_DT);
      accumulator -= FIXED_DT;
    }
  }
  composer.render();
  requestAnimationFrame(animate);
}

function togglePause(next) {
  paused = typeof next === "boolean" ? next : !paused;
  ui.pauseOverlay.classList.toggle("acik", paused);
}

function cycleCamera() {
  carState.cameraIndex = (carState.cameraIndex + 1) % cameraModes.length;
}

function keyState(code, value) {
  if (!(code in control)) return;
  control[code] = value;
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "KeyP") togglePause();
  if (e.code === "KeyC") cycleCamera();
  keyState(e.code, true);
});
window.addEventListener("keyup", (e) => keyState(e.code, false));

ui.pauseBtn.addEventListener("click", () => togglePause(true));
ui.continueBtn.addEventListener("click", () => togglePause(false));
ui.cameraBtn.addEventListener("click", cycleCamera);

ui.quality.addEventListener("input", () => {
  const val = parseFloat(ui.quality.value);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio * val, MOBILE ? 1.5 : 2));
});

ui.startBtn.addEventListener("click", async () => {
  carState.engineOn = true;
  ui.startOverlay.classList.remove("acik");
  if (audioCtx.state !== "running") await audioCtx.resume();
});

for (const btn of document.querySelectorAll("#mobil-kontrol button")) {
  const code = btn.dataset.key;
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (code === "KeyC") cycleCamera();
    keyState(code, true);
  });
  btn.addEventListener("pointerup", () => keyState(code, false));
  btn.addEventListener("pointercancel", () => keyState(code, false));
  btn.addEventListener("pointerleave", () => keyState(code, false));
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
