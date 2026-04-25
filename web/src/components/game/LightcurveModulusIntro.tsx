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

  return (
    <div className="space-y-5 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
      <section>
        <h4 className="text-base font-semibold text-stone-900 md:text-lg">1 · Brightness numbers run backwards</h4>
        <p className="mt-2 text-base leading-relaxed text-stone-600 md:text-lg">
          In astronomy, magnitude m counts &quot;how bright it looks,&quot; but bigger m means fainter. A star at magnitude 22 is much dimmer than one at magnitude 20.
        </p>
      </section>

      <section>
        <h4 className="text-base font-semibold text-stone-900 md:text-lg">2 · Type Ia supernovae are “identical lightbulbs”</h4>
        <p className="mt-2 text-base leading-relaxed text-stone-600 md:text-lg">
          Picture two lightbulbs of the same wattage. If one looks brighter, it can only be because it is closer. Type Ia explosions are used the same way: they are treated as having the same intrinsic power. So once you know the type, how faint it appears in your telescope is mostly telling you distance.
        </p>
      </section>

      <section>
        <h4 className="text-base font-semibold text-stone-900 md:text-lg">3 · What m, M, and μ mean</h4>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-base leading-relaxed text-stone-600 md:text-lg">
          <li>
            <span className="font-mono text-stone-800">m</span> is apparent magnitude at the peak only, one brightness for &quot;how bright did the same explosion look when it was hottest?&quot; The plot will show many dots: those are many different nights of watching the same supernova so you can see the full rise and fall and fit a template. Only the peak night supplies the m that enters <span className="font-mono text-stone-800">μ = m − M</span> (here the table already lists that peak as{" "}
            <span className="font-mono text-stone-900">m = {mStr}</span>).
          </li>
          <li>
            <span className="font-mono text-stone-800">M</span> is absolute magnitude, or how bright the same explosion would look if you parked it at a standard distance (10 parsecs). For this walkthrough every Type Ia uses the same fiducial{" "}
            <span className="font-mono text-stone-900">M = {M_REF}</span>. That is the shared “wattage” of the lightbulb.
          </li>
          <li>
            The distance modulus{" "}
            <span className="font-mono text-stone-800">μ = m − M</span> is just the gap between those two: how much fainter it is than it would be up close.{" "}
            Larger μ means farther away (more dimming from distance).
          </li>
        </ul>
      </section>
    </div>
  );
}
