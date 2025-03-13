import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.0/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/build/cannon.min.js';

// Player character class inspired by Three.js skinning and animation example
export class Player {
    constructor(scene, world, camera, options = {}) {
        this.scene = scene;
        this.world = world;
        this.camera = camera;
        
        // Default options
        this.options = {
            mass: 70, // kg
            height: 1.7, // meters
            radius: 0.3, // meters
            jumpForce: 10,
            walkSpeed: 5,
            runSpeed: 8,
            gravity: -3.711, // Mars gravity (m/s²)
            ...options
        };
        
        // Player state
        this.state = {
            canJump: false,
            isRunning: false,
            isMoving: false,
            health: 100,
            oxygen: 100,
            water: 100,
            food: 100
        };
        
        // Movement controls
        this.controls = {
            moveForward: false,
            moveBackward: false,
            moveLeft: false,
            moveRight: false,
            jump: false,
            run: false
        };
        
        // Physics
        this.body = null;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        // Visual model
        this.model = null;
        this.mixer = null;
        this.animations = {};
        this.currentAction = null;
        
        // Initialize
        this.init();
    }
    
    init() {
        // Create physics body
        this.createPhysicsBody();
        
        // Create visual representation (temporary until model is loaded)
        this.createTemporaryModel();
        
        // Set up animation mixer
        this.mixer = new THREE.AnimationMixer(new THREE.Object3D());
    }
    
    createPhysicsBody() {
        const { mass, radius, height } = this.options;
        
        // Use capsule shape for better collision
        const shape = new CANNON.Sphere(radius);
        
        this.body = new CANNON.Body({
            mass: mass,
            material: new CANNON.Material('playerMaterial')
        });
        
        this.body.addShape(shape);
        this.body.position.set(0, height, 0);
        this.body.linearDamping = 0.9;
        this.body.angularDamping = 0.9;
        
        // Add to physics world
        this.world.addBody(this.body);
        
        // Create contact material for player-ground interaction
        const groundMaterial = new CANNON.Material('groundMaterial');
        const playerGroundContact = new CANNON.ContactMaterial(
            groundMaterial,
            this.body.material,
            {
                friction: 0.5,
                restitution: 0.3
            }
        );
        
        this.world.addContactMaterial(playerGroundContact);
    }
    
    createTemporaryModel() {
        // Simple visual representation until model is loaded
        const geometry = new THREE.CapsuleGeometry(
            this.options.radius,
            this.options.height - this.options.radius * 2,
            4,
            8
        );
        
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.2,
            roughness: 0.8
        });
        
        this.model = new THREE.Mesh(geometry, material);
        this.model.castShadow = true;
        this.model.visible = false; // Hide in first-person mode
        
        this.scene.add(this.model);
    }
    
    loadModel(url) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            
            loader.load(
                url,
                (gltf) => {
                    // Remove temporary model
                    if (this.model) {
                        this.scene.remove(this.model);
                    }
                    
                    // Set up new model
                    this.model = gltf.scene;
                    this.model.traverse((object) => {
                        if (object.isMesh) {
                            object.castShadow = true;
                        }
                    });
                    
                    // Scale and position model
                    this.model.scale.set(1, 1, 1); // Adjust as needed
                    this.model.position.set(0, 0, 0);
                    this.model.visible = false; // Hide in first-person mode
                    
                    this.scene.add(this.model);
                    
                    // Set up animations
                    this.mixer = new THREE.AnimationMixer(this.model);
                    
                    if (gltf.animations && gltf.animations.length) {
                        gltf.animations.forEach((animation) => {
                            const name = animation.name.toLowerCase();
                            this.animations[name] = this.mixer.clipAction(animation);
                        });
                        
                        // Set default animation
                        if (this.animations['idle']) {
                            this.playAnimation('idle');
                        }
                    }
                    
                    resolve(this.model);
                },
                undefined,
                (error) => {
                    console.error('Error loading player model:', error);
                    reject(error);
                }
            );
        });
    }
    
    playAnimation(name, fadeTime = 0.2) {
        const animation = this.animations[name.toLowerCase()];
        
        if (animation) {
            if (this.currentAction) {
                this.currentAction.fadeOut(fadeTime);
            }
            
            animation.reset()
                    .setEffectiveTimeScale(1)
                    .setEffectiveWeight(1)
                    .fadeIn(fadeTime)
                    .play();
            
            this.currentAction = animation;
        }
    }
    
    update(delta) {
        // Update physics
        this.updatePhysics(delta);
        
        // Update model position to match physics body
        if (this.model) {
            this.model.position.copy(this.body.position);
            this.model.quaternion.copy(this.body.quaternion);
        }
        
        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(delta);
        }
        
        // Update animation state based on movement
        this.updateAnimationState();
    }
    
    updatePhysics(delta) {
        // Reset velocity damping
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        
        // Calculate movement direction
        this.direction.z = Number(this.controls.moveForward) - Number(this.controls.moveBackward);
        this.direction.x = Number(this.controls.moveRight) - Number(this.controls.moveLeft);
        this.direction.normalize();
        
        // Apply camera direction to movement
        if (this.camera) {
            const cameraDirection = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;
            cameraDirection.normalize();
            
            const cameraRight = new THREE.Vector3();
            cameraRight.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection).normalize();
            
            if (this.controls.moveForward || this.controls.moveBackward) {
                this.velocity.z = this.direction.z * (this.state.isRunning ? this.options.runSpeed : this.options.walkSpeed);
            }
            
            if (this.controls.moveLeft || this.controls.moveRight) {
                this.velocity.x = this.direction.x * (this.state.isRunning ? this.options.runSpeed : this.options.walkSpeed);
            }
            
            // Convert velocity to world space
            const velocityWorld = new THREE.Vector3();
            velocityWorld.addScaledVector(cameraDirection, -this.velocity.z);
            velocityWorld.addScaledVector(cameraRight, this.velocity.x);
            
            // Apply to physics body
            this.body.velocity.x = velocityWorld.x;
            this.body.velocity.z = velocityWorld.z;
        }
        
        // Handle jumping
        if (this.controls.jump && this.state.canJump) {
            this.body.velocity.y = this.options.jumpForce;
            this.state.canJump = false;
        }
        
        // Check if player is on ground
        this.checkGroundContact();
    }
    
    checkGroundContact() {
        // Raycast downward to check for ground contact
        const rayCastResult = new CANNON.RaycastResult();
        const rayCastSource = new CANNON.Ray(this.body.position, new CANNON.Vec3(0, -1, 0));
        
        rayCastSource.intersectWorld(this.world, { result: rayCastResult });
        
        if (rayCastResult.hasHit && rayCastResult.distance < this.options.height * 0.6) {
            this.state.canJump = true;
        }
    }
    
    updateAnimationState() {
        // Determine if player is moving
        this.state.isMoving = 
            this.controls.moveForward || 
            this.controls.moveBackward || 
            this.controls.moveLeft || 
            this.controls.moveRight;
        
        // Update running state
        this.state.isRunning = this.controls.run && this.state.isMoving;
        
        // Play appropriate animation
        if (!this.state.canJump) {
            if (this.animations['jump']) {
                this.playAnimation('jump');
            }
        } else if (this.state.isMoving) {
            if (this.state.isRunning && this.animations['run']) {
                this.playAnimation('run');
            } else if (this.animations['walk']) {
                this.playAnimation('walk');
            }
        } else if (this.animations['idle']) {
            this.playAnimation('idle');
        }
    }
    
    setControls(controls) {
        this.controls = { ...this.controls, ...controls };
    }
    
    getPosition() {
        return this.body.position;
    }
    
    setPosition(x, y, z) {
        this.body.position.set(x, y, z);
        this.body.previousPosition.set(x, y, z);
        this.body.interpolatedPosition.set(x, y, z);
        this.body.initPosition.set(x, y, z);
    }
    
    // Resource management methods
    updateResources(delta) {
        // Oxygen depletion (faster when running)
        const oxygenRate = this.state.isRunning ? 0.1 : 0.05;
        this.state.oxygen = Math.max(0, this.state.oxygen - oxygenRate * delta);
        
        // Water depletion (faster when running)
        const waterRate = this.state.isRunning ? 0.05 : 0.02;
        this.state.water = Math.max(0, this.state.water - waterRate * delta);
        
        // Food depletion
        this.state.food = Math.max(0, this.state.food - 0.01 * delta);
        
        return {
            oxygen: this.state.oxygen,
            water: this.state.water,
            food: this.state.food
        };
    }
    
    // Resource replenishment methods
    addOxygen(amount) {
        this.state.oxygen = Math.min(100, this.state.oxygen + amount);
        return this.state.oxygen;
    }
    
    addWater(amount) {
        this.state.water = Math.min(100, this.state.water + amount);
        return this.state.water;
    }
    
    addFood(amount) {
        this.state.food = Math.min(100, this.state.food + amount);
        return this.state.food;
    }
}