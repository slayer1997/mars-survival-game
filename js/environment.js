import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.module.js';

// Environment effects class for Mars Survival game
export class Environment {
    constructor(scene, camera, options = {}) {
        this.scene = scene;
        this.camera = camera;
        
        // Default options
        this.options = {
            dustStormProbability: 0.001, // Chance per second
            dustStormDuration: { min: 30, max: 120 }, // seconds
            dustStormIntensity: { min: 0.3, max: 0.8 },
            radiationProbability: 0.0005, // Chance per second
            radiationDuration: { min: 20, max: 60 }, // seconds
            radiationIntensity: { min: 0.2, max: 0.6 },
            ...options
        };
        
        // Environment state
        this.state = {
            isDustStorm: false,
            dustStormIntensity: 0,
            dustStormTimer: 0,
            isRadiationStorm: false,
            radiationIntensity: 0,
            radiationTimer: 0,
            temperature: 0
        };
        
        // Effects
        this.dustParticles = null;
        this.radiationEffect = null;
        this.fogEffect = null;
        
        // Initialize
        this.init();
    }
    
    init() {
        // Create dust particles
        this.createDustParticles();
        
        // Create radiation effect (post-processing would be better but keeping it simple)
        this.createRadiationEffect();
        
        // Create fog
        this.scene.fog = new THREE.FogExp2(0xd4c5b5, 0.005);
        this.fogEffect = this.scene.fog;
    }
    
    createDustParticles() {
        const particleCount = 5000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        
        // Create particles in a large volume around the camera
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Position in a large cube around origin
            positions[i3] = (Math.random() - 0.5) * 200;
            positions[i3 + 1] = Math.random() * 50;
            positions[i3 + 2] = (Math.random() - 0.5) * 200;
            
            // Random velocity
            velocities[i3] = (Math.random() - 0.5) * 2;
            velocities[i3 + 1] = Math.random() * 0.2;
            velocities[i3 + 2] = (Math.random() - 0.5) * 2;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xbf5e3d,
            size: 0.2,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.dustParticles = new THREE.Points(geometry, material);
        this.scene.add(this.dustParticles);
    }
    
    createRadiationEffect() {
        // Create a colored overlay for radiation effect
        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });
        
        this.radiationEffect = new THREE.Mesh(geometry, material);
        this.radiationEffect.position.z = -1;
        
        // Add to camera instead of scene for overlay effect
        this.camera.add(this.radiationEffect);
    }
    
    update(delta) {
        // Update dust storm
        this.updateDustStorm(delta);
        
        // Update radiation storm
        this.updateRadiationStorm(delta);
        
        // Random chance to start environmental events
        this.checkStartEvents(delta);
    }
    
    updateDustStorm(delta) {
        if (this.state.isDustStorm) {
            // Update dust storm timer
            this.state.dustStormTimer -= delta;
            
            if (this.state.dustStormTimer <= 0) {
                // End dust storm
                this.endDustStorm();
            } else {
                // Update dust particles
                this.animateDustParticles(delta);
                
                // Adjust fog density based on storm intensity
                if (this.fogEffect) {
                    this.fogEffect.density = 0.005 + this.state.dustStormIntensity * 0.05;
                }
            }
        }
    }
    
    animateDustParticles(delta) {
        if (!this.dustParticles) return;
        
        const positions = this.dustParticles.geometry.attributes.position.array;
        const velocities = this.dustParticles.geometry.attributes.velocity.array;
        
        // Get camera position to keep particles around player
        const cameraPosition = new THREE.Vector3();
        this.camera.getWorldPosition(cameraPosition);
        
        // Update each particle
        for (let i = 0; i < positions.length; i += 3) {
            // Move particle based on velocity
            positions[i] += velocities[i] * delta * 10;
            positions[i + 1] += velocities[i + 1] * delta * 10;
            positions[i + 2] += velocities[i + 2] * delta * 10;
            
            // Reset particles that go too far from camera
            const dx = positions[i] - cameraPosition.x;
            const dy = positions[i + 1] - cameraPosition.y;
            const dz = positions[i + 2] - cameraPosition.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (distance > 100) {
                // Reset position to random location near camera
                positions[i] = cameraPosition.x + (Math.random() - 0.5) * 200;
                positions[i + 1] = cameraPosition.y + Math.random() * 50;
                positions[i + 2] = cameraPosition.z + (Math.random() - 0.5) * 200;
                
                // Reset velocity
                velocities[i] = (Math.random() - 0.5) * 2;
                velocities[i + 1] = Math.random() * 0.2;
                velocities[i + 2] = (Math.random() - 0.5) * 2;
            }
        }
        
        // Update geometry
        this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }
    
    updateRadiationStorm(delta) {
        if (this.state.isRadiationStorm) {
            // Update radiation storm timer
            this.state.radiationTimer -= delta;
            
            if (this.state.radiationTimer <= 0) {
                // End radiation storm
                this.endRadiationStorm();
            } else {
                // Pulse radiation effect
                if (this.radiationEffect) {
                    const pulseFrequency = 2; // Hz
                    const pulseAmount = 0.2;
                    const baseOpacity = this.state.radiationIntensity;
                    
                    const pulse = Math.sin(Date.now() / 1000 * pulseFrequency * Math.PI) * pulseAmount;
                    this.radiationEffect.material.opacity = baseOpacity + pulse * baseOpacity;
                }
            }
        }
    }
    
    checkStartEvents(delta) {
        // Check for dust storm
        if (!this.state.isDustStorm) {
            const dustStormRoll = Math.random();
            if (dustStormRoll < this.options.dustStormProbability * delta) {
                this.startDustStorm();
            }
        }
        
        // Check for radiation storm
        if (!this.state.isRadiationStorm) {
            const radiationRoll = Math.random();
            if (radiationRoll < this.options.radiationProbability * delta) {
                this.startRadiationStorm();
            }
        }
    }
    
    startDustStorm() {
        // Set dust storm state
        this.state.isDustStorm = true;
        this.state.dustStormIntensity = this.options.dustStormIntensity.min + 
            Math.random() * (this.options.dustStormIntensity.max - this.options.dustStormIntensity.min);
        
        this.state.dustStormTimer = this.options.dustStormDuration.min + 
            Math.random() * (this.options.dustStormDuration.max - this.options.dustStormDuration.min);
        
        // Show dust particles
        if (this.dustParticles) {
            this.dustParticles.material.opacity = this.state.dustStormIntensity;
        }
        
        // Increase fog density
        if (this.fogEffect) {
            this.fogEffect.density = 0.005 + this.state.dustStormIntensity * 0.05;
        }
        
        // Trigger notification
        this.triggerNotification("Dust storm approaching! Seek shelter.");
        
        return {
            type: 'dustStorm',
            intensity: this.state.dustStormIntensity,
            duration: this.state.dustStormTimer
        };
    }
    
    endDustStorm() {
        // Reset dust storm state
        this.state.isDustStorm = false;
        
        // Hide dust particles
        if (this.dustParticles) {
            this.dustParticles.material.opacity = 0;
        }
        
        // Reset fog density
        if (this.fogEffect) {
            this.fogEffect.density = 0.005;
        }
        
        // Trigger notification
        this.triggerNotification("Dust storm subsiding.");
    }
    
    startRadiationStorm() {
        // Set radiation storm state
        this.state.isRadiationStorm = true;
        this.state.radiationIntensity = this.options.radiationIntensity.min + 
            Math.random() * (this.options.radiationIntensity.max - this.options.radiationIntensity.min);
        
        this.state.radiationTimer = this.options.radiationDuration.min + 
            Math.random() * (this.options.radiationDuration.max - this.options.radiationDuration.min);
        
        // Show radiation effect
        if (this.radiationEffect) {
            this.radiationEffect.material.opacity = this.state.radiationIntensity;
        }
        
        // Trigger notification
        this.triggerNotification("WARNING: Radiation levels increasing! Seek shelter immediately.");
        
        return {
            type: 'radiationStorm',
            intensity: this.state.radiationIntensity,
            duration: this.state.radiationTimer
        };
    }
    
    endRadiationStorm() {
        // Reset radiation storm state
        this.state.isRadiationStorm = false;
        
        // Hide radiation effect
        if (this.radiationEffect) {
            this.radiationEffect.material.opacity = 0;
        }
        
        // Trigger notification
        this.triggerNotification("Radiation levels returning to normal.");
    }
    
    triggerNotification(message) {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.style.display = 'block';
            
            // Hide after 5 seconds
            setTimeout(() => {
                notification.style.display = 'none';
            }, 5000);
        }
    }
    
    // Get current environment state
    getState() {
        return { ...this.state };
    }
    
    // Force start a dust storm (for testing or scripted events)
    forceDustStorm(duration = 60, intensity = 0.6) {
        this.endDustStorm(); // End any current storm
        
        this.state.dustStormIntensity = intensity;
        this.state.dustStormTimer = duration;
        
        return this.startDustStorm();
    }
    
    // Force start a radiation storm (for testing or scripted events)
    forceRadiationStorm(duration = 60, intensity = 0.4) {
        this.endRadiationStorm(); // End any current storm
        
        this.state.radiationIntensity = intensity;
        this.state.radiationTimer = duration;
        
        return this.startRadiationStorm();
    }
}