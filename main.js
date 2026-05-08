// main.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

const speedEl = document.getElementById("speed");
const gearEl = document.getElementById("gear");
const fpsEl = document.getElementById("fps");
const camBtn = document.getElementById("camBtn");
const startWrap = document.getElementById("start");
const startBtn = document.getElementById("startBtn");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1220);
scene.fog = new THREE.Fog(0x0a1220, 70, 420);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 5, -10);

const hemi = new THREE.HemisphereLight(0xb4ddff, 0x274018, 0.8);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d2, 1.2);
sun.position.set(-30, 40, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// Zemin
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(800, 800),
  new THREE.MeshStandardMaterial({ color: 0x2b3a28, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Yollar
const roadMat = new THREE.MeshStandardMaterial({ color: 0x171b22, roughness: 0.9 });
function addRoad(x, z, w, d) {
  const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
  r.rotation.x = -Math.PI / 2;
  r.position.set(x, 0.02, z);
  r.receiveShadow = true;
  scene.add(r);
}
addRoad(0, 0, 220, 20);
addRoad(0, 70, 220, 20);
addRoad(0, -70, 220, 20);
addRoad(-90, 0, 20, 220);
addRoad(90, 0, 20, 220);

// Binalar
for (let i = -6; i <= 6; i++) {
  if (Math.abs(i) < 2) continue;
  const h = 12 + Math.random() * 24;
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(12, h, 12),
    new THREE.MeshStandardMaterial({ color: 0x6f7f97, roughness: 0.8, metalness: 0.1 })
  );
  b.position.set(i * 20, h / 2, 120);
  b.castShadow = true;
  b.receiveShadow = true;
  scene.add(b);

  const h2 = 12 + Math.random() * 24;
  const b2 = b.clone();
  b2.position.set(i * 20, h2 / 2, -120);
  b2.scale.y = h2 / h;
  scene.add(b2);
}

// Araba
const car = new THREE.Group();
scene.add(car);

const body = new THREE.Mesh(
  new THREE.BoxGeometry(2.2, 0.7, 4.1),
  new THREE.MeshStandardMaterial({ color: 0xff3d5a, metalness: 0.35, roughness: 0.35 })
);
body.position.y = 1.2;
body.castShadow = true;
car.add(body);

const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 0.6, 1.8),
  new THREE.MeshStandardMaterial({ color: 0x233448, metalness: 0.6, roughness: 0.2 })
);
cabin.position.set(0, 1.6, -0.1);
cabin.castShadow = true;
car.add(cabin);

const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515 });

const wheels = [];
const spots = [
  [-0.9, 0.75, 1.3], [0.9, 0.75, 1.3],
  [-0.9, 0.75, -1.3], [0.9, 0.75, -1.3]
];
spots.forEach((p, i) => {
  const w = new THREE.Mesh(wheelGeo, wheelMat);
  w.position.set(p[0], p[1], p[2]);
  w.castShadow = true;
  car.add(w);
  wheels.push({ mesh: w, front: i < 2 });
});

car.position.set(0, 0.1, -20);

// Kontrol
const keys = {};
let running = false;
let speed = 0;
let yaw = 0;
let steer = 0;
let camMode = 0;
let last = performance.now();
let fpsFrames = 0;
let fpsTime = 0;

const cams = [
  { off: new THREE.Vector3(0, 5.2, -10), look: new THREE.Vector3(0, 1.4, 8), fov: 66 },
  { off: new THREE.Vector3(0, 1.5, 0.6), look: new THREE.Vector3(0, 1.2, 8), fov: 74 },
  { off: new THREE.Vector3(0, 1.8, 3.1), look: new THREE.Vector3(0, 1.3, 16), fov: 68 }
];

function gearFromKmh(kmh) {
  if (kmh < 2) return "N";
  if (kmh < 35) return "1";
  if (kmh < 65) return "2";
  if (kmh < 95) return "3";
  if (kmh < 125) return "4";
  if (kmh < 160) return "5";
  return "6";
}

function update(dt) {
  const nitro = keys.ShiftLeft ? 1.65 : 1.0;
  if (keys.KeyW) speed += 14 * nitro * dt;
  if (keys.KeyS) speed -= 18 * dt;

  speed -= speed * 0.025; // sürtünme
  speed = Math.max(-12, Math.min(70, speed));

  const targetSteer = (keys.KeyA ? 1 : 0) + (keys.KeyD ? -1 : 0);
  steer += (targetSteer - steer) * Math.min(1, dt * 8);

  yaw += steer * 0.02 * Math.sign(speed || 1);
  car.rotation.y = yaw;

  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  car.position.addScaledVector(fwd, speed * dt);

  // görsel his
  body.rotation.z = -steer * 0.08;
  body.position.y = 1.2 + Math.sin(performance.now() * 0.015) * 0.02;

  for (const w of wheels) {
    w.mesh.rotation.x += speed * dt * 2.0;
    if (w.front) w.mesh.rotation.y = -steer * 0.45;
  }

  // kamera
  const c = cams[camMode];
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const camPos = c.off.clone().applyQuaternion(q).add(car.position);
  const look = c.look.clone().applyQuaternion(q).add(car.position);

  camera.position.lerp(camPos, Math.min(1, dt * 5));
  camera.lookAt(look);
  camera.fov += (c.fov + Math.abs(speed) * 0.12 - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();

  const kmh = Math.max(0, Math.round(Math.abs(speed * 3.6)));
  speedEl.textContent = String(kmh);
  gearEl.textContent = speed < -1 ? "R" : gearFromKmh(kmh);
}

function animate(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (running) update(dt);

  renderer.render(scene, camera);

  fpsFrames++;
  fpsTime += dt;
  if (fpsTime > 0.25) {
    fpsEl.textContent = String(Math.round(fpsFrames / fpsTime));
    fpsFrames = 0;
    fpsTime = 0;
  }

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// Events
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyC") camMode = (camMode + 1) % cams.length;
});
addEventListener("keyup", (e) => (keys[e.code] = false));
camBtn.addEventListener("click", () => (camMode = (camMode + 1) % cams.length));

startBtn.addEventListener("click", () => {
  running = true;
  startWrap.classList.add("hidden");
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
