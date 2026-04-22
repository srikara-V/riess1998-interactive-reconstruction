"use client";

import { useEffect, useState } from "react";

function Spot({ x, y, sigma, color }: { x: number; y: number; sigma: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={sigma * 2.5} fill={color} opacity={0.06} />
      <circle cx={x} cy={y} r={sigma * 1.7} fill={color} opacity={0.12} />
      <circle cx={x} cy={y} r={sigma} fill={color} opacity={0.2} />
      <circle cx={x} cy={y} r={Math.max(1.8, sigma * 0.34)} fill={color} opacity={0.95} />
    </g>
  );
}

function Profile({ x0, y0, sigma }: { x0: number; y0: number; sigma: number }) {
  const pts: string[] = [];
  for (let i = -120; i <= 120; i += 3) {
    const x = x0 + i;
    const u = i / (sigma * 3.1);
    const wiggle = 2.8 * Math.sin((i + 70) / 8) * Math.exp(-Math.abs(i) / 95);
    const y = y0 - 112 * Math.exp(-0.5 * u * u) - wiggle;
    pts.push(`${x},${y.toFixed(2)}`);
  }
  return <polyline points={pts.join(" ")} fill="none" stroke="#d97706" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />;
}

export function PsfMatchingAnimation() {
  const [t, setT] = useState(0);

  useEffect(() => {
    const started = performance.now();
    let frame = 0;

    const tick = () => {
      const elapsed = performance.now() - started;
      setT((elapsed % 3200) / 3200);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const seeing = 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
  const sigma = 10 + seeing * 6.5;
  const widthLabel = sigma < 13.2 ? "narrower PSF" : "broader PSF";

  return (
    <figure className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <figcaption className="font-ui mb-3 text-sm font-semibold text-stone-900">What is a PSF?</figcaption>
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
        <svg viewBox="0 0 420 460" className="mx-auto w-full max-w-[420px]" role="img" aria-label="Simple point spread function diagram with a blurred spot and intensity profile">
          <rect x="0" y="0" width="420" height="460" rx="12" fill="#fafaf9" />

          <g transform="translate(0, 10)">
            <Spot x={210} y={72} sigma={sigma} color="#1c1917" />
            <circle cx="210" cy="72" r="3.5" fill="#fafaf9" opacity="0.95" />

            <line x1="210" y1="94" x2="210" y2="312" stroke="#78716c" strokeWidth="3" strokeDasharray="8 6" />

            <line x1="72" y1="364" x2="350" y2="364" stroke="#44403c" strokeWidth="3" />
            <line x1="72" y1="364" x2="72" y2="162" stroke="#44403c" strokeWidth="3" />

            <Profile x0={210} y0={364} sigma={sigma} />

            <text x="214" y="390" textAnchor="middle" fill="rgb(68,64,60)" style={{ font: "600 14px var(--font-source-sans), ui-sans-serif, sans-serif" }}>
              Position
            </text>
            <text
              x="24"
              y="270"
              transform="rotate(-90 24 270)"
              textAnchor="middle"
              fill="rgb(68,64,60)"
              style={{ font: "600 14px var(--font-source-sans), ui-sans-serif, sans-serif" }}
            >
              Intensity
            </text>

            <text x="210" y="425" textAnchor="middle" fill="rgb(120,53,15)" style={{ font: "600 13px var(--font-source-sans), ui-sans-serif, sans-serif" }}>
              {widthLabel}
            </text>
          </g>
        </svg>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">
        A <span className="font-ui font-medium text-stone-900">point spread function</span> is the brightness shape of a point source in the image.
        The top spot is the 2D image; the orange curve is a 1D slice through its center.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        What it is used for: if one image has a broader PSF than another, astronomers match those widths before subtracting images so ordinary stars cancel cleanly.
      </p>
    </figure>
  );
}
