import * as THREE from "three";
import { isMobile } from "./env.js";

// A point light's shadow is a cube — 6 faces re-rendered every frame — so
// halving the map edge quarters that per-light cost on mobile. A phone column
// is only a few hundred px wide, so 512 still reads crisp; desktop keeps 1024.
const SHADOW_MAP_SIZE = isMobile ? 512 : 1024;

export function attachLights(group, lightSpecs) {
  const records = [];
  if (!lightSpecs?.length) return records;
  for (const spec of lightSpecs) {
    const color = new THREE.Color().setHex(spec.color ?? 0xffffff);
    const light = new THREE.PointLight(color, 0);
    light.position.set(...(spec.position ?? [0, 0, 0]));
    light.distance = spec.distance ?? 3.5;
    light.castShadow = spec.castShadow ?? false;
    if (light.castShadow) {
      // Shadow-quality defaults. The map keeps edges crisp (SHADOW_MAP_SIZE:
      // 1024 desktop, 512 mobile); normalBias offsets the shadow sample along
      // the surface normal to kill the acne / peter-panning that a flat bias of
      // 0 leaves on the curved, normal-mapped block meshes. far tracks the
      // light's own range (it lights nothing past distance, so there's nothing
      // to shadow beyond it either).
      light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = light.distance;
      light.shadow.bias = 0;
      light.shadow.normalBias = 0.02;
    }
    group.add(light);
    records.push({
      object: light,
      group,
      localY: light.position.y,
      power: spec.power ?? 15,
      wantsShadow: light.castShadow,
    });
  }
  return records;
}
