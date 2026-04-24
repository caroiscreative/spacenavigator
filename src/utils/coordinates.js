
import * as THREE from 'three/webgpu';

export const EARTH_RADIUS_KM    = 6371.0;
export const SCENE_KM_PER_UNIT  = 500.0;       // 1 scene unit = 500 km at LEO scale
export const EARTH_RADIUS_UNITS = EARTH_RADIUS_KM / SCENE_KM_PER_UNIT; // 12.742

export const EARTH_ROTATION_RATE_RAD_S = (2 * Math.PI) / 86164.1;

export function kmToUnits(km) {
  return km / SCENE_KM_PER_UNIT;
}

export function unitsToKm(units) {
  return units * SCENE_KM_PER_UNIT;
}

export function geodeticToScene(latDeg, lonDeg, altKm = 0) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const r   = kmToUnits(EARTH_RADIUS_KM + altKm);

  return new THREE.Vector3(
     r * Math.cos(lat) * Math.sin(lon),  // X: east
     r * Math.sin(lat),                  // Y: north pole
    -r * Math.cos(lat) * Math.cos(lon),  // Z: towards prime meridian (negated for right-hand)
  );
}

export function ecefToScene(xKm, yKm, zKm) {
  return new THREE.Vector3(
    kmToUnits(xKm),
    kmToUnits(yKm),
    kmToUnits(zKm),
  );
}

export function gmstRadians(timestampMs) {
  const J2000_MS     = 946728000000;
  const elapsedSec   = (timestampMs - J2000_MS) / 1000;
  const gmst0Rad     = THREE.MathUtils.degToRad(280.46061837);
  return gmst0Rad + EARTH_ROTATION_RATE_RAD_S * elapsedSec;
}
