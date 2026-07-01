import * as THREE from "three";

export const blocks = [
  {
    url: "./assets/block_stylish.glb",
    normalMap: "./assets/block_stylish_norm.jpg",
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
        url: "./assets/component_stylish_a.glb",
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
        video: "./assets/godrays.mp4",
        position: [0, -2, -0.7],
      },
    ],
  },
  // {
  //   url: "./assets/block_office.glb",
  //   texture: "./assets/block_office_color.jpg",
  //   normalMap: "./assets/block_office_norm.jpg",
  //   roughness: 0.8,
  //   receiveShadow: true,
  //   lights: [
  //     {
  //       position: [1, -1.5, 2],
  //       color: 0xe2cfb4,
  //       castShadow: true,
  //     },
  //     {
  //       position: [-1, -2.5, 2],
  //       color: 0x555555,
  //     },
  //   ],
  //   components: [],
  // },
  {
    url: "./assets/block_fountain.glb",
    texture: "./assets/block_fountain_color.jpg",
    normalMap: "./assets/block_fountain_norm.jpg",
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
        url: "./assets/component_fountain_a.glb",
        castShadow: true,
        texture: "./assets/fountain_color_a.jpg",
        normalMap: "./assets/fountain_norm_a.jpg",
        roughness: 0.4,
        position: [0, -2.85, 0.3],
      },
      {
        url: "./assets/component_fountain_b.glb",
        castShadow: true,
        texture: "./assets/fountain_color_b.jpg",
        roughness: 0.4,
        position: [0, -3, 0.6],
      },
      {
        url: "./assets/component_fountain_c.glb",
        castShadow: true,
        texture: "./assets/fountain_color_c.jpg",
        normalMap: "./assets/fountain_norm_c.jpg",
        roughness: 0.4,
        position: [0, -2.45, 0.7],
      },
      {
        url: "./assets/component_fountain_d.glb",
        type: "water",
        castShadow: true,
        sound: {
          url: "./assets/fountain.wav",
          volume: 25,
          refDistance: 0.1,
          rolloff: 5,
          distanceModel: "inverse",
          maxDistance: 5,
          fade: 8,
        },
        position: [0, -2.65, 0.62],
      },
    ],
  },
  {
    url: "./assets/block_vault.glb",
    texture: "./assets/block_vault_color.jpg",
    normalMap: "./assets/block_vault_norm.jpg",
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
        url: "./assets/component_vault_a.glb",
        castShadow: true,
        normalMap: "./assets/vault_norm_a.jpg",
        roughnessMap: "./assets/vault_rough_a.jpg",
        metalness: 0.8,
        position: [-0.65, -1.8, 0.5],
      },
      {
        url: "./assets/component_vault_b.glb",
        castShadow: true,
        normalMap: "./assets/vault_norm_b.jpg",
        roughnessMap: "./assets/vault_rough_b.jpg",
        metalness: 0.8,
        position: [0, -1.8, 0.35],
      },
      {
        url: "./assets/component_vault_c.glb",
        castShadow: true,
        normalMap: "./assets/vault_norm_c.jpg",
        roughnessMap: "./assets/vault_rough_c.jpg",
        metalness: 0.8,
        position: [0, -1.8, 0.7],
      },
      {
        url: "./assets/component_vault_d.glb",
        castShadow: true,
        normalMap: "./assets/vault_norm_d.jpg",
        roughnessMap: "./assets/vault_rough_d.jpg",
        metalness: 0.8,
        position: [0, -1.8, 0.5],
      },
    ],
  },
  {
    url: "./assets/block_tv.glb",
    texture: "./assets/tv_color_a.jpg",
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
        url: "./assets/component_tv_a.glb",
        type: "unlit",
        video: "./assets/tv_1.mp4",
        castShadow: false,
        position: [0, -2.85, 0.05],
      },
    ],
  },
];
