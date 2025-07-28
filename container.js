import { vec3 } from "https://cdn.skypack.dev/gl-matrix?min";

/**
 * Initializes a cube mesh (solid) for a rectangular container.
 * @param {WebGLRenderingContext} gl
 * @param {vec3} minCorner [x,y,z]
 * @param {vec3} maxCorner [x,y,z]
 * @returns {{position: WebGLBuffer, normal: WebGLBuffer, indices: WebGLBuffer, indexCount: number}}
 */
export function initContainerMesh(gl, minCorner, maxCorner) {
  const [minX, minY, minZ] = minCorner;
  const [maxX, maxY, maxZ] = maxCorner;
  // Quad in the X/Y plane at Z = minZ
  const positions = new Float32Array([
    minX, minY, minZ,
    maxX, minY, minZ,
    maxX, maxY, minZ,
    minX, maxY, minZ,
  ]);
  const texCoords = new Float32Array([
    0,0, 1,0, 1,1, 0,1
  ]);
  const normals = new Float32Array([
    0,0,1, 0,0,1, 0,0,1, 0,0,1
  ]);
  const indices = new Uint16Array([
    0,1,2, 0,2,3
  ]);
  const posBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const normBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, normBuf); gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
  const texBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, texBuf); gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  const idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  return { position: posBuf, normal: normBuf, texCoord: texBuf, indices: idxBuf, indexCount: indices.length };
}
