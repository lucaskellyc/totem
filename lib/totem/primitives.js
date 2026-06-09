import * as THREE from "three";

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
