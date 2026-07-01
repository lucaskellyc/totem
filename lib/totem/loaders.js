import * as THREE from "three";

const linear = { colorSpace: THREE.NoColorSpace };

export async function loadTexture(
  loader,
  url,
  { colorSpace = THREE.SRGBColorSpace } = {},
) {
  let tex;
  try {
    tex = await loader.loadAsync(url);
  } catch (cause) {
    throw new Error(`Failed to load texture: ${url}`, { cause });
  }
  tex.colorSpace = colorSpace;
  tex.flipY = false;
  return tex;
}

export async function loadMaps(loader, entry) {
  const [map, normalMap, roughnessMap] = await Promise.all([
    entry.texture ? loadTexture(loader, entry.texture) : null,
    entry.normalMap ? loadTexture(loader, entry.normalMap, linear) : null,
    entry.roughnessMap ? loadTexture(loader, entry.roughnessMap, linear) : null,
  ]);
  return { map, normalMap, roughnessMap };
}
