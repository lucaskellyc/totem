export function attachGestures(
  element,
  totem,
  {
    wheelDivisor = 500,
    dragDivisor = 200,
    momentumDecay = 0.92,
    momentumThreshold = 0.0001,
    flickWindow = 100,
    autoScroll = 0,
    autoScrollResumeDelay = 1500,
    hitTest = () => true,
    // When swiping is enabled, a horizontal-dominant drag is tracked live via
    // onSwipeMove(dx) and resolved on release via onSwipeEnd(dx, velocity),
    // instead of scrolling vertically. dx is px from the drag's start; velocity
    // is px/ms (sign = direction). swipeEnabled() gates it per gesture.
    onSwipeMove = null,
    onSwipeEnd = null,
    swipeEnabled = () => true,
    // Gates only the wheel/trackpad side-swipe path (pointer swipes ignore it),
    // so the trackpad flip can be turned off independently of click-and-drag.
    wheelSwipeEnabled = () => true,
    axisLockSlop = 8,
    // Trackpad side-swipes arrive as horizontal wheel events; when enabled they
    // drive the same onSwipeMove/onSwipeEnd finger-tracking as a pointer drag.
    // deltaX is accumulated (scaled) into a synthetic drag offset; the gesture
    // ends when the wheel goes idle for wheelIdleMs (which waits out momentum).
    wheelTrackScale = 1,
    wheelIdleMs = 120,
  } = {},
) {
  let dragging = false;
  let activePointerId = null;
  let lastY = 0;
  let lastMoveTime = 0;
  let dragVelocity = 0;
  let momentum = 0;
  let autoScrollSpeed = autoScroll;
  let lastInteractionTime = -Infinity;
  // Per-drag axis lock: null until the drag moves past axisLockSlop, then "h"
  // (horizontal swipe) or "v" (vertical scroll) for the rest of the gesture.
  let axis = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  // Trailing-window flick samples ({ t, x }) for the horizontal swipe. Velocity
  // is measured across the last `flickWindow` ms on release rather than via an
  // EMA, so a fast but short flick — which may only fire one or two move events —
  // still reads as fast (an EMA would still be warming up and under-report it,
  // causing the release to snap back instead of paging).
  let swipeSamples = [];
  // Wheel side-swipe state machine: "idle" → "tracking" (following the fingers)
  // → "locked" (a full-column swipe committed; swallow trailing inertia) → idle
  // once the wheel goes quiet. This stops one physical swipe with momentum from
  // paging several columns.
  let wheelPhase = "idle";
  let wheelDX = 0;
  let wheelVelocity = 0;
  let lastWheelTime = 0;
  let wheelIdleTimer = null;

  const endWheelGesture = () => {
    if (wheelPhase === "tracking" && onSwipeEnd) {
      onSwipeEnd(wheelDX, wheelVelocity);
    }
    wheelPhase = "idle";
  };

  const onWheel = (event) => {
    if (!hitTest(event)) return;
    // Horizontal-dominant wheel = trackpad side-swipe. Claim it so the browser
    // can't turn it into back/forward navigation, then track the fingers.
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      // Only claim horizontal wheels — suppressing browser back/forward nav —
      // when side-swiping and the trackpad path are both enabled; otherwise let
      // the browser handle them.
      if (!swipeEnabled() || !wheelSwipeEnabled() || !onSwipeMove) return;
      event.preventDefault();
      const now = performance.now();
      // Any horizontal wheel keeps the gesture alive; it ends on a real idle gap
      // (which also outlasts inertia).
      clearTimeout(wheelIdleTimer);
      wheelIdleTimer = setTimeout(endWheelGesture, wheelIdleMs);

      if (wheelPhase === "locked") return; // committed already; eat the inertia
      if (wheelPhase === "idle") {
        wheelPhase = "tracking";
        wheelDX = 0;
        wheelVelocity = 0;
        lastWheelTime = now;
      }

      // Follow the fingers: accumulate deltaX in the pointer-drag convention (a
      // leftward swipe reads negative), clamped to one column of travel.
      const span = element.clientWidth || 1;
      const step = -event.deltaX * wheelTrackScale;
      const dt = Math.max(1, now - lastWheelTime);
      wheelDX = Math.max(-span, Math.min(span, wheelDX + step));
      wheelVelocity = 0.7 * wheelVelocity + 0.3 * (step / dt);
      lastWheelTime = now;
      lastInteractionTime = now;
      onSwipeMove(wheelDX);

      // Reached a full column → commit now and lock, so trailing inertia can't
      // page again.
      if (Math.abs(wheelDX) >= span) {
        if (onSwipeEnd) onSwipeEnd(wheelDX, wheelVelocity);
        wheelPhase = "locked";
      }
      return;
    }
    totem.scroll(event.deltaY / wheelDivisor);
    momentum = 0;
    lastInteractionTime = performance.now();
  };
  const onPointerDown = (event) => {
    if (activePointerId !== null) return;
    if (!hitTest(event)) return;
    activePointerId = event.pointerId;
    dragging = true;
    axis = null;
    startX = event.clientX;
    startY = event.clientY;
    lastX = event.clientX;
    lastY = event.clientY;
    lastMoveTime = performance.now();
    dragVelocity = 0;
    // Seed the flick baseline at the press point. A fast flick often arrives as a
    // single large pointermove, so most of the travel is between here and that
    // first move; without this baseline the retained samples share ~the same x
    // and the measured velocity collapses to ~0 (reading as "not a flick").
    swipeSamples = [{ t: lastMoveTime, x: event.clientX }];
    momentum = 0;
    lastInteractionTime = lastMoveTime;
    element.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragging || event.pointerId !== activePointerId) return;
    const now = performance.now();

    // Hold off acting until the drag commits to an axis, so a horizontal swipe
    // doesn't also nudge the vertical scroll (and vice versa).
    if (axis === null) {
      const dx = event.clientX - startX;
      const dy0 = event.clientY - startY;
      if (Math.hypot(dx, dy0) < axisLockSlop) {
        lastInteractionTime = now;
        return;
      }
      const wantSwipe = onSwipeMove || onSwipeEnd;
      axis =
        wantSwipe && swipeEnabled() && Math.abs(dx) > Math.abs(dy0) ? "h" : "v";
      // rebase both axes so the first step isn't the whole slop
      lastX = event.clientX;
      lastY = event.clientY;
      lastMoveTime = now;
    }

    // Horizontal swipe: track the finger live; resolve (snap) on release.
    if (axis === "h") {
      swipeSamples.push({ t: now, x: event.clientX });
      // Keep only the trailing window (but always retain a baseline sample).
      while (swipeSamples.length > 2 && now - swipeSamples[0].t > flickWindow) {
        swipeSamples.shift();
      }
      lastX = event.clientX;
      lastMoveTime = now;
      lastInteractionTime = now;
      if (onSwipeMove) onSwipeMove(event.clientX - startX);
      return;
    }

    const dy = event.clientY - lastY;
    const dt = Math.max(1, now - lastMoveTime);
    dragVelocity = 0.7 * dragVelocity + 0.3 * (dy / dt);
    totem.scroll(-dy / dragDivisor);
    lastY = event.clientY;
    lastMoveTime = now;
    lastInteractionTime = now;
  };
  const onPointerUp = (event) => {
    if (event.pointerId !== activePointerId) return;
    if (!dragging) return;
    dragging = false;
    activePointerId = null;
    if (axis === "h") {
      const dx = event.clientX - startX;
      axis = null;
      const now = performance.now();
      swipeSamples.push({ t: now, x: event.clientX });
      // Flick velocity = displacement over the trailing flickWindow ms. Ignoring
      // stale samples means a finger that paused before lifting reads as slow.
      const recent = swipeSamples.filter((s) => now - s.t <= flickWindow);
      let velocity = 0;
      if (recent.length >= 2) {
        const first = recent[0];
        const last = recent[recent.length - 1];
        const span = last.t - first.t;
        if (span > 0) velocity = (last.x - first.x) / span;
      }
      swipeSamples = [];
      if (onSwipeEnd) onSwipeEnd(dx, velocity);
      return;
    }
    // Fallback for short/fast flicks that ended before the drag committed to the
    // horizontal axis — a quick flick can fire too few (or a noisy, diagonal)
    // move event to lock "h", so the swipe above never runs. If the overall
    // press→release is horizontal-dominant and past the slop, resolve it as a
    // swipe here (velocity measured from the press point) and let the consumer's
    // onSwipeEnd decide whether it's far/fast enough to page.
    const dxTotal = event.clientX - startX;
    const dyTotal = event.clientY - startY;
    if (
      (onSwipeMove || onSwipeEnd) &&
      swipeEnabled() &&
      Math.abs(dxTotal) > axisLockSlop &&
      Math.abs(dxTotal) > Math.abs(dyTotal)
    ) {
      axis = null;
      const now = performance.now();
      const span = now - swipeSamples[0].t;
      const velocity = span > 0 ? dxTotal / span : 0;
      swipeSamples = [];
      // Seed the drag offset so the distance test in onSwipeEnd has a value.
      if (onSwipeMove) onSwipeMove(dxTotal);
      if (onSwipeEnd) onSwipeEnd(dxTotal, velocity);
      return;
    }
    axis = null;
    if (performance.now() - lastMoveTime < flickWindow) {
      momentum = (-dragVelocity * (1000 / 60)) / dragDivisor;
    }
  };

  element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerUp);
  const prevTouchAction = element.style.touchAction;
  element.style.touchAction = "none";

  return {
    update() {
      if (dragging) {
        lastInteractionTime = performance.now();
        return;
      }
      if (Math.abs(momentum) > momentumThreshold) {
        totem.scroll(momentum);
        momentum *= momentumDecay;
        lastInteractionTime = performance.now();
        return;
      }
      momentum = 0;
      if (
        autoScrollSpeed !== 0 &&
        performance.now() - lastInteractionTime >= autoScrollResumeDelay
      ) {
        totem.scroll(autoScrollSpeed);
      }
    },
    setAutoScroll(speed) {
      autoScrollSpeed = speed;
    },
    detach() {
      clearTimeout(wheelIdleTimer);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.style.touchAction = prevTouchAction;
    },
  };
}
