"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { hashString, interpolateLC, M_REF, mulberry32, randn } from "@/lib/gameMath";
import type { LCTemplateRow, SupernovaRow } from "@/lib/types";

type Props = {
  sn: SupernovaRow;
  lcTemplate: LCTemplateRow[];
  /** Fires when the player reads the peak (before adding the point). */
  onPeakRead?: (payload: { m: number; muFromM: number }) => void;
  onContinue: () => void;
};

const padL = 58;
const padR = 16;
const padT = 32;
const padB = 46;

export function LightcurveInteractive({ sn, lcTemplate, onPeakRead, onContinue }: Props) {
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

  useLayoutEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const w = cv.width;
    const h = cv.height;
    const iw = w - padL - padR;
    const ih = h - padT - padB;
    const yLc = (m: number) => padT + ih * ((m - mMin) / (mMax - mMin || 1));
    const xT = (t: number) => padL + ((t - tMin) / (tMax - tMin)) * iw;

    ctx.fillStyle = "#f0eeeb";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(28,25,23,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + ih);
    ctx.lineTo(padL + iw, padT + ih);
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + ih);
    ctx.stroke();

    for (let i = 0; i <= 5; i++) {
      const m = mMin + (i / 5) * (mMax - mMin);
      const y = yLc(m);
      ctx.strokeStyle = "rgba(28,25,23,0.06)";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + iw, y);
      ctx.stroke();
      ctx.fillStyle = "#57534e";
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(m.toFixed(2), padL - 8, y + 3);
    }
    ctx.textAlign = "start";

    ctx.fillStyle = "#57534e";
    ctx.font = "11px system-ui,sans-serif";
    ctx.fillText("↑ brighter", padL + 4, padT + 2);

    ctx.save();
    ctx.translate(14, padT + ih / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#57534e";
    ctx.font = "11px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Apparent magnitude (m)", 0, 0);
    ctx.restore();

    const xTicks = [-20, -10, 0, 10, 20, 30, 40, 45];
    ctx.fillStyle = "#6b7788";
    ctx.font = "9px system-ui,sans-serif";
    ctx.textAlign = "center";
    for (const tv of xTicks) {
      const x = xT(tv);
      ctx.strokeStyle = "rgba(28,25,23,0.1)";
      ctx.beginPath();
      ctx.moveTo(x, padT + ih);
      ctx.lineTo(x, padT + ih + 4);
      ctx.stroke();
      ctx.fillText(tv === 0 ? "0" : String(tv), x, padT + ih + 15);
    }
    ctx.textAlign = "start";

    ctx.fillStyle = "#57534e";
    ctx.font = "11px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Days relative to maximum brightness", padL + iw / 2, h - 10);
    ctx.textAlign = "start";

    if (showTemplate) {
      ctx.beginPath();
      for (let t = tMin; t <= tMax; t += 1) {
        const dm = interpolateLC(lcTemplate, t);
        const m = mPeak + dm;
        const x = xT(t);
        const y = yLc(m);
        if (t === tMin) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(37, 99, 235, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const dm0 = interpolateLC(lcTemplate, 0);
      const peakX = xT(0);
      const peakY = yLc(mPeak + dm0);
      ctx.beginPath();
      ctx.arc(peakX, peakY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(180, 83, 9, 0.95)";
      ctx.fill();
      ctx.strokeStyle = "rgba(120, 53, 15, 0.75)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const lx = Math.min(peakX + 52, padL + iw - 8);
      const ly = Math.max(peakY - 38, padT + 14);
      ctx.strokeStyle = "rgba(180, 83, 9, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(peakX + 5, peakY - 4);
      ctx.lineTo(lx - 4, ly + 12);
      ctx.stroke();
      ctx.fillStyle = "#44403c";
      ctx.font = "bold 11px system-ui,sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("peak m → distance", lx, ly);
      ctx.textAlign = "start";
    }
    for (const p of pts) {
      const x = xT(p.t);
      const y = yLc(p.mObs);
      ctx.fillStyle = "#292524";
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [lcTemplate, mMax, mMin, mPeak, pts, showTemplate, tMax, tMin]);

  const muShown = mPeak - M_REF;

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} width={640} height={220} className="w-full max-w-[640px] rounded-lg border border-stone-200 bg-[#f0eeeb]" />
      <div className="max-w-[640px] space-y-3 rounded-xl border border-stone-200 bg-stone-50/90 p-4 md:p-5">
        <p className="text-base leading-relaxed text-stone-600 md:text-lg">
          <strong className="text-stone-900">What the dark dots are:</strong> each dot is <strong>one night’s measurement</strong> of the{" "}
          <em>same</em> supernova — same explosion, different evening. You keep pointing the telescope at the field, record how bright it looks, and move on to the next cadence. The horizontal axis is <em>which</em> night (relative to brightest night); the vertical axis is <em>how bright</em> it looked that night. Together they sketch one object brightening toward a peak and then fading.
        </p>
        <p className="text-base leading-relaxed text-stone-600 md:text-lg">
          <strong className="text-stone-900">What you extract for distance:</strong> a <strong>single</strong> apparent magnitude <span className="font-mono text-stone-800">m</span> at the{" "}
          <strong>peak</strong> (around day 0) — the moment it was intrinsically hottest as seen from Earth. After you fit the blue template, the <strong className="text-amber-900">orange dot</strong> marks that peak; the label reminds you that <strong className="text-stone-900">this one m</strong> is what feeds{" "}
          <span className="font-mono text-stone-800">μ = m − M</span>. All the other dots exist so you are not guessing the peak from a lucky single snapshot halfway down the decline.
        </p>
        <p className="text-sm text-stone-500 md:text-base">
          Reminder: magnitudes run backward — <strong className="text-stone-700">smaller m = brighter</strong> (same as the “↑ brighter” cue on the plot).
        </p>
      </div>
      <div className="font-ui flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowTemplate(true)}
          className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-base font-medium text-stone-800 shadow-sm hover:bg-stone-50"
        >
          Fit template
        </button>
        <button
          type="button"
          disabled={!showTemplate}
          onClick={() => {
            setShowPeak(true);
            onPeakRead?.({ m: mPeak, muFromM: muShown });
          }}
          className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-base font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:opacity-40"
        >
          Read peak magnitude
        </button>
        <button
          type="button"
          disabled={!showPeak}
          onClick={onContinue}
          className="rounded-lg bg-stone-900 px-5 py-2.5 text-base font-semibold text-white shadow hover:bg-stone-800 disabled:opacity-40"
        >
          Add to Hubble diagram
        </button>
      </div>
      {showPeak ? (
        <p className="text-sm text-stone-600">
          Peak <span className="font-mono text-stone-900">m = {mPeak.toFixed(2)}</span> →{" "}
          <span className="font-mono text-stone-900">μ = m − M ≈ {muShown.toFixed(2)}</span> with <span className="font-mono">M = {M_REF}</span>. The{" "}
          <strong className="text-amber-900">horizontal guide</strong> on the Hubble panel marks this μ. The final plotted point uses the survey’s noisy{" "}
          <span className="font-mono">μ_obs = {sn.mu_obs.toFixed(2)}</span>.
        </p>
      ) : null}
    </div>
  );
}
