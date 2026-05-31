export function attachInteract(
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
  } = {},
) {
  let dragging = false;
  let lastY = 0;
  let lastMoveTime = 0;
  let dragVelocity = 0;
  let momentum = 0;
  let autoScrollSpeed = autoScroll;
  let lastInteractionTime = -Infinity;

  const onWheel = (event) => {
    totem.scroll(event.deltaY / wheelDivisor);
    momentum = 0;
    lastInteractionTime = performance.now();
  };
  const onPointerDown = (event) => {
    dragging = true;
    lastY = event.clientY;
    lastMoveTime = performance.now();
    dragVelocity = 0;
    momentum = 0;
    lastInteractionTime = lastMoveTime;
    element.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragging) return;
    const now = performance.now();
    const dy = event.clientY - lastY;
    const dt = Math.max(1, now - lastMoveTime);
    dragVelocity = 0.7 * dragVelocity + 0.3 * (dy / dt);
    totem.scroll(-dy / dragDivisor);
    lastY = event.clientY;
    lastMoveTime = now;
    lastInteractionTime = now;
  };
  const onPointerUp = () => {
    if (!dragging) return;
    dragging = false;
    if (performance.now() - lastMoveTime < flickWindow) {
      momentum = (-dragVelocity * (1000 / 60)) / dragDivisor;
    }
  };

  element.addEventListener("wheel", onWheel, { passive: true });
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
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.style.touchAction = prevTouchAction;
    },
  };
}
