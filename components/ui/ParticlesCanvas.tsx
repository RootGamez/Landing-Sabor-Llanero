"use client";

import { useEffect, useRef } from "react";

/** Partícula tipo brasa que asciende desde la parte baja */
interface Particle {
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  phase: number;
  alpha: number;
  color: string;
}

const COLORS = ["#FFCE00", "#FF9D3D", "#CF142B", "#FFE08A"];
const COUNT = 38;

/**
 * Canvas de brasas flotantes para el hero (efecto horno de leña).
 * Ligero: un solo canvas, requestAnimationFrame, se pausa cuando la
 * pestaña no está visible y se desactiva con prefers-reduced-motion.
 */
export default function ParticlesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = (): void => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const spawn = (initial: boolean): Particle => ({
      x: Math.random() * width,
      y: initial ? Math.random() * height : height + 10,
      r: 1 + Math.random() * 2.6,
      vy: 0.25 + Math.random() * 0.7,
      sway: 14 + Math.random() * 26,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.25 + Math.random() * 0.5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });

    let particles: Particle[] = Array.from({ length: COUNT }, () => spawn(true));
    let t = 0;

    const tick = (): void => {
      t += 0.012;
      ctx.clearRect(0, 0, width, height);
      particles = particles.map((p) => {
        const ny = p.y - p.vy;
        if (ny < -12) return spawn(false);
        return { ...p, y: ny };
      });
      for (const p of particles) {
        const x = p.x + Math.sin(t + p.phase) * p.sway * 0.4;
        // se desvanecen al subir
        const fade = Math.min(1, p.y / (height * 0.35));
        ctx.globalAlpha = p.alpha * fade;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = (): void => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
