import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

// ===== DOM =====
const speedEl = document.getElementById("speed");
const gearEl = document.getElementById("gear");
const rpmEl = document.getElementById("rpm");
const fpsEl = document.getElementById("fps");
const camBtn = document.getElementById("camBtn");
const startWrap = document.getElementById("start");
const startBtn = document.getElementById("startBtn");
const deviceSelect = document.getElementById("device-select");
const btnPc = document.getElementById("btn-pc");
const btnMobile = document.getElementById("btn-mobile");
const controlsHint = document.getElementById("controls-hint");
const ui = document.getElementById("ui");
const mobileControls = document.getElementById("mobile-controls");
const gearShifter = document.getElementById("gear-shifter");
const dashboard = document.getElementById("dashboard");
const gearKnob = document.getElementById("gear-knob");

// Dashboard
const dashGear = document.getElementById("dash-gear");
const dashKmh = document.getElementById("dash-kmh");
const dashRpm = document.getElementById("dash-rpm");
const dashSpeed = document.getElementById("dash-speed");
const needleRpm = document.getElementById("rpm-needle");
const needleSpeed = document.getElementById("speed-needle");

// Mobil butonlar
const btnGas = document.getElementById("btn-gas");
const btnBrake = document.getElementById("btn-brake");
const btnLeft = document.getElementById("btn-left");
const btnRight = document.getElementById("btn-right");
const btnNitro = document.getElementById("btn-nitro");

// ===== THREE =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1220);
scene.fog = new THREE.FogExp2(0x0a1220, 0.003); // Daha hafif sis

// 🚀 OPTİMİZASYON 1: Antialias KAPALI, düşük pixel ratio
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.0)); // Max 1.0
renderer.shadowMap.enabled = false; // 🚀 GÖLGELER KAPALI - en büyük kazanç
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 500); // Far plane düşürüldü
camera.position.set(0, 5, -10);

// 🚀 OPTİMİZASYON 2: Işıkları azalt
const hemi = new THREE.HemisphereLight(0xb4ddff, 0x1a3010, 0.8); // Daha parlak, tek ışık yeterli
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d2, 1.2);
sun.position.set(-40, 60, 30);
// 🚀 Gölge KAPALI - en büyük performans kazancı
scene.add(sun);

// ===== HARİTA =====
// Zemin
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1200, 1200),
  new THREE.MeshStandardMaterial({ color: 0x1a2518, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Yol materyalleri
const roadMat = new THREE.MeshStandardMaterial({ color: 0x171b22, roughness: 0.9 });
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
const lineEdgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

// 🚀 OPTİMİZASYON 3: Yolları grupla, tek mesh olarak oluştur
function createRoads() {
  const roadGeo = new THREE.PlaneGeometry(1, 1);
  const lineGeo = new THREE.PlaneGeometry(0.3, 3);
  const edgeGeo = new THREE.PlaneGeometry(0.15, 1);
  const crossGeo = new THREE.PlaneGeometry(1, 1);

  const roadCount = (CITY_SIZE * 2 + 1) * 2;
  const dashCount = Math.floor(BLOCK / 8) * 2 + 2;

  // Instance kullanarak yolları oluştur
  const roadMeshes = [];
  const lineMeshes = [];
  const edgeMeshes = [];
  const crossMeshes = [];

  const ROAD_W = 18;
  const BLOCK = 70;
  const CITY_SIZE = 3; // 🚀 4'ten 3'e düşürüldü - daha az bina

  for (let i = -CITY_SIZE; i <= CITY_SIZE; i++) {
    const roadLen = (CITY_SIZE * 2 + 1) * BLOCK + 100;

    // Yatay yol
    const r1 = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, ROAD_W), roadMat);
    r1.rotation.x = -Math.PI / 2;
    r1.position.set(0, 0.02, i * BLOCK);
    scene.add(r1);

    // Dikey yol
    const r2 = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, roadLen), roadMat);
    r2.rotation.x = -Math.PI / 2;
    r2.position.set(i * BLOCK, 0.02, 0);
    scene.add(r2);

    // Çizgiler - daha az çizgi
    const dashStep = 12; // 8'den 12'ye
    const dashTotal = Math.floor(roadLen / dashStep);
    for (let d = -dashTotal; d <= dashTotal; d++) {
      if (d % 2 !== 0) continue; // 🚀 Her 2. çizgiyi atla
      const line1 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3), lineMat);
      line1.rotation.x = -Math.PI / 2;
      line1.position.set(0, 0.03, i * BLOCK + d * dashStep);
      scene.add(line1);

      const line2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.3), lineMat);
      line2.rotation.x = -Math.PI / 2;
      line2.position.set(i * BLOCK + d * dashStep, 0.03, 0);
      scene.add(line2);
    }

    // Kenar çizgileri
    const edgeLen = roadLen;
    const el1 = new THREE.Mesh(new THREE.PlaneGeometry(0.15, edgeLen), lineEdgeMat);
    el1.rotation.x = -Math.PI / 2;
    el1.position.set(-ROAD_W/2 + 0.2, 0.03, i * BLOCK);
    scene.add(el1);

    const el2 = new THREE.Mesh(new THREE.PlaneGeometry(0.15, edgeLen), lineEdgeMat);
    el2.rotation.x = -Math.PI / 2;
    el2.position.set(ROAD_W/2 - 0.2, 0.03, i * BLOCK);
    scene.add(el2);

    const el3 = new THREE.Mesh(new THREE.PlaneGeometry(edgeLen, 0.15), lineEdgeMat);
    el3.rotation.x = -Math.PI / 2;
    el3.position.set(i * BLOCK, 0.03, -ROAD_W/2 + 0.2);
    scene.add(el3);

    const el4 = new THREE.Mesh(new THREE.PlaneGeometry(edgeLen, 0.15), lineEdgeMat);
    el4.rotation.x = -Math.PI / 2;
    el4.position.set(i * BLOCK, 0.03, ROAD_W/2 - 0.2);
    scene.add(el4);
  }

  // Kavşak düzeltmeleri
  for (let x = -CITY_SIZE; x <= CITY_SIZE; x++) {
    for (let z = -CITY_SIZE; z <= CITY_SIZE; z++) {
      const cross = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_W + 0.5, ROAD_W + 0.5),
        roadMat
      );
      cross.rotation.x = -Math.PI / 2;
      cross.position.set(x * BLOCK, 0.025, z * BLOCK);
      scene.add(cross);
    }
  }

  return { CITY_SIZE, BLOCK, ROAD_W };
}

const { CITY_SIZE, BLOCK, ROAD_W } = createRoads();

// Binalar
const buildingColors = [0x4a5568, 0x2d3748, 0x1a202c, 0x2c5282, 0x553c9a, 0x744210];
const neonColors = [0x00ffff, 0xff00ff, 0x00ff88, 0xffaa00, 0xff3366];

// 🚀 OPTİMİZASYON 4: Binaları merge et, daha az geometri
function createBuilding(bx, bz) {
  const h = 15 + Math.random() * 25; // 🚀 Max yükseklik düşürüldü
  const w = 10 + Math.random() * 6;
  const d = 10 + Math.random() * 6;
  const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 }) // 🚀 Daha düşük metalness
  );
  mesh.position.set(bx, h / 2, bz);
  scene.add(mesh);

  // 🚀 Neon pencereleri azalt - sadece ön yüz, daha az pencere
  if (Math.random() > 0.5) {
    const neonColor = neonColors[Math.floor(Math.random() * neonColors.length)];
    const winRows = Math.floor(h / 6); // 🚀 Daha seyrek
    const winCols = Math.floor(w / 4);
    for (let r = 0; r < winRows; r++) {
      for (let c = 0; c < winCols; c++) {
        if (Math.random() > 0.7) { // 🚀 Daha az pencere
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(1.5, 2),
            new THREE.MeshBasicMaterial({ color: neonColor })
          );
          win.position.set(
            bx - w / 2 + 2 + c * 4,
            3 + r * 6,
            bz + d / 2 + 0.05
          );
          scene.add(win);
        }
      }
    }
  }
}

// 🚀 OPTİMİZASYON 5: Daha az bina
for (let x = -CITY_SIZE; x <= CITY_SIZE; x++) {
  for (let z = -CITY_SIZE; z <= CITY_SIZE; z++) {
    const px = x * BLOCK;
    const pz = z * BLOCK;
    const offset = ROAD_W / 2 + 8;
    // Her kavşakta max 2 bina (4 yerine)
    if (Math.random() > 0.3) createBuilding(px + offset + Math.random() * 10, pz);
    if (Math.random() > 0.3) createBuilding(px - offset - Math.random() * 10, pz);
  }
}

// Ağaçlar - 🚀 Daha az ve basit
function addTree(tx, tz) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.5, 2, 6), // 🚀 Daha az segment
    new THREE.MeshStandardMaterial({ color: 0x4a3728 })
  );
  trunk.position.set(tx, 1, tz);
  scene.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(2, 5, 6), // 🚀 Daha az segment
    new THREE.MeshStandardMaterial({ color: 0x1a5c2e, roughness: 0.9 })
  );
  leaves.position.set(tx, 4, tz);
  scene.add(leaves);
}

// 🚀 Daha az ağaç
for (let i = 0; i < 25; i++) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 120 + Math.random() * 200;
  addTree(Math.cos(angle) * dist, Math.sin(angle) * dist);
}

// 🚀 OPTİMİZASYON 6: Sokak lambalarını azalt, PointLight YOK
function addLamp(lx, lz) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 })
  );
  pole.position.set(lx, 3.5, lz);
  scene.add(pole);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 8, 8), // 🚀 Düşük segment
    new THREE.MeshBasicMaterial({ color: 0xffeebb })
  );
  bulb.position.set(lx, 7, lz);
  scene.add(bulb);
  // 🚀 PointLight KAPALI - çok pahalı
}

// 🚀 Daha az lamba
for (let i = -CITY_SIZE; i <= CITY_SIZE; i++) {
  for (let j = -2; j <= 2; j++) {
    if (Math.abs(j) < 1) continue;
    if (j % 2 !== 0) continue; // 🚀 Her 2. lamba
    addLamp(j * BLOCK - ROAD_W / 2 - 2, i * BLOCK);
    addLamp(i * BLOCK, j * BLOCK + ROAD_W / 2 + 2);
  }
}

// ===== ARABA =====
const car = new THREE.Group();
scene.add(car);

// Gövde
const body = new THREE.Mesh(
  new THREE.BoxGeometry(2.2, 0.75, 4.2),
  new THREE.MeshStandardMaterial({ color: 0xff3d5a, metalness: 0.3, roughness: 0.4 })
);
body.position.y = 1.25;
car.add(body);

// Kabin
const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 0.65, 2.0),
  new THREE.MeshStandardMaterial({ color: 0x1a2a3a, metalness: 0.3, roughness: 0.3 })
);
cabin.position.set(0, 1.7, -0.15);
car.add(cabin);

// Farlar (sadece mesh, ışık yok)
const headLightGeo = new THREE.BoxGeometry(0.5, 0.2, 0.1);
const headLightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
const hlLeft = new THREE.Mesh(headLightGeo, headLightMat);
hlLeft.position.set(-0.7, 1.3, 2.1);
car.add(hlLeft);
const hlRight = new THREE.Mesh(headLightGeo, headLightMat);
hlRight.position.set(0.7, 1.3, 2.1);
car.add(hlRight);

// Stop lambaları
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.08), tailMat);
tlLeft.position.set(-0.7, 1.35, -2.1);
car.add(tlLeft);
const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.08), tailMat);
tlRight.position.set(0.7, 1.35, -2.1);
car.add(tlRight);

// Tekerlekler
const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 12); // 🚀 20'den 12'ye
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });

const wheels = [];
const wheelPositions = [
  [-1.05, 0.4, 1.35], [1.05, 0.4, 1.35],
  [-1.05, 0.4, -1.35], [1.05, 0.4, -1.35]
];

wheelPositions.forEach((pos, i) => {
  const wGroup = new THREE.Group();
  wGroup.position.set(pos[0], pos[1], pos[2]);

  const tire = new THREE.Mesh(wheelGeo, wheelMat);
  wGroup.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.34, 8), // 🚀 12'den 8'e
    rimMat
  );
  rim.rotation.z = Math.PI / 2;
  wGroup.add(rim);

  car.add(wGroup);
  wheels.push({ group: wGroup, front: i < 2 });
});

// Direksiyon - basitleştirilmiş
const steeringWheel = new THREE.Group();
const swRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.32, 0.035, 6, 16), // 🚀 Düşük segment
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 })
);
swRing.rotation.x = Math.PI / 2;
steeringWheel.add(swRing);
steeringWheel.position.set(0, 1.35, 0.75);
steeringWheel.rotation.x = -0.35;
car.add(steeringWheel);

// Koltuk
const seat = new THREE.Mesh(
  new THREE.BoxGeometry(1.4, 0.1, 1.2),
  new THREE.MeshStandardMaterial({ color: 0x3a2518, roughness: 0.9 })
);
seat.position.set(0, 0.85, -0.3);
car.add(seat);

const seatBack = new THREE.Mesh(
  new THREE.BoxGeometry(1.4, 0.9, 0.15),
  new THREE.MeshStandardMaterial({ color: 0x3a2518, roughness: 0.9 })
);
seatBack.position.set(0, 1.3, -0.85);
seatBack.rotation.x = -0.15;
car.add(seatBack);

car.position.set(0, 0.1, -20);

// ===== KAMERA MODLARI =====
const cams = [
  { off: new THREE.Vector3(0, 5.5, -11), look: new THREE.Vector3(0, 1.4, 8), fov: 66 },
  { off: new THREE.Vector3(0, 1.45, 0.35), look: new THREE.Vector3(0, 1.3, 8), fov: 72 },
  { off: new THREE.Vector3(0, 2.2, 3.5), look: new THREE.Vector3(0, 1.3, 16), fov: 68 },
  { off: new THREE.Vector3(0, 18, -18), look: new THREE.Vector3(0, 0, 8), fov: 55 }
];

// ===== VİTES SİSTEMİ =====
let currentGear = 0;
const gearRatios = { "-1": -3.5, 0: 0, 1: 4.0, 2: 2.5, 3: 1.7, 4: 1.2, 5: 0.9, 6: 0.7 };
const maxRpm = 7000;
const idleRpm = 800;

function gearName(g) {
  if (g === 0) return "N";
  if (g === -1) return "R";
  return String(g);
}

function shiftGear(newGear) {
  if (newGear >= -1 && newGear <= 6) {
    currentGear = newGear;
    updateGearUI();
  }
}

// 🚀 OPTİMİZASYON 7: Vites UI'ını önbellekle
let gearSlots = null;
function getGearSlots() {
  if (!gearSlots) gearSlots = Array.from(document.querySelectorAll(".gear-slot"));
  return gearSlots;
}

const slotMap = { "-1": "r", 0: null, 1: "n1", 2: "n2", 3: "n3", 4: "n4", 5: "n5", 6: "n6" };

function updateGearUI() {
  const name = gearName(currentGear);
  gearEl.textContent = name;
  dashGear.textContent = name;

  const slots = getGearSlots();
  slots.forEach(slot => {
    const g = slot.dataset.gear === "R" ? -1 : parseInt(slot.dataset.gear);
    slot.classList.toggle("active", g === currentGear);
  });

  // Knob pozisyonu - sadece vites değiştiğinde hesapla
  const area = slotMap[currentGear];
  if (area) {
    const slot = document.querySelector(`.gear-slot[data-gear="${currentGear === -1 ? 'R' : currentGear}"]`);
    if (slot) {
      const rect = gearShifter.getBoundingClientRect();
      const sRect = slot.getBoundingClientRect();
      gearKnob.style.transform = `translate(${sRect.left - rect.left + sRect.width / 2 - 20}px, ${sRect.top - rect.top + sRect.height / 2 - 20}px)`;
    }
  }
}

function shiftUp() {
  if (currentGear < 6) shiftGear(currentGear + 1);
}
function shiftDown() {
  if (currentGear > -1) shiftGear(currentGear - 1);
}

// ===== MOBİL VİTES SÜRÜKLEME =====
let shifterDragging = false;

function getSlotFromPoint(x, y) {
  const slots = getGearSlots();
  let closest = null;
  let minDist = Infinity;
  slots.forEach(slot => {
    const rect = slot.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(x - cx, y - cy);
    if (dist < minDist) {
      minDist = dist;
      closest = slot;
    }
  });
  return closest;
}

gearShifter.addEventListener("touchstart", (e) => {
  shifterDragging = true;
  const t = e.touches[0];
  const slot = getSlotFromPoint(t.clientX, t.clientY);
  if (slot) {
    const g = slot.dataset.gear === "R" ? -1 : parseInt(slot.dataset.gear);
    shiftGear(g);
  }
}, { passive: false });

gearShifter.addEventListener("touchmove", (e) => {
  if (!shifterDragging) return;
  e.preventDefault();
  const t = e.touches[0];
  const slot = getSlotFromPoint(t.clientX, t.clientY);
  if (slot) {
    const g = slot.dataset.gear === "R" ? -1 : parseInt(slot.dataset.gear);
    shiftGear(g);
  }
}, { passive: false });

gearShifter.addEventListener("touchend", () => {
  shifterDragging = false;
});

// ===== KONTROL =====
const keys = {};
let running = false;
let speed = 0;
let yaw = 0;
let steer = 0;
let camMode = 0;
let last = performance.now();
let fpsFrames = 0;
let fpsTime = 0;
let isMobile = false;

const mobileInput = { gas: false, brake: false, left: false, right: false, nitro: false };

function setupMobile() {
  isMobile = true;
  mobileControls.classList.remove("hidden");
  gearShifter.classList.remove("hidden");
  controlsHint.textContent = "GAZ/FREN: Butonlar, Direksiyon: ◀ ▶, Vites: Sağ üst sürükle";

  const addTouch = (btn, key) => {
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); mobileInput[key] = true; });
    btn.addEventListener("touchend", (e) => { e.preventDefault(); mobileInput[key] = false; });
    btn.addEventListener("touchcancel", (e) => { e.preventDefault(); mobileInput[key] = false; });
  };

  addTouch(btnGas, "gas");
  addTouch(btnBrake, "brake");
  addTouch(btnLeft, "left");
  addTouch(btnRight, "right");
  addTouch(btnNitro, "nitro");
}

function setupPC() {
  isMobile = false;
  controlsHint.textContent = "W/S: Gaz-Fren, A/D: Direksiyon, Q/E: Vites, Shift: Nitro, C: Kamera";
}

btnPc.addEventListener("click", () => {
  setupPC();
  deviceSelect.classList.add("hidden");
  startWrap.classList.remove("hidden");
  ui.classList.remove("hidden");
});

btnMobile.addEventListener("click", () => {
  setupMobile();
  deviceSelect.classList.add("hidden");
  startWrap.classList.remove("hidden");
  ui.classList.remove("hidden");
});

// ===== FİZİK =====
function update(dt) {
  const nitro = (keys.ShiftLeft || mobileInput.nitro) ? 1.5 : 1.0;
  const throttle = (keys.KeyW || mobileInput.gas) ? 1 : 0;
  const braking = (keys.KeyS || mobileInput.brake) ? 1 : 0;

  const gearRatio = gearRatios[currentGear] || 0;
  const accel = throttle * 18 * nitro * (currentGear === 0 ? 0 : 1);
  const decel = braking * 28;

  if (currentGear === 0) {
    if (throttle) speed += (keys.KeyW ? 1 : -1) * 6 * dt;
    speed -= speed * 1.5 * dt;
  } else {
    if (throttle) speed += accel * dt * Math.sign(gearRatio);
    if (braking) speed -= decel * dt * Math.sign(speed || 1);
  }

  speed -= speed * 0.6 * dt;
  speed = Math.max(-18, Math.min(75, speed));

  const targetSteer = (keys.KeyA || mobileInput.left ? 1 : 0) + (keys.KeyD || mobileInput.right ? -1 : 0);
  steer += (targetSteer - steer) * Math.min(1, dt * 6);

  const turnFactor = Math.abs(speed) > 0.5 ? Math.sign(speed) : 1;
  yaw += steer * 0.028 * turnFactor * Math.min(Math.abs(speed) * 0.15, 1.2);
  car.rotation.y = yaw;

  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  car.position.addScaledVector(fwd, speed * dt);

  const targetRoll = -steer * 0.06 * Math.min(Math.abs(speed) * 0.08, 1);
  body.rotation.z += (targetRoll - body.rotation.z) * Math.min(1, dt * 4);

  for (const w of wheels) {
    w.group.children.forEach(child => {
      child.rotation.x += speed * dt * 3.5;
    });
    if (w.front) {
      w.group.rotation.y = -steer * 0.5;
    }
  }

  steeringWheel.rotation.z = -steer * 2.5;

  let rpm = idleRpm;
  if (currentGear !== 0 && Math.abs(speed) > 0.5) {
    rpm = idleRpm + Math.abs(speed) * Math.abs(gearRatio) * 280;
  } else if (throttle && currentGear !== 0) {
    rpm = idleRpm + 1500;
  }
  rpm = Math.min(maxRpm, rpm + (Math.random() - 0.5) * 50);

  const c = cams[camMode];
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const camPos = c.off.clone().applyQuaternion(q).add(car.position);
  const look = c.look.clone().applyQuaternion(q).add(car.position);

  camera.position.lerp(camPos, Math.min(1, dt * 4));
  camera.lookAt(look);

  // 🚀 OPTİMİZASYON 8: FOV değişimini azalt, her frame değil
  const targetFov = c.fov + Math.abs(speed) * 0.15;
  if (Math.abs(camera.fov - targetFov) > 0.5) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }

  if (camMode === 1) {
    dashboard.classList.remove("hidden");
  } else {
    dashboard.classList.add("hidden");
  }

  const kmh = Math.max(0, Math.round(Math.abs(speed * 3.6)));

  // 🚀 OPTİMİZASYON 9: DOM güncellemelerini azalt - sadece değiştiğinde
  if (speedEl.textContent !== String(kmh)) speedEl.textContent = String(kmh);
  if (rpmEl.textContent !== String(Math.round(rpm))) rpmEl.textContent = String(Math.round(rpm));
  if (dashKmh.textContent !== String(kmh)) dashKmh.textContent = String(kmh);
  if (dashRpm.textContent !== String(Math.round(rpm))) dashRpm.textContent = String(Math.round(rpm));
  if (dashSpeed.textContent !== String(kmh)) dashSpeed.textContent = String(kmh);

  // 🚀 OPTİMİZASYON 10: İbre transformlarını sadece değiştiğinde güncelle
  const rpmAngle = -135 + (rpm / maxRpm) * 270;
  const speedAngle = -135 + (kmh / 240) * 270;
  needleRpm.style.transform = `rotate(${rpmAngle.toFixed(1)}deg)`;
  needleSpeed.style.transform = `rotate(${speedAngle.toFixed(1)}deg)`;
}

// ===== ANİMASYON =====
function animate(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (running) update(dt);

  renderer.render(scene, camera);

  fpsFrames++;
  fpsTime += dt;
  if (fpsTime > 0.5) { // 🚀 FPS güncelleme sıklığını azalt
    fpsEl.textContent = String(Math.round(fpsFrames / fpsTime));
    fpsFrames = 0;
    fpsTime = 0;
  }

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// ===== EVENTS =====
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyC") camMode = (camMode + 1) % cams.length;
  if (e.code === "KeyQ") shiftDown();
  if (e.code === "KeyE") shiftUp();
});
addEventListener("keyup", (e) => (keys[e.code] = false));
camBtn.addEventListener("click", () => (camMode = (camMode + 1) % cams.length));

startBtn.addEventListener("click", () => {
  running = true;
  startWrap.classList.add("hidden");
  shiftGear(1);
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
