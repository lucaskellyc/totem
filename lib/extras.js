import * as THREE from "three";
import { Totem as BaseTotem } from "./totem.js";
import { createPrimitive } from "./totem/primitives.js";
import { createBulbMaterial, createWaterMaterial } from "./shaders.js";

class Totem extends BaseTotem {
  constructor(opts) {
    super(opts);
    this._lights = [];
    this._blinkers = [];
    this._waterMaterials = [];
    this.lightFocusY = -5;
    this.lightFalloff = 6;
  }

  _decorateBlock({ spec, group, root, components, componentRoots }) {
    if (spec.type === "water") applyWaterMaterial(root, spec);
    componentRoots.forEach((compRoot, i) => {
      const comp = components[i];
      if (comp.type === "water") applyWaterMaterial(compRoot, comp);
      trackBlinkers(this._blinkers, compRoot, comp.blink);
    });
    trackWaterMaterials(this._waterMaterials, group);
    this._lights.push(...attachLights(group, spec.lights));
  }

  _updateExtras(t) {
    for (const light of this._lights) {
      const worldY = light.group.position.y + light.localY;
      const fade = Math.abs(worldY - this.lightFocusY) * this.lightFalloff;
      const baseIntensity = Math.max(light.power - fade, 0);
      const shouldCast = light.wantsShadow && baseIntensity > 0;
      if (light.object.castShadow !== shouldCast) {
        light.object.castShadow = shouldCast;
      }
      const level = behaviorLevel(light.behavior, light.behaviorState, t);
      light.object.intensity = baseIntensity * level;
      if (light.mesh) {
        const ratio = light.power > 0 ? baseIntensity / light.power : 0;
        light.mesh.material.uniforms.uIntensity.value =
          light.baseEmissive * ratio * level;
      }
    }
    for (const b of this._blinkers) {
      const rate = b.blink.rate ?? 1;
      const min = b.blink.min ?? 0;
      const max = b.blink.max ?? b.baseIntensity;
      const phase = (t * rate * Math.PI * 2 + b.phase) % (Math.PI * 2);
      let level;
      if (b.blink.smooth) {
        level = 0.5 + 0.5 * Math.sin(phase);
      } else {
        const duty = b.blink.duty ?? 0.5;
        level = phase / (Math.PI * 2) < duty ? 1 : 0;
      }
      b.material.emissiveIntensity = min + (max - min) * level;
    }
    for (const mat of this._waterMaterials) {
      mat.uniforms.uTime.value = t;
    }
  }
}

function applyWaterMaterial(root, spec) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.material = createWaterMaterial({
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness,
    });
  });
}

function trackWaterMaterials(out, root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    if (node.material?.name === "water" && node.material.uniforms?.uTime) {
      out.push(node.material);
    }
  });
}

function trackBlinkers(out, root, blinkSpec) {
  if (!blinkSpec) return;
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    out.push({
      material: node.material,
      baseIntensity: node.material.emissiveIntensity ?? 1,
      blink: blinkSpec,
      phase: Math.random() * Math.PI * 2,
    });
  });
}

function attachLights(group, lightSpecs) {
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

function behaviorLevel(behavior, state, t) {
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

export { Totem };
