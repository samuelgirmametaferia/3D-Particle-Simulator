import { mat4, mat3, vec3 } from "https://cdn.skypack.dev/gl-matrix?min";
// Draw multiple sphere instances with individual model transforms.
// Draw multiple sphere instances with individual model transforms.
function drawScene(gl, programInfo, buffers, projectionMatrix, viewMatrix, viewPos, modelMatrices) {
    // Clear and set up rendering state
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);
    // Set shared lighting uniforms once
    gl.uniform3fv(programInfo.uniformLocations.uLightColor, [1.0, 1.0, 1.0]);
    gl.uniform3fv(programInfo.uniformLocations.uAmbientColor, [0.2, 0.2, 0.2]);

    // Prepare for GPU instancing
    const ext = gl.getExtension('ANGLE_instanced_arrays');

    // Set per-frame uniforms
    gl.uniform3fv(programInfo.uniformLocations.uViewPosition, viewPos);
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
    // Compute and set normal matrix (from view matrix only, since model matrices are translations)
    const viewNormalMat = mat3.create();
    mat3.fromMat4(viewNormalMat, viewMatrix);
    mat3.invert(viewNormalMat, viewNormalMat);
    mat3.transpose(viewNormalMat, viewNormalMat);
    gl.uniformMatrix3fv(programInfo.uniformLocations.normalMatrix, false, viewNormalMat);
    // Transform light direction into view space (use view matrix)
    const worldLight = [0.5, 0.7, 1.0];
    const viewLight = vec3.create();
    const viewLightMat = mat3.create();
    mat3.fromMat4(viewLightMat, viewMatrix);
    vec3.transformMat3(viewLight, worldLight, viewLightMat);
    vec3.normalize(viewLight, viewLight);
    gl.uniform3fv(programInfo.uniformLocations.uLightDirection, viewLight);

    // Base attributes (position & normal)
    setPositionAttribute(gl, buffers, programInfo);
    setNormalAttribute(gl, buffers, programInfo);

    // Build and upload instance matrices buffer
    const count = modelMatrices.length;
    const matData = new Float32Array(count * 16);
    modelMatrices.forEach((m, i) => matData.set(m, i * 16));
    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, matData, gl.STATIC_DRAW);

    // Enable and configure per-instance matrix attributes
    for (let i = 0; i < 4; i++) {
        const loc = programInfo.attribLocations[`aInstanceMatrix${i}`];
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 64, i * 16);
        ext.vertexAttribDivisorANGLE(loc, 1);
    }

    // Draw all instances in a single call
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    ext.drawElementsInstancedANGLE(gl.TRIANGLES, buffers.indexCount, gl.UNSIGNED_SHORT, 0, count);
}

function setPositionAttribute(gl, buffers, programInfo) {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
  
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
}

function setNormalAttribute(gl, buffers, programInfo) {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
  
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexNormal,
        numComponents,
        type,
        normalize,
        stride,
        offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);
}

// Draw a single quad (square) in 3D space
function drawQuad(gl, programInfo, buffers, projectionMatrix, viewMatrix, modelMatrix) {
    gl.useProgram(programInfo.program);
    // Set uniforms
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);
    // Set normal matrix
    const mvMatrix = mat4.create();
    mat4.multiply(mvMatrix, viewMatrix, modelMatrix);
    const normalMat = mat3.create();
    mat3.fromMat4(normalMat, mvMatrix);
    mat3.invert(normalMat, normalMat);
    mat3.transpose(normalMat, normalMat);
    gl.uniformMatrix3fv(programInfo.uniformLocations.normalMatrix, false, normalMat);
    // Set attributes
    setPositionAttribute(gl, buffers, programInfo);
    setNormalAttribute(gl, buffers, programInfo);
    if (buffers.texCoord && programInfo.attribLocations.vertexTexCoord !== undefined) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texCoord);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexTexCoord);
    }
    // Bind index buffer and draw
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    gl.drawElements(gl.TRIANGLES, buffers.indexCount, gl.UNSIGNED_SHORT, 0);
}

export { drawScene, drawQuad };
