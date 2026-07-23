import * as THREE from "three";

export function applyMaterial(
  root,
  {
    type = "standard",
    color,
    map,
    normalMap,
    roughnessMap,
    alphaMap,
    alphaTest,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
  } = {},
) {
  if (type !== "standard" && type !== "unlit") return;
  if (
    color === undefined &&
    !map &&
    !normalMap &&
    !roughnessMap &&
    !alphaMap &&
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
  // alphaMap is a cutout mask on both basic and standard materials: alphaTest
  // discards below-threshold pixels (hard edges, no draw-order/shadow issues).
  if (alphaMap) {
    params.alphaMap = alphaMap;
    params.alphaTest = alphaTest ?? 0.5;
  }
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
