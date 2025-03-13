import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.0/examples/jsm/controls/OrbitControls.js';
import { FirstPersonControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.0/examples/jsm/controls/FirstPersonControls.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.0/examples/jsm/controls/PointerLockControls.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/build/cannon.min.js';
import Stats from 'https://cdn.jsdelivr.net/npm/stats.js@0.17.0/build/stats.min.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.0/examples/jsm/loaders/GLTFLoader.js';
import { ImprovedNoise } from 'https://cdn.jsdelivr.net/npm/three@0.152.0/examples/jsm/math/ImprovedNoise.js';

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
    playerCanMove: false
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

// Player physics body
const playerShape = new CANNON.Sphere(0.5);
const playerBody = new CANNON.Body({ mass: 70 }); // Average human mass
playerBody.addShape(playerShape);
playerBody.position.set(0, 5, 0);
playerBody.linearDamping = 0.9;
world.addBody(playerBody);

// Movement variables
const moveForward = false;
const moveBackward = false;
const moveLeft = false;
const moveRight = false;
const canJump = false;
let isRunning = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let playerSpeed = 5.0; // Base speed
let runningSpeed = 8.0; // Running speed

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

// Create Mars terrain
function createMartianTerrain() {
    const worldWidth = 256;
    const worldDepth = 256;
    const worldHalfWidth = worldWidth / 2;
    const worldHalfDepth = worldDepth / 2;
    const data = generateHeight(worldWidth, worldDepth);
    
    const geometry = new THREE.PlaneGeometry(300, 300, worldWidth - 1, worldDepth - 1);
    geometry.rotateX(-Math.PI / 2);
    
    const vertices = geometry.attributes.position.array;
    
    for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
        vertices[j + 1] = data[i] * 10;
    }
    
    geometry.computeVertexNormals();
    
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xbf5e3d, // Mars reddish-brown
        metalness: 0.1,
        roughness: 0.9
    });
    
    const terrain = new THREE.Mesh(geometry, groundMaterial);
    terrain.receiveShadow = true;
    scene.add(terrain);
    
    // Create physics for terrain
    const heightfieldShape = new CANNON.Heightfield(data, {
        elementSize: 300 / worldWidth
    });
    
    const terrainBody = new CANNON.Body({ mass: 0 });
    terrainBody.addShape(heightfieldShape);
    terrainBody.position.set(-worldHalfWidth, -5, -worldHalfDepth);
    terrainBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(terrainBody);
    
    return terrain;
}

function generateHeight(width, height) {
    const size = width * height;
    const data = new Float32Array(size);
    const perlin = new ImprovedNoise();
    const z = Math.random() * 100;
    
    let quality = 1;
    
    for (let j = 0; j < 4; j++) {
        for (let i = 0; i < size; i++) {
            const x = i % width;
            const y = ~~(i / width);
            data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality);
        }
        
        quality *= 5;
    }
    
    return data;
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

// Create rocks and obstacles
function createRocks() {
    const rocks = new THREE.Group();
    
    for (let i = 0; i < 50; i++) {
        const radius = 0.5 + Math.random() * 2;
        const geometry = new THREE.DodecahedronGeometry(radius, 0);
        const material = new THREE.MeshStandardMaterial({
            color: 0xa86032,
            metalness: 0.1,
            roughness: 0.9
        });
        
        const rock = new THREE.Mesh(geometry, material);
        
        // Random position within a certain range
        const x = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        let y = 0;
        
        rock.position.set(x, y, z);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        rock.castShadow = true;
        rock.receiveShadow = true;
        
        rocks.add(rock);
        
        // Add physics for larger rocks
        if (radius > 1) {
            const rockShape = new CANNON.Sphere(radius);
            const rockBody = new CANNON.Body({ mass: 0 });
            rockBody.addShape(rockShape);
            rockBody.position.set(x, y + radius, z);
            world.addBody(rockBody);
        }
    }
    
    scene.add(rocks);
    return rocks;
}

// Create dust particles
function createDustParticles() {
    const particleCount = 1000;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 100;
        positions[i3 + 1] = Math.random() * 5;
        positions[i3 + 2] = (Math.random() - 0.5) * 100;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
        color: 0xbf5e3d,
        size: 0.1,
        transparent: true,
        opacity: 0.5
    });
    
    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);
    
    return particleSystem;
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
    // Deplete oxygen over time
    gameState.oxygen = Math.max(0, gameState.oxygen - gameState.oxygenDepletionRate * delta);
    
    // Deplete water and food more slowly
    gameState.water = Math.max(0, gameState.water - 0.01 * delta);
    gameState.food = Math.max(0, gameState.food - 0.005 * delta);
    
    // If running, deplete oxygen faster
    if (isRunning) {
        gameState.oxygen = Math.max(0, gameState.oxygen - 0.05 * delta);
    }
    
    // If oxygen is depleted, game over
    if (gameState.oxygen <= 0) {
        // Game over logic here
        console.log("Game over: Oxygen depleted");
    }
}

// Handle keyboard input
const onKeyDown = function(event) {
    if (!gameState.playerCanMove) return;
    
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'Space':
            if (canJump) {
                playerBody.velocity.y = 10;
                canJump = false;
            }
            break;
        case 'ShiftLeft':
            isRunning = true;
            break;
    }
};

const onKeyUp = function(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
        case 'ShiftLeft':
            isRunning = false;
            break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Handle pointer lock for first-person controls
document.addEventListener('click', function() {
    if (gameState.isLoaded && !gameState.playerCanMove) {
        controls.lock();
    }
});

controls.addEventListener('lock', function() {
    gameState.playerCanMove = true;
    document.getElementById('info').style.display = 'none';
});

controls.addEventListener('unlock', function() {
    gameState.playerCanMove = false;
    document.getElementById('info').style.display = 'block';
});

// Handle window resize
window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize game
function init() {
    // Create terrain
    const terrain = createMartianTerrain();
    
    // Create skybox
    const skybox = createSkybox();
    
    // Create habitat
    const habitat = createHabitat();
    
    // Create rocks
    const rocks = createRocks();
    
    // Create dust particles
    const dustParticles = createDustParticles();
    
    // Position player
    playerBody.position.set(0, 5, 0);
    camera.position.set(0, 1.7, 0);
    
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
    
    // Update player movement
    if (gameState.playerCanMove) {
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();
        
        const currentSpeed = isRunning ? runningSpeed : playerSpeed;
        
        if (moveForward || moveBackward) {
            playerBody.velocity.z = direction.z * currentSpeed;
        }
        
        if (moveLeft || moveRight) {
            playerBody.velocity.x = direction.x * currentSpeed;
        }
    }
    
    // Update camera position from physics body
    camera.position.copy(playerBody.position);
    camera.position.y += 1.7; // Eye level
    
    // Check if player is on ground
    const rayCastResult = new CANNON.RaycastResult();
    const rayCastSource = new CANNON.Ray(playerBody.position, new CANNON.Vec3(0, -1, 0));
    
    rayCastSource.intersectWorld(world, { result: rayCastResult });
    
    if (rayCastResult.hasHit && rayCastResult.distance < 1.1) {
        canJump = true;
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