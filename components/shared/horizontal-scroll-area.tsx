"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

type Props = {
  hint: string;
  children: ReactNode;
  className?: string;
};

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function HorizontalScrollArea({ hint, children, className }: Props) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const main = mainScrollRef.current;
    const top = topScrollRef.current;
    const spacer = spacerRef.current;
    if (!main || !top || !spacer) return;

    const syncSpacerWidth = () => {
      spacer.style.width = `${main.scrollWidth}px`;
    };

    syncSpacerWidth();

    const resizeObserver = new ResizeObserver(syncSpacerWidth);
    resizeObserver.observe(main);
    const firstChild = main.firstElementChild;
    if (firstChild instanceof HTMLElement) {
      resizeObserver.observe(firstChild);
    }

    let syncingFromTop = false;
    let syncingFromMain = false;

    const handleTopScroll = () => {
      if (syncingFromMain) return;
      syncingFromTop = true;
      main.scrollLeft = top.scrollLeft;
      syncingFromTop = false;
    };

    const handleMainScroll = () => {
      if (syncingFromTop) return;
      syncingFromMain = true;
      top.scrollLeft = main.scrollLeft;
      syncingFromMain = false;
    };

    top.addEventListener("scroll", handleTopScroll);
    main.addEventListener("scroll", handleMainScroll);

    return () => {
      resizeObserver.disconnect();
      top.removeEventListener("scroll", handleTopScroll);
      main.removeEventListener("scroll", handleMainScroll);
    };
  }, []);

  useEffect(() => {
    function endDrag() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setIsDragging(false);
      if (dragMovedRef.current) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    }

    function handleMouseMove(event: MouseEvent) {
      const main = mainScrollRef.current;
      if (!draggingRef.current || !main) return;
      const delta = event.clientX - dragStartXRef.current;
      if (Math.abs(delta) > 4) {
        dragMovedRef.current = true;
      }
      main.scrollLeft = dragStartScrollLeftRef.current - delta;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("mouseleave", endDrag);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("mouseleave", endDrag);
    };
  }, []);

  function handleMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("a, button, input, select, textarea, label")) {
      return;
    }

    const main = mainScrollRef.current;
    if (!main) return;

    draggingRef.current = true;
    dragMovedRef.current = false;
    dragStartXRef.current = event.clientX;
    dragStartScrollLeftRef.current = main.scrollLeft;
    setIsDragging(true);
  }

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div className={joinClassNames("horizontal-scroll-area", className)}>
      <div className="horizontal-scroll-header">
        <div className="table-scroll-hint">{hint}</div>
        <div className="horizontal-scroll-topbar" ref={topScrollRef} aria-label="顶部横向滚动条">
          <div className="horizontal-scroll-spacer" ref={spacerRef} />
        </div>
      </div>

      <div
        ref={mainScrollRef}
        className={joinClassNames(
          "table-wrapper",
          "table-wrapper-prominent",
          isDragging ? "table-wrapper-dragging" : "table-wrapper-draggable",
        )}
        onMouseDown={handleMouseDown}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
