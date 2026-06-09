import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadMaps } from "./totem/loaders.js";
import { applyMaterial, applyShadows } from "./totem/materials.js";
import { createPrimitive, attachPlanes } from "./totem/primitives.js";

export class Totem extends THREE.Group {
  constructor({ loadingManager } = {}) {
    super();
    this.blocks = [];
    this.origin = 0;
    this.scrollPos = 0;
    this.shifting = false;
    this._loader = null;
    this._textureLoader = null;
    this._loadingManager = loadingManager ?? null;
    this._unlitMeshes = [];
    this._videos = [];
    this._docHidden = typeof document !== "undefined" && document.hidden;
    this._startTime = performance.now();
    this.unlitFocusY = -5;
    this.unlitFalloff = 0.4;
    this.videoFocusY = -5;
    this.videoActiveRange = 6;
    if (typeof document !== "undefined") {
      this._onVisibility = () => {
        this._docHidden = document.hidden;
      };
      document.addEventListener("visibilitychange", this._onVisibility);
    }
  }

  _trackVideo(group, videoEntry) {
    if (!videoEntry) return;
    this._videos.push({ group, entry: videoEntry });
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

  _decorateBlock(_ctx) {}
  _updateExtras(_t) {}

  update() {
    const t = (performance.now() - this._startTime) / 1000;
    for (const v of this._videos) {
      const worldY = v.group.position.y;
      const inFocus =
        Math.abs(worldY - this.videoFocusY) <= this.videoActiveRange;
      if (this._docHidden || !inFocus) v.entry.pause();
      else v.entry.play();
    }
    for (const u of this._unlitMeshes) {
      const worldY = u.group.position.y + u.localY;
      const fade = Math.abs(worldY - this.unlitFocusY) * this.unlitFalloff;
      const brightness = Math.max(1 - fade, 0);
      u.material.color
        .setHex(u.material.userData.baseColorHex)
        .multiplyScalar(brightness);
    }
    this._updateExtras(t);
  }

  async _loadGltf(url) {
    try {
      return await this._loader.loadAsync(url);
    } catch (cause) {
      throw new Error(`Failed to load GLB: ${url}`, { cause });
    }
  }

  addBlock(object, height, focusY) {
    this.add(object);
    this.blocks.push({ object, height, focusY: focusY ?? -height / 2 });
    this._layout();
    return this;
  }

  async loadBlocks(specs) {
    if (!this._loader) this._loader = new GLTFLoader(this._loadingManager);
    if (!this._textureLoader) {
      this._textureLoader = new THREE.TextureLoader(this._loadingManager);
    }

    const loaded = await Promise.all(
      specs.map(async (spec) => {
        const components = spec.components ?? [];
        const [blockGltf, blockMaps, componentGltfs, componentMaps] =
          await Promise.all([
            this._loadGltf(spec.url),
            loadMaps(this._textureLoader, spec),
            Promise.all(
              components.map((c) => (c.shape ? null : this._loadGltf(c.url))),
            ),
            Promise.all(components.map((c) => loadMaps(this._textureLoader, c))),
          ]);

        const root = blockGltf.scene;
        applyMaterial(root, {
          type: spec.type,
          color: spec.color,
          roughness: spec.roughness,
          metalness: spec.metalness,
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

        componentGltfs.forEach((gltf, i) => {
          const comp = components[i];
          const compRoot = gltf ? gltf.scene : createPrimitive(comp);
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

        attachPlanes(group, spec.planes);

        this._decorateBlock({
          spec,
          group,
          root,
          components,
          componentRoots,
          blockMaps,
          componentMaps,
        });

        this._trackVideo(group, blockMaps.video);
        componentMaps.forEach((m) => this._trackVideo(group, m.video));

        this._trackUnlitMeshes(group, group);

        return { group, height, focusY };
      }),
    );
    for (const { group, height, focusY } of loaded) {
      this.addBlock(group, height, focusY);
    }
    return this;
  }

  scroll(delta) {
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
