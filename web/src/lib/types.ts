export type SupernovaRow = {
  record_type?: string;
  sn_name: string;
  z_true: number;
  z_obs: number;
  mu_obs: number;
  sigma_mu: number;
  m_apparent: number;
  lambda_Halpha: number;
  sequence_order_resolved: number;
  residual_obs_minus_open_matter_at_z_obs: number;
  cumchi2_EdS_after_this_sequence: number;
  cumchi2_open_matter_after_this_sequence: number;
  cumchi2_flat_LCDM_after_this_sequence: number;
};

export type ModelCurveRow = { model_id: string; z: number; mu_theory: number };

export type LCTemplateRow = { phase_days: number; dm_from_peak_mag: number };

export type SpecTemplateRow = { lambda_rest_A: number; flux_norm: number };

export type GameBundle = {
  supernovae: SupernovaRow[];
  curves: { EdS: ModelCurveRow[]; open_matter: ModelCurveRow[]; flat_LCDM: ModelCurveRow[] };
  lcTemplate: LCTemplateRow[];
  specTemplate: SpecTemplateRow[];
};

export type Observation = {
  z_obs: number;
  mu_obs: number;
  sigma_mu: number;
  residual: number;
  flash?: boolean;
};
