# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.1-alpha] - 2026-07-29

### Added
- `lib/totem/env.js` — shared `isMobile` (coarse-pointer) check, so the mobile graphics defaults are decided in one place instead of being re-detected per module.
- `lib/totem/loaders.js` — texture-size cap on touch devices: any map whose longest edge exceeds 1024 px is downscaled before it reaches the GPU, keeping iOS Safari under its per-tab texture-memory budget (fixes the silent tab reloads). Desktop still uploads at native size.
- `lib/extras/video.js` — optional `enabled` gate (`() => boolean`) on `VideoEffect`; while it returns false every video is paused so it releases its hardware decoder (iOS exposes only a few). Videos also default to `preload: "metadata"` with no autoplay, so each buffers/decodes only once it plays in focus rather than all at once on load.
- Demo: `lib/totem/pageDots.js` — pagination dots shown while paging one column at a time (collapsed mode).
- Demo: `lib/totem/toasts.js` — transient hint toasts over the canvas, with a first-load nudge toward the gesture that fits the current layout.
- Info page: an at-a-glance features grid, copy-to-clipboard install/usage snippets, a footer (version + license), Open Graph / Twitter unfurl metadata, and an SVG favicon (shared with the demo).

### Changed
- `lib/totem/lights.js` — point-light shadow maps drop to 512 px on mobile (from 1024 px), quartering per-light shadow cost; desktop is unchanged.
- Demo: lower renderer pixel ratio on touch devices (1.25 vs 1.5), and off-screen columns skip their per-frame CPU work — only their video gate keeps ticking so a column that just left the screen releases its decoder.
- Info page: the Lottie wordmark is replaced with a frosted-glass logo composited over the hero video, the hero swaps to a new Mux asset, and the `lottie-web` dependency is dropped from the page.

### Fixed
- Demo: removed dead TSL imports that broke the raw importmap-served demo, and guarded `import.meta.env` access so the modules run when served raw in production.

## [0.3.0-alpha] - 2026-07-28

### Added
- `lib/extras/bulb.js` — `BulbEffect` class. Opt in via `blink` on a `standard` spec with `emissive`/`emissiveIntensity`; hard-toggles the material's `emissiveIntensity` each frame and drives a synced `THREE.PointLight` so the bulb casts light as it glows. Construct with `new BulbEffect({ hz })`. (Reintroduces blink behavior removed in 0.2.0, now as an opt-in extra that also casts light.)
- `lib/extras/spin.js` — `SpinEffect` class. Opt in via `spin` (`axis`, `speed`) on any block or component spec; rotates the mesh about its own origin each frame, composing on top of any static `rotation` and after layout is measured.
- Demo: multiple side-by-side columns that share one frame and collapse to a single center column on narrow viewports, with horizontal paging between columns.
- Demo: named block exports and per-column block lists.
- Demo: new blocks and components with assets — sideshow, construction, corporate, sewer, and neon-sign meshes, plus additional TV screens.
- `dev` / `build` / `preview` npm scripts (Vite) and a `.gitignore` entry for `dist/`.

### Changed
- `lib/totem/gestures.js` — collapsed-mode flick paging reworked so short/fast and back-to-back flicks page reliably instead of snapping back: flick velocity is measured over a trailing window, a baseline sample is seeded at `pointerdown`, and a horizontal-dominant press→release resolves as a swipe even when the axis never locks.
- `lib/totem/totem.js`, `lib/totem/lights.js` — scroll-based emissive/light fade refinements supporting the new bulbs and neon signs.
- `lib/extras/video.js`, `lib/extras/water.js` — minor effect fixes.
- Demo: center column scrolls opposite its neighbours, horizontal FOV is held constant to stop side cropping, TV block configuration refactored, and the loading bar eases its fill instead of snapping.

### Removed
- Unused demo assets `assets/godrays.mp4` and `assets/tv_color_a.jpg`.

## [0.2.0-alpha] - 2026-07-01

### Added
- `spec.object` on blocks and components — accepts a `THREE.Object3D` or a factory returning one, as an alternative to `spec.url` (GLB). Lets you inline any three.js primitive or custom mesh with no per-type registration.
- `lib/extras/water.js` — `WaterEffect` class. Opt in via `type: "water"` on a spec; the effect swaps in a shader-modified `MeshStandardMaterial` with animated flow noise.
- `lib/extras/video.js` — `VideoEffect` class. Opt in via `spec.video` (URL string or `{ url, loop, muted, playbackRate, autoplay, ... }`). Playback pauses when the block leaves focus range or the tab is hidden.
- `lib/extras/sound.js` — `SoundEffect` class with spatially anchored `THREE.PositionalAudio`. Opt in via `spec.sound` (URL string or object with `volume`, `refDistance`, `rolloff`, `distanceModel`, `maxDistance`, `loop`, `autoplay`, `position`, `fade`). `fade` enables a smoothstep volume ramp based on world-Y distance to `focusY`.
- `lib/extras/filters.js` — `Filters` class wrapping `EffectComposer`. Configurable passes: `bloom` (UnrealBloomPass), `fisheye` (barrel warp with `strength`/`zoom`), `edgeBlur` (radial multi-tap ramp with `start`/`strength`/`power`), plus final `OutputPass`.
- `lib/totem/gestures.js` — wheel + pointer-drag gestures with autoscroll/resume, now a first-class base module (moved from extras).
- `lib/totem/lights.js` — attaches `PointLight` records to a block group; per-light `castShadow`, `distance`, `power`, plus focus-based intensity fade owned by the `Totem` base class.

### Changed
- Repository layout: `lib/` split into `lib/totem/` (base `Totem` class, mesh + static texture loaders, materials, shadows, gestures, lights) and `lib/extras/` (opt-in effect classes).
- `Totem` is now a `THREE.Group` subclass — add it directly to your scene.
- `Totem` exposes `_decorateBlock({ spec, group, root, components, componentRoots, blockMaps, componentMaps })` and `_updateExtras(t)` hooks so effects can be composed at the demo level without subclassing.
- Shadow map defaults tuned for perf (mapSize `512`, `PCFShadowMap`, `castShadow` gated by focus-based intensity).

### Removed
- `lib/totem/primitives.js` — bulb meshes and plane primitive support removed.
- Light behaviors (`pulse` / `blink` / `flicker`) removed.
- `spec.planes` field removed; use `spec.components` with `object` for inline planes.
- `lib/extras/effects.js` composite subclass removed; wire individual effects at the demo level.
- `lib/totem/mount.js` helper removed; inline the `WebGLRenderer` / `Scene` / animate loop in your demo.

## [0.1.0-alpha] - 2026-05-30
### Added
- Initial release.
