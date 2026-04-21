"use client";

const W0 = 72;
const W1 = 448;
const PLOT_H = 50;

/** Top edge of pseudo-flux curve (lower y = more flux / brighter upward in spectrum convention — here we just show a dip curve). */
function spectrumTopPath(scale: number, y0: number): string {
  const parts: string[] = [];
  const steps = 56;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const lamObs = W0 + u * (W1 - W0);
    const restLam = lamObs / scale;
    let flux = 1;
    for (const center of [3934, 3968]) {
      const d = (restLam - center) / 16;
      flux -= 0.44 * Math.exp(-d * d);
    }
    flux = Math.max(0.1, flux);
    const x = lamObs;
    const y = y0 + (1 - flux) * PLOT_H;
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(" ");
}

/**
 * Schematic: Ca II K & H pair at rest vs the same pattern stretched along wavelength
 * (cosmic expansion). Redshift is read from that stretch.
 */
export function SpectrumCa2Diagram() {
  const yRest = 36;
  const yObs = 124;
  const restPath = spectrumTopPath(1, yRest);
  const obsPath = spectrumTopPath(1.38, yObs);

  return (
    <figure className="rounded-xl border border-sky-500/20 bg-slate-950/90 p-5 shadow-inner">
      <figcaption className="mb-4 text-center text-base font-semibold text-slate-200 md:text-lg">
        Calcium II (Ca II) — the paired dips astronomers use as a ruler
      </figcaption>
      <svg viewBox="0 0 520 210" className="mx-auto h-auto w-full max-w-[520px]" role="img" aria-label="Schematic Ca II spectrum at rest and stretched by redshift">
        <defs>
          <linearGradient id="ca2fillRest" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(56, 189, 248)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="rgb(125, 211, 252)" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <text x="260" y="16" textAnchor="middle" fill="rgb(148,163,184)" style={{ font: "12px system-ui, sans-serif" }}>
          Brightness vs wavelength (schematic only, not real data)
        </text>

        <text x="12" y="30" fill="rgb(226,232,240)" style={{ font: "bold 11px system-ui, sans-serif" }}>
          Rest frame (pattern “at birth”)
        </text>
        <path
          d={`${restPath} L ${W1} ${yRest + PLOT_H} L ${W0} ${yRest + PLOT_H} Z`}
          fill="url(#ca2fillRest)"
          stroke="rgb(125,211,252)"
          strokeWidth="1.2"
        />
        <line x1={W0} y1={yRest + PLOT_H} x2={W1} y2={yRest + PLOT_H} stroke="rgb(71,85,105)" strokeWidth="1" />
        <text x="260" y={yRest + PLOT_H + 14} textAnchor="middle" fill="rgb(100,116,139)" style={{ font: "10px system-ui, sans-serif" }}>
          two dips from calcium — distance between them is a cosmic constant
        </text>

        <polygon points="258,92 262,92 260,104" fill="rgb(251,191,36)" />
        <text x="268" y="100" fill="rgb(253,224,71)" style={{ font: "bold 11px system-ui, sans-serif" }}>
          expanding universe slides features to the right
        </text>

        <text x="12" y="118" fill="rgb(226,232,240)" style={{ font: "bold 11px system-ui, sans-serif" }}>
          Telescope (stretched / redshifted)
        </text>
        <path
          d={`${obsPath} L ${W1} ${yObs + PLOT_H} L ${W0} ${yObs + PLOT_H} Z`}
          fill="rgba(251,191,36,0.14)"
          stroke="rgb(251,191,36)"
          strokeWidth="1.2"
        />
        <line x1={W0} y1={yObs + PLOT_H} x2={W1} y2={yObs + PLOT_H} stroke="rgb(71,85,105)" strokeWidth="1" />
        <text x="260" y={yObs + PLOT_H + 14} textAnchor="middle" fill="rgb(100,116,139)" style={{ font: "10px system-ui, sans-serif" }}>
          same fingerprint, shifted — how far it slid gives redshift z
        </text>
      </svg>
      <ul className="mt-4 space-y-3 text-base leading-relaxed text-slate-300 md:text-lg">
        <li>
          <strong className="text-slate-100">Why calcium?</strong> It paints a strong, recognizable pair of notches in the spectrum. Even when everything else looks messy, those two notches are easier to pick out than many other features.
        </li>
        <li>
          <strong className="text-slate-100">Why it is useful:</strong> The gap between the notches never changes in physics. So if you recognize the pair but notice it has slid toward redder / longer wavelengths, you have a clean handle on how much the light was stretched in flight — that stretch is tied to distance in the cosmology story you are exploring next.
        </li>
      </ul>
    </figure>
  );
}
