function initBuffers(gl) {
    const subdivisions = 2; // Adjust subdivision level (0 = basic icosahedron)
    const { positions, indices, indexCount } = createIcosphere(subdivisions);
    
    // Create and bind position buffer.
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    // Create a normal buffer (same as positions for a unit sphere).
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    // Create and bind index buffer.
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    
    return {
        position: positionBuffer,
        normal: normalBuffer,
        indices: indexBuffer,
        indexCount: indexCount,
    };
}

function createIcosphere(subdivisions) {
    const t = (1 + Math.sqrt(5)) / 2;
    let vertices = [];
    let midCache = {};

    // Helper: normalize a 3-element vector.
    function normalize(v) {
        const len = Math.hypot(v[0], v[1], v[2]);
        return [v[0] / len, v[1] / len, v[2] / len];
    }
    
    // Helper: adds a vertex to the vertices array and returns its index.
    function addVertex(x, y, z) {
        const vertex = normalize([x, y, z]);
        vertices.push(...vertex);
        return (vertices.length / 3) - 1;
    }
    
    // Helper: finds a middle point and caches it.
    function getMiddlePoint(p1, p2) {
        const key = p1 < p2 ? `${p1}_${p2}` : `${p2}_${p1}`;
        if (key in midCache) {
            return midCache[key];
        }
        const i1 = p1 * 3;
        const i2 = p2 * 3;
        const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
        const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
        const middle = normalize([
            (v1[0] + v2[0]) / 2,
            (v1[1] + v2[1]) / 2,
            (v1[2] + v2[2]) / 2,
        ]);
        const index = vertices.length / 3;
        vertices.push(...middle);
        midCache[key] = index;
        return index;
    }
    
    // Create icosahedron vertices.
    const v0  = addVertex(-1,  t,  0);
    const v1  = addVertex( 1,  t,  0);
    const v2  = addVertex(-1, -t,  0);
    const v3  = addVertex( 1, -t,  0);
    
    const v4  = addVertex( 0, -1,  t);
    const v5  = addVertex( 0,  1,  t);
    const v6  = addVertex( 0, -1, -t);
    const v7  = addVertex( 0,  1, -t);
    
    const v8  = addVertex( t,  0, -1);
    const v9  = addVertex( t,  0,  1);
    const v10 = addVertex(-t,  0, -1);
    const v11 = addVertex(-t,  0,  1);
    
    // Create 20 triangular faces of the icosahedron.
    let faces = [
        [v0, v11, v5],
        [v0, v5, v1],
        [v0, v1, v7],
        [v0, v7, v10],
        [v0, v10, v11],
        [v1, v5, v9],
        [v5, v11, v4],
        [v11, v10, v2],
        [v10, v7, v6],
        [v7, v1, v8],
        [v3, v9, v4],
        [v3, v4, v2],
        [v3, v2, v6],
        [v3, v6, v8],
        [v3, v8, v9],
        [v4, v9, v5],
        [v2, v4, v11],
        [v6, v2, v10],
        [v8, v6, v7],
        [v9, v8, v1],
    ];
    
    // Subdivide faces.
    for (let i = 0; i < subdivisions; i++) {
        let newFaces = [];
        for (const face of faces) {
            const [a, b, c] = face;
            const ab = getMiddlePoint(a, b);
            const bc = getMiddlePoint(b, c);
            const ca = getMiddlePoint(c, a);
            newFaces.push([a, ab, ca]);
            newFaces.push([b, bc, ab]);
            newFaces.push([c, ca, bc]);
            newFaces.push([ab, bc, ca]);
        }
        faces = newFaces;
    }
    
    let indices = [];
    faces.forEach(face => {
        indices.push(...face);
    });
    
    return { positions: vertices, indices: indices, indexCount: indices.length };
}

export { initBuffers };