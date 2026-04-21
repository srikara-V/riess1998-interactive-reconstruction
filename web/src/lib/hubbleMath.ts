import { MU_AXIS, Z_AXIS } from "./gameMath";
import type { ModelCurveRow } from "./types";
import type { Observation } from "./types";

export function xHubble(z: number, iw: number) {
  const lo = Math.log10(Z_AXIS.min);
  const hi = Math.log10(Z_AXIS.max);
  const lz = Math.log10(Math.max(z, Z_AXIS.min));
  return ((lz - lo) / (hi - lo)) * iw;
}

export function yHubble(mu: number, ih: number) {
  const lo = MU_AXIS.min;
  const hi = MU_AXIS.max;
  return ih - ((mu - lo) / (hi - lo)) * ih;
}

export function residualRange(obs: Pick<Observation, "residual">[]) {
  let lo = -0.6;
  let hi = 0.8;
  for (const o of obs) {
    lo = Math.min(lo, o.residual - 0.15);
    hi = Math.max(hi, o.residual + 0.15);
  }
  return { lo, hi };
}

/** Linear interpolation of μ_theory(z) along a dense model curve. */
export function interpMuAtZ(curve: ModelCurveRow[], z: number): number {
  if (!curve.length) return NaN;
  if (z <= curve[0].z) return curve[0].mu_theory;
  const last = curve[curve.length - 1];
  if (z >= last.z) return last.mu_theory;
  for (let i = 0; i < curve.length - 1; i++) {
    const z0 = curve[i].z;
    const z1 = curve[i + 1].z;
    if (z1 >= z) {
      const t = (z - z0) / (z1 - z0);
      return curve[i].mu_theory + t * (curve[i + 1].mu_theory - curve[i].mu_theory);
    }
  }
  return last.mu_theory;
}

export function residualRangeWithPreview(obs: Pick<Observation, "residual">[], previewResidual: number | null) {
  const base = residualRange(obs);
  if (previewResidual == null || !Number.isFinite(previewResidual)) return base;
  return {
    lo: Math.min(base.lo, previewResidual - 0.2),
    hi: Math.max(base.hi, previewResidual + 0.2),
  };
}

export function yResid(r: number, ih: number, lo: number, hi: number) {
  return ih - ((r - lo) / (hi - lo)) * ih;
}

export function muResidualCurve(curves: { EdS: ModelCurveRow[]; open_matter: ModelCurveRow[]; flat_LCDM: ModelCurveRow[] }, modelKey: keyof typeof curves, i: number) {
  return curves[modelKey][i].mu_theory - curves.open_matter[i].mu_theory;
}
