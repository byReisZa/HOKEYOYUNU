// ============================================================
//  TURBO RUSH - Hill Climb Racing Style Game
//  game.js
// ============================================================

// ===== SAVE SYSTEM =====
function save() {
  localStorage.setItem('turboRush', JSON.stringify({
    gold: player.gold,
    ownedCars: player.ownedCars,
    ownedMaps: player.ownedMaps,
    selectedCar: player.selectedCar,
    selectedMap: player.selectedMap,
  }));
}
function load() {
  const d = localStorage.getItem('turboRush');
  if (d) {
    const s = JSON.parse(d);
    player.gold = s.gold || 0;
    player.ownedCars = s.ownedCars || ['jeep'];
    player.ownedMaps = s.ownedMaps || ['hills'];
    player.selectedCar = s.selectedCar || 'jeep';
    player.selectedMap = s.selectedMap || 'hills';
  }
}

// ===== PLAYER DATA =====
const player = {
  gold: 0,
  ownedCars: ['jeep'],
  ownedMaps: ['hills'],
  selectedCar: 'jeep',
  selectedMap: 'hills',
};

// ===== CAR DEFINITIONS =====
const CARS = [
  {
    id: 'jeep', name: 'JEEP', price: 0, emoji: '🚙',
    color: '#4CAF50', bodyH: 32, bodyW: 80,
    maxGears: 4, torque: 1.0, topSpeed: 280, mass: 1.2,
    fuelCap: 100, fuelRate: 0.04,
    description: 'Başlangıç aracı',
  },
  {
    id: 'buggy', name: 'BUGGY', price: 500, emoji: '🏎️',
    color: '#FF6600', bodyH: 24, bodyW: 72,
    maxGears: 5, torque: 1.4, topSpeed: 350, mass: 0.9,
    fuelCap: 80, fuelRate: 0.055,
    description: 'Hızlı ve hafif',
  },
  {
    id: 'monster', name: 'MONSTER', price: 1200, emoji: '🚛',
    color: '#FF0044', bodyH: 40, bodyW: 90,
    maxGears: 6, torque: 1.9, topSpeed: 300, mass: 1.8,
    fuelCap: 150, fuelRate: 0.07,
    description: 'Dev lastikler, dev güç',
  },
  {
    id: 'formula', name: 'FORMULA', price: 2500, emoji: '🏁',
    color: '#00AAFF', bodyH: 20, bodyW: 95,
    maxGears: 7, torque: 1.6, topSpeed: 500, mass: 0.7,
    fuelCap: 60, fuelRate: 0.09,
    description: 'Pist canavarı',
  },
  {
    id: 'tank', name: 'TANK', price: 3500, emoji: '🪖',
    color: '#556B2F', bodyH: 44, bodyW: 100,
    maxGears: 4, torque: 2.5, topSpeed: 220, mass: 2.5,
    fuelCap: 200, fuelRate: 0.05,
    description: 'Hiçbir tepe durduramaz',
  },
  {
    id: 'rocket', name: 'ROCKET', price: 6000, emoji: '🚀',
    color: '#FF00FF', bodyH: 22, bodyW: 88,
    maxGears: 8, torque: 2.0, topSpeed: 600, mass: 0.8,
    fuelCap: 70, fuelRate: 0.12,
    description: 'Uzay teknolojisi',
  },
];

// ===== MAP DEFINITIONS =====
const MAPS = [
  {
    id: 'hills', name: 'YEŞİL TEPELER', price: 0,
    bg: ['#1a3a1a','#0d2a0d'], groundColor: '#2d5a1b', skyTop: '#1a3a4a', skyBot: '#0d1a0d',
    sunColor: '#FFEE88', clouds: true, trees: true,
    difficulty: 1, emoji: '🌿',
    terrainSeed: 1,
  },
  {
    id: 'desert', name: 'ÇÖLLER', price: 800,
    bg: ['#3a2200','#1a1000'], groundColor: '#c8a048', skyTop: '#ff8800', skyBot: '#ff4400',
    sunColor: '#FFFF00', clouds: false, trees: false,
    difficulty: 2, emoji: '🏜️',
    terrainSeed: 2,
  },
  {
    id: 'snow', name: 'KARLI DAĞLAR', price: 1500,
    bg: ['#1a2a3a','#0a0a1a'], groundColor: '#ddeeff', skyTop: '#7aaabb', skyBot: '#2255aa',
    sunColor: '#FFFFFF', clouds: true, trees: false,
    difficulty: 3, emoji: '❄️',
    terrainSeed: 3,
  },
  {
    id: 'volcano', name: 'VOLKAN', price: 3000,
    bg: ['#1a0500','#0a0000'], groundColor: '#2a1a0a', skyTop: '#330000', skyBot: '#110000',
    sunColor: '#FF4400', clouds: false, trees: false,
    difficulty: 4, emoji: '🌋',
    terrainSeed: 4,
  },
  {
    id: 'moon', name: 'AY', price: 5000,
    bg: ['#000010','#000020'], groundColor: '#aaaacc', skyTop: '#000010', skyBot: '#000030',
    sunColor: '#AAAAFF', clouds: false, trees: false,
    difficulty: 5, emoji: '🌙',
    terrainSeed: 5,
  },
];

// ===== GAME STATE =====
let canvas, ctx;
let gameState = 'menu';
let paused = false;
let animId;

let carDef, mapDef;
let terrain = [];
let coins = [];
let particles = [];
let milestones = [100, 250, 500, 1000, 2000, 3500, 5000];
let passedMilestones = new Set();

// Car physics
let car = {
  x: 200, y: 300,
  vx: 0, vy: 0,
  angle: 0, angularVel: 0,
  gear: 1, maxGear: 4,
  rpm: 0, rpmTarget: 0,
  throttle: 0, braking: false,
  clutch: false,
  fuel: 100, maxFuel: 100,
  wheelAngle: 0,
  dead: false,
  onGround: false,
  sessionGold: 0, sessionDist: 0,
  wheelFrontY: 0, wheelBackY: 0,
  wheelFrontX: 0, wheelBackX: 0,
};

// Terrain generation
const TILE_W = 160;
const TERRAIN_AHEAD = 30;
let generatedTiles = 0;
let cameraX = 0;

// Keys
let keys = { gas: false, brake: false, clutch: false };

// Gear ratios
const GEAR_RATIOS = [0, 3.5, 2.2, 1.5, 1.1, 0.85, 0.7, 0.6, 0.5];

// Milestone popup timer
let milestoneTimer = 0;

// ===== TERRAIN GENERATION =====
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateTerrain(map) {
  terrain = [];
  let y = 400;
  let seed = map.terrainSeed * 1000;
  for (let i = 0; i < TERRAIN_AHEAD; i++) {
    seed++;
    let dy = (seededRandom(seed) - 0.45) * 120 * map.difficulty;
    dy = Math.max(-90, Math.min(90, dy));
    y = Math.max(200, Math.min(520, y + dy));
    terrain.push({ x: i * TILE_W, y });
  }
  generatedTiles = TERRAIN_AHEAD;
}

function extendTerrain() {
  const lastTile = terrain[terrain.length - 1];
  let y = lastTile.y;
  for (let i = 0; i < 8; i++) {
    generatedTiles++;
    let seed = mapDef.terrainSeed * 1000 + generatedTiles;
    let dy = (seededRandom(seed) - 0.45) * 120 * mapDef.difficulty;
    dy = Math.max(-80, Math.min(80, dy));
    y = Math.max(200, Math.min(520, y + dy));
    terrain.push({ x: generatedTiles * TILE_W, y });
  }
}

// Interpolate terrain y at given x
function getTerrainY(x) {
  const tileIdx = x / TILE_W;
  const i = Math.floor(tileIdx);
  const t = tileIdx - i;
  if (i < 0) return terrain[0] ? terrain[0].y : 400;
  if (i >= terrain.length - 1) return terrain[terrain.length - 1] ? terrain[terrain.length - 1].y : 400;
  const y0 = terrain[i].y;
  const y1 = terrain[i + 1].y;
  // Smooth cubic interpolation
  const tc = t * t * (3 - 2 * t);
  return y0 + (y1 - y0) * tc;
}

function getTerrainAngle(x) {
  const dx = 4;
  const y0 = getTerrainY(x - dx);
  const y1 = getTerrainY(x + dx);
  return Math.atan2(y1 - y0, dx * 2);
}

// ===== COIN GENERATION =====
function generateCoinsForSection(startX, endX) {
  for (let x = startX; x < endX; x += 120 + Math.random() * 100) {
    const ty = getTerrainY(x);
    if (Math.random() < 0.55) {
      coins.push({ x, y: ty - 40, collected: false, bobOffset: Math.random() * Math.PI * 2 });
    }
  }
}

// ===== PARTICLES =====
function spawnCoinParticle(x, y) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x, y, vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 6 - 2,
      life: 1, maxLife: 1,
      color: '#FFD700', size: 4 + Math.random() * 4,
    });
  }
}
function spawnExhaustParticle(x, y) {
  if (Math.random() > 0.4) return;
  particles.push({
    x, y, vx: -1.5 - Math.random(),
    vy: (Math.random() - 0.5) * 1.5,
    life: 0.8, maxLife: 0.8,
    color: '#888888', size: 6 + Math.random() * 6,
  });
}
function spawnDustParticle(x, y) {
  if (Math.random() > 0.3) return;
  particles.push({
    x, y, vx: (Math.random() - 0.7) * 3,
    vy: -(Math.random() * 2 + 0.5),
    life: 0.5, maxLife: 0.5,
    color: '#AAAAAA', size: 3 + Math.random() * 5,
  });
}

// ===== PHYSICS UPDATE =====
const GRAVITY = 0.5;
const WHEEL_RADIUS = 18;
const CAR_HALF_W = 36;

function updatePhysics(dt) {
  if (car.dead || paused) return;

  const carDef_ = carDef;
  const maxGear = carDef_.maxGears;

  // Fuel
  if (keys.gas) {
    car.fuel -= carDef_.fuelRate * (car.gear * 0.3 + 0.5) * dt * 60;
    car.fuel = Math.max(0, car.fuel);
  }
  car.throttle = (keys.gas && car.fuel > 0) ? 1 : 0;

  // RPM
  const gearRatio = GEAR_RATIOS[car.gear] || 1;
  if (!car.clutch) {
    const speedRpm = Math.abs(car.vx) * gearRatio * 40;
    car.rpmTarget = car.throttle > 0 ? Math.min(7000, speedRpm + car.throttle * 3000) : Math.max(800, speedRpm);
  } else {
    car.rpmTarget = car.throttle > 0 ? 3500 + Math.random() * 500 : 800;
  }
  car.rpm += (car.rpmTarget - car.rpm) * 0.12;

  // Drive force
  let driveForce = 0;
  if (!car.clutch && car.throttle > 0) {
    const rpmFactor = Math.max(0, Math.min(1, (car.rpm - 800) / 5000));
    driveForce = carDef_.torque * rpmFactor * 0.35 / gearRatio;
  }

  // Brake force
  if (keys.brake) {
    car.vx *= 0.92;
    car.angularVel *= 0.85;
  }

  // Gravity
  car.vy += GRAVITY * dt * 60;

  // Wheel positions
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  const wfx = car.x + cos * CAR_HALF_W;
  const wfy = car.y + sin * CAR_HALF_W;
  const wbx = car.x - cos * CAR_HALF_W;
  const wby = car.y - sin * CAR_HALF_W;

  const groundFront = getTerrainY(wfx + cameraX);
  const groundBack = getTerrainY(wbx + cameraX);

  const frontOnGround = wfy + WHEEL_RADIUS >= groundFront;
  const backOnGround = wby + WHEEL_RADIUS >= groundBack;
  car.onGround = frontOnGround || backOnGround;

  // Front wheel
  if (frontOnGround) {
    const overlap = (wfy + WHEEL_RADIUS) - groundFront;
    car.y -= sin * overlap * 0.5;
    car.vy -= overlap * 0.6 * dt * 60;
    if (car.vy > 0) car.vy *= 0.4;
    spawnDustParticle(wfx - cameraX + car.x - car.x, wfy);
  }
  // Back wheel
  if (backOnGround) {
    const overlap = (wby + WHEEL_RADIUS) - groundBack;
    car.y -= sin * overlap * 0.5;
    car.vy -= overlap * 0.6 * dt * 60;
    if (car.vy > 0) car.vy *= 0.4;

    // Drive on back wheel
    if (driveForce > 0) {
      const terrAngle = getTerrainAngle(wbx + cameraX);
      car.vx += Math.cos(terrAngle) * driveForce * dt * 60;
      car.vy += Math.sin(terrAngle) * driveForce * dt * 60 * 0.3;
    }
  }

  // Air resistance & max speed
  const maxSpeedMs = carDef_.topSpeed / 12;
  if (Math.abs(car.vx) > maxSpeedMs) car.vx *= 0.98;
  car.vx *= car.onGround ? 0.97 : 0.995;

  // Angular stabilization
  if (car.onGround) {
    const targetAngle = getTerrainAngle(car.x + cameraX);
    const angleDiff = targetAngle - car.angle;
    car.angle += angleDiff * 0.15;
    car.angularVel *= 0.6;
  } else {
    // In air, slight stabilization
    car.angle += car.angularVel * dt * 60;
    car.angularVel += (0 - car.angle) * 0.005;
    car.angularVel *= 0.97;
  }

  // Move car
  car.x += car.vx * dt * 60;
  car.y += car.vy * dt * 60;

  // Camera follows
  const targetCamX = car.x - canvas.width * 0.35;
  if (targetCamX > cameraX) {
    cameraX = targetCamX;
    // Extend terrain if needed
    const lastTileX = terrain[terrain.length - 1].x;
    if (cameraX + canvas.width > lastTileX - TILE_W * 4) extendTerrain();
    // Generate coins
    generateCoinsForSection(lastTileX + cameraX - 200, lastTileX + cameraX + canvas.width);
  }

  // Wheel spin animation
  car.wheelAngle += car.vx * 0.15;

  // Exhaust
  const exhaustX = car.x - cos * 42 - cameraX;
  const exhaustY = car.y - sin * 42 + 10;
  spawnExhaustParticle(exhaustX, exhaustY);

  // Distance & gold
  const dist = Math.max(0, cameraX / 80);
  car.sessionDist = Math.round(dist);

  // Milestone check
  checkMilestones(car.sessionDist);

  // Death check (flip over or fall)
  if (Math.abs(car.angle) > Math.PI * 0.6 || car.y > canvas.height + 200) {
    killCar();
  }

  // Coin collection
  const carWorldX = car.x + cameraX;
  for (const coin of coins) {
    if (coin.collected) continue;
    const dx = coin.x - carWorldX;
    const dy = coin.y - car.y;
    if (Math.abs(dx) < 35 && Math.abs(dy) < 35) {
      coin.collected = true;
      const earned = 1;
      car.sessionGold += earned;
      player.gold += earned;
      spawnCoinParticle(coin.x - cameraX, coin.y);
      updateHUDGold();
    }
  }

  // Update particles
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.15; p.vx *= 0.95;
    p.life -= 0.03;
  }
  particles = particles.filter(p => p.life > 0);

  // Update HUD
  document.getElementById('distanceDisplay').textContent = car.sessionDist + ' m';
  const speedKmh = Math.round(Math.abs(car.vx) * 30);
  document.getElementById('speedDisplay').textContent = speedKmh + ' km/h';
  document.getElementById('gearDisplay').textContent = car.clutch ? 'N' : car.gear;
  document.getElementById('rpmFill').style.width = Math.min(100, car.rpm / 70) + '%';
  document.getElementById('fuelFill').style.width = (car.fuel / car.maxFuel * 100) + '%';
}

function checkMilestones(dist) {
  for (const m of milestones) {
    if (dist >= m && !passedMilestones.has(m)) {
      passedMilestones.add(m);
      const reward = Math.round(m * 0.3);
      player.gold += reward;
      car.sessionGold += reward;
      save();
      updateHUDGold();
      showMilestonePopup(m, reward);
    }
  }
}

function showMilestonePopup(meters, gold) {
  const popup = document.getElementById('milestonePopup');
  document.getElementById('milestoneText').textContent = meters + ' METRE!';
  document.getElementById('milestoneReward').textContent = '+' + gold + ' 🪙';
  popup.classList.remove('hidden');
  milestoneTimer = 180;
}

function updateHUDGold() {
  document.getElementById('hudGold').textContent = player.gold;
  document.getElementById('menuGoldCount').textContent = player.gold;
  document.getElementById('garageGold').textContent = player.gold;
  document.getElementById('mapGold').textContent = player.gold;
}

function killCar() {
  car.dead = true;
  save();
  setTimeout(() => {
    document.getElementById('finalDistance').textContent = car.sessionDist + ' m';
    document.getElementById('finalGold').textContent = car.sessionGold;
    document.getElementById('gameOver').classList.remove('hidden');
  }, 600);
}

// ===== DRAWING =====
function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.75);
  skyGrad.addColorStop(0, mapDef.skyTop);
  skyGrad.addColorStop(1, mapDef.skyBot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Sun/Moon
  ctx.save();
  ctx.shadowBlur = 30; ctx.shadowColor = mapDef.sunColor;
  ctx.fillStyle = mapDef.sunColor;
  ctx.beginPath(); ctx.arc(W * 0.8, 80, 28, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Clouds
  if (mapDef.clouds) drawClouds(W, H);

  // Trees
  if (mapDef.trees) drawTrees(W, H);

  // Terrain
  drawTerrain(W, H);

  // Coins
  drawCoins(W, H);

  // Particles
  drawParticles();

  // Car
  if (!car.dead) drawCar(W, H);

  // Milestone popup timer
  if (milestoneTimer > 0) {
    milestoneTimer--;
    if (milestoneTimer <= 0) {
      document.getElementById('milestonePopup').classList.add('hidden');
    }
  }
}

function drawClouds(W, H) {
  const cloudX = (cameraX * 0.2) % (W * 2);
  ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.globalAlpha = 0.5;
  const clouds = [[100, 80, 60, 25], [280, 55, 80, 20], [500, 90, 55, 22],
                   [W + 80, 70, 70, 20], [W + 350, 50, 65, 24]];
  for (const [cx, cy, rw, rh] of clouds) {
    const bx = ((cx - cloudX % W + W) % (W * 1.5));
    ctx.beginPath(); ctx.ellipse(bx, cy, rw, rh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx + 30, cy - 8, rw * 0.6, rh * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawTrees(W, H) {
  ctx.save();
  const treePositions = [];
  for (let i = 0; i < 12; i++) {
    const worldX = Math.floor((cameraX + i * 180) / 180) * 180 + (i * 37 % 120);
    treePositions.push(worldX - cameraX);
  }
  for (const tx of treePositions) {
    if (tx < -50 || tx > W + 50) continue;
    const worldX = tx + cameraX;
    const ty = getTerrainY(worldX);
    const h = 50 + (worldX % 30);
    ctx.fillStyle = '#1a3a0a';
    ctx.fillRect(tx - 5, ty - h - 8, 10, h);
    ctx.fillStyle = '#2a5a15';
    ctx.beginPath(); ctx.moveTo(tx, ty - h - 30); ctx.lineTo(tx - 22, ty - h + 5); ctx.lineTo(tx + 22, ty - h + 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx, ty - h - 50); ctx.lineTo(tx - 16, ty - h - 18); ctx.lineTo(tx + 16, ty - h - 18); ctx.fill();
  }
  ctx.restore();
}

function drawTerrain(W, H) {
  // Ground fill
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let sx = 0; sx <= W; sx += 4) {
    const worldX = sx + cameraX;
    const ty = getTerrainY(worldX);
    ctx.lineTo(sx, ty);
  }
  ctx.lineTo(W, H);
  ctx.closePath();

  const groundGrad = ctx.createLinearGradient(0, 200, 0, H);
  groundGrad.addColorStop(0, mapDef.groundColor);
  groundGrad.addColorStop(0.2, adjustColor(mapDef.groundColor, -30));
  groundGrad.addColorStop(1, adjustColor(mapDef.groundColor, -60));
  ctx.fillStyle = groundGrad;
  ctx.fill();

  // Ground surface line
  ctx.beginPath();
  ctx.moveTo(0, getTerrainY(cameraX));
  for (let sx = 0; sx <= W; sx += 4) {
    ctx.lineTo(sx, getTerrainY(sx + cameraX));
  }
  ctx.strokeStyle = adjustColor(mapDef.groundColor, 40);
  ctx.lineWidth = 3; ctx.stroke();

  // Rocks
  for (let i = 0; i < 8; i++) {
    const worldX = Math.floor((cameraX + i * 200) / 200) * 200 + (i * 53 % 150);
    const sx = worldX - cameraX;
    if (sx < -30 || sx > W + 30) continue;
    const ty = getTerrainY(worldX);
    ctx.fillStyle = '#666677';
    ctx.beginPath(); ctx.ellipse(sx, ty - 5, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCoins(W, H) {
  const t = Date.now() / 1000;
  for (const coin of coins) {
    if (coin.collected) continue;
    const sx = coin.x - cameraX;
    if (sx < -20 || sx > W + 20) continue;
    const sy = coin.y + Math.sin(t * 3 + coin.bobOffset) * 5;

    ctx.save();
    ctx.translate(sx, sy);

    // Glow
    ctx.shadowBlur = 15; ctx.shadowColor = '#FFD700';

    // Coin body
    const coinGrad = ctx.createRadialGradient(-4, -4, 1, 0, 0, 11);
    coinGrad.addColorStop(0, '#FFFAAA');
    coinGrad.addColorStop(0.5, '#FFD700');
    coinGrad.addColorStop(1, '#B8860B');
    ctx.fillStyle = coinGrad;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#B8860B';
    ctx.font = 'bold 10px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText('₺', 0, 0);
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCar(W, H) {
  const sx = car.x;
  const sy = car.y;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle);

  const cdef = carDef;
  const bw = cdef.bodyW, bh = cdef.bodyH;

  // Shadow
  ctx.save();
  ctx.rotate(-car.angle);
  ctx.translate(0, 20);
  const shadowGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 50);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(-50, -10, 100, 20);
  ctx.restore();

  // Suspension springs
  drawWheel(-CAR_HALF_W, bh / 2 + 8, true);
  drawWheel(CAR_HALF_W, bh / 2 + 8, false);

  // Car body
  drawCarBody(cdef);

  ctx.restore();
}

function drawWheel(ox, oy, isBack) {
  const r = WHEEL_RADIUS;
  ctx.save();
  ctx.translate(ox, oy);

  // Spring
  ctx.strokeStyle = 'rgba(150,150,150,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const yy = -16 + i * 4;
    ctx.lineTo(i % 2 === 0 ? 3 : -3, yy);
  }
  ctx.stroke();

  // Tire
  ctx.rotate(car.wheelAngle);
  const tireGrad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
  tireGrad.addColorStop(0, '#444');
  tireGrad.addColorStop(1, '#111');
  ctx.fillStyle = tireGrad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
  ctx.stroke();

  // Tread marks
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
    ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
    ctx.stroke();
  }

  // Hub
  ctx.fillStyle = '#888';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#aaa';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();

  // Lug nuts
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    ctx.fillStyle = '#bbb';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawCarBody(cdef) {
  const bw = cdef.bodyW, bh = cdef.bodyH;
  const color = cdef.color;

  // Chassis
  ctx.save();
  const bodyGrad = ctx.createLinearGradient(0, -bh, 0, bh / 2);
  bodyGrad.addColorStop(0, lightenColor(color, 40));
  bodyGrad.addColorStop(0.5, color);
  bodyGrad.addColorStop(1, darkenColor(color, 40));
  ctx.fillStyle = bodyGrad;
  ctx.shadowBlur = 8; ctx.shadowColor = color + '88';

  // Main body shape
  if (cdef.id === 'formula') {
    // Low, aerodynamic
    ctx.beginPath();
    ctx.moveTo(-bw / 2, bh / 2);
    ctx.lineTo(bw / 2 + 10, bh / 2);
    ctx.lineTo(bw / 2 + 15, 0);
    ctx.lineTo(bw / 3, -bh);
    ctx.lineTo(-bw / 3, -bh);
    ctx.lineTo(-bw / 2, 0);
    ctx.closePath(); ctx.fill();
    // Wings
    ctx.fillStyle = darkenColor(color, 20);
    ctx.fillRect(-bw / 2 - 20, -5, 20, 5);
    ctx.fillRect(bw / 2 + 10, -5, 20, 5);
  } else if (cdef.id === 'monster' || cdef.id === 'tank') {
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh, bw, bh * 1.5, 6);
    ctx.fill();
    // Cab
    ctx.fillStyle = lightenColor(color, 20);
    ctx.beginPath(); ctx.roundRect(-bw / 4, -bh * 1.6, bw / 2, bh * 0.8, 4); ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-bw / 2, bh / 2);
    ctx.lineTo(bw / 2, bh / 2);
    ctx.lineTo(bw / 2, -bh * 0.3);
    ctx.lineTo(bw * 0.3, -bh);
    ctx.lineTo(-bw * 0.25, -bh);
    ctx.lineTo(-bw / 2, -bh * 0.3);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // Windows
  ctx.save();
  ctx.fillStyle = 'rgba(150,220,255,0.5)';
  if (cdef.id !== 'formula' && cdef.id !== 'tank') {
    ctx.beginPath();
    ctx.moveTo(-bw * 0.22, -bh * 0.9);
    ctx.lineTo(bw * 0.25, -bh * 0.9);
    ctx.lineTo(bw * 0.32, -bh * 0.35);
    ctx.lineTo(-bw * 0.22, -bh * 0.35);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // Headlights
  ctx.save();
  ctx.fillStyle = '#FFFFAA';
  ctx.shadowBlur = 10; ctx.shadowColor = '#FFFF00';
  ctx.beginPath(); ctx.ellipse(bw / 2 - 4, -bh * 0.1, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Exhaust pipe
  ctx.save();
  ctx.fillStyle = '#555';
  ctx.fillRect(-bw / 2 - 8, bh * 0.2, 10, 5);
  ctx.restore();

  // Rollbar / detail line
  ctx.save();
  ctx.strokeStyle = darkenColor(color, 30);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-bw * 0.1, -bh * 0.4);
  ctx.lineTo(-bw * 0.1, -bh * 0.95);
  ctx.lineTo(bw * 0.28, -bh * 0.95);
  ctx.stroke();
  ctx.restore();
}

function adjustColor(hex, amount) {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
  return `rgb(${r},${g},${b})`;
}
function lightenColor(hex, amount) { return adjustColor(hex, amount); }
function darkenColor(hex, amount) { return adjustColor(hex, -amount); }

// ===== CONTROLS =====
function startGas() { keys.gas = true; }
function stopGas() { keys.gas = false; }
function startBrake() { keys.brake = true; }
function stopBrake() { keys.brake = false; }
function clutchPress() {
  keys.clutch = true; car.clutch = true;
  document.getElementById('clutchBtn').classList.add('pressed');
  document.getElementById('clutchIndicator').classList.add('active');
}
function clutchRelease() {
  keys.clutch = false; car.clutch = false;
  document.getElementById('clutchBtn').classList.remove('pressed');
  document.getElementById('clutchIndicator').classList.remove('active');
}
function gearUp() {
  if (car.gear < carDef.maxGears) car.gear++;
  flashGear();
}
function gearDown() {
  if (car.gear > 1) car.gear--;
  flashGear();
}
function flashGear() {
  const g = document.getElementById('gearDisplay');
  g.style.color = '#FFFFFF';
  setTimeout(() => { g.style.color = ''; }, 300);
}

// Keyboard support
document.addEventListener('keydown', e => {
  if (gameState !== 'game') return;
  if (e.key === 'ArrowRight' || e.key === 'd') startGas();
  if (e.key === 'ArrowLeft' || e.key === 'a') startBrake();
  if (e.key === 'q' || e.key === 'Q') clutchPress();
  if (e.key === 'w' || e.key === 'W') gearUp();
  if (e.key === 's' || e.key === 'S') gearDown();
  if (e.key === 'Escape') togglePause();
});
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowRight' || e.key === 'd') stopGas();
  if (e.key === 'ArrowLeft' || e.key === 'a') stopBrake();
  if (e.key === 'q' || e.key === 'Q') clutchRelease();
});

// ===== GAME LOOP =====
let lastTime = 0;
function gameLoop(ts) {
  const dt = Math.min((ts - lastTime) / 16.67, 3);
  lastTime = ts;
  updatePhysics(dt);
  draw();
  animId = requestAnimationFrame(gameLoop);
}

// ===== SCREEN MANAGEMENT =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  const el = document.getElementById(id);
  el.style.display = 'flex';
  el.classList.add('active');
  gameState = id.replace('Screen', '');
}

function showMenu() { showScreen('menuScreen'); updateHUDGold(); }
function showGarage() { showScreen('garageScreen'); buildGarage(); updateHUDGold(); }
function showMapSelect() { showScreen('mapScreen'); buildMapSelect(); updateHUDGold(); }
function goToMenu() { if (animId) cancelAnimationFrame(animId); showMenu(); }

function startGame() {
  carDef = CARS.find(c => c.id === player.selectedCar) || CARS[0];
  mapDef = MAPS.find(m => m.id === player.selectedMap) || MAPS[0];

  // Reset car state
  car = {
    x: 200, y: 300, vx: 0, vy: 0,
    angle: 0, angularVel: 0,
    gear: 1, maxGear: carDef.maxGears,
    rpm: 800, rpmTarget: 800,
    throttle: 0, braking: false, clutch: false,
    fuel: carDef.fuelCap, maxFuel: carDef.fuelCap,
    wheelAngle: 0, dead: false, onGround: false,
    sessionGold: 0, sessionDist: 0,
  };
  keys = { gas: false, brake: false, clutch: false };
  cameraX = 0;
  coins = [];
  particles = [];
  passedMilestones = new Set();
  milestoneTimer = 0;

  generateTerrain(mapDef);
  generateCoinsForSection(0, 4000);

  // Position car on terrain
  car.y = getTerrainY(car.x + cameraX) - WHEEL_RADIUS - 10;

  showScreen('gameScreen');
  document.getElementById('gameOver').classList.add('hidden');
  document.getElementById('pauseMenu').classList.add('hidden');
  document.getElementById('milestonePopup').classList.add('hidden');
  paused = false;
  gameState = 'game';

  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();

  if (animId) cancelAnimationFrame(animId);
  lastTime = performance.now();
  animId = requestAnimationFrame(gameLoop);
}

function restartGame() { startGame(); }

function togglePause() {
  paused = !paused;
  document.getElementById('pauseMenu').classList.toggle('hidden', !paused);
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

// ===== GARAGE BUILDER =====
function buildGarage() {
  const grid = document.getElementById('garageGrid');
  grid.innerHTML = '';
  for (const c of CARS) {
    const owned = player.ownedCars.includes(c.id);
    const selected = player.selectedCar === c.id;
    const card = document.createElement('div');
    card.className = 'car-card' + (selected ? ' selected' : '') + (!owned && player.gold < c.price ? ' locked' : '');

    // Preview canvas
    const previewCanvas = document.createElement('canvas');
    previewCanvas.className = 'car-canvas-preview';
    previewCanvas.width = 160; previewCanvas.height = 80;
    card.appendChild(previewCanvas);

    const name = document.createElement('div');
    name.className = 'car-name';
    name.textContent = c.name;
    card.appendChild(name);

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:10px;color:#888;margin-bottom:6px;';
    desc.textContent = c.description;
    card.appendChild(desc);

    const btn = document.createElement('button');
    btn.className = 'car-select-btn';
    if (owned) {
      if (selected) { btn.textContent = '✓ SEÇİLİ'; btn.className += ' active'; }
      else { btn.textContent = 'SEÇ'; btn.className += ' select'; btn.onclick = () => selectCar(c.id); }
    } else {
      btn.textContent = '🪙 ' + c.price + ' SATIN AL';
      btn.className += ' buy';
      if (player.gold < c.price) { btn.disabled = true; btn.style.opacity = '0.5'; }
      else { btn.onclick = () => buyCar(c.id, c.price); }
    }
    card.appendChild(btn);

    grid.appendChild(card);

    // Draw car preview
    setTimeout(() => drawCarPreview(previewCanvas, c), 0);
  }
}

function drawCarPreview(canvas, cdef) {
  const ctx2 = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx2.clearRect(0, 0, W, H);
  ctx2.fillStyle = '#0A0A14';
  ctx2.fillRect(0, 0, W, H);
  ctx2.save();
  ctx2.translate(W / 2, H / 2 + 10);
  ctx2.scale(0.85, 0.85);

  // Simple wheels
  ctx2.fillStyle = '#222';
  ctx2.beginPath(); ctx2.arc(-30, 16, 14, 0, Math.PI * 2); ctx2.fill();
  ctx2.beginPath(); ctx2.arc(30, 16, 14, 0, Math.PI * 2); ctx2.fill();
  ctx2.fillStyle = '#555';
  ctx2.beginPath(); ctx2.arc(-30, 16, 6, 0, Math.PI * 2); ctx2.fill();
  ctx2.beginPath(); ctx2.arc(30, 16, 6, 0, Math.PI * 2); ctx2.fill();

  // Body
  const bw = cdef.bodyW * 0.7, bh = cdef.bodyH * 0.7;
  const bodyGrad = ctx2.createLinearGradient(0, -bh, 0, bh / 2);
  bodyGrad.addColorStop(0, lightenColor(cdef.color, 40));
  bodyGrad.addColorStop(1, darkenColor(cdef.color, 20));
  ctx2.fillStyle = bodyGrad;
  ctx2.shadowBlur = 12; ctx2.shadowColor = cdef.color;
  ctx2.beginPath();
  ctx2.moveTo(-bw / 2, bh / 2);
  ctx2.lineTo(bw / 2, bh / 2);
  ctx2.lineTo(bw / 2, -bh * 0.2);
  ctx2.lineTo(bw * 0.3, -bh);
  ctx2.lineTo(-bw * 0.25, -bh);
  ctx2.lineTo(-bw / 2, -bh * 0.2);
  ctx2.closePath(); ctx2.fill();

  // Window
  ctx2.fillStyle = 'rgba(150,220,255,0.5)';
  ctx2.shadowBlur = 0;
  ctx2.beginPath();
  ctx2.moveTo(-bw * 0.2, -bh * 0.8);
  ctx2.lineTo(bw * 0.22, -bh * 0.8);
  ctx2.lineTo(bw * 0.28, -bh * 0.25);
  ctx2.lineTo(-bw * 0.2, -bh * 0.25);
  ctx2.closePath(); ctx2.fill();

  ctx2.restore();
}

function selectCar(id) {
  player.selectedCar = id;
  save(); buildGarage();
}

function buyCar(id, price) {
  if (player.gold < price) return;
  player.gold -= price;
  player.ownedCars.push(id);
  player.selectedCar = id;
  save(); updateHUDGold(); buildGarage();
}

// ===== MAP BUILDER =====
function buildMapSelect() {
  const grid = document.getElementById('mapGrid');
  grid.innerHTML = '';
  for (const m of MAPS) {
    const owned = player.ownedMaps.includes(m.id);
    const selected = player.selectedMap === m.id;
    const card = document.createElement('div');
    card.className = 'map-card' + (selected ? ' selected' : '') + (!owned && player.gold < m.price ? ' locked' : '');

    const preview = document.createElement('div');
    preview.className = 'map-preview';
    const previewCanvas = document.createElement('canvas');
    previewCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    previewCanvas.width = 200; previewCanvas.height = 100;
    drawMapPreview(previewCanvas, m);
    preview.style.position = 'relative'; preview.style.overflow = 'hidden';
    preview.appendChild(previewCanvas);
    const emojiSpan = document.createElement('span');
    emojiSpan.style.cssText = 'position:relative;z-index:2;font-size:36px;';
    emojiSpan.textContent = m.emoji;
    preview.appendChild(emojiSpan);
    card.appendChild(preview);

    const info = document.createElement('div');
    info.className = 'map-info';
    info.innerHTML = `<div class="map-name">${m.name}</div>`;

    if (owned) {
      if (selected) {
        info.innerHTML += `<div class="map-owned">✓ SEÇİLİ</div>`;
      } else {
        info.innerHTML += `<button class="car-select-btn select" style="width:100%;margin-top:6px;">SEÇ</button>`;
        card.onclick = () => { player.selectedMap = m.id; save(); buildMapSelect(); };
      }
    } else {
      info.innerHTML += `<div class="map-price">🪙 ${m.price}</div>`;
      if (player.gold >= m.price) {
        const buyBtn = document.createElement('button');
        buyBtn.className = 'car-select-btn buy';
        buyBtn.style.cssText = 'width:100%;margin-top:6px;';
        buyBtn.textContent = 'SATIN AL';
        buyBtn.onclick = e => { e.stopPropagation(); buyMap(m.id, m.price); };
        info.appendChild(buyBtn);
      } else {
        info.innerHTML += `<div style="font-size:11px;color:#555;margin-top:4px;">Yetersiz altın</div>`;
      }
    }

    const diffStr = '⭐'.repeat(m.difficulty);
    info.innerHTML += `<div style="font-size:11px;color:#888;margin-top:4px;">Zorluk: ${diffStr}</div>`;
    card.appendChild(info);
    grid.appendChild(card);
  }
}

function drawMapPreview(canvas, mapDef) {
  const ctx2 = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const skyG = ctx2.createLinearGradient(0, 0, 0, H);
  skyG.addColorStop(0, mapDef.skyTop); skyG.addColorStop(1, mapDef.skyBot);
  ctx2.fillStyle = skyG; ctx2.fillRect(0, 0, W, H);

  // Simple terrain preview
  ctx2.beginPath();
  ctx2.moveTo(0, H);
  const pts = [H * 0.6, H * 0.5, H * 0.65, H * 0.45, H * 0.7, H * 0.55, H * 0.4, H * 0.6];
  for (let i = 0; i < pts.length; i++) {
    ctx2.lineTo(i * W / (pts.length - 1), pts[i]);
  }
  ctx2.lineTo(W, H); ctx2.closePath();
  ctx2.fillStyle = mapDef.groundColor; ctx2.fill();
}

function buyMap(id, price) {
  if (player.gold < price) return;
  player.gold -= price;
  player.ownedMaps.push(id);
  player.selectedMap = id;
  save(); updateHUDGold(); buildMapSelect();
}

// ===== INIT =====
load();
updateHUDGold();
showMenu();
