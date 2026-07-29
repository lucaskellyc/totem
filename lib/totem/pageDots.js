// Pagination dots overlay for collapsed (one-column-at-a-time) mode: a row of
// dots centred along the bottom edge, one per column, with the active column's
// dot highlighted. Purely presentational — the layer is pointer-events: none
// (see index.html) so it never intercepts a canvas gesture.

// Fill `container` with `count` dots and return an imperative API to drive them.
export function createPageDots(container, count) {
  const dots = Array.from({ length: count }, () => {
    const dot = document.createElement("span");
    dot.className = "page-dot";
    container?.appendChild(dot);
    return dot;
  });

  let active = -1;
  // Highlight the dot for column `i` (no-op if unchanged or out of range).
  const setActive = (i) => {
    if (i === active) return;
    dots[active]?.classList.remove("page-dot-active");
    dots[i]?.classList.add("page-dot-active");
    active = i;
  };

  // Fade the whole row in/out — only shown while paging one column at a time.
  const setVisible = (visible) => {
    container?.classList.toggle("visible", visible);
  };

  return { setActive, setVisible };
}
