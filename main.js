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
scene.fog = new THREE.FogExp2(0x0a1220, 0.004);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 5, -10);

const hemi = new THREE.HemisphereLight(0xb4ddff, 0x1a3010, 0.6);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d2, 1.0);
sun.position.set(-40, 60, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;
sun.shadow.camera.far = 300;
scene.add(sun);

// Neon ambient
const ambient = new THREE.AmbientLight(0x1a2a40, 0.4);
scene.add(ambient);

// ===== HARİTA =====
// Zemin
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1200, 1200),
  new THREE.MeshStandardMaterial({ color: 0x1a2518, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Yol fonksiyonu
const roadMat = new THREE.MeshStandardMaterial({ color: 0x171b22, roughness: 0.9 });
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
const lineEdgeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

function addRoad(x, z, w, d, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0.02, z);
  group.rotation.y = rotY;

  const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
  r.rotation.x = -Math.PI / 2;
  r.receiveShadow = true;
  group.add(r);

  // Orta çizgi
  const dashCount = Math.floor(d / 8);
  for (let i = -dashCount; i <= dashCount; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.03, i * 8);
    group.add(line);
  }

  // Kenar çizgileri
  const edgeL = new THREE.Mesh(new THREE.PlaneGeometry(0.15, d), lineEdgeMat);
  edgeL.rotation.x = -Math.PI / 2;
  edgeL.position.set(-w / 2 + 0.2, 0.03, 0);
  group.add(edgeL);

  const edgeR = new THREE.Mesh(new THREE.PlaneGeometry(0.15, d), lineEdgeMat);
  edgeR.rotation.x = -Math.PI / 2;
  edgeR.position.set(w / 2 - 0.2, 0.03, 0);
  group.add(edgeR);

  scene.add(group);
  return group;
}

// Grid şehir yolları
const ROAD_W = 18;
const BLOCK = 70;
const CITY_SIZE = 4; // -4 to 4

for (let i = -CITY_SIZE; i <= CITY_SIZE; i++) {
  addRoad(0, i * BLOCK, (CITY_SIZE * 2 + 1) * BLOCK + 100, ROAD_W, 0); // Yatay
  addRoad(i * BLOCK, 0, ROAD_W, (CITY_SIZE * 2 + 1) * BLOCK + 100, 0); // Dikey
}

// Kavşak düzeltmeleri (yol üst üste gelmesin)
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

// Binalar
const buildingColors = [0x4a5568, 0x2d3748, 0x1a202c, 0x2c5282, 0x553c9a, 0x744210];
const neonColors = [0x00ffff, 0xff00ff, 0x00ff88, 0xffaa00, 0xff3366];

function createBuilding(bx, bz) {
  const h = 15 + Math.random() * 35;
  const w = 10 + Math.random() * 8;
  const d = 10 + Math.random() * 8;
  const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.15 })
  );
  mesh.position.set(bx, h / 2, bz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Neon pencereler
  if (Math.random() > 0.3) {
    const neonColor = neonColors[Math.floor(Math.random() * neonColors.length)];
    const winRows = Math.floor(h / 4);
    const winCols = Math.floor(w / 3);
    for (let r = 0; r < winRows; r++) {
      for (let c = 0; c < winCols; c++) {
        if (Math.random() > 0.6) {
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2, 1.8),
            new THREE.MeshBasicMaterial({ color: neonColor, side: THREE.DoubleSide })
          );
          win.position.set(
            bx - w / 2 + 2 + c * 3,
            3 + r * 4,
            bz + d / 2 + 0.05
          );
          scene.add(win);
        }
      }
    }
  }

  // Anten
  if (Math.random() > 0.6) {
    const anten = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.3, 4 + Math.random() * 6),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 })
    );
    anten.position.set(bx, h + 2, bz);
    scene.add(anten);
  }
}

// Binaları yerleştir
for (let x = -CITY_SIZE; x <= CITY_SIZE; x++) {
  for (let z = -CITY_SIZE; z <= CITY_SIZE; z++) {
    const px = x * BLOCK;
    const pz = z * BLOCK;
    // Yol kenarlarına bina
    const offset = ROAD_W / 2 + 8;
    if (Math.random() > 0.15) createBuilding(px + offset + Math.random() * 10, pz);
    if (Math.random() > 0.15) createBuilding(px - offset - Math.random() * 10, pz);
    if (Math.random() > 0.15) createBuilding(px, pz + offset + Math.random() * 10);
    if (Math.random() > 0.15) createBuilding(px, pz - offset - Math.random() * 10);
  }
}

// Ağaçlar
function addTree(tx, tz) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.6, 2.5),
    new THREE.MeshStandardMaterial({ color: 0x4a3728 })
  );
  trunk.position.set(tx, 1.25, tz);
  trunk.castShadow = true;
  scene.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(2.5, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a5c2e, roughness: 0.8 })
  );
  leaves.position.set(tx, 4.5, tz);
  leaves.castShadow = true;
  scene.add(leaves);
}

for (let i = 0; i < 60; i++) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 120 + Math.random() * 300;
  addTree(Math.cos(angle) * dist, Math.sin(angle) * dist);
}

// Sokak lambaları
function addLamp(lx, lz) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 })
  );
  pole.position.set(lx, 3.5, lz);
  scene.add(pole);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.4),
    new THREE.MeshBasicMaterial({ color: 0xffeebb })
  );
  bulb.position.set(lx, 7, lz);
  scene.add(bulb);

  const light = new THREE.PointLight(0xffeebb, 0.8, 25);
  light.position.set(lx, 6.5, lz);
  scene.add(light);
}

for (let i = -CITY_SIZE; i <= CITY_SIZE; i++) {
  for (let j = -3; j <= 3; j++) {
    if (Math.abs(j) < 1) continue;
    addLamp(j * BLOCK - ROAD_W / 2 - 2, i * BLOCK);
    addLamp(j * BLOCK + ROAD_W / 2 + 2, i * BLOCK);
    addLamp(i * BLOCK, j * BLOCK - ROAD_W / 2 - 2);
    addLamp(i * BLOCK, j * BLOCK + ROAD_W / 2 + 2);
  }
}

// ===== ARABA =====
const car = new THREE.Group();
scene.add(car);

// Gövde
const body = new THREE.Mesh(
  new THREE.BoxGeometry(2.2, 0.75, 4.2),
  new THREE.MeshStandardMaterial({ color: 0xff3d5a, metalness: 0.4, roughness: 0.3 })
);
body.position.y = 1.25;
body.castShadow = true;
car.add(body);

// Kabin
const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 0.65, 2.0),
  new THREE.MeshStandardMaterial({ color: 0x1a2a3a, metalness: 0.5, roughness: 0.2 })
);
cabin.position.set(0, 1.7, -0.15);
cabin.castShadow = true;
car.add(cabin);

// Farlar
const headLightGeo = new THREE.BoxGeometry(0.5, 0.2, 0.1);
const headLightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
const hlLeft = new THREE.Mesh(headLightGeo, headLightMat);
hlLeft.position.set(-0.7, 1.3, 2.1);
car.add(hlLeft);
const hlRight = new THREE.Mesh(headLightGeo, headLightMat);
hlRight.position.set(0.7, 1.3, 2.1);
car.add(hlRight);

const headLightL = new THREE.SpotLight(0xffffcc, 2, 60, 0.5, 0.5, 1);
headLightL.position.set(-0.7, 1.3, 2.2);
headLightL.target.position.set(-0.7, 0, 10);
car.add(headLightL);
car.add(headLightL.target);

const headLightR = new THREE.SpotLight(0xffffcc, 2, 60, 0.5, 0.5, 1);
headLightR.position.set(0.7, 1.3, 2.2);
headLightR.target.position.set(0.7, 0, 10);
car.add(headLightR);
car.add(headLightR.target);

// Stop lambaları
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.08), tailMat);
tlLeft.position.set(-0.7, 1.35, -2.1);
car.add(tlLeft);
const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.08), tailMat);
tlRight.position.set(0.7, 1.35, -2.1);
car.add(tlRight);

// Tekerlekler (düzgün pivot için Group kullan)
const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 20);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 });

const wheels = [];
const wheelPositions = [
  [-1.05, 0.4, 1.35], [1.05, 0.4, 1.35],
  [-1.05, 0.4, -1.35], [1.05, 0.4, -1.35]
];

wheelPositions.forEach((pos, i) => {
  const wGroup = new THREE.Group();
  wGroup.position.set(pos[0], pos[1], pos[2]);

  const tire = new THREE.Mesh(wheelGeo, wheelMat);
  tire.castShadow = true;
  wGroup.add(tire);

  // Jant
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.34, 12),
    rimMat
  );
  rim.rotation.z = Math.PI / 2;
  wGroup.add(rim);

  car.add(wGroup);
  wheels.push({ group: wGroup, front: i < 2 });
});

// Direksiyon (iç kamera için)
const steeringWheel = new THREE.Group();
const swRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.32, 0.035, 8, 28),
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 })
);
swRing.rotation.x = Math.PI / 2;
steeringWheel.add(swRing);

// Direksiyon spoke'ları
for (let i = 0; i < 3; i++) {
  const spoke = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.02, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  spoke.rotation.x = Math.PI / 2;
  spoke.rotation.z = (i * Math.PI * 2) / 3;
  steeringWheel.add(spoke);
}

const swHub = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16),
  new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7 })
);
swHub.rotation.x = Math.PI / 2;
steeringWheel.add(swHub);

steeringWheel.position.set(0, 1.35, 0.75);
steeringWheel.rotation.x = -0.35;
car.add(steeringWheel);

// Koltuk (iç kamerada görünsün)
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
  { off: new THREE.Vector3(0, 5.5, -11), look: new THREE.Vector3(0, 1.4, 8), fov: 66 },   // Takip
  { off: new THREE.Vector3(0, 1.45, 0.35), look: new THREE.Vector3(0, 1.3, 8), fov: 72 }, // İç (sürücü)
  { off: new THREE.Vector3(0, 2.2, 3.5), look: new THREE.Vector3(0, 1.3, 16), fov: 68 },  // Kaput
  { off: new THREE.Vector3(0, 18, -18), look: new THREE.Vector3(0, 0, 8), fov: 55 }        // Kuş bakışı
];

// ===== VİTES SİSTEMİ =====
let currentGear = 0; // 0=N, -1=R, 1-6
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

function updateGearUI() {
  const name = gearName(currentGear);
  gearEl.textContent = name;
  dashGear.textContent = name;

  // Vites kutusu slotları
  document.querySelectorAll(".gear-slot").forEach(slot => {
    slot.classList.toggle("active", parseInt(slot.dataset.gear === "R" ? "-1" : slot.dataset.gear) === currentGear);
  });

  // Knob pozisyonu
  const slotMap = { "-1": "r", 0: null, 1: "n1", 2: "n2", 3: "n3", 4: "n4", 5: "n5", 6: "n6" };
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

// PC vites kontrolü
function shiftUp() {
  if (currentGear < 6) shiftGear(currentGear + 1);
}
function shiftDown() {
  if (currentGear > -1) shiftGear(currentGear - 1);
}

// ===== MOBİL VİTES SÜRÜKLEME =====
let shifterDragging = false;
const shifterSlots = Array.from(document.querySelectorAll(".gear-slot"));

function getSlotFromPoint(x, y) {
  let closest = null;
  let minDist = Infinity;
  shifterSlots.forEach(slot => {
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
let speed = 0; // m/s
let yaw = 0;
let steer = 0;
let camMode = 0;
let last = performance.now();
let fpsFrames = 0;
let fpsTime = 0;
let isMobile = false;

// Mobil input state
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

// Cihaz seçimi
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

  // Vitesli hızlanma
  const gearRatio = gearRatios[currentGear] || 0;
  const targetSpeed = throttle * (currentGear === -1 ? -15 : currentGear === 0 ? 0 : 35 / (Math.abs(gearRatio) || 1));
  const accel = throttle * 18 * nitro * (currentGear === 0 ? 0 : 1);
  const decel = braking * 28;

  if (currentGear === 0) {
    // N'de boşta kayma
    if (throttle) speed += (keys.KeyW ? 1 : -1) * 6 * dt;
    speed -= speed * 1.5 * dt;
  } else {
    if (throttle) speed += accel * dt * Math.sign(gearRatio);
    if (braking) speed -= decel * dt * Math.sign(speed || 1);
  }

  // Sürtünme
  speed -= speed * 0.6 * dt;
  speed = Math.max(-18, Math.min(75, speed));

  // Direksiyon
  const targetSteer = (keys.KeyA || mobileInput.left ? 1 : 0) + (keys.KeyD || mobileInput.right ? -1 : 0);
  steer += (targetSteer - steer) * Math.min(1, dt * 6);

  // Dönüş (hızla orantılı, geri viteste ters)
  const turnFactor = Math.abs(speed) > 0.5 ? Math.sign(speed) : 1;
  yaw += steer * 0.028 * turnFactor * Math.min(Math.abs(speed) * 0.15, 1.2);
  car.rotation.y = yaw;

  // İleri hareket
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  car.position.addScaledVector(fwd, speed * dt);

  // Gövde eğimi (dönüşte hafif yan yatma - smooth)
  const targetRoll = -steer * 0.06 * Math.min(Math.abs(speed) * 0.08, 1);
  body.rotation.z += (targetRoll - body.rotation.z) * Math.min(1, dt * 4);

  // Tekerlek dönüşü
  for (const w of wheels) {
    // Tekerlek kendi ekseni etrafında dönsün
    w.group.children.forEach(child => {
      child.rotation.x += speed * dt * 3.5;
    });
    // Ön tekerlekler direksiyonla dönsün
    if (w.front) {
      w.group.rotation.y = -steer * 0.5;
    }
  }

  // Direksiyon dönüşü
  steeringWheel.rotation.z = -steer * 2.5;

  // RPM hesaplama
  let rpm = idleRpm;
  if (currentGear !== 0 && Math.abs(speed) > 0.5) {
    rpm = idleRpm + Math.abs(speed) * Math.abs(gearRatio) * 280;
  } else if (throttle && currentGear !== 0) {
    rpm = idleRpm + 1500;
  }
  rpm = Math.min(maxRpm, rpm + (Math.random() - 0.5) * 50);

  // Kamera
  const c = cams[camMode];
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const camPos = c.off.clone().applyQuaternion(q).add(car.position);
  const look = c.look.clone().applyQuaternion(q).add(car.position);

  camera.position.lerp(camPos, Math.min(1, dt * 4));
  camera.lookAt(look);
  camera.fov += (c.fov + Math.abs(speed) * 0.15 - camera.fov) * Math.min(1, dt * 3);
  camera.updateProjectionMatrix();

  // Dashboard görünürlük
  if (camMode === 1) {
    dashboard.classList.remove("hidden");
  } else {
    dashboard.classList.add("hidden");
  }

  // UI güncelle
  const kmh = Math.max(0, Math.round(Math.abs(speed * 3.6)));
  speedEl.textContent = String(kmh);
  rpmEl.textContent = String(Math.round(rpm));
  dashKmh.textContent = String(kmh);
  dashRpm.textContent = String(Math.round(rpm));
  dashSpeed.textContent = String(kmh);

  // İbreler
  const rpmAngle = -135 + (rpm / maxRpm) * 270;
  const speedAngle = -135 + (kmh / 240) * 270;
  needleRpm.style.transform = `rotate(${rpmAngle}deg)`;
  needleSpeed.style.transform = `rotate(${speedAngle}deg)`;
}

// ===== ANİMASYON =====
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
  // Başlangıç vitesi
  shiftGear(1);
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
