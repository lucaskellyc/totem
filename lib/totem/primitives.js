import * as THREE from "three";
import { createBulbMaterial } from "../shaders.js";

export function createPrimitive(spec) {
  let geom;
  if (spec.shape === "sphere") {
    geom = new THREE.SphereGeometry(
      spec.radius ?? 0.2,
      spec.widthSegments ?? 24,
      spec.heightSegments ?? 16,
    );
  } else if (spec.shape === "disc") {
    geom = new THREE.CircleGeometry(spec.radius ?? 0.5, spec.segments ?? 48);
  } else if (spec.shape === "plane") {
    const [w, h] = spec.size ?? [1, 1];
    geom = new THREE.PlaneGeometry(w, h, spec.segmentsX ?? 1, spec.segmentsY ?? 1);
  } else {
    throw new Error(`Unknown component shape: ${spec.shape}`);
  }
  return new THREE.Mesh(geom, new THREE.MeshStandardMaterial());
}

export function attachPlanes(group, planeSpecs) {
  if (!planeSpecs?.length) return;
  for (const spec of planeSpecs) {
    const [w, h] = spec.size ?? [1, 1];
    const geom = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHex(spec.color ?? 0xffffff),
    });
    const mesh = new THREE.Mesh(geom, mat);
    if (spec.position) mesh.position.set(...spec.position);
    if (spec.rotation) mesh.rotation.set(...spec.rotation);
    group.add(mesh);
  }
}

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
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = light.distance;
      light.shadow.bias = 0;
      light.shadow.radius = 4;
    }
    let mesh = null;
    let baseEmissive = 0;
    let baseColor = null;
    if (spec.shape) {
      mesh = createPrimitive(spec);
      baseColor = new THREE.Color().setHex(
        spec.emissive ?? spec.color ?? 0xffffff,
      );
      baseEmissive = spec.emissiveIntensity ?? 1;
      mesh.material = createBulbMaterial({
        color: baseColor.getHex(),
        intensity: baseEmissive,
        fresnelPower: spec.fresnelPower,
        fresnelStrength: spec.fresnelStrength,
        highlightPower: spec.highlightPower,
        highlightStrength: spec.highlightStrength,
      });
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      light.add(mesh);
    }
    group.add(light);
    records.push({
      object: light,
      group,
      localY: light.position.y,
      power: spec.power ?? 15,
      mesh,
      baseEmissive,
      baseColor,
      behavior: spec.behavior ?? null,
      behaviorState: { phase: Math.random() * Math.PI * 2 },
      wantsShadow: light.castShadow,
    });
  }
  return records;
}
