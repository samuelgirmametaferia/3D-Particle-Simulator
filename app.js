import { initBuffers } from "./init-buffers.js";
import { drawScene } from "./draw-scene.js";
import { mat4, vec3 } from "https://cdn.skypack.dev/gl-matrix?min";
import { initCamera, updateCameraPosition, getViewMatrix, camera } from "./camera.js";
import { initSkybox, drawSkybox } from "./skybox.js";
import { skyboxVertexShader, skyboxFragmentShader } from "./skyboxVertexShader.js";
import { RectangularContainer, handleContainerCollisions, handleParticleCollisions } from "./collision.js";
import { initContainerMesh } from "./container.js";

// --- UI Elements ---
let uiPanel, sphereColorPicker, morphCheckbox, fpsCounter,
  gravitySlider, gravityValueLabel, scaleSlider, scaleValueLabel,
  farSlider, farValueLabel, particleCountSlider, particleCountValue,
  particleSizeSlider, particleSizeValue, crossH, crossV;

// --- Global State ---
let sphereColor = [1.0, 1.0, 1.0];
let morphEnabled = false;
let startTime = null;
let gravityMagnitude;
let containerScale;
let farPlane;
let NUM_SPHERES;
let particleRadius;
let containerTexture;
// --- UI for dynamic particle effect ---

morphCheckbox = document.getElementById('morphCheckbox');
morphEnabled = morphCheckbox.checked;
morphCheckbox.addEventListener('change', (e) => {
  morphEnabled = e.target.checked;
});
startTime = null;

sphereColorPicker = document.getElementById('sphereColorPicker');
sphereColor = [1.0, 1.0, 1.0];
sphereColorPicker.addEventListener('input', (e) => {
  const hex = e.target.value;
  sphereColor = [
    parseInt(hex.substr(1, 2), 16) / 255,
    parseInt(hex.substr(3, 2), 16) / 255,
    parseInt(hex.substr(5, 2), 16) / 255
  ];
});
// Vertex shader supporting instanced model matrices
let VertexShader = `
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec3 aVelocity;       


// per-instance matrix columns
attribute vec4 aInstanceMatrix0;
attribute vec4 aInstanceMatrix1;
attribute vec4 aInstanceMatrix2;
attribute vec4 aInstanceMatrix3;

uniform float uParticleRadius; 
uniform float uTime;
uniform bool uMorph; 
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;
varying highp vec3 vTransformedNormal;
varying highp vec3 vPosition;

varying float vSpeed; 

void main(void) {
    vSpeed = length(aVelocity);
    mat4 modelMatrix = mat4(aInstanceMatrix0, aInstanceMatrix1, aInstanceMatrix2, aInstanceMatrix3);
    mat4 modelViewMatrix = uViewMatrix * modelMatrix;

    vec3 finalPosition = aVertexPosition;
    vec3 finalNormal = aVertexNormal;

    if (uMorph) {
        float wave = sin(uTime * 2.0 + aVertexPosition.y * 5.0 + modelMatrix[3].x * 0.5) * 0.1;
        finalPosition += aVertexNormal * wave;

        // Optional: normal warping to match shape distortion
        finalNormal = normalize(aVertexNormal + 0.2 * sin(uTime + aVertexPosition * 3.0));
    }

    vec4 vertexPos = modelViewMatrix * vec4(finalPosition * uParticleRadius, 1.0);
    vPosition = vertexPos.xyz;

    vTransformedNormal = uNormalMatrix * finalNormal;

    gl_Position = uProjectionMatrix * vertexPos;
}
`;

const FragmentShader = `
precision mediump float;

uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform vec3 uViewPosition;

uniform vec3 SphereColor;
uniform bool uColorByVelocity;

uniform float uMinSpeed;
uniform float uMaxSpeed;
varying highp vec3 vTransformedNormal;
varying highp vec3 vPosition;
varying float vSpeed;


vec3 hueToRGB(float hue) {
    float r = clamp(abs(hue - 3.0) - 1.0, 0.0, 1.0);
    float g = clamp(2.0 - abs(hue - 2.0), 0.0, 1.0);
    float b = clamp(2.0 - abs(hue - 4.0), 0.0, 1.0);
    return vec3(r, g, b);
}
float EaseFunc(float _in)
{
    return (2.*pow(_in-0.5, 2.0)+0.5);
}
vec3 pow3d(vec3 v, float p) {
    return vec3(
        pow(v.x, p),
        pow(v.y, p),
        pow(v.z, p)
    );
}
void main(void) {
    vec3 color;
    vec3 normal = normalize(vTransformedNormal);
    vec3 lightDir = normalize(uLightDirection);
    vec3 viewDir = normalize(uViewPosition - vPosition);

    // Diffuse (Half-Lambert)
    float NdotL = max(dot(normal, lightDir), 0.0);
    float halfLambert = NdotL * 0.5 + 0.5;

    if (uColorByVelocity) {
      float t = EaseFunc(clamp((vSpeed - uMinSpeed) / (uMaxSpeed - uMinSpeed), 0.0, 1.0));
      vec3 a = vec3(1.,0.,0.);
      vec3 b = vec3(0.,0.,1.0);
      color = mix(a,b,t);
    } else {
      color = SphereColor;
    }
    
    vec3 diffuse = halfLambert * color * uLightColor;
    
    // Specular (Blinn-Phong + Fresnel)
    vec3 halfVector = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfVector), 0.0);
    float spec = pow(NdotH, 64.0) * 0.4;
    spec *= step(0.0, NdotL);
    
    // Fresnel (Schlick approximation)
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 5.0);
    fresnel = mix(0.1, 1.0, fresnel);
    vec3 specular = spec * fresnel * uLightColor;

    // Rim light
    float rim = 1.0 - max(dot(viewDir, normal), 0.0);
    rim = smoothstep(0.4, 1.0, rim);
    vec3 rimColor = vec3(0.3, 0.5, 1.0) * rim * 0.25;

    // Combine lighting
    vec3 finalColor = uAmbientColor * 0.5 + diffuse + specular + rimColor;

    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0 / 2.2));

    gl_FragColor = vec4(finalColor, 1.0);
    
   
}


`;
// Update grid shader for textured container
const GridVertexShader = `
attribute vec3 aVertexPosition;
attribute vec2 aTexCoord;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vTexCoord;
void main(void) {
  gl_Position = uProjectionMatrix * uViewMatrix * vec4(aVertexPosition, 1.0);
  vTexCoord = aTexCoord;
}`;
const GridFragmentShader = `
precision mediump float;
uniform sampler2D uTexture;
uniform vec4 uColor;
varying vec2 vTexCoord;
void main(void) {
  vec4 texColor = texture2D(uTexture, vTexCoord);
  gl_FragColor = texColor * uColor;
}`;

// Get the canvas element.
// full-window canvas
const canvas = document.getElementById("canvas");
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (gl) {
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
  }
}

function initUI() {
  uiPanel = document.getElementById('uiPanel');
  fpsCounter = document.getElementById("fpsCounter");

  sphereColorPicker = document.getElementById('sphereColorPicker');
  sphereColorPicker.addEventListener('input', (e) => {
    const hex = e.target.value;
    sphereColor = [
      parseInt(hex.substr(1, 2), 16) / 255,
      parseInt(hex.substr(3, 2), 16) / 255,
      parseInt(hex.substr(5, 2), 16) / 255
    ];
  });


  // Coloring Modes 
  const colorModeSelect = document.getElementById("colorModeSelect");
  const sphereColorContainer = document.getElementById("sphereColorContainer");

  colorModeSelect.addEventListener("change", () => {
    const mode = colorModeSelect.value;

    // Toggle color picker visibility
    if (mode === "solid") {
      sphereColorContainer.style.display = "block";
    } else {
      sphereColorContainer.style.display = "none";
    }
  });

  // Sliders
  gravitySlider = document.getElementById('gravitySlider');
  gravityValueLabel = document.getElementById('gravityValue');
  gravityMagnitude = parseFloat(gravitySlider.value);
  gravitySlider.addEventListener('input', (e) => {
    gravityMagnitude = parseFloat(e.target.value);
    gravityValueLabel.textContent = gravityMagnitude.toFixed(1);
  });

  scaleSlider = document.getElementById('scaleSlider');

  scaleValueLabel = document.getElementById('scaleValue');
  containerScale = parseFloat(scaleSlider.value);
  //initial scale setup
  scaleValueLabel.textContent = containerScale.toFixed(1);
  const halfExt = (GRID_COLS / 2) * GRID_SPACING * containerScale;
  container.min = [-halfExt, -halfExt, -halfExt];
  container.max = [halfExt, halfExt, halfExt];
  const cm = initContainerMesh(gl, [-halfExt, -halfExt, -halfExt], [halfExt, halfExt, halfExt]);
  containerMesh.position = cm.position;
  containerMesh.normal = cm.normal;
  containerMesh.indices = cm.indices;
  containerMesh.indexCount = cm.indexCount;
  containerMesh.texCoord = cm.texCoord; // Make sure to update texCoords too
  scaleSlider.addEventListener('input', (e) => {
    containerScale = parseFloat(e.target.value);
    scaleValueLabel.textContent = containerScale.toFixed(1);
    const halfExt = (GRID_COLS / 2) * GRID_SPACING * containerScale;
    container.min = [-halfExt, -halfExt, -halfExt];
    container.max = [halfExt, halfExt, halfExt];
    const cm = initContainerMesh(gl, [-halfExt, -halfExt, -halfExt], [halfExt, halfExt, halfExt]);
    containerMesh.position = cm.position;
    containerMesh.normal = cm.normal;
    containerMesh.indices = cm.indices;
    containerMesh.indexCount = cm.indexCount;
    containerMesh.texCoord = cm.texCoord; // Make sure to update texCoords too
  });

  farSlider = document.getElementById('farSlider');
  farValueLabel = document.getElementById('farValue');
  farPlane = parseFloat(farSlider.value);
  farSlider.addEventListener('input', (e) => {
    farPlane = parseFloat(e.target.value);
    farValueLabel.textContent = e.target.value;
  });

  particleCountSlider = document.getElementById('particleCountSlider');
  particleCountValue = document.getElementById('particleCountValue');
  NUM_SPHERES = parseInt(particleCountSlider.value);
  particleCountValue.textContent = NUM_SPHERES;
  particleCountSlider.addEventListener('input', (e) => {
    const newCount = parseInt(e.target.value);
    particleCountValue.textContent = newCount;
    NUM_SPHERES = newCount;
    regenerateParticles(newCount);
  });

  particleSizeSlider = document.getElementById('particleSizeSlider');
  particleSizeValue = document.getElementById('particleSizeValue');
  particleRadius = parseFloat(particleSizeSlider.value);
  particleSizeSlider.addEventListener('input', (e) => {
    particleRadius = parseFloat(e.target.value);
    particleSizeValue.textContent = particleRadius.toFixed(2);

    // Update the radius for each particle to adjust collider size
    particles.forEach(particle => {
      particle.radius = particleRadius;
    });

  });

  // Crosshair
  crossH = document.getElementById('crosshair-horizontal');
  crossV = document.getElementById('crosshair-vertical');
  window.addEventListener('resize', updateCrosshair);
  updateCrosshair();
}

// Initialize WebGL context first.
function initGL(canvas) {
  let gl;
  try {
    gl = canvas.getContext("webgl");
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
  } catch (e) { }
  if (!gl) {
    alert("Could not initialise WebGL!");
  }
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // Set clear color to black
  return gl;
}
const gl = initGL(canvas);

// Basic shader loader.
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const infoLog = gl.getShaderInfoLog(shader);
    alert("An error occurred compiling the shader:\n" + infoLog);
    console.error("Shader failed to compile:\n", infoLog);
    return null;
  }
  return shader;
}

// Initialize main shader program.
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Unable to initialize the shader program! Please check your shader code.");
    return null;
  }
  return shaderProgram;
}

// Initialize skybox shader program.
function initSkyboxShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Unable to initialize skybox shader program!");
    return null;
  }
  return shaderProgram;
}

// Initialize camera.
initCamera(canvas);

// Initialize skybox and its shader.
const skybox = initSkybox(gl);
const skyboxShaderProgram = initSkyboxShaderProgram(gl, skyboxVertexShader, skyboxFragmentShader);
const skyboxProgramInfo = {
  program: skyboxShaderProgram,
  attribLocations: {
    vertexPosition: gl.getAttribLocation(skyboxShaderProgram, "aVertexPosition"),
  },
  uniformLocations: {
    projectionMatrix: gl.getUniformLocation(skyboxShaderProgram, "projectionMatrix"),
    viewMatrix: gl.getUniformLocation(skyboxShaderProgram, "viewMatrix"),
    uSkybox: gl.getUniformLocation(skyboxShaderProgram, "uSkybox"),
  }
};

// Initialize main shader program and buffers.
const shaderProgram = initShaderProgram(gl, VertexShader, FragmentShader);
const programInfo = {
  program: shaderProgram,
  attribLocations: {
    vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
    vertexNormal: gl.getAttribLocation(shaderProgram, "aVertexNormal"),
    aInstanceMatrix0: gl.getAttribLocation(shaderProgram, "aInstanceMatrix0"),
    aInstanceMatrix1: gl.getAttribLocation(shaderProgram, "aInstanceMatrix1"),
    aInstanceMatrix2: gl.getAttribLocation(shaderProgram, "aInstanceMatrix2"),
    aInstanceMatrix3: gl.getAttribLocation(shaderProgram, "aInstanceMatrix3"),
  },
  uniformLocations: {
    projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
    viewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
    normalMatrix: gl.getUniformLocation(shaderProgram, "uNormalMatrix"),
    uLightDirection: gl.getUniformLocation(shaderProgram, "uLightDirection"),
    uLightColor: gl.getUniformLocation(shaderProgram, "uLightColor"),
    uAmbientColor: gl.getUniformLocation(shaderProgram, "uAmbientColor"),
    uViewPosition: gl.getUniformLocation(shaderProgram, "uViewPosition"),
    uParticleRadius: gl.getUniformLocation(shaderProgram, "uParticleRadius"),
    uTime: gl.getUniformLocation(shaderProgram, "uTime"),
    uMorph: gl.getUniformLocation(shaderProgram, "uMorph"),
    SphereColor: gl.getUniformLocation(shaderProgram, "SphereColor"),
  },
};
// Initialize grid shader program for container
const gridShaderProgram = initShaderProgram(gl, GridVertexShader, GridFragmentShader);
const gridProgramInfo = {
  program: gridShaderProgram,
  attribLocations: {
    vertexPosition: gl.getAttribLocation(gridShaderProgram, 'aVertexPosition'),
  },
  uniformLocations: {
    projectionMatrix: gl.getUniformLocation(gridShaderProgram, 'uProjectionMatrix'),
    viewMatrix: gl.getUniformLocation(gridShaderProgram, 'uViewMatrix'),
    color: gl.getUniformLocation(gridShaderProgram, 'uColor'),
  },
};
gridProgramInfo.attribLocations.texCoord = gl.getAttribLocation(gridShaderProgram, 'aTexCoord');
gridProgramInfo.uniformLocations.uTexture = gl.getUniformLocation(gridShaderProgram, 'uTexture');
console.log("vertexPosition attribute location:", programInfo.attribLocations.vertexPosition);
// Grid and container setup
const GRID_COLS = 20;
const GRID_SPACING = 2.0;
const buffers = initBuffers(gl);
// dynamic particle arrays
let sphereModelMatrices = [];
let particles = [];

function regenerateParticles(count) {
  sphereModelMatrices.length = 0;
  particles.length = 0;
  for (let i = 0; i < count; i++) {
    const modelMatrix = mat4.create();
    const x = ((i % GRID_COLS) - GRID_COLS / 2) * GRID_SPACING;
    const y = ((Math.floor(i / (GRID_COLS * GRID_COLS)) - GRID_COLS / 2)) * GRID_SPACING;
    const z = ((Math.floor((i % (GRID_COLS * GRID_COLS)) / GRID_COLS) - GRID_COLS / 2)) * GRID_SPACING;
    mat4.translate(modelMatrix, modelMatrix, [x, y, z]);
    sphereModelMatrices.push(modelMatrix);
    particles.push({ position: [modelMatrix[12], modelMatrix[13], modelMatrix[14]], velocity: [0, 0, 0], radius: 1 });
  }
}

// Create rectangular container enclosing the grid (scaled up)
const halfExtent = (GRID_COLS / 2) * GRID_SPACING * containerScale;
const container = new RectangularContainer(
  [-halfExtent, -halfExtent, -halfExtent],
  [halfExtent, halfExtent, halfExtent]
);
// Initialize render mesh for the container (will update on scale change)
let containerMesh = initContainerMesh(gl,
  [-halfExtent, -halfExtent, -halfExtent],
  [halfExtent, halfExtent, halfExtent]
);

// Globals for raycasting
let currentProjectionMatrix = mat4.create();
let currentViewMatrix = mat4.create();
// Interaction for container-bound push/pull
let interactionActive = false;
let interactionMode = 'push'; // 'push' or 'pull'
let interactionPoint = vec3.create();
// Ray-AABB intersection helper
function intersectRayAABB(origin, dir, min, max) {
  let tmin = (min[0] - origin[0]) / dir[0];
  let tmax = (max[0] - origin[0]) / dir[0];
  if (tmin > tmax) [tmin, tmax] = [tmax, tmin];
  for (let i = 1; i < 3; i++) {
    let t1 = (min[i] - origin[i]) / dir[i];
    let t2 = (max[i] - origin[i]) / dir[i];
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (tmin > t2 || t1 > tmax) return null;
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  return tmin >= 0 ? tmin : (tmax >= 0 ? tmax : null);
}
// Mouse move/up handlers to update interaction point
function onMouseMove(event) {
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((event.clientX - rect.left) / canvas.width) * 2 - 1;
  const ndcY = 1 - ((event.clientY - rect.top) / canvas.height) * 2;
  const invPV = mat4.create();
  mat4.mul(invPV, currentProjectionMatrix, currentViewMatrix);
  mat4.invert(invPV, invPV);
  const nearP = vec3.transformMat4([], [ndcX, ndcY, -1], invPV);
  const farP = vec3.transformMat4([], [ndcX, ndcY, 1], invPV);
  const rayDir = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), farP, nearP));
  const origin = [...camera.position];
  const t = intersectRayAABB(origin, rayDir, container.min, container.max);
  if (t !== null) vec3.scaleAndAdd(interactionPoint, origin, rayDir, t);
}
function onMouseUp() {
  interactionActive = false;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
}

// Setup container push/pull on mouse down
const canvasEl = document.getElementById('canvas');
canvasEl.addEventListener('contextmenu', e => e.preventDefault());
canvasEl.addEventListener('mousedown', event => {
  event.preventDefault();
  // start interaction if ray hits container
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((event.clientX - rect.left) / canvas.width) * 2 - 1;
  const ndcY = 1 - ((event.clientY - rect.top) / canvas.height) * 2;
  const invPV = mat4.create();
  mat4.mul(invPV, currentProjectionMatrix, currentViewMatrix);
  mat4.invert(invPV, invPV);
  const nearP = vec3.transformMat4([], [ndcX, ndcY, -1], invPV);
  const farP = vec3.transformMat4([], [ndcX, ndcY, 1], invPV);
  const rayDir = vec3.normalize(vec3.create(), vec3.subtract(vec3.create(), farP, nearP));
  const origin = [...camera.position];
  const t = intersectRayAABB(origin, rayDir, container.min, container.max);
  if (t !== null) {
    interactionActive = true;
    interactionMode = (event.button === 2 ? 'pull' : 'push');
    vec3.scaleAndAdd(interactionPoint, origin, rayDir, t);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
});
//Setup Coloring modes

const colorModeSelect = document.getElementById("colorModeSelect");
let useVelocityColor = (colorModeSelect.value === "velocity");

colorModeSelect.addEventListener("change", evt => {
  useVelocityColor = (colorModeSelect.value === "velocity");
});
const velocityBuffer = gl.createBuffer();
const aVelocityLocation = gl.getAttribLocation(programInfo.program, "aVelocity");
// Render loop.
let lastTime = 0;
function animate(time) {
  if (startTime === null) startTime = time;
  const deltaTime = (time - lastTime) / 1000;
  lastTime = time;
  const elapsed = (time - startTime) / 1000;
  // Update FPS display
  const fps = 1 / deltaTime;
  fpsCounter.textContent = `FPS: ${fps.toFixed(1)}`;
  updateCameraPosition(deltaTime);
  // Apply gravity to particles
  // dynamic gravity
  const gravity = [0, -gravityMagnitude, 0];
  particles.forEach(p => vec3.scaleAndAdd(p.velocity, p.velocity, gravity, deltaTime));

  // Set up projection matrix.
  const projectionMatrix = mat4.create();
  const fieldOfView = (45 * Math.PI) / 180;
  const aspect = canvas.clientWidth / canvas.clientHeight;
  mat4.perspective(projectionMatrix, fieldOfView, aspect, 0.1, farPlane);

  // Get updated view matrix.
  const viewMatrix = getViewMatrix();

  // Compute normal matrix from the view matrix.
  const normalMatrix = mat3.create();
  mat3.fromMat4(normalMatrix, viewMatrix);
  mat3.invert(normalMatrix, normalMatrix);
  mat3.transpose(normalMatrix, normalMatrix);

  // Clear color and depth buffers.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Draw container with grid shader
  gl.useProgram(gridProgramInfo.program);
  gl.uniformMatrix4fv(gridProgramInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(gridProgramInfo.uniformLocations.viewMatrix, false, viewMatrix);
  gl.uniform4fv(gridProgramInfo.uniformLocations.color, [0.0, 1.0, 1.0, 0.7]); // Neon cyan for the grid

  // Bind texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, containerTexture);
  gl.uniform1i(gridProgramInfo.uniformLocations.uTexture, 0);

  // Bind container position buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, containerMesh.position);
  gl.vertexAttribPointer(gridProgramInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(gridProgramInfo.attribLocations.vertexPosition);

  // Bind texCoord buffer
  if (containerMesh.texCoord) {
    gl.bindBuffer(gl.ARRAY_BUFFER, containerMesh.texCoord);
    gl.vertexAttribPointer(gridProgramInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gridProgramInfo.attribLocations.texCoord);
  }

  // Bind indices and draw triangles
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, containerMesh.indices);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawElements(gl.TRIANGLES, containerMesh.indexCount, gl.UNSIGNED_SHORT, 0);
  gl.disable(gl.BLEND);
  gl.depthMask(true);


  // Draw the main scene (spheres)
  gl.useProgram(programInfo.program);
  const fixedLightDir = vec3.fromValues(0.5, 0.7, 1.0);
  vec3.normalize(fixedLightDir, fixedLightDir);
  gl.uniform3fv(programInfo.uniformLocations.uLightDirection, fixedLightDir);
  gl.uniform3fv(programInfo.uniformLocations.uLightColor, [1.0, 1.0, 1.0]);
  gl.uniform3fv(programInfo.uniformLocations.uAmbientColor, [0.2, 0.2, 0.2]);

  //Setup Color

  gl.uniform1i(gl.getUniformLocation(programInfo.program, "uColorByVelocity"), useVelocityColor ? 1 : 0);

  if (useVelocityColor) {
    let minSpeed = 0;
    let maxSpeed = 150;
    particles.forEach(p => {
      const speed = vec3.length(p.velocity);
      if (speed < minSpeed) minSpeed = speed;
      if (speed > maxSpeed) maxSpeed = speed;
    });

    // Handle edge case if all speeds are equal (avoid division by zero)
    if (minSpeed === maxSpeed) {
      maxSpeed = minSpeed + 0.0001;
    }

    gl.uniform1f(gl.getUniformLocation(programInfo.program, "uMinSpeed"), minSpeed);
    gl.uniform1f(gl.getUniformLocation(programInfo.program, "uMaxSpeed"), maxSpeed);
  } else {
    gl.uniform3fv(programInfo.uniformLocations.SphereColor, sphereColor);
  }

  //Particle Size stuff
  gl.uniform1f(programInfo.uniformLocations.uTime, morphEnabled ? elapsed : 0.0);
  gl.uniform1i(programInfo.uniformLocations.uMorph, morphEnabled ? 1 : 0);
  gl.uniform1f(programInfo.uniformLocations.uParticleRadius, particleRadius);
  //Send Velocity Buffer it is mid night :(
  // Flatten current velocities each frame
  const velocities = [];
  particles.forEach(p => {
    velocities.push(p.velocity[0], p.velocity[1], p.velocity[2]);
  });

  // Bind and update buffer data every frame
  gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(velocities), gl.DYNAMIC_DRAW);

  // Setup the attribute pointer for 'aVelocity'

  gl.enableVertexAttribArray(aVelocityLocation);
  gl.vertexAttribPointer(aVelocityLocation, 3, gl.FLOAT, false, 0, 0);

  // Update physics and handle collisions
  // Integrate positions
  particles.forEach((p) => {
    vec3.scaleAndAdd(p.position, p.position, p.velocity, deltaTime);
  });
  // Container-bound collisions
  handleContainerCollisions(particles, container);
  // Particle-particle collisions for fluid-like behavior
  handleParticleCollisions(particles);
  // Sphere-sphere collisions
  handleParticleCollisions(particles);
  // Update model matrices from particle positions
  particles.forEach((p, i) => {
    const m = sphereModelMatrices[i];
    mat4.fromTranslation(m, p.position);
  });
  // continuous push/pull toward interaction point
  if (interactionActive) {
    const forceStrength = 100;
    const tmp = vec3.create();
    particles.forEach(p => {
      vec3.subtract(tmp, interactionPoint, p.position);
      const dist = vec3.length(tmp);
      if (dist > 0.01) {
        vec3.normalize(tmp, tmp);
        const dir = interactionMode === 'push' ? vec3.scale(vec3.create(), tmp, -1) : tmp;
        vec3.scaleAndAdd(p.velocity, p.velocity, dir, forceStrength * deltaTime);
      }
    });
  }

  // Draw all spheres at updated positions
  drawScene(gl, programInfo, buffers, projectionMatrix, viewMatrix, camera.position, sphereModelMatrices);

  // Then draw the skybox behind it.
  drawSkybox(gl, skyboxProgramInfo, skybox, viewMatrix, projectionMatrix);

  // Update current matrices for raycasting
  currentProjectionMatrix = projectionMatrix;
  currentViewMatrix = viewMatrix;

  requestAnimationFrame(animate);
}

// Start the render loop.
function main() {
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  initUI();
  initCamera(canvas);
  containerTexture = loadTexture(gl, 'images/front.png');
  regenerateParticles(NUM_SPHERES); // Initial particle generation


  requestAnimationFrame(animate);
}
main();

function updateCrosshair() {
  const rect = canvas.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  crossH.style.left = cx + 'px';
  crossH.style.top = cy + 'px';
  crossV.style.left = cx + 'px';
  crossV.style.top = cy + 'px';
}

// Texture loader
function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  const image = new Image();
  image.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
  };
  image.src = url;
  return texture;
}