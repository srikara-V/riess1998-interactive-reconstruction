"use client";

/** Schematic λ axis (Å) for pedagogy — matches game template range. */
const LAM_MIN = 5000;
const LAM_MAX = 11000;
const PLOT_X0 = 56;
const PLOT_X1 = 464;
const PLOT_H = 52;
const Y_BASE_REST = 118;
const Y_BASE_OBS = 206;

function lamToX(lam: number): number {
  return PLOT_X0 + ((lam - LAM_MIN) / (LAM_MAX - LAM_MIN)) * (PLOT_X1 - PLOT_X0);
}

/** Normalized flux with Gaussian emission above continuum (=1). */
function emissionFlux(lam: number, peakA: number, sigmaA = 55): number {
  return 1 + 0.42 * Math.exp(-0.5 * ((lam - peakA) / sigmaA) ** 2);
}

/** Top edge of pseudo-flux curve (smaller y = brighter / higher flux in this SVG). */
function spectrumTopPath(peakObsA: number, yContinuum: number): string {
  const parts: string[] = [];
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const lamObs = LAM_MIN + u * (LAM_MAX - LAM_MIN);
    const flux = emissionFlux(lamObs, peakObsA);
    const x = lamToX(lamObs);
    const y = yContinuum - (flux - 1) * PLOT_H;
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(" ");
}

/**
 * Schematic: Hα emission at 6563 Å in the rest frame vs the same feature redshifted
 * (cosmic expansion). Redshift is read from how far the peak slides along wavelength.
 */
export function SpectrumHalphaDiagram() {
  const peakRest = 6563;
  const peakObsDemo = 9385; // z ≈ 0.43, matching e.g. SN 1996E-style stretch
  const restPath = spectrumTopPath(peakRest, Y_BASE_REST);
  const obsPath = spectrumTopPath(peakObsDemo, Y_BASE_OBS);

  return (
    <figure className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <figcaption className="mb-4 text-center text-base font-semibold text-stone-900 md:text-lg">
        Hydrogen Hα — a bright emission line astronomers use as a ruler
      </figcaption>
      <svg viewBox="0 0 520 240" className="mx-auto h-auto w-full max-w-[520px]" role="img" aria-label="Schematic Hα spectrum at rest and redshifted">
        <defs>
          <linearGradient id="halphaFillRest" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(37, 99, 235)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.22" />
          </linearGradient>
        </defs>
        <rect width="520" height="240" fill="#fafaf9" rx="8" />
        <text x="260" y="16" textAnchor="middle" fill="rgb(87,83,78)" style={{ font: "12px var(--font-source-sans), ui-sans-serif, sans-serif" }}>
          Brightness vs wavelength (schematic only, not real data)
        </text>

        <text x="12" y="34" fill="rgb(28,25,23)" style={{ font: "bold 11px var(--font-source-sans), ui-sans-serif, sans-serif" }}>
          Rest frame (host galaxy “at birth”)
        </text>
        <path
          d={`${restPath} L ${PLOT_X1} ${Y_BASE_REST} L ${PLOT_X0} ${Y_BASE_REST} Z`}
          fill="url(#halphaFillRest)"
          stroke="rgb(37, 99, 235)"
          strokeWidth="1.2"
        />
        <line x1={PLOT_X0} y1={Y_BASE_REST} x2={PLOT_X1} y2={Y_BASE_REST} stroke="rgb(168, 162, 158)" strokeWidth="1" />
        <text x="260" y={Y_BASE_REST + 14} textAnchor="middle" fill="rgb(87,83,78)" style={{ font: "10px var(--font-source-sans), sans-serif" }}>
          emission spike at 6563 Å — rest wavelength of hydrogen Hα
        </text>

        <polygon points="258,92 262,92 260,104" fill="rgb(180, 83, 9)" />
        <text x="268" y="100" fill="rgb(120, 53, 15)" style={{ font: "bold 11px var(--font-source-sans), sans-serif" }}>
          expanding universe slides the peak to longer λ
        </text>

        <text x="12" y="152" fill="rgb(28,25,23)" style={{ font: "bold 11px var(--font-source-sans), sans-serif" }}>
          Telescope (redshifted)
        </text>
        <path
          d={`${obsPath} L ${PLOT_X1} ${Y_BASE_OBS} L ${PLOT_X0} ${Y_BASE_OBS} Z`}
          fill="rgba(180, 83, 9, 0.12)"
          stroke="rgb(180, 83, 9)"
          strokeWidth="1.2"
        />
        <line x1={PLOT_X0} y1={Y_BASE_OBS} x2={PLOT_X1} y2={Y_BASE_OBS} stroke="rgb(168, 162, 158)" strokeWidth="1" />
        <text x="260" y={Y_BASE_OBS + 14} textAnchor="middle" fill="rgb(87,83,78)" style={{ font: "10px var(--font-source-sans), sans-serif" }}>
          same line, stretched — measure Δλ to get z (example peak near 9385 Å for z ≈ 0.43)
        </text>

        <text x={PLOT_X0} y="228" fill="rgb(87,83,78)" style={{ font: "10px var(--font-source-sans), sans-serif" }}>
          {LAM_MIN} Å
        </text>
        <text x={PLOT_X1} y="228" textAnchor="end" fill="rgb(87,83,78)" style={{ font: "10px var(--font-source-sans), sans-serif" }}>
          {LAM_MAX} Å
        </text>
      </svg>
      <ul className="mt-4 space-y-3 text-base leading-relaxed text-stone-600 md:text-lg">
        <li>
          <strong className="text-stone-900">Why hydrogen?</strong> Ionized gas in the host galaxy produces a strong Hα emission line at a well-known rest wavelength (6563 Å). It stands out above the continuum and is easy to recognize when cleaning noisy spectra.
        </li>
        <li>
          <strong className="text-stone-900">Why it is useful:</strong> That rest wavelength is fixed in physics. If the line appears redder than 6563 Å, cosmic expansion stretched the whole spectrum in flight — and the factor (1 + z) you read off the wavelength axis is exactly what you need for the Hubble diagram step.
        </li>
      </ul>
    </figure>
  );
}
