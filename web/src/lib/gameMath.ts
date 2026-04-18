export const CAII_REST = 3934;
export const M_REF = -19.3;
export const Z_AXIS = { min: 0.01, max: 1.2 };
export const MU_AXIS = { min: 32, max: 46 };

export function hashString(s: string) {
  let h = 1779033703;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randn(rng: () => number) {
  const u = rng() || 1e-12;
  const v = rng() || 1e-12;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function interpolateLC(
  template: { phase_days: number; dm_from_peak_mag: number }[],
  t: number,
) {
  if (!template.length) return 0;
  let i0 = 0;
  for (let i = 0; i < template.length - 1; i++) {
    if (template[i + 1].phase_days >= t) {
      i0 = i;
      break;
    }
    i0 = i;
  }
  const a = template[i0];
  const b = template[Math.min(i0 + 1, template.length - 1)];
  const ta = a.phase_days;
  const tb = b.phase_days;
  if (tb <= ta) return a.dm_from_peak_mag;
  const u = (t - ta) / (tb - ta);
  return a.dm_from_peak_mag + u * (b.dm_from_peak_mag - a.dm_from_peak_mag);
}
