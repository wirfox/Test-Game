import * as THREE from 'three';

export const DARKNESS = { ambientIntensity: 0.015, fogDensity: 0.06 };

/** Near-total darkness: the room must be almost unreadable without the flashlight. */
export function setupLighting(scene: THREE.Scene): { ambient: THREE.HemisphereLight; fog: THREE.FogExp2 } {
  const ambient = new THREE.HemisphereLight(0x8fa3c4, 0x1a1410, DARKNESS.ambientIntensity);
  const fog = new THREE.FogExp2(0x000000, DARKNESS.fogDensity);
  scene.background = new THREE.Color(0x000000);
  scene.fog = fog;
  scene.add(ambient);
  return { ambient, fog };
}
