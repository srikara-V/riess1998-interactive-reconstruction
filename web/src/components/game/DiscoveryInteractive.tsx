"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { hashString, mulberry32 } from "@/lib/gameMath";

type Props = { snName: string; onFound: () => void };

export function DiscoveryInteractive({ snName, onFound }: Props) {
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);

  const geo = useMemo(() => {
    const W = 320;
    const H = 200;
    const rng = mulberry32(hashString(snName));
    const stars = [];
    for (let i = 0; i < 95; i++) {
      stars.push({ x: rng() * W, y: rng() * H, r: rng() * 1.4 + 0.3, b: rng() * 0.5 + 0.45 });
    }
    const nx = 0.55 * W + (rng() - 0.5) * 40;
    const ny = 0.42 * H + (rng() - 0.5) * 36;
    return { w: W, h: H, stars, nx, ny };
  }, [snName]);

  useLayoutEffect(() => {
    function paint(canvas: HTMLCanvasElement, withSN: boolean) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { w, h, stars, nx, ny } = geo;
      ctx.fillStyle = "#05070a";
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        ctx.fillStyle = `rgba(230,240,255,${s.b})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (withSN) {
        ctx.fillStyle = "rgba(255,230,180,0.95)";
        ctx.beginPath();
        ctx.arc(nx, ny, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,200,120,0.5)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    if (beforeRef.current) paint(beforeRef.current, false);
    if (afterRef.current) paint(afterRef.current, true);
  }, [geo]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="text-center">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Before</h3>
        <canvas ref={beforeRef} width={geo.w} height={geo.h} className="mx-auto w-full max-w-[360px] rounded-lg border border-white/10 bg-black" />
      </div>
      <div className="text-center">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">After</h3>
        <canvas
          ref={afterRef}
          width={geo.w}
          height={geo.h}
          className="mx-auto w-full max-w-[360px] cursor-crosshair rounded-lg border border-white/10 bg-black"
          onClick={(ev) => {
            const c = ev.currentTarget;
            const rect = c.getBoundingClientRect();
            const sx = ((ev.clientX - rect.left) / rect.width) * geo.w;
            const sy = ((ev.clientY - rect.top) / rect.height) * geo.h;
            if (Math.hypot(sx - geo.nx, sy - geo.ny) < 18) onFound();
          }}
        />
      </div>
    </div>
  );
}
