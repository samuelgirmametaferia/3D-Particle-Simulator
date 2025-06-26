export const skyboxVertexShader = `
  attribute vec3 aVertexPosition;
  uniform mat4 projectionMatrix;
  uniform mat4 viewMatrix;
  varying vec3 vTexCoord;
  void main(void) {
    vTexCoord = aVertexPosition;
    vec4 pos = projectionMatrix * viewMatrix * vec4(aVertexPosition, 1.0);
    gl_Position = pos.xyww;
  }
`;

export const skyboxFragmentShader = ` 
  precision mediump float;
  varying vec3 vTexCoord;
  uniform samplerCube uSkybox;
  void main(void) {
    gl_FragColor = textureCube(uSkybox, vTexCoord);
  }
`;