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
  showDiscoveryHints?: boolean;
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

export function HubbleDualPanel({ curves, observations, highlightLCDM, showDiscoveryHints = false, previewZ, previewMu }: Props) {
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
    ctx.fillStyle = "#f0eeeb";
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
      ctx.strokeStyle = "rgba(28,25,23,0.07)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + iw, y);
      ctx.stroke();
      ctx.fillStyle = "#57534e";
      ctx.font = "10px system-ui";
      ctx.fillText(mu.toFixed(0), 4, y + 3);
    }
    const zTicks = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0];
    ctx.textAlign = "center";
    for (const zt of zTicks) {
      const x = padL + xHubble(zt, iw);
      ctx.strokeStyle = "rgba(28,25,23,0.06)";
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + ih);
      ctx.stroke();
      ctx.fillStyle = "#57534e";
      ctx.fillText(zt >= 0.1 ? zt.toFixed(1) : zt.toFixed(2), x, padT + ih + 22);
    }

    function drawCurve(key: keyof typeof curves, color: string, lw?: number) {
      const arr = curves[key];
      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, iw, ih);
      ctx.clip();
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < arr.length; i++) {
        const z = arr[i].z;
        if (z < Z_AXIS.min || z > Z_AXIS.max) continue;
        const mu = arr[i].mu_theory;
        const x = padL + xHubble(z, iw);
        const y = padT + yHubble(mu, ih);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        }
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      const base = key === "flat_LCDM" ? 2.2 : 1.4;
      ctx.lineWidth = lw ?? base;
      ctx.stroke();
      ctx.restore();
    }
    drawCurve("EdS", "#c2410c");
    drawCurve("open_matter", "#78716c");
    drawCurve("flat_LCDM", "#2563eb", highlightLCDM ? 4.5 : 2.2);

    for (const p of observations) {
      const x = padL + xHubble(p.z_obs, iw);
      const y = padT + yHubble(p.mu_obs, ih);
      const sig = p.sigma_mu;
      const yTop = padT + yHubble(p.mu_obs + sig, ih);
      const yBot = padT + yHubble(p.mu_obs - sig, ih);
      ctx.strokeStyle = "rgba(68,64,60,0.45)";
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBot);
      ctx.stroke();
      ctx.fillStyle = p.flash ? "#0c0a09" : "#292524";
      ctx.beginPath();
      ctx.arc(x, y, p.flash ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (previewZ != null && Number.isFinite(previewZ)) {
      const xv = padL + xHubble(previewZ, iw);
      ctx.save();
      ctx.strokeStyle = "rgba(59, 130, 246, 0.75)";
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
      ctx.strokeStyle = "rgba(180, 83, 9, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(padL, yh);
      ctx.lineTo(padL + iw, yh);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "#44403c";
    ctx.font = "11px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("μ (distance modulus)", padL, padT - 2);
    ctx.textAlign = "center";
    ctx.fillText(`redshift z (log ${Z_AXIS.min}–${Z_AXIS.max})`, padL + iw / 2, h - 6);

    if (showDiscoveryHints && observations.length > 10) {
      const zHint = 0.58;
      const xHint = padL + xHubble(zHint, iw);
      ctx.save();
      ctx.strokeStyle = "rgba(37, 99, 235, 0.22)";
      ctx.fillStyle = "rgba(37, 99, 235, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(xHint - 22, padT, 110, ih);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }, [curves, observations, highlightLCDM, previewZ, previewMu, showDiscoveryHints]);

  useEffect(() => {
    const canvas = refR.current;
    if (!canvas) return;
    const o = setupCanvas(canvas, 160);
    if (!o) return;
    const { ctx, w, h } = o;
    ctx.fillStyle = "#f0eeeb";
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
      ctx.strokeStyle = "rgba(28,25,23,0.07)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + iw, y);
      ctx.stroke();
      ctx.fillStyle = "#57534e";
      ctx.font = "10px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(r.toFixed(2), 4, y + 3);
    }
    ctx.strokeStyle = "rgba(37, 99, 235, 0.35)";
    ctx.setLineDash([4, 4]);
    const y0 = padT + yResid(0, ih, lo, hi);
    ctx.beginPath();
    ctx.moveTo(padL, y0);
    ctx.lineTo(padL + iw, y0);
    ctx.stroke();
    ctx.setLineDash([]);

    const n = curves.EdS.length;
    function drawResCurve(modelKey: keyof typeof curves, color: string, lw: number) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(padL, padT, iw, ih);
      ctx.clip();
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        const z = curves.EdS[i].z;
        if (z < Z_AXIS.min || z > Z_AXIS.max) continue;
        const r = muResidualCurve(curves, modelKey, i);
        const x = padL + xHubble(z, iw);
        const y = padT + yResid(r, ih, lo, hi);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        }
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.restore();
    }
    drawResCurve("EdS", "#c2410c", 1.2);
    drawResCurve("open_matter", "#78716c", 1.2);
    drawResCurve("flat_LCDM", "#2563eb", highlightLCDM ? 3 : 1.6);

    for (const p of observations) {
      const x = padL + xHubble(p.z_obs, iw);
      const y = padT + yResid(p.residual, ih, lo, hi);
      ctx.fillStyle = p.flash ? "#0c0a09" : "#292524";
      ctx.beginPath();
      ctx.arc(x, y, p.flash ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (previewZ != null && Number.isFinite(previewZ)) {
      const xv = padL + xHubble(previewZ, iw);
      ctx.save();
      ctx.strokeStyle = "rgba(59, 130, 246, 0.75)";
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
      ctx.strokeStyle = "rgba(180, 83, 9, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(padL, yr);
      ctx.lineTo(padL + iw, yr);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "#44403c";
    ctx.font = "10px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("Δμ vs open matter", padL, padT - 2);

    if (showDiscoveryHints && observations.length > 10) {
      const zHint = 0.55;
      const xHint = padL + xHubble(zHint, iw);
      ctx.save();
      ctx.strokeStyle = "rgba(16, 185, 129, 0.22)";
      ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(xHint - 20, padT, 105, ih);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }, [curves, observations, highlightLCDM, previewZ, previewResidual, showDiscoveryHints]);

  const showPreviewNote = previewZ != null || previewMu != null;

  return (
    <div className="font-ui space-y-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      {showPreviewNote ? (
        <p className="text-[11px] leading-snug text-stone-600">
          Dashed guides: <span className="font-medium text-stone-900">vertical</span> = your locked <span className="font-mono">z</span> on the x-axis;{" "}
          <span className="font-medium text-stone-900">horizontal</span> = your <span className="font-mono">μ = m − M</span> on the y-axis (residual panel uses Δμ vs open matter at that{" "}
          <span className="font-mono">z</span>).
        </p>
      ) : null}
      <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Distance modulus vs redshift</div>
      <canvas ref={refH} className="h-[280px] w-full rounded-lg border border-stone-200/80 bg-[#f0eeeb]" />
      <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">Residuals vs Ω_m=0.3, Ω_Λ=0</div>
      <canvas ref={refR} className="h-[160px] w-full rounded-lg border border-stone-200/80 bg-[#f0eeeb]" />
      {showDiscoveryHints ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[12px] leading-relaxed text-stone-700">
          Read the two panels together: at high redshift, the supernovae sit above the open-matter prediction in the top plot, and in the residual plot many points lie above `Δμ = 0`. That means the supernovae are dimmer, hence farther away, than a decelerating universe would predict.
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-3 rounded bg-[#c2410c]" /> EdS
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-3 rounded bg-[#78716c]" /> open matter
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-3 rounded bg-[#2563eb]" /> flat ΛCDM
        </span>
      </div>
    </div>
  );
}
