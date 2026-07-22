import { Pass } from "three/addons/postprocessing/Pass.js";

// Renders each column's scene/camera into its own horizontal band of the shared
// frame, so a single downstream post chain (fisheye/edge-blur/bloom) warps the
// combined image. Mirrors RenderPass: writes into readBuffer, never swaps.
// Reads column.rect/scene/camera live each frame, so a resize only mutates rect.
export class ColumnsRenderPass extends Pass {
  constructor(columns) {
    super();
    this.columns = columns;
    this.needsSwap = false;
  }

  render(renderer, writeBuffer, readBuffer) {
    const target = this.renderToScreen ? null : readBuffer;
    const prevAutoClear = renderer.autoClear;
    // Render-target viewport/scissor are taken from the target's own properties
    // (renderer.setViewport is ignored for render targets), so bands are in
    // device pixels. On screen (target === null) fall back to renderer.setX.
    const pr = renderer.getPixelRatio();

    renderer.setRenderTarget(target);

    // Clear the whole frame once, then draw each column with auto-clear off so
    // columns don't wipe one another (per-render clear can't be scissored here
    // because shadow-map rendering resets scissor state before the clear).
    if (target) target.scissorTest = false;
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.autoClear = false;

    for (const col of this.columns) {
      const r = col.rect;
      if (target) {
        const x = Math.round(r.x * pr);
        const y = Math.round(r.y * pr);
        const w = Math.round(r.w * pr);
        const h = Math.round(r.h * pr);
        target.viewport.set(x, y, w, h);
        target.scissor.set(x, y, w, h);
        target.scissorTest = true;
        renderer.setRenderTarget(target); // applies the target's viewport/scissor
      } else {
        renderer.setViewport(r.x, r.y, r.w, r.h);
        renderer.setScissor(r.x, r.y, r.w, r.h);
        renderer.setScissorTest(true);
      }
      renderer.render(col.scene, col.camera);
    }

    // Restore full-frame viewport/scissor so later composer passes cover the
    // whole buffer, and restore auto-clear.
    if (target) {
      target.viewport.set(0, 0, target.width, target.height);
      target.scissor.set(0, 0, target.width, target.height);
      target.scissorTest = false;
      renderer.setRenderTarget(target);
    }
    renderer.setScissorTest(false);
    renderer.autoClear = prevAutoClear;
  }
}
