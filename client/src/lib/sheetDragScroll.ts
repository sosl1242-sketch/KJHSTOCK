const DRAG_THRESHOLD_PX = 6;
const CLICK_SUPPRESSION_MS = 350;

type Gesture = {
  pointerId: number;
  x: number;
  y: number;
  left: number;
  top: number;
  dragging: boolean;
};

function hasModifier(event: PointerEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function isEditable(target: EventTarget | null): boolean {
  const node = target as Element | null;
  if (typeof node?.closest !== "function") return false;
  if (node.closest("input, textarea, select")) return true;
  const editable = node.closest("[contenteditable]");
  return (
    editable !== null &&
    editable.getAttribute("contenteditable")?.toLowerCase() !== "false"
  );
}

/** Mouse panning only; native touch, pen, text editing, and ordinary clicks remain available. */
export function attachSheetDragScroll(element: HTMLElement): () => void {
  const view = element.ownerDocument.defaultView;
  if (!view) return () => {};

  let gesture: Gesture | null = null;
  let suppressClick = false;
  let suppressionTimer: ReturnType<typeof setTimeout> | null = null;

  const clearClickSuppression = () => {
    suppressClick = false;
    if (suppressionTimer !== null) clearTimeout(suppressionTimer);
    suppressionTimer = null;
  };

  const finish = (blockDragClick = true) => {
    const previous = gesture;
    gesture = null;
    delete element.dataset.dragging;
    if (!previous) return;
    if (previous.dragging && blockDragClick) {
      clearClickSuppression();
      suppressClick = true;
      suppressionTimer = setTimeout(
        clearClickSuppression,
        CLICK_SUPPRESSION_MS
      );
    }
    try {
      if (element.hasPointerCapture(previous.pointerId))
        element.releasePointerCapture(previous.pointerId);
    } catch {
      // A detached element or an already-released pointer can reject capture APIs.
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    // A new physical gesture must never inherit suppression from an earlier drag.
    clearClickSuppression();
    if (
      gesture ||
      event.pointerType !== "mouse" ||
      !event.isPrimary ||
      event.button !== 0 ||
      hasModifier(event) ||
      isEditable(event.target)
    )
      return;

    const bounds = element.getBoundingClientRect();
    const x = event.clientX - bounds.left - element.clientLeft;
    const y = event.clientY - bounds.top - element.clientTop;
    // Borders and native scrollbars are outside the element's client area.
    if (x < 0 || y < 0 || x >= element.clientWidth || y >= element.clientHeight)
      return;
    if (
      element.scrollWidth <= element.clientWidth &&
      element.scrollHeight <= element.clientHeight
    )
      return;

    gesture = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: element.scrollLeft,
      top: element.scrollTop,
      dragging: false,
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    const current = gesture;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!(event.buttons & 1) || (!current.dragging && hasModifier(event))) {
      finish();
      return;
    }
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.dragging) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      current.dragging = true;
      element.dataset.dragging = "true";
      try {
        element.setPointerCapture(current.pointerId);
      } catch {
        // Window listeners still finish the gesture if pointer capture is unavailable.
      }
      const selection = view.getSelection();
      if (selection?.anchorNode && element.contains(selection.anchorNode))
        selection.removeAllRanges();
    }
    event.preventDefault();
    element.scrollLeft = Math.max(
      0,
      Math.min(element.scrollWidth - element.clientWidth, current.left - dx)
    );
    element.scrollTop = Math.max(
      0,
      Math.min(element.scrollHeight - element.clientHeight, current.top - dy)
    );
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (gesture?.pointerId === event.pointerId) finish();
  };

  const onBlur = () => finish();

  const onClick = (event: MouseEvent) => {
    // Keyboard activation and element.click() have detail 0 and must remain usable.
    if (!suppressClick || event.detail === 0) return;
    clearClickSuppression();
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onDragStart = (event: DragEvent) => {
    if (gesture) event.preventDefault();
  };

  element.addEventListener("pointerdown", onPointerDown);
  // Before capture starts, the mouse can leave the sheet and be released elsewhere.
  view.addEventListener("pointermove", onPointerMove, {
    capture: true,
    passive: false,
  });
  view.addEventListener("pointerup", onPointerEnd, true);
  view.addEventListener("pointercancel", onPointerEnd, true);
  element.addEventListener("lostpointercapture", onPointerEnd);
  view.addEventListener("blur", onBlur);
  element.addEventListener("click", onClick, true);
  element.addEventListener("dragstart", onDragStart);

  return () => {
    finish(false);
    clearClickSuppression();
    element.removeEventListener("pointerdown", onPointerDown);
    view.removeEventListener("pointermove", onPointerMove, true);
    view.removeEventListener("pointerup", onPointerEnd, true);
    view.removeEventListener("pointercancel", onPointerEnd, true);
    element.removeEventListener("lostpointercapture", onPointerEnd);
    view.removeEventListener("blur", onBlur);
    element.removeEventListener("click", onClick, true);
    element.removeEventListener("dragstart", onDragStart);
  };
}
