// =============================================
//  ARABA SİMÜLATÖRÜ — app.js
// =============================================

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const rpmCvs  = document.getElementById('rpm-gauge');
const spdCvs  = document.getElementById('speed-gauge');
const rpmCtx  = rpmCvs.getContext('2d');
const spdCtx  = spdCvs.getContext('2d');

// ── Boyutlandırma ──────────────────────────────
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ── Yol Eğrisi Tanımları (uzun, kıvrımlı) ─────
// Her segment: { angle: radyan/adım, length: adım sayısı }
const ROAD_SEGMENTS = [];
(function buildRoad() {
  const pattern = [
    { angle: 0,       length: 200 },
    { angle: 0.012,   length: 120 },
    { angle: 0,       length: 80  },
    { angle: -0.018,  length: 150 },
    { angle: 0,       length: 100 },
    { angle: 0.022,   length: 100 },
    { angle: -0.010,  length: 80  },
    { angle: 0,       length: 200 },
    { angle: -0.025,  length: 130 },
    { angle: 0.015,   length: 110 },
    { angle: 0,       length: 90  },
    { angle: 0.030,   length: 80  },
    { angle: 0,       length: 120 },
    { angle: -0.020,  length: 140 },
    { angle: 0,       length: 160 },
  ];
  for (let loop = 0; loop < 40; loop++) {
    for (const p of pattern) {
      ROAD_SEGMENTS.push({ ...p });
    }
  }
})();

// Yol şeridi koordinatları önceden hesapla
const ROAD_WIDTH   = 320;
const STEP         = 2; // piksel/adım (dünya birimi)
let roadPoints     = [];  // { x, y, angle } dünya koordinatları

(function buildPoints() {
  let x = 0, y = 0, angle = -Math.PI / 2;
  let si = 0, stepInSeg = 0;
  const totalSteps = ROAD_SEGMENTS.reduce((a, s) => a + s.length, 0);

  for (let i = 0; i < totalSteps; i++) {
    roadPoints.push({ x, y, angle });
    const seg = ROAD_SEGMENTS[si];
    angle += seg.angle;
    x += Math.cos(angle) * STEP;
    y += Math.sin(angle) * STEP;
    stepInSeg++;
    if (stepInSeg >= seg.length) { stepInSeg = 0; si = (si + 1) % ROAD_SEGMENTS.length; }
  }
})();

// ── Araba Durumu ────────────────────────────────
const CAR = {
  roadPos: 0,          // Yol üzerindeki konum (roadPoints index, float)
  lateralOffset: 0,    // Şeritten yatay sapma
  speed: 0,            // m/s dünya birimi
  gear: 0,             // 0=Nötr, 1-5
  rpm: 800,
  steer: 0,
  braking: false,
  handbrake: false,
  engineOn: true,
};

const GEAR_RATIOS   = [0, 3.2, 1.9, 1.3, 0.95, 0.75]; // 0=nötr
const MAX_RPM       = 7000;
const IDLE_RPM      = 800;
const SHIFT_RPM_UP  = 6200;
const SHIFT_RPM_DN  = 2200;
const MAX_SPEED_KMH = 220;
const MAX_SPEED     = MAX_SPEED_KMH / 3.6;

// Vites başına max hız (km/h)
const GEAR_MAX_SPD  = [0, 50, 90, 130, 170, MAX_SPEED_KMH];

// ── Klavye ─────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyW') shiftUp();
  if (e.code === 'KeyS') shiftDown();
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup',   e => { keys[e.code] = false; });

function shiftUp()   { if (CAR.gear < 5) { CAR.gear++; updateGearUI(); } }
function shiftDown() { if (CAR.gear > 0) { CAR.gear--; updateGearUI(); } }

// ── Fizik ───────────────────────────────────────
let lastTime = 0;
let totalDist = 0;

function update(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  const gas   = keys['ArrowUp']   ? 1 : 0;
  const brake = keys['ArrowDown'] ? 1 : 0;
  const left  = keys['ArrowLeft'] ? 1 : 0;
  const right = keys['ArrowRight']? 1 : 0;
  const hbk   = keys['Space']     ? 1 : 0;

  CAR.braking   = brake > 0;
  CAR.handbrake = hbk  > 0;

  // Hız (km/h)
  const spdKmh = CAR.speed * 3.6;

  // Gas & irtifa direnci
  if (CAR.gear > 0 && gas > 0) {
    const gearMaxKmh = GEAR_MAX_SPD[CAR.gear];
    const gearFactor = Math.max(0, 1 - spdKmh / gearMaxKmh);
    const accel = 18 * gearFactor * gas;
    CAR.speed += accel * dt;
  }

  // Fren
  if (brake > 0 || hbk > 0) {
    const brakePow = hbk ? 30 : 14;
    CAR.speed -= brakePow * dt;
  }

  // Sürtünme & hava direnci
  const friction = 2.5;
  const aero     = 0.0009 * CAR.speed * CAR.speed;
  CAR.speed -= (friction + aero) * dt;
  CAR.speed  = Math.max(0, Math.min(CAR.speed, MAX_SPEED));

  // RPM hesabı
  if (CAR.gear > 0) {
    const ratio  = GEAR_RATIOS[CAR.gear];
    const target = IDLE_RPM + (CAR.speed / MAX_SPEED) * (MAX_RPM - IDLE_RPM) * (ratio / GEAR_RATIOS[1]);
    CAR.rpm += (target - CAR.rpm) * Math.min(dt * 8, 1);
    CAR.rpm  = Math.max(IDLE_RPM, Math.min(CAR.rpm, MAX_RPM + 300));
  } else {
    CAR.rpm += (IDLE_RPM - CAR.rpm) * Math.min(dt * 5, 1);
  }

  // Direksiyon (hıza bağlı)
  const steerStrength = 0.003 * (1 - spdKmh / 400);
  if (left)  CAR.lateralOffset -= steerStrength * spdKmh * dt * 60;
  if (right) CAR.lateralOffset += steerStrength * spdKmh * dt * 60;
  CAR.lateralOffset *= 0.97;
  CAR.lateralOffset = Math.max(-ROAD_WIDTH / 2 + 20, Math.min(ROAD_WIDTH / 2 - 20, CAR.lateralOffset));

  // Konum ilerlet
  const worldSpeed = CAR.speed / STEP;
  CAR.roadPos += worldSpeed * dt;
  if (CAR.roadPos >= roadPoints.length - 2) CAR.roadPos = 0;

  totalDist += CAR.speed * dt;

  // Redline
  document.body.classList.toggle('redline',   CAR.rpm > 6500);
  document.body.classList.toggle('overdrive', spdKmh > 180);

  updateHUD(spdKmh);
}

// ── HUD Güncelle ────────────────────────────────
function updateHUD(spdKmh) {
  document.getElementById('speed-display').textContent = Math.floor(spdKmh);
  document.getElementById('rpm-display').textContent   = Math.floor(CAR.rpm / 100);
  document.getElementById('distance-display').textContent =
    totalDist > 1000 ? (totalDist / 1000).toFixed(2) + ' km' : Math.floor(totalDist) + ' m';

  const rpmPct = (CAR.rpm - IDLE_RPM) / (MAX_RPM - IDLE_RPM) * 100;
  document.getElementById('engine-bar-fill').style.width = Math.min(100, rpmPct) + '%';

  drawGauge(rpmCtx, 160, 160, CAR.rpm / MAX_RPM, 'RPM', '#29b6f6');
  drawGauge(spdCtx, 160, 160, spdKmh / MAX_SPEED_KMH, 'KM/H', '#e8a020');
}

function updateGearUI() {
  document.getElementById('gear-display').textContent =
    CAR.gear === 0 ? 'N' : CAR.gear.toString();
  document.querySelectorAll('.g-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.g) === CAR.gear);
  });
}

// ── Dairesel Gösterge ───────────────────────────
function drawGauge(c, w, h, val, label, color) {
  c.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, r = 66;
  const startA = Math.PI * 0.75, endA = Math.PI * 2.25;
  const sweep  = startA + (endA - startA) * Math.min(val, 1);

  // Arka plan yay
  c.beginPath();
  c.arc(cx, cy, r, startA, endA);
  c.strokeStyle = 'rgba(255,255,255,0.06)';
  c.lineWidth = 10;
  c.lineCap  = 'round';
  c.stroke();

  // Değer yayı
  if (val > 0) {
    const grad = c.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, color + '88');
    grad.addColorStop(1, color);
    c.beginPath();
    c.arc(cx, cy, r, startA, sweep);
    c.strokeStyle = grad;
    c.lineWidth = 10;
    c.stroke();
  }

  // Kırmızı bölge (son %15)
  if (val > 0.85) {
    const redStart = startA + (endA - startA) * 0.85;
    c.beginPath();
    c.arc(cx, cy, r, redStart, sweep);
    c.strokeStyle = '#ff4444cc';
    c.lineWidth = 10;
    c.stroke();
  }

  // İbre
  const needleA = startA + (endA - startA) * Math.min(val, 1);
  c.save();
  c.translate(cx, cy);
  c.rotate(needleA);
  c.beginPath();
  c.moveTo(-8, 0);
  c.lineTo(r - 12, 0);
  c.strokeStyle = '#ffffff';
  c.lineWidth = 2;
  c.lineCap  = 'round';
  c.stroke();
  c.restore();

  // Merkez daire
  c.beginPath();
  c.arc(cx, cy, 8, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();

  // Etiket
  c.font = 'bold 10px Orbitron, monospace';
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.textAlign = 'center';
  c.fillText(label, cx, cy + 28);
}

// ── 3D Yol Render ───────────────────────────────
function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Gökyüzü gradyanı
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  sky.addColorStop(0,   '#050810');
  sky.addColorStop(0.4, '#0a1220');
  sky.addColorStop(1,   '#0f1e30');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.55);

  // Yıldızlar (sabit seed)
  drawStars(W, H);

  // Zemin
  const ground = ctx.createLinearGradient(0, H * 0.55, 0, H);
  ground.addColorStop(0, '#0d1a0d');
  ground.addColorStop(1, '#060e06');
  ctx.fillStyle = ground;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  drawRoad3D(W, H);
  drawCar(W, H);
}

// Statik yıldızlar
const STARS = Array.from({ length: 120 }, () => ({
  x: Math.random(), y: Math.random() * 0.55,
  r: Math.random() * 1.2 + 0.3,
  a: Math.random() * 0.6 + 0.4
}));

function drawStars(W, H) {
  for (const s of STARS) {
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,220,255,${s.a})`;
    ctx.fill();
  }
}

// Pseudo-3D yol çizimi
function drawRoad3D(W, H) {
  const horizon = H * 0.52;
  const camH    = H * 0.38;
  const depth   = 350;        // görüş uzaklığı (adım)
  const VP      = { x: W / 2, y: horizon };

  const posInt  = Math.floor(CAR.roadPos);
  const maxDraw = Math.min(depth, roadPoints.length - posInt - 2);

  // Çizgiler (ufuktan arabaya doğru, arka plandan öne)
  for (let i = maxDraw - 1; i >= 0; i--) {
    const idx  = (posInt + i) % roadPoints.length;
    const idx1 = (posInt + i + 1) % roadPoints.length;

    const t0 = i       / maxDraw;
    const t1 = (i + 1) / maxDraw;

    // Ekran koordinatı (perspektif)
    const p0 = worldToScreen(idx,  t0, W, H, horizon, camH, VP);
    const p1 = worldToScreen(idx1, t1, W, H, horizon, camH, VP);

    const halfW0 = perspWidth(t0);
    const halfW1 = perspWidth(t1);

    // Çimen şeritleri
    const grassColor = Math.floor(i / 8) % 2 === 0 ? '#0e2b0e' : '#0a220a';
    ctx.fillStyle = grassColor;
    ctx.beginPath();
    ctx.moveTo(p0.x - halfW0 * 2.5, p0.y);
    ctx.lineTo(p1.x - halfW1 * 2.5, p1.y);
    ctx.lineTo(p1.x + halfW1 * 2.5, p1.y);
    ctx.lineTo(p0.x + halfW0 * 2.5, p0.y);
    ctx.closePath();
    ctx.fill();

    // Asfalt
    const asphalt = Math.floor(i / 12) % 2 === 0 ? '#1a1a1a' : '#222222';
    ctx.fillStyle = asphalt;
    ctx.beginPath();
    ctx.moveTo(p0.x - halfW0, p0.y);
    ctx.lineTo(p1.x - halfW1, p1.y);
    ctx.lineTo(p1.x + halfW1, p1.y);
    ctx.lineTo(p0.x + halfW0, p0.y);
    ctx.closePath();
    ctx.fill();

    // Yol kenar çizgileri
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(1, halfW0 * 0.03);
    // Sol kenar
    ctx.beginPath();
    ctx.moveTo(p0.x - halfW0,        p0.y);
    ctx.lineTo(p1.x - halfW1,        p1.y);
    ctx.stroke();
    // Sağ kenar
    ctx.beginPath();
    ctx.moveTo(p0.x + halfW0,        p0.y);
    ctx.lineTo(p1.x + halfW1,        p1.y);
    ctx.stroke();

    // Orta kesikli çizgi
    if (Math.floor((posInt + i) / 20) % 2 === 0) {
      ctx.strokeStyle = 'rgba(255,210,0,0.6)';
      ctx.lineWidth = Math.max(1, halfW0 * 0.015);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }
}

function perspWidth(t) {
  // t=0 ufuk, t=1 araba önü
  return 14 + t * (ROAD_WIDTH * 0.65);
}

function worldToScreen(idx, t, W, H, horizon, camH, VP) {
  const pt    = roadPoints[idx];
  const ahead = roadPoints[Math.floor(idx)] || pt;

  // Perspektif Y
  const screenY = horizon + (1 - t) * 0 + t * camH;

  // Yol eğrisinin X katkısı: yol açısını biriktirerek ekrana yansıt
  let cumAngle = 0;
  const base = Math.floor(CAR.roadPos);
  for (let j = base; j <= idx && j < roadPoints.length - 1; j++) {
    cumAngle += roadPoints[j].angle !== undefined ? 0 : 0;
  }

  // Temel hesap: yol merkezini ufuk noktasından uzağa çiz
  const rx    = roadPoints[idx].x - roadPoints[base].x;
  const ry    = roadPoints[idx].y - roadPoints[base].y;

  // Kamera yönü: mevcut roadPoint'in açısı
  const camAngle = roadPoints[base].angle - Math.PI / 2;
  const local_x  = rx * Math.cos(-camAngle) - ry * Math.sin(-camAngle);

  const screenX = W / 2 + local_x * (1 - t) * 0.8 + CAR.lateralOffset * t * 0;

  return { x: screenX, y: screenY };
}

// ── Araba Çizimi ─────────────────────────────────
function drawCar(W, H) {
  const cx = W / 2 + CAR.lateralOffset * 0.8;
  const cy = H * 0.72;

  const steer = (keys['ArrowLeft'] ? -1 : 0) + (keys['ArrowRight'] ? 1 : 0);

  ctx.save();
  ctx.translate(cx, cy);

  // Gövde gölgesi
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur  = 24;
  ctx.shadowOffsetY = 12;

  // Ana gövde
  const bodyGrad = ctx.createLinearGradient(-50, -22, 50, 22);
  bodyGrad.addColorStop(0,   '#b0120a');
  bodyGrad.addColorStop(0.3, '#e01a10');
  bodyGrad.addColorStop(0.7, '#c01510');
  bodyGrad.addColorStop(1,   '#8a0d08');
  ctx.fillStyle = bodyGrad;

  ctx.beginPath();
  ctx.moveTo(-52, 14);
  ctx.lineTo(-52, 0);
  ctx.lineTo(-38, -18);
  ctx.lineTo(-12, -24);
  ctx.lineTo( 14, -24);
  ctx.lineTo( 36, -16);
  ctx.lineTo( 52, 0);
  ctx.lineTo( 52, 14);
  ctx.closePath();
  ctx.fill();

  // Kaput
  const hoodGrad = ctx.createLinearGradient(-52, -18, 52, -18);
  hoodGrad.addColorStop(0,   '#c0140c');
  hoodGrad.addColorStop(0.5, '#ff2010');
  hoodGrad.addColorStop(1,   '#a01008');
  ctx.fillStyle = hoodGrad;
  ctx.beginPath();
  ctx.moveTo(-52, 0);
  ctx.lineTo(-38, -18);
  ctx.lineTo(-12, -24);
  ctx.lineTo( 14, -24);
  ctx.lineTo( 36, -16);
  ctx.lineTo( 52, 0);
  ctx.closePath();
  ctx.fill();

  // Ön ızgara
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.moveTo(36, -8);
  ctx.lineTo(52, 0);
  ctx.lineTo(52, 8);
  ctx.lineTo(36, 4);
  ctx.closePath();
  ctx.fill();

  // Ön farlar
  ctx.shadowColor = '#ffee88';
  ctx.shadowBlur  = 18;
  ctx.fillStyle = '#ffffcc';
  ctx.beginPath(); ctx.ellipse(50, -3, 6, 4, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(50,  5, 6, 4, -0.1, 0, Math.PI * 2); ctx.fill();

  // Far huzmesi
  if (CAR.speed > 0.5) {
    const beamGrad = ctx.createRadialGradient(52, 0, 0, 52, 0, 90);
    beamGrad.addColorStop(0,   'rgba(255,255,180,0.18)');
    beamGrad.addColorStop(1,   'rgba(255,255,180,0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(52, -4);
    ctx.lineTo(140, -40 + steer * 20);
    ctx.lineTo(140,  40 + steer * 20);
    ctx.lineTo(52,  4);
    ctx.closePath();
    ctx.fill();
  }

  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';

  // Ön cam
  const windshieldGrad = ctx.createLinearGradient(-12, -24, 14, -24);
  windshieldGrad.addColorStop(0, 'rgba(120,200,255,0.5)');
  windshieldGrad.addColorStop(1, 'rgba(60,130,200,0.3)');
  ctx.fillStyle = windshieldGrad;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-10, -14);
  ctx.lineTo(-12, -24);
  ctx.lineTo( 14, -24);
  ctx.lineTo( 16, -14);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Çatı
  const roofGrad = ctx.createLinearGradient(-10, -28, 10, -14);
  roofGrad.addColorStop(0, '#cc1810');
  roofGrad.addColorStop(1, '#8a0d08');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(-10, -14);
  ctx.lineTo(-8,  -28);
  ctx.lineTo( 8,  -28);
  ctx.lineTo( 16, -14);
  ctx.closePath();
  ctx.fill();

  // Arka stop lambalar
  ctx.shadowColor = CAR.braking ? '#ff2200' : '#880000';
  ctx.shadowBlur  = CAR.braking ? 20 : 8;
  ctx.fillStyle   = CAR.braking ? '#ff4400' : '#cc2200';
  ctx.beginPath(); ctx.ellipse(-51, -4, 5, 3,  0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-51,  4, 5, 3, -0.15, 0, Math.PI * 2); ctx.fill();

  ctx.shadowBlur = 0;

  // Ön tekerlekler (yönlü)
  drawWheel(ctx, 38,  18, steer * 0.35);
  drawWheel(ctx, 38, -18, steer * 0.35);
  // Arka tekerlekler
  drawWheel(ctx, -36,  18, 0);
  drawWheel(ctx, -36, -18, 0);

  ctx.restore();
}

function drawWheel(c, x, y, steer) {
  c.save();
  c.translate(x, y);
  c.rotate(steer);

  // Dış lastik
  c.fillStyle = '#1a1a1a';
  c.strokeStyle = '#333';
  c.lineWidth = 1;
  c.beginPath();
  c.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
  c.fill(); c.stroke();

  // Jant
  c.fillStyle = '#888';
  c.beginPath();
  c.ellipse(0, 0, 5, 3.5, 0, 0, Math.PI * 2);
  c.fill();

  // Jant kolları
  c.strokeStyle = '#aaa';
  c.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a) * 4.5, Math.sin(a) * 3.5 * 0.7);
    c.stroke();
  }

  c.restore();
}

// ── Ana Döngü ───────────────────────────────────
updateGearUI();

function loop(ts) {
  update(ts);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(ts => { lastTime = ts; loop(ts); });
