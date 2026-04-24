
import * as THREE from 'three/webgpu';

const _vec = new THREE.Vector3();

export function findNearestToPoint(mx, my, camera, positions, count, canvas, threshold) {
  const rect = canvas.getBoundingClientRect();
  const w    = rect.width;
  const h    = rect.height;

  let nearest     = -1;
  let nearestDist = threshold;

  for (let i = 0; i < count; i++) {
    _vec.set(
      positions[i * 3],
      positions[i * 3 + 1],
      positions[i * 3 + 2],
    );

    if (_vec.x === 0 && _vec.y === 0 && _vec.z === 0) continue;

    _vec.project(camera);

    if (_vec.z > 1) continue;

    const sx = (_vec.x + 1) * 0.5 * w;
    const sy = (1 - _vec.y) * 0.5 * h;

    const dx = sx - mx;
    const dy = sy - my;
    const d  = Math.sqrt(dx * dx + dy * dy);

    if (d < nearestDist) {
      nearestDist = d;
      nearest     = i;
    }
  }

  return nearest;
}

export function findNearestToClick(event, camera, positions, count, canvas, threshold = 40) {
  const rect = canvas.getBoundingClientRect();
  const mx   = event.clientX - rect.left;
  const my   = event.clientY - rect.top;
  return findNearestToPoint(mx, my, camera, positions, count, canvas, threshold);
}
