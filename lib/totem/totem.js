import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadMaps } from "./loaders.js";
import { applyMaterial, applyShadows } from "./materials.js";
import { attachLights } from "./lights.js";

const byFocusDistance = (a, b) => a.focusDistance - b.focusDistance;

export class Totem extends THREE.Group {
  constructor({ loadingManager } = {}) {
    super();
    this.blocks = [];
    // Resolves once every block handed to loadBlocks is placed; see there.
    this.ready = Promise.resolve(this);
    this.origin = 0;
    this.scrollPos = 0;
    this.shifting = false;
    this._loader = null;
    this._textureLoader = null;
    this._loadingManager = loadingManager ?? null;
    this._unlitMeshes = [];
    this._emissiveMeshes = [];
    this._lights = [];
    // Subset of _lights that may cast, kept separately so _updateLights can
    // rank just those without walking (or allocating from) the full list.
    this._shadowCasters = [];
    this._startTime = performance.now();
    this.unlitFocusY = -5;
    this.unlitFalloff = 0.4;
    this.lightFocusY = -5;
    this.lightFalloff = 6;
    // Scroll fade for emissive glows (neon signs, marquee bulbs); mirrors the
    // unlit-mesh falloff so glowing surfaces dim off-focus like the video screens.
    this.emissiveFocusY = -5;
    this.emissiveFalloff = 0.3;
    // Global multiplier on this column's lights + unlit meshes (1 = full).
    this.brightness = 1;
    // How many lights may cast a shadow at once. _updateLights holds the count
    // at exactly this (see there for why it must not drift), so raising it
    // costs a depth cube per extra caster whether or not one is lit. Three is
    // enough that no stock block ever has a lit caster crowded out.
    this.shadowBudget = 3;
  }

  _trackUnlitMeshes(root, group) {
    group.updateMatrixWorld(true);
    const groupY = group.position.y;
    const tmp = new THREE.Vector3();
    root.traverse((node) => {
      if (!node.isMesh || !node.material?.isMeshBasicMaterial) return;
      const mat = node.material;
      if (mat.userData.baseColorHex === undefined) {
        mat.userData.baseColorHex = mat.color.getHex();
      }
      node.getWorldPosition(tmp);
      this._unlitMeshes.push({
        group,
        object: node,
        material: mat,
        localY: tmp.y - groupY,
      });
    });
  }

  // Track emissive (glowing) standard-material meshes so their emissiveIntensity
  // can be faded by scroll distance, same idea as _trackUnlitMeshes. Meshes with
  // a black emissive (i.e. not actually glowing) are skipped.
  _trackEmissiveMeshes(root, group) {
    group.updateMatrixWorld(true);
    const groupY = group.position.y;
    const tmp = new THREE.Vector3();
    root.traverse((node) => {
      if (!node.isMesh) return;
      const mat = node.material;
      if (!mat?.isMeshStandardMaterial || !mat.emissive) return;
      if (mat.emissive.getHex() === 0x000000) return;
      if (mat.userData.baseEmissiveIntensity === undefined) {
        mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
      }
      node.getWorldPosition(tmp);
      this._emissiveMeshes.push({
        group,
        object: node,
        material: mat,
        localY: tmp.y - groupY,
      });
    });
  }

  _decorateBlock(_ctx) {}
  _updateExtras(_t) {}

  update() {
    const t = (performance.now() - this._startTime) / 1000;
    for (const u of this._unlitMeshes) {
      const worldY = u.group.position.y + u.localY;
      const fade = Math.abs(worldY - this.unlitFocusY) * this.unlitFalloff;
      const brightness = Math.max(1 - fade, 0) * this.brightness;
      u.material.color
        .setHex(u.material.userData.baseColorHex)
        .multiplyScalar(brightness);
    }
    this._updateLights();
    // Emissive glows: fade emissiveIntensity by scroll distance and stash the
    // scale on the material so per-frame effects (e.g. blinking bulbs, which run
    // in _updateExtras below and overwrite emissiveIntensity) can honour it too.
    for (const e of this._emissiveMeshes) {
      const worldY = e.group.position.y + e.localY;
      const fade = Math.abs(worldY - this.emissiveFocusY) * this.emissiveFalloff;
      const scale = Math.max(1 - fade, 0) * this.brightness;
      e.material.userData.emissiveFade = scale;
      e.material.emissiveIntensity =
        e.material.userData.baseEmissiveIntensity * scale;
    }
    this._updateExtras(t);
  }

  // Fade every light by its distance from focus, and decide which of them cast.
  //
  // The subtlety here is that three keys its compiled shader programs on the
  // *number* of shadow-casting lights in the scene, so any change to that count
  // invalidates every lit material in the column and forces a fresh program
  // link — which on macOS blocks the main thread for 100–300 ms apiece. Letting
  // the count follow "is this light currently bright?" therefore hitched the
  // scene for its first several seconds of scrolling, until every count the
  // column could produce had been compiled and cached.
  //
  // So the count is pinned: the `shadowBudget` lights nearest focus always
  // cast, even when they're too dark to contribute, so the shader keeps one
  // program for good.
  //
  // Depth cubes are also rendered once rather than every frame. A light moves
  // with its block, and scrolling only translates the whole column, so the
  // light's view of its surroundings never changes — re-rendering the six
  // faces per caster per frame was pure cost (18 extra scene draws a column).
  // A cube is redrawn only when a light joins the budget or a block wraps to
  // the other end (`primed` is cleared in scroll()). Shadow-casting meshes
  // must not animate relative to their block, or their shadows will freeze.
  _updateLights() {
    const casters = this._shadowCasters;
    for (const light of this._lights) {
      const worldY = light.group.position.y + light.localY;
      const distance = Math.abs(worldY - this.lightFocusY);
      const intensity =
        Math.max(light.power - distance * this.lightFalloff, 0) *
        this.brightness;
      light.object.intensity = intensity;
      if (light.wantsShadow) {
        // Named for the focus, not the light's own `distance` (its range).
        light.focusDistance = distance;
      }
    }
    if (casters.length === 0) return;
    // Nearest-first; the array is ours, so sorting in place allocates nothing.
    casters.sort(byFocusDistance);
    for (let i = 0; i < casters.length; i++) {
      const caster = casters[i];
      const shouldCast = i < this.shadowBudget;
      if (caster.object.castShadow !== shouldCast) {
        caster.object.castShadow = shouldCast;
      }
      if (!shouldCast) continue;
      const light = caster.object;
      const shadow = light.shadow;
      shadow.autoUpdate = false;
      if (!caster.primed) {
        shadow.needsUpdate = true;
        caster.primed = true;
      }
      // three only refreshes a point shadow's matrix (a translation to the
      // light) when it re-renders the cube, so keep it tracking the scroll.
      light.updateWorldMatrix(true, false);
      const e = light.matrixWorld.elements;
      shadow.matrix.makeTranslation(-e[12], -e[13], -e[14]);
    }
  }

  async _loadGltf(url) {
    try {
      return await this._loader.loadAsync(url);
    } catch (cause) {
      throw new Error(`Failed to load GLB: ${url}`, { cause });
    }
  }

  async _resolveRoot(spec) {
    if (spec.object) {
      return typeof spec.object === "function" ? spec.object() : spec.object;
    }
    const gltf = await this._loadGltf(spec.url);
    return gltf.scene;
  }

  addBlock(object, height, focusY) {
    this.add(object);
    this.blocks.push({ object, height, focusY: focusY ?? -height / 2 });
    this._layout();
    return this;
  }

  async _loadBlock(spec) {
    const components = spec.components ?? [];
    const [root, blockMaps, componentRootObjects, componentMaps] =
      await Promise.all([
        this._resolveRoot(spec),
        loadMaps(this._textureLoader, spec),
        Promise.all(components.map((c) => this._resolveRoot(c))),
        Promise.all(components.map((c) => loadMaps(this._textureLoader, c))),
      ]);

    applyMaterial(root, {
      type: spec.type,
      color: spec.color,
      roughness: spec.roughness,
      metalness: spec.metalness,
      emissive: spec.emissive,
      emissiveIntensity: spec.emissiveIntensity,
      ...blockMaps,
    });
    applyShadows(root, {
      castShadow: spec.castShadow,
      receiveShadow: spec.receiveShadow,
    });
    root.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(root, true);
    const height = bbox.max.y - bbox.min.y;
    root.position.y -= bbox.max.y;
    const group = new THREE.Group();
    group.add(root);
    const componentRoots = [];

    componentRootObjects.forEach((compRoot, i) => {
      const comp = components[i];
      applyMaterial(compRoot, {
        type: comp.type,
        color: comp.color,
        roughness: comp.roughness,
        metalness: comp.metalness,
        emissive: comp.emissive,
        emissiveIntensity: comp.emissiveIntensity,
        ...componentMaps[i],
      });
      applyShadows(compRoot, {
        castShadow: comp.castShadow,
        receiveShadow: comp.receiveShadow,
      });
      if (comp.position) compRoot.position.set(...comp.position);
      if (comp.rotation) compRoot.rotation.set(...comp.rotation);
      group.add(compRoot);
      componentRoots.push(compRoot);
    });

    group.updateMatrixWorld(true);
    const focusBox = new THREE.Box3();
    focusBox.expandByObject(root, true);
    for (const cr of componentRoots) focusBox.expandByObject(cr, true);
    const focusY = focusBox.isEmpty()
      ? -height / 2
      : (focusBox.min.y + focusBox.max.y) / 2;

    const lights = attachLights(group, spec.lights);
    this._lights.push(...lights);
    this._shadowCasters.push(...lights.filter((l) => l.wantsShadow));

    this._decorateBlock({
      spec,
      group,
      root,
      components,
      componentRoots,
      blockMaps,
      componentMaps,
    });

    this._trackUnlitMeshes(group, group);
    this._trackEmissiveMeshes(group, group);

    return { group, height, focusY };
  }

  async loadBlocks(specs) {
    if (!this._loader) this._loader = new GLTFLoader(this._loadingManager);
    if (!this._textureLoader) {
      this._textureLoader = new THREE.TextureLoader(this._loadingManager);
    }
    if (specs.length === 0) return this;

    const first = await this._loadBlock(specs[0]);
    this.addBlock(first.group, first.height, first.focusY);

    const rest = specs.slice(1).map((s) => this._loadBlock(s));
    // The remaining blocks keep loading detached so the caller can put the
    // column on screen as soon as the first one lands. `ready` resolves once
    // they're all placed — wait on it before precompiling, since each block
    // adds lights and every change to the scene's light count invalidates the
    // programs compiled so far (see _updateLights).
    this.ready = (async () => {
      for (const p of rest) {
        const b = await p;
        this.addBlock(b.group, b.height, b.focusY);
      }
      return this;
    })();

    return this;
  }

  scroll(delta) {
    if (this.blocks.length === 0) return;
    this.scrollPos += delta;

    if (this.shifting) {
      this.shifting = false;
      this._layout();
      return;
    }

    const topY = this.origin + this.scrollPos;
    if (topY < 0) {
      const moved = this.blocks.pop();
      this.origin += moved.height;
      this.blocks.unshift(moved);
      this.shifting = true;
    } else if (topY > this.blocks[0].height) {
      const moved = this.blocks.shift();
      this.origin -= moved.height;
      this.blocks.push(moved);
      this.shifting = true;
    }
    // A wrap changes which blocks neighbour which, so every frozen depth cube
    // may now be missing (or holding) geometry; have _updateLights redraw them.
    if (this.shifting) {
      for (const caster of this._shadowCasters) caster.primed = false;
    }

    this._layout();
  }

  _layout() {
    let y = this.origin + this.scrollPos;
    for (const block of this.blocks) {
      block.object.position.y = y;
      y -= block.height;
    }
  }
}
