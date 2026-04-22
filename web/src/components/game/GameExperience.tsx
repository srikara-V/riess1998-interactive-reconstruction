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
import { PsfMatchingAnimation } from "./PsfMatchingAnimation";
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
      <div className="font-ui mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-red-950">
        <p className="font-semibold">Could not load CSV data</p>
        <p className="mt-2 text-sm text-red-900/80">{loadError}</p>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="font-ui px-4 py-8 text-center text-sm text-stone-500 animate-pulse md:px-8">Loading precomputed survey…</div>
    );
  }

  const canFastForward =
    phase !== "welcome" &&
    !ended &&
    currentIndex < bundle.supernovae.length &&
    !(phase === "discovery" && subStep < 1);

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-16 pt-6 md:px-6">
      {canFastForward ? (
        <div className="font-ui mb-4 flex justify-end border-b border-stone-200 pb-3">
          <button
            type="button"
            onClick={plotAllRemainingInstant}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50"
          >
            Plot all remaining points
          </button>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {/* Narrative + interaction */}
      <div className="min-w-0 flex-1 space-y-4">
        {phase === "welcome" ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-xl font-semibold text-stone-900 md:text-2xl">{WELCOME.title}</h2>
            {WELCOME.body.map((p) => (
              <p key={p.slice(0, 24)} className="mt-4 text-base leading-relaxed text-stone-600 md:text-lg">
                {p}
              </p>
            ))}
            <div className="font-ui mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <p className="text-sm text-stone-600 md:text-base">
                Perspective: <strong className="text-stone-900">High-z Supernova Search Team</strong> (Harvard / CfA–led collaboration).
              </p>
              <button
                type="button"
                onClick={startSurvey}
                className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-stone-800"
              >
                Begin step-by-step survey
              </button>
            </div>
          </section>
        ) : null}

        {phase !== "welcome" ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
            <header className="font-ui mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-200 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">High-z pipeline</p>
                <h2 className="mt-1 text-lg font-semibold text-stone-900 md:text-xl">
                  {phase === "discovery" && "Discovery — difference imaging"}
                  {phase === "spectrum" && "Spectroscopy — redshift from features"}
                  {phase === "lightcurve" && "Photometry — standardizing the candle"}
                  {phase === "reveal" && "Hubble diagram update"}
                </h2>
              </div>
              <p className="text-right text-sm text-stone-600">
                Object <span className="font-mono text-stone-900">{sn?.sn_name ?? "—"}</span>
                <span className="block text-xs text-stone-500">
                  {currentIndex + 1} / {bundle.supernovae.length}
                </span>
              </p>
            </header>

            {phase === "discovery" ? (
              <div className="space-y-4">
                {subStep === 0 ? (
                  <article className="rounded-xl border border-stone-100 bg-stone-50/80 p-5 md:p-6">
                    <h3 className="text-lg font-semibold leading-snug text-stone-900 md:text-xl">{DISCOVERY[0].title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-stone-600 md:text-lg">{DISCOVERY[0].body}</p>
                    <div className="mt-6 border-t border-stone-200 pt-6">
                      <h3 className="text-lg font-semibold leading-snug text-stone-900 md:text-xl">{DISCOVERY[1].title}</h3>
                      <p className="mt-3 text-base leading-relaxed text-stone-600 md:text-lg">{DISCOVERY[1].body}</p>
                      <div className="mt-5">
                        <PsfMatchingAnimation />
                      </div>
                    </div>
                  </article>
                ) : (
                  <>
                    <article className="rounded-xl border border-stone-100 bg-stone-50/80 p-5 md:p-6">
                      <h3 className="text-lg font-semibold leading-snug text-stone-900 md:text-xl">{DISCOVERY[2].title}</h3>
                      <p className="mt-3 text-base leading-relaxed text-stone-600 md:text-lg">{DISCOVERY[2].body}</p>
                    </article>
                    <DiscoveryInteractive
                      snName={sn!.sn_name}
                      mApparent={sn!.m_apparent}
                      onFound={() => {
                        showToast("Transient confirmed — queue spectrum.");
                        setSubStep(0);
                        setPhase("spectrum");
                      }}
                    />
                  </>
                )}
                {subStep === 0 ? (
                  <button
                    type="button"
                    onClick={() => setSubStep(1)}
                    className="font-ui rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50"
                  >
                    Next
                  </button>
                ) : (
                  <p className="text-xs text-stone-500">Click the residual point source in the Difference panel to continue.</p>
                )}
              </div>
            ) : null}

            {phase === "spectrum" ? (
              <div className="space-y-4">
                <article className="rounded-xl border border-stone-100 bg-stone-50/80 p-5 md:p-6">
                  <h3 className="text-lg font-semibold leading-snug text-stone-900 md:text-xl">{SPECTRUM[subStep].title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-stone-600 md:text-lg">{SPECTRUM[subStep].body}</p>
                </article>
                {subStep === 1 ? <SpectrumHalphaDiagram /> : null}
                {subStep === 0 ? (
                  <button
                    type="button"
                    onClick={() => setSubStep(1)}
                    className="font-ui rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-base font-medium text-stone-800 shadow-sm hover:bg-stone-50"
                  >
                    Next
                  </button>
                ) : null}
                {subStep === 1 ? (
                  <button
                    type="button"
                    onClick={() => setSubStep(2)}
                    className="font-ui rounded-lg bg-stone-900 px-5 py-2.5 text-base font-semibold text-white shadow hover:bg-stone-800"
                  >
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
                <article className="rounded-xl border border-stone-100 bg-stone-50/80 p-5 md:p-6">
                  <h3 className="text-lg font-semibold leading-snug text-stone-900 md:text-xl">{LIGHTCURVE[subStep].title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-stone-600 md:text-lg">{LIGHTCURVE[subStep].body}</p>
                </article>
                {subStep === 0 ? (
                  <button
                    type="button"
                    onClick={() => setSubStep(1)}
                    className="font-ui rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-base font-medium text-stone-800 shadow-sm hover:bg-stone-50"
                  >
                    Next
                  </button>
                ) : null}
                {subStep === 1 && sn ? <LightcurveModulusIntro sn={sn} /> : null}
                {subStep === 1 ? (
                  <button
                    type="button"
                    onClick={() => setSubStep(2)}
                    className="font-ui rounded-lg bg-stone-900 px-5 py-2.5 text-base font-semibold text-white shadow hover:bg-stone-800"
                  >
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
              <p className="text-sm text-stone-600">Plotting precomputed μ_obs vs z_obs with error bars…</p>
            ) : null}
        </section>
        ) : null}

        {guessPrompted ? (
          <button
            type="button"
            className="font-ui rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50"
            onClick={() => guessChiSn && setGuessOpen(true)}
          >
            Open cosmology guess panel
          </button>
        ) : null}
      </div>

      {/* Sticky Hubble column */}
      <div className="w-full shrink-0 md:w-[min(440px,38vw)] md:sticky md:top-4">
        {sn && (hubbleGuide.z != null || hubbleGuide.mu != null) ? (
          <div className="font-ui mb-2 rounded-lg border border-stone-200 bg-stone-100/90 p-3 font-mono text-[11px] leading-relaxed text-stone-700">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500">Notebook — this supernova on the diagram</div>
            {hubbleGuide.z != null ? (
              <div>
                <span className="text-stone-500">x-axis:</span> z<sub>meas</sub> = {hubbleGuide.z.toFixed(4)} → horizontal position on log-scaled z
              </div>
            ) : null}
            {hubbleGuide.mu != null ? (
              <div>
                <span className="text-stone-500">y-axis:</span> μ ≈ m − M = {sn.m_apparent.toFixed(2)} − ({M_REF}) = {hubbleGuide.mu.toFixed(2)} mag
              </div>
            ) : null}
            <div className="mt-2 border-t border-stone-200 pt-2 text-stone-600">
              Plotted after “Add to Hubble diagram”: <span className="font-mono text-stone-900">(z_obs, μ_obs)</span> = ({sn.z_obs.toFixed(4)}, {sn.mu_obs.toFixed(2)}) with σ<sub>μ</sub> ={" "}
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
        <div className="font-ui fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-[2px]">
          <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-stone-900">Which cosmology matches the data?</h3>
            <p className="mt-2 text-xs text-stone-600">Cumulative χ² after last completed supernova (lower is better).</p>
            <pre className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-[11px] leading-relaxed text-stone-800">
              χ² EdS: {guessChiSn.cumchi2_EdS_after_this_sequence.toFixed(2)}
              {"\n"}χ² open: {guessChiSn.cumchi2_open_matter_after_this_sequence.toFixed(2)}
              {"\n"}χ² flat ΛCDM: {guessChiSn.cumchi2_flat_LCDM_after_this_sequence.toFixed(2)}
            </pre>
            <div className="mt-4 flex flex-col gap-2">
              <button
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-50"
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
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-50"
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
                className="rounded-lg bg-stone-900 px-3 py-2 text-left text-sm font-semibold text-white hover:bg-stone-800"
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
        <div className="font-ui fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 p-4 backdrop-blur-[2px]">
          <div className="max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-stone-900">What they found was neither…</h3>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              The distant supernovae are brighter than either decelerating curve predicts at high redshift. Together with a matter density Ω_m≈0.3 from large-scale structure, a
              cosmological constant Ω_Λ≈0.7 completes the story: spatially flat, currently accelerating expansion.
            </p>
            {finalChiSn ? (
              <pre className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3 text-[11px] text-stone-800">
                Final χ² — EdS: {finalChiSn.cumchi2_EdS_after_this_sequence.toFixed(2)}
                {"\n"}open matter: {finalChiSn.cumchi2_open_matter_after_this_sequence.toFixed(2)}
                {"\n"}flat ΛCDM: {finalChiSn.cumchi2_flat_LCDM_after_this_sequence.toFixed(2)}
              </pre>
            ) : null}
            <p className="mt-2 text-xs text-stone-500">{endReason}</p>
            <button
              type="button"
              className="mt-6 rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
              onClick={() => location.reload()}
            >
              Play again
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="font-ui fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-stone-200 bg-white px-5 py-2.5 text-sm text-stone-800 shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
