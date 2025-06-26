import { mat4 } from "https://cdn.skypack.dev/gl-matrix?min";

export function initSkybox(gl) {
    // Define 36 vertices for a cube.
    const skyboxVertices = new Float32Array([
        // Front face
        -1, 1, -1,
        -1, -1, -1,
        1, -1, -1,
        1, -1, -1,
        1, 1, -1,
        -1, 1, -1,
        // Left face
        -1, -1, 1,
        -1, -1, -1,
        -1, 1, -1,
        -1, 1, -1,
        -1, 1, 1,
        -1, -1, 1,
        // Right face
        1, -1, -1,
        1, -1, 1,
        1, 1, 1,
        1, 1, 1,
        1, 1, -1,
        1, -1, -1,
        // Back face
        -1, -1, 1,
        -1, 1, 1,
        1, 1, 1,
        1, 1, 1,
        1, -1, 1,
        -1, -1, 1,
        // Top face
        -1, 1, -1,
        1, 1, -1,
        1, 1, 1,
        1, 1, 1,
        -1, 1, 1,
        -1, 1, -1,
        // Bottom face
        -1, -1, -1,
        -1, -1, 1,
        1, -1, -1,
        1, -1, -1,
        -1, -1, 1,
        1, -1, 1,
    ]);
    // Create and bind the vertex buffer.
    const skyboxBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, skyboxBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, skyboxVertices, gl.STATIC_DRAW);

    // Initialize cubemap texture.
    const cubemap = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap);
    // Setup each face placeholder then load actual images.
    const faces = [
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, url: 'images/right.png' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, url: 'images/left.png' },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, url: 'images/top.png' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, url: 'images/bottom.png' },
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, url: 'images/front.png' },
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, url: 'images/back.png' },
    ];
    faces.forEach(face => {
        // Upload temporary blue pixel.
        gl.texImage2D(face.target, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
        const image = new Image();
        image.src = face.url;
        image.onload = function () {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemap);
            gl.texImage2D(face.target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        };
    });
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return {
        skyboxBuffer,
        cubemap,
        vertexCount: 36,
    };
}
export function drawSkybox(gl, programInfo, skybox, viewMatrix, projectionMatrix) {
    gl.depthFunc(gl.LEQUAL); // Set depth function for skybox

    gl.useProgram(programInfo.program);

    // Remove translation from the view matrix so the skybox stays centered.
    const viewNoTrans = mat4.clone(viewMatrix);
    viewNoTrans[12] = 0;
    viewNoTrans[13] = 0;
    viewNoTrans[14] = 0;

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewNoTrans);

    // Bind buffers and texture.
    gl.bindBuffer(gl.ARRAY_BUFFER, skybox.skyboxBuffer);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skybox.cubemap);
    gl.uniform1i(programInfo.uniformLocations.uSkybox, 0);

    // Draw the skybox.
    gl.drawArrays(gl.TRIANGLES, 0, skybox.vertexCount);

    gl.depthFunc(gl.LESS); // Restore default depth function
}