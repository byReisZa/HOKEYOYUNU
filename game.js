
/* ═══════════════════════════════════════════════════════════
   game.js — NEON HOKEY | Tam Oyun Motoru
   
   Modüller:
     Storage    → localStorage puan yönetimi
     Screens    → Ekran geçiş sistemi
     Particles  → Menü arka plan parçacıkları
     Physics    → Disk fiziği & çarpışma
     AI         → Yapay zeka rakip
     Renderer   → Canvas neon çizim sistemi
     Game       → Ana oyun döngüsü & kontroller
     UI         → Buton bağlamaları & modal
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════
   STORAGE — Puan yönetimi (localStorage)
   ══════════════════════════════════════════════ */
const Storage = (() => {
  const KEYS = {
    total:   'nh_total_points',
    played:  'nh_games_played',
    won:     'nh_games_won',
    lost:    'nh_games_lost',
  };

  const get = k => parseInt(localStorage.getItem(k) || '0', 10);
  const set = (k, v) => localStorage.setItem(k, v);

  return {
    getTotal:  ()    => get(KEYS.total),
    getPlayed: ()    => get(KEYS.played),
    getWon:    ()    => get(KEYS.won),
    getLost:   ()    => get(KEYS.lost),

    addPoints(pts) { set(KEYS.total, get(KEYS.total) + pts); },

    recordGame(won) {
      set(KEYS.played, get(KEYS.played) + 1);
      if (won) set(KEYS.won,  get(KEYS.won)  + 1);
      else     set(KEYS.lost, get(KEYS.lost) + 1);
    },
  };
})();

/* ══════════════════════════════════════════════
   POINTS CONFIG
   ══════════════════════════════════════════════ */
const POINTS = {
  perGame: 10,
  winBonus: 25,
};

const WIN_SCORE = 7;  // Kaç gol kazandırır

/* ══════════════════════════════════════════════
   SCREENS — Ekran geçiş sistemi
   ══════════════════════════════════════════════ */
const Screens = (() => {
  const all = document.querySelectorAll('.screen');

  function show(id) {
    all.forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${id}`)?.classList.add('active');
  }

  return { show };
})();

/* ══════════════════════════════════════════════
   PARTICLES — Menü arka plan parçacıkları
   ══════════════════════════════════════════════ */
const Particles = (() => {
  const container = document.getElementById('particles');
  const COLORS = ['#00FFFF', '#FF6EC7', '#00FF88', '#FFD700'];

  function init() {
    container.innerHTML = '';
    for (let i = 0; i < 55; i++) spawn();
  }

  function spawn() {
    const el = document.createElement('div');
    el.className = 'particle';
    const size = Math.random() * 3 + 1;
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      bottom: -10px;
      width: ${size}px;
      height: ${size}px;
      background: ${COLORS[Math.floor(Math.random() * COLORS.length)]};
      animation-duration: ${5 + Math.random() * 12}s;
      animation-delay: ${Math.random() * 10}s;
      box-shadow: 0 0 6px currentColor;
    `;
    container.appendChild(el);
  }

  return { init };
})();

/* ══════════════════════════════════════════════
   PHYSICS — Disk fiziği & çarpışma motoru
   ══════════════════════════════════════════════ */
const Physics = (() => {

  /** Disk-duvar + disk-raket çarpışmalarını çözer
   *  @returns  1  oyuncu gol, -1  AI gol, 0  devam */
  function update(state) {
    const { puck, playerPaddle, aiPaddle, W, H, goalLeft, goalRight } = state;

    // Sürtünme
    puck.vx *= 0.994;
    puck.vy *= 0.994;

    // Hız sınırı
    const spd = Math.hypot(puck.vx, puck.vy);
    if (spd > state.maxSpeed) {
      puck.vx = puck.vx / spd * state.maxSpeed;
      puck.vy = puck.vy / spd * state.maxSpeed;
    }

    // Minimum hız (durmasın)
    if (spd > 0.1 && spd < 1.5) {
      const f = 1.5 / spd;
      puck.vx *= f; puck.vy *= f;
    }

    puck.x += puck.vx;
    puck.y += puck.vy;

    // ── YAN DUVARLAR ──
    if (puck.x - puck.r < 0) {
      puck.x = puck.r;
      puck.vx = Math.abs(puck.vx);
    } else if (puck.x + puck.r > W) {
      puck.x = W - puck.r;
      puck.vx = -Math.abs(puck.vx);
    }

    // ── ÜST SINIR (AI kalesi) ──
    if (puck.y - puck.r < 0) {
      if (puck.x > goalLeft && puck.x < goalRight) {
        return 1; // Oyuncu gol!
      }
      puck.y = puck.r;
      puck.vy = Math.abs(puck.vy);
    }

    // ── ALT SINIR (Oyuncu kalesi) ──
    if (puck.y + puck.r > H) {
      if (puck.x > goalLeft && puck.x < goalRight) {
        return -1; // AI gol!
      }
      puck.y = H - puck.r;
      puck.vy = -Math.abs(puck.vy);
    }

    // ── RAKET ÇARPMASI ──
    resolveCircleCollision(puck, playerPaddle);
    resolveCircleCollision(puck, aiPaddle);

    return 0;
  }

  /** Daire–daire çarpışma çözümü (impulse bazlı) */
  function resolveCircleCollision(puck, paddle) {
    const dx   = puck.x - paddle.x;
    const dy   = puck.y - paddle.y;
    const dist = Math.hypot(dx, dy);
    const minD = puck.r + paddle.r;

    if (dist < minD && dist > 0.01) {
      const nx = dx / dist;
      const ny = dy / dist;

      // Örtüşmeyi düzelt
      const overlap = minD - dist;
      puck.x += nx * overlap;
      puck.y += ny * overlap;

      // Hız yansıması
      const dot = puck.vx * nx + puck.vy * ny;
      if (dot < 0) {
        const r = 1.18; // Enerji katsayısı (sekme hissi)
        puck.vx -= r * dot * nx;
        puck.vy -= r * dot * ny;
      }
    }
  }

  return { update };
})();

/* ══════════════════════════════════════════════
   AI — Yapay zeka kontrolcüsü
   ══════════════════════════════════════════════ */
const AI = (() => {

  function update(state) {
    const { puck, aiPaddle, W, H } = state;
    const midY = H / 2;

    // Skor farkına göre hız hesabı
    const diff  = state.aiScore - state.playerScore;
    const speed = Math.min(Math.max(8 + diff * 0.5, 5), 18);

    let targetX, targetY;

    // Disk AI yarısındaysa → saldır
    if (puck.y < midY) {
      // Biraz öngörülü: puck'ın gideceği yeri tahmin et
      const predict = 0.25;
      targetX = puck.x + puck.vx * (midY - puck.y) * predict;
      targetY = Math.max(puck.y + aiPaddle.r, aiPaddle.r + 4);
    } else {
      // Savunma: merkeze dön
      targetX = W / 2;
      targetY = aiPaddle.r + 60;
    }

    // Kademeli hareket (smooth)
    const dx = targetX - aiPaddle.x;
    const dy = targetY - aiPaddle.y;
    const len = Math.hypot(dx, dy);

    if (len > 0) {
      const move = Math.min(len, speed);
      aiPaddle.x += (dx / len) * move;
      aiPaddle.y += (dy / len) * move;
    }

    // Sınır: AI yalnızca üst yarıda
    aiPaddle.x = Math.max(aiPaddle.r, Math.min(W - aiPaddle.r, aiPaddle.x));
    aiPaddle.y = Math.max(aiPaddle.r, Math.min(midY - aiPaddle.r, aiPaddle.y));
  }

  return { update };
})();

/* ══════════════════════════════════════════════
   RENDERER — Neon Canvas çizim sistemi
   ══════════════════════════════════════════════ */
const Renderer = (() => {

  function clear(ctx, W, H) {
    ctx.fillStyle = '#0D0D0D';
    ctx.fillRect(0, 0, W, H);
  }

  function drawField(ctx, W, H, goalLeft, goalRight) {
    // Saha yüzeyi gradyanı
    const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, H*0.6);
    grad.addColorStop(0,   'rgba(0,30,60,0.5)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Izgara çizgileri (hafif)
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();

    // Orta çizgi
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(0, H/2);
    ctx.lineTo(W, H/2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Orta daire
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(W/2, H/2, 70, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();

    // Kale çizgileri
    drawGoal(ctx, goalLeft, goalRight, 0, '#FF4444', false);    // Üst (AI)
    drawGoal(ctx, goalLeft, goalRight, H, '#00FF88', true);     // Alt (Oyuncu)
  }

  function drawGoal(ctx, left, right, y, color, isBottom) {
    ctx.save();
    ctx.shadowColor  = color;
    ctx.shadowBlur   = 16;
    ctx.strokeStyle  = color;
    ctx.lineWidth    = 5;
    ctx.lineCap      = 'round';

    const barY = isBottom ? y - 2 : y + 2;
    ctx.beginPath();
    ctx.moveTo(left, barY);
    ctx.lineTo(right, barY);
    ctx.stroke();

    // Küçük dikey kenar çizgileri
    const postH = 18;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left,  barY);
    ctx.lineTo(left,  isBottom ? barY - postH : barY + postH);
    ctx.moveTo(right, barY);
    ctx.lineTo(right, isBottom ? barY - postH : barY + postH);
    ctx.stroke();

    // İç parlama
    ctx.shadowBlur   = 0;
    ctx.strokeStyle  = 'rgba(255,255,255,0.08)';
    ctx.lineWidth    = 1;
    ctx.beginPath();
    ctx.moveTo(left, barY);
    ctx.lineTo(right, barY);
    ctx.stroke();

    ctx.restore();
  }

  function drawPuck(ctx, puck) {
    const { x, y, r } = puck;
    ctx.save();

    // Dış büyük glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    glow.addColorStop(0,   'rgba(255,255,255,0.18)');
    glow.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    glow.addColorStop(1,   'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI*2);
    ctx.fill();

    // Gövde
    ctx.shadowColor  = '#FFFFFF';
    ctx.shadowBlur   = 18;
    ctx.fillStyle    = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();

    // Koyu iç
    ctx.shadowBlur   = 0;
    ctx.fillStyle    = '#111';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.4, 0, Math.PI*2);
    ctx.fill();

    // Parlak halka
    ctx.strokeStyle  = 'rgba(255,255,255,0.5)';
    ctx.lineWidth    = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, 0, Math.PI*2);
    ctx.stroke();

    ctx.restore();
  }

  function drawPaddle(ctx, paddle, color, label) {
    const { x, y, r } = paddle;
    ctx.save();

    // Glow katmanı
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
    glow.addColorStop(0,   color + '44');
    glow.addColorStop(0.6, color + '11');
    glow.addColorStop(1,   'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI*2);
    ctx.fill();

    // Gövde
    ctx.shadowColor = color;
    ctx.shadowBlur  = 20;
    ctx.fillStyle   = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fill();

    // Koyu merkez
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#0D0D0D';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.44, 0, Math.PI*2);
    ctx.fill();

    // İnner halka
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, 0, Math.PI*2);
    ctx.stroke();

    // Dış çerçeve
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.stroke();

    ctx.restore();
  }

  function drawTrail(ctx, trail) {
    if (!trail || trail.length < 2) return;
    ctx.save();
    for (let i = 1; i < trail.length; i++) {
      const alpha = i / trail.length * 0.35;
      const r     = (i / trail.length) * 10;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  return { clear, drawField, drawPuck, drawPaddle, drawTrail };
})();

/* ══════════════════════════════════════════════
   GAME — Ana oyun döngüsü
   ══════════════════════════════════════════════ */
const Game = (() => {
  const canvas = document.getElementById('game-canvas');
  const ctx    = canvas.getContext('2d');

  let state     = null;
  let rafId     = null;
  let puckTrail = [];
  let paused    = false;

  // Dokunma/Fare takibi
  let touchActive = false;
  let touchX = 0, touchY = 0;

  // ── OYUN DURUMU OLUŞTUR ──────────────────────
  function createState() {
    const W = canvas.width;
    const H = canvas.height;
    const gw = W * 0.36;

    return {
      W, H,
      goalLeft:  (W - gw) / 2,
      goalRight: (W + gw) / 2,
      maxSpeed:  26,

      puck: {
        x: W / 2, y: H / 2,
        vx: (Math.random() > 0.5 ? 1 : -1) * 4,
        vy: 8,
        r: Math.min(W, H) * 0.038,
      },

      playerPaddle: {
        x: W / 2,
        y: H - H * 0.12,
        r: Math.min(W, H) * 0.058,
      },

      aiPaddle: {
        x: W / 2,
        y: H * 0.12,
        r: Math.min(W, H) * 0.058,
      },

      playerScore: 0,
      aiScore:     0,
    };
  }

  function resetPuck(st, towardsPlayer) {
    st.puck.x  = st.W / 2;
    st.puck.y  = st.H / 2;
    st.puck.vx = (Math.random() - 0.5) * 6;
    st.puck.vy = towardsPlayer ? 10 : -10;
    puckTrail  = [];
  }

  // ── BOYUTLANDIRMA ────────────────────────────
  function resize() {
    const hud   = document.querySelector('.hud');
    const hudH  = hud ? hud.offsetHeight : 60;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight - hudH;
  }

  // ── GOL ANİMASYONU ───────────────────────────
  function showGoalFlash(playerScored) {
    const flash = document.getElementById('goal-flash');
    const text  = document.getElementById('goal-text');
    text.textContent = playerScored ? '⬡ GOL! ⬡' : 'AI GOLU!';
    text.style.color  = playerScored ? '#00FF88' : '#FF4444';
    text.style.textShadow = playerScored
      ? '0 0 30px #00FF88, 0 0 60px #00FF8844'
      : '0 0 30px #FF4444, 0 0 60px #FF444444';
    flash.style.background = playerScored
      ? 'rgba(0,255,136,0.08)'
      : 'rgba(255,68,68,0.08)';
    flash.classList.add('show');
    setTimeout(() => flash.classList.remove('show'), 900);
  }

  // ── HUD GÜNCELLE ─────────────────────────────
  function updateHUD(st) {
    const ps = document.getElementById('score-player');
    const as = document.getElementById('score-ai');

    const pOld = parseInt(ps.textContent);
    const aOld = parseInt(as.textContent);

    ps.textContent = st.playerScore;
    as.textContent = st.aiScore;

    if (st.playerScore !== pOld) popAnim(ps);
    if (st.aiScore     !== aOld) popAnim(as);
  }

  function popAnim(el) {
    el.classList.remove('pop');
    void el.offsetWidth; // reflow
    el.classList.add('pop');
    setTimeout(() => el.classList.remove('pop'), 200);
  }

  // ── OYUN DÖNGÜSÜ ─────────────────────────────
  function loop() {
    if (!state || paused) { rafId = requestAnimationFrame(loop); return; }

    // Oyuncu raket takibi
    if (touchActive) {
      const midY = state.H / 2;
      if (touchY > midY) {
        const pr = state.playerPaddle.r;
        state.playerPaddle.x = Math.max(pr, Math.min(state.W - pr, touchX));
        state.playerPaddle.y = Math.max(midY + pr, Math.min(state.H - pr, touchY));
      }
    }

    // Fizik güncelle
    const goalResult = Physics.update(state);

    // AI güncelle
    AI.update(state);

    // Trail
    puckTrail.push({ x: state.puck.x, y: state.puck.y });
    if (puckTrail.length > 14) puckTrail.shift();

    // Çiz
    Renderer.clear(ctx, state.W, state.H);
    Renderer.drawField(ctx, state.W, state.H, state.goalLeft, state.goalRight);
    Renderer.drawTrail(ctx, puckTrail);
    Renderer.drawPuck(ctx, state.puck);
    Renderer.drawPaddle(ctx, state.playerPaddle, '#00FFFF');
    Renderer.drawPaddle(ctx, state.aiPaddle,     '#FF6EC7');

    // Gol kontrolü
    if (goalResult !== 0) {
      const playerScored = goalResult === 1;
      updateHUD(state);
      showGoalFlash(playerScored);

      paused = true;
      setTimeout(() => {
        resetPuck(state, !playerScored);
        paused = false;

        // Kazanan var mı?
        if (state.playerScore >= WIN_SCORE || state.aiScore >= WIN_SCORE) {
          const won = state.playerScore >= WIN_SCORE;
          endGame(won);
          return;
        }
      }, 1100);
    }

    rafId = requestAnimationFrame(loop);
  }

  // ── OYUNU BİTİR ──────────────────────────────
  function endGame(playerWon) {
    stop();

    const pts = POINTS.perGame + (playerWon ? POINTS.winBonus : 0);
    Storage.addPoints(pts);
    Storage.recordGame(playerWon);

    // Sonuç ekranını doldur
    document.getElementById('result-icon').textContent    = playerWon ? '🏆' : '💀';
    document.getElementById('result-title').textContent   = playerWon ? 'KAZANDIN!' : 'KAYBETTİN!';
    document.getElementById('result-title').style.color   = playerWon ? '#00FF88' : '#FF4444';
    document.getElementById('result-title').style.textShadow = playerWon
      ? '0 0 30px #00FF88' : '0 0 30px #FF4444';
    document.getElementById('res-player-score').textContent = state.playerScore;
    document.getElementById('res-ai-score').textContent     = state.aiScore;
    document.getElementById('earned-pts').textContent        = pts;
    document.getElementById('res-total-pts').textContent     = Storage.getTotal();

    setTimeout(() => Screens.show('result'), 600);
  }

  // ── BAŞLAT / DURDUR ──────────────────────────
  function start() {
    resize();
    state  = createState();
    paused = false;
    puckTrail = [];
    updateHUD(state);
    Screens.show('game');
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    state = null;
  }

  // ── TOUCH / MOUSE KONTROL ────────────────────
  function bindControls() {
    // Touch
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      touchX = t.clientX;
      touchY = t.clientY - canvas.getBoundingClientRect().top;
      touchActive = true;
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      touchX = t.clientX;
      touchY = t.clientY - canvas.getBoundingClientRect().top;
    }, { passive: false });

    canvas.addEventListener('touchend',   () => { touchActive = false; });
    canvas.addEventListener('touchcancel',() => { touchActive = false; });

    // Mouse (masaüstü)
    canvas.addEventListener('mousedown', e => {
      touchX = e.clientX;
      touchY = e.clientY - canvas.getBoundingClientRect().top;
      touchActive = true;
    });
    canvas.addEventListener('mousemove', e => {
      if (!touchActive) return;
      touchX = e.clientX;
      touchY = e.clientY - canvas.getBoundingClientRect().top;
    });
    canvas.addEventListener('mouseup',   () => { touchActive = false; });
    canvas.addEventListener('mouseleave',() => { touchActive = false; });

    // Resize
    window.addEventListener('resize', () => {
      if (state) {
        resize();
        const newSt = createState();
        // Skoru koru
        newSt.playerScore = state.playerScore;
        newSt.aiScore     = state.aiScore;
        state = newSt;
      }
    });
  }

  return { start, stop, bindControls };
})();

/* ══════════════════════════════════════════════
   PAYMENT PLACEHOLDER
   Gerçek ödeme API'si buraya entegre edilecek.
   Mevcut durum: yalnızca simülasyon.
   
   TODO:
     - Google Pay / Apple Pay entegrasyonu
     - Banka havalesi API'si
     - Kripto cüzdan bağlantısı
   ══════════════════════════════════════════════ */
function withdrawPoints() {
  const total = Storage.getTotal();
  const body  = document.getElementById('withdraw-body');

  if (total < 100) {
    body.innerHTML = `⚠️ En az <strong>100 puan</strong> gerekli!<br>
      Şu anki puan: <strong style="color:#FF4444">${total}</strong>`;
  } else {
    body.innerHTML = `Bu özellik henüz aktif değil.<br>
      Gerçek ödeme API'si yakında!<br>
      <span style="color:#FFD700;font-size:13px">${total} puan bozdurmak için bekliyoruz.</span>`;
  }

  document.getElementById('withdraw-pts').textContent = total;
  document.getElementById('modal-withdraw').classList.add('open');
}

/* ══════════════════════════════════════════════
   UI — Buton bağlamaları ve modallar
   ══════════════════════════════════════════════ */
const UI = (() => {

  function refreshMenuScore() {
    document.getElementById('menu-total-score').textContent = Storage.getTotal();
  }

  function openScoresModal() {
    const total  = Storage.getTotal();
    const played = Storage.getPlayed();
    const won    = Storage.getWon();
    const lost   = Storage.getLost();
    const rate   = played > 0 ? Math.round(won / played * 100) : 0;

    const grid = document.getElementById('stats-grid');
    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-val" style="color:#FFD700">${total}</div>
        <div class="stat-card-lbl">TOPLAM PUAN</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-val" style="color:#00FFFF">${played}</div>
        <div class="stat-card-lbl">OYNANAN</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-val" style="color:#00FF88">${won}</div>
        <div class="stat-card-lbl">GALİBİYET</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-val" style="color:#FF6EC7">${rate}%</div>
        <div class="stat-card-lbl">KAZANMA ORANI</div>
      </div>
    `;
    document.getElementById('modal-scores').classList.add('open');
  }

  function init() {
    // Menü butonları
    document.getElementById('btn-start').addEventListener('click', () => {
      Game.start();
    });

    document.getElementById('btn-scores').addEventListener('click', () => {
      openScoresModal();
    });

    document.getElementById('btn-withdraw').addEventListener('click', () => {
      withdrawPoints();
    });

    // Oyun ekranı
    document.getElementById('btn-back').addEventListener('click', () => {
      Game.stop();
      refreshMenuScore();
      Screens.show('menu');
    });

    // Sonuç ekranı
    document.getElementById('btn-replay').addEventListener('click', () => {
      Game.start();
    });

    document.getElementById('btn-menu').addEventListener('click', () => {
      refreshMenuScore();
      Screens.show('menu');
    });

    // Modal kapatma
    document.getElementById('modal-close').addEventListener('click', () => {
      document.getElementById('modal-withdraw').classList.remove('open');
    });
    document.getElementById('scores-close').addEventListener('click', () => {
      document.getElementById('modal-scores').classList.remove('open');
    });

    // Overlay tıklama ile kapat
    ['modal-withdraw', 'modal-scores'].forEach(id => {
      document.getElementById(id).addEventListener('click', e => {
        if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
      });
    });
  }

  return { init, refreshMenuScore };
})();

/* ══════════════════════════════════════════════
   BAŞLATMA
   ══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  Particles.init();
  Game.bindControls();
  UI.init();
  UI.refreshMenuScore();
  Screens.show('menu');
});
