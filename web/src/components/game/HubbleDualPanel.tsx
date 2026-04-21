"use client";

import { useEffect, useRef } from "react";
import { MU_AXIS, Z_AXIS } from "@/lib/gameMath";
import {
  interpMuAtZ,
  muResidualCurve,
  residualRange,
  residualRangeWithPreview,
  xHubble,
  yHubble,
  yResid,
} from "@/lib/hubbleMath";
import type { GameBundle, Observation } from "@/lib/types";

type Props = {
  curves: GameBundle["curves"];
  observations: Observation[];
  highlightLCDM: boolean;
  /** From spectrum: z_meas = λ_obs / λ_rest − 1 (guides x-axis). */
  previewZ: number | null;
  /** From light curve: μ ≈ m_peak − M (guides y-axis). */
  previewMu: number | null;
};

function setupCanvas(canvas: HTMLCanvasElement, cssH: number) {
  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(200, Math.floor(rect.width * dpr));
  const h = Math.floor(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cssW = rect.width;
  return { ctx, w: cssW, h: cssH, dpr };
}

export function HubbleDualPanel({ curves, observations, highlightLCDM, previewZ, previewMu }: Props) {
  const refH = useRef<HTMLCanvasElement>(null);
  const refR = useRef<HTMLCanvasElement>(null);

  const previewResidual =
    previewZ != null && previewMu != null && Number.isFinite(previewZ) && Number.isFinite(previewMu)
      ? previewMu - interpMuAtZ(curves.open_matter, previewZ)
      : null;

  useEffect(() => {
    const canvas = refH.current;
    if (!canvas) return;
    const o = setupCanvas(canvas, 280);
    if (!o) return;
    const { ctx, w, h } = o;
    ctx.fillStyle = "#0a0d12";
    ctx.fillRect(0, 0, w, h);
    const padL = 44,
      padR = 12,
      padT = 10,
      padB = 34;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    for (let i = 0; i <= 4; i++) {
      const mu = MU_AXIS.min + (i / 4) * (MU_AXIS.max - MU_AXIS.min);
      const y = padT + yHubble(mu, ih);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + iw, y);
      ctx.stroke();
      ctx.fillStyle = "#6b7788";
      ctx.font = "10px system-ui";
      ctx.fillText(mu.toFixed(0), 4, y + 3);
    }
    const zTicks = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0];
    ctx.textAlign = "center";
    for (const zt of zTicks) {
      const x = padL + xHubble(zt, iw);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + ih);
      ctx.stroke();
      ctx.fillStyle = "#6b7788";
      ctx.fillText(zt >= 0.1 ? zt.toFixed(1) : zt.toFixed(2), x, padT + ih + 22);
    }

    function drawCurve(key: keyof typeof curves, color: string, lw?: number) {
      const arr = curves[key];
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const z = arr[i].z;
        const mu = arr[i].mu_theory;
        const x = padL + xHubble(z, iw);
        const y = padT + yHubble(mu, ih);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      const base = key === "flat_LCDM" ? 2.2 : 1.4;
      ctx.lineWidth = lw ?? base;
      ctx.stroke();
    }
    drawCurve("EdS", "#ff9b6b");
    drawCurve("open_matter", "#9aa3b2");
    drawCurve("flat_LCDM", "#8fd4ff", highlightLCDM ? 4.5 : 2.2);

    for (const p of observations) {
      const x = padL + xHubble(p.z_obs, iw);
      const y = padT + yHubble(p.mu_obs, ih);
      const sig = p.sigma_mu;
      const yTop = padT + yHubble(p.mu_obs + sig, ih);
      const yBot = padT + yHubble(p.mu_obs - sig, ih);
      ctx.strokeStyle = "rgba(232,237,244,0.55)";
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBot);
      ctx.stroke();
      ctx.fillStyle = p.flash ? "#ffffff" : "#e8edf4";
      ctx.beginPath();
      ctx.arc(x, y, p.flash ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (previewZ != null && Number.isFinite(previewZ)) {
      const xv = padL + xHubble(previewZ, iw);
      ctx.save();
      ctx.strokeStyle = "rgba(110, 200, 255, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(xv, padT);
      ctx.lineTo(xv, padT + ih);
      ctx.stroke();
      ctx.restore();
    }
    if (previewMu != null && Number.isFinite(previewMu)) {
      const yh = padT + yHubble(previewMu, ih);
      ctx.save();
      ctx.strokeStyle = "rgba(255, 200, 120, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(padL, yh);
      ctx.lineTo(padL + iw, yh);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "#9aa3b2";
    ctx.font = "11px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("μ (distance modulus)", padL, padT - 2);
    ctx.textAlign = "center";
    ctx.fillText(`redshift z (log ${Z_AXIS.min}–${Z_AXIS.max})`, padL + iw / 2, h - 6);
  }, [curves, observations, highlightLCDM, previewZ, previewMu]);

  useEffect(() => {
    const canvas = refR.current;
    if (!canvas) return;
    const o = setupCanvas(canvas, 160);
    if (!o) return;
    const { ctx, w, h } = o;
    ctx.fillStyle = "#0a0d12";
    ctx.fillRect(0, 0, w, h);
    const padL = 44,
      padR = 12,
      padT = 10,
      padB = 28;
    const iw = w - padL - padR;
    const ih = h - padT - padB;
    const { lo, hi } =
      previewResidual != null && Number.isFinite(previewResidual)
        ? residualRangeWithPreview(observations, previewResidual)
        : residualRange(observations);

    for (let i = 0; i <= 4; i++) {
      const r = lo + (i / 4) * (hi - lo);
      const y = padT + yResid(r, ih, lo, hi);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + iw, y);
      ctx.stroke();
      ctx.fillStyle = "#6b7788";
      ctx.font = "10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(r.toFixed(2), 4, y + 3);
    }
    ctx.strokeStyle = "rgba(110,181,255,0.35)";
    ctx.setLineDash([4, 4]);
    const y0 = padT + yResid(0, ih, lo, hi);
    ctx.beginPath();
    ctx.moveTo(padL, y0);
    ctx.lineTo(padL + iw, y0);
    ctx.stroke();
    ctx.setLineDash([]);

    const n = curves.EdS.length;
    function drawResCurve(modelKey: keyof typeof curves, color: string, lw: number) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const z = curves.EdS[i].z;
        const r = muResidualCurve(curves, modelKey, i);
        const x = padL + xHubble(z, iw);
        const y = padT + yResid(r, ih, lo, hi);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    drawResCurve("EdS", "#ff9b6b", 1.2);
    drawResCurve("open_matter", "#9aa3b2", 1.2);
    drawResCurve("flat_LCDM", "#8fd4ff", highlightLCDM ? 3 : 1.6);

    for (const p of observations) {
      const x = padL + xHubble(p.z_obs, iw);
      const y = padT + yResid(p.residual, ih, lo, hi);
      ctx.fillStyle = p.flash ? "#ffffff" : "#e8edf4";
      ctx.beginPath();
      ctx.arc(x, y, p.flash ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (previewZ != null && Number.isFinite(previewZ)) {
      const xv = padL + xHubble(previewZ, iw);
      ctx.save();
      ctx.strokeStyle = "rgba(110, 200, 255, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(xv, padT);
      ctx.lineTo(xv, padT + ih);
      ctx.stroke();
      ctx.restore();
    }
    if (previewResidual != null && Number.isFinite(previewResidual)) {
      const yr = padT + yResid(previewResidual, ih, lo, hi);
      ctx.save();
      ctx.strokeStyle = "rgba(255, 200, 120, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(padL, yr);
      ctx.lineTo(padL + iw, yr);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "#9aa3b2";
    ctx.font = "10px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Δμ vs open matter", padL, padT - 2);
  }, [curves, observations, highlightLCDM, previewZ, previewResidual]);

  const showPreviewNote = previewZ != null || previewMu != null;

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/80 p-3">
      {showPreviewNote ? (
        <p className="text-[11px] leading-snug text-sky-200/90">
          Dashed guides: <span className="text-sky-300">vertical</span> = your locked <span className="font-mono">z</span> on the x-axis;{" "}
          <span className="text-amber-200">horizontal</span> = your <span className="font-mono">μ = m − M</span> on the y-axis (residual panel uses Δμ vs open matter at that{" "}
          <span className="font-mono">z</span>).
        </p>
      ) : null}
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Distance modulus vs redshift</div>
      <canvas ref={refH} className="h-[280px] w-full rounded-lg bg-[#0a0d12]" />
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Residuals vs Ω_m=0.3, Ω_Λ=0</div>
      <canvas ref={refR} className="h-[160px] w-full rounded-lg bg-[#0a0d12]" />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-3 rounded bg-[#ff9b6b]" /> EdS
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-3 rounded bg-[#9aa3b2]" /> open matter
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-3 rounded bg-[#6eb5ff]" /> flat ΛCDM
        </span>
      </div>
    </div>
  );
}
