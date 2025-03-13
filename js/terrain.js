import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.0/build/three.module.js';
import { ImprovedNoise } from 'https://cdn.jsdelivr.net/npm/three@0.152.0/examples/jsm/math/ImprovedNoise.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon@0.6.2/build/cannon.min.js';

// Terrain generation class inspired by Three.js terrain example
export class MartianTerrain {
    constructor(scene, world, options = {}) {
        this.scene = scene;
        this.world = world;
        
        // Default options
        this.options = {
            width: 256,
            depth: 256,
            scale: 300,
            height: 10,
            segments: 256,
            smoothing: 4,
            color: 0xbf5e3d, // Mars reddish-brown
            ...options
        };
        
        this.terrain = null;
        this.terrainBody = null;
        this.heightData = null;
    }
    
    generate() {
        const { width, depth, scale, height, segments, smoothing, color } = this.options;
        
        // Generate height data
        this.heightData = this.generateHeight(width, depth, smoothing);
        
        // Create geometry
        const geometry = new THREE.PlaneGeometry(scale, scale, segments - 1, segments - 1);
        geometry.rotateX(-Math.PI / 2);
        
        const vertices = geometry.attributes.position.array;
        
        // Apply height data to vertices
        for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
            vertices[j + 1] = this.heightData[i] * height;
        }
        
        // Update normals for lighting
        geometry.computeVertexNormals();
        
        // Create material with Mars-like appearance
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.1,
            roughness: 0.9,
            flatShading: false
        });
        
        // Create mesh
        this.terrain = new THREE.Mesh(geometry, material);
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);
        
        // Create physics for terrain
        this.addTerrainPhysics();
        
        return this.terrain;
    }
    
    generateHeight(width, depth, smoothing) {
        const size = width * depth;
        const data = new Float32Array(size);
        const perlin = new ImprovedNoise();
        const z = Math.random() * 100;
        
        let quality = 1;
        
        // Apply multiple passes of noise with different frequencies
        for (let j = 0; j < smoothing; j++) {
            for (let i = 0; i < size; i++) {
                const x = i % width;
                const y = ~~(i / width);
                
                // Use Perlin noise for natural-looking terrain
                // Add absolute value to create more Mars-like terrain with craters
                data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality);
            }
            
            quality *= 5;
        }
        
        // Add craters to make it more Mars-like
        this.addCraters(data, width, depth);
        
        return data;
    }
    
    addCraters(data, width, depth) {
        const numCraters = 15 + Math.floor(Math.random() * 10);
        
        for (let i = 0; i < numCraters; i++) {
            // Random crater position
            const craterX = Math.floor(Math.random() * width);
            const craterY = Math.floor(Math.random() * depth);
            
            // Random crater size
            const craterRadius = 5 + Math.random() * 15;
            const craterDepth = 0.2 + Math.random() * 0.5;
            
            // Create crater depression
            for (let y = 0; y < depth; y++) {
                for (let x = 0; x < width; x++) {
                    const distance = Math.sqrt(
                        Math.pow(x - craterX, 2) + 
                        Math.pow(y - craterY, 2)
                    );
                    
                    if (distance < craterRadius) {
                        // Create crater shape using cosine function
                        const factor = (distance / craterRadius);
                        const craterFactor = Math.cos(factor * Math.PI / 2);
                        const index = y * width + x;
                        
                        // Subtract from height to create depression
                        data[index] -= craterDepth * craterFactor;
                    }
                }
            }
            
            // Add a small rim around the crater
            for (let y = 0; y < depth; y++) {
                for (let x = 0; x < width; x++) {
                    const distance = Math.sqrt(
                        Math.pow(x - craterX, 2) + 
                        Math.pow(y - craterY, 2)
                    );
                    
                    if (distance >= craterRadius && distance < craterRadius + 2) {
                        const index = y * width + x;
                        data[index] += 0.1; // Small rim elevation
                    }
                }
            }
        }
        
        return data;
    }
    
    addTerrainPhysics() {
        const { width, depth, scale } = this.options;
        
        // Create heightfield shape for physics
        const heightfieldShape = new CANNON.Heightfield(this.heightData, {
            elementSize: scale / width
        });
        
        // Create physics body
        this.terrainBody = new CANNON.Body({ mass: 0 });
        this.terrainBody.addShape(heightfieldShape);
        
        // Position the physics body to match the visual terrain
        const halfWidth = width / 2;
        const halfDepth = depth / 2;
        this.terrainBody.position.set(-halfWidth, -5, -halfDepth);
        this.terrainBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        
        // Add to physics world
        this.world.addBody(this.terrainBody);
        
        return this.terrainBody;
    }
    
    // Add details like small rocks scattered across the terrain
    addDetails() {
        const { width, depth, scale } = this.options;
        const detailsGroup = new THREE.Group();
        
        // Add small rocks
        const rockCount = 200;
        const rockGeometries = [
            new THREE.DodecahedronGeometry(1, 0),
            new THREE.DodecahedronGeometry(0.8, 0),
            new THREE.DodecahedronGeometry(0.6, 0)
        ];
        
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0xa86032,
            metalness: 0.1,
            roughness: 0.9
        });
        
        for (let i = 0; i < rockCount; i++) {
            // Random position
            const x = (Math.random() - 0.5) * scale;
            const z = (Math.random() - 0.5) * scale;
            
            // Find height at this position
            const terrainX = Math.floor((x / scale + 0.5) * width);
            const terrainZ = Math.floor((z / scale + 0.5) * depth);
            
            if (terrainX >= 0 && terrainX < width && terrainZ >= 0 && terrainZ < depth) {
                const index = terrainZ * width + terrainX;
                const y = this.heightData[index] * this.options.height;
                
                // Create rock
                const rockGeometry = rockGeometries[Math.floor(Math.random() * rockGeometries.length)];
                const rock = new THREE.Mesh(rockGeometry, rockMaterial);
                
                // Scale and position
                const scale = 0.2 + Math.random() * 0.3;
                rock.scale.set(scale, scale, scale);
                rock.position.set(x, y + scale / 2, z);
                rock.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                
                rock.castShadow = true;
                rock.receiveShadow = true;
                
                detailsGroup.add(rock);
            }
        }
        
        this.scene.add(detailsGroup);
        return detailsGroup;
    }
    
    // Get height at a specific world position
    getHeightAt(x, z) {
        const { width, depth, scale, height } = this.options;
        
        // Convert world coordinates to terrain grid coordinates
        const terrainX = Math.floor((x / scale + 0.5) * width);
        const terrainZ = Math.floor((z / scale + 0.5) * depth);
        
        // Check if within bounds
        if (terrainX >= 0 && terrainX < width && terrainZ >= 0 && terrainZ < depth) {
            const index = terrainZ * width + terrainX;
            return this.heightData[index] * height;
        }
        
        return 0;
    }
}