"use client";

import { useEffect, useRef } from "react";

/**
 * Resplandor cálido que sigue al cursor con inercia (lerp).
 * Solo en dispositivos con puntero fino (desktop) y sin
 * prefers-reduced-motion. pointer-events: none — nunca estorba.
 */
export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let targetX = -9999;
    let targetY = -9999;
    let x = targetX;
    let y = targetY;
    let visible = false;

    const onMove = (e: MouseEvent): void => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) {
        visible = true;
        x = targetX;
        y = targetY;
        el.style.opacity = "1";
      }
    };

    const tick = (): void => {
      // interpolación suave hacia el cursor
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      el.style.transform = `translate3d(${x - 280}px, ${y - 280}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-30 h-[560px] w-[560px] opacity-0 transition-opacity duration-500"
      style={{
        transform: "translate3d(-9999px, -9999px, 0)",
        background:
          "radial-gradient(circle, rgba(255,206,0,0.10) 0%, rgba(207,20,43,0.05) 40%, transparent 70%)",
        mixBlendMode: "screen",
      }}
    />
  );
}
