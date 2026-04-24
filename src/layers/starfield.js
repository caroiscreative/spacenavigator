
import * as THREE from 'three/webgpu';

export function createStarField(scene, hygData) {
  const { positions, colors, sizes, count } = hygData;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes,     1)); // future sizeNode

  const mat = new THREE.PointsMaterial({
    vertexColors:    true,
    size:            2.5,            // pixels (sizeAttenuation: false)
    transparent:     true,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false,
    sizeAttenuation: false,
  });

  const stars = new THREE.Points(geo, mat);
  stars.name = 'starfield';
  scene.add(stars);

  function toggle()    { stars.visible = !stars.visible; }
  function isVisible() { return stars.visible; }

  console.log(`[StarField] ${count.toLocaleString()} stars — 1 draw call, 0 warnings`);
  return { stars, toggle, isVisible };
}

function makeGaussianTexture(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;

  const ctx  = canvas.getContext('2d');
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.00, 'rgba(255,255,255,1.00)');
  grad.addColorStop(0.20, 'rgba(255,255,255,0.90)');
  grad.addColorStop(0.50, 'rgba(255,255,255,0.40)');
  grad.addColorStop(0.80, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1.00, 'rgba(255,255,255,0.00)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}
