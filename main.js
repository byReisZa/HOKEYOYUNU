/*
 * 3D ARABA OYUNU - Ana Script
 * Professional Racing Game Engine
 * Türkçe Dil Desteği
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Physics
    maxSpeed: 200,
    acceleration: 0.8,
    brakeForce: 1.2,
    friction: 0.95,
    driftFriction: 0.85,
    maxSteerAngle: 0.5,
    
    // Gameplay
    maxFuel: 100,
    fuelConsumption: 0.01,
    nitroMaxCharge: 100,
    nitroUseRate: 2,
    nitroRechargeRate: 0.5,
    nitroBoost: 100,
    
    // Graphics
    shadowMapSize: 2048,
    fogDistance: 1000,
    
    // Audio Volumes
    masterVolume: 1.0
};

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

let scene, camera, renderer;
let car, ground, cityObjects = [];
let gameState = {
    isPaused: false,
    cameraMode: 'third-person', // third-person, first-person, hood
    speed: 0,
    rpm: 0,
    gear: 'P',
    fuel: CONFIG.maxFuel,
    nitro: CONFIG.nitroMaxCharge,
    isEngineRunning: false,
    lastFrameTime: Date.now(),
    frameCount: 0,
    fps: 60,
    graphicsQuality: 'medium',
    enableShadows: true,
    enableBloom: true,
    masterVolume: 1.0
};

let inputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
    nitro: false,
    camera: false
};

// ============================================================================
// INITIALIZATION
// ============================================================================

window.addEventListener('load', async () => {
    // Simulate loading progress
    const loadingBar = document.getElementById('loadingBar');
    const loadingText = document.getElementById('loadingText');
    
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 30, 90);
        loadingBar.style.width = progress + '%';
    }, 100);
    
    try {
        loadingText.textContent = 'Sahne hazırlanıyor...';
        await initScene();
        
        loadingText.textContent = 'Araba oluşturuluyor...';
        createCar();
        
        loadingText.textContent = 'Şehir inşa ediliyor...';
        buildCity();
        
        loadingText.textContent = 'Trafik ekleniyor...';
        createTraffic();
        
        loadingText.textContent = 'Ses sistemi yükleniyor...';
        initAudio();
        
        progress = 100;
        loadingBar.style.width = '100%';
        loadingText.textContent = 'Tamamlandı!';
        
        clearInterval(progressInterval);
        
        setTimeout(() => {
            document.getElementById('loadingScreen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loadingScreen').style.display = 'none';
                startGame();
            }, 500);
        }, 500);
    } catch (error) {
        console.error('Yükleme hatası:', error);
        loadingText.textContent = 'Hata: ' + error.message;
    }
});

// ============================================================================
// SCENE INITIALIZATION
// ============================================================================

async function initScene() {
    // Canvas
    const canvas = document.getElementById('gameCanvas');
    
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87ceeb, CONFIG.fogDistance, CONFIG.fogDistance * 2);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(100, 100, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = CONFIG.shadowMapSize;
    sunLight.shadow.mapSize.height = CONFIG.shadowMapSize;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -250;
    sunLight.shadow.camera.right = 250;
    sunLight.shadow.camera.top = 250;
    sunLight.shadow.camera.bottom = -250;
    scene.add(sunLight);
    
    // Night light enhancement
    const nightLight = new THREE.PointLight(0xff6600, 0.5, 200);
    nightLight.position.set(50, 80, 50);
    scene.add(nightLight);
    
    // Camera
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, precision: 'highp' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = gameState.enableShadows;
    renderer.shadowMap.type = THREE.PCFShadowShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    
    // Sky
    const skyGeometry = new THREE.SphereGeometry(3000, 32, 32);
    const skyMaterial = new THREE.MeshBasicMaterial({
        color: 0x87ceeb,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
    
    // Ground
    createGround();
    
    // Input events
    setupInputEvents();
    
    // Window resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Animation loop
    animate();
}

function createGround() {
    const groundSize = 500;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x2a4a2a });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
}

// ============================================================================
// CAR CREATION
// ============================================================================

function createCar() {
    car = {
        // Physics
        position: { x: 0, y: 1, z: -50 },
        rotation: 0,
        velocity: 0,
        angularVelocity: 0,
        acceleration: 0,
        steering: 0,
        targetSteering: 0,
        isDrifting: false,
        driftAngle: 0,
        suspensionBounce: 0,
        
        // Engine
        engineRPM: 0,
        gear: 0, // 0=P, 1-6=gears, -1=R
        maxGear: 6,
        throttle: 0,
        isBraking: false,
        
        // Visual
        body: null,
        wheels: [],
        lights: {},
        smokeEmitters: [],
        
        // Misc
        health: 100,
        hasCollided: false
    };
    
    // Create car body
    const bodyGeometry = new THREE.BoxGeometry(2, 1.2, 4.5);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.7,
        roughness: 0.2,
        emissive: 0x000000
    });
    car.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    car.body.castShadow = true;
    car.body.receiveShadow = true;
    car.body.position.set(car.position.x, car.position.y, car.position.z);
    scene.add(car.body);
    
    // Create wheels
    const wheelPositions = [
        { x: -0.8, y: 0.3, z: 1.2 },   // Front left
        { x: 0.8, y: 0.3, z: 1.2 },    // Front right
        { x: -0.8, y: 0.3, z: -1.2 },  // Rear left
        { x: 0.8, y: 0.3, z: -1.2 }    // Rear right
    ];
    
    wheelPositions.forEach((pos, index) => {
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.6,
            roughness: 0.5
        });
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.copy(pos);
        wheel.castShadow = true;
        wheel.receiveShadow = true;
        car.body.add(wheel);
        car.wheels.push({
            mesh: wheel,
            rotation: 0,
            isSteer: index < 2
        });
    });
    
    // Windows
    const windowGeometry = new THREE.BoxGeometry(1.8, 0.6, 1.2);
    const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0x4488ff,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.3
    });
    const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
    window1.position.set(0, 0.8, 0.3);
    car.body.add(window1);
    
    // Headlights
    const headlightLeft = new THREE.PointLight(0xffff00, 0.8, 50);
    headlightLeft.position.set(-0.7, 0.5, 2.2);
    car.body.add(headlightLeft);
    
    const headlightRight = new THREE.PointLight(0xffff00, 0.8, 50);
    headlightRight.position.set(0.7, 0.5, 2.2);
    car.body.add(headlightRight);
    
    car.lights.headlights = [headlightLeft, headlightRight];
    
    // Brake lights
    const brakeLight = new THREE.PointLight(0xff0000, 0, 30);
    brakeLight.position.set(0, 0.5, -2.2);
    car.body.add(brakeLight);
    car.lights.brake = brakeLight;
    
    gameState.isEngineRunning = true;
}

// ============================================================================
// CITY BUILDING
// ============================================================================

function buildCity() {
    // Street grid
    const streets = [
        // Horizontal streets
        { x: 0, z: -100, length: 200, width: 20, name: 'Main Street' },
        { x: 0, z: -50, length: 200, width: 15, name: 'Market Street' },
        { x: 0, z: 50, length: 200, width: 15, name: 'Park Avenue' },
        { x: 0, z: 100, length: 200, width: 20, name: 'Highway' },
    ];
    
    // Buildings
    const buildingPositions = [
        { x: -40, z: -120, width: 25, height: 20, depth: 25 },
        { x: -40, z: -70, width: 30, height: 25, depth: 20 },
        { x: -40, z: 30, width: 25, height: 18, depth: 25 },
        { x: -40, z: 80, width: 35, height: 30, depth: 25 },
        { x: 40, z: -120, width: 25, height: 22, depth: 25 },
        { x: 40, z: -70, width: 30, height: 28, depth: 20 },
        { x: 40, z: 30, width: 25, height: 20, depth: 25 },
        { x: 40, z: 80, width: 35, height: 32, depth: 25 },
    ];
    
    // Create streets
    streets.forEach(street => {
        const streetGeometry = new THREE.PlaneGeometry(street.length, street.width);
        const streetMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const streetMesh = new THREE.Mesh(streetGeometry, streetMaterial);
        streetMesh.position.set(street.x, 0.01, street.z);
        streetMesh.rotation.x = -Math.PI / 2;
        streetMesh.receiveShadow = true;
        scene.add(streetMesh);
        cityObjects.push(streetMesh);
        
        // Road lines
        drawRoadLines(street.x, street.z, street.length, street.width);
    });
    
    // Create buildings
    buildingPositions.forEach(pos => {
        createBuilding(pos.x, pos.z, pos.width, pos.height, pos.depth);
    });
    
    // Trees
    createTrees();
    
    // Street lights
    createStreetLights();
    
    // Parking area
    createParkingArea();
    
    // Gas station
    createGasStation();
}

function createBuilding(x, z, width, height, depth) {
    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
    const colors = [0xcc6633, 0xaa5522, 0xbb7744, 0xdd8855];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const buildingMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.1,
        roughness: 0.8
    });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    cityObjects.push(building);
    
    // Windows
    const windowSize = 1.5;
    for (let i = 0; i < width / 3; i++) {
        for (let j = 0; j < height / 2.5; j++) {
            const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
            const windowMaterial = new THREE.MeshStandardMaterial({
                color: 0x4488ff,
                emissive: 0x223366,
                emissiveIntensity: 0.5
            });
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.set(
                x - width / 2 + i * 3 + 1.5,
                j * 2.5 + 2,
                z + depth / 2 + 0.1
            );
            window.castShadow = false;
            scene.add(window);
        }
    }
    
    // Roof detail
    const roofGeometry = new THREE.BoxGeometry(width, 0.5, depth);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(x, height + 0.25, z);
    roof.castShadow = true;
    scene.add(roof);
    cityObjects.push(roof);
}

function createTrees() {
    const positions = [
        { x: -80, z: -150 }, { x: -80, z: 150 },
        { x: 80, z: -150 }, { x: 80, z: 150 },
        { x: -120, z: 0 }, { x: 120, z: 0 },
        { x: -150, z: -80 }, { x: 150, z: 80 },
    ];
    
    positions.forEach(pos => {
        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.8, 1, 6, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(pos.x, 3, pos.z);
        trunk.castShadow = true;
        scene.add(trunk);
        
        // Foliage
        const foliageGeometry = new THREE.SphereGeometry(5, 8, 8);
        const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.set(pos.x, 8, pos.z);
        foliage.castShadow = true;
        scene.add(foliage);
        cityObjects.push(foliage);
    });
}

function createStreetLights() {
    const positions = [
        { x: -60, z: -80 }, { x: -60, z: 0 }, { x: -60, z: 80 },
        { x: 60, z: -80 }, { x: 60, z: 0 }, { x: 60, z: 80 },
    ];
    
    positions.forEach(pos => {
        // Pole
        const poleGeometry = new THREE.CylinderGeometry(0.2, 0.25, 10, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(pos.x, 5, pos.z);
        pole.castShadow = true;
        scene.add(pole);
        
        // Light
        const light = new THREE.PointLight(0xffff99, 0.6, 100);
        light.position.set(pos.x, 10, pos.z);
        scene.add(light);
        cityObjects.push(light);
    });
}

function createParkingArea() {
    const parkingGeometry = new THREE.PlaneGeometry(60, 40);
    const parkingMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const parking = new THREE.Mesh(parkingGeometry, parkingMaterial);
    parking.position.set(-100, 0.02, 0);
    parking.rotation.x = -Math.PI / 2;
    parking.receiveShadow = true;
    scene.add(parking);
    cityObjects.push(parking);
    
    // Parking lines
    const lineGeometry = new THREE.PlaneGeometry(40, 0.3);
    const lineMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    for (let i = 0; i < 5; i++) {
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(-100, 0.03, -15 + i * 8);
        line.rotation.x = -Math.PI / 2;
        scene.add(line);
    }
}

function createGasStation() {
    // Pump stand
    const pumpGeometry = new THREE.BoxGeometry(2, 3, 1);
    const pumpMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const pump = new THREE.Mesh(pumpGeometry, pumpMaterial);
    pump.position.set(100, 1.5, -50);
    pump.castShadow = true;
    scene.add(pump);
    
    // Roof
    const roofGeometry = new THREE.BoxGeometry(25, 0.5, 20);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(100, 5, -50);
    roof.castShadow = true;
    scene.add(roof);
    
    // Light
    const light = new THREE.PointLight(0xffff00, 1, 150);
    light.position.set(100, 6, -50);
    scene.add(light);
}

function drawRoadLines(x, z, length, width) {
    const lineCount = Math.floor(length / 10);
    const lineMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    
    for (let i = 0; i < lineCount; i++) {
        const lineGeometry = new THREE.PlaneGeometry(width * 0.3, 2);
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.set(
            x,
            0.02,
            z - length / 2 + i * 10
        );
        line.rotation.x = -Math.PI / 2;
        scene.add(line);
    }
}

// ============================================================================
// TRAFFIC SYSTEM
// ============================================================================

const trafficCars = [];

function createTraffic() {
    const spawnPoints = [
        { x: -50, z: -100, rotation: 0 },
        { x: 50, z: -100, rotation: Math.PI },
        { x: -50, z: 100, rotation: 0 },
        { x: 50, z: 100, rotation: Math.PI },
    ];
    
    spawnPoints.forEach((point, index) => {
        const colors = [0x0066ff, 0x00ff66, 0xffff00, 0xff6600];
        createTrafficCar(point.x, point.z, point.rotation, colors[index]);
    });
}

function createTrafficCar(x, z, rotation, color) {
    const carGeometry = new THREE.BoxGeometry(1.6, 0.9, 3.5);
    const carMaterial = new THREE.MeshStandardMaterial({ color: color });
    const carMesh = new THREE.Mesh(carGeometry, carMaterial);
    carMesh.position.set(x, 0.5, z);
    carMesh.rotation.y = rotation;
    carMesh.castShadow = true;
    carMesh.receiveShadow = true;
    scene.add(carMesh);
    
    // Wheels
    for (let i = 0; i < 4; i++) {
        const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 8);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(
            (i % 2) === 0 ? -0.6 : 0.6,
            0.3,
            i < 2 ? 0.8 : -0.8
        );
        carMesh.add(wheel);
    }
    
    trafficCars.push({
        mesh: carMesh,
        velocity: 0,
        direction: rotation,
        speed: Math.random() * 30 + 20,
        isAtLight: false,
        route: 0
    });
}

function updateTraffic() {
    trafficCars.forEach(traffic => {
        // Simple AI: move forward
        const moveDistance = traffic.speed * 0.016; // 60 FPS
        traffic.mesh.position.x += Math.sin(traffic.direction) * moveDistance;
        traffic.mesh.position.z += Math.cos(traffic.direction) * moveDistance;
        
        // Boundary wrap
        if (traffic.mesh.position.x > 150) traffic.mesh.position.x = -150;
        if (traffic.mesh.position.x < -150) traffic.mesh.position.x = 150;
        if (traffic.mesh.position.z > 150) traffic.mesh.position.z = -150;
        if (traffic.mesh.position.z < -150) traffic.mesh.position.z = 150;
    });
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

function setupInputEvents() {
    // Keyboard events
    document.addEventListener('keydown', (e) => {
        switch(e.key.toUpperCase()) {
            case 'W': inputState.forward = true; break;
            case 'S': inputState.backward = true; break;
            case 'A': inputState.left = true; break;
            case 'D': inputState.right = true; break;
            case ' ': inputState.handbrake = true; e.preventDefault(); break;
            case 'SHIFT': inputState.nitro = true; break;
            case 'C': changeCameraMode(); break;
            case 'ESCAPE': togglePauseMenu(); break;
        }
    });
    
    document.addEventListener('keyup', (e) => {
        switch(e.key.toUpperCase()) {
            case 'W': inputState.forward = false; break;
            case 'S': inputState.backward = false; break;
            case 'A': inputState.left = false; break;
            case 'D': inputState.right = false; break;
            case ' ': inputState.handbrake = false; break;
            case 'SHIFT': inputState.nitro = false; break;
        }
    });
    
    // Menu buttons
    document.getElementById('pauseBtn').addEventListener('click', togglePauseMenu);
    document.getElementById('resumeBtn').addEventListener('click', togglePauseMenu);
    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('settingsBtn').addEventListener('click', showSettings);
    document.getElementById('backBtn').addEventListener('click', hideSettings);
    
    // Settings
    document.getElementById('volumeSlider').addEventListener('change', (e) => {
        gameState.masterVolume = e.target.value / 100;
        document.getElementById('volumeValue').textContent = e.target.value;
    });
    
    document.getElementById('qualitySelect').addEventListener('change', (e) => {
        gameState.graphicsQuality = e.target.value;
        updateGraphicsQuality();
    });
    
    document.getElementById('shadowToggle').addEventListener('change', (e) => {
        gameState.enableShadows = e.target.checked;
        renderer.shadowMap.enabled = e.target.checked;
    });
    
    document.getElementById('bloomToggle').addEventListener('change', (e) => {
        gameState.enableBloom = e.target.checked;
    });
}

function changeCameraMode() {
    const modes = ['third-person', 'first-person', 'hood'];
    const currentIndex = modes.indexOf(gameState.cameraMode);
    gameState.cameraMode = modes[(currentIndex + 1) % modes.length];
    
    const cameraNames = {
        'third-person': '3. Kişi',
        'first-person': 'İç Kamera',
        'hood': 'Kaput Kamerası'
    };
    document.getElementById('cameraMode').textContent = 'Kamera: ' + cameraNames[gameState.cameraMode];
}

function togglePauseMenu() {
    gameState.isPaused = !gameState.isPaused;
    document.getElementById('pauseMenu').classList.toggle('hidden');
}

function showSettings() {
    document.getElementById('pauseMenu').classList.add('hidden');
    document.getElementById('settingsMenu').classList.remove('hidden');
}

function hideSettings() {
    document.getElementById('settingsMenu').classList.add('hidden');
    document.getElementById('pauseMenu').classList.remove('hidden');
}

function resetGame() {
    car.position = { x: 0, y: 1, z: -50 };
    car.velocity = 0;
    car.rotation = 0;
    car.engineRPM = 0;
    car.gear = 0;
    car.fuel = CONFIG.maxFuel;
    car.nitro = CONFIG.nitroMaxCharge;
    car.body.position.set(car.position.x, car.position.y, car.position.z);
    gameState.isPaused = false;
    document.getElementById('pauseMenu').classList.add('hidden');
}

function updateGraphicsQuality() {
    const quality = gameState.graphicsQuality;
    if (quality === 'low') {
        renderer.setPixelRatio(1);
        scene.fog.far = CONFIG.fogDistance * 0.7;
    } else if (quality === 'medium') {
        renderer.setPixelRatio(1.2);
        scene.fog.far = CONFIG.fogDistance;
    } else {
        renderer.setPixelRatio(1.5);
        scene.fog.far = CONFIG.fogDistance * 1.5;
    }
}

// ============================================================================
// CAR PHYSICS & CONTROL
// ============================================================================

function updateCar() {
    if (gameState.isPaused) return;
    
    // Engine control
    if (inputState.forward) {
        car.throttle = Math.min(car.throttle + 0.15, 1);
    } else if (inputState.backward) {
        car.throttle = Math.max(car.throttle - 0.15, -0.5);
    } else {
        car.throttle *= 0.85;
    }
    
    // Steering
    const targetSteerAngle = (inputState.left ? -1 : 0) + (inputState.right ? 1 : 0);
    car.targetSteering = targetSteerAngle * CONFIG.maxSteerAngle;
    car.steering += (car.targetSteering - car.steering) * 0.1;
    
    // Handbrake drift
    if (inputState.handbrake) {
        car.isDrifting = true;
        car.driftAngle += car.steering * 0.15;
    } else {
        car.isDrifting = false;
        car.driftAngle *= 0.9;
    }
    
    // Acceleration
    const acceleration = car.throttle > 0 ? car.throttle * CONFIG.acceleration : car.throttle * CONFIG.brakeForce;
    car.velocity += acceleration;
    car.velocity *= car.isDrifting ? CONFIG.driftFriction : CONFIG.friction;
    car.velocity = Math.max(Math.min(car.velocity, CONFIG.maxSpeed), -CONFIG.maxSpeed * 0.5);
    
    // Nitro boost
    if (inputState.nitro && car.nitro > 0) {
        car.velocity += CONFIG.nitroBoost * 0.01;
        car.nitro -= CONFIG.nitroUseRate;
    } else {
        car.nitro = Math.min(car.nitro + CONFIG.nitroRechargeRate, CONFIG.nitroMaxCharge);
    }
    
    // Rotation
    car.angularVelocity = car.steering * Math.abs(car.velocity) * 0.01;
    car.rotation += car.angularVelocity;
    
    // Position update
    car.position.x += Math.sin(car.rotation) * car.velocity * 0.016;
    car.position.z += Math.cos(car.rotation) * car.velocity * 0.016;
    
    // Fuel consumption
    if (gameState.isEngineRunning) {
        car.fuel -= CONFIG.fuelConsumption * Math.abs(car.throttle);
        if (car.fuel <= 0) {
            car.fuel = 0;
            car.velocity = 0;
            car.throttle = 0;
        }
    }
    
    // Engine RPM
    car.engineRPM = Math.abs(car.velocity) * 50;
    
    // Gear calculation
    if (car.throttle > 0) {
        car.gear = Math.min(Math.floor(car.engineRPM / 1000) + 1, car.maxGear);
    } else if (car.throttle < 0) {
        car.gear = -1;
    } else {
        car.gear = 0;
    }
    
    // Suspension bounce
    car.suspensionBounce = Math.sin(Date.now() * 0.002) * Math.abs(car.velocity) * 0.01;
    
    // Update car body visual
    car.body.position.set(
        car.position.x,
        car.position.y + car.suspensionBounce,
        car.position.z
    );
    car.body.rotation.y = car.rotation + car.driftAngle;
    car.body.rotation.z = car.steering * 0.05;
    
    // Update wheels
    car.wheels.forEach((wheel, index) => {
        wheel.rotation += car.velocity * 0.05;
        
        if (wheel.isSteer) {
            wheel.mesh.rotation.y = car.steering;
        }
    });
    
    // Brake lights
    if (car.throttle < -0.1 || inputState.backward) {
        car.lights.brake.intensity = 1;
    } else {
        car.lights.brake.intensity = 0;
    }
    
    // Boundary
    if (car.position.x > 200) car.position.x = -200;
    if (car.position.x < -200) car.position.x = 200;
    if (car.position.z > 200) car.position.z = -200;
    if (car.position.z < -200) car.position.z = 200;
}

// ============================================================================
// CAMERA SYSTEM
// ============================================================================

function updateCamera() {
    const targetPos = { x: car.position.x, y: car.position.y, z: car.position.z };
    const cameraDistance = 10;
    const cameraHeight = 3;
    
    if (gameState.cameraMode === 'third-person') {
        camera.position.x = targetPos.x - Math.sin(car.rotation) * cameraDistance;
        camera.position.y = targetPos.y + cameraHeight;
        camera.position.z = targetPos.z - Math.cos(car.rotation) * cameraDistance;
        camera.lookAt(targetPos.x, targetPos.y + 1, targetPos.z);
    } else if (gameState.cameraMode === 'first-person') {
        camera.position.x = car.position.x;
        camera.position.y = car.position.y + 0.8;
        camera.position.z = car.position.z;
        camera.rotation.order = 'YXZ';
        camera.rotation.y = car.rotation;
        camera.rotation.x = Math.random() * 0.002; // Slight vibration
    } else if (gameState.cameraMode === 'hood') {
        camera.position.x = targetPos.x - Math.sin(car.rotation) * 3;
        camera.position.y = targetPos.y + 2;
        camera.position.z = targetPos.z - Math.cos(car.rotation) * 3;
        camera.lookAt(
            targetPos.x + Math.sin(car.rotation) * 50,
            targetPos.y + 1,
            targetPos.z + Math.cos(car.rotation) * 50
        );
    }
}

// ============================================================================
// HUD UPDATE
// ============================================================================

function updateHUD() {
    // Speed
    const speed = Math.abs(car.velocity).toFixed(1);
    document.getElementById('speedValue').textContent = speed;
    document.getElementById('speedBar').style.width = (Math.abs(car.velocity) / CONFIG.maxSpeed * 100) + '%';
    
    // RPM
    const rpm = Math.min(car.engineRPM, 7000).toFixed(0);
    document.getElementById('rpmValue').textContent = rpm;
    document.getElementById('rpmBar').style.width = (Math.min(car.engineRPM, 7000) / 7000 * 100) + '%';
    
    // Gear
    const gearNames = { 0: 'P', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', '-1': 'R' };
    document.getElementById('gearValue').textContent = gearNames[car.gear];
    
    // Fuel
    document.getElementById('fuelBar').style.width = (car.fuel / CONFIG.maxFuel * 100) + '%';
    
    // Nitro
    document.getElementById('nitroBar').style.width = (car.nitro / CONFIG.nitroMaxCharge * 100) + '%';
    
    // Minimap
    updateMinimap();
    
    // FPS
    const now = Date.now();
    gameState.frameCount++;
    if (now >= gameState.lastFrameTime + 1000) {
        gameState.fps = gameState.frameCount;
        gameState.frameCount = 0;
        gameState.lastFrameTime = now;
    }
    document.getElementById('fpsCounter').textContent = 'FPS: ' + gameState.fps;
}

function updateMinimap() {
    const canvas = document.getElementById('minimapCanvas');
    const ctx = canvas.getContext('2d');
    const scale = 0.4;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Streets
    ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
    ctx.fillRect(centerX - 50 * scale, centerY - 100 * scale, 100 * scale, 20 * scale);
    ctx.fillRect(centerX - 100 * scale, centerY - 50 * scale, 200 * scale, 15 * scale);
    
    // Player car
    ctx.fillStyle = '#00ff00';
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(car.rotation);
    ctx.fillRect(-3, -5, 6, 10);
    ctx.restore();
    
    // Traffic
    ctx.fillStyle = '#ff0000';
    trafficCars.forEach(traffic => {
        const relX = (traffic.mesh.position.x - car.position.x) * scale;
        const relZ = (traffic.mesh.position.z - car.position.z) * scale;
        if (Math.abs(relX) < 75 && Math.abs(relZ) < 75) {
            ctx.fillRect(centerX + relX - 2, centerY + relZ - 2, 4, 4);
        }
    });
}

// ============================================================================
// AUDIO SYSTEM
// ============================================================================

function initAudio() {
    // Audio context will be created on first user interaction
    // This prevents browser autoplay policies from blocking audio
}

function playEngineSound() {
    // Simplified: Use Web Audio API for engine sounds
    // Note: Full implementation would require audio files
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animate() {
    requestAnimationFrame(animate);
    
    if (!gameState.isPaused) {
        updateCar();
        updateTraffic();
    }
    
    updateCamera();
    updateHUD();
    renderer.render(scene, camera);
}

function startGame() {
    gameState.isEngineRunning = true;
    console.log('Oyun başladı!');
}

function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Add ESC menu button visibility fix
document.addEventListener('DOMContentLoaded', () => {
    // Create pause button in HUD
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'pauseBtn';
    pauseBtn.style.display = 'none';
    document.body.appendChild(pauseBtn);
});
