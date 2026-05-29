# totem

Infinite vertical scroll primitive for [three.js](https://threejs.org/). Stack 3D blocks, scroll the wheel, and they loop forever.

**[Live demo →](https://lucaskellyc.github.io/totem/)**

## Use it in your own project

```bash
npm i three
npm i github:<user>/totem
```

```js
import * as THREE from "three";
import { Stack } from "totem";

const scene = new THREE.Scene();
const stack = new Stack();
scene.add(stack);

await stack.loadBlocks([
  {
    url: "/models/block_a.glb",
    texture: "/textures/block_a.jpg",
    lights: [{ position: [0, -2, 2], color: 0xffffff }],
  },
  {
    url: "/models/block_b.glb",
    texture: "/textures/block_b.jpg",
  },
]);

// in your render loop:
stack.update();

// hook up scrolling:
window.addEventListener("wheel", (e) => stack.scroll(e.deltaY / 500));
```

## Block spec

| field            | type     | notes                                                              |
| ---------------- | -------- | ------------------------------------------------------------------ |
| `url`            | string   | GLB to load as the block body                                      |
| `texture`        | string   | sRGB color map                                                     |
| `normalMap`      | string   | linear normal map                                                  |
| `roughnessMap`   | string   | linear roughness map                                               |
| `type`           | string   | `"standard"` (default, lit PBR) or `"unlit"`                       |
| `color`          | hex      | base color when no texture                                          |
| `roughness`      | number   | 0–1                                                                |
| `metalness`      | number   | 0–1                                                                |
| `receiveShadow`  | boolean  |                                                                    |
| `castShadow`     | boolean  |                                                                    |
| `lights`         | array    | see [Lights](#lights)                                              |
| `components`     | array    | child GLBs or primitives (`shape: "sphere"`/`"disc"`/`"plane"`)    |
| `planes`         | array    | simple colored plane decorations                                   |

### Lights

```js
{
  position: [x, y, z],
  color: 0xffffff,
  power: 15,             // intensity at zero distance
  distance: 3.5,
  castShadow: false,
  shape: "sphere",       // optional: also render a bulb mesh
  radius: 0.16,
  emissive: 0xffffff,
  emissiveIntensity: 5,
  behavior: { type: "pulse", rate: 1.5, min: 0, max: 1 },  // or "blink" / "flicker"
}
```

Lights fade with distance from `stack.lightFocusY` (default `-5`), controlled by `stack.lightFalloff`. The same idea applies to unlit meshes via `stack.unlitFocusY` / `stack.unlitFalloff`.

## Demo

The demo in this repo (`index.html` + `demo.js` + `blocks.js` + `assets/`) is built with no bundler — just open `index.html` through any static server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Three.js is loaded from [esm.sh](https://esm.sh) via an importmap, so there's nothing to install.

## Deploying the demo to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Source: **Deploy from a branch**, Branch: **main**, folder: **/ (root)**.
3. Visit `https://<user>.github.io/<repo>/`.

## License

MIT © Lucas Kelly
