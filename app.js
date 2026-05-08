// ─── STATE ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'neonhockey_save';
const XP_TO_TL = 0.10;
const WIN_SCORE = 3;

let state = { xp: 0, tl: 0 };

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s) state = s;
  } catch (e) {}
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── SCREENS ─────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── MENU ─────────────────────────────────────────────────────────────────────
function updateMenuUI() {
  document.getElementById('menu-xp').textContent = state.xp;
  document.getElementById('menu-tl').textContent = state.tl.toFixed(2) + ' ₺';
}

document.getElementById('btn-play').onclick = () => {
  showScreen('screen-game');
  startGame();
};

document.getElementById('btn-convert').onclick = () => {
  updateConvertUI();
  showScreen('screen-convert');
};

document.getElementById('btn-back-convert').onclick = () => {
  showScreen('screen-menu');
  updateMenuUI();
};

// ─── CONVERT ──────────────────────────────────────────────────────────────────
function updateConvertUI() {
  document.getElementById('conv-xp').textContent = state.xp;
  document.getElementById('conv-val').textContent = (state.xp * XP_TO_TL).toFixed(2) + ' ₺';
  document.getElementById('conv-input').value = '';
  document.getElementById('conv-msg').textContent = '';
}

document.getElementById('conv-input').oninput = () => {
  const val = parseInt(document.getElementById('conv-input').value) || 0;
  document.getElementById('conv-val').textContent = (Math.min(val, state.xp) * XP_TO_TL).toFixed(2) + ' ₺';
};

document.getElementById('btn-do-convert').onclick = () => {
  const msg = document.getElementById('conv-msg');
  const amt = parseInt(document.getElementById('conv-input').value);
  if (!amt || amt <= 0) { msg.className = 'conv-msg error'; msg.textContent = 'Geçerli bir miktar gir!'; return; }
  if (amt > state.xp) { msg.className = 'conv-msg error'; msg.textContent = 'Yeterli tecrüben yok!'; return; }
  state.xp -= amt;
  state.tl += amt * XP_TO_TL;
  saveState();
  updateConvertUI();
  msg.className = 'conv-msg success';
  msg.textContent = `✔ ${amt} Tecrübe → ${(amt * XP_TO_TL).toFixed(2)} ₺ eklendi!`;
};

// ─── RESULT ───────────────────────────────────────────────────────────────────
document.getElementById('btn-rematch').onclick = () => {
  showScreen('screen-game');
  startGame();
};
document.getElementById('btn-menu').onclick = () => {
  showScreen('screen-menu');
  updateMenuUI();
};

function showResult(playerWon, ps, bs) {
  const title = document.getElementById('result-title');
  const glow = document.getElementById('result-glow');
  const xpMsg = document.getElementById('result-xp-msg');

  if (playerWon) {
    title.textContent = 'KAZANDIN!';
    title.className = 'win';
    glow.className = 'result-glow win';
    state.xp += 1;
    saveState();
    xpMsg.textContent = '+1 Tecrübe Kazandın 🏆';
    xpMsg.style.color = '#00ff88';
  } else {
    title.textContent = 'KAYBETTİN!';
    title.className = 'lose';
    glow.className = 'result-glow lose';
    xpMsg.textContent = 'Tekrar dene! Tecrübe yok.';
    xpMsg.style.color = '#ff00aa';
  }
  document.getElementById('rs-player').textContent = ps;
  document.getElementById('rs-bot').textContent = bs;
  showScreen('screen-result');
}

// ─── GAME ─────────────────────────────────────────────────────────────────────
let animId = null;
let playerScore = 0, botScore = 0;
let gameRunning = false;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game objects
let W, H;
const PADDLE_W_RATIO = 0.22;
const PADDLE_H = 14;
const BALL_R = 10;
const GOAL_W_RATIO = 0.35;

let player = { x: 0, y: 0, w: 0, h: PADDLE_H, vx: 0, vy: 0, targetX: 0 };
let bot    = { x: 0, y: 0, w: 0, h: PADDLE_H, vx: 0, vy: 0 };
let ball   = { x: 0, y: 0, vx: 0, vy: 0, r: BALL_R };

let goalFlash = null; // { who, timer }
let particles = [];

function resizeCanvas() {
  const bar = document.querySelector('.score-bar');
  const hint = document.getElementById('ctrl-hint');
  const barH = bar ? bar.offsetHeight : 50;
  const hintH = hint ? hint.offsetHeight : 24;
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = W;
  canvas.height = H;
  player.w = W * PADDLE_W_RATIO;
  bot.w = W * PADDLE_W_RATIO;
}

function resetBall(towardPlayer = true) {
  ball.x = W / 2;
  ball.y = H / 2;
  const speed = Math.min(W, H) * 0.012;
  const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
  ball.vx = speed * Math.sin(angle) * (Math.random() > 0.5 ? 1 : -1);
  ball.vy = speed * (towardPlayer ? 1 : -1);
}

function resetPositions() {
  player.x = W / 2 - player.w / 2;
  player.y = H - 60;
  player.targetX = player.x;
  bot.x = W / 2 - bot.w / 2;
  bot.y = 46;
}

function startGame() {
  if (animId) cancelAnimationFrame(animId);
  particles = [];
  goalFlash = null;
  playerScore = 0;
  botScore = 0;
  document.getElementById('score-player').textContent = '0';
  document.getElementById('score-bot').textContent = '0';
  gameRunning = true;
  resizeCanvas();
  resetPositions();
  resetBall(true);
  loop();
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
let inputX = null;

function handleMove(clientX) {
  if (!gameRunning) return;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  player.targetX = Math.max(0, Math.min(W - player.w, x - player.w / 2));
}

canvas.addEventListener('mousemove', e => handleMove(e.clientX));
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  handleMove(e.touches[0].clientX);
}, { passive: false });
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  handleMove(e.touches[0].clientX);
}, { passive: false });

// ─── BOT AI ───────────────────────────────────────────────────────────────────
function updateBot() {
  // Predict where ball will be when it reaches bot Y
  let bx = ball.x, by = ball.y, bvx = ball.vx, bvy = ball.vy;

  if (bvy < 0) {
    // Simulate ball path
    let steps = 0;
    while (by > bot.y + bot.h && steps < 500) {
      bx += bvx;
      by += bvy;
      if (bx - BALL_R < 0) { bx = BALL_R; bvx = -bvx; }
      if (bx + BALL_R > W) { bx = W - BALL_R; bvx = -bvx; }
      steps++;
    }
  }

  const targetCenter = bvy < 0 ? bx : W / 2;
  const botCenter = bot.x + bot.w / 2;
  const diff = targetCenter - botCenter;
  const speed = Math.min(Math.abs(diff), Math.min(W, H) * 0.013);
  bot.x += Math.sign(diff) * speed;
  bot.x = Math.max(0, Math.min(W - bot.w, bot.x));
}

// ─── PARTICLES ────────────────────────────────────────────────────────────────
function spawnParticles(x, y, color, count = 18) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
      r: Math.random() * 4 + 2
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.1;
    p.life -= 0.03;
    p.vx *= 0.97;
  });
}

// ─── PHYSICS ──────────────────────────────────────────────────────────────────
function updatePhysics() {
  // Player paddle smooth follow
  const pdx = player.targetX - player.x;
  player.x += pdx * 0.35;

  // Ball
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall bounce
  if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); spawnParticles(ball.x, ball.y, '#00f5ff', 8); }
  if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); spawnParticles(ball.x, ball.y, '#00f5ff', 8); }

  // Paddle collision helper
  function paddleHit(paddle) {
    if (
      ball.x + ball.r > paddle.x &&
      ball.x - ball.r < paddle.x + paddle.w &&
      ball.y + ball.r > paddle.y &&
      ball.y - ball.r < paddle.y + paddle.h
    ) {
      const hitPos = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1 to 1
      const angle = hitPos * 65 * (Math.PI / 180);
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * 1.04;
      const maxSpeed = Math.min(W, H) * 0.022;
      const s = Math.min(speed, maxSpeed);
      ball.vx = s * Math.sin(angle);
      ball.vy = (paddle === player) ? -Math.abs(s * Math.cos(angle)) : Math.abs(s * Math.cos(angle));
      spawnParticles(ball.x, ball.y, '#ff00aa', 14);
      return true;
    }
    return false;
  }

  paddleHit(player);
  paddleHit(bot);

  // GOAL detection
  const goalW = W * GOAL_W_RATIO;
  const goalLeft = W / 2 - goalW / 2;
  const goalRight = W / 2 + goalW / 2;

  if (ball.y - ball.r < 0) {
    // Bot goal → Player scores
    if (ball.x > goalLeft && ball.x < goalRight) {
      playerScore++;
      document.getElementById('score-player').textContent = playerScore;
      spawnParticles(ball.x, 0, '#00f5ff', 30);
      goalFlash = { who: 'player', timer: 40 };
      resetBall(false);
      resetPositions();
      if (playerScore >= WIN_SCORE) { gameRunning = false; setTimeout(() => showResult(true, playerScore, botScore), 700); }
    } else {
      ball.vy = Math.abs(ball.vy);
    }
  }

  if (ball.y + ball.r > H) {
    // Player goal → Bot scores
    if (ball.x > goalLeft && ball.x < goalRight) {
      botScore++;
      document.getElementById('score-bot').textContent = botScore;
      spawnParticles(ball.x, H, '#ff00aa', 30);
      goalFlash = { who: 'bot', timer: 40 };
      resetBall(true);
      resetPositions();
      if (botScore >= WIN_SCORE) { gameRunning = false; setTimeout(() => showResult(false, playerScore, botScore), 700); }
    } else {
      ball.vy = -Math.abs(ball.vy);
    }
  }
}

// ─── DRAW ─────────────────────────────────────────────────────────────────────
function drawField() {
  // Background
  ctx.fillStyle = '#080818';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(0,245,255,0.04)';
  ctx.lineWidth = 1;
  const gsize = 40;
  for (let x = 0; x < W; x += gsize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += gsize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Center line
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(0,245,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  ctx.setLineDash([]);

  // Center circle
  ctx.strokeStyle = 'rgba(0,245,255,0.1)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.1, 0, Math.PI * 2); ctx.stroke();

  // Goals
  const gw = W * GOAL_W_RATIO;
  const gl = W / 2 - gw / 2;

  // Top goal (bot side)
  const topColor = (goalFlash && goalFlash.who === 'player') ? 'rgba(0,245,255,0.7)' : 'rgba(0,245,255,0.3)';
  ctx.strokeStyle = topColor;
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(gl, 0); ctx.lineTo(gl, 12); ctx.lineTo(gl + gw, 12); ctx.lineTo(gl + gw, 0); ctx.stroke();
  ctx.shadowBlur = 0;

  // Bottom goal (player side)
  const botColor = (goalFlash && goalFlash.who === 'bot') ? 'rgba(255,0,170,0.7)' : 'rgba(255,0,170,0.3)';
  ctx.strokeStyle = botColor;
  ctx.shadowColor = '#ff00aa'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(gl, H - 12); ctx.lineTo(gl, H); ctx.moveTo(gl + gw, H - 12); ctx.lineTo(gl + gw, H); ctx.stroke();
  // Bottom goal line
  ctx.beginPath(); ctx.moveTo(gl, H - 12); ctx.lineTo(gl + gw, H - 12); ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawPaddle(p, color) {
  const r = PADDLE_H / 2;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, p.h, r);
  ctx.fill();
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.roundRect(p.x + 4, p.y + 2, p.w - 8, 4, 2);
  ctx.fill();
  ctx.restore();
}

function drawBall() {
  ctx.save();
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 24;
  const grad = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, ball.r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.4, '#00f5ff');
  grad.addColorStop(1, '#0040ff');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ─── LOOP ─────────────────────────────────────────────────────────────────────
function loop() {
  resizeCanvas();

  if (goalFlash) {
    goalFlash.timer--;
    if (goalFlash.timer <= 0) goalFlash = null;
  }

  if (gameRunning) {
    updateBot();
    updatePhysics();
    updateParticles();
  }

  drawField();
  drawPaddle(bot, '#ff00aa');
  drawPaddle(player, '#00f5ff');
  drawBall();
  drawParticles();

  // Goal flash overlay
  if (goalFlash) {
    const alpha = goalFlash.timer / 40 * 0.25;
    ctx.fillStyle = goalFlash.who === 'player'
      ? `rgba(0,245,255,${alpha})`
      : `rgba(255,0,170,${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  animId = requestAnimationFrame(loop);
}

// ─── RESIZE ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (document.getElementById('screen-game').classList.contains('active')) {
    resizeCanvas();
    resetPositions();
  }
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadState();
updateMenuUI();
showScreen('screen-menu');
