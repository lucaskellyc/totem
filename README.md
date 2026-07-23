![Totem](assets/totem_logo.svg)

<p>
  <a href="https://lucaskellyc.github.io/totem/"><img src="assets/btn_demo.svg" alt="Demo" height="36"></a>

</p>

## Use it in your own project

```bash
npm i three
npm i github:lucaskellyc/totem
```

```js
import * as THREE from "three";
import { Totem } from "totem";

const scene = new THREE.Scene();
const totem = new Totem();
scene.add(totem);

await totem.loadBlocks([
  {
    url: "/models/block_a.glb",
    texture: "/textures/block_a.jpg",
    lights: [{ position: [0, -2, 2], color: 0xffffff, castShadow: true }],
  },
  {
    object: () => new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0x88aaff }),
    ),
  },
]);

// in your render loop:
totem.update();

// hook up scrolling (or use lib/totem/gestures.js):
window.addEventListener("wheel", (e) => totem.scroll(e.deltaY / 500));
```

## Block spec

| field           | type              | notes                                                             |
| --------------- | ----------------- | ----------------------------------------------------------------- |
| `url`           | string            | GLB to load as the block body                                     |
| `object`        | Object3D or `()=>Object3D` | inline three.js object as an alternative to `url`         |
| `texture`       | string            | sRGB color map                                                    |
| `normalMap`     | string            | linear normal map                                                 |
| `roughnessMap`  | string            | linear roughness map                                              |
| `type`          | string            | `"standard"` (default, lit PBR), `"unlit"`, or `"water"`          |
| `color`         | hex               | base color when no texture                                        |
| `roughness`     | number            | 0–1                                                               |
| `metalness`     | number            | 0–1                                                               |
| `emissive`      | hex               | (standard only)                                                   |
| `emissiveIntensity` | number        | (standard only)                                                   |
| `receiveShadow` | boolean           |                                                                   |
| `castShadow`    | boolean           |                                                                   |
| `lights`        | array             | see [Lights](#lights)                                             |
| `components`    | array             | child specs (same shape as a block spec, plus `position`/`rotation`) |

Components inherit every block-spec field, so any effect (`video`, `sound`, `blink`, `type: "water"`, …) works at either level.

### Lights

```js
{
  position: [x, y, z],
  color: 0xffffff,
  power: 15,          // intensity at zero distance
  distance: 3.5,
  castShadow: false,
}
```

Lights fade with distance from `totem.lightFocusY` (default `-5`), controlled by `totem.lightFalloff`. The same idea applies to unlit meshes via `totem.unlitFocusY` / `totem.unlitFalloff`.

## Extras

Opt-in modules in `lib/extras/`. Instantiate them in your demo, wire them into `totem._decorateBlock` and `totem._updateExtras`, then set the corresponding field on any spec.

### Water — `lib/extras/water.js`

Set `type: "water"` on a spec. `WaterEffect` swaps in a shader-modified `MeshStandardMaterial` with animated flow noise. Call `water.update(t)` in your render loop.

### Video — `lib/extras/video.js`

Set `video: "./thing.mp4"` (or an object with `loop`, `muted`, `playbackRate`, `autoplay`, …). Pair with `type: "unlit"` to swap the mesh to a `MeshBasicMaterial({ map: videoTexture })`, or omit `type` to just assign `.map` on your existing material (useful for additive/transparent overlays). Playback pauses when the block scrolls out of focus range or the tab is hidden.

### Bulb — `lib/extras/bulb.js`

Blinking, light-casting bulbs. Set `blink` on a `standard` spec that also has `emissive` / `emissiveIntensity`. `BulbEffect` hard-toggles the material's `emissiveIntensity` on/off each frame (pairs well with `bloom`) and drives a matching `THREE.PointLight` so the bulb also casts light on nearby meshes, in sync with its glow. Construct with `new BulbEffect({ hz })` — full on/off cycles per second — and call `bulb.update(t)` in your render loop.

```js
{
  type: "standard",
  emissive: 0xffee88,
  emissiveIntensity: 1.2,
  blink: {
    phase: 0,          // 0–1 cycle offset; pair bulbs at 0 and 0.5 to alternate
    power: 8,          // cast-light intensity while on
    distance: 3.5,     // light falloff radius
    offset: [0, 0, 0], // optional nudge of the light off the component origin
  },
}
```

### Sound — `lib/extras/sound.js`

Spatially anchored looping audio via `THREE.PositionalAudio`. Attach the effect's listener to your camera (`camera.add(sound.listener)`), then set `sound` on a spec:

```js
sound: {
  url: "./assets/fountain.wav",
  volume: 1,
  refDistance: 1,
  rolloff: 2,
  distanceModel: "inverse", // "linear" | "inverse" | "exponential"
  maxDistance: 10,
  fade: 8,      // smoothstep volume ramp half-width (world-Y units)
  loop: true,
  autoplay: true,
}
```

`fade` (optional) drives a smooth volume ramp from full at `focusY` to zero at ±`fade`. Playback pauses on tab hide and unlocks on the first user gesture.

### Filters — `lib/extras/filters.js`

Post-processing wrapper around `EffectComposer`:

```js
import { Filters } from "totem/lib/extras/filters.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

const filters = new Filters(renderer, new RenderPass(scene, camera), {
  bloom:    { strength: 0.5, radius: 0.4, threshold: 0.85 },
  fisheye:  { strength: 0.25, zoom: 1.0 },
  edgeBlur: { start: 0.55, strength: 8, power: 2.0 },
  output:   true, // trailing OutputPass (default); set false to skip
});

// replace renderer.render(scene, camera):
filters.render();
// and on resize:
filters.setSize(w, h);
```

The second argument is the composer's first pass — any three.js pass. A single scene just needs `RenderPass`; the demo passes a custom `ColumnsRenderPass` (`lib/extras/columnsPass.js`) to render several columns into one frame. Enabled passes run in the order listed above.

## Demo

The demo in this repo (`index.html` + `demo.js` + `blocks.js` + `assets/`) shows every extra wired end-to-end. Serve it statically:

```bash
npx vite
```

## License

MIT © Lucas Kelly
