import * as THREE from "three";

const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

// Resolve a spec's `axis` to a unit vector. Accepts "x" | "y" | "z" (defaulting
// to "y") or an explicit [x, y, z] vector for an arbitrary axis.
const resolveAxis = (axis = "y") =>
  Array.isArray(axis)
    ? new THREE.Vector3(...axis).normalize()
    : (AXES[axis] ?? AXES.y).clone();

// Continuous rotation. A mesh opts in with a `spin` field on its spec:
//
//   spin: { axis: "y", speed: 0.5 }
//
// `axis` is "x" | "y" | "z" or an [x, y, z] vector; `speed` is radians per
// second (negative reverses). The spin composes on top of any static `rotation`
// on the mesh — the base orientation is captured on apply, so a tilted mesh
// spins about the tilted axis rather than snapping upright.
export class SpinEffect {
  constructor() {
    this.spinners = [];
  }

  applyTo(root, spec) {
    if (!spec.spin) return;
    this.spinners.push({
      object: root,
      axis: resolveAxis(spec.spin.axis),
      speed: spec.spin.speed ?? 1,
      // Static `rotation` (set in _loadBlock) is folded in as the rest pose.
      base: root.quaternion.clone(),
    });
  }

  update(t) {
    const q = new THREE.Quaternion();
    for (const s of this.spinners) {
      q.setFromAxisAngle(s.axis, s.speed * t);
      s.object.quaternion.copy(s.base).multiply(q);
    }
  }
}
