"use client";

import { M_REF } from "@/lib/gameMath";
import type { SupernovaRow } from "@/lib/types";

type Props = { sn: SupernovaRow };

/**
 * Step-by-step distance-modulus idea for the screen *before* opening the light-curve tool.
 */
export function LightcurveModulusIntro({ sn }: Props) {
  const m = sn.m_apparent;
  const mu = m - M_REF;
  const mStr = m.toFixed(2);
  const muStr = mu.toFixed(2);

  return (
    <div className="space-y-5 rounded-xl border border-amber-500/15 bg-slate-950/80 p-5 md:p-6">
      <section>
        <h4 className="text-base font-semibold text-amber-200/95 md:text-lg">1 · Brightness numbers run backwards</h4>
        <p className="mt-2 text-base leading-relaxed text-slate-300 md:text-lg">
          In astronomy, <strong className="text-slate-100">magnitude m counts “how bright it looks,” but bigger m means fainter</strong> — the opposite of what feels natural. A star at magnitude 22 is much dimmer than one at magnitude 20. Say that out loud once; everything below assumes you remember it.
        </p>
      </section>

      <section>
        <h4 className="text-base font-semibold text-amber-200/95 md:text-lg">2 · Type Ia supernovae are “identical lightbulbs”</h4>
        <p className="mt-2 text-base leading-relaxed text-slate-300 md:text-lg">
          Picture two lightbulbs of the <em>same</em> wattage. If one looks brighter, it can only be because it is <strong className="text-slate-100">closer</strong>. Type Ia explosions are used the same way: they are treated as having the same intrinsic power (after the standardization story you already heard in broad terms). So once you trust the type, <strong className="text-slate-100">how faint it appears in your telescope is mostly telling you distance</strong>.
        </p>
      </section>

      <section>
        <h4 className="text-base font-semibold text-amber-200/95 md:text-lg">3 · What m, M, and μ mean</h4>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-base leading-relaxed text-slate-300 md:text-lg">
          <li>
            <strong className="text-slate-100">m</strong> is <strong className="text-slate-100">apparent</strong> magnitude at the <strong className="text-slate-100">peak only</strong> — one brightness for “how bright did the same explosion look when it was hottest?” The plot will show <strong className="text-slate-100">many white dots</strong>: those are <strong className="text-slate-100">many different nights</strong> of watching the <em>same</em> supernova so you can see the full rise and fall and fit a template. Only the peak night supplies the m that enters <span className="font-mono text-slate-200">μ = m − M</span> (here the table already lists that peak as{" "}
            <span className="font-mono text-sky-200/90">m = {mStr}</span>).
          </li>
          <li>
            <strong className="text-slate-100">M</strong> is <strong className="text-slate-100">absolute</strong> magnitude — how bright the same explosion would look if you parked it at a standard distance (10 parsecs). For this walkthrough every Type Ia uses the same fiducial{" "}
            <span className="font-mono text-sky-200/90">M = {M_REF}</span> — that is the shared “wattage” of the lightbulb.
          </li>
          <li>
            The <strong className="text-slate-100">distance modulus</strong>{" "}
            <span className="font-mono text-slate-200">μ = m − M</span> is just the gap between those two: how much fainter it is than it would be up close.{" "}
            <strong className="text-slate-100">Larger μ means farther away</strong> (more dimming from distance).
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-sky-500/25 bg-sky-950/30 p-4 md:p-5">
        <h4 className="text-base font-semibold text-sky-200 md:text-lg">4 · Punchline for this object ({sn.sn_name})</h4>
        <p className="mt-3 text-base leading-relaxed text-slate-200 md:text-lg">
          Using the peak apparent magnitude from the survey row and the standard absolute magnitude:
        </p>
        <p className="mt-3 font-mono text-lg text-sky-100 md:text-xl">
          μ = m − M = {mStr} − ({M_REF}) = {muStr}
        </p>
        <p className="mt-3 text-base leading-relaxed text-slate-300 md:text-lg">
          That <span className="font-mono text-sky-200/90">μ ≈ {muStr}</span> is what belongs on the <strong className="text-slate-100">vertical axis</strong> of the Hubble diagram once combined with the redshift you measured earlier. Open the light-curve tool when you are ready to see the noisy points and template that lead to the same peak <span className="font-mono text-slate-200">m</span>.
        </p>
      </section>
    </div>
  );
}
