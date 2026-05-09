/**
 * UrbanDrive 3D - game.js
 * Optimize edilmiş tarayıcı tabanlı 3D araba oyunu
 * Three.js r128 kullanılarak geliştirildi
 */

'use strict';

// =====================================================================
// GLOBAL DURUM
// =====================================================================
const G = {
  scene: null, camera: null, renderer: null,
  clock: new THREE.Clock(),
  running: false, paused: false,
  quality: 'medium',  // low | medium | high
  shadows: true,
  aiEnabled: true,
  mobilePerf: false,
  volume: 0.7,
  frameCount: 0,
  fpsTime: 0,
  fpsDisplay: 60,
};

// =====================================================================
// AYARLAR & KALİTE ÖN AYARLARI
// =====================================================================
const QUALITY = {
  low:    { shadowMapSize: 512,  drawDistance: 150, aiCount: 3,  pixelRatio: 1 },
  medium: { shadowMapSize: 1024, drawDistance: 250, aiCount: 6,  pixelRatio: Math.min(window.devicePixelRatio,1.5) },
  high:   { shadowMapSize: 2048, drawDistance: 400, aiCount: 10, pixelRatio: Math.min(window.devicePixelRatio,2) },
};

// =====================================================================
// ARABA FİZİĞİ PARAMETRELERI
// =====================================================================
const CAR_PARAMS = {
  maxSpeed: 55,           // m/s (~200 km/h)
  acceleration: 22,
  brakeForce: 45,
  handbrakeForce: 60,
  friction: 12,
  turnSpeed: 1.8,
  maxTurn: 0.55,
  driftFactor: 0.88,
  nitroMultiplier: 1.65,
  nitroDrain: 18,         // birim/s
  nitroRegen: 5,          // birim/s
  nitroMax: 100,
  suspensionAmount: 0.06,
  mass: 1400,
};

// =====================================================================
// YÜKLEME EKRANı YÖNETİMİ
// =====================================================================
let loadProgress = 0;
function setProgress(val, label) {
  loadProgress = val;
  const bar = document.getElementById('loading-bar');
  const lbl = document.getElementById('loading-label');
  if (bar) bar.style.width = val + '%';
  if (lbl) lbl.textContent = (label || 'Yükleniyor...') + '  ' + Math.floor(val) + '%';
}

// =====================================================================
// BAŞLATMA
// =====================================================================
window.addEventListener('DOMContentLoaded', () => {
  initGame();
});

async function initGame() {
  setProgress(5, 'Renderer başlatılıyor');
  await sleep(50);
  setupRenderer();

  setProgress(15, 'Sahne oluşturuluyor');
  await sleep(50);
  setupScene();

  setProgress(25, 'Aydınlatma kuruluyor');
  await sleep(50);
  setupLights();

  setProgress(35, 'Harita oluşturuluyor');
  await sleep(80);
  buildCity();

  setProgress(55, 'Araç hazırlanıyor');
  await sleep(50);
  setupPlayer();

  setProgress(65, 'AI araçlar oluşturuluyor');
  await sleep(80);
  setupAICars();

  setProgress(75, 'Kamera ayarlanıyor');
  await sleep(30);
  setupCamera();

  setProgress(85, 'Ses sistemi kuruluyor');
  await sleep(30);
  setupAudio();

  setProgress(92, 'Kontroller bağlanıyor');
  await sleep(30);
  setupControls();
  setupMobileControls();
  setupUI();

  setProgress(100, 'Hazır!');
  await sleep(400);

  // Yükleme ekranını kaldır, menüyü göster
  const ls = document.getElementById('loading-screen');
  ls.style.opacity = '0';
  setTimeout(() => {
    ls.style.display = 'none';
    document.getElementById('main-menu').classList.remove('hidden');
  }, 600);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// =====================================================================
// RENDERER
// =====================================================================
function setupRenderer() {
  const canvas = document.getElementById('game-canvas');
  const q = QUALITY[G.quality];

  G.renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: G.quality !== 'low',
    powerPreference: 'high-performance',
    stencil: false,
  });

  G.renderer.setPixelRatio(q.pixelRatio);
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.renderer.shadowMap.enabled = G.shadows;
  G.renderer.shadowMap.type = G.quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  G.renderer.outputEncoding = THREE.sRGBEncoding;
  G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  G.renderer.toneMappingExposure = 1.1;
  G.renderer.physicallyCorrectLights = true;

  window.addEventListener('resize', onResize);
}

function onResize() {
  if (!G.camera || !G.renderer) return;
  G.camera.aspect = window.innerWidth / window.innerHeight;
  G.camera.updateProjectionMatrix();
  G.renderer.setSize(window.innerWidth, window.innerHeight);
}

// =====================================================================
// SAHNE
// =====================================================================
function setupScene() {
  G.scene = new THREE.Scene();
  G.scene.background = new THREE.Color(0x87ceeb);
  G.scene.fog = new THREE.Fog(0x87ceeb, 80, 280);
}

// =====================================================================
// AYDINLATMA
// =====================================================================
function setupLights() {
  // Güneş ışığı (directional)
  const sun = new THREE.DirectionalLight(0xfffde7, 2.2);
  sun.position.set(60, 120, 40);
  sun.castShadow = G.shadows;
  if (G.shadows) {
    const q = QUALITY[G.quality];
    sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;
    sun.shadow.camera.left   = -120;
    sun.shadow.camera.right  =  120;
    sun.shadow.camera.top    =  120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.bias = -0.001;
  }
  G.scene.add(sun);
  G.sunLight = sun;

  // Yarım küre ortam ışığı
  const hemi = new THREE.HemisphereLight(0xc9e8ff, 0x5d8060, 0.8);
  G.scene.add(hemi);

  // Hafif dolgu ışığı
  const fill = new THREE.DirectionalLight(0xfff4e0, 0.4);
  fill.position.set(-40, 30, -60);
  G.scene.add(fill);
}

// =====================================================================
// ŞEHİR HARİTASI
// =====================================================================
// Malzeme havuzu - aynı malzemeleri tekrar kullanarak bellek tasarrufu
const MAT = {};
function getMat(key, factory) {
  if (!MAT[key]) MAT[key] = factory();
  return MAT[key];
}

// Zemin
function buildGround() {
  const geo = new THREE.PlaneGeometry(600, 600);
  const mat = getMat('ground', () => new THREE.MeshLambertMaterial({ color: 0x3a7d44 }));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  G.scene.add(mesh);
}

// Yol ağı
const ROAD_W = 8;    // tek şerit genişliği
const BLOCK = 60;    // blok boyutu
const CITY_GRID = 5; // blok sayısı her yönde

// yol segmentleri [{x1,z1,x2,z2,w}] - minimap ve AI için kullanılıyor
const roadSegments = [];

function buildRoads() {
  const mat = getMat('road', () => new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
  const lineMat = getMat('line', () => new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const roadHW = ROAD_W * 1.5; // yarı genişlik (çift şerit)

  const size = CITY_GRID * BLOCK;
  const half = size / 2;

  // Yatay yollar
  for (let row = 0; row <= CITY_GRID; row++) {
    const z = -half + row * BLOCK;
    addRoadSegment(-half, z, half, z, roadHW * 2, mat, lineMat);
    roadSegments.push({ x1: -half, z1: z, x2: half, z2: z, w: roadHW });
  }
  // Dikey yollar
  for (let col = 0; col <= CITY_GRID; col++) {
    const x = -half + col * BLOCK;
    addRoadSegment(x, -half, x, half, roadHW * 2, mat, lineMat);
    roadSegments.push({ x1: x, z1: -half, x2: x, z2: half, w: roadHW });
  }
}

function addRoadSegment(x1, z1, x2, z2, width, mat, lineMat) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx*dx + dz*dz);
  const cx = (x1+x2)/2, cz = (z1+z2)/2;
  const angle = Math.atan2(dx, dz);

  // Yol yüzeyi
  const geo = new THREE.PlaneGeometry(width, len);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI/2;
  mesh.rotation.z = -angle;
  mesh.position.set(cx, 0.01, cz);
  mesh.receiveShadow = true;
  G.scene.add(mesh);

  // Orta çizgi
  const lineGeo = new THREE.PlaneGeometry(0.2, len);
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.rotation.x = -Math.PI/2;
  line.rotation.z = -angle;
  line.position.set(cx, 0.02, cz);
  G.scene.add(line);

  // Kenar çizgileri
  [-width/2+0.5, width/2-0.5].forEach(offset => {
    const eGeo = new THREE.PlaneGeometry(0.15, len);
    const e = new THREE.Mesh(eGeo, lineMat);
    e.rotation.x = -Math.PI/2;
    e.rotation.z = -angle;
    // offset yönü
    const perpX = -Math.sin(angle) * offset;
    const perpZ =  Math.cos(angle) * offset; // düzeltme
    e.position.set(cx + perpX, 0.02, cz + perpZ);
    G.scene.add(e);
  });
}

// Binalar
function buildBuildings() {
  const size = CITY_GRID * BLOCK;
  const half = size / 2;
  const roadHW = ROAD_W * 1.5;
  const gap = 2;

  const colors = [0x8d6e63, 0x78909c, 0x546e7a, 0x6d4c41, 0x455a64, 0x4e342e, 0xb0bec5];
  const mats = colors.map(c => new THREE.MeshLambertMaterial({ color: c }));
  const winMat = getMat('win', () => new THREE.MeshLambertMaterial({ color: 0x90caf9, emissive: 0x1565c0, emissiveIntensity: 0.2 }));

  for (let row = 0; row < CITY_GRID; row++) {
    for (let col = 0; col < CITY_GRID; col++) {
      const bx = -half + col * BLOCK + roadHW + gap;
      const bz = -half + row * BLOCK + roadHW + gap;
      const bw = BLOCK - roadHW*2 - gap*2;
      const bh = BLOCK - roadHW*2 - gap*2;

      if (bw < 4 || bh < 4) continue;

      // Her bloğu 1-4 binaya böl
      const splits = Math.floor(Math.random()*2)+1;
      const sw = bw / splits;

      for (let s = 0; s < splits; s++) {
        const px = bx + s*sw + sw/2 - bw/2;
        const height = 8 + Math.random()*40;
        const matIdx = Math.floor(Math.random()*mats.length);

        const geo = new THREE.BoxGeometry(sw-1, height, bh-1);
        const mesh = new THREE.Mesh(geo, mats[matIdx]);
        mesh.position.set(px + half - CITY_GRID*BLOCK/2 + roadHW/2, height/2, bz + bh/2 - half + roadHW/2);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        G.scene.add(mesh);

        // Pencereler (basit quad'lar - InstancedMesh yerine küçük kare)
        if (height > 10) {
          const wCount = Math.floor(height / 3);
          const wGeo = new THREE.PlaneGeometry(0.8, 0.6);
          const wMesh = new THREE.InstancedMesh(wGeo, winMat, wCount*2);
          wMesh.castShadow = false;
          let idx = 0;
          const dummy = new THREE.Object3D();
          for (let wi = 0; wi < wCount; wi++) {
            const wy = 2 + wi * 3;
            [[-sw/2, 0], [0, -bh/2]].forEach(([ox, oz], fi) => {
              if (idx < wCount*2) {
                dummy.position.set(
                  px + half - CITY_GRID*BLOCK/2 + roadHW/2 + (fi===0 ? ox : 0),
                  wy,
                  bz + bh/2 - half + roadHW/2 + (fi===1 ? oz : 0)
                );
                dummy.rotation.y = fi === 0 ? 0 : Math.PI/2;
                dummy.updateMatrix();
                wMesh.setMatrixAt(idx++, dummy.matrix);
              }
            });
          }
          wMesh.instanceMatrix.needsUpdate = true;
          G.scene.add(wMesh);
        }
      }
    }
  }
}

// Ağaçlar (InstancedMesh ile optimize)
function buildTrees() {
  const trunkMat = getMat('trunk', () => new THREE.MeshLambertMaterial({ color: 0x5d4037 }));
  const leafMat  = getMat('leaf',  () => new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 5);
  const leafGeo  = new THREE.SphereGeometry(1.8, 6, 5);

  const count = 80;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
  trunks.castShadow = true; leaves.castShadow = true;

  const dummy = new THREE.Object3D();
  const size = CITY_GRID * BLOCK;
  const half = size / 2;

  for (let i = 0; i < count; i++) {
    // Sadece kaldırım alanlarına yerleştir
    const col = Math.floor(Math.random() * (CITY_GRID+1));
    const t   = Math.random() * size;
    const roadHW = ROAD_W * 1.5 + 1;

    let tx, tz;
    if (Math.random() < 0.5) {
      tx = -half + col * BLOCK + (Math.random() < 0.5 ? -roadHW : roadHW);
      tz = -half + t;
    } else {
      tz = -half + col * BLOCK + (Math.random() < 0.5 ? -roadHW : roadHW);
      tx = -half + t;
    }

    dummy.position.set(tx, 1, tz);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.scale.setScalar(0.8 + Math.random() * 0.6);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    dummy.position.y = 3.2;
    dummy.scale.setScalar(dummy.scale.x);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
  }

  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  G.scene.add(trunks); G.scene.add(leaves);
}

// Trafik lambaları
const trafficLights = [];
function buildTrafficLights() {
  const size = CITY_GRID * BLOCK;
  const half = size / 2;
  const roadHW = ROAD_W * 1.5;

  const poleMat = getMat('pole', () => new THREE.MeshLambertMaterial({ color: 0x333333 }));
  const redMat   = new THREE.MeshLambertMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 1 });
  const yellowMat= new THREE.MeshLambertMaterial({ color: 0xffd600, emissive: 0xffd600, emissiveIntensity: 0.1 });
  const greenMat = new THREE.MeshLambertMaterial({ color: 0x00e676, emissive: 0x00e676, emissiveIntensity: 0.1 });

  for (let row = 1; row < CITY_GRID; row++) {
    for (let col = 1; col < CITY_GRID; col++) {
      const ix = -half + col * BLOCK;
      const iz = -half + row * BLOCK;
      const offsets = [[roadHW, 0], [-roadHW, 0], [0, roadHW], [0, -roadHW]];

      offsets.forEach(([ox, oz]) => {
        const group = new THREE.Group();
        // Direk
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 5), poleMat);
        pole.position.y = 2.5; group.add(pole);
        // Işıklar
        const rLight = new THREE.Mesh(new THREE.SphereGeometry(0.18,6,5), redMat.clone());
        const yLight = new THREE.Mesh(new THREE.SphereGeometry(0.18,6,5), yellowMat.clone());
        const gLight = new THREE.Mesh(new THREE.SphereGeometry(0.18,6,5), greenMat.clone());
        rLight.position.set(0, 5.5, 0);
        yLight.position.set(0, 5.0, 0);
        gLight.position.set(0, 4.5, 0);
        group.add(rLight); group.add(yLight); group.add(gLight);

        group.position.set(ix+ox, 0, iz+oz);
        G.scene.add(group);

        trafficLights.push({
          group, rLight, yLight, gLight,
          rMat: rLight.material, yMat: yLight.material, gMat: gLight.material,
          phase: Math.random() * 12, // rastgele başlangıç fazı
          state: 'green',
          isHoriz: Math.abs(ox) > 0,
        });
      });
    }
  }
}

function updateTrafficLights(dt) {
  const T = Date.now() / 1000;
  trafficLights.forEach(tl => {
    const t = (T + tl.phase) % 12;
    let state;
    if (t < 5)       state = 'green';
    else if (t < 6.5) state = 'yellow';
    else              state = 'red';

    if (state !== tl.state) {
      tl.state = state;
      tl.rMat.emissiveIntensity = state === 'red'    ? 1 : 0.05;
      tl.yMat.emissiveIntensity = state === 'yellow' ? 1 : 0.05;
      tl.gMat.emissiveIntensity = state === 'green'  ? 1 : 0.05;
    }
  });
}

// Park edilmiş araçlar (InstancedMesh)
function buildParkedCars() {
  const colors = [0xd32f2f, 0x1565c0, 0x2e7d32, 0x37474f, 0xf57f17, 0x6a1b9a, 0xffffff];
  const size = CITY_GRID * BLOCK;
  const half = size / 2;
  const roadHW = ROAD_W * 1.5;

  colors.forEach((color, ci) => {
    const mat = new THREE.MeshLambertMaterial({ color });
    const bodyGeo = new THREE.BoxGeometry(2, 0.8, 4);
    const roofGeo = new THREE.BoxGeometry(1.6, 0.6, 2.2);

    for (let i = 0; i < 3; i++) {
      const col = Math.floor(Math.random() * CITY_GRID);
      const t   = Math.random();
      const side = Math.random() < 0.5 ? 1 : -1;
      const isHoriz = Math.random() < 0.5;

      let px, pz, ry;
      if (isHoriz) {
        px = -half + col * BLOCK + side * (roadHW + 2.5);
        pz = -half + t * size;
        ry = Math.PI / 2;
      } else {
        pz = -half + col * BLOCK + side * (roadHW + 2.5);
        px = -half + t * size;
        ry = 0;
      }

      const body = new THREE.Mesh(bodyGeo, mat);
      body.position.set(px, 0.7, pz);
      body.rotation.y = ry;
      body.castShadow = true;
      G.scene.add(body);

      const roof = new THREE.Mesh(roofGeo, mat);
      roof.position.set(px, 1.4, pz);
      roof.rotation.y = ry;
      G.scene.add(roof);
    }
  });
}

// Tüm şehri bir arada kur
function buildCity() {
  buildGround();
  buildRoads();
  buildBuildings();
  buildTrees();
  buildTrafficLights();
  buildParkedCars();
}

// =====================================================================
// OYUNCU ARACI
// =====================================================================
const player = {
  mesh: null,
  body: null, // gövde
  wheels: [],
  lights: { head: [], brake: [], headOn: false, brakeOn: false },

  // Fizik durumu
  pos: new THREE.Vector3(5, 0.5, 5),
  vel: new THREE.Vector3(),
  heading: 0,     // radyan
  speed: 0,       // m/s (imzalı)
  steer: 0,       // anlık direksiyon [-1,1]
  targetSteer: 0,

  // Sistem durumu
  nitro: 100,
  damage: 0,
  onGround: true,
  drifting: false,
  braking: false,
};

function setupPlayer() {
  const group = new THREE.Group();

  // Araba gövde materyali
  const bodyMat = new THREE.MeshPhongMaterial({
    color: 0xe53935,
    shininess: 120,
    specular: 0xffffff,
  });
  const darkMat = getMat('dark', () => new THREE.MeshLambertMaterial({ color: 0x111111 }));
  const glassMat = getMat('glass', () => new THREE.MeshPhongMaterial({
    color: 0x90caf9, transparent: true, opacity: 0.55, shininess: 200
  }));
  const wheelMat = getMat('wheel', () => new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  const rimMat   = getMat('rim',   () => new THREE.MeshPhongMaterial({ color: 0xbdbdbd, shininess: 200 }));

  // Ana gövde
  const bodyGeo = new THREE.BoxGeometry(2.0, 0.65, 4.4);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.4;
  body.castShadow = true;
  group.add(body);
  player.body = body;

  // Çatı
  const roofGeo = new THREE.BoxGeometry(1.7, 0.55, 2.2);
  const roof = new THREE.Mesh(roofGeo, bodyMat);
  roof.position.set(0, 1.0, 0.2);
  roof.castShadow = true;
  group.add(roof);

  // Ön kaput eğimi (trapez benzeri - BoxGeometry ile simüle)
  const hoodGeo = new THREE.BoxGeometry(1.9, 0.18, 1.1);
  const hood = new THREE.Mesh(hoodGeo, bodyMat);
  hood.position.set(0, 0.75, -1.5);
  hood.rotation.x = 0.18;
  group.add(hood);

  // Arka bagaj
  const trunkGeo = new THREE.BoxGeometry(1.9, 0.18, 0.9);
  const trunk = new THREE.Mesh(trunkGeo, bodyMat);
  trunk.position.set(0, 0.77, 1.5);
  trunk.rotation.x = -0.12;
  group.add(trunk);

  // Cam ön
  const fGlassGeo = new THREE.PlaneGeometry(1.6, 0.55);
  const fGlass = new THREE.Mesh(fGlassGeo, glassMat);
  fGlass.position.set(0, 0.92, -1.08);
  fGlass.rotation.x = -0.75;
  group.add(fGlass);

  // Cam arka
  const rGlassGeo = new THREE.PlaneGeometry(1.55, 0.5);
  const rGlass = new THREE.Mesh(rGlassGeo, glassMat);
  rGlass.position.set(0, 0.92, 1.14);
  rGlass.rotation.x = 0.7;
  group.add(rGlass);

  // Alt kısım / şasi
  const chGeo = new THREE.BoxGeometry(1.85, 0.2, 4.0);
  const chassis = new THREE.Mesh(chGeo, darkMat);
  chassis.position.y = 0.07;
  group.add(chassis);

  // Farlar
  const headlightMat = new THREE.MeshPhongMaterial({ color: 0xfffde7, emissive: 0xffff99, emissiveIntensity: 0 });
  [[-0.75, 0.45, -2.2],[0.75, 0.45, -2.2]].forEach(([x,y,z]) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.08), headlightMat.clone());
    hl.position.set(x,y,z);
    group.add(hl);
    player.lights.head.push(hl);
  });

  // Fren lambaları (arka)
  const brakeMat = new THREE.MeshPhongMaterial({ color: 0xff1744, emissive: 0xff0000, emissiveIntensity: 0 });
  [[-0.75, 0.45, 2.2],[0.75, 0.45, 2.2]].forEach(([x,y,z]) => {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.08), brakeMat.clone());
    bl.position.set(x,y,z);
    group.add(bl);
    player.lights.brake.push(bl);
  });

  // Tekerler
  const wheelPositions = [
    [-0.92, 0, -1.4, true],
    [ 0.92, 0, -1.4, true],
    [-0.92, 0,  1.3, false],
    [ 0.92, 0,  1.3, false],
  ];
  wheelPositions.forEach(([x,y,z,isFront]) => {
    const wGrp = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12),
      wheelMat
    );
    tire.rotation.z = Math.PI/2;
    wGrp.add(tire);

    // Jant
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.20, 0.23, 6),
      rimMat
    );
    rim.rotation.z = Math.PI/2;
    wGrp.add(rim);

    wGrp.position.set(x, 0.32, z);
    wGrp.userData.isFront = isFront;
    group.add(wGrp);
    player.wheels.push(wGrp);
  });

  // Egzoz
  const exhaust = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.05, 0.4, 6),
    darkMat
  );
  exhaust.position.set(0.6, 0.12, 2.3);
  exhaust.rotation.x = Math.PI/2;
  group.add(exhaust);

  group.position.copy(player.pos);
  G.scene.add(group);
  player.mesh = group;

  // Araca bağlı far spot ışıkları
  if (G.quality !== 'low') {
    const hl1 = new THREE.SpotLight(0xfffde7, 0, 60, 0.45, 0.3);
    hl1.position.set(-0.75, 0.5, -2.2);
    hl1.target.position.set(-2, -0.5, -20);
    group.add(hl1); group.add(hl1.target);
    const hl2 = new THREE.SpotLight(0xfffde7, 0, 60, 0.45, 0.3);
    hl2.position.set(0.75, 0.5, -2.2);
    hl2.target.position.set(2, -0.5, -20);
    group.add(hl2); group.add(hl2.target);
    player.lights.spots = [hl1, hl2];
  }
}

// =====================================================================
// KAMERA
// =====================================================================
const CAM = {
  mode: 0, // 0=dış, 1=iç
  target: new THREE.Vector3(),
  lerpFactor: 0.1,
  shakeAmount: 0,
};

function setupCamera() {
  G.camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.2, 800);
  G.camera.position.set(0, 6, 14);
  G.scene.add(G.camera);
}

function updateCamera(dt) {
  if (!player.mesh) return;
  const mesh = player.mesh;
  const speed = Math.abs(player.speed);

  if (CAM.mode === 0) {
    // Dış kamera
    const dist = 10 + speed * 0.08;
    const height = 4.5 + speed * 0.02;
    const fwd = new THREE.Vector3(-Math.sin(player.heading), 0, -Math.cos(player.heading));
    const camTarget = mesh.position.clone()
      .add(fwd.clone().multiplyScalar(-dist))
      .add(new THREE.Vector3(0, height, 0));

    G.camera.position.lerp(camTarget, 0.08);
    CAM.target.lerp(mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0.12);
    G.camera.lookAt(CAM.target);
  } else {
    // İç kamera
    const fwd = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    const camPos = mesh.position.clone()
      .add(new THREE.Vector3(0, 1.1, 0))
      .add(fwd.clone().multiplyScalar(-0.3));
    G.camera.position.lerp(camPos, 0.25);
    const lookTarget = mesh.position.clone()
      .add(new THREE.Vector3(0, 0.8, 0))
      .add(fwd.clone().multiplyScalar(20));
    G.camera.lookAt(lookTarget);
  }

  // Kamera sarsıntısı (çarpma)
  if (CAM.shakeAmount > 0) {
    G.camera.position.x += (Math.random()-0.5) * CAM.shakeAmount;
    G.camera.position.y += (Math.random()-0.5) * CAM.shakeAmount;
    CAM.shakeAmount = Math.max(0, CAM.shakeAmount - dt*8);
  }

  // FOV hız efekti
  const targetFov = 70 + speed * 0.25;
  G.camera.fov += (targetFov - G.camera.fov) * 0.05;
  G.camera.updateProjectionMatrix();
}

// =====================================================================
// OYUNCU FİZİĞİ GÜNCELLEMESİ
// =====================================================================
const keys = {};
const CONTROLS = {
  forward:    ['w','arrowup'],
  back:       ['s','arrowdown'],
  left:       ['a','arrowleft'],
  right:      ['d','arrowright'],
  brake:      [' '],
  nitro:      ['n'],
  camToggle:  ['c'],
  lights:     ['h'],
  reset:      ['r'],
  pause:      ['escape','p'],
};

// Joystick durumu
const joystick = { x: 0, y: 0, active: false };

function setupControls() {
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    const k = e.key.toLowerCase();
    if (CONTROLS.camToggle.includes(k)) toggleCamera();
    if (CONTROLS.lights.includes(k)) toggleLights();
    if (CONTROLS.reset.includes(k)) resetCar();
    if (CONTROLS.pause.includes(k)) togglePause();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
}

function isKey(action) {
  return CONTROLS[action].some(k => keys[k]);
}

function updatePlayer(dt) {
  if (!player.mesh) return;
  const p = CAR_PARAMS;

  // Giriş topla
  let throttle = 0, brake = false, handbrake = false, nitroOn = false;

  if (isKey('forward') || joystick.y < -0.3)  throttle =  1;
  if (isKey('back')    || joystick.y >  0.3)  throttle = -0.6;
  if (isKey('brake'))   handbrake = true;
  if (isKey('nitro'))   nitroOn   = true;

  let steerInput = 0;
  if (isKey('left')  || joystick.x < -0.2) steerInput = -1;
  if (isKey('right') || joystick.x >  0.2) steerInput =  1;
  if (joystick.active) {
    steerInput = joystick.x;
    throttle   = Math.abs(joystick.y) > 0.2 ? -joystick.y : throttle;
  }

  // Mevcut hız değeri
  const spd = player.speed;
  const absSpd = Math.abs(spd);
  const maxSpd = p.maxSpeed;

  // Nitro
  if (nitroOn && player.nitro > 0) {
    player.nitro = Math.max(0, player.nitro - p.nitroDrain * dt);
    if (player.nitro > 0) throttle *= p.nitroMultiplier;
    document.getElementById('nitro-ind').classList.add('on');
    document.getElementById('speed-lines').classList.remove('hidden');
  } else {
    player.nitro = Math.min(p.nitroMax, player.nitro + p.nitroRegen * dt);
    document.getElementById('nitro-ind').classList.remove('on');
    if (absSpd < p.maxSpeed * 0.6)
      document.getElementById('speed-lines').classList.add('hidden');
  }

  // Hız güncelle
  if (throttle !== 0 && absSpd < maxSpd) {
    player.speed += throttle * p.acceleration * dt;
  } else if (throttle === 0) {
    // Sürtünme
    const friction = p.friction * dt;
    if (absSpd < friction) player.speed = 0;
    else player.speed -= Math.sign(spd) * friction;
  }

  // Fren/el freni
  if (handbrake && absSpd > 0.2) {
    const hbf = p.handbrakeForce * dt;
    if (absSpd < hbf) player.speed = 0;
    else player.speed -= Math.sign(spd) * hbf;
    player.drifting = true;
  } else if (throttle < 0 && spd > 0) {
    // Geri tuşu + ileri gidiyor = fren
    brake = true;
    player.speed -= p.brakeForce * dt;
    if (player.speed < 0) player.speed = 0;
  } else {
    player.drifting = handbrake;
  }

  player.braking = brake || handbrake;

  // Direksiyon
  const steerSensitivity = Math.max(0.2, 1 - absSpd/maxSpd*0.6);
  player.targetSteer = steerInput * p.maxTurn * steerSensitivity;
  player.steer += (player.targetSteer - player.steer) * (dt * 8);

  // Yaw (dönüş)
  if (absSpd > 0.5) {
    const yawRate = player.steer * p.turnSpeed * Math.sign(spd) * dt;
    player.heading += yawRate;

    // Drift kayması
    if (player.drifting && absSpd > 5) {
      player.heading += player.steer * 0.04;
    }
  }

  // Hız vektörünü heading'e göre güncelle
  const sinH = Math.sin(player.heading);
  const cosH = Math.cos(player.heading);

  // Yan kayma (drift hissi)
  const lateralDamp = player.drifting ? p.driftFactor : 0.96;
  const velDir = player.vel.clone().normalize();
  const fwdDir = new THREE.Vector3(sinH, 0, cosH);
  const dot = velDir.dot(fwdDir);

  player.vel.x = player.vel.x * (player.drifting ? 0.92 : 0.85) + sinH * player.speed * 0.15;
  player.vel.z = player.vel.z * (player.drifting ? 0.92 : 0.85) + cosH * player.speed * 0.15;

  // Ana hareket
  player.pos.x += sinH * player.speed * dt;
  player.pos.z += cosH * player.speed * dt;

  // Sınır
  const halfMap = CITY_GRID * BLOCK / 2 - 3;
  player.pos.x = THREE.MathUtils.clamp(player.pos.x, -halfMap, halfMap);
  player.pos.z = THREE.MathUtils.clamp(player.pos.z, -halfMap, halfMap);

  // Süspansiyon etkisi (sinüsoidal dikey hareket)
  const susp = Math.sin(Date.now() * 0.008 + absSpd * 0.2) * p.suspensionAmount * (absSpd / maxSpd);
  player.pos.y = 0.5 + susp;

  // Mesh'e uygula
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.heading + Math.PI;

  // Gövde yatması
  const rollAmount = -player.steer * (absSpd / maxSpd) * 0.08;
  player.mesh.rotation.z += (rollAmount - player.mesh.rotation.z) * 0.1;

  // Teker animasyonları
  const wheelSpin = player.speed * dt * 4;
  player.wheels.forEach((w, i) => {
    w.children[0].rotation.x += wheelSpin;
    w.children[1].rotation.x += wheelSpin;
    if (w.userData.isFront) {
      w.rotation.y = player.steer * 0.9;
    }
  });

  // Far/fren lambaları
  setHeadlights(player.lights.headOn);
  setBrakelights(player.braking);

  // UI güncelle
  updateSpeedUI(absSpd);
}

function updateSpeedUI(absSpd) {
  const kmh = Math.round(absSpd * 3.6);
  const sdEl = document.getElementById('speed-display');
  sdEl.textContent = kmh;
  sdEl.className = 'speed-value' + (kmh > 140 ? ' very-fast' : kmh > 80 ? ' fast' : '');

  // Gear
  const gEl = document.getElementById('gear-display');
  if (player.speed < -0.5) gEl.textContent = 'R';
  else if (absSpd < 1) gEl.textContent = 'N';
  else if (kmh < 40)  gEl.textContent = '1';
  else if (kmh < 80)  gEl.textContent = '2';
  else if (kmh < 120) gEl.textContent = '3';
  else if (kmh < 160) gEl.textContent = '4';
  else gEl.textContent = '5';

  // Nitro bar
  document.getElementById('nitro-bar').style.width = player.nitro + '%';

  // Damage
  document.getElementById('damage-fill').style.width = player.damage + '%';

  // Indicator
  const bInd = document.getElementById('brake-ind');
  if (player.braking) bInd.classList.add('brake-on'); else { bInd.classList.remove('brake-on'); bInd.classList.remove('on'); }
}

// =====================================================================
// FARLAR
// =====================================================================
function setHeadlights(on) {
  player.lights.head.forEach(h => { h.material.emissiveIntensity = on ? 2 : 0; });
  if (player.lights.spots) {
    player.lights.spots.forEach(s => { s.intensity = on ? 8 : 0; });
  }
  document.getElementById('light-ind').className = 'ind' + (on ? ' on' : '');
}
function setBrakelights(on) {
  player.lights.brake.forEach(b => { b.material.emissiveIntensity = on ? 3 : 0.05; });
}
function toggleLights() {
  player.lights.headOn = !player.lights.headOn;
}

// =====================================================================
// ÇARPIŞMA SİSTEMİ (basit AABB)
// =====================================================================
function checkCollisions() {
  // Diğer araçlarla çarpışma
  aiCars.forEach(ai => {
    const dx = player.pos.x - ai.pos.x;
    const dz = player.pos.z - ai.pos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < 3.5) {
      // İtme
      const nx = dx / dist, nz = dz / dist;
      player.pos.x += nx * 0.5;
      player.pos.z += nz * 0.5;
      const impact = Math.abs(player.speed) * 0.2;
      player.speed *= -0.3;
      if (impact > 1) {
        player.damage = Math.min(100, player.damage + impact * 2);
        CAM.shakeAmount = Math.min(impact * 0.15, 0.5);
        showDamageFlash();
      }
    }
  });

  // Basit bina çarpışması (harita sınırı yaklaşık)
  // Şehir bloklarına yaklaşıldığında yavaşlat
}

function showDamageFlash() {
  const el = document.createElement('div');
  el.className = 'damage-flash';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 300);
}

// =====================================================================
// YAPAY ZEKA ARAÇLARI
// =====================================================================
const aiCars = [];

function setupAICars() {
  if (!G.aiEnabled) return;
  const q = QUALITY[G.quality];
  const count = q.aiCount;

  const aiColors = [0x1a237e, 0x880e4f, 0x1b5e20, 0x4a148c, 0xe65100, 0x006064, 0x263238];
  const size = CITY_GRID * BLOCK;
  const half = size / 2;

  for (let i = 0; i < count; i++) {
    const color = aiColors[i % aiColors.length];
    const mat = new THREE.MeshLambertMaterial({ color });
    const darkMat = getMat('dark');

    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4), mat);
    body.position.y = 0.45; body.castShadow = true; group.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), mat);
    roof.position.set(0,1.0,0.2); group.add(roof);
    const wGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8);
    [[-0.92,0,-1.4],[0.92,0,-1.4],[-0.92,0,1.3],[0.92,0,1.3]].forEach(([x,y,z]) => {
      const w = new THREE.Mesh(wGeo, darkMat);
      w.position.set(x, 0.32, z); w.rotation.z = Math.PI/2;
      group.add(w);
    });

    // Başlangıç konumu (yollarda)
    const col = Math.floor(Math.random() * (CITY_GRID+1));
    const t = Math.random() * size;
    const isHoriz = Math.random() < 0.5;
    let px, pz, heading;
    if (isHoriz) {
      px = -half + t;
      pz = -half + col * BLOCK;
      heading = Math.PI * (Math.random() < 0.5 ? 0 : 1);
    } else {
      px = -half + col * BLOCK;
      pz = -half + t;
      heading = Math.PI * (Math.random() < 0.5 ? 0.5 : 1.5);
    }

    group.position.set(px, 0.5, pz);
    group.rotation.y = heading + Math.PI;
    G.scene.add(group);

    const aiSpeed = 6 + Math.random() * 8;
    aiCars.push({
      mesh: group,
      pos: new THREE.Vector3(px, 0.5, pz),
      heading,
      speed: aiSpeed,
      baseSpeed: aiSpeed,
      isHoriz,
      halfMap: half,
      wheels: group.children.filter((c,i) => i > 1), // tekerlekler
    });
  }
}

function updateAICars(dt) {
  aiCars.forEach(ai => {
    // Trafik ışığı durumu kontrolü
    let atRed = false;
    trafficLights.forEach(tl => {
      if (tl.state === 'red') {
        const dx = ai.pos.x - tl.group.position.x;
        const dz = ai.pos.z - tl.group.position.z;
        if (Math.sqrt(dx*dx+dz*dz) < 6) atRed = true;
      }
    });

    const targetSpeed = atRed ? 0 : ai.baseSpeed;
    ai.speed += (targetSpeed - ai.speed) * dt * 2;

    const sinH = Math.sin(ai.heading);
    const cosH = Math.cos(ai.heading);
    ai.pos.x += sinH * ai.speed * dt;
    ai.pos.z += cosH * ai.speed * dt;

    // Harita sınırında yön değiştir
    const bnd = ai.halfMap - 5;
    if (ai.pos.x > bnd || ai.pos.x < -bnd || ai.pos.z > bnd || ai.pos.z < -bnd) {
      ai.heading += Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
      ai.pos.x = THREE.MathUtils.clamp(ai.pos.x, -bnd, bnd);
      ai.pos.z = THREE.MathUtils.clamp(ai.pos.z, -bnd, bnd);
    }

    ai.mesh.position.copy(ai.pos);
    ai.mesh.rotation.y = ai.heading + Math.PI;

    // Teker dönüşü
    const spinAmt = ai.speed * dt * 4;
    ai.mesh.children.forEach((c,i) => {
      if (i > 1) c.rotation.x += spinAmt;
    });
  });
}

// =====================================================================
// SES SİSTEMİ
// =====================================================================
let audioCtx = null;
let engineGain = null, engineOscil = null;
let brakeSource = null;

function setupAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(audioCtx.destination);

    engineOscil = audioCtx.createOscillator();
    engineOscil.type = 'sawtooth';
    engineOscil.frequency.value = 80;

    // Distortion efekti motor sesi için
    const dist = audioCtx.createWaveShaper();
    dist.curve = makeDistortionCurve(30);
    engineOscil.connect(dist);
    dist.connect(engineGain);
    engineOscil.start();
  } catch(e) { console.warn('Web Audio desteklenmiyor:', e); }
}

function makeDistortionCurve(amount) {
  const k = amount, n = 256, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function updateAudio(dt) {
  if (!audioCtx || !engineOscil) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(()=>{});
    return;
  }
  const absSpd = Math.abs(player.speed);
  const maxSpd = CAR_PARAMS.maxSpeed;

  // Motor frekansı: rpm simülasyonu
  const rpm = 60 + (absSpd / maxSpd) * 140;
  engineOscil.frequency.setTargetAtTime(rpm, audioCtx.currentTime, 0.05);

  // Ses seviyesi
  const vol = (absSpd > 0.5 || isKey('forward') || isKey('back')) ? G.volume * 0.18 : G.volume * 0.05;
  engineGain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.08);
}

// =====================================================================
// MOBİL KONTROLLER (Joystick)
// =====================================================================
function setupMobileControls() {
  const base   = document.getElementById('joystick-base');
  const handle = document.getElementById('joystick-handle');
  if (!base) return;

  let startX = 0, startY = 0;
  const radius = 45;

  function onStart(e) {
    e.preventDefault();
    const t = e.touches ? e.touches[0] : e;
    const r = base.getBoundingClientRect();
    startX = r.left + r.width/2;
    startY = r.top + r.height/2;
    joystick.active = true;
  }
  function onMove(e) {
    e.preventDefault();
    if (!joystick.active) return;
    const t = e.touches ? e.touches[0] : e;
    let dx = t.clientX - startX;
    let dy = t.clientY - startY;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if (dist > radius) { dx = dx/dist*radius; dy = dy/dist*radius; }
    joystick.x = dx / radius;
    joystick.y = dy / radius;
    handle.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  function onEnd(e) {
    e.preventDefault();
    joystick.x = joystick.y = 0;
    joystick.active = false;
    handle.style.transform = 'translate(-50%, -50%)';
  }

  base.addEventListener('touchstart', onStart, { passive: false });
  base.addEventListener('touchmove',  onMove,  { passive: false });
  base.addEventListener('touchend',   onEnd,   { passive: false });

  // Mobil butonlar
  const mob = {
    'mob-brake':     () => { keys[' '] = true; },
    'mob-nitro':     () => { keys['n'] = true; },
    'mob-handbrake': () => { keys[' '] = true; },
    'mob-camera':    () => toggleCamera(),
    'mob-reset':     () => resetCar(),
    'mob-lights':    () => toggleLights(),
  };
  Object.entries(mob).forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
    el.addEventListener('touchend',   e => { e.preventDefault();
      keys[' '] = false; keys['n'] = false;
    }, { passive: false });
  });
}

// =====================================================================
// MİNİMAP
// =====================================================================
function drawMinimap() {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const size = CITY_GRID * BLOCK;
  const half = size / 2;
  const scale = W / size;

  ctx.clearRect(0, 0, W, H);

  // Çerçeve kırpma
  ctx.save();
  ctx.beginPath();
  ctx.arc(W/2, H/2, W/2-1, 0, Math.PI*2);
  ctx.clip();

  // Arka plan
  ctx.fillStyle = '#0a1420';
  ctx.fillRect(0, 0, W, H);

  // Yollar
  ctx.strokeStyle = '#334';
  ctx.lineWidth = ROAD_W * 2 * scale;
  roadSegments.forEach(seg => {
    ctx.beginPath();
    ctx.moveTo((seg.x1+half)*scale, (seg.z1+half)*scale);
    ctx.lineTo((seg.x2+half)*scale, (seg.z2+half)*scale);
    ctx.stroke();
  });

  // AI araçları
  ctx.fillStyle = '#ff9800';
  aiCars.forEach(ai => {
    const mx = (ai.pos.x+half)*scale;
    const mz = (ai.pos.z+half)*scale;
    ctx.fillRect(mx-2, mz-2, 4, 4);
  });

  // Oyuncu
  const px = (player.pos.x+half)*scale;
  const pz = (player.pos.z+half)*scale;
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(player.heading);
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(-3, -5, 6, 10);
  ctx.restore();

  ctx.restore();
}

// =====================================================================
// UI & MENÜ
// =====================================================================
function setupUI() {
  // Menü butonları
  document.getElementById('btn-play').addEventListener('click', startGame);
  document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('settings-menu').classList.remove('hidden');
  });
  document.getElementById('btn-back').addEventListener('click', () => {
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
  });
  document.getElementById('btn-resume').addEventListener('click', resumeGame);
  document.getElementById('btn-main-menu').addEventListener('click', () => {
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    G.running = false; G.paused = false;
  });
  document.getElementById('pause-btn').addEventListener('click', togglePause);

  // Kalite butonları
  document.querySelectorAll('.quality-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      G.quality = btn.dataset.q;
      applyQuality();
    });
  });

  // Toggle'lar
  document.getElementById('shadow-toggle').addEventListener('change', e => {
    G.shadows = e.target.checked;
    G.renderer.shadowMap.enabled = G.shadows;
  });
  document.getElementById('ai-toggle').addEventListener('change', e => {
    G.aiEnabled = e.target.checked;
  });
  document.getElementById('mobile-toggle').addEventListener('change', e => {
    G.mobilePerf = e.target.checked;
    applyQuality();
  });
  document.getElementById('vol-slider').addEventListener('input', e => {
    G.volume = e.target.value / 100;
  });
}

function applyQuality() {
  const q = QUALITY[G.quality];
  G.renderer.setPixelRatio(G.mobilePerf ? 1 : q.pixelRatio);
}

function startGame() {
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  G.running = true;
  G.paused  = false;
  resetCar();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  updateMission(0);
}

function togglePause() {
  if (!G.running) return;
  G.paused = !G.paused;
  if (G.paused) {
    document.getElementById('pause-menu').classList.remove('hidden');
  } else {
    document.getElementById('pause-menu').classList.add('hidden');
    G.clock.getDelta(); // delta sıfırla
  }
}
function resumeGame() {
  G.paused = false;
  document.getElementById('pause-menu').classList.add('hidden');
  G.clock.getDelta();
}

function toggleCamera() {
  CAM.mode = (CAM.mode + 1) % 2;
  document.getElementById('camera-mode').textContent = CAM.mode === 0 ? 'DIŞ KAMERA' : 'İÇ KAMERA';
}

function resetCar() {
  player.pos.set(5, 0.5, 5);
  player.speed = 0;
  player.heading = 0;
  player.steer = 0;
  player.damage = 0;
  if (player.mesh) {
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.set(0, Math.PI, 0);
  }
}

// =====================================================================
// GÖREV SİSTEMİ
// =====================================================================
const missions = [
  { desc: 'Şehri Keşfet - 5 mahalleyi ziyaret et',  done: false },
  { desc: '150 KM/H hıza ulaş',                      done: false },
  { desc: '60 saniye boyunca sür',                    done: false },
  { desc: 'Nitroyu tam doldur',                       done: false },
];
let currentMission = 0;
let missionTimer = 0;
let missionKmhPeak = 0;

function updateMission(dt) {
  const m = missions[currentMission];
  if (!m || m.done) return;

  missionTimer += dt;
  missionKmhPeak = Math.max(missionKmhPeak, Math.abs(player.speed) * 3.6);

  let complete = false;
  if (currentMission === 0 && missionTimer > 30) complete = true;
  if (currentMission === 1 && missionKmhPeak >= 150)  complete = true;
  if (currentMission === 2 && missionTimer >= 60)      complete = true;
  if (currentMission === 3 && player.nitro >= 99)      complete = true;

  if (complete) {
    m.done = true;
    currentMission = (currentMission + 1) % missions.length;
    missionTimer = 0; missionKmhPeak = 0;
    missions[currentMission].done = false;
    showMissionComplete();
  }

  document.getElementById('mission-desc').textContent = missions[currentMission].desc;
}

function showMissionComplete() {
  const el = document.getElementById('mission-box');
  el.style.borderColor = 'var(--accent)';
  el.style.boxShadow = '0 0 20px rgba(0,229,255,0.4)';
  setTimeout(() => { el.style.borderColor=''; el.style.boxShadow=''; }, 1500);
}

// =====================================================================
// FPS SAYACI
// =====================================================================
function updateFPS(dt) {
  G.frameCount++;
  G.fpsTime += dt;
  if (G.fpsTime >= 0.5) {
    G.fpsDisplay = Math.round(G.frameCount / G.fpsTime);
    G.frameCount = 0; G.fpsTime = 0;
    document.getElementById('fps-counter').textContent = G.fpsDisplay + ' FPS';
    document.getElementById('fps-counter').style.color =
      G.fpsDisplay >= 50 ? '#00e5ff' : G.fpsDisplay >= 30 ? '#ffd600' : '#ff3d00';
  }
}

// =====================================================================
// ANA DÖNGÜ
// =====================================================================
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(G.clock.getDelta(), 0.05); // max 50ms delta

  if (!G.running || G.paused) {
    G.renderer.render(G.scene, G.camera || new THREE.Camera());
    return;
  }

  // Oyun güncellemeleri
  updatePlayer(dt);
  updateAICars(dt);
  updateTrafficLights(dt);
  updateCamera(dt);
  updateAudio(dt);
  checkCollisions();
  drawMinimap();
  updateFPS(dt);
  updateMission(dt);

  G.renderer.render(G.scene, G.camera);
}

// Döngüyü başlat (her zaman render)
animate();
