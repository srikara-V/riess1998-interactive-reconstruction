"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { hashString, mulberry32 } from "@/lib/gameMath";

type Props = { snName: string; mApparent: number; onFound: () => void };

/** Matches new-epoch SN fill `rgba(255,230,180,…)` — residual should read as the same light. */
const SN_R = 255;
const SN_G = 230;
const SN_B = 180;

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clampByte(v: number) {
  return Math.max(0, Math.min(255, v));
}

/**
 * Pogson flux vs m=22; brighter (smaller m) → larger `brightness_scale`.
 * Dot radius follows user spec `3 + brightness_scale * 8`, clamped so very bright CSV m still fits the canvas.
 */
function discoverySnVisual(mApparent: number) {
  const brightness_scale = Math.pow(10, -(mApparent - 22) / 2.5);
  const dotRadius = Math.min(15, Math.max(2.2, 3 + brightness_scale * 8));
  const fillAlpha = Math.min(0.98, 0.36 + 0.26 * Math.log10(1 + brightness_scale));
  const strokeAlpha = Math.min(0.82, 0.22 + 0.38 * Math.log10(1 + brightness_scale));
  const strokeW = Math.min(2.8, 1.05 + 0.5 * Math.log10(1 + brightness_scale));
  const residualAmp = 92 * Math.min(1.9, Math.max(0.45, Math.pow(brightness_scale, 0.36)));
  const sigmaMul = Math.min(1.28, 1 + 0.11 * Math.log10(1 + brightness_scale));
  const clickSlop = Math.min(22, Math.max(12, dotRadius * 1.35));
  return { brightness_scale, dotRadius, fillAlpha, strokeAlpha, strokeW, residualAmp, sigmaMul, clickSlop };
}

export function DiscoveryInteractive({ snName, mApparent, onFound }: Props) {
  const templateRef = useRef<HTMLCanvasElement>(null);
  const newRef = useRef<HTMLCanvasElement>(null);
  const diffRef = useRef<HTMLCanvasElement>(null);

  const geo = useMemo(() => {
    const W = 320;
    const H = 200;
    const rng = mulberry32(hashString(snName));
    const stars = [];
    for (let i = 0; i < 95; i++) {
      stars.push({ x: rng() * W, y: rng() * H, r: rng() * 1.4 + 0.3, b: rng() * 0.5 + 0.45 });
    }
    const nx = 0.55 * W + (rng() - 0.5) * 40;
    const ny = 0.42 * H + (rng() - 0.5) * 36;
    const hostCx = nx + (rng() - 0.5) * 22;
    const hostCy = ny + (rng() - 0.5) * 18;
    const ringR = 6.5 + rng() * 3;
    const dipSign = rng() > 0.5 ? 1 : -1;
    return { w: W, h: H, stars, nx, ny, hostCx, hostCy, ringR, dipSign };
  }, [snName]);

  const snVis = useMemo(() => discoverySnVisual(mApparent), [mApparent]);

  useLayoutEffect(() => {
    const { w, h, stars, nx, ny, hostCx, hostCy, ringR, dipSign } = geo;
    const { dotRadius, fillAlpha, strokeAlpha, strokeW, residualAmp, sigmaMul } = snVis;

    function paintOnto(ctx: CanvasRenderingContext2D, epoch: "template" | "new", withSN: boolean) {
      ctx.fillStyle = "#05070a";
      ctx.fillRect(0, 0, w, h);

      const hostPeak = epoch === "template" ? 0.09 : 0.2;
      const gHost = ctx.createRadialGradient(hostCx, hostCy, 0, hostCx, hostCy, 58);
      gHost.addColorStop(0, `rgba(72,48,36,${hostPeak})`);
      gHost.addColorStop(0.38, `rgba(38,30,26,${hostPeak * 0.55})`);
      gHost.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gHost;
      ctx.fillRect(0, 0, w, h);

      const starMul = epoch === "template" ? 0.88 : 1;
      const [tr, tg, tb] = epoch === "template" ? ([216, 232, 255] as const) : ([230, 240, 255] as const);

      for (const s of stars) {
        const b = Math.min(0.98, s.b * starMul);
        ctx.fillStyle = `rgba(${tr},${tg},${tb},${b})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (withSN) {
        ctx.fillStyle = `rgba(255,230,180,${fillAlpha})`;
        ctx.beginPath();
        ctx.arc(nx, ny, dotRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,200,120,${strokeAlpha})`;
        ctx.lineWidth = strokeW;
        ctx.stroke();
      }
    }

    function addReadNoise(img: ImageData, seedExtra: string, strength: number) {
      const rng = mulberry32(hashString(snName + seedExtra));
      for (let i = 0; i < img.data.length; i += 4) {
        const tri = () => rng() + rng() - 1;
        const n = tri() * strength;
        const nG = tri() * strength * 0.96;
        const nB = tri() * strength * 1.02;
        img.data[i] = clampByte(img.data[i] + n);
        img.data[i + 1] = clampByte(img.data[i + 1] + nG);
        img.data[i + 2] = clampByte(img.data[i + 2] + nB);
      }
    }

    function renderField(epoch: "template" | "new", withSN: boolean): ImageData {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return new ImageData(w, h);
      paintOnto(ctx, epoch, withSN);
      const img = ctx.getImageData(0, 0, w, h);
      addReadNoise(img, epoch === "template" ? "readTemplate" : "readNew", epoch === "template" ? 4.4 : 2.5);
      return img;
    }

    const tCan = templateRef.current?.getContext("2d");
    const nCan = newRef.current?.getContext("2d");
    const diffCtx = diffRef.current?.getContext("2d", { willReadFrequently: true });
    if (!tCan || !nCan || !diffCtx) return;

    const tImg = renderField("template", false);
    const nImg = renderField("new", true);
    tCan.putImageData(tImg, 0, 0);
    nCan.putImageData(nImg, 0, 0);
    const out = diffCtx.createImageData(w, h);
    const rngN = mulberry32(hashString(snName + "residual"));

    const baseR = 9;
    const baseG = 9;
    const baseB = 11;
    const gain = 5.6;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lt = luminance(tImg.data[i], tImg.data[i + 1], tImg.data[i + 2]);
        const ln = luminance(nImg.data[i], nImg.data[i + 1], nImg.data[i + 2]);
        let d = ln - lt;

        const dhx = x - hostCx;
        const dhy = y - hostCy;
        const dh = Math.hypot(dhx, dhy);
        d +=
          0.36 * Math.exp(-((dh - ringR) * (dh - ringR)) / 28) -
          0.24 * Math.exp(-(dh * dh) / 115);
        const dipU = dh > 0.35 ? dhx / dh : 0;
        d += dipSign * 0.13 * dipU * Math.exp(-(dh * dh) / (2 * 4.6 * 4.6));

        const tri = () => rngN() + rngN() - 1;
        const nR = tri() * 2.35;
        const nG = tri() * 2.25;
        const nB = tri() * 2.3;

        const rs = Math.hypot(x - nx, y - ny);
        const s1 = 1.48 * sigmaMul;
        const s2 = 3.15 * sigmaMul;
        const s3 = 5.35 * sigmaMul;
        const psf =
          Math.exp(-(rs * rs) / (2 * s1 * s1)) +
          0.52 * Math.exp(-(rs * rs) / (2 * s2 * s2)) +
          0.3 * Math.exp(-(rs * rs) / (2 * s3 * s3));
        const fade = 1 - Math.min(0.96, psf * 0.95);

        let r = baseR + gain * d * fade + nR;
        let g = baseG + gain * d * fade + nG;
        let b = baseB + gain * d * fade + nB;

        const wR = SN_R / 255;
        const wG = SN_G / 255;
        const wB = SN_B / 255;
        r += psf * residualAmp * wR;
        g += psf * residualAmp * wG;
        b += psf * residualAmp * wB;

        const grain = tri() * 1.65;
        r += grain;
        g += grain * 0.96;
        b += grain * 1.03;

        out.data[i] = clampByte(r);
        out.data[i + 1] = clampByte(g);
        out.data[i + 2] = clampByte(b);
        out.data[i + 3] = 255;
      }
    }
    diffCtx.putImageData(out, 0, 0);
  }, [geo, snName, snVis]);

  return (
    <div className="font-ui grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="text-center">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Template</h3>
        <canvas ref={templateRef} width={geo.w} height={geo.h} className="mx-auto w-full max-w-[360px] rounded-lg border border-stone-200 bg-black" />
      </div>
      <div className="text-center">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">New epoch</h3>
        <canvas ref={newRef} width={geo.w} height={geo.h} className="mx-auto w-full max-w-[360px] rounded-lg border border-stone-200 bg-black" />
      </div>
      <div className="text-center">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-900">Difference</h3>
        <p className="mb-1 text-[10px] leading-tight text-stone-500">new − template (residual)</p>
        <canvas
          ref={diffRef}
          width={geo.w}
          height={geo.h}
          className="mx-auto w-full max-w-[360px] cursor-crosshair rounded-lg border border-amber-700/35 bg-black shadow-sm"
          onClick={(ev) => {
            const c = ev.currentTarget;
            const rect = c.getBoundingClientRect();
            const sx = ((ev.clientX - rect.left) / rect.width) * geo.w;
            const sy = ((ev.clientY - rect.top) / rect.height) * geo.h;
            if (Math.hypot(sx - geo.nx, sy - geo.ny) < snVis.clickSlop) onFound();
          }}
        />
      </div>
    </div>
  );
}
