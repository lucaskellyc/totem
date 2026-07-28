import * as THREE from "three";
import { color, metalness, roughness } from "three/src/nodes/TSL.js";
import { texture } from "three/tsl";

const CDN = "https://cdn.jsdelivr.net/gh/lucaskellyc/totem@stable/assets";
// Dev serves new/untracked files straight from the local `assets/` folder via
// Vite (VITE_ASSET_URL=/assets in .env.development); prod falls back to the CDN.
const BASE = import.meta.env.VITE_ASSET_URL ?? CDN;
const asset = (name) => `${BASE}/${name}`;

// Reuse the tv model/lights while swapping the screen texture and playing video.
// `texture`, `video`, and `normalMap` are asset names (passed through `asset()`
// here); `roughness` and `metalness` are scalar material values.
const makeTv = ({ texture, video, normalMap, roughness, metalness }) => ({
    url: asset("block_tv.glb"),
    texture: asset(texture),
    ...(normalMap !== undefined && { normalMap: asset(normalMap) }),
    ...(roughness !== undefined && { roughness }),
    ...(metalness !== undefined && { metalness }),
    receiveShadow: true,
    lights: [
      {
        position: [0, -1, 2],
        color: 0x94a6d4,
        castShadow: true,
      },
    ],
    components: [
      {
        url: asset("component_tv_a.glb"),
        type: "unlit",
        video: asset(video),
        castShadow: false,
        position: [0, -2.85, 0.05],
      },
    ],
});

// Neon sign — bundles the `component_neonsign_*` meshes into one grouped block.
// Each entry's `mesh` letter maps to `${prefix}_${mesh}.glb` (defaulting to the
// `component_neonsign` prefix); pass a different `prefix` to swap in another set
// of meshes. Meshes glow via an emissive standard material; give one a `blink` to
// make it flicker (BulbEffect also casts a synced point light).
const NEON_PREFIX = "component_neonsign";
const neonMesh = (m, prefix = NEON_PREFIX) => ({
    url: asset(`${prefix}_${m.mesh}.glb`),
    type: "standard",
    color: 0x000000,
    emissive: m.emissive ?? 0xffffff,
    emissiveIntensity: m.emissiveIntensity ?? 1,
    ...(m.blink && { blink: m.blink }),
    ...(m.position && { position: m.position }),
});

// Vector add, used to place every mesh relative to a shared origin.
const addVec = (a, b = [0, 0, 0]) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// Build the neon mesh specs, offsetting each mesh's `position` from a single
// `origin` so the whole sign moves as a unit (per-mesh `position` is its offset
// from that origin, defaulting to no offset). Pass `prefix` to swap the mesh set.
const neonMeshes = (meshes, origin = [0, 0, 0], prefix = NEON_PREFIX) =>
  meshes.map((m) => neonMesh({ ...m, position: addVec(origin, m.position) }, prefix));

// `origin` is the sign's base position; each mesh's `position` is relative to it.
// The first entry becomes the block root (top-anchored for height, so the origin
// only moves the component meshes 2..n) — keep it as the backing/frame. `prefix`
// swaps the `component_neonsign` mesh set for another.
const makeNeon = ({ meshes, lights, origin = [0, 0, 0], prefix = NEON_PREFIX }) => {
    const [root, ...components] = neonMeshes(meshes, origin, prefix);
    return {
      ...root,
      receiveShadow: true,
      lights: lights ?? [
        {
          position: [0, -1.5, 2],
          color: 0x333333,
        },
      ],
      components,
    };
};

export const generic = {
  url: asset("block_generic.glb"),
  lights: [
    {
      position: [0, -1.5, 3],
      color: 0xbbbbbb,
    },
  ],
};

export const fancy = {
  url: asset("block_fancy.glb"),
  texture: asset("block_fancy_color.jpg"),
  normalMap: asset("block_fancy_norm.jpg"),
  receiveShadow: true,
  lights: [
    {
      position: [0, -1.5, 2],
      color: 0xcccccc,
      castShadow: true,
    },
  ],
  components: [
    {
      url: asset("component_fancy_a.glb"),
      castShadow: true,
      texture: asset("fancy_color_a.jpg"),
      normalMap: asset("fancy_norm_a.jpg"),
      roughness: 0.4,
      position: [0, -2.15, 0],
    },
    {
      url: asset("component_fancy_b.glb"),
      castShadow: true,
      color: 0x222222,
      alphaMap: asset("fancy_alpha_b.jpg"),
      normalMap: asset("fancy_norm_b.jpg"),
      roughnessMap: asset("fancy_rough_b.jpg"),
      position: [0, -2.15, 0],
    },
    {
      url: asset("component_fancy_c.glb"),
      castShadow: false,
      texture: asset("fancy_color_c.jpg"),
      normalMap: asset("fancy_norm_c.jpg"),
      roughness: 0.4,
      position: [0, -2, 0.15],
    },
    {
      object: () => {
        const geo = new THREE.PlaneGeometry(2.2, 3);
        const mat = new THREE.MeshBasicMaterial({
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        return new THREE.Mesh(geo, mat);
      },
      castShadow: false,
      type: "unlit",
      video: asset("tall_3.mp4"),
      position: [0, -2, 0],
    },
  ],
};

export const stylish = {
    url: asset("block_stylish.glb"),
    normalMap: asset("block_stylish_norm.jpg"),
    roughness: 0.4,
    receiveShadow: true,
    lights: [
      {
        position: [1, -1, 3],
        color: 0x94a6d4,
        castShadow: true,
      },
      {
        position: [-1, -2.5, 2],
        color: 0x555555,
        castShadow: false,
      },
      {
        position: [0, -2.5, 0],
        color: 0x555555,
        castShadow: false,
      },
    ],
    components: [
      {
        url: asset("component_stylish_a.glb"),
        castShadow: true,
        roughness: 0.4,
        position: [0, -3.2, 0],
      },
      {
        object: () => {
          const geo = new THREE.PlaneGeometry(2.2, 3);
          const mat = new THREE.MeshBasicMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          return new THREE.Mesh(geo, mat);
        },
        video: asset("tall_2.mp4"),
        position: [0, -2, -0.7],
        castShadow: false,
      },
    ],
};

export const fountain = {
    url: asset("block_fountain.glb"),
    texture: asset("block_fountain_color.jpg"),
    normalMap: asset("block_fountain_norm.jpg"),
    roughness: 0.4,
    receiveShadow: true,
    lights: [
      {
        position: [1, -1.5, 2],
        color: 0xe2cfb4,
        castShadow: true,
      },
      {
        position: [-1, -2.5, 2],
        color: 0x555555,
        castShadow: false,
      },
    ],
    components: [
      {
        url: asset("component_fountain_a.glb"),
        castShadow: false,
        texture: asset("fountain_color_a.jpg"),
        normalMap: asset("fountain_norm_a.jpg"),
        roughness: 0.4,
        position: [0, -2.85, 0.3],
      },
      {
        url: asset("component_fountain_b.glb"),
        castShadow: false,
        texture: asset("fountain_color_b.jpg"),
        roughness: 0.4,
        position: [0, -3, 0.6],
      },
      {
        url: asset("component_fountain_c.glb"),
        castShadow: false,
        texture: asset("fountain_color_c.jpg"),
        normalMap: asset("fountain_norm_c.jpg"),
        roughness: 0.4,
        position: [0, -2.45, 0.7],
      },
      {
        url: asset("component_fountain_d.glb"),
        type: "water",
        castShadow: false,
        position: [0, -2.65, 0.62],
      },
    ],
};

export const vault = {
    url: asset("block_vault.glb"),
    texture: asset("block_vault_color.jpg"),
    normalMap: asset("block_vault_norm.jpg"),
    receiveShadow: true,
    lights: [
      {
        position: [-1, -2.5, 2],
        color: 0x333333,
        castShadow: true,
      },
      {
        position: [1, -0.8, 3],
        color: 0x94a6d4,
        castShadow: true,
      },
    ],
    components: [
      {
        url: asset("component_vault_a.glb"),
        castShadow: true,
        receiveShadow: true,
        normalMap: asset("vault_norm_a.jpg"),
        roughnessMap: asset("vault_rough_a.jpg"),
        metalness: 0.8,
        position: [-0.65, -1.8, 0.5],
      },
      {
        url: asset("component_vault_b.glb"),
        castShadow: true,
        receiveShadow: true,
        normalMap: asset("vault_norm_b.jpg"),
        roughnessMap: asset("vault_rough_b.jpg"),
        metalness: 0.8,
        position: [0, -1.8, 0.35],
      },
      {
        url: asset("component_vault_c.glb"),
        castShadow: true,
        receiveShadow: true,
        normalMap: asset("vault_norm_c.jpg"),
        roughnessMap: asset("vault_rough_c.jpg"),
        metalness: 0.8,
        position: [0, -1.8, 0.7],
      },
      {
        url: asset("component_vault_d.glb"),
        castShadow: true,
        receiveShadow: true,
        normalMap: asset("vault_norm_d.jpg"),
        roughnessMap: asset("vault_rough_d.jpg"),
        metalness: 0.8,
        position: [0, -1.8, 0.5],
      },
    ],
};

export const vent = {
  url: asset("block_vent.glb"),
  metalness: 0.8,
  roughness: 0.4,
  receiveShadow: true,
  lights: [
    {
      position: [-1, -2, 2],
      color: 0x555555,
      castShadow: true,
    },
  ],
  components: [
    {
      url: asset("component_vent_a.glb"),
      castShadow: true,
      metalness: 0.8,
      roughness: 0.4,
      normalMap: asset("vent_norm_a.jpg"),
      texture: asset("vent_color_a.jpg"),
      position: [0, -1.5, 0.3],
    },
    {
      url: asset("component_vent_b.glb"),
      castShadow: false,
      metalness: 0.8,
      roughness: 0.4,
      position: [0, -1.5, 0.1],
      spin: {
        axis: "z",
        speed: 5,
      },
    },
    {
      url: asset("component_vent_c.glb"),
      castShadow: false,
      metalness: 0.8,
      roughness: 0.4,
      alphaMap: asset("vent_alpha_c.jpg"),
      normalMap: asset("vent_norm_c.jpg"),
      position: [0, -1.5, 0.4],
    },
  ],
}

export const sideshow = {
  url: asset("block_sideshow.glb"),
  texture: asset("block_sideshow_color.jpg"),
  normalMap: asset("block_sideshow_norm.jpg"),
  lights: [
    {
      position: [-1, -2.5, 2],
      color: 0x333333,
    }
  ],
  components: [
    {
      url: asset("component_sideshow_a.glb"),
      type: "unlit",
    },
    {
      url: asset("component_sideshow_b1.glb"),
      type: "standard",
      color: 0x000000,
      emissive: 0xffee88,
      emissiveIntensity: 1,
      blink: {
        phase: 0,
        offset: [0, 0, 1.5],
        distance: 2,
      },
      position: [0, -3.2, -0.1],
    },
    {
      url: asset("component_sideshow_b2.glb"),
      type: "standard",
      color: 0x000000,
      emissive: 0xff5888,
      emissiveIntensity: 2.5,
      blink: {
        phase: 0.5,
        offset: [0, 0, 1.5],
        distance: 2,
      },
      position: [0, -3.2, -0.1],
    },
    {
      url: asset("square.glb"),
      type: "unlit",
      video: asset("square_1.mp4"),
      position: [0, -3.3, -0.8],
    },
    // Neon sign — the `component_neonsign_*` meshes grouped in as components
    // (replaces the former lone unlit `component_neonsign_1`). The second arg to
    // neonMeshes is the sign's single base position; each mesh's `position` (none
    // here) is a relative offset from it, so move the whole sign by editing origin.
    ...neonMeshes(
      [
        { mesh: "a", emissive: 0x00ff53, blink: { phase: 0, offset: [0, 0, 1], distance: 0.5 } },
        { mesh: "b", emissive: 0x00ffa2, blink: { phase: 0.1, offset: [0, 0, 1], distance: 0.5 } },
        { mesh: "c", emissive: 0x00ff53, blink: { phase: 0.2, offset: [0, 0, 1], distance: 0.5 } },
        { mesh: "d", emissive: 0x00ffa2, blink: { phase: 0.3, offset: [0, 0, 1], distance: 0.5 } },
        { mesh: "e", emissive: 0x00ff53, blink: { phase: 0.4, offset: [0, 0, 1], distance: 0.5 } },
        { mesh: "f", emissive: 0x00ffa2, blink: { phase: 0.5, offset: [0, 0, 1], distance: 0.5 } },
      ],
      [-0.1, -1.5, 0.5],
    ),
    {
      url: asset("component_neonsign_1.glb"),
      emissive: 0xff5888,
      emissiveIntensity: 2.5,
      position: [0, -1.3, 0.5],
    },
    {
      url: asset("component_neonsign_mount.glb"),
      position: [-0.1, -1.2, 0.45],
      color: 0xcccccc,
      metalness: 1,
      roughness: 0.4,
    },
  ],
};

export const dilapidated = {
  url: asset("block_dilapidated.glb"),
  texture: asset("block_dilapidated_color.jpg"),
  normalMap: asset("block_dilapidated_norm.jpg"),
  roughness: 0.4,
  receiveShadow: true,
  lights: [
    {
      position: [0, -2.5, 2],
      color: 0xbbbbbb,
      castShadow: false,
    },
    {
      position: [0, -1.7, 0.1],
      color: 0x800000,
      castShadow: true,
    },
  ],
  components: [
    {
      url: asset("component_dilapidated_a.glb"),
      castShadow: true,
      texture: asset("dilapidated_color_a.jpg"),
      normalMap: asset("dilapidated_norm_a.jpg"),
      roughness: 0.4,
      position: [0, -2, 0.3],
    },
    {
      url: asset("component_dilapidated_b.glb"),
      castShadow: true,
      texture: asset("dilapidated_color_b.jpg"),
      normalMap: asset("dilapidated_norm_b.jpg"),
      roughness: 0.6,
      position: [0, -2, 0.4],
    },
    {
      object: () => {
        const geo = new THREE.PlaneGeometry(2.2, 3);
        const mat = new THREE.MeshBasicMaterial({
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        return new THREE.Mesh(geo, mat);
      },
      video: asset("tall_1.mp4"),
      position: [0, -2, 0],
    },
  ],
};

export const construction = {
  url: asset("block_construction.glb"),
  texture: asset("block_construction_color.jpg"),
  receiveShadow: false,
  lights: [
    {
      position: [0, -1, 2],
      color: 0x555555,
      castShadow: false,
    },
  ],
  components: [
    {
      url: asset("component_construction_barrier.glb"),
      texture: asset("construction_barrier_color.jpg"),
      alphaMap: asset("construction_barrier_alpha.jpg"),
      position: [0, -2, 0.3],
    },
    ...neonMeshes(
      [
        { mesh: "a", emissive: 0xff2727, blink: { phase: 0, offset: [0, 0, 1], distance: 2 } },
        { mesh: "b", emissive: 0xffd527, blink: { phase: 0.1, offset: [0, 0, 1], distance: 0.8 } },
      ],
      [0, -2, 0.3],
      "component_caution",
    )
  ],
};

export const sewer = {
  url: asset("block_sewer.glb"),
  texture: asset("block_sewer_color.jpg"),
  normalMap: asset("block_sewer_norm.jpg"),
  roughness: 0.5,
  receiveShadow: true,
  lights: [
    {
      position: [-1, -0.2, 2],
      color: 0xb9ffe7,
      castShadow: true,
    },
    {
      position: [-1, -5, 2.5],
      color: 0xb6b39a,
      castShadow: true,
    },
    {
      position: [0.5, -8, 2.5],
      color: 0xb9ffe7,
      castShadow: true,
    },
  ],
  components: [
    {
      url: asset("component_sewer_1.glb"),
      texture: asset("sewer_1_color.jpg"),
      normalMap: asset("sewer_1_norm.jpg"),
      roughness: 0.4,
      position: [0, -2.1, 0],
      castShadow: true,
    },
    {
      url: asset("component_sewer_2.glb"),
      type: "water",
      color: 0x52544c,
      flowSpeed: 0.6,
      flowScale: 15,
      castShadow: false,
      roughness: 0.4,
      position: [0, -2.1, 0],
    },
    {
      url: asset("component_sewer_3.glb"),
      texture: asset("sewer_3_color.jpg"),
      normalMap: asset("sewer_3_norm.jpg"),
      roughness: 0.4,
      position: [0, -2.1, 0],
      castShadow: true,
    },
    {
      url: asset("component_sewer_4.glb"),
      texture: asset("sewer_4_color.jpg"),
      normalMap: asset("sewer_4_norm.jpg"),
      roughness: 0.4,
      position: [0, -2.1, 0],
      castShadow: true,
    },
    {
      url: asset("component_sewer_5.glb"),
      texture: asset("sewer_5_color.jpg"),
      alphaMap: asset("sewer_5_alpha.jpg"),
      roughness: 0.4,
      metalness: 0.8,
      position: [0, -2.1, -0.4],
      castShadow: true,
    },

  ],
};

export const corporate = {
  url: asset("block_corporate.glb"),
  texture: asset("block_corporate_color.jpg"),
  normalMap: asset("block_corporate_norm.jpg"),
  roughness: 0.7,
  lights: [
    {
      type: "point",
      color: 0x444444,
      position: [-0.5, -1, 1],
    },
  ],
  components: [
    {
    url: asset("square.glb"),
    type: "unlit",
    video: asset("square_2.mp4"),
    position: [0, -1.5, -0.2],
    }
  ],
};

export const tv1 = makeTv({
  texture: "block_tv_color_1.jpg",
  video: "tv_1.mp4",
  roughness: 0.3,
  metalness: 0,
});

export const tv2 = makeTv({
  texture: "block_tv_color_2.jpg",
  normalMap: "block_tv_norm_2.jpg",
  video: "tv_2.mp4",
  roughness: 0.3,
  metalness: 0,
});

export const tv3 = makeTv({
  texture: "block_tv_color_3.jpg",
  normalMap: "block_tv_norm_3.jpg",
  video: "tv_3.mp4",
  roughness: 0.4,
  metalness: 0.8,
});

export const neon = makeNeon({
  meshes: [
    // mesh "a" = block root: sets the block height, anchored (no position).
    { mesh: "a", emissive: 0xff2d95 },
    // meshes b..e = grouped components; tune position/blink to taste.
    { mesh: "b", emissive: 0x2de1ff, position: [0, -2, 0.1], blink: { phase: 0, offset: [0, 0, 1], distance: 2 } },
    { mesh: "c", emissive: 0xffee88, position: [0, -2.4, 0.1] },
    { mesh: "d", emissive: 0x8a2dff, position: [0, -2.8, 0.1], blink: { phase: 0.5, offset: [0, 0, 1], distance: 2 } },
    { mesh: "e", emissive: 0x2dff6a, position: [0, -3.2, 0.1] },
  ],
});

export const blocks = [stylish, fountain, vault, tv1, tv2, tv3];

export const columns = [
  [sideshow, sewer, construction, dilapidated, tv2],
  [vault, corporate, tv1, vent],
  [fancy, fountain, stylish, tv3],
];

export const columnBlocks = (index) =>
  columns[index] ??
  blocks.slice(index % blocks.length).concat(blocks.slice(0, index % blocks.length));
