import { initBuffers } from "./init-buffers.js";
import { drawScene } from "./draw-scene.js";
import { initCamera, updateCameraPosition, getViewMatrix, camera } from "./camera.js";
import { initSkybox, drawSkybox } from "./skybox.js";
import { skyboxVertexShader, skyboxFragmentShader } from "./skyboxVertexShader.js";

let VertexShader = `attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
  
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;
  
varying highp vec3 vTransformedNormal;
varying highp vec3 vPosition;
  
void main(void) {
    vec4 vertexPos = uModelViewMatrix * vec4(aVertexPosition, 1.0);
    vPosition = vertexPos.xyz;
    vTransformedNormal = uNormalMatrix * aVertexNormal;
    gl_Position = uProjectionMatrix * vertexPos;
}
`;

const FragmentShader = `
precision mediump float;
  
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform vec3 uViewPosition;
  
varying highp vec3 vTransformedNormal;
varying highp vec3 vPosition;
  
void main(void) {
    vec3 normal = normalize(vTransformedNormal);
    vec3 lightDir = normalize(uLightDirection);
    float diff = max(dot(normal, lightDir), 0.0);
  
    vec3 viewDir = normalize(uViewPosition - vPosition);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 16.0);
  
    vec3 finalColor = uAmbientColor + uLightColor * diff + uLightColor * spec;
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// Get the canvas element.
const canvas = document.getElementById("canvas");

// Initialize WebGL context first.
function initGL(canvas) {
    let gl;
    try {
        gl = canvas.getContext("webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch(e) { }
    if (!gl) {
        alert("Could not initialise WebGL!");
    }
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
    },
    uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
        normalMatrix: gl.getUniformLocation(shaderProgram, "uNormalMatrix"),
        uLightDirection: gl.getUniformLocation(shaderProgram, "uLightDirection"),
        uLightColor: gl.getUniformLocation(shaderProgram, "uLightColor"),
        uAmbientColor: gl.getUniformLocation(shaderProgram, "uAmbientColor"),
        uViewPosition: gl.getUniformLocation(shaderProgram, "uViewPosition"),
    },
};
console.log("vertexPosition attribute location:", programInfo.attribLocations.vertexPosition);
const buffers = initBuffers(gl);
  
// Render loop.
let lastTime = 0;
function animate(time) {
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;
    updateCameraPosition(deltaTime);
  
    // Set up projection matrix.
    const projectionMatrix = mat4.create();
    const fieldOfView = (45 * Math.PI) / 180;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(projectionMatrix, fieldOfView, aspect, 0.1, 100.0);
  
    // Get updated view matrix.
    const viewMatrix = getViewMatrix();
  
    // Compute normal matrix from the view matrix.
    const normalMatrix = mat3.create();
    mat3.fromMat4(normalMatrix, viewMatrix);
    mat3.invert(normalMatrix, normalMatrix);
    mat3.transpose(normalMatrix, normalMatrix);
  
    // Clear color and depth buffers.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Draw the main scene (sphere) first.
    gl.useProgram(programInfo.program);
    const fixedLightDir = vec3.fromValues(0.5, 0.7, 1.0);
    vec3.normalize(fixedLightDir, fixedLightDir);
    gl.uniform3fv(programInfo.uniformLocations.uLightDirection, fixedLightDir);
    gl.uniform3fv(programInfo.uniformLocations.uLightColor, [1.0, 1.0, 1.0]);
    gl.uniform3fv(programInfo.uniformLocations.uAmbientColor, [0.2, 0.2, 0.2]);
    drawScene(gl, programInfo, buffers, projectionMatrix, viewMatrix, normalMatrix, camera.position);

    // Then draw the skybox behind it.
    drawSkybox(gl, skyboxProgramInfo, skybox, viewMatrix, projectionMatrix);

    requestAnimationFrame(animate);
}
  
// Start the render loop.
function main() {
    requestAnimationFrame(animate);
}
main();