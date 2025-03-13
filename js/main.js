import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.module.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.0/examples/jsm/controls/PointerLockControls.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/build/cannon.min.js';
import Stats from 'https://cdn.jsdelivr.net/npm/stats.js@0.17.0/build/stats.min.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.0/examples/jsm/loaders/GLTFLoader.js';

import { MartianTerrain } from './terrain.js';
import { Player } from './player.js';
import { Environment } from './environment.js';

// Game state
const gameState = {
    oxygen: 100,
    temperature: 0,
    water: 100,
    food: 100,
    isDay: true,
    timeOfDay: 0, // 0-1 representing day cycle
    dayLength: 600, // seconds for a full day/night cycle
    oxygenDepletionRate: 0.05, // per second
    temperatureRange: { day: 20, night: -80 }, // Celsius
    isLoaded: false,
    playerCanMove: false,
    gameOver: false
};

// Stats setup
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd4c5b5); // Martian sky color

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.7, 0); // Eye level

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Physics world
const world = new CANNON.World();
world.gravity.set(0, -3.711, 0); // Mars gravity (3.711 m/s²)
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Game objects
let player;
let environment;
let terrain;

// Lighting
// Ambient light (dim for Mars)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Directional light (sun)
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.set(50, 100, 50);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -100;
sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -100;
scene.add(sunLight);

// Create a simple habitat module
function createHabitat() {
    const habitatGroup = new THREE.Group();
    
    // Base
    const baseGeometry = new THREE.CylinderGeometry(5, 5, 1, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.5;
    base.castShadow = true;
    base.receiveShadow = true;
    habitatGroup.add(base);
    
    // Main module
    const moduleGeometry = new THREE.CylinderGeometry(4, 4, 3, 16);
    const moduleMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    const module = new THREE.Mesh(moduleGeometry, moduleMaterial);
    module.position.y = 2.5;
    module.castShadow = true;
    module.receiveShadow = true;
    habitatGroup.add(module);
    
    // Dome
    const domeGeometry = new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xaaddff,
        transparent: true,
        opacity: 0.5
    });
    const dome = new THREE.Mesh(domeGeometry, domeMaterial);
    dome.position.y = 4;
    dome.castShadow = true;
    dome.receiveShadow = true;
    habitatGroup.add(dome);
    
    // Airlock
    const airlockGeometry = new THREE.BoxGeometry(2, 2, 1);
    const airlockMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const airlock = new THREE.Mesh(airlockGeometry, airlockMaterial);
    airlock.position.set(4, 1.5, 0);
    airlock.castShadow = true;
    airlock.receiveShadow = true;
    habitatGroup.add(airlock);
    
    // Position the habitat
    habitatGroup.position.set(0, 0, -20);
    scene.add(habitatGroup);
    
    // Add physics body for the habitat
    const habitatShape = new CANNON.Cylinder(5, 5, 5, 16);
    const habitatBody = new CANNON.Body({ mass: 0 });
    habitatBody.addShape(habitatShape);
    habitatBody.position.set(0, 2.5, -20);
    world.addBody(habitatBody);
    
    return habitatGroup;
}

// Create skybox
function createSkybox() {
    const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
    const skyboxMaterials = [
        new THREE.MeshBasicMaterial({ color: 0xd4c5b5, side: THREE.BackSide }), // right
        new THREE.MeshBasicMaterial({ color: 0xd4c5b5, side: THREE.BackSide }), // left
        new THREE.MeshBasicMaterial({ color: 0xd4c5b5, side: THREE.BackSide }), // top
        new THREE.MeshBasicMaterial({ color: 0xd4c5b5, side: THREE.BackSide }), // bottom
        new THREE.MeshBasicMaterial({ color: 0xd4c5b5, side: THREE.BackSide }), // front
        new THREE.MeshBasicMaterial({ color: 0xd4c5b5, side: THREE.BackSide })  // back
    ];
    
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
    scene.add(skybox);
    
    return skybox;
}

// Update HUD
function updateHUD() {
    document.getElementById('oxygen-level').style.width = `${gameState.oxygen}%`;
    document.getElementById('temperature').textContent = `TEMPERATURE: ${Math.round(gameState.temperature)}°C`;
    document.getElementById('water').textContent = `WATER: ${Math.round(gameState.water)}%`;
    document.getElementById('food').textContent = `FOOD: ${Math.round(gameState.food)}%`;
    
    // Change oxygen bar color based on level
    const oxygenBar = document.getElementById('oxygen-level');
    if (gameState.oxygen < 20) {
        oxygenBar.style.backgroundColor = '#ff0000';
    } else if (gameState.oxygen < 50) {
        oxygenBar.style.backgroundColor = '#ffaa00';
    } else {
        oxygenBar.style.backgroundColor = '#00aaff';
    }
}

// Update day/night cycle
function updateDayNightCycle(delta) {
    gameState.timeOfDay += delta / gameState.dayLength;
    if (gameState.timeOfDay >= 1) gameState.timeOfDay = 0;
    
    // Calculate sun position
    const angle = gameState.timeOfDay * Math.PI * 2;
    const radius = 100;
    sunLight.position.x = Math.cos(angle) * radius;
    sunLight.position.y = Math.sin(angle) * radius;
    
    // Update light intensity based on time of day
    const intensity = Math.max(0, Math.sin(angle));
    sunLight.intensity = intensity;
    ambientLight.intensity = 0.1 + intensity * 0.2;
    
    // Update sky color
    const skyColor = new THREE.Color();
    if (intensity > 0.3) {
        // Day
        skyColor.setRGB(0.83, 0.77, 0.71); // Martian day sky
        gameState.isDay = true;
    } else {
        // Night
        skyColor.setRGB(0.05, 0.05, 0.1); // Dark night sky
        gameState.isDay = false;
    }
    scene.background = skyColor;
    
    // Update temperature based on time of day
    const tempRange = gameState.temperatureRange;
    gameState.temperature = tempRange.night + (tempRange.day - tempRange.night) * intensity;
}

// Update resources
function updateResources(delta) {
    if (player) {
        const resources = player.updateResources(delta);
        gameState.oxygen = resources.oxygen;
        gameState.water = resources.water;
        gameState.food = resources.food;
    } else {
        // Fallback if player not initialized
        gameState.oxygen = Math.max(0, gameState.oxygen - gameState.oxygenDepletionRate * delta);
        gameState.water = Math.max(0, gameState.water - 0.01 * delta);
        gameState.food = Math.max(0, gameState.food - 0.005 * delta);
    }
    
    // If oxygen is depleted, game over
    if (gameState.oxygen <= 0 && !gameState.gameOver) {
        gameOver("You ran out of oxygen");
    }
    
    // Check for environmental effects on resources
    if (environment) {
        const envState = environment.getState();
        
        // Dust storms reduce oxygen slightly
        if (envState.isDustStorm) {
            gameState.oxygen = Math.max(0, gameState.oxygen - envState.dustStormIntensity * 0.02 * delta);
        }
        
        // Radiation storms reduce health
        if (envState.isRadiationStorm && player) {
            player.state.health = Math.max(0, player.state.health - envState.radiationIntensity * 0.1 * delta);
            
            // Game over if health depleted
            if (player.state.health <= 0 && !gameState.gameOver) {
                gameOver("You died from radiation exposure");
            }
        }
    }
}

// Game over function
function gameOver(reason) {
    gameState.gameOver = true;
    gameState.playerCanMove = false;
    controls.unlock();
    
    document.getElementById('death-reason').textContent = reason;
    document.getElementById('game-over').style.display = 'flex';
}

// Restart game
function restartGame() {
    location.reload();
}

// Handle keyboard input
const onKeyDown = function(event) {
    if (!gameState.playerCanMove) return;
    
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            player.setControls({ moveForward: true });
            break;
        case 'ArrowLeft':
        case 'KeyA':
            player.setControls({ moveLeft: true });
            break;
        case 'ArrowDown':
        case 'KeyS':
            player.setControls({ moveBackward: true });
            break;
        case 'ArrowRight':
        case 'KeyD':
            player.setControls({ moveRight: true });
            break;
        case 'Space':
            player.setControls({ jump: true });
            break;
        case 'ShiftLeft':
            player.setControls({ run: true });
            break;
        // Debug keys for testing
        case 'KeyT':
            if (environment) environment.forceDustStorm();
            break;
        case 'KeyR':
            if (environment) environment.forceRadiationStorm();
            break;
    }
};

const onKeyUp = function(event) {
    if (!player) return;
    
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            player.setControls({ moveForward: false });
            break;
        case 'ArrowLeft':
        case 'KeyA':
            player.setControls({ moveLeft: false });
            break;
        case 'ArrowDown':
        case 'KeyS':
            player.setControls({ moveBackward: false });
            break;
        case 'ArrowRight':
        case 'KeyD':
            player.setControls({ moveRight: false });
            break;
        case 'Space':
            player.setControls({ jump: false });
            break;
        case 'ShiftLeft':
            player.setControls({ run: false });
            break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Handle pointer lock for first-person controls
document.addEventListener('click', function() {
    if (gameState.isLoaded && !gameState.playerCanMove && !gameState.gameOver) {
        controls.lock();
    }
});

controls.addEventListener('lock', function() {
    gameState.playerCanMove = true;
    document.getElementById('info').style.display = 'none';
});

controls.addEventListener('unlock', function() {
    if (!gameState.gameOver) {
        gameState.playerCanMove = false;
        document.getElementById('info').style.display = 'block';
    }
});

// Handle restart button
document.getElementById('restart-button').addEventListener('click', restartGame);

// Handle window resize
window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize game
function init() {
    // Create terrain
    terrain = new MartianTerrain(scene, world);
    const martianTerrain = terrain.generate();
    terrain.addDetails();
    
    // Create skybox
    const skybox = createSkybox();
    
    // Create habitat
    const habitat = createHabitat();
    
    // Create player
    player = new Player(scene, world, camera);
    player.setPosition(0, 5, 0);
    
    // Create environment effects
    environment = new Environment(scene, camera);
    
    // Start game loop
    animate();
}

// Loading manager
const loadingManager = new THREE.LoadingManager();
let loadingProgress = 0;

loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
    loadingProgress = itemsLoaded / itemsTotal * 100;
    document.getElementById('loading-progress').style.width = `${loadingProgress}%`;
};

loadingManager.onLoad = function() {
    setTimeout(function() {
        document.getElementById('loading-screen').style.display = 'none';
        gameState.isLoaded = true;
    }, 1000);
};

// Game loop
const clock = new THREE.Clock();
let lastCallTime;

function animate() {
    stats.begin();
    
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    // Physics update
    const time = performance.now() / 1000;
    if (!lastCallTime) {
        world.step(1/60);
    } else {
        const dt = Math.min(time - lastCallTime, 0.1);
        world.step(1/60, dt);
    }
    lastCallTime = time;
    
    // Update player
    if (player) {
        player.update(delta);
        
        // Update camera position from player
        const playerPos = player.getPosition();
        camera.position.copy(playerPos);
        camera.position.y += 1.7; // Eye level
    }
    
    // Update environment effects
    if (environment) {
        environment.update(delta);
    }
    
    // Update day/night cycle
    updateDayNightCycle(delta);
    
    // Update resources
    updateResources(delta);
    
    // Update HUD
    updateHUD();
    
    renderer.render(scene, camera);
    
    stats.end();
}

// Start loading
const textureLoader = new THREE.TextureLoader(loadingManager);
const gltfLoader = new GLTFLoader(loadingManager);

// Load necessary textures and models
// This is a placeholder for actual asset loading
setTimeout(function() {
    init();
}, 2000);