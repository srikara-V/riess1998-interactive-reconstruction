/** Pedagogical copy for each pipeline stage (High-z Supernova Search Team–style workflow). */

export const WELCOME = {
  title: "How the High-z team measured the universe",
  body: [
    "In the 1990s, the High-z Supernova Search Team (Harvard / CfA–led, with partners worldwide) hunted distant Type Ia supernovae. Each object had to be discovered, confirmed, followed photometrically, and tied to a redshift before it became one point on a Hubble diagram.",
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
    body: "After aligning point spread functions (PSFs) and matching photometric depth, the template is subtracted from the new epoch so you view the residual (new − template). Stars and static galaxies mostly cancel to near-zero noise; a real supernova stands out as an isolated bright residual.",
  },
  {
    title: "3 · Click the residual in the difference image",
    body: [
      "Take a template image of the field.",
      "Take a new-epoch image of that same field a few weeks later.",
      "Align the images, match their PSFs, and normalize the flux scale.",
      "Subtract template from new epoch so the static stars and galaxies mostly cancel away.",
      "What remains is the residual map: anything that changed between the two visits.",
      "Confirm the transient on that residual map, not by hunting the field in the new image alone.",
      "Once the clean point source is marked, the team would queue spectroscopy and multi-color follow-up.",
      "(Position is seeded from the supernova name so each object feels distinct.)",
    ],
  },
];

export const SPECTRUM = [
  {
    title: "1 · Why take a spectrum?",
    body: "Pictures from a telescope can tell you that something got brighter — but not whether it was a real supernova, a star in our own galaxy, or something else pretending to be one. A spectrum spreads the object’s light into a rainbow and reveals fingerprints of atoms and molecules. That fingerprint is how teams proved they had the right kind of explosion and how they read off a distance-related redshift.",
  },
  {
    title: "2 · Hydrogen as a built-in ruler",
    body: "Hydrogen gas in the host galaxy glows at a known wavelength — 6563 Å (Hα) — when observed nearby. When the galaxy is receding, that glow is stretched to longer wavelengths along with the rest of the spectrum. Measuring how far the emission peak shifted gives you z — which you need before you can compare brightness to distance honestly.",
  },
  {
    title: "3 · Lock when the match looks right",
    body: "In the next tool, drag the vertical marker to the peak of the Hα emission spike you trust. If you are within about 20 ångströms of the value in your table, you can lock. The game still uses the survey’s precomputed redshift for the final Hubble point so the numbers stay consistent with your course CSVs.",
  },
];

export const LIGHTCURVE = [
  {
    title: "1 · Watch it brighten, then fade",
    body: [
      "Teams go back every few nights for weeks and take another image through the same filter.",
      "Each dot is one measurement of the same supernova on a different night.",
      "Horizontal position is which night it was observed (days before or after peak).",
      "Vertical position is how bright it looked that night.",
      "Together the dots trace one rise and fall.",
      "The single number m you care about for distance is only the brightness at the very top of that bump (around day 0), not every dot's magnitude.",
    ],
  },
  {
    title: "2 · From “how faint it looks” to distance",
    body: "Before you touch the plot, read the box below. It builds the whole chain in plain language: why magnitude feels backwards, why Type Ia events act like matched lightbulbs, what m, M, and μ are, and the exact numbers for this supernova so you see where the Hubble y-axis comes from.",
  },
  {
    title: "3 · Add the point to the Hubble diagram",
    body: [
      "Many noisy dots on the light curve are many nights of the same event.",
      "The Hubble diagram needs one peak m and one redshift per object.",
      "After you finish this object, the game drops a point using the survey’s full reduction (z_obs, μ_obs).",
      "The dark-energy result comes from comparing many such points to different cosmological curves, not from any single supernova.",
    ],
  },
];
