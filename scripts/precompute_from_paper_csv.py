#!/usr/bin/env python3
"""
Read data/paper_data.csv (supernova truth table) and write:

  - data/precomputation.csv — one row per supernova (noise, models at that z, χ², etc.)
  - data/model_curves.csv — dense μ(z) curves for the three cosmologies (default)
  - data/light_curve_template.csv — shared Type Ia B-band-ish shape (Δm vs phase)
  - data/spectrum_template_rest.csv — rest-frame continuum + Hα emission spike (shift per SN in-game)

Cosmology conventions (flat FRW + open matter-only third curve):
  - EdS:              Omega_m=1.0, Omega_Lambda=0.0, Omega_k=0
  - open matter-only: Omega_m=0.3, Omega_Lambda=0.0, Omega_k=0.7  (so total = 1)
  - flat LCDM:        Omega_m=0.3, Omega_Lambda=0.7, Omega_k=0

Distance modulus: mu = 5*log10(d_L / Mpc) + 25  (d_L luminosity distance).
"""

from __future__ import annotations

import argparse
import csv
import math
import os
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple, cast

# --- constants (match typical course / Riess-style plots) ---
C_KM_S = 299_792.458  # speed of light km/s
HALPHA_REST_A = 6563.0  # Hα rest wavelength (Å); pedagogical round number
M_REF_TYPE_IA = -19.3  # standard candle absolute magnitude reference for consistency checks

REQUIRED_INPUT_FIELDS = (
    "sn_name",
    "source_table",
    "z_true",
    "mu_true",
    "sigma_mu",
    "m_apparent",
    "lambda_Halpha",
    "sample_type",
    "quality",
    "sequence_order",
)


@dataclass(frozen=True)
class CosmoParams:
    name: str
    omega_m: float
    omega_l: float
    omega_k: float  # must satisfy omega_m + omega_l + omega_k = 1 (flat or curved models used here)


MODELS: Tuple[CosmoParams, ...] = (
    CosmoParams("EdS", 1.0, 0.0, 0.0),
    CosmoParams("open_matter", 0.3, 0.0, 0.7),
    CosmoParams("flat_LCDM", 0.3, 0.7, 0.0),
)


def E_z(z: float, p: CosmoParams) -> float:
    om_m, om_l, om_k = p.omega_m, p.omega_l, p.omega_k
    return math.sqrt(max(0.0, om_m * (1.0 + z) ** 3 + om_l + om_k * (1.0 + z) ** 2))


def trapz_integral(f, a: float, b: float, n: int) -> float:
    """Uniform trapezoid rule on [a, b]."""
    if b <= a:
        return 0.0
    h = (b - a) / n
    s = 0.5 * (f(a) + f(b))
    x = a
    for _ in range(1, n):
        x += h
        s += f(x)
    return s * h


def DC_over_DH(z: float, p: CosmoParams, n_steps: int = 4000) -> float:
    """Comoving distance / (c/H0) = ∫_0^z dz' / E(z')."""

    def integrand(zz: float) -> float:
        return 1.0 / E_z(zz, p)

    return trapz_integral(integrand, 0.0, z, n_steps)


def DM_over_DH_from_DC(DC_DH: float, p: CosmoParams) -> float:
    """Transverse comoving distance / (c/H0) from DC/DH (Hogg-style)."""
    ok = p.omega_k
    if abs(ok) < 1e-12:
        return DC_DH
    if ok > 0:
        x = math.sqrt(ok) * DC_DH
        return (1.0 / math.sqrt(ok)) * math.sinh(x)
    x = math.sqrt(-ok) * DC_DH
    return (1.0 / math.sqrt(-ok)) * math.sin(x)


def d_L_mpc(z: float, H0_km_s_mpc: float, p: CosmoParams, n_steps: int = 4000) -> float:
    """Luminosity distance in Mpc."""
    DH_mpc = C_KM_S / H0_km_s_mpc
    DC = DC_over_DH(z, p, n_steps=n_steps)
    DM = DM_over_DH_from_DC(DC, p)
    return (1.0 + z) * DM * DH_mpc


def mu_from_dL_mpc(dL_mpc: float) -> float:
    if dL_mpc <= 0:
        raise ValueError("non-positive luminosity distance")
    return 5.0 * math.log10(dL_mpc) + 25.0


def mu_model(z: float, H0: float, p: CosmoParams, n_steps: int = 4000) -> float:
    return mu_from_dL_mpc(d_L_mpc(z, H0, p, n_steps=n_steps))


def read_rows(path: str) -> Tuple[List[str], List[Dict[str, str]]]:
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            raise ValueError(f"{path}: missing header row")
        fields = [h.strip() for h in reader.fieldnames]
        missing = [h for h in REQUIRED_INPUT_FIELDS if h not in fields]
        if missing:
            raise ValueError(f"{path}: missing required columns: {missing}")
        rows = []
        for i, row in enumerate(reader, start=2):
            if row is None:
                continue
            # strip keys/values
            clean = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
            if not any(clean.get(h) not in (None, "") for h in REQUIRED_INPUT_FIELDS):
                continue
            rows.append(clean)
        return fields, rows


def ffloat(x: str, *, field: str, row_hint: str) -> float:
    try:
        return float(x)
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"invalid float for {field} ({row_hint}): {x!r}") from e


def fint(x: str, *, field: str, row_hint: str) -> int:
    try:
        return int(float(x))
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"invalid int for {field} ({row_hint}): {x!r}") from e


def compute_model_curve_points(
    H0: float,
    z_min: float,
    z_max: float,
    n_z: int,
    n_steps: int,
) -> List[Tuple[str, float, float]]:
    """Return (model_id, z, mu_theory) for plotting dense Hubble diagram curves."""
    if n_z < 2:
        raise ValueError("n_z must be >= 2")
    out: List[Tuple[str, float, float]] = []
    dz = (z_max - z_min) / (n_z - 1)
    for i in range(n_z):
        z = z_min + dz * i
        for p in MODELS:
            mu = mu_model(z, H0, p, n_steps=n_steps)
            out.append((p.name, z, mu))
    return out


def model_curve_embed_rows_from_points(
    points: Sequence[Tuple[str, float, float]],
    H0: float,
) -> List[Dict[str, str]]:
    """Rows compatible with write_precomputation_csv embedding (wide schema)."""
    rows: List[Dict[str, str]] = []
    for model_id, z, mu in points:
        rows.append(
            {
                "record_type": "model_curve",
                "model_id": model_id,
                "z_curve": f"{z:.8g}",
                "mu_theory_curve": f"{mu:.8g}",
                "H0_km_s_Mpc": f"{H0:.8g}",
            }
        )
    return rows


def write_model_curves_csv(path: str, points: Sequence[Tuple[str, float, float]], H0: float) -> None:
    """Dense theory curves for smooth Hubble-diagram lines (standalone CSV)."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    fieldnames = ("model_id", "z", "mu_theory", "H0_km_s_Mpc")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for model_id, z, mu in points:
            w.writerow(
                {
                    "model_id": model_id,
                    "z": f"{z:.10g}",
                    "mu_theory": f"{mu:.10g}",
                    "H0_km_s_Mpc": f"{H0:.10g}",
                }
            )


def light_curve_dm_from_peak(phase_days: float) -> float:
    """
    Pedagogical Type Ia–like template: magnitude offset from peak (days relative to max).
    Positive = fainter than peak. Same shape for every SN; add m_apparent at phase 0 in-game.
    """
    t = float(phase_days)
    if t < -19.0:
        # pre-discovery plateau
        return 3.0 + 0.015 * (-19.0 - t)
    if t <= 0.0:
        u = (t + 19.0) / 19.0  # 0 at t=-19, 1 at t=0
        return 2.25 * (1.0 - u) ** 1.15
    if t <= 55.0:
        return 1.05 * math.pow(max(t, 1e-6) / 15.0, 0.92)
    return 1.05 * math.pow(55.0 / 15.0, 0.92) + 0.018 * (t - 55.0)


def write_light_curve_template_csv(path: str, *, t_min: float = -30.0, t_max: float = 90.0, dt: float = 1.0) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    fieldnames = ("phase_days", "dm_from_peak_mag")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        t = t_min
        while t <= t_max + 1e-9:
            dm = light_curve_dm_from_peak(t)
            w.writerow({"phase_days": f"{t:.6g}", "dm_from_peak_mag": f"{dm:.8g}"})
            t += dt


def spectrum_flux_rest(wavelength_A: float, *, line_center_A: float = HALPHA_REST_A, depth: float = 0.38, sigma_A: float = 42.0) -> float:
    """Rest-frame normalized flux with a single Gaussian emission line (Hα)."""
    return 1.0 + depth * math.exp(-0.5 * ((wavelength_A - line_center_A) / sigma_A) ** 2)


def write_spectrum_template_rest_csv(
    path: str,
    *,
    wl_min: float = 5000.0,
    wl_max: float = 11000.0,
    dwl: float = 3.0,
    line_center_A: float = HALPHA_REST_A,
) -> None:
    """
    Rest-frame template: emission spike centered at line_center_A (Å). In-game, plot vs observed
    wavelength by stretching: λ_obs = λ_rest * (1 + z); per-SN lambda_Halpha matches z = λ/6563 − 1.
    """
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    fieldnames = ("lambda_rest_A", "flux_norm", "Halpha_line_center_A")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        wl = wl_min
        while wl <= wl_max + 1e-9:
            fl = spectrum_flux_rest(wl, line_center_A=line_center_A)
            w.writerow(
                {
                    "lambda_rest_A": f"{wl:.6g}",
                    "flux_norm": f"{fl:.8g}",
                    "Halpha_line_center_A": f"{line_center_A:.6g}",
                }
            )
            wl += dwl


def build_supernova_output_rows(
    input_rows: Sequence[Dict[str, str]],
    *,
    H0: float,
    sigma_z: float,
    rng: random.Random,
    n_steps: int,
) -> List[Dict[str, str]]:
    parsed: List[Dict[str, object]] = []
    for row in input_rows:
        sn = row["sn_name"]
        z_true = ffloat(row["z_true"], field="z_true", row_hint=sn)
        mu_true = ffloat(row["mu_true"], field="mu_true", row_hint=sn)
        sig = ffloat(row["sigma_mu"], field="sigma_mu", row_hint=sn)
        m_app = ffloat(row["m_apparent"], field="m_apparent", row_hint=sn)
        lam_in = ffloat(row["lambda_Halpha"], field="lambda_Halpha", row_hint=sn)
        seq_raw = (row.get("sequence_order") or "").strip()
        if seq_raw == "":
            seq: Optional[int] = None
        else:
            seq = fint(seq_raw, field="sequence_order", row_hint=sn)

        if sig <= 0:
            raise ValueError(f"{sn}: sigma_mu must be > 0")

        lam_from_z = HALPHA_REST_A * (1.0 + z_true)
        z_obs = z_true + rng.gauss(0.0, sigma_z)
        mu_obs = mu_true + rng.gauss(0.0, sig)

        implied_abs_M = m_app - mu_true
        abs_M_minus_M_ref = implied_abs_M - M_REF_TYPE_IA
        flux_relative = 10.0 ** (-0.4 * m_app)

        mus_ztrue = {p.name: mu_model(z_true, H0, p, n_steps=n_steps) for p in MODELS}
        mus_zobs = {p.name: mu_model(z_obs, H0, p, n_steps=n_steps) for p in MODELS}

        open_m = MODELS[1]
        residual_obs_minus_open_matter = mu_obs - mus_zobs[open_m.name]

        pulls = {}
        for p in MODELS:
            pulls[p.name] = (mu_obs - mus_zobs[p.name]) / sig

        parsed.append(
            {
                "row_in": row,
                "sn": sn,
                "seq": seq,
                "z_true": z_true,
                "mu_true": mu_true,
                "sigma_mu": sig,
                "m_apparent": m_app,
                "lam_in": lam_in,
                "lam_from_z": lam_from_z,
                "z_obs": z_obs,
                "mu_obs": mu_obs,
                "mus_ztrue": mus_ztrue,
                "mus_zobs": mus_zobs,
                "residual_obs_minus_open_matter": residual_obs_minus_open_matter,
                "pulls": pulls,
                "implied_abs_M": implied_abs_M,
                "abs_M_minus_M_ref": abs_M_minus_M_ref,
                "flux_relative": flux_relative,
            }
        )

    # Blank sequence_order: assign stable integers after max explicit (CSV row order for ties).
    max_explicit = 0
    for r in parsed:
        if r["seq"] is not None:
            max_explicit = max(max_explicit, int(cast(int, r["seq"])))
    next_seq = max_explicit + 1
    for r in parsed:
        if r["seq"] is None:
            r["seq"] = next_seq
            next_seq += 1

    # cumulative chi^2 contributions in observation order
    parsed.sort(key=lambda r: (int(r["seq"]), str(r["sn"])))
    cum = {p.name: 0.0 for p in MODELS}
    for r in parsed:
        for p in MODELS:
            pull = float(r["pulls"][p.name])
            cum[p.name] += pull * pull
        r["cumchi2"] = dict(cum)

    # restore original file order for output stability
    order_index = {id(r["row_in"]): i for i, r in enumerate(parsed)}
    parsed.sort(key=lambda r: order_index[id(r["row_in"])])

    out_rows: List[Dict[str, str]] = []
    for r in parsed:
        row_in: Dict[str, str] = r["row_in"]  # type: ignore[assignment]
        cumchi2: Dict[str, float] = r["cumchi2"]  # type: ignore[assignment]

        out = {
            "record_type": "supernova",
            "model_id": "",
            "z_curve": "",
            "mu_theory_curve": "",
            # passthrough inputs
            "sn_name": row_in.get("sn_name", ""),
            "source_table": row_in.get("source_table", ""),
            "z_true": f"{float(r['z_true']):.8g}",
            "mu_true": f"{float(r['mu_true']):.8g}",
            "sigma_mu": f"{float(r['sigma_mu']):.8g}",
            "m_apparent": f"{float(r['m_apparent']):.8g}",
            "lambda_Halpha": f"{float(r['lam_in']):.8g}",
            "sample_type": row_in.get("sample_type", ""),
            "quality": row_in.get("quality", ""),
            "sequence_order": row_in.get("sequence_order", ""),
            "sequence_order_resolved": str(int(cast(int, r["seq"]))),
            # global / checks
            "H0_km_s_Mpc": f"{H0:.8g}",
            "M_ref_type_Ia": f"{M_REF_TYPE_IA:.8g}",
            "Halpha_rest_A": f"{HALPHA_REST_A:.8g}",
            "implied_abs_M_from_m_mu": f"{float(r['implied_abs_M']):.8g}",
            "abs_M_minus_M_ref": f"{float(r['abs_M_minus_M_ref']):.8g}",
            "lambda_Halpha_from_z_true": f"{float(r['lam_from_z']):.8g}",
            "lambda_Halpha_minus_expected": f"{float(r['lam_in']) - float(r['lam_from_z']):.8g}",
            "flux_relative": f"{float(r['flux_relative']):.8g}",
            "sigma_z_assumed": f"{sigma_z:.8g}",
            "z_obs": f"{float(r['z_obs']):.8g}",
            "mu_obs": f"{float(r['mu_obs']):.8g}",
            # models at z_true
            "mu_model_EdS_z_true": f"{float(r['mus_ztrue']['EdS']):.8g}",
            "mu_model_open_matter_z_true": f"{float(r['mus_ztrue']['open_matter']):.8g}",
            "mu_model_flat_LCDM_z_true": f"{float(r['mus_ztrue']['flat_LCDM']):.8g}",
            # models at z_obs (what the "measured" redshift implies for overlays)
            "mu_model_EdS_z_obs": f"{float(r['mus_zobs']['EdS']):.8g}",
            "mu_model_open_matter_z_obs": f"{float(r['mus_zobs']['open_matter']):.8g}",
            "mu_model_flat_LCDM_z_obs": f"{float(r['mus_zobs']['flat_LCDM']):.8g}",
            # residual panel style vs open matter-only curve, using obs values
            "residual_obs_minus_open_matter_at_z_obs": f"{float(r['residual_obs_minus_open_matter']):.8g}",
            # per-point pulls^2 (chi increments)
            "chi2_increment_EdS": f"{float(r['pulls']['EdS']) ** 2:.8g}",
            "chi2_increment_open_matter": f"{float(r['pulls']['open_matter']) ** 2:.8g}",
            "chi2_increment_flat_LCDM": f"{float(r['pulls']['flat_LCDM']) ** 2:.8g}",
            # cumulative chi^2 after processing rows in ascending sequence_order
            "cumchi2_EdS_after_this_sequence": f"{float(cumchi2['EdS']):.8g}",
            "cumchi2_open_matter_after_this_sequence": f"{float(cumchi2['open_matter']):.8g}",
            "cumchi2_flat_LCDM_after_this_sequence": f"{float(cumchi2['flat_LCDM']):.8g}",
        }
        out_rows.append(out)

    return out_rows


def write_precomputation_csv(
    path: str,
    sn_rows: List[Dict[str, str]],
    *,
    rng_seed: int,
    embed_curve_rows: Optional[List[Dict[str, str]]] = None,
) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    embed_curve_rows = embed_curve_rows or []

    # union of keys in stable order
    base_keys = [
        "record_type",
        "model_id",
        "z_curve",
        "mu_theory_curve",
        "sn_name",
        "source_table",
        "z_true",
        "mu_true",
        "sigma_mu",
        "m_apparent",
        "lambda_Halpha",
        "sample_type",
        "quality",
        "sequence_order",
        "sequence_order_resolved",
        "H0_km_s_Mpc",
        "M_ref_type_Ia",
        "Halpha_rest_A",
        "implied_abs_M_from_m_mu",
        "abs_M_minus_M_ref",
        "lambda_Halpha_from_z_true",
        "lambda_Halpha_minus_expected",
        "flux_relative",
        "sigma_z_assumed",
        "rng_seed",
        "z_obs",
        "mu_obs",
        "mu_model_EdS_z_true",
        "mu_model_open_matter_z_true",
        "mu_model_flat_LCDM_z_true",
        "mu_model_EdS_z_obs",
        "mu_model_open_matter_z_obs",
        "mu_model_flat_LCDM_z_obs",
        "residual_obs_minus_open_matter_at_z_obs",
        "chi2_increment_EdS",
        "chi2_increment_open_matter",
        "chi2_increment_flat_LCDM",
        "cumchi2_EdS_after_this_sequence",
        "cumchi2_open_matter_after_this_sequence",
        "cumchi2_flat_LCDM_after_this_sequence",
    ]

    def finalize_row(r: Dict[str, str]) -> Dict[str, str]:
        rr = dict(r)
        rr["rng_seed"] = str(rng_seed)
        for k in base_keys:
            rr.setdefault(k, "")
        return {k: rr.get(k, "") for k in base_keys}

    all_rows = [finalize_row(r) for r in sn_rows] + [finalize_row(r) for r in embed_curve_rows]

    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=base_keys, extrasaction="ignore")
        w.writeheader()
        for rr in all_rows:
            w.writerow(rr)


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Precompute cosmology quantities from paper_data.csv")
    p.add_argument("--input", default=os.path.join("data", "paper_data.csv"))
    p.add_argument("--output", default=os.path.join("data", "precomputation.csv"))
    p.add_argument(
        "--output-model-curves",
        default=os.path.join("data", "model_curves.csv"),
        help="Dense μ(z) curves for the three models (standalone CSV)",
    )
    p.add_argument(
        "--output-light-curve-template",
        default=os.path.join("data", "light_curve_template.csv"),
        help="Shared Type Ia light-curve shape (Δm vs phase_days)",
    )
    p.add_argument(
        "--output-spectrum-template",
        default=os.path.join("data", "spectrum_template_rest.csv"),
        help="Rest-frame spectrum template (continuum + Hα emission)",
    )
    p.add_argument("--H0", type=float, default=70.0, help="Hubble constant [km/s/Mpc]")
    p.add_argument("--sigma-z", type=float, default=0.001, dest="sigma_z", help="Gaussian noise sigma on z_obs")
    p.add_argument("--seed", type=int, default=42, help="RNG seed for z_obs/mu_obs draws")
    p.add_argument("--n-steps", type=int, default=4000, dest="n_steps", help="Trapezoid steps for z-integral")
    p.add_argument(
        "--model-curve-z-min",
        type=float,
        default=0.001,
        dest="z_min",
    )
    p.add_argument("--model-curve-z-max", type=float, default=1.2, dest="z_max")
    p.add_argument("--model-curve-nz", type=int, default=200, dest="nz", help="Number of z samples per model")
    p.add_argument(
        "--no-model-curves",
        action="store_true",
        help="Skip writing data/model_curves.csv (and any embedding)",
    )
    p.add_argument(
        "--no-templates",
        action="store_true",
        help="Skip writing light-curve and spectrum template CSVs",
    )
    p.add_argument(
        "--embed-model-curves-in-precomputation",
        action="store_true",
        help="Also append model_curve rows to precomputation.csv (wide format)",
    )
    args = p.parse_args(list(argv) if argv is not None else None)

    _, rows = read_rows(args.input)
    rng = random.Random(int(args.seed))

    sn_out = build_supernova_output_rows(
        rows,
        H0=float(args.H0),
        sigma_z=float(args.sigma_z),
        rng=rng,
        n_steps=int(args.n_steps),
    )

    curve_points: List[Tuple[str, float, float]] = []
    if not args.no_model_curves:
        curve_points = compute_model_curve_points(
            float(args.H0),
            float(args.z_min),
            float(args.z_max),
            int(args.nz),
            int(args.n_steps),
        )
        write_model_curves_csv(args.output_model_curves, curve_points, float(args.H0))

    embed_rows: Optional[List[Dict[str, str]]] = None
    if args.embed_model_curves_in_precomputation and not args.no_model_curves:
        embed_rows = model_curve_embed_rows_from_points(curve_points, float(args.H0))

    write_precomputation_csv(
        args.output,
        sn_out,
        rng_seed=int(args.seed),
        embed_curve_rows=embed_rows,
    )

    if not args.no_templates:
        write_light_curve_template_csv(args.output_light_curve_template)
        write_spectrum_template_rest_csv(args.output_spectrum_template)

    parts = [f"{args.output} ({len(sn_out)} supernova rows)"]
    if not args.no_model_curves:
        parts.append(f"{args.output_model_curves} ({len(curve_points)} curve samples)")
    if args.embed_model_curves_in_precomputation and embed_rows is not None:
        parts.append(f"embedded {len(embed_rows)} model_curve rows in precomputation.csv")
    if not args.no_templates:
        parts.append(f"{args.output_light_curve_template}")
        parts.append(f"{args.output_spectrum_template}")
    print("Wrote " + "; ".join(parts))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
