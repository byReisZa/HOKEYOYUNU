// ===================== ALIZA - HILL CLIMB RACING =====================

// Canvas ve Context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Oyun Değişkenleri
let gameRunning = false;
let animationId;
let lastTime = 0;

// Fizik Sabitleri
const GRAVITY = 0.5;
const FRICTION = 0.98;
const AIR_RESISTANCE = 0.995;

// Oyun Durumu
const gameState = {
    coins: parseInt(localStorage.getItem('aliza_coins')) || 0,
    totalDistance: parseInt(localStorage.getItem('aliza_distance')) || 0,
    ownedCars: JSON.parse(localStorage.getItem('aliza_cars')) || ['jeep'],
    ownedMaps: JSON.parse(localStorage.getItem('aliza_maps')) || ['hills'],
    currentCar: localStorage.getItem('aliza_currentCar') || 'jeep',
    currentMap: localStorage.getItem('aliza_currentMap') || 'hills',
    settings: JSON.parse(localStorage.getItem('aliza_settings')) || {
        volume: 50,
        music: true,
        difficulty: 'normal'
    }
};

// Araba Verileri
const cars = {
    jeep: {
        name: 'Jeep',
        emoji: '🚙',
        price: 0,
        maxSpeed: 15,
        acceleration: 0.3,
        grip: 0.8,
        fuelCapacity: 100,
        fuelConsumption: 0.15,
        power: 0.4,
        color: '#27ae60',
        width: 70,
        height: 35,
        wheelRadius: 12,
        mass: 1
    },
    monster: {
        name: 'Canavar Kamyon',
        emoji: '🚛',
        price: 500,
        maxSpeed: 12,
        acceleration: 0.25,
        grip: 0.9,
        fuelCapacity: 150,
        fuelConsumption: 0.2,
        power: 0.6,
        color: '#e74c3c',
        width: 90,
        height: 45,
        wheelRadius: 16,
        mass: 1.5
    },
    sport: {
        name: 'Spor Araba',
        emoji: '🏎️',
        price: 1000,
        maxSpeed: 25,
        acceleration: 0.5,
        grip: 0.6,
        fuelCapacity: 80,
        fuelConsumption: 0.25,
        power: 0.5,
        color: '#3498db',
        width: 65,
        height: 25,
        wheelRadius: 10,
        mass: 0.8
    },
    tank: {
        name: 'Tank',
        emoji: '🪖',
        price: 2000,
        maxSpeed: 8,
        acceleration: 0.15,
        grip: 1.0,
        fuelCapacity: 200,
        fuelConsumption: 0.3,
        power: 0.8,
        color: '#2c3e50',
        width: 100,
        height: 40,
        wheelRadius: 14,
        mass: 2
    },
    hover: {
        name: 'Hover Araba',
        emoji: '🛸',
        price: 5000,
        maxSpeed: 20,
        acceleration: 0.4,
        grip: 0.5,
        fuelCapacity: 120,
        fuelConsumption: 0.1,
        power: 0.45,
        color: '#9b59b6',
        width: 75,
        height: 30,
        wheelRadius: 0,
        mass: 0.9
    }
};

// Harita Verileri
const maps = {
    hills: {
        name: 'Yeşil Tepeler',
        emoji: '🏔️',
        price: 0,
        bgColor: '#87CEEB',
        groundColor: '#27ae60',
        hillHeight: 100,
        hillFrequency: 0.003,
        coinFrequency: 0.02,
        fuelFrequency: 0.05,
        obstacleFrequency: 0.01
    },
    desert: {
        name: 'Çöl',
        emoji: '🏜️',
        price: 300,
        bgColor: '#F4A460',
        groundColor: '#D2691E',
        hillHeight: 80,
        hillFrequency: 0.002,
        coinFrequency: 0.015,
        fuelFrequency: 0.04,
        obstacleFrequency: 0.015
    },
    moon: {
        name: 'Ay',
        emoji: '🌑',
        price: 800,
        bgColor: '#1a1a2e',
        groundColor: '#7f8c8d',
        hillHeight: 60,
        hillFrequency: 0.004,
        coinFrequency: 0.025,
        fuelFrequency: 0.03,
        obstacleFrequency: 0.008,
        gravity: 0.2
    },
    snow: {
        name: 'Karlı Dağ',
        emoji: '🏔️',
        price: 1500,
        bgColor: '#B0E0E6',
        groundColor: '#ECF0F1',
        hillHeight: 120,
        hillFrequency: 0.0025,
        coinFrequency: 0.02,
        fuelFrequency: 0.035,
        obstacleFrequency: 0.012,
        slippery: true
    },
    volcano: {
        name: 'Volkan',
        emoji: '🌋',
        price: 3000,
        bgColor: '#2c0b0e',
        groundColor: '#8B0000',
        hillHeight: 90,
        hillFrequency: 0.0035,
        coinFrequency: 0.03,
        fuelFrequency: 0.025,
        obstacleFrequency: 0.02
    }
};

// Aktif Oyun Verileri
let player = {
    x: 100,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    fuel: 100,
    gear: 1,
    maxGear: 5,
    clutchPressed: false,
    distance: 0,
    coinsCollected: 0,
    onGround: false
};

let terrain = [];
let coins = [];
let fuels = [];
let obstacles = [];
let particles = [];
let camera = { x: 0, y: 0 };
let milestones = [100, 250, 500, 1000, 2000, 5000];
let reachedMilestones = [];

// Giriş Durumu
const input = {
    gas: false,
    brake: false,
    clutch: false
};

// ===================== BAŞLATMA =====================

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ===================== ARAZİ OLUŞTURMA =====================

function generateTerrain(startX, length) {
    const map = maps[gameState.currentMap];
    const points = [];

    for (let i = 0; i < length; i++) {
        const x = startX + i * 10;
        let y = canvas.height / 2 + Math.sin(x * map.hillFrequency) * map.hillHeight;

        // Rastgele varyasyon ekle
        y += Math.sin(x * map.hillFrequency * 2.5) * map.hillHeight * 0.3;
        y += Math.sin(x * map.hillFrequency * 5) * map.hillHeight * 0.1;

        // Zorluk seviyesine göre daha sert tepeler
        if (gameState.settings.difficulty === 'hard') {
            y += Math.sin(x * map.hillFrequency * 3) * map.hillHeight * 0.5;
        }

        points.push({ x, y });
    }

    return points;
}

function getGroundY(x) {
    const map = maps[gameState.currentMap];
    let y = canvas.height / 2 + Math.sin(x * map.hillFrequency) * map.hillHeight;
    y += Math.sin(x * map.hillFrequency * 2.5) * map.hillHeight * 0.3;
    y += Math.sin(x * map.hillFrequency * 5) * map.hillHeight * 0.1;

    if (gameState.settings.difficulty === 'hard') {
        y += Math.sin(x * map.hillFrequency * 3) * map.hillHeight * 0.5;
    }

    return y;
}

function getGroundAngle(x) {
    const delta = 5;
    const y1 = getGroundY(x - delta);
    const y2 = getGroundY(x + delta);
    return Math.atan2(y2 - y1, delta * 2);
}

// ===================== NESNE OLUŞTURMA =====================

function spawnCoins(startX, endX) {
    const map = maps[gameState.currentMap];
    const newCoins = [];

    for (let x = startX; x < endX; x += 50) {
        if (Math.random() < map.coinFrequency) {
            const y = getGroundY(x) - 80 - Math.random() * 100;
            newCoins.push({
                x,
                y,
                collected: false,
                value: 10 + Math.floor(Math.random() * 20)
            });
        }
    }

    return newCoins;
}

function spawnFuels(startX, endX) {
    const map = maps[gameState.currentMap];
    const newFuels = [];

    for (let x = startX; x < endX; x += 100) {
        if (Math.random() < map.fuelFrequency) {
            const y = getGroundY(x) - 60;
            newFuels.push({
                x,
                y,
                collected: false,
                value: 25
            });
        }
    }

    return newFuels;
}

function spawnObstacles(startX, endX) {
    const map = maps[gameState.currentMap];
    const newObstacles = [];

    for (let x = startX; x < endX; x += 80) {
        if (Math.random() < map.obstacleFrequency) {
            const y = getGroundY(x);
            const type = Math.random() < 0.5 ? 'rock' : 'bump';
            newObstacles.push({
                x,
                y,
                type,
                width: type === 'rock' ? 30 : 50,
                height: type === 'rock' ? 25 : 15
            });
        }
    }

    return newObstacles;
}

// ===================== FİZİK =====================

function updatePhysics(dt) {
    const car = cars[gameState.currentCar];
    const map = maps[gameState.currentMap];

    // Yerçekimi
    const gravity = map.gravity || GRAVITY;
    player.vy += gravity;

    // Hava direnci
    player.vx *= AIR_RESISTANCE;
    player.vy *= AIR_RESISTANCE;

    // Debriyaj kontrolü
    let enginePower = 0;
    if (input.gas && player.fuel > 0) {
        // Vitese göre güç
        const gearRatio = player.gear / car.maxSpeed;
        enginePower = car.power * gearRatio;

        // Debriyaj basılıysa güç aktarılmaz
        if (player.clutchPressed) {
            enginePower = 0;
        }

        // Yakıt tüketimi
        player.fuel -= car.fuelConsumption * (1 + player.gear * 0.1);
    }

    // Fren
    if (input.brake) {
        player.vx *= 0.95;
        player.angularVelocity *= 0.9;
    }

    // Motor gücü uygula
    if (!player.clutchPressed) {
        const force = enginePower * Math.cos(player.angle);
        player.vx += force / car.mass;
    }

    // Maksimum hız limiti
    const maxSpeed = car.maxSpeed * (player.gear / 5);
    if (player.vx > maxSpeed) player.vx = maxSpeed;
    if (player.vx < -maxSpeed * 0.5) player.vx = -maxSpeed * 0.5;

    // Kaygan zemin (kar)
    if (map.slippery && player.onGround) {
        player.vx *= 0.995;
    }

    // Pozisyon güncelle
    player.x += player.vx;
    player.y += player.vy;

    // Zemin kontrolü
    const groundY = getGroundY(player.x);
    const groundAngle = getGroundAngle(player.x);

    // Tekerlek pozisyonları
    const carWidth = car.width;
    const frontWheelX = player.x + carWidth / 2 * Math.cos(player.angle);
    const backWheelX = player.x - carWidth / 2 * Math.cos(player.angle);
    const frontWheelY = getGroundY(frontWheelX);
    const backWheelY = getGroundY(backWheelX);

    // Araba açısı
    const targetAngle = Math.atan2(frontWheelY - backWheelY, frontWheelX - backWheelX);
    player.angle += (targetAngle - player.angle) * 0.1;

    // Zemin çarpışması
    const carBottom = player.y + car.height / 2;
    const avgGroundY = (frontWheelY + backWheelY) / 2 - car.wheelRadius;

    if (carBottom > avgGroundY) {
        player.y = avgGroundY - car.height / 2;
        player.vy = 0;
        player.onGround = true;

        // Sürtünme
        player.vx *= car.grip;

        // Zıplama engelleme (çok dik yerlerde)
        if (Math.abs(groundAngle) > Math.PI / 3) {
            player.vx *= 0.5;
        }
    } else {
        player.onGround = false;
    }

    // Açısal hız
    player.angle += player.angularVelocity;
    player.angularVelocity *= 0.95;

    // Denge düzeltme
    if (player.onGround) {
        player.angularVelocity += (targetAngle - player.angle) * 0.05;
    }

    // Mesafe güncelle
    if (player.x > player.distance) {
        player.distance = Math.floor(player.x);
    }

    // Yakıt kontrolü
    if (player.fuel <= 0) {
        player.fuel = 0;
        // Yakıt bittiğinde yavaşça dur
        if (player.onGround) {
            player.vx *= 0.99;
        }
    }

    // Düşme kontrolü
    if (player.y > canvas.height + 200) {
        gameOver();
    }

    // Baş aşağı kontrolü
    if (Math.abs(player.angle) > Math.PI) {
        // Araba ters döndü
        player.angularVelocity += Math.sign(player.angle) * -0.01;
    }
}

// ===================== ÇARPIŞMA KONTROLÜ =====================

function checkCollisions() {
    const car = cars[gameState.currentCar];

    // Altın toplama
    coins.forEach(coin => {
        if (!coin.collected) {
            const dx = player.x - coin.x;
            const dy = player.y - coin.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 40) {
                coin.collected = true;
                player.coinsCollected += coin.value;
                gameState.coins += coin.value;
                createParticles(coin.x, coin.y, '#f39c12', 10);
                updateHUD();
                saveGame();
            }
        }
    });

    // Yakıt toplama
    fuels.forEach(fuel => {
        if (!fuel.collected) {
            const dx = player.x - fuel.x;
            const dy = player.y - fuel.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 40) {
                fuel.collected = true;
                player.fuel = Math.min(100, player.fuel + fuel.value);
                createParticles(fuel.x, fuel.y, '#e74c3c', 8);
                updateHUD();
            }
        }
    });

    // Engel çarpışması
    obstacles.forEach(obs => {
        const dx = player.x - obs.x;
        const dy = player.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 40) {
            // Çarpma etkisi
            player.vx *= -0.5;
            player.vy -= 5;
            player.angularVelocity += (Math.random() - 0.5) * 0.2;
            createParticles(obs.x, obs.y, '#7f8c8d', 15);
        }
    });

    // Mesafe kilometre taşları
    milestones.forEach(milestone => {
        if (player.distance >= milestone && !reachedMilestones.includes(milestone)) {
            reachedMilestones.push(milestone);
            const reward = milestone * 0.5;
            gameState.coins += reward;
            player.coinsCollected += reward;
            showMilestonePopup(milestone, reward);
            saveGame();
            updateHUD();
        }
    });
}

// ===================== PARÇACIK SİSTEMİ =====================

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 3,
            life: 1,
            color,
            size: Math.random() * 5 + 2
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life -= 0.02;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// ===================== ÇİZİM =====================

function draw() {
    const map = maps[gameState.currentMap];
    const car = cars[gameState.currentCar];

    // Arkaplan
    ctx.fillStyle = map.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Kamera pozisyonu
    camera.x = player.x - canvas.width / 3;
    camera.y = player.y - canvas.height / 2;

    // Yıldızlar (Ay haritası)
    if (gameState.currentMap === 'moon') {
        ctx.fillStyle = 'white';
        for (let i = 0; i < 100; i++) {
            const sx = (i * 137.5 + camera.x * 0.1) % canvas.width;
            const sy = (i * 89.7) % canvas.height;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Zemin çizimi
    ctx.beginPath();
    ctx.moveTo(camera.x, canvas.height);

    for (let x = camera.x; x < camera.x + canvas.width + 100; x += 10) {
        ctx.lineTo(x, getGroundY(x));
    }

    ctx.lineTo(camera.x + canvas.width + 100, canvas.height);
    ctx.closePath();
    ctx.fillStyle = map.groundColor;
    ctx.fill();

    // Zemin detayları
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Altınlar
    coins.forEach(coin => {
        if (!coin.collected && coin.x > camera.x - 50 && coin.x < camera.x + canvas.width + 50) {
            ctx.save();
            ctx.translate(coin.x, coin.y);

            // Parıltı efekti
            const glow = Math.sin(Date.now() / 200) * 5;
            ctx.shadowColor = '#f39c12';
            ctx.shadowBlur = 10 + glow;

            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#f39c12';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 1);

            ctx.restore();
        }
    });

    // Yakıt bidonları
    fuels.forEach(fuel => {
        if (!fuel.collected && fuel.x > camera.x - 50 && fuel.x < camera.x + canvas.width + 50) {
            ctx.save();
            ctx.translate(fuel.x, fuel.y);

            ctx.shadowColor = '#e74c3c';
            ctx.shadowBlur = 10;

            // Bidon gövdesi
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-12, -15, 24, 30);

            // Kapak
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(-8, -20, 16, 5);

            // Yakıt işareti
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⛽', 0, 2);

            ctx.restore();
        }
    });

    // Engeller
    obstacles.forEach(obs => {
        if (obs.x > camera.x - 50 && obs.x < camera.x + canvas.width + 50) {
            ctx.save();
            ctx.translate(obs.x, obs.y);

            if (obs.type === 'rock') {
                ctx.fillStyle = '#7f8c8d';
                ctx.beginPath();
                ctx.moveTo(-15, 0);
                ctx.lineTo(-10, -20);
                ctx.lineTo(5, -25);
                ctx.lineTo(15, -15);
                ctx.lineTo(12, 0);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#95a5a6';
                ctx.beginPath();
                ctx.arc(-5, -10, 5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Tümsek
                ctx.fillStyle = map.groundColor;
                ctx.beginPath();
                ctx.ellipse(0, -5, obs.width / 2, obs.height / 2, 0, Math.PI, 0);
                ctx.fill();
            }

            ctx.restore();
        }
    });

    // Araba çizimi
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Araba gövdesi
    const carW = car.width;
    const carH = car.height;

    ctx.fillStyle = car.color;
    ctx.fillRect(-carW / 2, -carH / 2, carW, carH);

    // Araba detayları
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-carW / 2 + 5, -carH / 2 + 5, carW - 10, carH - 10);

    // Cam
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(-carW / 4, -carH / 2 - 5, carW / 2, 8);

    // Farlar
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(carW / 2 - 5, -carH / 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(carW / 2 - 5, carH / 4, 4, 0, Math.PI * 2);
    ctx.fill();

    // Stop lambaları
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(-carW / 2 + 5, -carH / 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-carW / 2 + 5, carH / 4, 3, 0, Math.PI * 2);
    ctx.fill();

    // Tekerlekler
    if (car.wheelRadius > 0) {
        const wheelY = carH / 2 + car.wheelRadius / 2;

        // Ön tekerlek
        ctx.save();
        ctx.translate(carW / 2 - 5, wheelY);
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(0, 0, car.wheelRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.arc(0, 0, car.wheelRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Arka tekerlek
        ctx.save();
        ctx.translate(-carW / 2 + 5, wheelY);
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(0, 0, car.wheelRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.arc(0, 0, car.wheelRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    } else {
        // Hover efekti
        ctx.fillStyle = 'rgba(155, 89, 182, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, carH / 2 + 10, carW / 2, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Emoji
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(car.emoji, 0, 0);

    ctx.restore();

    // Parçacıklar
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Mesafe işaretleri
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';

    for (let m = 0; m <= player.distance + 500; m += 100) {
        if (m > camera.x - 100 && m < camera.x + canvas.width + 100) {
            const my = getGroundY(m);
            ctx.fillRect(m - 1, my - 30, 2, 30);
            ctx.fillText(m + 'm', m, my - 35);
        }
    }

    ctx.restore();
}

// ===================== OYUN DÖNGÜSÜ =====================

function gameLoop(timestamp) {
    if (!gameRunning) return;

    const dt = (timestamp - lastTime) / 16.67;
    lastTime = timestamp;

    // Nesne oluşturma (ilerledikçe)
    const spawnEnd = player.x + canvas.width + 500;
    if (coins.length === 0 || coins[coins.length - 1].x < spawnEnd) {
        const startX = coins.length > 0 ? coins[coins.length - 1].x + 50 : player.x;
        coins.push(...spawnCoins(startX, spawnEnd + 500));
    }

    if (fuels.length === 0 || fuels[fuels.length - 1].x < spawnEnd) {
        const startX = fuels.length > 0 ? fuels[fuels.length - 1].x + 100 : player.x;
        fuels.push(...spawnFuels(startX, spawnEnd + 500));
    }

    if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < spawnEnd) {
        const startX = obstacles.length > 0 ? obstacles[obstacles.length - 1].x + 80 : player.x + 200;
        obstacles.push(...spawnObstacles(startX, spawnEnd + 500));
    }

    // Temizlik (geride kalanları sil)
    coins = coins.filter(c => c.x > player.x - 500);
    fuels = fuels.filter(f => f.x > player.x - 500);
    obstacles = obstacles.filter(o => o.x > player.x - 500);

    updatePhysics(dt);
    checkCollisions();
    updateParticles();
    draw();
    updateHUD();

    animationId = requestAnimationFrame(gameLoop);
}

// ===================== HUD GÜNCELLEME =====================

function updateHUD() {
    document.getElementById('coin-count').textContent = player.coinsCollected;
    document.getElementById('distance').textContent = player.distance;
    document.getElementById('fuel').textContent = Math.floor(player.fuel);
    document.getElementById('current-gear').textContent = player.gear;
    document.getElementById('clutch-status').textContent = player.clutchPressed ? 'Basılı' : 'Bırakıldı';
    document.getElementById('clutch-status').style.color = player.clutchPressed ? '#e74c3c' : '#27ae60';

    // Yakıt rengi
    const fuelDisplay = document.getElementById('fuel-display');
    if (player.fuel < 20) {
        fuelDisplay.style.color = '#e74c3c';
    } else if (player.fuel < 50) {
        fuelDisplay.style.color = '#f39c12';
    } else {
        fuelDisplay.style.color = '#27ae60';
    }
}

// ===================== OYUN DURUMLARI =====================

function startGame() {
    gameRunning = true;
    lastTime = performance.now();

    // Oyuncuyu sıfırla
    player = {
        x: 100,
        y: getGroundY(100) - 100,
        vx: 0,
        vy: 0,
        angle: 0,
        angularVelocity: 0,
        fuel: cars[gameState.currentCar].fuelCapacity,
        gear: 1,
        maxGear: 5,
        clutchPressed: false,
        distance: 0,
        coinsCollected: 0,
        onGround: false
    };

    coins = [];
    fuels = [];
    obstacles = [];
    particles = [];
    reachedMilestones = [];

    // İlk nesneleri oluştur
    coins = spawnCoins(200, 1000);
    fuels = spawnFuels(300, 1000);
    obstacles = spawnObstacles(500, 1000);

    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('game-over').classList.add('hidden');

    updateHUD();
    animationId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationId);

    // İstatistikler
    const car = cars[gameState.currentCar];
    const map = maps[gameState.currentMap];

    let bonusCoins = 0;
    milestones.forEach(m => {
        if (player.distance >= m) {
            bonusCoins += m * 0.5;
        }
    });

    // Mesafe bonusu
    bonusCoins += Math.floor(player.distance * 0.1);

    gameState.coins += bonusCoins;
    gameState.totalDistance += player.distance;
    saveGame();

    document.getElementById('final-distance').textContent = player.distance;
    document.getElementById('final-coins').textContent = player.coinsCollected;
    document.getElementById('bonus-coins').textContent = bonusCoins;

    document.getElementById('hud').classList.add('hidden');
    document.getElementById('game-over').classList.remove('hidden');
}

function showMilestonePopup(distance, reward) {
    const popup = document.getElementById('milestone-popup');
    document.getElementById('milestone-distance').textContent = distance;
    document.getElementById('milestone-reward').textContent = reward;
    popup.classList.remove('hidden');

    setTimeout(() => {
        popup.classList.add('hidden');
    }, 2000);
}

// ===================== MENÜ SİSTEMİ =====================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('hud').classList.add('hidden');
    document.getElementById(screenId).classList.remove('hidden');
}

function showMainMenu() {
    document.getElementById('menu-coin-count').textContent = gameState.coins;
    showScreen('main-menu');
}

function initGarage() {
    const list = document.getElementById('car-list');
    list.innerHTML = '';

    Object.keys(cars).forEach(carId => {
        const car = cars[carId];
        const owned = gameState.ownedCars.includes(carId);
        const selected = gameState.currentCar === carId;

        const card = document.createElement('div');
        card.className = `car-card ${!owned ? 'locked' : ''} ${selected ? 'selected' : ''}`;
        card.innerHTML = `
            <div class="car-preview">${car.emoji}</div>
            <h3>${car.name}</h3>
            <p>Hız: ${car.maxSpeed}</p>
            <p>Güç: ${Math.floor(car.power * 100)}%</p>
            <p>Yakıt: ${car.fuelCapacity}</p>
            ${!owned ? `<div class="car-price">${car.price} 🪙</div>` : '<div style="color:#27ae60">Sahipsin</div>'}
        `;

        card.addEventListener('click', () => {
            if (owned) {
                gameState.currentCar = carId;
                saveGame();
                initGarage();
            } else if (gameState.coins >= car.price) {
                gameState.coins -= car.price;
                gameState.ownedCars.push(carId);
                gameState.currentCar = carId;
                saveGame();
                initGarage();
                document.getElementById('menu-coin-count').textContent = gameState.coins;
            }
        });

        list.appendChild(card);
    });
}

function initMaps() {
    const list = document.getElementById('map-list');
    list.innerHTML = '';

    Object.keys(maps).forEach(mapId => {
        const map = maps[mapId];
        const owned = gameState.ownedMaps.includes(mapId);
        const selected = gameState.currentMap === mapId;

        const card = document.createElement('div');
        card.className = `map-card ${!owned ? 'locked' : ''} ${selected ? 'selected' : ''}`;
        card.innerHTML = `
            <div style="font-size:3rem">${map.emoji}</div>
            <h3>${map.name}</h3>
            <p>Zorluk: ${map.hillHeight > 100 ? 'Zor' : map.hillHeight > 80 ? 'Orta' : 'Kolay'}</p>
            ${!owned ? `<div class="map-price">${map.price} 🪙</div>` : '<div style="color:#27ae60">Sahipsin</div>'}
        `;

        card.addEventListener('click', () => {
            if (owned) {
                gameState.currentMap = mapId;
                saveGame();
                initMaps();
            } else if (gameState.coins >= map.price) {
                gameState.coins -= map.price;
                gameState.ownedMaps.push(mapId);
                gameState.currentMap = mapId;
                saveGame();
                initMaps();
                document.getElementById('menu-coin-count').textContent = gameState.coins;
            }
        });

        list.appendChild(card);
    });
}

function initSettings() {
    document.getElementById('volume').value = gameState.settings.volume;
    document.getElementById('music-toggle').checked = gameState.settings.music;
    document.getElementById('difficulty').value = gameState.settings.difficulty;
}

// ===================== KAYDETME =====================

function saveGame() {
    localStorage.setItem('aliza_coins', gameState.coins);
    localStorage.setItem('aliza_distance', gameState.totalDistance);
    localStorage.setItem('aliza_cars', JSON.stringify(gameState.ownedCars));
    localStorage.setItem('aliza_maps', JSON.stringify(gameState.ownedMaps));
    localStorage.setItem('aliza_currentCar', gameState.currentCar);
    localStorage.setItem('aliza_currentMap', gameState.currentMap);
    localStorage.setItem('aliza_settings', JSON.stringify(gameState.settings));
}

// ===================== OLAY DİNLEYİCİLERİ =====================

// Gaz
const gasBtn = document.getElementById('gas-btn');
gasBtn.addEventListener('mousedown', () => input.gas = true);
gasBtn.addEventListener('mouseup', () => input.gas = false);
gasBtn.addEventListener('mouseleave', () => input.gas = false);
gasBtn.addEventListener('touchstart', (e) => { e.preventDefault(); input.gas = true; });
gasBtn.addEventListener('touchend', (e) => { e.preventDefault(); input.gas = false; });

// Fren
const brakeBtn = document.getElementById('brake-btn');
brakeBtn.addEventListener('mousedown', () => input.brake = true);
brakeBtn.addEventListener('mouseup', () => input.brake = false);
brakeBtn.addEventListener('mouseleave', () => input.brake = false);
brakeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); input.brake = true; });
brakeBtn.addEventListener('touchend', (e) => { e.preventDefault(); input.brake = false; });

// Debriyaj
const clutchBtn = document.getElementById('clutch-btn');
clutchBtn.addEventListener('mousedown', () => {
    player.clutchPressed = true;
    clutchBtn.classList.add('active');
});
clutchBtn.addEventListener('mouseup', () => {
    player.clutchPressed = false;
    clutchBtn.classList.remove('active');
});
clutchBtn.addEventListener('mouseleave', () => {
    player.clutchPressed = false;
    clutchBtn.classList.remove('active');
});
clutchBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    player.clutchPressed = true;
    clutchBtn.classList.add('active');
});
clutchBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    player.clutchPressed = false;
    clutchBtn.classList.remove('active');
});

// Vites yükselt
const gearUpBtn = document.getElementById('gear-up-btn');
gearUpBtn.addEventListener('click', () => {
    if (player.gear < player.maxGear) {
        if (player.clutchPressed) {
            player.gear++;
            updateHUD();
        }
    }
});

// Vites düşür
const gearDownBtn = document.getElementById('gear-down-btn');
gearDownBtn.addEventListener('click', () => {
    if (player.gear > 1) {
        if (player.clutchPressed) {
            player.gear--;
            updateHUD();
        }
    }
});

// Klavye kontrolleri
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowRight':
        case 'd':
        case 'D':
            input.gas = true;
            gasBtn.classList.add('active');
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            input.brake = true;
            brakeBtn.classList.add('active');
            break;
        case 'Shift':
        case 'c':
        case 'C':
            player.clutchPressed = true;
            clutchBtn.classList.add('active');
            break;
        case 'w':
        case 'W':
        case 'ArrowUp':
            if (player.clutchPressed && player.gear < player.maxGear) {
                player.gear++;
                updateHUD();
            }
            break;
        case 's':
        case 'S':
        case 'ArrowDown':
            if (player.clutchPressed && player.gear > 1) {
                player.gear--;
                updateHUD();
            }
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'ArrowRight':
        case 'd':
        case 'D':
            input.gas = false;
            gasBtn.classList.remove('active');
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            input.brake = false;
            brakeBtn.classList.remove('active');
            break;
        case 'Shift':
        case 'c':
        case 'C':
            player.clutchPressed = false;
            clutchBtn.classList.remove('active');
            break;
    }
});

// Menü butonları
document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('menu-btn').addEventListener('click', showMainMenu);

document.getElementById('garage-btn').addEventListener('click', () => {
    initGarage();
    showScreen('garage-screen');
});

document.getElementById('maps-btn').addEventListener('click', () => {
    initMaps();
    showScreen('maps-screen');
});

document.getElementById('settings-btn').addEventListener('click', () => {
    initSettings();
    showScreen('settings-screen');
});

document.getElementById('back-from-garage').addEventListener('click', showMainMenu);
document.getElementById('back-from-maps').addEventListener('click', showMainMenu);
document.getElementById('back-from-settings').addEventListener('click', () => {
    gameState.settings.volume = parseInt(document.getElementById('volume').value);
    gameState.settings.music = document.getElementById('music-toggle').checked;
    gameState.settings.difficulty = document.getElementById('difficulty').value;
    saveGame();
    showMainMenu();
});

// ===================== BAŞLATMA =====================

showMainMenu();
