/** Pedagogical copy for each pipeline stage (SCP / High-z style workflow). */

export const WELCOME = {
  title: "How the 1998 supernova teams measured the universe",
  body: [
    "In the 1990s, two collaborations — the Supernova Cosmology Project (Berkeley/LBNL) and the High-z Supernova Search Team — hunted distant Type Ia supernovae. Each object had to be discovered, confirmed, followed photometrically, and tied to a redshift before it became one point on a Hubble diagram.",
    "This walkthrough follows that real pipeline. The heavy numerics (Friedmann distances, noise draws, χ²) are already in your precomputed CSVs; here you replay the scientific story step by step.",
  ],
};

export const DISCOVERY = [
  {
    title: "1 · Wide-field imaging campaigns",
    body: "Teams re-imaged patches of sky on a ~3-week cadence near new moon. The goal is transients: anything that appears in the new epoch but not the template epoch.",
  },
  {
    title: "2 · Digital image subtraction",
    body: "After aligning point spread functions (PSFs) and matching photometric depth, the template is subtracted from the new image. Most structure cancels; a genuine supernova leaves a clean residual point source sitting on its host galaxy.",
  },
  {
    title: "3 · Click the new source",
    body: "When you identify the residual point source, the team would queue spectroscopy and multi-color follow-up. (Position is seeded from the supernova name so each object feels distinct.)",
  },
];

export const SPECTRUM = [
  {
    title: "1 · Why take a spectrum?",
    body: "Photometry tells you something brightened; spectroscopy tells you what it is. A Type Ia spectrum has broad silicon and iron features, distinct from core-collapse or AGN impostors. Host-galaxy emission lines give a redshift z.",
  },
  {
    title: "2 · Ca II as a ruler",
    body: "Rest-frame Ca II λ≈3934 Å shifts to λ_obs = λ_rest(1+z). Drag the cursor to line up with the absorption trough. In the real reduction pipeline, redshift feeds K-corrections and luminosity distance comparisons.",
  },
  {
    title: "3 · Lock when the fit is good",
    body: "When your line center is within ~20 Å of the table value, you can lock. The game still plots the precomputed z_obs (with realistic noise) so the Hubble diagram stays consistent with your Python precompute.",
  },
];

export const LIGHTCURVE = [
  {
    title: "1 · Monitor the rise and fall",
    body: "Type Ia light curves are not identical, but they obey empirical relations (e.g., Phillips: broader → intrinsically brighter). Multi-epoch photometry in matched filters lets you standardize each event to a peak absolute magnitude.",
  },
  {
    title: "2 · Standardize to a distance modulus",
    body: "After K-corrections and light-curve shape corrections (already folded into the table μ), each supernova contributes an apparent peak magnitude m. With a fiducial absolute magnitude M≈−19.3, the distance modulus is μ=m−M.",
  },
  {
    title: "3 · Add the point to the Hubble diagram",
    body: "Once μ and z exist for many objects, you compare to Friedmann predictions. That comparison — not any single supernova — is where dark energy showed up.",
  },
];
