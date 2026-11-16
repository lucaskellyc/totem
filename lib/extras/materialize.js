import * as THREE from "three";

// Materialize: a mesh builds itself bottom-up out of a wireframe. A glowing
// scaffold of the mesh's triangles leads a horizontal front up the component,
// with scanlines crawling through it, and the solid surface fills in behind
// the front with a hot seam at the edge. It holds, dissolves back down
// through the wireframe, and (looping) starts over.
//
// Opt in per block or component with `materialize: { ... }` on its spec:
//   color     wire + seam color (hex)                       default 0x59b8ff
//   build     seconds for the front to sweep up             default 2.5
//   hold      seconds fully built                           default 4
//   unbuild   seconds for the front to sweep back down      default 1.5
//   gap       seconds fully gone before the next build      default 1
//   delay     seconds before the first build (staggers)     default 0
//   angle     sweep direction in degrees, around the view   default 0
//             axis: 0 builds bottom-up, 90 left-to-right,
//             180 top-down, 45 diagonally up-right
//   loop      repeat the cycle; false builds once and holds default true
//   lead      wire height ahead of the front (0–1 of mesh)  default 0.35
//   ghost     faint wire over the whole unbuilt part (0–1)  default 0.12
//   quads     draw quads where the triangles form them,     default true
//             dropping their diagonals; false shows every
//             triangle edge
//   turbulence  roughen the front with drifting 3D noise    default 0
//             (0–1): 0 is a clean sweep, 1 builds in
//             noise-shaped patches with no sweep left
//
// Turbulence blends each point's height toward the noise, so the front's
// travel (0 → 1) still covers the whole mesh at any amount.
//
// The front runs through each root's world-space extent along that direction,
// so a component made of several meshes builds as one piece. It injects into whatever material the
// mesh ends up with (standard, unlit, gem, water…), so apply it last.
const PARS = /* glsl */ `
  uniform vec3 uMatOrigin;
  uniform vec3 uMatDir;
  uniform float uMatBase;
  uniform float uMatInvH;
  uniform float uMatFront;
  uniform float uMatTime;
  uniform float uMatTurb;
  varying float vMatY;
  varying vec3 vMatP;
`;

// The same, plus the turbulent height the front is measured against.
const FRAG_PARS = /* glsl */ `
  ${PARS}
  float matHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float matNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(matHash(i), matHash(i + vec3(1, 0, 0)), f.x),
          mix(matHash(i + vec3(0, 1, 0)), matHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(matHash(i + vec3(0, 0, 1)), matHash(i + vec3(1, 0, 1)), f.x),
          mix(matHash(i + vec3(0, 1, 1)), matHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float matY() {
    if (uMatTurb <= 0.0) return vMatY;
    vec3 p = vMatP * 1.0 + vec3(0.0, -uMatTime * 0.4, uMatTime * 0.15);
    float n = 0.6667 * matNoise(p) + 0.3333 * matNoise(p * 2.03 + 17.0);
    return mix(vMatY, n, uMatTurb);
  }
`;

const VERTEX = /* glsl */ `
  #include <begin_vertex>
  vec3 matRel = (modelMatrix * vec4(transformed, 1.0)).xyz - uMatOrigin;
  vMatY = (dot(matRel, uMatDir) - uMatBase) * uMatInvH;
  vMatP = matRel * uMatInvH;
`;

// The wireframe overlay: brightest at the front, fading over `lead` above it
// and a short trail below it, with scanlines rolling upward.
const WIRE_FRAGMENT = /* glsl */ `
  {
    float d = matY() - uMatFront;
    float a = d > 0.0
      ? max(1.0 - smoothstep(0.0, uMatLead, d), uMatGhost)
      : 1.0 - smoothstep(0.0, uMatTrail, -d);
    a *= 0.6 + 0.4 * sin(vMatY * 60.0 - uMatTime * 8.0);
    a *= uMatWire;
    if (a < 0.002) discard;
    diffuseColor.a *= a;
  }
  #include <opaque_fragment>
`;

const WIRE_PARS = /* glsl */ `
  uniform float uMatLead;
  uniform float uMatTrail;
  uniform float uMatGhost;
  uniform float uMatWire;
`;

// The solid: cut away above the front, with a glowing seam just below it.
const SOLID_CLIP = /* glsl */ `
  float matH = matY();
  if (matH > uMatFront) discard;
  #include <clipping_planes_fragment>
`;

const SOLID_SEAM = /* glsl */ `
  outgoingLight += uMatColor * (1.0 - smoothstep(0.0, uMatSeam, uMatFront - matH)) * 2.0;
  #include <opaque_fragment>
`;

const SEAM_WIDTH = 0.2;
const TRAIL = 0.08;
const WIRE_FADE = 0.1; // s, the ghost fading in/out at the cycle's ends

const smooth = (x) => x * x * (3 - 2 * x);

// Quad recovery. glTF only stores triangles, so a modeled quad arrives as two
// triangles split along a diagonal. An edge is taken for such a diagonal when
// exactly two triangles share it, it's strictly the longest side of both (a
// tie, like the meridians of a sphere's pole fan, isn't a diagonal), and the
// two are close to coplanar (QUAD_MAX_FOLD) — the same rule as "tris to quads".
const QUAD_MAX_FOLD = Math.cos(THREE.MathUtils.degToRad(30));
const LONGEST_MARGIN = 1.001; // squared-length ratio over the other two sides
const WELD = 1e4; // vertex positions are welded at 0.1 mm, across UV/normal seams

const edgeCache = new WeakMap(); // geometry -> { quads, all } line geometries

/** A LineSegments geometry of `geometry`'s triangle edges, each drawn once;
 *  with `quads`, the diagonals of recovered quads are left out. */
function wireGeometry(geometry, quads) {
  const cached = edgeCache.get(geometry) ?? {};
  const key = quads ? "quads" : "all";
  if (cached[key]) return cached[key];

  const pos = geometry.attributes.position;
  const index = geometry.index;
  const triCount = (index ? index.count : pos.count) / 3;
  const vert = (i) => (index ? index.getX(i) : i);

  // Weld split vertices so triangles either side of a seam share edges.
  const ids = new Map();
  const welded = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * WELD)},${Math.round(pos.getY(i) * WELD)},${Math.round(pos.getZ(i) * WELD)}`;
    let id = ids.get(k);
    if (id === undefined) ids.set(k, (id = ids.size));
    welded[i] = id;
  }

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normals = [];
  // edge "lo,hi" -> { v: [vertex, vertex], tris: [{ tri, longest }] }
  const edges = new Map();
  for (let t = 0; t < triCount; t++) {
    const v = [vert(t * 3), vert(t * 3 + 1), vert(t * 3 + 2)];
    a.fromBufferAttribute(pos, v[0]);
    b.fromBufferAttribute(pos, v[1]);
    c.fromBufferAttribute(pos, v[2]);
    const lens = [a.distanceToSquared(b), b.distanceToSquared(c), c.distanceToSquared(a)];
    normals[t] = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3());
    for (let e = 0; e < 3; e++) {
      const p = v[e];
      const q = v[(e + 1) % 3];
      const wp = welded[p];
      const wq = welded[q];
      if (wp === wq) continue; // degenerate
      const k = wp < wq ? `${wp},${wq}` : `${wq},${wp}`;
      let edge = edges.get(k);
      if (!edge) edges.set(k, (edge = { v: [p, q], tris: [] }));
      const others = Math.max(lens[(e + 1) % 3], lens[(e + 2) % 3]);
      edge.tris.push({ tri: t, longest: lens[e] > others * LONGEST_MARGIN });
    }
  }

  const out = [];
  for (const { v, tris } of edges.values()) {
    if (
      quads &&
      tris.length === 2 &&
      tris[0].longest &&
      tris[1].longest &&
      Math.abs(normals[tris[0].tri].dot(normals[tris[1].tri])) >= QUAD_MAX_FOLD
    ) {
      continue;
    }
    for (const i of v) out.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  }

  const lines = new THREE.BufferGeometry();
  lines.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  cached[key] = lines;
  edgeCache.set(geometry, cached);
  return lines;
}

// Wrap a material's onBeforeCompile (keeping any earlier injection, e.g. the
// gem's) and give it a distinct program cache key so it doesn't share a
// program with the un-materialized variant.
function inject(mat, uniforms, edit) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    edit(shader);
  };
  mat.customProgramCacheKey = () => `${prevKey}|materialize`;
  mat.needsUpdate = true;
}

const addVertex = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${PARS}`)
    .replace("#include <begin_vertex>", VERTEX);
};

export class MaterializeEffect {
  constructor() {
    this.items = [];
  }

  applyTo(root, spec) {
    const opts = spec?.materialize;
    if (!opts) return;
    const color = new THREE.Color().setHex(opts.color ?? 0x59b8ff);

    // The sweep direction, tilted from straight up around the view (z) axis.
    const angle = THREE.MathUtils.degToRad(opts.angle ?? 0);
    const dir = new THREE.Vector3(Math.sin(angle), Math.cos(angle), 0);

    // The root's extent along `dir`, relative to its own origin, so the front
    // can follow it as the totem scrolls. Measured over the vertices rather
    // than the bounding box, so a diagonal sweep doesn't start in empty space.
    root.updateWorldMatrix(true, true);
    const origin = new THREE.Vector3().setFromMatrixPosition(root.matrixWorld);
    const v = new THREE.Vector3();
    let min = Infinity;
    let max = -Infinity;
    root.traverse((node) => {
      const pos = node.isMesh && node.geometry.attributes.position;
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        const d = v.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld).sub(origin).dot(dir);
        if (d < min) min = d;
        if (d > max) max = d;
      }
    });
    if (min > max) return;

    // Basic (not line) material so the totem dims it off-focus like the other
    // unlit surfaces; it renders as lines on a LineSegments all the same.
    const wireMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    wireMat.name = "materialize-wire";

    const u = {
      uMatOrigin: { value: new THREE.Vector3() },
      uMatDir: { value: dir },
      uMatBase: { value: min },
      uMatInvH: { value: 1 / Math.max(max - min, 1e-4) },
      uMatFront: { value: 0 },
      uMatTime: { value: 0 },
      uMatTurb: { value: opts.turbulence ?? 0 },
      uMatLead: { value: opts.lead ?? 0.35 },
      uMatTrail: { value: TRAIL },
      uMatGhost: { value: opts.ghost ?? 0.12 },
      uMatWire: { value: 0 },
      uMatSeam: { value: SEAM_WIDTH },
      // The wire's own color: the totem dims it off-focus (it's tracked as an
      // unlit mesh), so the seam dims with it.
      uMatColor: { value: wireMat.color },
    };

    inject(wireMat, u, (shader) => {
      addVertex(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${FRAG_PARS}\n${WIRE_PARS}`)
        .replace("#include <opaque_fragment>", WIRE_FRAGMENT);
    });

    const solids = new Set();
    const meshes = [];
    root.traverse((node) => {
      if (!node.isMesh || node.material?.name === "materialize-wire") return;
      for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
        if (mat) solids.add(mat);
      }
      meshes.push(node);
    });
    for (const node of meshes) {
      const wire = new THREE.LineSegments(wireGeometry(node.geometry, opts.quads ?? true), wireMat);
      wire.castShadow = false;
      wire.receiveShadow = false;
      node.add(wire);
    }
    for (const mat of solids) {
      inject(mat, u, (shader) => {
        addVertex(shader);
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>\n${FRAG_PARS}\nuniform vec3 uMatColor;\nuniform float uMatSeam;`,
          )
          .replace("#include <clipping_planes_fragment>", SOLID_CLIP)
          .replace("#include <opaque_fragment>", SOLID_SEAM);
      });
    }

    const lead = u.uMatLead.value;
    this.items.push({
      root,
      meshes: meshes.map((mesh) => ({ mesh, castShadow: mesh.castShadow })),
      u,
      // The front's travel: from just below the mesh (only the lead's tip is
      // showing) to past its top (the trail and seam have cleared it).
      start: -lead,
      end: 1 + Math.max(TRAIL, SEAM_WIDTH),
      build: opts.build ?? 2.5,
      hold: opts.hold ?? 4,
      unbuild: opts.unbuild ?? 1.5,
      gap: opts.gap ?? 1,
      delay: opts.delay ?? 0,
      loop: opts.loop ?? true,
      built: null,
    });
  }

  // Where the front sits at time t (0 = start, 1 = end of its travel) and how
  // much of the wireframe is showing.
  static phase(it, t) {
    let s = t - it.delay;
    if (s < 0) return { k: 0, wire: 0 };
    if (!it.loop) {
      if (s >= it.build) return { k: 1, wire: 1 };
      return { k: smooth(s / it.build), wire: Math.min(1, s / WIRE_FADE) };
    }
    s %= it.build + it.hold + it.unbuild + it.gap;
    if (s < it.build) return { k: smooth(s / it.build), wire: Math.min(1, s / WIRE_FADE) };
    s -= it.build;
    if (s < it.hold) return { k: 1, wire: 1 };
    s -= it.hold;
    if (s < it.unbuild) {
      return { k: 1 - smooth(s / it.unbuild), wire: Math.min(1, (it.unbuild - s) / WIRE_FADE) };
    }
    return { k: 0, wire: 0 };
  }

  update(t) {
    for (const it of this.items) {
      const { k, wire } = MaterializeEffect.phase(it, t);
      it.root.updateWorldMatrix(true, false);
      it.u.uMatOrigin.value.setFromMatrixPosition(it.root.matrixWorld);
      it.u.uMatFront.value = it.start + (it.end - it.start) * k;
      it.u.uMatTime.value = t;
      it.u.uMatWire.value = wire;
      // Discarded fragments still land in the shadow map, so only cast once
      // the mesh is whole.
      const built = k >= 1;
      if (built !== it.built) {
        it.built = built;
        for (const m of it.meshes) m.mesh.castShadow = built && m.castShadow;
      }
    }
  }
}
