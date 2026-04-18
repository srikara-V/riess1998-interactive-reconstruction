"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { hashString, interpolateLC, M_REF, mulberry32, randn } from "@/lib/gameMath";
import type { LCTemplateRow, SupernovaRow } from "@/lib/types";

type Props = { sn: SupernovaRow; lcTemplate: LCTemplateRow[]; onContinue: () => void };

export function LightcurveInteractive({ sn, lcTemplate, onContinue }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showPeak, setShowPeak] = useState(false);

  const pts = useMemo(() => {
    const rng = mulberry32(hashString(sn.sn_name + "lc"));
    const candidates: number[] = [];
    for (let t = -15; t <= 40; t += 2) candidates.push(t);
    const phases: number[] = [];
    const pool = [...candidates];
    while (phases.length < 12 && pool.length) {
      const idx = Math.floor(rng() * pool.length);
      phases.push(pool.splice(idx, 1)[0]);
    }
    phases.sort((a, b) => a - b);
    return phases.map((t) => {
      const dm = interpolateLC(lcTemplate, t);
      const mObs = sn.m_apparent + dm + randn(rng) * 0.08;
      return { t, mObs };
    });
  }, [lcTemplate, sn.m_apparent, sn.sn_name]);

  const tMin = -20;
  const tMax = 45;
  const mPeak = sn.m_apparent;
  const mMin = Math.min(...pts.map((p) => p.mObs), mPeak) - 0.25;
  const mMax = Math.max(...pts.map((p) => p.mObs), mPeak) + 0.35;
  const pad = 18;

  useLayoutEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const w = cv.width;
    const h = cv.height;
    const iw = w - pad * 2;
    const ih = h - pad * 2;
    const yLc = (m: number) => pad + ih * ((m - mMin) / (mMax - mMin || 1));
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i <= 5; i++) {
      const m = mMin + (i / 5) * (mMax - mMin);
      const y = yLc(m);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + iw, y);
      ctx.stroke();
      ctx.fillStyle = "#6b7788";
      ctx.font = "10px system-ui";
      ctx.fillText(m.toFixed(2), 2, y + 3);
    }
    if (showTemplate) {
      ctx.beginPath();
      for (let t = tMin; t <= tMax; t += 1) {
        const dm = interpolateLC(lcTemplate, t);
        const m = mPeak + dm;
        const x = pad + ((t - tMin) / (tMax - tMin)) * iw;
        const y = yLc(m);
        if (t === tMin) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(110,181,255,0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    for (const p of pts) {
      const x = pad + ((p.t - tMin) / (tMax - tMin)) * iw;
      const y = yLc(p.mObs);
      ctx.fillStyle = "#e8edf4";
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [lcTemplate, mMax, mMin, mPeak, pad, pts, showTemplate, tMax, tMin]);

  const muShown = mPeak - M_REF;

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} width={640} height={220} className="w-full max-w-[640px] rounded-lg border border-white/10 bg-black" />
      <p className="text-xs text-slate-500">Phase in days relative to B maximum · magnitudes increase upward (fainter up).</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowTemplate(true)} className="rounded-lg border border-white/15 bg-slate-800 px-3 py-1.5 text-sm">
          Fit template
        </button>
        <button
          type="button"
          disabled={!showTemplate}
          onClick={() => setShowPeak(true)}
          className="rounded-lg border border-white/15 bg-slate-800 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Read peak magnitude
        </button>
        <button
          type="button"
          disabled={!showPeak}
          onClick={onContinue}
          className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Add to Hubble diagram
        </button>
      </div>
      {showPeak ? (
        <p className="text-sm text-slate-200">
          Peak <span className="font-mono text-sky-300">m = {mPeak.toFixed(2)}</span> → standardized distance modulus{" "}
          <span className="font-mono text-sky-300">μ ≈ {muShown.toFixed(2)}</span> using <span className="font-mono">M = {M_REF}</span>. The diagram uses the
          precomputed noisy <span className="font-mono">μ_obs</span>.
        </p>
      ) : null}
    </div>
  );
}
