/** Pedagogical copy for each pipeline stage (High-z Supernova Search Team–style workflow). */

export const WELCOME = {
  title: "How the High-z team measured the universe",
  body: [
    "In the 1990s, the High-z Supernova Search Team (Harvard / CfA–led, with partners worldwide) hunted distant Type Ia supernovae. Each object had to be discovered, confirmed, followed photometrically, and tied to a redshift before it became one point on a Hubble diagram.",
    "This walkthrough follows that real pipeline one candidate at a time: discovery flags a transient, spectroscopy confirms the explosion type and gives a redshift, photometry standardizes the candle, and only then do you get a distance point on the Hubble diagram.",
  ],
};

export const DISCOVERY = [
  {
    title: "1 · Wide-field imaging campaigns",
    body: "Teams re-imaged patches of sky on a ~3-week cadence near new moon. The goal is transients: anything that appears in the new epoch but not the template epoch.",
  },
  {
    title: "2 · Click the residual in the difference image",
    body: [
      "Take a template image of the field.",
      "Take a new-epoch image of that same field a few weeks later.",
      "Align the images, match their PSFs, and normalize the flux scale.",
      "Subtract template from new epoch so the static stars and galaxies mostly cancel away.",
      "What remains is the residual map: anything that changed between the two visits.",
      "Confirm the transient on that residual map, not by hunting the field in the new image alone.",
      "Once the clean point source is marked, the team would queue spectroscopy and multi-color follow-up.",
    ],
  },
];

export const SPECTRUM = [
  {
    title: "1 · Taking the spectrum",
    body: "Hydrogen gas in the host galaxy glows at a known wavelength, 6563 Å (Hα), when observed nearby. When the galaxy is receding, that glow is stretched to longer wavelengths along with the rest of the spectrum. Measuring how far the emission peak shifted gives you z, which you need before you can compare brightness to distance.",
  },
  {
    title: "2 · Lock when the match looks right",
    body: "In the next tool, drag the vertical marker to the host galaxy's Hα emission spike. If you are within about 20 ångströms of the value in your table, you can lock.",
  },
];

export const LIGHTCURVE = [
  {
    title: "1 · Watching it brighten, then fade",
    body: [
      "Teams go back every few nights for weeks and take another image through the same filter.",
      "Each dot is one measurement of the same supernova on a different night.",
      "Horizontal position is which night it was observed (days before or after peak).",
      "Vertical position is how bright it looked that night.",
      "Together the dots trace one rise and fall.",
      "The single number m you care about for distance is only the brightness at the very top of that bump (around day 0), not every dot's magnitude."
    ],
  },
  {
    title: "2 · From “how faint it looks” to distance",
    body: "Before you use the plot, read the box below.",
  },
  {
    title: "3 · Add the point to the Hubble diagram",
    body: [
      "Many noisy dots on the light curve are many nights of the same event.",
      "The Hubble diagram needs one peak m and one redshift per object.",
      "After you finish this object, the game drops a point using the survey’s full reduction (z_obs, μ_obs).",
    ],
  },
];
