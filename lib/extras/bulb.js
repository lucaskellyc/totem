import * as THREE from "three";

// Marquee-style blinking bulbs. Components opt in with a `blink` field on their
// spec; the emissive material is set up by applyMaterial, so this effect just
// hard-toggles emissiveIntensity per frame. Give paired bulbs offset phases
// (e.g. 0 and 0.5) to alternate on/off. Each blinking component also gets its
// own PointLight (colored to match the emissive) so the bulb casts light on
// nearby meshes in sync with its glow.
export class BulbEffect {
  // hz = full alternation cycles per second.
  constructor({ hz = 1.5 } = {}) {
    this.hz = hz;
    this.bulbs = [];
    this.lights = [];
  }

  applyTo(root, spec) {
    if (!spec.blink) return;
    // One light per blinking component, parented to the component so it sits at
    // the bulb (root is the component root, already positioned by _loadBlock).
    const light = new THREE.PointLight(
      new THREE.Color().setHex(spec.emissive ?? 0xffffff),
      0, // intensity driven per-frame in update()
    );
    light.distance = spec.blink.distance ?? 3.5; // mirrors attachLights default
    if (spec.blink.offset) light.position.set(...spec.blink.offset);
    root.add(light);
    this.lights.push({
      light,
      phase: spec.blink.phase ?? 0,
      onPower: spec.blink.power ?? 8,
    });

    root.traverse((node) => {
      if (!node.isMesh) return;
      this.bulbs.push({
        material: node.material,
        phase: spec.blink.phase ?? 0,
        onIntensity: spec.emissiveIntensity ?? 1,
      });
    });
  }

  update(t) {
    for (const b of this.bulbs) {
      const on = ((t * this.hz + b.phase) % 1) < 0.5;
      b.material.emissiveIntensity = on ? b.onIntensity : 0;
    }
    for (const l of this.lights) {
      const on = ((t * this.hz + l.phase) % 1) < 0.5;
      l.light.intensity = on ? l.onPower : 0;
    }
  }
}
