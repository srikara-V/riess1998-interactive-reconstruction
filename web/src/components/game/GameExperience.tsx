"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DISCOVERY, LIGHTCURVE, SPECTRUM, WELCOME } from "@/content/pipelineNarrative";
import { M_REF } from "@/lib/gameMath";
import { loadGameBundle } from "@/lib/loadGameData";
import type { GameBundle, Observation, SupernovaRow } from "@/lib/types";
import { DiscoveryInteractive } from "./DiscoveryInteractive";
import { HubbleDualPanel } from "./HubbleDualPanel";
import { LightcurveInteractive } from "./LightcurveInteractive";
import { LightcurveModulusIntro } from "./LightcurveModulusIntro";
import { SpectrumHalphaDiagram } from "./SpectrumHalphaDiagram";
import { SpectrumInteractive } from "./SpectrumInteractive";

type Phase = "welcome" | "discovery" | "spectrum" | "lightcurve" | "reveal";
export function GameExperience() {
  const [bundle, setBundle] = useState<GameBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [subStep, setSubStep] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [guessPrompted, setGuessPrompted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [highlightLCDM, setHighlightLCDM] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [guessOpen, setGuessOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [endReason, setEndReason] = useState("");
  /** Live Hubble diagram construction guides for the current supernova. */
  const [hubbleGuide, setHubbleGuide] = useState<{ z: number | null; mu: number | null }>({ z: null, mu: null });

  useEffect(() => {
    loadGameBundle()
      .then(setBundle)
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  const sn = bundle?.supernovae[currentIndex];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const appendObservation = useCallback(
    (s: SupernovaRow) => {
      setObservations((prev) => [
        ...prev,
        {
          z_obs: s.z_obs,
          mu_obs: s.mu_obs,
          sigma_mu: s.sigma_mu,
          residual: s.residual_obs_minus_open_matter_at_z_obs,
          flash: true,
        },
      ]);
      setTimeout(() => {
        setObservations((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last) last.flash = false;
          return next;
        });
      }, 900);
    },
    [setObservations],
  );

  const revealAllRemaining = useCallback(() => {
    if (!bundle) return;
    setHubbleGuide({ z: null, mu: null });
    let delay = 0;
    for (let i = currentIndex; i < bundle.supernovae.length; i++) {
      const s = bundle.supernovae[i];
      setTimeout(() => {
        appendObservation(s);
      }, delay);
      delay += 40;
    }
    setCurrentIndex(bundle.supernovae.length);
  }, [appendObservation, bundle, currentIndex]);

  /** One-shot append of every SN from currentIndex onward (same data as normal reveals). */
  const plotAllRemainingInstant = useCallback(() => {
    if (!bundle || ended || currentIndex >= bundle.supernovae.length) return;
    setHubbleGuide({ z: null, mu: null });
    const rows: Observation[] = bundle.supernovae.slice(currentIndex).map((s) => ({
      z_obs: s.z_obs,
      mu_obs: s.mu_obs,
      sigma_mu: s.sigma_mu,
      residual: s.residual_obs_minus_open_matter_at_z_obs,
      flash: false,
    }));
    setObservations((prev) => [...prev, ...rows]);
    setCurrentIndex(bundle.supernovae.length);
    setGuessOpen(false);
    setEnded(true);
    setHighlightLCDM(true);
    setPhase("reveal");
    setEndReason("Fast-forward: every precomputed (z_obs, μ_obs) point is now on the diagram.");
    setEndOpen(true);
    showToast("Full sample plotted.");
  }, [bundle, currentIndex, ended, showToast]);

  const startSurvey = () => {
    setHubbleGuide({ z: null, mu: null });
    setPhase("discovery");
    setSubStep(0);
  };

  const onZMeasFromSpectrum = useCallback((z: number) => {
    if (phase !== "spectrum" || subStep !== 2) return;
    setHubbleGuide((g) => ({ ...g, z }));
  }, [phase, subStep]);

  const onPlotReveal = () => {
    if (!bundle || !sn) return;
    appendObservation(sn);
    setTimeout(() => setHubbleGuide({ z: null, mu: null }), 400);
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    const paused = (() => {
      if (guessPrompted || ended) return false;
      if (nextIndex < 1) return false;
      const prev = bundle.supernovae[nextIndex - 1];
      const chiLc = prev.cumchi2_flat_LCDM_after_this_sequence;
      const chiOp = prev.cumchi2_open_matter_after_this_sequence;
      const chiEd = prev.cumchi2_EdS_after_this_sequence;
      const lcdmWin = chiLc < chiOp && chiLc < chiEd;
      const enough = nextIndex >= 20;
      if (lcdmWin && enough) {
        setGuessPrompted(true);
        setGuessOpen(true);
        return true;
      }
      return false;
    })();

    setPhase("reveal");
    setTimeout(() => {
      if (ended) return;
      if (paused) return;
      if (nextIndex >= bundle.supernovae.length) {
        setEnded(true);
        setHighlightLCDM(true);
        setEndReason("You completed the full sample.");
        setEndOpen(true);
        return;
      }
      setHubbleGuide({ z: null, mu: null });
      setPhase("discovery");
      setSubStep(0);
    }, 1100);
  };

  const guessChiSn = useMemo(() => {
    if (!bundle || currentIndex < 1) return null;
    return bundle.supernovae[currentIndex - 1];
  }, [bundle, currentIndex]);

  const finalChiSn = bundle?.supernovae[bundle.supernovae.length - 1] ?? null;

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-500/30 bg-red-950/40 p-6 text-red-100">
        <p className="font-semibold">Could not load CSV data</p>
        <p className="mt-2 text-sm opacity-90">{loadError}</p>
      </div>
    );
  }

  if (!bundle) {
    return <div className="animate-pulse text-slate-400">Loading precomputed survey…</div>;
  }

  const canFastForward = phase !== "welcome" && !ended && currentIndex < bundle.supernovae.length;

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-16 pt-4">
      {canFastForward ? (
        <div className="mb-3 flex justify-end border-b border-white/5 pb-3">
          <button
            type="button"
            onClick={plotAllRemainingInstant}
            className="rounded-lg border border-amber-400/35 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/70"
          >
            Plot all remaining points
          </button>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {/* Narrative + interaction */}
      <div className="min-w-0 flex-1 space-y-4">
        {phase === "welcome" ? (
          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-sky-200">{WELCOME.title}</h2>
            {WELCOME.body.map((p) => (
              <p key={p.slice(0, 24)} className="mt-3 text-sm leading-relaxed text-slate-300">
                {p}
              </p>
            ))}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-400">
                Perspective: <strong className="text-slate-200">High-z Supernova Search Team</strong> (Harvard / CfA–led collaboration).
              </p>
              <button type="button" onClick={startSurvey} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">
                Begin step-by-step survey
              </button>
            </div>
          </section>
        ) : null}

        {phase !== "welcome" ? (
          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl">
            <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">High-z pipeline</p>
                <h2 className="text-lg font-semibold text-sky-200">
                  {phase === "discovery" && "Discovery — difference imaging"}
                  {phase === "spectrum" && "Spectroscopy — redshift from features"}
                  {phase === "lightcurve" && "Photometry — standardizing the candle"}
                  {phase === "reveal" && "Hubble diagram update"}
                </h2>
              </div>
              <p className="text-right text-sm text-slate-400">
                Object <span className="font-mono text-slate-200">{sn?.sn_name ?? "—"}</span>
                <span className="block text-xs text-slate-500">
                  {currentIndex + 1} / {bundle.supernovae.length}
                </span>
              </p>
            </header>

            {phase === "discovery" ? (
              <div className="space-y-4">
                <article className="rounded-xl bg-slate-950/60 p-5 md:p-6">
                  <h3 className="text-lg font-semibold leading-snug text-slate-100 md:text-xl">{DISCOVERY[subStep].title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-slate-300 md:text-lg">{DISCOVERY[subStep].body}</p>
                </article>
                {subStep === 2 ? (
                  <DiscoveryInteractive
                    snName={sn!.sn_name}
                    mApparent={sn!.m_apparent}
                    onFound={() => {
                      showToast("Transient confirmed — queue spectrum.");
                      setSubStep(0);
                      setPhase("spectrum");
                    }}
                  />
                ) : null}
                {subStep < 2 ? (
                  <button
                    type="button"
                    onClick={() => setSubStep((s) => Math.min(2, s + 1))}
                    className="rounded-lg border border-white/15 bg-slate-800 px-4 py-2 text-sm"
                  >
                    Next
                  </button>
                ) : (
                  <p className="text-xs text-slate-500">Click the residual point source in the Difference panel to continue.</p>
                )}
              </div>
            ) : null}

            {phase === "spectrum" ? (
              <div className="space-y-4">
                <article className="rounded-xl bg-slate-950/60 p-5 md:p-6">
                  <h3 className="text-lg font-semibold leading-snug text-slate-100 md:text-xl">{SPECTRUM[subStep].title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-slate-300 md:text-lg">{SPECTRUM[subStep].body}</p>
                </article>
                {subStep === 1 ? <SpectrumHalphaDiagram /> : null}
                {subStep === 0 ? (
                  <button type="button" onClick={() => setSubStep(1)} className="rounded-lg border border-white/15 bg-slate-800 px-5 py-2.5 text-base">
                    Next
                  </button>
                ) : null}
                {subStep === 1 ? (
                  <button type="button" onClick={() => setSubStep(2)} className="rounded-lg bg-sky-700 px-5 py-2.5 text-base font-medium text-white">
                    Open spectrum tool
                  </button>
                ) : null}
                {subStep === 2 ? (
                  <SpectrumInteractive
                    key={sn!.sn_name}
                    sn={sn!}
                    specTemplate={bundle.specTemplate}
                    onZMeasChange={onZMeasFromSpectrum}
                    onLocked={(zMeas) => {
                      setHubbleGuide((g) => ({ ...g, z: zMeas }));
                      showToast("z recorded — begin light curve monitoring.");
                      setSubStep(0);
                      setPhase("lightcurve");
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            {phase === "lightcurve" ? (
              <div className="space-y-4">
                <article className="rounded-xl bg-slate-950/60 p-5 md:p-6">
                  <h3 className="text-lg font-semibold leading-snug text-slate-100 md:text-xl">{LIGHTCURVE[subStep].title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-slate-300 md:text-lg">{LIGHTCURVE[subStep].body}</p>
                </article>
                {subStep === 0 ? (
                  <button type="button" onClick={() => setSubStep(1)} className="rounded-lg border border-white/15 bg-slate-800 px-5 py-2.5 text-base">
                    Next
                  </button>
                ) : null}
                {subStep === 1 && sn ? <LightcurveModulusIntro sn={sn} /> : null}
                {subStep === 1 ? (
                  <button type="button" onClick={() => setSubStep(2)} className="rounded-lg bg-sky-700 px-5 py-2.5 text-base font-medium text-white">
                    Open light-curve tool
                  </button>
                ) : null}
                {subStep === 2 ? (
                  <LightcurveInteractive
                    key={sn!.sn_name}
                    sn={sn!}
                    lcTemplate={bundle.lcTemplate}
                    onPeakRead={({ muFromM }) => setHubbleGuide((g) => ({ ...g, mu: muFromM }))}
                    onContinue={() => onPlotReveal()}
                  />
                ) : null}
              </div>
            ) : null}

            {phase === "reveal" ? (
              <p className="text-sm text-slate-300">Plotting precomputed μ_obs vs z_obs with error bars…</p>
            ) : null}
          </section>
        ) : null}

        {guessPrompted ? (
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-slate-800 px-3 py-2 text-sm text-slate-200"
            onClick={() => guessChiSn && setGuessOpen(true)}
          >
            Open cosmology guess panel
          </button>
        ) : null}
      </div>

      {/* Sticky Hubble column */}
      <div className="w-full shrink-0 md:w-[min(440px,38vw)] md:sticky md:top-4">
        {sn && (hubbleGuide.z != null || hubbleGuide.mu != null) ? (
          <div className="mb-2 rounded-lg border border-sky-500/25 bg-slate-900/90 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-sky-400/90">Notebook — this supernova on the diagram</div>
            {hubbleGuide.z != null ? (
              <div>
                <span className="text-slate-500">x-axis:</span> z<sub>meas</sub> = {hubbleGuide.z.toFixed(4)} → horizontal position on log-scaled z
              </div>
            ) : null}
            {hubbleGuide.mu != null ? (
              <div>
                <span className="text-slate-500">y-axis:</span> μ ≈ m − M = {sn.m_apparent.toFixed(2)} − ({M_REF}) = {hubbleGuide.mu.toFixed(2)} mag
              </div>
            ) : null}
            <div className="mt-2 border-t border-white/10 pt-2 text-slate-500">
              Plotted after “Add to Hubble diagram”: <span className="font-mono text-slate-300">(z_obs, μ_obs)</span> = ({sn.z_obs.toFixed(4)}, {sn.mu_obs.toFixed(2)}) with σ<sub>μ</sub> ={" "}
              {sn.sigma_mu.toFixed(2)} (precomputed survey values).
            </div>
          </div>
        ) : null}
        <HubbleDualPanel
          curves={bundle.curves}
          observations={observations}
          highlightLCDM={highlightLCDM}
          previewZ={hubbleGuide.z}
          previewMu={hubbleGuide.mu}
        />
      </div>
      </div>

      {guessOpen && guessChiSn ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-sky-200">Which cosmology matches the data?</h3>
            <p className="mt-2 text-xs text-slate-400">Cumulative χ² after last completed supernova (lower is better).</p>
            <pre className="mt-3 rounded-lg bg-black/50 p-3 text-[11px] leading-relaxed text-slate-300">
              χ² EdS: {guessChiSn.cumchi2_EdS_after_this_sequence.toFixed(2)}
              {"\n"}χ² open: {guessChiSn.cumchi2_open_matter_after_this_sequence.toFixed(2)}
              {"\n"}χ² flat ΛCDM: {guessChiSn.cumchi2_flat_LCDM_after_this_sequence.toFixed(2)}
            </pre>
            <div className="mt-4 flex flex-col gap-2">
              <button
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-left text-sm"
                onClick={() => {
                  setGuessOpen(false);
                  showToast("Keep going — decelerating models stay low at high z.");
                  if (currentIndex < bundle.supernovae.length) {
                    setHubbleGuide({ z: null, mu: null });
                    setPhase("discovery");
                    setSubStep(0);
                  }
                }}
              >
                Ω_m=1, Ω_Λ=0 — rapid deceleration
              </button>
              <button
                className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-left text-sm"
                onClick={() => {
                  setGuessOpen(false);
                  showToast("Still not enough — look at z≳0.3 residuals.");
                  if (currentIndex < bundle.supernovae.length) {
                    setHubbleGuide({ z: null, mu: null });
                    setPhase("discovery");
                    setSubStep(0);
                  }
                }}
              >
                Ω_m=0.3, Ω_Λ=0 — gentle deceleration
              </button>
              <button
                className="rounded-lg bg-sky-600 px-3 py-2 text-left text-sm font-semibold text-white"
                onClick={() => {
                  setGuessOpen(false);
                  setEnded(true);
                  setHighlightLCDM(true);
                  revealAllRemaining();
                  setEndReason("Accelerating universe (Ω_Λ≈0.7) matches the ensemble.");
                  setEndOpen(true);
                }}
              >
                Ω_m=0.3, Ω_Λ=0.7 — acceleration / dark energy
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {endOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-sky-200">What they found was neither…</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              The distant supernovae are brighter than either decelerating curve predicts at high redshift. Together with a matter density Ω_m≈0.3 from large-scale structure, a
              cosmological constant Ω_Λ≈0.7 completes the story: spatially flat, currently accelerating expansion.
            </p>
            {finalChiSn ? (
              <pre className="mt-4 rounded-lg bg-black/50 p-3 text-[11px] text-slate-300">
                Final χ² — EdS: {finalChiSn.cumchi2_EdS_after_this_sequence.toFixed(2)}
                {"\n"}open matter: {finalChiSn.cumchi2_open_matter_after_this_sequence.toFixed(2)}
                {"\n"}flat ΛCDM: {finalChiSn.cumchi2_flat_LCDM_after_this_sequence.toFixed(2)}
              </pre>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">{endReason}</p>
            <button type="button" className="mt-6 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => location.reload()}>
              Play again
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-sm text-slate-100 shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
