import * as THREE from "three";

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
      light.shadow.mapSize.set(512, 512);
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = light.distance;
      light.shadow.bias = 0;
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
