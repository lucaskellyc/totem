import * as THREE from "three";
import { createWaterMaterial } from "../shaders.js";

export function applyMaterial(
  root,
  {
    type = "standard",
    color,
    map,
    normalMap,
    roughnessMap,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    opacity,
    flowDir,
    flowSpeed,
    flowScale,
    ridgeStrength,
    stretch,
    alphaRange,
    displacement,
    contrast,
  } = {},
) {
  if (type === "water") {
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.material = createWaterMaterial({
        color,
        opacity,
        metalness,
        roughness,
        flowDir,
        flowSpeed,
        flowScale,
        ridgeStrength,
        stretch,
        alphaRange,
        displacement,
        contrast,
      });
    });
    return;
  }
  if (
    color === undefined &&
    !map &&
    !normalMap &&
    !roughnessMap &&
    roughness === undefined &&
    metalness === undefined &&
    emissive === undefined &&
    emissiveIntensity === undefined
  ) {
    return;
  }
  const params = {};
  if (color !== undefined) params.color = new THREE.Color().setHex(color);
  if (map) params.map = map;
  const Material =
    type === "unlit" ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial;
  if (type !== "unlit") {
    if (normalMap) params.normalMap = normalMap;
    if (roughnessMap) params.roughnessMap = roughnessMap;
    if (roughness !== undefined) params.roughness = roughness;
    if (metalness !== undefined) params.metalness = metalness;
    if (emissive !== undefined) params.emissive = new THREE.Color().setHex(emissive);
    if (emissiveIntensity !== undefined) params.emissiveIntensity = emissiveIntensity;
  }
  root.traverse((node) => {
    if (node.isMesh) node.material = new Material(params);
  });
}

export function applyShadows(root, { castShadow, receiveShadow } = {}) {
  if (castShadow === undefined && receiveShadow === undefined) return;
  root.traverse((node) => {
    if (!node.isMesh) return;
    if (castShadow !== undefined) node.castShadow = castShadow;
    if (receiveShadow !== undefined) node.receiveShadow = receiveShadow;
  });
}

export function behaviorLevel(behavior, state, t) {
  if (!behavior) return 1;
  const min = behavior.min ?? 0;
  const max = behavior.max ?? 1;
  const rate = behavior.rate ?? 1;
  if (behavior.type === "pulse") {
    const offset =
      behavior.delay !== undefined
        ? -behavior.delay * rate * Math.PI * 2
        : state.phase;
    const ph = t * rate * Math.PI * 2 + offset;
    return min + (max - min) * (0.5 + 0.5 * Math.sin(ph));
  }
  if (behavior.type === "blink") {
    const offset =
      behavior.delay !== undefined
        ? -behavior.delay * rate
        : state.phase / (Math.PI * 2);
    const cycle = ((t * rate + offset) % 1 + 1) % 1;
    const duty = behavior.duty ?? 0.5;
    return cycle < duty ? max : min;
  }
  if (behavior.type === "flicker") {
    const period = 1 / rate;
    if (state.lastT === undefined || t - state.lastT >= period) {
      state.lastT = t;
      state.from = state.to ?? max;
      state.to = min + Math.random() * (max - min);
    }
    const smooth = Math.max(0, Math.min(1, behavior.smooth ?? 1));
    if (smooth === 0) return state.to;
    const alpha = Math.min(1, (t - state.lastT) / (period * smooth));
    return state.from + (state.to - state.from) * alpha;
  }
  return 1;
}
