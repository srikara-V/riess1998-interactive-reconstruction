/**
 * Dark Energy Discovery — loads precomputed CSVs (serve repo root, e.g. `python -m http.server`).
 */

const DATA = {
  precomputation: "data/precomputation.csv",
  modelCurves: "data/model_curves.csv",
  lightCurve: "data/light_curve_template.csv",
  spectrum: "data/spectrum_template_rest.csv",
};

const Z_AXIS = { min: 0.01, max: 1.2 };
const MU_AXIS = { min: 32, max: 46 };
const CAII_REST = 3934;
const M_REF = -19.3;

/** --- CSV --- */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = [];
    let cur = "";
    let q = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        q = !q;
        continue;
      }
      if (ch === "," && !q) {
        cells.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cells.push(cur.trim());
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

async function loadText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.text();
}

function num(x, fallback = NaN) {
  if (typeof x === "number") return Number.isFinite(x) ? x : fallback;
  const v = parseFloat(String(x).replace(/,/g, ""));
  return Number.isFinite(v) ? v : fallback;
}

/** --- RNG --- */
function hashString(s) {
  let h = 1779033703;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(rng) {
  const u = rng() || 1e-12;
  const v = rng() || 1e-12;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** --- Interpolate light curve template --- */
function interpolateLC(template, t) {
  const rows = template;
  if (!rows.length) return 0;
  let i0 = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i + 1].phase_days >= t) {
      i0 = i;
      break;
    }
    i0 = i;
  }
  const a = rows[i0];
  const b = rows[Math.min(i0 + 1, rows.length - 1)];
  const ta = a.phase_days;
  const tb = b.phase_days;
  if (tb <= ta) return a.dm_from_peak_mag;
  const u = (t - ta) / (tb - ta);
  return a.dm_from_peak_mag + u * (b.dm_from_peak_mag - a.dm_from_peak_mag);
}

/** --- Global game refs --- */
let supernovae = [];
let curves = { EdS: [], open_matter: [], flat_LCDM: [] };
let lcTemplate = [];
let specTemplate = [];

const state = {
  currentIndex: 0,
  phase: "discovery",
  observations: [],
  guessPrompted: false,
  guessAutoShown: false,
  ended: false,
  highlightLCDM: false,
  newStarPos: { x: 0, y: 0 },
  spectrumLineLambda: 0,
  lightCurvePoints: [],
  pendingFlash: null,
};

const els = {
  phaseBanner: document.getElementById("phase-banner"),
  phaseUi: document.getElementById("phase-ui"),
  snLabel: document.getElementById("sn-label"),
  snCount: document.getElementById("sn-count"),
  canvasHubble: document.getElementById("canvas-hubble"),
  canvasResidual: document.getElementById("canvas-residual"),
  legend: document.getElementById("legend-models"),
  modalGuess: document.getElementById("modal-guess"),
  modalEnd: document.getElementById("modal-end"),
  chiReadout: document.getElementById("chi-readout"),
  chiFinal: document.getElementById("chi-final"),
  toast: document.getElementById("toast"),
  btnGuess: document.getElementById("btn-guess"),
  btnReplay: document.getElementById("btn-replay"),
};

function toast(msg, cls = "") {
  els.toast.textContent = msg;
  els.toast.className = "toast" + (cls ? " " + cls : "");
  els.toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.add("hidden"), 3200);
}

/** --- Plot transforms --- */
function xHubble(z, w) {
  const lo = Math.log10(Z_AXIS.min);
  const hi = Math.log10(Z_AXIS.max);
  const lz = Math.log10(Math.max(z, Z_AXIS.min));
  return ((lz - lo) / (hi - lo)) * w;
}

function yHubble(mu, h) {
  const lo = MU_AXIS.min;
  const hi = MU_AXIS.max;
  return h - ((mu - lo) / (hi - lo)) * h;
}

function muResidualCurve(modelKey, i) {
  const muM = curves[modelKey][i].mu_theory;
  const muO = curves.open_matter[i].mu_theory;
  return muM - muO;
}

function residualRange(obs) {
  let lo = -0.6,
    hi = 0.8;
  for (const o of obs) {
    lo = Math.min(lo, o.residual - 0.15);
    hi = Math.max(hi, o.residual + 0.15);
  }
  return { lo, hi };
}

function yResid(r, h, lo, hi) {
  return h - ((r - lo) / (hi - lo)) * h;
}

function setupCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(200, Math.floor(rect.width * dpr));
  const h = Math.floor((canvas.id === "canvas-hubble" ? 280 : 160) * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cssW = rect.width;
  const cssH = canvas.id === "canvas-hubble" ? 280 : 160;
  return { ctx, w: cssW, h: cssH, dpr };
}

function drawHubble() {
  const { ctx, w, h } = setupCanvas(els.canvasHubble);
  ctx.fillStyle = "#0a0d12";
  ctx.fillRect(0, 0, w, h);
  const padL = 44,
    padR = 12,
    padT = 10,
    padB = 34;
  const iw = w - padL - padR;
  const ih = h - padT - padB;

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const mu = MU_AXIS.min + (i / 4) * (MU_AXIS.max - MU_AXIS.min);
    const y = padT + yHubble(mu, ih) - yHubble(MU_AXIS.max, ih);
    ctx.beginPath();
    ctx.moveTo(padL, padT + y);
    ctx.lineTo(padL + iw, padT + y);
    ctx.stroke();
    ctx.fillStyle = "#6b7788";
    ctx.font = "10px system-ui";
    ctx.fillText(mu.toFixed(0), 4, padT + y + 3);
  }
  const zTicks = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0];
  ctx.textAlign = "center";
  for (const zt of zTicks) {
    const x = padL + xHubble(zt, iw);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + ih);
    ctx.stroke();
    ctx.fillStyle = "#6b7788";
    ctx.fillText(zt >= 0.1 ? zt.toFixed(1) : zt.toFixed(2), x, padT + ih + 22);
  }

  function drawCurve(key, color, lwOverride) {
    ctx.beginPath();
    const arr = curves[key];
    for (let i = 0; i < arr.length; i++) {
      const z = arr[i].z;
      const mu = arr[i].mu_theory;
      const x = padL + xHubble(z, iw);
      const y = padT + yHubble(mu, ih);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    const base = key === "flat_LCDM" ? 2.2 : 1.4;
    ctx.lineWidth = lwOverride != null ? lwOverride : base;
    ctx.stroke();
  }
  drawCurve("EdS", "#ff9b6b");
  drawCurve("open_matter", "#9aa3b2");
  drawCurve("flat_LCDM", "#8fd4ff", state.highlightLCDM ? 4.5 : 2.2);

  for (const o of state.observations) {
    const x = padL + xHubble(o.z_obs, iw);
    const y = padT + yHubble(o.mu_obs, ih);
    const sig = o.sigma_mu;
    const yTop = padT + yHubble(o.mu_obs + sig, ih);
    const yBot = padT + yHubble(o.mu_obs - sig, ih);
    ctx.strokeStyle = "rgba(232,237,244,0.55)";
    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.lineTo(x, yBot);
    ctx.stroke();
    ctx.fillStyle = o.flash ? "#fff" : "#e8edf4";
    ctx.beginPath();
    ctx.arc(x, y, o.flash ? 6 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#9aa3b2";
  ctx.font = "11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("μ (distance modulus)", padL, padT - 2);
  ctx.textAlign = "center";
  ctx.fillText("redshift z (log scale)", padL + iw / 2, h - 6);
}

function drawResidual() {
  const { ctx, w, h } = setupCanvas(els.canvasResidual);
  ctx.fillStyle = "#0a0d12";
  ctx.fillRect(0, 0, w, h);
  const padL = 44,
    padR = 12,
    padT = 10,
    padB = 28;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const { lo, hi } = residualRange(state.observations);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i <= 4; i++) {
    const r = lo + (i / 4) * (hi - lo);
    const y = padT + yResid(r, ih, lo, hi);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + iw, y);
    ctx.stroke();
    ctx.fillStyle = "#6b7788";
    ctx.font = "10px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(r.toFixed(2), 4, y + 3);
  }
  ctx.strokeStyle = "rgba(110,181,255,0.35)";
  ctx.setLineDash([4, 4]);
  const y0 = padT + yResid(0, ih, lo, hi);
  ctx.beginPath();
  ctx.moveTo(padL, y0);
  ctx.lineTo(padL + iw, y0);
  ctx.stroke();
  ctx.setLineDash([]);

  const n = curves.EdS.length;
  function drawResCurve(modelKey, color) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const z = curves.EdS[i].z;
      const r = muResidualCurve(modelKey, i);
      const x = padL + xHubble(z, iw);
      const y = padT + yResid(r, ih, lo, hi);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = modelKey === "flat_LCDM" ? 2 : 1.2;
    ctx.stroke();
  }
  drawResCurve("EdS", "#ff9b6b");
  drawResCurve("open_matter", "#9aa3b2");
  drawResCurve("flat_LCDM", "#6eb5ff");

  for (const o of state.observations) {
    const x = padL + xHubble(o.z_obs, iw);
    const y = padT + yResid(o.residual, ih, lo, hi);
    ctx.fillStyle = o.flash ? "#fff" : "#e8edf4";
    ctx.beginPath();
    ctx.arc(x, y, o.flash ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#9aa3b2";
  ctx.font = "10px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("Δμ vs open matter", padL, padT - 2);
}

function redrawPlots() {
  drawHubble();
  drawResidual();
}

/** --- Phases --- */
function currentSN() {
  return supernovae[state.currentIndex];
}

function updateHeader() {
  const sn = currentSN();
  if (!sn) {
    els.snLabel.textContent = "Complete";
    els.snCount.textContent = "";
    return;
  }
  els.snLabel.textContent = `SN ${sn.sn_name}`;
  els.snCount.textContent = `(${state.currentIndex + 1} / ${supernovae.length})`;
}

function maybeTriggerGuess() {
  if (state.guessPrompted || state.ended) return false;
  if (state.currentIndex < 1) return false;
  const idx = state.currentIndex - 1;
  const sn = supernovae[idx];
  const chiEd = num(sn.cumchi2_EdS_after_this_sequence);
  const chiOp = num(sn.cumchi2_open_matter_after_this_sequence);
  const chiLc = num(sn.cumchi2_flat_LCDM_after_this_sequence);
  const LCDMwinning = chiLc < chiOp && chiLc < chiEd;
  const enoughData = state.currentIndex >= 20;
  if (LCDMwinning && enoughData) {
    state.guessPrompted = true;
    state.guessAutoShown = true;
    openGuessModal(sn, { auto: true });
    return true;
  }
  return false;
}

function openGuessModal(sn, opts = {}) {
  els.chiReadout.innerHTML = [
    `χ² (EdS): <strong>${num(sn.cumchi2_EdS_after_this_sequence).toFixed(2)}</strong>`,
    `χ² (Ω_m=0.3 matter): <strong>${num(sn.cumchi2_open_matter_after_this_sequence).toFixed(2)}</strong>`,
    `χ² (flat ΛCDM): <strong>${num(sn.cumchi2_flat_LCDM_after_this_sequence).toFixed(2)}</strong>`,
  ].join("<br/>");
  els.modalGuess.classList.remove("hidden");
  if (!opts.auto) els.modalGuess.querySelector(".guess-btn").focus?.();
}

function closeGuessModal() {
  els.modalGuess.classList.add("hidden");
}

function finalizeEnding(reason) {
  state.ended = true;
  state.highlightLCDM = true;
  const last = supernovae[supernovae.length - 1];
  const chiLines = last
    ? [
        `Final χ² — EdS: <strong>${num(last.cumchi2_EdS_after_this_sequence).toFixed(2)}</strong>`,
        `Ω_m=0.3 open: <strong>${num(last.cumchi2_open_matter_after_this_sequence).toFixed(2)}</strong>`,
        `flat ΛCDM: <strong>${num(last.cumchi2_flat_LCDM_after_this_sequence).toFixed(2)}</strong>`,
      ].join("<br/>")
    : "";
  els.chiFinal.innerHTML = chiLines + (reason ? `<p class="modal-sub">${reason}</p>` : "");
  els.modalEnd.classList.remove("hidden");
}

function revealAllRemainingPoints() {
  let delay = 0;
  for (let i = state.currentIndex; i < supernovae.length; i++) {
    const sn = supernovae[i];
    setTimeout(() => {
      state.observations.push({
        z_obs: num(sn.z_obs),
        mu_obs: num(sn.mu_obs),
        sigma_mu: num(sn.sigma_mu),
        residual: num(sn.residual_obs_minus_open_matter_at_z_obs),
        flash: true,
      });
      redrawPlots();
      setTimeout(() => {
        const o = state.observations[state.observations.length - 1];
        if (o) o.flash = false;
        redrawPlots();
      }, 650);
    }, delay);
    delay += 40;
  }
  state.currentIndex = supernovae.length;
  redrawPlots();
}

function discoveryPhase() {
  const sn = currentSN();
  if (!sn) {
    finalizeEnding("");
    return;
  }
  state.phase = "discovery";
  els.phaseBanner.textContent = "Phase 1 — Discovery (difference imaging)";
  const seed = hashString(sn.sn_name);
  const rng = mulberry32(seed);
  const w = 320,
    h = 200;
  const nStars = 95;
  const stars = [];
  for (let i = 0; i < nStars; i++) {
    stars.push({ x: rng() * w, y: rng() * h, r: rng() * 1.4 + 0.3, b: rng() * 0.5 + 0.45 });
  }
  const nx = 0.55 * w + (rng() - 0.5) * 40;
  const ny = 0.42 * h + (rng() - 0.5) * 36;
  state.newStarPos = { x: nx, y: ny };

  function drawField(canvas, withSN) {
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, w, h);
    for (const s of stars) {
      ctx.fillStyle = `rgba(230,240,255,${s.b})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (withSN) {
      ctx.fillStyle = "rgba(255,230,180,0.95)";
      ctx.beginPath();
      ctx.arc(nx, ny, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,200,120,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  els.phaseUi.innerHTML = `
    <p class="hint">Two epochs of the same field. Click the <strong>new</strong> point source in the right panel.</p>
    <div class="phase-grid">
      <div class="star-panel"><h3>Before</h3><canvas class="star-canvas" width="${w}" height="${h}"></canvas></div>
      <div class="star-panel"><h3>After</h3><canvas class="star-canvas sn-canvas" width="${w}" height="${h}"></canvas></div>
    </div>`;
  const [cBefore, cAfter] = els.phaseUi.querySelectorAll("canvas");
  drawField(cBefore, false);
  drawField(cAfter, true);

  cAfter.addEventListener(
    "click",
    (ev) => {
      const rect = cAfter.getBoundingClientRect();
      const sx = ((ev.clientX - rect.left) / rect.width) * w;
      const sy = ((ev.clientY - rect.top) / rect.height) * h;
      const d = Math.hypot(sx - nx, sy - ny);
      if (d < 18) {
        toast("Candidate confirmed — spectroscopy next.");
        spectrumPhase();
      } else toast("Try the new source in the after image.", "warn");
    },
    { once: false }
  );
}

function spectrumPhase() {
  const sn = currentSN();
  state.phase = "spectrum";
  els.phaseBanner.textContent = "Phase 2 — Spectrum (redshift)";
  const rng = mulberry32(hashString(sn.sn_name + "spec"));
  const pts = specTemplate.map((row) => {
    const lr = num(row.lambda_rest_A);
    const lambdaObs = lr * (1 + num(sn.z_true));
    const flux = num(row.flux_norm) + randn(rng) * 0.03;
    return { lambdaObs, flux };
  });
  const lamMin = pts[0].lambdaObs;
  const lamMax = pts[pts.length - 1].lambdaObs;
  state.spectrumLineLambda = (lamMin + lamMax) / 2;

  els.phaseUi.innerHTML = `
    <p class="hint">Drag the vertical line onto the Ca&nbsp;II absorption minimum (compare to your table value after locking).</p>
    <div class="spectrum-wrap"><canvas id="cv-spec" width="640" height="220"></canvas></div>
    <div class="axis-label">Observed wavelength (Å) · flux + noise</div>
    <p class="drag-hint" id="z-readout"></p>
    <div class="controls">
      <button type="button" id="btn-lock-z" disabled>Lock redshift</button>
    </div>`;

  const cv = document.getElementById("cv-spec");
  const ctx = cv.getContext("2d");
  const readout = document.getElementById("z-readout");
  const btnLock = document.getElementById("btn-lock-z");

  function lambdaFromClientX(clientX) {
    const rect = cv.getBoundingClientRect();
    const u = (clientX - rect.left) / rect.width;
    return lamMin + u * (lamMax - lamMin);
  }

  function drawSpec() {
    const w = cv.width,
      h = cv.height;
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, w, h);
    let fmin = Infinity,
      fmax = -Infinity;
    for (const p of pts) {
      fmin = Math.min(fmin, p.flux);
      fmax = Math.max(fmax, p.flux);
    }
    const pad = 16;
    const iw = w - pad * 2;
    const ih = h - pad * 2;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = pad + ((pts[i].lambdaObs - lamMin) / (lamMax - lamMin)) * iw;
      const y = pad + ih - ((pts[i].flux - fmin) / (fmax - fmin || 1)) * ih;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(200,215,235,0.85)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const lx = pad + ((state.spectrumLineLambda - lamMin) / (lamMax - lamMin)) * iw;
    ctx.strokeStyle = "#6eb5ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, pad);
    ctx.lineTo(lx, pad + ih);
    ctx.stroke();
  }

  function updateReadout() {
    const zMeas = state.spectrumLineLambda / CAII_REST - 1;
    readout.innerHTML = `Line center: <strong>${state.spectrumLineLambda.toFixed(1)} Å</strong> → z<sub>meas</sub> = <strong>${zMeas.toFixed(4)}</strong> (plot uses precomputed z<sub>obs</sub> = ${num(sn.z_obs).toFixed(4)})`;
    const ok = Math.abs(state.spectrumLineLambda - num(sn.lambda_CaII)) < 20;
    btnLock.disabled = !ok;
    drawSpec();
  }

  let dragging = false;
  cv.addEventListener("pointerdown", (e) => {
    dragging = true;
    cv.setPointerCapture(e.pointerId);
    state.spectrumLineLambda = lambdaFromClientX(e.clientX);
    updateReadout();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    state.spectrumLineLambda = Math.min(lamMax, Math.max(lamMin, lambdaFromClientX(e.clientX)));
    updateReadout();
  });
  cv.addEventListener("pointerup", () => {
    dragging = false;
  });

  btnLock.addEventListener("click", () => {
    toast("Redshift recorded. Light curve next.");
    lightCurvePhase();
  });
  updateReadout();
}

function lightCurvePhase() {
  const sn = currentSN();
  state.phase = "lightcurve";
  els.phaseBanner.textContent = "Phase 3 — Light curve (standard candle)";
  const rng = mulberry32(hashString(sn.sn_name + "lc"));
  const candidates = [];
  for (let t = -15; t <= 40; t += 2) candidates.push(t);
  // ~12 epochs
  const phases = [];
  while (phases.length < 12 && candidates.length) {
    const idx = Math.floor(rng() * candidates.length);
    phases.push(candidates.splice(idx, 1)[0]);
  }
  phases.sort((a, b) => a - b);
  const pts = phases.map((t) => {
    const dm = interpolateLC(lcTemplate, t);
    const mObs = num(sn.m_apparent) + dm + randn(rng) * 0.08;
    return { t, mObs };
  });
  state.lightCurvePoints = pts;

  els.phaseUi.innerHTML = `
    <p class="hint">Noisy photometry vs phase. Click <strong>Fit peak</strong> to read the standardized peak magnitude.</p>
    <div class="lightcurve-wrap"><canvas id="cv-lc" width="640" height="220"></canvas></div>
    <div class="axis-label">Phase (days) · magnitude (fainter upward)</div>
    <div class="controls">
      <button type="button" id="btn-fit-peak">Fit peak</button>
      <button type="button" id="btn-lc-continue" class="primary hidden">Add point to Hubble diagram</button>
    </div>
    <div id="peak-box" class="hidden">
      <p class="peak-readout" id="peak-readout"></p>
    </div>`;

  const cv = document.getElementById("cv-lc");
  const ctx = cv.getContext("2d");
  const tMin = -20,
    tMax = 45;
  const mPeak = num(sn.m_apparent);
  const mVals = pts.map((p) => p.mObs);
  const mMin = Math.min(...mVals, mPeak) - 0.25;
  const mMax = Math.max(...mVals, mPeak) + 0.35;
  const pad = 18;
  const iw = cv.width - pad * 2;
  const ih = cv.height - pad * 2;

  function yLc(m) {
    return pad + ih * ((m - mMin) / (mMax - mMin || 1));
  }

  function drawLC(showTemplate) {
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i <= 5; i++) {
      const m = mMin + (i / 5) * (mMax - mMin);
      const y = yLc(m);
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + iw, y);
      ctx.stroke();
      ctx.fillStyle = "#6b7788";
      ctx.font = "10px system-ui";
      ctx.fillText(m.toFixed(2), 2, y + 3);
    }
    if (showTemplate) {
      ctx.beginPath();
      for (let t = tMin; t <= tMax; t += 1) {
        const dm = interpolateLC(lcTemplate, t);
        const m = mPeak + dm;
        const x = pad + ((t - tMin) / (tMax - tMin)) * iw;
        const y = yLc(m);
        if (t === tMin) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(110,181,255,0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    for (const p of pts) {
      const x = pad + ((p.t - tMin) / (tMax - tMin)) * iw;
      const y = yLc(p.mObs);
      ctx.fillStyle = "#e8edf4";
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawLC(false);

  document.getElementById("btn-fit-peak").addEventListener("click", () => {
    drawLC(true);
    const muShown = mPeak - M_REF;
    document.getElementById("peak-box").classList.remove("hidden");
    document.getElementById("peak-readout").innerHTML =
      `Peak apparent magnitude <strong>m = ${mPeak.toFixed(2)}</strong> → distance modulus <strong>μ = m − M ≈ ${muShown.toFixed(2)}</strong> (using M = ${M_REF}).`;
    document.getElementById("btn-lc-continue").classList.remove("hidden");
  });
  document.getElementById("btn-lc-continue").addEventListener("click", () => {
    plotNewPointPhase();
  });
}

function plotNewPointPhase() {
  const sn = currentSN();
  state.phase = "plot";
  els.phaseBanner.textContent = "Phase 4 — Hubble diagram";
  els.phaseUi.innerHTML = `<p class="hint">Your measurement is added using the precomputed <strong>z<sub>obs</sub></strong> and <strong>μ<sub>obs</sub></strong> (with σ<sub>μ</sub>).</p>`;
  state.observations.push({
    z_obs: num(sn.z_obs),
    mu_obs: num(sn.mu_obs),
    sigma_mu: num(sn.sigma_mu),
    residual: num(sn.residual_obs_minus_open_matter_at_z_obs),
    flash: true,
  });
  redrawPlots();
  setTimeout(() => {
    const o = state.observations[state.observations.length - 1];
    if (o) o.flash = false;
    redrawPlots();
  }, 900);
  state.currentIndex += 1;
  const guessPaused = maybeTriggerGuess();
  updateHeader();
  setTimeout(() => {
    if (state.ended) return;
    if (guessPaused) return;
    if (state.currentIndex >= supernovae.length) {
      finalizeEnding("All supernovae in the sample have been plotted.");
      redrawPlots();
      return;
    }
    discoveryPhase();
  }, 1100);
}

/** --- Guess / end --- */
function wireGuessButtons() {
  els.modalGuess.querySelectorAll(".guess-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const choice = btn.getAttribute("data-guess");
      closeGuessModal();
      if (choice === "lcdm") {
        toast("Yes — the ensemble follows the accelerating model.");
        revealAllRemainingPoints();
        redrawPlots();
        finalizeEnding("You chose the model consistent with dark energy.");
      } else {
        toast("Not quite — keep observing. The high-z points stay above the decelerating curves.", "warn");
        els.btnGuess.classList.remove("hidden");
        if (!state.ended && state.currentIndex < supernovae.length) {
          discoveryPhase();
        }
      }
    });
  });
  els.btnGuess.addEventListener("click", () => {
    const idx = Math.max(0, state.currentIndex - 1);
    openGuessModal(supernovae[idx], { auto: false });
  });
  els.btnReplay.addEventListener("click", () => location.reload());
}

/** --- Boot --- */
async function boot() {
  try {
    const [preT, mcT, lcT, spT] = await Promise.all([
      loadText(DATA.precomputation),
      loadText(DATA.modelCurves),
      loadText(DATA.lightCurve),
      loadText(DATA.spectrum),
    ]);
    const preRows = parseCSV(preT);
    supernovae = preRows
      .filter((r) => (r.record_type || "supernova") === "supernova")
      .map((r) => ({
        ...r,
        z_true: num(r.z_true),
        z_obs: num(r.z_obs),
        mu_obs: num(r.mu_obs),
        sigma_mu: num(r.sigma_mu),
        m_apparent: num(r.m_apparent),
        lambda_CaII: num(r.lambda_CaII),
      }))
      .sort((a, b) => num(a.sequence_order_resolved) - num(b.sequence_order_resolved));

    const mcRows = parseCSV(mcT).map((r) => ({
      model_id: r.model_id,
      z: num(r.z),
      mu_theory: num(r.mu_theory),
    }));
    curves.EdS = mcRows.filter((r) => r.model_id === "EdS");
    curves.open_matter = mcRows.filter((r) => r.model_id === "open_matter");
    curves.flat_LCDM = mcRows.filter((r) => r.model_id === "flat_LCDM");

    lcTemplate = parseCSV(lcT).map((r) => ({
      phase_days: num(r.phase_days),
      dm_from_peak_mag: num(r.dm_from_peak_mag),
    }));

    specTemplate = parseCSV(spT).map((r) => ({
      lambda_rest_A: num(r.lambda_rest_A),
      flux_norm: num(r.flux_norm),
    }));

    els.legend.innerHTML = [
      `<span><i class="swatch" style="background:#ff9b6b"></i>Ω_m=1, Ω_Λ=0 (EdS)</span>`,
      `<span><i class="swatch" style="background:#9aa3b2"></i>Ω_m=0.3 open matter</span>`,
      `<span><i class="swatch" style="background:#6eb5ff"></i>Ω_m=0.3, Ω_Λ=0.7 flat</span>`,
    ].join("");

    wireGuessButtons();
    window.addEventListener("resize", redrawPlots);
    updateHeader();
    redrawPlots();
    discoveryPhase();
  } catch (e) {
    console.error(e);
    els.phaseBanner.textContent = "Could not load data";
    els.phaseUi.innerHTML = `<p class="hint">Run a local server from the project folder (CSV fetch is blocked on <code>file://</code>):</p>
      <pre style="color:#cfe">python -m http.server 8080</pre>
      <p class="hint">Then open <code>http://localhost:8080</code></p>
      <p class="hint" style="color:#f99">${String(e.message || e)}</p>`;
  }
}

boot();
