"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CAII_REST, hashString, mulberry32, randn } from "@/lib/gameMath";
import type { SpecTemplateRow, SupernovaRow } from "@/lib/types";

type Props = { sn: SupernovaRow; specTemplate: SpecTemplateRow[]; onLocked: () => void };

export function SpectrumInteractive({ sn, specTemplate, onLocked }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);

  const pts = useMemo(() => {
    const rng = mulberry32(hashString(sn.sn_name + "spec"));
    return specTemplate.map((row) => {
      const lambdaObs = row.lambda_rest_A * (1 + sn.z_true);
      const flux = row.flux_norm + randn(rng) * 0.03;
      return { lambdaObs, flux };
    });
  }, [specTemplate, sn.sn_name, sn.z_true]);

  const { lamMin, lamMax, mid } = useMemo(() => {
    const lo = pts[0].lambdaObs;
    const hi = pts[pts.length - 1].lambdaObs;
    return { lamMin: lo, lamMax: hi, mid: (lo + hi) / 2 };
  }, [pts]);

  const [lineLambda, setLineLambda] = useState(mid);
  useEffect(() => {
    setLineLambda(mid);
  }, [mid]);

  const zMeas = lineLambda / CAII_REST - 1;
  const ok = Math.abs(lineLambda - sn.lambda_CaII) < 20;

  useLayoutEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const w = cv.width;
    const h = cv.height;
    let fmin = Infinity,
      fmax = -Infinity;
    for (const p of pts) {
      fmin = Math.min(fmin, p.flux);
      fmax = Math.max(fmax, p.flux);
    }
    const pad = 16;
    const iw = w - pad * 2;
    const ih = h - pad * 2;
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = pad + ((pts[i].lambdaObs - lamMin) / (lamMax - lamMin)) * iw;
      const y = pad + ih - ((pts[i].flux - fmin) / (fmax - fmin || 1)) * ih;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(200,215,235,0.85)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const lx = pad + ((lineLambda - lamMin) / (lamMax - lamMin)) * iw;
    ctx.strokeStyle = "#6eb5ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, pad);
    ctx.lineTo(lx, pad + ih);
    ctx.stroke();
  }, [pts, lamMin, lamMax, lineLambda]);

  function lambdaFromClientX(clientX: number) {
    const el = canvasRef.current;
    if (!el) return lineLambda;
    const rect = el.getBoundingClientRect();
    const u = (clientX - rect.left) / rect.width;
    return lamMin + u * (lamMax - lamMin);
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={640}
        height={220}
        className="w-full max-w-[640px] touch-none rounded-lg border border-white/10 bg-black"
        onPointerDown={(e) => {
          setDragging(true);
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          setLineLambda(Math.min(lamMax, Math.max(lamMin, lambdaFromClientX(e.clientX))));
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          setLineLambda(Math.min(lamMax, Math.max(lamMin, lambdaFromClientX(e.clientX))));
        }}
        onPointerUp={() => setDragging(false)}
      />
      <p className="text-sm text-slate-300">
        Line center: <span className="font-mono text-sky-300">{lineLambda.toFixed(1)} Å</span> → z<sub>meas</sub> ={" "}
        <span className="font-mono text-sky-300">{zMeas.toFixed(4)}</span>
        <span className="text-slate-500">
          {" "}
          (Hubble diagram uses precomputed z<sub>obs</sub> = {sn.z_obs.toFixed(4)})
        </span>
      </p>
      <button
        type="button"
        disabled={!ok}
        onClick={onLocked}
        className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Lock redshift
      </button>
    </div>
  );
}
