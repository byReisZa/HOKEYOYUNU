// Araba Simülatörü - app.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Ekran boyutları
let width, height;
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Oyun durumu
const game = {
    car: {
        x: 0,
        y: 0,
        angle: 0,
        speed: 0,
        maxSpeed: 280,
        acceleration: 0,
        steering: 0,
        gear: 0, // 0: N, 1-5: vitesler, -1: R
        rpm: 0,
        maxRpm: 8000,
        wheelAngle: 0,
        drift: 0
    },
    camera: {
        x: 0,
        y: 0
    },
    road: {
        points: [],
        width: 120,
        totalLength: 20000,
        segmentLength: 50
    },
    keys: {},
    particles: [],
    skidMarks: [],
    time: 0
};

// Yol noktalarını oluştur (kıvrımlı virajlar)
function generateRoad() {
    game.road.points = [];
    const segments = game.road.totalLength / game.road.segmentLength;

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const distance = i * game.road.segmentLength;

        // Kıvrımlı yol formülü - sinüs dalgaları ile virajlar
        const baseCurve = Math.sin(t * Math.PI * 8) * 300;
        const sharpCurve = Math.sin(t * Math.PI * 3) * 150;
        const microCurve = Math.sin(t * Math.PI * 20) * 50;

        const x = baseCurve + sharpCurve + microCurve;
        const y = distance;

        game.road.points.push({ x, y });
    }
}

generateRoad();

// Yol eğimini hesapla
function getRoadCurve(index) {
    if (index < 0 || index >= game.road.points.length - 1) return 0;
    const p1 = game.road.points[index];
    const p2 = game.road.points[index + 1];
    return Math.atan2(p2.x - p1.x, p2.y - p1.y);
}

// Arabanın yoldaki pozisyonunu bul
function getCarRoadIndex() {
    const carY = game.car.y;
    return Math.floor(carY / game.road.segmentLength);
}

// Yol kenarını hesapla
function getRoadEdge(y, side) {
    const index = Math.floor(y / game.road.segmentLength);
    if (index < 0 || index >= game.road.points.length) return { x: side * game.road.width, y };

    const point = game.road.points[index];
    const nextPoint = game.road.points[Math.min(index + 1, game.road.points.length - 1)];
    const angle = Math.atan2(nextPoint.x - point.x, nextPoint.y - point.y);

    const perpX = Math.sin(angle) * side * (game.road.width / 2);
    const perpY = Math.cos(angle) * side * (game.road.width / 2);

    const frac = (y % game.road.segmentLength) / game.road.segmentLength;
    const interpX = point.x + (nextPoint.x - point.x) * frac;

    return {
        x: interpX + perpX,
        y: y + perpY
    };
}

// Yol merkezini hesapla
function getRoadCenter(y) {
    const index = Math.floor(y / game.road.segmentLength);
    if (index < 0 || index >= game.road.points.length) return { x: 0, y };

    const point = game.road.points[index];
    const nextPoint = game.road.points[Math.min(index + 1, game.road.points.length - 1)];
    const frac = (y % game.road.segmentLength) / game.road.segmentLength;

    return {
        x: point.x + (nextPoint.x - point.x) * frac,
        y: y
    };
}

// Klavye kontrolleri
window.addEventListener('keydown', (e) => {
    game.keys[e.code] = true;

    // Vites değiştirme
    if (e.code === 'KeyQ') {
        if (game.car.gear < 5) game.car.gear++;
    }
    if (e.code === 'KeyE') {
        if (game.car.gear > -1) game.car.gear--;
    }
});

window.addEventListener('keyup', (e) => {
    game.keys[e.code] = false;
});

// Vites oranları
const gearRatios = {
    '-1': -3.5,  // R
    '0': 0,      // N
    '1': 3.5,
    '2': 2.1,
    '3': 1.4,
    '4': 1.0,
    '5': 0.75
};

// Fizik güncelleme
function updatePhysics(dt) {
    const car = game.car;

    // Gaz ve fren
    let throttle = 0;
    let brake = 0;

    if (game.keys['KeyW'] || game.keys['ArrowUp']) throttle = 1;
    if (game.keys['KeyS'] || game.keys['ArrowDown']) brake = 1;

    // Direksiyon
    let steerInput = 0;
    if (game.keys['KeyA'] || game.keys['ArrowLeft']) steerInput = -1;
    if (game.keys['KeyD'] || game.keys['ArrowRight']) steerInput = 1;

    // El freni
    const handbrake = game.keys['Space'];

    // Direksiyon açısı
    const maxSteer = 0.6;
    const steerSpeed = 3;
    car.wheelAngle += (steerInput * maxSteer - car.wheelAngle) * steerSpeed * dt;

    // Hız hesaplama
    const gearRatio = gearRatios[car.gear] || 0;
    const enginePower = 800;
    const dragCoeff = 0.003;
    const rollingResistance = 0.001;

    if (car.gear !== 0) {
        const engineForce = throttle * enginePower * gearRatio;
        const dragForce = -Math.sign(car.speed) * car.speed * car.speed * dragCoeff;
        const rollForce = -Math.sign(car.speed) * Math.abs(car.speed) * rollingResistance * 100;
        const brakeForce = brake ? -Math.sign(car.speed) * 2000 : 0;
        const handbrakeForce = handbrake ? -Math.sign(car.speed) * 1500 : 0;

        const totalForce = engineForce + dragForce + rollForce + brakeForce + handbrakeForce;
        car.acceleration = totalForce / 1000;
        car.speed += car.acceleration * dt;
    } else {
        // N vites - sadece sürtünme
        car.speed *= 0.99;
    }

    // Geri viteste hız sınırı
    if (car.gear === -1 && car.speed < -40) car.speed = -40;

    // RPM hesaplama
    const wheelRpm = Math.abs(car.speed) * 30;
    car.rpm = wheelRpm * Math.abs(gearRatio) + 800;
    if (car.rpm > car.maxRpm) car.rpm = car.maxRpm;
    if (car.gear === 0) car.rpm = 800 + throttle * 3000;

    // Yön değiştirme
    const speedFactor = Math.min(Math.abs(car.speed) / 100, 1);
    const turnRate = car.wheelAngle * speedFactor * 2.5;

    // Drift efekti
    if (handbrake && Math.abs(car.speed) > 30) {
        car.drift += (car.wheelAngle * 2 - car.drift) * 5 * dt;
    } else {
        car.drift *= 0.95;
    }

    car.angle += turnRate * dt + car.drift * dt;

    // Pozisyon güncelleme
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.y += Math.cos(car.angle) * car.speed * dt;

    // Yol sınırları kontrolü
    const roadCenter = getRoadCenter(car.y);
    const distFromCenter = car.x - roadCenter.x;
    const roadHalfWidth = game.road.width / 2 - 15;

    if (Math.abs(distFromCenter) > roadHalfWidth) {
        // Çimen üzerinde sürtünme
        car.speed *= 0.95;

        // Yola geri it
        if (distFromCenter > roadHalfWidth) {
            car.x = roadCenter.x + roadHalfWidth;
        } else {
            car.x = roadCenter.x - roadHalfWidth;
        }
    }

    // Kamera takibi
    game.camera.x += (car.x - game.camera.x) * 5 * dt;
    game.camera.y = car.y - height * 0.6;

    // Partiküller (toz, duman)
    if (Math.abs(car.speed) > 10 && (handbrake || Math.abs(car.drift) > 0.3)) {
        for (let i = 0; i < 2; i++) {
            game.particles.push({
                x: car.x + (Math.random() - 0.5) * 20,
                y: car.y - 15,
                vx: (Math.random() - 0.5) * 30,
                vy: (Math.random() - 0.5) * 30,
                life: 1,
                size: Math.random() * 5 + 2,
                color: handbrake ? 'rgba(100,100,100,' : 'rgba(150,150,150,'
            });
        }
    }

    // Kayma izleri
    if (handbrake && Math.abs(car.speed) > 20) {
        game.skidMarks.push({
            x: car.x + Math.sin(car.angle + 0.3) * 12,
            y: car.y + Math.cos(car.angle + 0.3) * 12,
            angle: car.angle,
            life: 300
        });
        game.skidMarks.push({
            x: car.x + Math.sin(car.angle - 0.3) * 12,
            y: car.y + Math.cos(car.angle - 0.3) * 12,
            angle: car.angle,
            life: 300
        });
    }

    // Partikül güncelleme
    game.particles = game.particles.filter(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 2;
        p.size *= 0.98;
        return p.life > 0;
    });

    // Kayma izleri güncelleme
    game.skidMarks = game.skidMarks.filter(s => {
        s.life--;
        return s.life > 0;
    });

    game.time += dt;
}

// Araba çizimi
function drawCar(ctx, x, y, angle, wheelAngle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const carWidth = 24;
    const carLength = 48;

    // Gövde gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-carWidth/2 + 3, -carLength/2 + 3, carWidth, carLength);

    // Ana gövde
    const gradient = ctx.createLinearGradient(-carWidth/2, 0, carWidth/2, 0);
    gradient.addColorStop(0, '#cc0000');
    gradient.addColorStop(0.3, '#ff3333');
    gradient.addColorStop(0.7, '#ff3333');
    gradient.addColorStop(1, '#990000');
    ctx.fillStyle = gradient;

    // Üst gövde (kabin)
    ctx.beginPath();
    ctx.moveTo(-carWidth/2 + 2, -carLength/2 + 8);
    ctx.lineTo(-carWidth/2 + 2, carLength/2 - 5);
    ctx.quadraticCurveTo(-carWidth/2 + 2, carLength/2, 0, carLength/2);
    ctx.quadraticCurveTo(carWidth/2 - 2, carLength/2, carWidth/2 - 2, carLength/2 - 5);
    ctx.lineTo(carWidth/2 - 2, -carLength/2 + 8);
    ctx.quadraticCurveTo(carWidth/2 - 2, -carLength/2, 0, -carLength/2);
    ctx.quadraticCurveTo(-carWidth/2 + 2, -carLength/2, -carWidth/2 + 2, -carLength/2 + 8);
    ctx.fill();

    // Cam
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(-carWidth/2 + 4, -carLength/2 + 12);
    ctx.lineTo(-carWidth/2 + 4, 5);
    ctx.lineTo(carWidth/2 - 4, 5);
    ctx.lineTo(carWidth/2 - 4, -carLength/2 + 12);
    ctx.fill();

    // Cam yansıması
    ctx.fillStyle = 'rgba(100,150,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(-carWidth/2 + 6, -carLength/2 + 14);
    ctx.lineTo(-carWidth/2 + 6, -2);
    ctx.lineTo(-2, -2);
    ctx.lineTo(-2, -carLength/2 + 14);
    ctx.fill();

    // Farlar
    ctx.fillStyle = '#ffffcc';
    ctx.shadowColor = '#ffffaa';
    ctx.shadowBlur = 10;
    ctx.fillRect(-carWidth/2 + 3, -carLength/2 + 2, 6, 4);
    ctx.fillRect(carWidth/2 - 9, -carLength/2 + 2, 6, 4);
    ctx.shadowBlur = 0;

    // Stop lambaları
    ctx.fillStyle = '#ff0000';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 8;
    ctx.fillRect(-carWidth/2 + 3, carLength/2 - 5, 6, 4);
    ctx.fillRect(carWidth/2 - 9, carLength/2 - 5, 6, 4);
    ctx.shadowBlur = 0;

    // Kapı çizgileri
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-carWidth/2 + 2, -5);
    ctx.lineTo(carWidth/2 - 2, -5);
    ctx.stroke();

    // Kapı kolları
    ctx.fillStyle = '#888';
    ctx.fillRect(-carWidth/2 + 1, -8, 4, 2);
    ctx.fillRect(carWidth/2 - 5, -8, 4, 2);

    // Tekerlekler
    const wheelWidth = 6;
    const wheelLength = 12;
    const wheelPositions = [
        { x: -carWidth/2 - 2, y: -carLength/2 + 10 }, // Sol ön
        { x: carWidth/2 + 2, y: -carLength/2 + 10 },  // Sağ ön
        { x: -carWidth/2 - 2, y: carLength/2 - 10 },  // Sol arka
        { x: carWidth/2 + 2, y: carLength/2 - 10 }    // Sağ arka
    ];

    wheelPositions.forEach((pos, i) => {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        // Ön tekerlekler döner
        if (i < 2) ctx.rotate(wheelAngle * 0.5);

        // Lastik
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-wheelWidth/2, -wheelLength/2, wheelWidth, wheelLength);

        // Jant
        ctx.fillStyle = '#888';
        ctx.fillRect(-wheelWidth/2 + 1, -wheelLength/2 + 2, wheelWidth - 2, wheelLength - 4);

        // Jant detayı
        ctx.fillStyle = '#aaa';
        ctx.fillRect(-1, -wheelLength/2 + 4, 2, wheelLength - 8);

        ctx.restore();
    });

    // Spoiler
    ctx.fillStyle = '#990000';
    ctx.fillRect(-carWidth/2, carLength/2 - 2, carWidth, 3);
    ctx.fillRect(-carWidth/2 - 2, carLength/2 - 6, 4, 6);
    ctx.fillRect(carWidth/2 - 2, carLength/2 - 6, 4, 6);

    ctx.restore();
}

// Yol çizimi
function drawRoad(ctx) {
    const startIndex = Math.max(0, Math.floor(game.camera.y / game.road.segmentLength) - 5);
    const endIndex = Math.min(game.road.points.length - 1, startIndex + 40);

    // Çimen arka plan
    ctx.fillStyle = '#2d5016';
    ctx.fillRect(0, 0, width, height);

    // Çimen dokusu
    ctx.fillStyle = '#3a6b1a';
    for (let i = 0; i < 50; i++) {
        const px = (i * 137 + game.time * 10) % width;
        const py = (i * 89) % height;
        ctx.fillRect(px, py, 3, 3);
    }

    // Yol kenarları
    ctx.fillStyle = '#555';
    ctx.beginPath();

    for (let i = startIndex; i <= endIndex; i++) {
        const point = game.road.points[i];
        const screenX = point.x - game.camera.x + width / 2;
        const screenY = point.y - game.camera.y;

        if (i === startIndex) {
            ctx.moveTo(screenX - game.road.width/2 - 10, screenY);
        } else {
            ctx.lineTo(screenX - game.road.width/2 - 10, screenY);
        }
    }

    for (let i = endIndex; i >= startIndex; i--) {
        const point = game.road.points[i];
        const screenX = point.x - game.camera.x + width / 2;
        const screenY = point.y - game.camera.y;
        ctx.lineTo(screenX + game.road.width/2 + 10, screenY);
    }

    ctx.closePath();
    ctx.fill();

    // Asfalt
    ctx.fillStyle = '#444';
    ctx.beginPath();

    for (let i = startIndex; i <= endIndex; i++) {
        const point = game.road.points[i];
        const screenX = point.x - game.camera.x + width / 2;
        const screenY = point.y - game.camera.y;

        if (i === startIndex) {
            ctx.moveTo(screenX - game.road.width/2, screenY);
        } else {
            ctx.lineTo(screenX - game.road.width/2, screenY);
        }
    }

    for (let i = endIndex; i >= startIndex; i--) {
        const point = game.road.points[i];
        const screenX = point.x - game.camera.x + width / 2;
        const screenY = point.y - game.camera.y;
        ctx.lineTo(screenX + game.road.width/2, screenY);
    }

    ctx.closePath();
    ctx.fill();

    // Yol çizgileri
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();

    for (let i = startIndex; i <= endIndex; i++) {
        const point = game.road.points[i];
        const screenX = point.x - game.camera.x + width / 2;
        const screenY = point.y - game.camera.y;

        if (i === startIndex) {
            ctx.moveTo(screenX, screenY);
        } else {
            ctx.lineTo(screenX, screenY);
        }
    }

    ctx.stroke();
    ctx.setLineDash([]);

    // Kenar çizgileri
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 3;

    // Sol kenar
    ctx.beginPath();
    for (let i = startIndex; i <= endIndex; i++) {
        const point = game.road.points[i];
        const screenX = point.x - game.camera.x + width / 2 - game.road.width/2;
        const screenY = point.y - game.camera.y;
        if (i === startIndex) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
    }
    ctx.stroke();

    // Sağ kenar
    ctx.beginPath();
    for (let i = startIndex; i <= endIndex; i++) {
        const point = game.road.points[i];
        const screenX = point.x - game.camera.x + width / 2 + game.road.width/2;
        const screenY = point.y - game.camera.y;
        if (i === startIndex) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
    }
    ctx.stroke();

    // Ağaçlar ve çevre detayları
    for (let i = startIndex; i <= endIndex; i += 3) {
        const point = game.road.points[i];
        const screenX = point.x - game.camera.x + width / 2;
        const screenY = point.y - game.camera.y;

        // Sol taraf ağaçlar
        drawTree(ctx, screenX - game.road.width/2 - 40, screenY);
        // Sağ taraf ağaçlar
        drawTree(ctx, screenX + game.road.width/2 + 40, screenY);
    }
}

function drawTree(ctx, x, y) {
    // Gövde
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(x - 3, y - 10, 6, 15);

    // Yapraklar
    ctx.fillStyle = '#1a5c1a';
    ctx.beginPath();
    ctx.moveTo(x, y - 35);
    ctx.lineTo(x - 15, y - 10);
    ctx.lineTo(x + 15, y - 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2d7a2d';
    ctx.beginPath();
    ctx.moveTo(x, y - 45);
    ctx.lineTo(x - 12, y - 20);
    ctx.lineTo(x + 12, y - 20);
    ctx.closePath();
    ctx.fill();
}

// Kayma izleri çizimi
function drawSkidMarks(ctx) {
    game.skidMarks.forEach(mark => {
        const alpha = mark.life / 300;
        ctx.strokeStyle = `rgba(20,20,20,${alpha * 0.6})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(
            mark.x - Math.sin(mark.angle) * 5 - game.camera.x + width / 2,
            mark.y - Math.cos(mark.angle) * 5 - game.camera.y
        );
        ctx.lineTo(
            mark.x + Math.sin(mark.angle) * 5 - game.camera.x + width / 2,
            mark.y + Math.cos(mark.angle) * 5 - game.camera.y
        );
        ctx.stroke();
    });
}

// Partiküller çizimi
function drawParticles(ctx) {
    game.particles.forEach(p => {
        ctx.fillStyle = p.color + p.life + ')';
        ctx.beginPath();
        ctx.arc(
            p.x - game.camera.x + width / 2,
            p.y - game.camera.y,
            p.size,
            0,
            Math.PI * 2
        );
        ctx.fill();
    });
}

// HUD güncelleme
function updateHUD() {
    const car = game.car;

    // Hız göstergesi
    const speedElement = document.getElementById('speedDisplay');
    const needleElement = document.getElementById('needle');
    const speed = Math.abs(Math.round(car.speed));
    speedElement.textContent = speed;

    // İbre açısı (-135 derece = 0, 135 derece = max)
    const maxSpeedDisplay = 280;
    const angle = -135 + (speed / maxSpeedDisplay) * 270;
    needleElement.style.transform = `translateX(-50%) rotate(${angle}deg)`;

    // Vites göstergesi
    const gearElement = document.getElementById('gearDisplay');
    const gearNames = { '-1': 'R', '0': 'N', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' };
    gearElement.textContent = gearNames[car.gear] || 'N';

    // RPM bar
    const rpmBar = document.getElementById('rpmBar');
    const rpmPercent = (car.rpm / car.maxRpm) * 100;
    rpmBar.style.height = rpmPercent + '%';

    // RPM rengi
    if (rpmPercent > 80) {
        rpmBar.style.background = 'linear-gradient(to top, #ff3333, #ff0000)';
    } else if (rpmPercent > 60) {
        rpmBar.style.background = 'linear-gradient(to top, #ffff00, #ffaa00)';
    } else {
        rpmBar.style.background = 'linear-gradient(to top, #00ff88, #88ff00)';
    }
}

// Ana oyun döngüsü
let lastTime = 0;
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    updatePhysics(dt);

    // Çizim
    ctx.clearRect(0, 0, width, height);

    drawRoad(ctx);
    drawSkidMarks(ctx);
    drawParticles(ctx);

    // Araba çizimi
    const carScreenX = game.car.x - game.camera.x + width / 2;
    const carScreenY = game.car.y - game.camera.y;
    drawCar(ctx, carScreenX, carScreenY, game.car.angle, game.car.wheelAngle);

    // Far ışınları (gece efekti)
    if (game.keys['KeyF']) {
        ctx.save();
        ctx.translate(carScreenX, carScreenY);
        ctx.rotate(game.car.angle);

        const lightGradient = ctx.createLinearGradient(0, -20, 0, -200);
        lightGradient.addColorStop(0, 'rgba(255,255,200,0.4)');
        lightGradient.addColorStop(1, 'rgba(255,255,200,0)');

        ctx.fillStyle = lightGradient;
        ctx.beginPath();
        ctx.moveTo(-8, -20);
        ctx.lineTo(-30, -200);
        ctx.lineTo(30, -200);
        ctx.lineTo(8, -20);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    updateHUD();

    requestAnimationFrame(gameLoop);
}

// Başlat
requestAnimationFrame(gameLoop);
