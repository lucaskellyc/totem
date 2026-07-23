import * as THREE from "three";

const CDN = "https://cdn.jsdelivr.net/gh/lucaskellyc/totem@stable/assets";
// Dev serves new/untracked files straight from the local `assets/` folder via
// Vite (VITE_ASSET_URL=/assets in .env.development); prod falls back to the CDN.
const BASE = import.meta.env.VITE_ASSET_URL ?? CDN;
const asset = (name) => `${BASE}/${name}`;

// Reuse the tv model/lights while swapping the screen texture and playing video.
// `texture` and `video` are asset names (passed through `asset()` here).
const makeTv = ({ texture, video }) => ({
    url: asset("block_tv.glb"),
    texture: asset(texture),
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
      castShadow: true,
      texture: asset("fancy_color_c.jpg"),
      normalMap: asset("fancy_norm_c.jpg"),
      roughness: 0.4,
      position: [0, -2, 0.15],
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
      },
      {
        position: [0, -2.5, 0],
        color: 0x555555,
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
        video: asset("godrays.mp4"),
        position: [0, -2, -0.7],
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
      },
    ],
    components: [
      {
        url: asset("component_fountain_a.glb"),
        castShadow: true,
        texture: asset("fountain_color_a.jpg"),
        normalMap: asset("fountain_norm_a.jpg"),
        roughness: 0.4,
        position: [0, -2.85, 0.3],
      },
      {
        url: asset("component_fountain_b.glb"),
        castShadow: true,
        texture: asset("fountain_color_b.jpg"),
        roughness: 0.4,
        position: [0, -3, 0.6],
      },
      {
        url: asset("component_fountain_c.glb"),
        castShadow: true,
        texture: asset("fountain_color_c.jpg"),
        normalMap: asset("fountain_norm_c.jpg"),
        roughness: 0.4,
        position: [0, -2.45, 0.7],
      },
      {
        url: asset("component_fountain_d.glb"),
        type: "water",
        castShadow: true,
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
        normalMap: asset("vault_norm_a.jpg"),
        roughnessMap: asset("vault_rough_a.jpg"),
        metalness: 0.8,
        position: [-0.65, -1.8, 0.5],
      },
      {
        url: asset("component_vault_b.glb"),
        castShadow: true,
        normalMap: asset("vault_norm_b.jpg"),
        roughnessMap: asset("vault_rough_b.jpg"),
        metalness: 0.8,
        position: [0, -1.8, 0.35],
      },
      {
        url: asset("component_vault_c.glb"),
        castShadow: true,
        normalMap: asset("vault_norm_c.jpg"),
        roughnessMap: asset("vault_rough_c.jpg"),
        metalness: 0.8,
        position: [0, -1.8, 0.7],
      },
      {
        url: asset("component_vault_d.glb"),
        castShadow: true,
        normalMap: asset("vault_norm_d.jpg"),
        roughnessMap: asset("vault_rough_d.jpg"),
        metalness: 0.8,
        position: [0, -1.8, 0.5],
      },
    ],
};

export const vent = {
  url: asset("block_vent.glb"),
  lights: [
    {
      position: [-1, -2, 2],
      color: 0x555555,
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
    }
  ],
};

export const tv = makeTv({ texture: "tv_color_a.jpg", video: "tv_1.mp4" });



// Every block, used as the fallback rotation for columns without a custom set.
export const blocks = [stylish, fountain, vault, tv];

// Per-column block lists. Edit an entry to give that column a unique set of
// blocks (add, remove, or reorder). Reusing the same spec object across columns
// is fine — THREE.Cache dedupes downloads while each column parses its own fresh
// scene-graph instances. Columns without an entry fall back to a rotation of
// `blocks` so adjacent columns start on different blocks.
export const columns = [
  [sideshow, generic, dilapidated, generic],
  [vault, generic, tv, vent],
  [fancy, fountain, stylish, generic],
];

export const columnBlocks = (index) =>
  columns[index] ??
  blocks.slice(index % blocks.length).concat(blocks.slice(0, index % blocks.length));
