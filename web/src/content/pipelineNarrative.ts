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
    body: "Confirm the transient on the residual map — not by hunting the field in the new epoch alone. Once the clean point source is marked, the team would queue spectroscopy and multi-color follow-up. (Position is seeded from the supernova name so each object feels distinct.)",
  },
];

export const SPECTRUM = [
  {
    title: "1 · Why take a spectrum?",
    body: "Pictures from a telescope can tell you that something got brighter — but not whether it was a real supernova, a star in our own galaxy, or something else pretending to be one. A spectrum spreads the object’s light into a rainbow and reveals fingerprints of atoms and molecules. That fingerprint is how teams proved they had the right kind of explosion and how they read off a distance-related redshift.",
  },
  {
    title: "2 · Calcium II as a built-in ruler",
    body: "Look for a pair of dips made by calcium in the gas (astronomers call the pair “Ca II”). The spacing between those dips is fixed by nature, like notches on a ruler. When the supernova is farther away, the whole spectrum — including those notches — is stretched toward longer wavelengths. Measuring how far the pattern slid tells you the redshift z, which you need before you can compare brightness to distance honestly.",
  },
  {
    title: "3 · Lock when the match looks right",
    body: "In the next tool, drag the vertical marker until it sits on the bottom of the calcium dip you trust. If you are within about 20 ångströms of the value in your table, you can lock. The game still uses the survey’s precomputed redshift for the final Hubble point so the numbers stay consistent with your course CSVs.",
  },
];

export const LIGHTCURVE = [
  {
    title: "1 · Watch it brighten, then fade",
    body: "You never measure a supernova once and walk away. Teams go back every few nights for weeks, take another picture through the same filter, and ask “how bright does the same explosion look tonight?” Each answer is one dot: same object, different night. Horizontal position is which night (days before or after peak); vertical position is how bright it appeared that night. Together the dots trace one rise and fall. The single number m you care for distance is only the brightness at the very top of that bump (around day 0) — not every dot’s magnitude.",
  },
  {
    title: "2 · From “how faint it looks” to distance",
    body: "Before you touch the plot, read the box below. It builds the whole chain in plain language: why magnitude feels backwards, why Type Ia events act like matched lightbulbs, what m, M, and μ are, and the exact numbers for this supernova so you see where the Hubble y-axis comes from.",
  },
  {
    title: "3 · Add the point to the Hubble diagram",
    body: "Remember: many noisy dots on the light curve are many nights of the same event; the Hubble diagram needs one peak m (and a redshift) per object. After you lock in the story for this object, the game drops a point using the survey’s full reduction (z_obs, μ_obs). Many such points compared to curved predictions from different universes — that ensemble comparison, not any single supernova — is what made the dark-energy case.",
  },
];
