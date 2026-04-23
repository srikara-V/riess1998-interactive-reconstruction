"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HALPHA_REST, hashString, mulberry32, randn } from "@/lib/gameMath";
import type { SpecTemplateRow, SupernovaRow } from "@/lib/types";

type Props = {
  sn: SupernovaRow;
  specTemplate: SpecTemplateRow[];
  /** Called with z_meas = λ_line / λ_rest − 1 when the player locks. */
  onLocked: (zMeasured: number) => void;
  /** Live z_meas while dragging (updates Hubble x-guide). */
  onZMeasChange?: (zMeasured: number) => void;
};

const PAD_LEFT = 54;
const PAD_RIGHT = 18;
const PAD_TOP = 18;
const PAD_BOTTOM = 36;
const HISTORICAL_MIN_WAVELENGTH = 5100;
const NOMINAL_MAX_WAVELENGTH = 10000;
const PLOT_WINDOW_WIDTH = 2200;

export function SpectrumInteractive({ sn, specTemplate, onLocked, onZMeasChange }: Props) {
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

  const { lamMin, lamMax, mid, visiblePts } = useMemo(() => {
    const upperBound = Math.max(NOMINAL_MAX_WAVELENGTH, sn.lambda_Halpha + 180);
    let lo = Math.max(HISTORICAL_MIN_WAVELENGTH, sn.lambda_Halpha - PLOT_WINDOW_WIDTH / 2);
    let hi = Math.min(upperBound, sn.lambda_Halpha + PLOT_WINDOW_WIDTH / 2);
    if (hi - lo < PLOT_WINDOW_WIDTH) {
      if (lo === HISTORICAL_MIN_WAVELENGTH) hi = Math.min(upperBound, lo + PLOT_WINDOW_WIDTH);
      if (hi === upperBound) lo = Math.max(HISTORICAL_MIN_WAVELENGTH, hi - PLOT_WINDOW_WIDTH);
    }
    const clipped = pts.filter((p) => p.lambdaObs >= lo && p.lambdaObs <= hi);
    return { lamMin: lo, lamMax: hi, mid: (lo + hi) / 2, visiblePts: clipped };
  }, [pts, sn.lambda_Halpha]);

  const [lineLambda, setLineLambda] = useState(mid);
  useEffect(() => {
    setLineLambda(mid);
  }, [mid]);

  const zMeas = lineLambda / HALPHA_REST - 1;
  const stretch = lineLambda / HALPHA_REST;
  const ok = Math.abs(lineLambda - sn.lambda_Halpha) < 20;

  useEffect(() => {
    onZMeasChange?.(zMeas);
  }, [zMeas, onZMeasChange]);

  useLayoutEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const w = cv.width;
    const h = cv.height;
    let fmin = Infinity,
      fmax = -Infinity;
    for (const p of visiblePts) {
      fmin = Math.min(fmin, p.flux);
      fmax = Math.max(fmax, p.flux);
    }
    const padY = Math.max(0.02, (fmax - fmin) * 0.08);
    const fluxMin = fmin - padY;
    const fluxMax = fmax + padY;
    const iw = w - PAD_LEFT - PAD_RIGHT;
    const ih = h - PAD_TOP - PAD_BOTTOM;
    const xOf = (lam: number) => PAD_LEFT + ((lam - lamMin) / (lamMax - lamMin || 1)) * iw;
    const yOf = (flux: number) => PAD_TOP + ih - ((flux - fluxMin) / (fluxMax - fluxMin || 1)) * ih;
    ctx.fillStyle = "#f0eeeb";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(28, 25, 23, 0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, PAD_TOP);
    ctx.lineTo(PAD_LEFT, PAD_TOP + ih);
    ctx.lineTo(PAD_LEFT + iw, PAD_TOP + ih);
    ctx.stroke();

    const xTicks = 4;
    ctx.fillStyle = "#57534e";
    ctx.font = "10px system-ui,sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i <= xTicks; i++) {
      const lam = lamMin + (i / xTicks) * (lamMax - lamMin);
      const x = xOf(lam);
      ctx.strokeStyle = "rgba(28, 25, 23, 0.08)";
      ctx.beginPath();
      ctx.moveTo(x, PAD_TOP);
      ctx.lineTo(x, PAD_TOP + ih);
      ctx.stroke();

      ctx.strokeStyle = "rgba(28, 25, 23, 0.18)";
      ctx.beginPath();
      ctx.moveTo(x, PAD_TOP + ih);
      ctx.lineTo(x, PAD_TOP + ih + 5);
      ctx.stroke();
      ctx.fillText(`${Math.round(lam)}`, x, h - 12);
    }

    ctx.textAlign = "right";
    for (let i = 0; i <= 3; i++) {
      const flux = fluxMin + (i / 3) * (fluxMax - fluxMin);
      const y = yOf(flux);
      ctx.strokeStyle = "rgba(28, 25, 23, 0.08)";
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, y);
      ctx.lineTo(PAD_LEFT + iw, y);
      ctx.stroke();

      ctx.fillStyle = "#57534e";
      ctx.fillText(flux.toFixed(2), PAD_LEFT - 8, y + 3);
    }

    ctx.save();
    ctx.translate(14, PAD_TOP + ih / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#57534e";
    ctx.font = "11px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Normalized flux", 0, 0);
    ctx.restore();

    ctx.fillStyle = "#57534e";
    ctx.font = "11px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Observed wavelength (Å)", PAD_LEFT + iw / 2, h - 2);

    ctx.beginPath();
    for (let i = 0; i < visiblePts.length; i++) {
      const x = xOf(visiblePts[i].lambdaObs);
      const y = yOf(visiblePts[i].flux);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(41, 37, 36, 0.85)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const lx = xOf(lineLambda);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, PAD_TOP);
    ctx.lineTo(lx, PAD_TOP + ih);
    ctx.stroke();
  }, [visiblePts, lamMin, lamMax, lineLambda]);

  function lambdaFromClientX(clientX: number) {
    const el = canvasRef.current;
    if (!el) return lineLambda;
    const rect = el.getBoundingClientRect();
    const plotLeft = rect.left + (PAD_LEFT / el.width) * rect.width;
    const plotWidth = ((el.width - PAD_LEFT - PAD_RIGHT) / el.width) * rect.width;
    const u = Math.max(0, Math.min(1, (clientX - plotLeft) / plotWidth));
    return lamMin + u * (lamMax - lamMin);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-stone-200 bg-stone-50/90 p-4 md:p-5">
        <h4 className="text-base font-semibold text-stone-900 md:text-lg">How that host-galaxy line becomes a redshift</h4>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-base leading-relaxed text-stone-600 md:text-lg">
          <li>
            <strong className="text-stone-900">Rest wavelength.</strong> In a lab on Earth, the host galaxy&apos;s hydrogen Hα line sits at{" "}
            <span className="font-mono text-stone-800">{HALPHA_REST} Å</span> in the rest frame, so it gives you a fixed ruler for redshift.
          </li>
          <li>
            <strong className="text-stone-900">Cosmic stretch.</strong> Expansion between the host galaxy and us stretches every wavelength by the same factor{" "}
            <span className="font-mono text-stone-800">(1 + z)</span>. So the wavelength we <em>observe</em> is{" "}
            <span className="font-mono text-stone-800">λ<sub>obs</sub> = λ<sub>rest</sub> × (1 + z)</span>.
          </li>
          <li>
            <strong className="text-stone-900">Solve for z.</strong> Rearrange:{" "}
            <span className="font-mono text-stone-800">z = λ<sub>obs</sub> / λ<sub>rest</sub> − 1</span>. Here{" "}
            <span className="font-mono text-stone-800">
              z<sub>meas</sub> = {lineLambda.toFixed(1)} / {HALPHA_REST} − 1 = {stretch.toFixed(4)} − 1
            </span>{" "}
            = <span className="font-mono text-stone-900">{zMeas.toFixed(4)}</span>. So the spectrum is stretched to{" "}
            <span className="font-mono text-stone-800">{stretch.toFixed(3)}×</span> its rest length along the wavelength axis.
          </li>
        </ol>
        <p className="mt-3 text-sm text-stone-500 md:text-base">
          In the paper workflow, the supernova spectrum was mainly used for classification and age-dating, while host-galaxy emission lines often supplied the redshift. This plot shows that host-line measurement in a zoomed observed-frame window.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
        <p className="text-base text-stone-600 md:text-lg">
          Drag the vertical line to the <strong className="text-stone-900">host galaxy&apos;s Hα emission spike</strong> (compare to your table after locking).
        </p>
        <canvas
          ref={canvasRef}
          width={640}
          height={220}
          className="w-full max-w-[640px] touch-none rounded-lg border border-stone-200 bg-[#f0eeeb]"
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
        <p className="text-base text-stone-700 md:text-lg">
          Host-galaxy line you marked: <span className="font-mono text-stone-900">{lineLambda.toFixed(1)} Å</span> in the observed frame. That implies z<sub>meas</sub> ={" "}
          <span className="font-mono text-stone-900">{zMeas.toFixed(4)}</span>. The <strong className="text-stone-900">vertical guide</strong> on the Hubble panel tracks this z. After you lock, the final dot still uses the survey’s z<sub>obs</sub> ={" "}
          <span className="font-mono text-stone-800">{sn.z_obs.toFixed(4)}</span>.
        </p>
        <button
          type="button"
          disabled={!ok}
          onClick={() => onLocked(zMeas)}
          className="font-ui w-fit rounded-lg bg-stone-900 px-5 py-2.5 text-base font-semibold text-white shadow hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lock redshift
        </button>
      </div>
    </div>
  );
}
