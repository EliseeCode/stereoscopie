import * as THREE from 'three'

/**
 * Writes linear view-space depth into the red channel:
 *   1 at `near`, 0 at `far`, clamped.
 * Set `near`/`far` each frame so the object spans the full range.
 */
export function makeDepthMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      near: { value: 1 },
      far: { value: 5 },
    },
    vertexShader: /* glsl */ `
      varying float vZ;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float near;
      uniform float far;
      varying float vZ;
      void main() {
        float d = clamp(1.0 - (vZ - near) / (far - near), 0.0, 1.0);
        gl_FragColor = vec4(d, d, d, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  })
}
