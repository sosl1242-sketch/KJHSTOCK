import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachSheetDragScroll } from "../client/src/lib/sheetDragScroll";

class FakeWindow extends EventTarget {
  getSelection = () => null;
}

class FakeSheet extends EventTarget {
  view = new FakeWindow();
  ownerDocument = { defaultView: this.view };
  dataset: Record<string, string> = {};
  clientLeft = 2;
  clientTop = 2;
  clientWidth = 300;
  clientHeight = 180;
  scrollWidth = 1000;
  scrollHeight = 600;
  scrollLeft = 120;
  scrollTop = 80;
  captures = new Set<number>();
  closest = () => null;
  contains = () => false;
  getBoundingClientRect = () => ({ left: 10, top: 20 });
  setPointerCapture = vi.fn((id: number) => {
    this.captures.add(id);
  });
  hasPointerCapture = vi.fn((id: number) => this.captures.has(id));
  releasePointerCapture = vi.fn((id: number) => {
    this.captures.delete(id);
  });
}

const cleanups: Array<() => void> = [];

function setup() {
  const sheet = new FakeSheet();
  const cleanup = attachSheetDragScroll(sheet as unknown as HTMLElement);
  cleanups.push(cleanup);
  return { sheet, view: sheet.view, cleanup };
}

function emit(
  target: EventTarget,
  type: string,
  overrides: Record<string, unknown> = {}
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const values = {
    pointerId: 7,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: 100,
    clientY: 100,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    detail: 1,
    ...overrides,
  };
  for (const [key, value] of Object.entries(values))
    Object.defineProperty(event, key, { value, configurable: true });
  target.dispatchEvent(event);
  return event;
}

function startDrag(sheet: FakeSheet) {
  emit(sheet, "pointerdown");
  emit(sheet.view, "pointermove", { clientX: 70, clientY: 60 });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.useRealTimers();
});

describe("sheet mouse drag scrolling", () => {
  it("preserves button clicks and native behavior below the movement threshold", () => {
    const { sheet, view } = setup();
    const clicked = vi.fn();
    sheet.addEventListener("click", clicked);
    const button = { closest: () => null };
    const down = emit(sheet, "pointerdown", { target: button });
    const move = emit(view, "pointermove", { clientX: 105 });
    emit(view, "pointerup", { clientX: 105, buttons: 0 });
    const click = emit(sheet, "click", { target: button });
    expect(down.defaultPrevented).toBe(false);
    expect(move.defaultPrevented).toBe(false);
    expect(click.defaultPrevented).toBe(false);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(sheet.setPointerCapture).not.toHaveBeenCalled();
    expect([sheet.scrollLeft, sheet.scrollTop]).toEqual([120, 80]);
    expect(sheet.dataset.dragging).toBeUndefined();
  });

  it("uses a six-pixel distance threshold, then pans both axes and captures once", () => {
    const { sheet, view } = setup();
    emit(sheet, "pointerdown");
    expect(sheet.setPointerCapture).not.toHaveBeenCalled();
    emit(view, "pointermove", { clientX: 104, clientY: 104 });
    expect(sheet.dataset.dragging).toBeUndefined();
    const move = emit(view, "pointermove", { clientX: 106 });
    expect(move.defaultPrevented).toBe(true);
    expect(sheet.dataset.dragging).toBe("true");
    expect(sheet.setPointerCapture).toHaveBeenCalledWith(7);
    emit(view, "pointermove", { clientX: 70, clientY: 60 });
    expect([sheet.scrollLeft, sheet.scrollTop]).toEqual([150, 120]);
    expect(sheet.setPointerCapture).toHaveBeenCalledTimes(1);
    emit(view, "pointerup", { buttons: 0 });
    expect(sheet.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(sheet.dataset.dragging).toBeUndefined();
  });

  it("clamps both scroll axes to the available content", () => {
    const { sheet, view } = setup();
    emit(sheet, "pointerdown");
    emit(view, "pointermove", { clientX: 5000, clientY: 5000 });
    expect([sheet.scrollLeft, sheet.scrollTop]).toEqual([0, 0]);
    emit(view, "pointermove", { clientX: -5000, clientY: -5000 });
    expect([sheet.scrollLeft, sheet.scrollTop]).toEqual([700, 420]);
  });

  it("blocks the post-drag click in capture before row or button handlers run", () => {
    const sheet = new FakeSheet();
    const add = vi.spyOn(sheet, "addEventListener");
    cleanups.push(attachSheetDragScroll(sheet as unknown as HTMLElement));
    expect(
      add.mock.calls.some(
        ([type, , options]) => type === "click" && options === true
      )
    ).toBe(true);
    const clicked = vi.fn();
    sheet.addEventListener("click", clicked);
    startDrag(sheet);
    emit(sheet.view, "pointerup", { buttons: 0 });
    const click = emit(sheet, "click");
    expect(click.defaultPrevented).toBe(true);
    expect(clicked).not.toHaveBeenCalled();
  });

  it("preserves keyboard clicks and the next physical click after a drag", () => {
    const { sheet, view } = setup();
    const clicked = vi.fn();
    sheet.addEventListener("click", clicked);
    startDrag(sheet);
    emit(view, "pointerup", { buttons: 0 });
    expect(emit(sheet, "click", { detail: 0 }).defaultPrevented).toBe(false);
    expect(clicked).toHaveBeenCalledTimes(1);
    emit(sheet, "pointerdown");
    emit(view, "pointerup", { buttons: 0 });
    expect(emit(sheet, "click").defaultPrevented).toBe(false);
    expect(clicked).toHaveBeenCalledTimes(2);
  });

  it("expires unused click suppression instead of blocking an unrelated later click", () => {
    const { sheet, view } = setup();
    startDrag(sheet);
    emit(view, "pointerup", { buttons: 0 });
    vi.advanceTimersByTime(350);
    expect(emit(sheet, "click").defaultPrevented).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { pointerType: "touch" },
    { pointerType: "pen" },
    { isPrimary: false },
    { button: 2 },
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
  ])("leaves non-primary mouse and modifier gestures native: %j", options => {
    const { sheet, view } = setup();
    emit(sheet, "pointerdown", options);
    const move = emit(view, "pointermove", { ...options, clientX: 70 });
    expect(move.defaultPrevented).toBe(false);
    expect(emit(sheet, "dragstart").defaultPrevented).toBe(false);
    expect(sheet.setPointerCapture).not.toHaveBeenCalled();
    expect(sheet.scrollLeft).toBe(120);
  });

  it.each(["input", "textarea", "select", "contenteditable"])(
    "does not start on %s or its descendants",
    kind => {
      const { sheet, view } = setup();
      const editable = { getAttribute: () => "true" };
      const target = {
        closest: (selector: string) =>
          selector ===
          (kind === "contenteditable"
            ? "[contenteditable]"
            : "input, textarea, select")
            ? editable
            : null,
      };
      emit(sheet, "pointerdown", { target });
      emit(view, "pointermove", { clientX: 70 });
      expect(sheet.dataset.dragging).toBeUndefined();
      expect(sheet.setPointerCapture).not.toHaveBeenCalled();
      expect(emit(sheet, "click").defaultPrevented).toBe(false);
    }
  );

  it.each([
    { clientX: 315 },
    { clientY: 205 },
    { clientX: 11 },
    { clientY: 21 },
    { clientX: -10 },
  ])(
    "does not steal native scrollbar, border, or outside gestures: %j",
    point => {
      const { sheet, view } = setup();
      emit(sheet, "pointerdown", point);
      emit(view, "pointermove", { clientX: 70, clientY: 60 });
      expect(sheet.setPointerCapture).not.toHaveBeenCalled();
      expect([sheet.scrollLeft, sheet.scrollTop]).toEqual([120, 80]);
    }
  );

  it("leaves a sheet without scrollable overflow native", () => {
    const { sheet, view } = setup();
    sheet.scrollWidth = sheet.clientWidth;
    sheet.scrollHeight = sheet.clientHeight;
    emit(sheet, "pointerdown");
    expect(emit(view, "pointermove", { clientX: 70 }).defaultPrevented).toBe(
      false
    );
    expect(sheet.setPointerCapture).not.toHaveBeenCalled();
  });

  it("clears an uncaptured gesture released outside the sheet before the threshold", () => {
    const { sheet, view } = setup();
    emit(sheet, "pointerdown");
    emit(view, "pointerup", { clientX: 500, buttons: 0 });
    emit(view, "pointermove", { clientX: 70 });
    expect(sheet.setPointerCapture).not.toHaveBeenCalled();
    expect(sheet.scrollLeft).toBe(120);
    expect(emit(sheet, "click").defaultPrevented).toBe(false);
  });

  it.each(["pointercancel", "lostpointercapture", "blur", "released-buttons"])(
    "ends dragging and allows a fresh gesture after %s",
    reason => {
      const { sheet, view } = setup();
      startDrag(sheet);
      if (reason === "lostpointercapture") {
        sheet.captures.clear();
        emit(sheet, reason);
      } else if (reason === "released-buttons") {
        emit(view, "pointermove", { buttons: 0 });
      } else emit(view, reason);
      expect(sheet.dataset.dragging).toBeUndefined();
      expect(sheet.captures.size).toBe(0);
      const previous = sheet.scrollLeft;
      emit(view, "pointermove", { clientX: 20 });
      expect(sheet.scrollLeft).toBe(previous);
      emit(sheet, "pointerdown");
      emit(view, "pointermove", { clientX: 90 });
      expect(sheet.scrollLeft).toBe(previous + 10);
    }
  );

  it("ignores unrelated pointer IDs and aborts pending selection when a modifier is pressed", () => {
    const { sheet, view } = setup();
    emit(sheet, "pointerdown");
    emit(view, "pointermove", { pointerId: 99, clientX: 20 });
    emit(view, "pointerup", { pointerId: 99 });
    expect(sheet.dataset.dragging).toBeUndefined();
    emit(view, "pointermove", { shiftKey: true, clientX: 20 });
    emit(view, "pointermove", { clientX: 20 });
    expect(sheet.setPointerCapture).not.toHaveBeenCalled();
    expect(sheet.scrollLeft).toBe(120);
  });

  it("continues and cleans up safely when pointer capture APIs throw", () => {
    const { sheet, view } = setup();
    sheet.setPointerCapture.mockImplementation(() => {
      throw new DOMException("Pointer missing");
    });
    sheet.hasPointerCapture.mockImplementation(() => {
      throw new DOMException("Detached");
    });
    startDrag(sheet);
    expect(sheet.scrollLeft).toBe(150);
    emit(view, "pointerup", { buttons: 0 });
    expect(sheet.dataset.dragging).toBeUndefined();
    expect(emit(sheet, "click").defaultPrevented).toBe(true);
  });

  it("prevents native link/image drag only for an eligible mouse gesture", () => {
    const { sheet, view } = setup();
    expect(emit(sheet, "dragstart").defaultPrevented).toBe(false);
    emit(sheet, "pointerdown");
    expect(emit(sheet, "dragstart").defaultPrevented).toBe(true);
    emit(view, "pointerup", { buttons: 0 });
    expect(emit(sheet, "dragstart").defaultPrevented).toBe(false);
  });

  it("removes all behavior, pointer capture, dragging state, and timers on cleanup", () => {
    const { sheet, view, cleanup } = setup();
    startDrag(sheet);
    cleanup();
    cleanup();
    expect(sheet.captures.size).toBe(0);
    expect(sheet.dataset.dragging).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    const left = sheet.scrollLeft;
    emit(sheet, "pointerdown");
    emit(view, "pointermove", { clientX: 20 });
    emit(view, "pointerup", { buttons: 0 });
    expect(sheet.scrollLeft).toBe(left);
    expect(emit(sheet, "click").defaultPrevented).toBe(false);
    expect(emit(sheet, "dragstart").defaultPrevented).toBe(false);
  });
});
