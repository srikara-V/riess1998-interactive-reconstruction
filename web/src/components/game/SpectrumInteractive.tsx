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

  const { lamMin, lamMax, mid } = useMemo(() => {
    const lo = pts[0].lambdaObs;
    const hi = pts[pts.length - 1].lambdaObs;
    return { lamMin: lo, lamMax: hi, mid: (lo + hi) / 2 };
  }, [pts]);

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
    for (const p of pts) {
      fmin = Math.min(fmin, p.flux);
      fmax = Math.max(fmax, p.flux);
    }
    const pad = 16;
    const iw = w - pad * 2;
    const ih = h - pad * 2;
    ctx.fillStyle = "#f0eeeb";
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = pad + ((pts[i].lambdaObs - lamMin) / (lamMax - lamMin)) * iw;
      const y = pad + ih - ((pts[i].flux - fmin) / (fmax - fmin || 1)) * ih;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(41, 37, 36, 0.85)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const lx = pad + ((lineLambda - lamMin) / (lamMax - lamMin)) * iw;
    ctx.strokeStyle = "#2563eb";
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
      <p className="text-base text-stone-600 md:text-lg">
        Drag the vertical line to the <strong className="text-stone-900">peak of the Hα emission spike</strong> (compare to your table after locking).
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
        Line you marked: <span className="font-mono text-stone-900">{lineLambda.toFixed(1)} Å</span> (observed in the telescope). That implies z<sub>meas</sub> ={" "}
        <span className="font-mono text-stone-900">{zMeas.toFixed(4)}</span> using the steps below. The{" "}
        <strong className="text-stone-900">vertical guide</strong> on the Hubble panel tracks this z. After you lock, the final dot still uses the survey’s z<sub>obs</sub> ={" "}
        <span className="font-mono text-stone-800">{sn.z_obs.toFixed(4)}</span>.
      </p>

      <div className="rounded-xl border border-stone-200 bg-stone-50/90 p-4 md:p-5">
        <h4 className="text-base font-semibold text-stone-900 md:text-lg">How that Ångström value becomes a redshift</h4>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-base leading-relaxed text-stone-600 md:text-lg">
          <li>
            <strong className="text-stone-900">Rest wavelength.</strong> In a lab on Earth, the hydrogen Hα line we are matching sits at{" "}
            <span className="font-mono text-stone-800">{HALPHA_REST} Å</span> in the rest frame (this walkthrough fixes that value so everyone uses the same ruler).
          </li>
          <li>
            <strong className="text-stone-900">Cosmic stretch.</strong> Expansion between the supernova and us stretches every wavelength by the same factor{" "}
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
          Intuition: if the spike were exactly at {HALPHA_REST} Å, you would have z = 0 (no stretch). The farther the peak slides to the right, the larger (1 + z) is, and the farther away / deeper in cosmic time the supernova is.
        </p>
      </div>

      <button
        type="button"
        disabled={!ok}
        onClick={() => onLocked(zMeas)}
        className="font-ui rounded-lg bg-stone-900 px-5 py-2.5 text-base font-semibold text-white shadow hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Lock redshift
      </button>
    </div>
  );
}
