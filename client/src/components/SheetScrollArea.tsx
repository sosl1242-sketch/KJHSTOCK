import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type PropsWithChildren } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { attachSheetDragScroll } from "@/lib/sheetDragScroll";

/** One scroll owner keeps drag, keyboard, touch and the upper range in sync. */
export const SheetScrollArea = forwardRef<HTMLDivElement, PropsWithChildren>(function SheetScrollArea({ children }, forwardedRef) {
  const area = useRef<HTMLDivElement>(null);
  const id = useId();
  const [position, setPosition] = useState({ left: 0, max: 0 });
  useImperativeHandle(forwardedRef, () => area.current!, []);

  useEffect(() => {
    const element = area.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = Math.max(0, element.scrollWidth - element.clientWidth);
      const left = Math.max(0, Math.min(max, element.scrollLeft));
      setPosition(previous => previous.left === left && previous.max === max ? previous : { left, max });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    const table = element.querySelector("table");
    if (table) resize.observe(table);
    element.addEventListener("scroll", schedule, { passive: true });
    const detachDrag = attachSheetDragScroll(element);
    update();
    return () => {
      detachDrag();
      resize.disconnect();
      element.removeEventListener("scroll", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);

  const move = (direction: number) => {
    const element = area.current;
    if (element) element.scrollLeft += direction * element.clientWidth * 0.8;
  };
  const atLeft = position.left < 1;
  const atRight = position.max - position.left < 1;
  return <>
    <div className="sheet-pan-controls" role="group" aria-label="표 가로 이동">
      <label htmlFor={`${id}-range`}>좌우 이동</label>
      <button type="button" aria-label="표 왼쪽으로 이동" aria-controls={id} disabled={atLeft} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
      <input id={`${id}-range`} type="range" min={0} max={Math.max(1, position.max)} step={1}
        value={position.left} disabled={position.max < 1} aria-label="표 좌우 이동" aria-controls={id}
        aria-valuetext={position.max < 1 ? "전체 열 표시 중" : atLeft ? "왼쪽 끝" : atRight ? "오른쪽 끝" : `${Math.round(position.left / position.max * 100)}% 이동`}
        onChange={event => { if (area.current) area.current.scrollLeft = Number(event.target.value); }} />
      <button type="button" aria-label="표 오른쪽으로 이동" aria-controls={id} disabled={atRight} onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
    </div>
    <div id={id} className="sheet-scroll" ref={area} data-drag-scroll="true" tabIndex={0} role="region"
      aria-label="좌우로 스크롤 가능한 선물 표" aria-describedby="sheet-instructions">{children}</div>
  </>;
});
