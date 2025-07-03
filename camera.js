import { mat4, vec3 } from "https://cdn.skypack.dev/gl-matrix?min";

export const camera = {
    position: vec3.fromValues(0, 0, 6),
    velocity: vec3.fromValues(0, 0, 0),
    yaw: -Math.PI / 2,
    pitch: 0,
    acceleration: 10.0,  // units per second squared
    friction: 4.0,       // friction factor
    sensitivity: 0.001,
};

let keysPressed = {};

export function initCamera(canvas) {
    // Keyboard events
    window.addEventListener('keydown', (e) => { keysPressed[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false; });

    // Pointer lock (for mouse control)
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    canvas.onclick = () => { canvas.requestPointerLock(); };

    document.addEventListener('pointerlockchange', pointerLockChange, false);
    document.addEventListener('mozpointerlockchange', pointerLockChange, false);
}

function pointerLockChange() {
    const canvas = document.getElementById("canvas");
    if (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas) {
        document.addEventListener("mousemove", updateCameraRotation, false);
    } else {
        document.removeEventListener("mousemove", updateCameraRotation, false);
    }
}

function updateCameraRotation(e) {
    camera.yaw   += e.movementX * camera.sensitivity;
    camera.pitch -= e.movementY * camera.sensitivity;
    // Clamp pitch to avoid flipping.
    camera.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.pitch));
}

export function updateCameraPosition(deltaTime) {
    // Speed boost when holding Shift
    const speedFactor = keysPressed['shift'] ? 10.0 : 1.0;
    // Determine camera direction (ignore pitch for horizontal movement).
    const front = vec3.fromValues(
        Math.cos(camera.yaw),
        0,
        Math.sin(camera.yaw)
    );
    const right = vec3.create();
    vec3.cross(right, front, [0, 1, 0]);
    vec3.normalize(right, right);

    // Build input direction vector.
    let inputDir = vec3.create();
    if (keysPressed["w"]) {
        vec3.add(inputDir, inputDir, front);
    }
    if (keysPressed["s"]) {
        let negFront = vec3.create();
        vec3.scale(negFront, front, -1);
        vec3.add(inputDir, inputDir, negFront);
    }
    if (keysPressed["a"]) {
        let negRight = vec3.create();
        vec3.scale(negRight, right, -1);
        vec3.add(inputDir, inputDir, negRight);
    }
    if (keysPressed["d"]) {
        vec3.add(inputDir, inputDir, right);
    }
    // Vertical movement
    if (keysPressed["q"]) {
        inputDir[1] += 1;
    }
    if (keysPressed["e"]) {
        inputDir[1] -= 1;
    }
    
    // If there is input, accelerate in that direction.
    if (vec3.length(inputDir) > 0.0001) {
        vec3.normalize(inputDir, inputDir);
        let accelVec = vec3.create();
        // apply speed factor
        vec3.scale(accelVec, inputDir, camera.acceleration * speedFactor);
        // v += a * deltaTime
        vec3.scaleAndAdd(camera.velocity, camera.velocity, accelVec, deltaTime);
    }
    
    // Apply friction.
    // velocity -= velocity * friction * deltaTime
    let frictionVec = vec3.create();
    vec3.scale(frictionVec, camera.velocity, camera.friction * deltaTime);
    vec3.subtract(camera.velocity, camera.velocity, frictionVec);

    // Update camera position: pos += velocity * deltaTime.
    vec3.scaleAndAdd(camera.position, camera.position, camera.velocity, deltaTime);
}

export function getViewMatrix() {
    const front = getCameraFront();
    const center = vec3.create();
    vec3.add(center, camera.position, front);
    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, camera.position, center, [0, 1, 0]);
    return viewMatrix;
}

function getCameraFront() {
    const front = vec3.fromValues(
        Math.cos(camera.pitch) * Math.cos(camera.yaw),
        Math.sin(camera.pitch),
        Math.cos(camera.pitch) * Math.sin(camera.yaw)
    );
    vec3.normalize(front, front);
    return front;
}