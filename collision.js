import { vec3 } from "https://cdn.skypack.dev/gl-matrix?min";

/**
 * Represents an axis-aligned rectangular container for particles.
 * @param {vec3} minCorner - The minimum [x, y, z] coordinates of the container.
 * @param {vec3} maxCorner - The maximum [x, y, z] coordinates of the container.
 */
export class RectangularContainer {
  constructor(minCorner, maxCorner) {
    this.min = vec3.clone(minCorner);
    this.max = vec3.clone(maxCorner);
  }

  /**
   * Tests and responds to collisions of a single particle with the container walls.
   * Assumes particle has .position: vec3, .velocity: vec3, and optional .radius (defaults to 0).
   * On collision, the position is clamped and the velocity component is inverted.
   * @param {Object} particle
   */
  collide(particle) {
    const p = particle.position;
    const v = particle.velocity;
    const r = particle.radius || 0;

    const restitution = 0.6; // bounce coefficient (lower for more energy loss)
    for (let i = 0; i < 3; i++) {
      // handle min collision
      if (p[i] - r < this.min[i]) {
        p[i] = this.min[i] + r;
        // reflect velocity outward
        v[i] = Math.abs(v[i]) * restitution;
      // handle max collision
      } else if (p[i] + r > this.max[i]) {
        p[i] = this.max[i] - r;
        // reflect velocity inward
        v[i] = -Math.abs(v[i]) * restitution;
      }
    }
  }
}

/**
 * Handles collisions for an array of particles against the container.
 * @param {Array<Object>} particles - Array of particle objects with position, velocity, radius.
 * @param {RectangularContainer} container
 */
export function handleContainerCollisions(particles, container) {
  for (const particle of particles) {
    container.collide(particle);
  }
}

/**
 * Handle simple elastic collisions between particles (O(n^2)).
 * Adjusts velocities and separates intersecting particles.
 * @param {Array<Object>} particles - Each has {position: vec3, velocity: vec3, radius: number}
 */
export function handleParticleCollisions(particles) {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i];
      const b = particles[j];
      const dx = b.position[0] - a.position[0];
      const dy = b.position[1] - a.position[1];
      const dz = b.position[2] - a.position[2];
      const dist2 = dx*dx + dy*dy + dz*dz;
      const rSum = a.radius + b.radius;
      if (dist2 < rSum * rSum) {
        const dist = Math.sqrt(dist2) || rSum;
        const nx = dx / dist, ny = dy / dist, nz = dz / dist;
        // push apart
        const overlap = rSum - dist;
        a.position[0] -= nx * overlap * 0.5;
        a.position[1] -= ny * overlap * 0.5;
        a.position[2] -= nz * overlap * 0.5;
        b.position[0] += nx * overlap * 0.5;
        b.position[1] += ny * overlap * 0.5;
        b.position[2] += nz * overlap * 0.5;
        // relative velocity
        const rvx = b.velocity[0] - a.velocity[0];
        const rvy = b.velocity[1] - a.velocity[1];
        const rvz = b.velocity[2] - a.velocity[2];
        const velAlongNormal = rvx*nx + rvy*ny + rvz*nz;
        if (velAlongNormal > 0) continue;
        const restitution = 0.6; // lower restitution for energy loss
        const jImpulse = -(1 + restitution) * velAlongNormal / 2;
        // apply impulse
        a.velocity[0] -= jImpulse * nx;
        a.velocity[1] -= jImpulse * ny;
        a.velocity[2] -= jImpulse * nz;
        b.velocity[0] += jImpulse * nx;
        b.velocity[1] += jImpulse * ny;
        b.velocity[2] += jImpulse * nz;
      }
    }
  }
}
