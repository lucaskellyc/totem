// A lightweight DOM overlay for transient "toast" hints shown over the WebGL
// canvas — e.g. nudging first-time visitors to drag/swipe. Toasts stack
// bottom-centre in `#toast-layer`, fade/slide in, hold, then fade out and
// remove themselves. The layer is pointer-events: none (see index.html) so a
// toast never eats a canvas gesture.

const DEFAULT_DURATION = 3200; // ms a toast holds before it starts fading out

// Wrap a toast layer element with a small imperative API. `layer` is the
// `#toast-layer` container that the toasts are appended into.
export function createToaster(layer) {
  // Show `message` as a toast. `duration` is how long it holds before fading
  // (ms). `id` de-dupes: re-showing the same id refreshes the live toast's
  // timer instead of stacking a duplicate.
  const show = (message, { duration = DEFAULT_DURATION, id } = {}) => {
    if (!layer) return null;

    if (id) {
      const live = layer.querySelector(`[data-toast-id="${CSS.escape(id)}"]`);
      if (live) {
        live._arm?.(duration);
        return live;
      }
    }

    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    if (id) el.dataset.toastId = id;
    layer.appendChild(el);

    // Flush layout before flipping the class so the enter transition runs from
    // the hidden state rather than snapping straight to shown.
    void el.offsetWidth;
    el.classList.add("toast-show");

    const dismiss = () => {
      el.classList.remove("toast-show");
      // Drop it once the exit transition finishes; the timeout is a fallback in
      // case transitionend never fires (e.g. reduced-motion / display change).
      let done = false;
      const remove = () => {
        if (done) return;
        done = true;
        el.remove();
      };
      el.addEventListener("transitionend", remove, { once: true });
      setTimeout(remove, 600);
    };

    let hideTimer;
    const arm = (ms) => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(dismiss, ms);
    };
    el._arm = arm;
    arm(duration);

    return el;
  };

  // Immediately clear every visible toast.
  const clear = () => {
    layer?.replaceChildren();
  };

  return { show, clear };
}
