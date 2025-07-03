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
  // 8 corners
  const positions = new Float32Array([
    minX, minY, minZ,
    maxX, minY, minZ,
    maxX, maxY, minZ,
    minX, maxY, minZ,
    minX, minY, maxZ,
    maxX, minY, maxZ,
    maxX, maxY, maxZ,
    minX, maxY, maxZ,
  ]);
  // normals per face (we'll duplicate vertices for simplicity)
  // reuse face normals after duplication
  // indices for 12 triangles (2 per face)
  const indices = new Uint16Array([
    // front (minZ)
    0,1,2, 0,2,3,
    // back (maxZ)
    5,4,7, 5,7,6,
    // left (minX)
    4,0,3, 4,3,7,
    // right (maxX)
    1,5,6, 1,6,2,
    // bottom (minY)
    4,5,1, 4,1,0,
    // top (maxY)
    3,2,6, 3,6,7
  ]);
  // compute per-vertex normals (flat shading)
  // For simplicity, set normals to point outward as position normalized minus center
  const normals = new Float32Array(8*3);
  const center = [(minX+maxX)/2, (minY+maxY)/2, (minZ+maxZ)/2];
  for (let i = 0; i < 8; i++) {
    const x = positions[i*3]   - center[0];
    const y = positions[i*3+1] - center[1];
    const z = positions[i*3+2] - center[2];
    const len = Math.hypot(x,y,z)||1;
    normals.set([x/len,y/len,z/len], i*3);
  }
  const posBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const normBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, normBuf); gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
  const idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  return { position: posBuf, normal: normBuf, indices: idxBuf, indexCount: indices.length };
}
