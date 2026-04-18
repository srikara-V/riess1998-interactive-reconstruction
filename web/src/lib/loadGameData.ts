import { parseCSV, num } from "./csv";
import type { GameBundle, LCTemplateRow, ModelCurveRow, SpecTemplateRow, SupernovaRow } from "./types";

async function loadText(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.text();
}

export async function loadGameBundle(): Promise<GameBundle> {
  const [preT, mcT, lcT, spT] = await Promise.all([
    loadText("/data/precomputation.csv"),
    loadText("/data/model_curves.csv"),
    loadText("/data/light_curve_template.csv"),
    loadText("/data/spectrum_template_rest.csv"),
  ]);

  const preRows = parseCSV(preT);
  const supernovae: SupernovaRow[] = preRows
    .filter((r) => (r.record_type || "supernova") === "supernova")
    .map((r) => ({
      record_type: r.record_type,
      sn_name: r.sn_name,
      z_true: num(r.z_true),
      z_obs: num(r.z_obs),
      mu_obs: num(r.mu_obs),
      sigma_mu: num(r.sigma_mu),
      m_apparent: num(r.m_apparent),
      lambda_CaII: num(r.lambda_CaII),
      sequence_order_resolved: num(r.sequence_order_resolved),
      residual_obs_minus_open_matter_at_z_obs: num(r.residual_obs_minus_open_matter_at_z_obs),
      cumchi2_EdS_after_this_sequence: num(r.cumchi2_EdS_after_this_sequence),
      cumchi2_open_matter_after_this_sequence: num(r.cumchi2_open_matter_after_this_sequence),
      cumchi2_flat_LCDM_after_this_sequence: num(r.cumchi2_flat_LCDM_after_this_sequence),
    }))
    .sort((a, b) => a.sequence_order_resolved - b.sequence_order_resolved);

  const mcRows: ModelCurveRow[] = parseCSV(mcT).map((r) => ({
    model_id: r.model_id,
    z: num(r.z),
    mu_theory: num(r.mu_theory),
  }));

  const curves = {
    EdS: mcRows.filter((r) => r.model_id === "EdS"),
    open_matter: mcRows.filter((r) => r.model_id === "open_matter"),
    flat_LCDM: mcRows.filter((r) => r.model_id === "flat_LCDM"),
  };

  const lcTemplate: LCTemplateRow[] = parseCSV(lcT).map((r) => ({
    phase_days: num(r.phase_days),
    dm_from_peak_mag: num(r.dm_from_peak_mag),
  }));

  const specTemplate: SpecTemplateRow[] = parseCSV(spT).map((r) => ({
    lambda_rest_A: num(r.lambda_rest_A),
    flux_norm: num(r.flux_norm),
  }));

  return { supernovae, curves, lcTemplate, specTemplate };
}
