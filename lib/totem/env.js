// Coarse-pointer devices (phones/tablets) get lighter graphics defaults —
// lower pixel ratio, smaller shadow maps, texture-size capping, video decode
// gating — because iOS Safari especially has a tight per-tab GPU memory and
// fill-rate budget and will silently reload the tab when it's exceeded.
// Evaluated once at load; the pointer type doesn't change over a session.
export const isMobile =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)")?.matches ?? false);
