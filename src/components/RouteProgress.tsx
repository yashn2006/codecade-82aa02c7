import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useIsFetching } from "@tanstack/react-query";

/**
 * Slim neon progress bar pinned to the top of the viewport. Lights up while
 * the router is resolving a page or a page is fetching its first data
 * (background refreshes don't trigger it). Ignores blips under 120ms.
 */
export function RouteProgress() {
  const routerBusy = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const firstLoads = useIsFetching({ predicate: (q) => q.state.status === "pending" });
  const active = routerBusy || firstLoads > 0;

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    if (active) {
      let tick: number | undefined;
      const start = window.setTimeout(() => {
        visibleRef.current = true;
        setVisible(true);
        setProgress((p) => (p < 0.12 ? 0.12 : p));
        tick = window.setInterval(() => setProgress((p) => p + (0.9 - p) * 0.09), 160);
      }, 120);
      return () => {
        window.clearTimeout(start);
        if (tick) window.clearInterval(tick);
      };
    }
    if (!visibleRef.current) return;
    setProgress(1);
    const done = window.setTimeout(() => {
      visibleRef.current = false;
      setVisible(false);
      window.setTimeout(() => setProgress(0), 220);
    }, 260);
    return () => window.clearTimeout(done);
  }, [active]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 220ms ease" }}
    >
      <div
        className="route-progress-bar h-full origin-left"
        style={{
          transform: `scaleX(${progress})`,
          transition: progress === 0 ? "none" : "transform 240ms cubic-bezier(.2,.7,.2,1)",
        }}
      />
    </div>
  );
}
