
import * as THREE from 'three/webgpu';
import { WebGPURenderer } from 'three/webgpu';

export async function createRenderer(container) {
  const renderer = new WebGPURenderer({
    antialias:             true,
    logarithmicDepthBuffer: true,
    preserveDrawingBuffer: true,   // required for canvas.toDataURL() screenshots
  });

  await renderer.init();

  const rendererType = renderer.backend?.isWebGPUBackend ? 'WebGPU ✓' : 'WebGL2';

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  container.appendChild(renderer.domElement);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  console.log(`[SpaceNavigator] Renderer: ${rendererType}`);
  return { renderer, rendererType };
}
