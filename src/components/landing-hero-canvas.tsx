// The landing hero ticket: a violet/ember halftone on a 12px dot grid, with
// five limestone balls gliding on Lissajous lanes. Ported from the approved
// v6 mockup. Drawing happens in the mockup's 1376x820 coordinate space and is
// scaled to the element, so the ticket keeps its proportions at any width.
"use client";

import { useEffect, useRef } from "react";

const W = 1376;
const H = 820;
const R = 40;

const TLW = 900;
const TLH = 330;
const SX = 880;
const SY = 548;
const NY = 440;
const NR = 26;
const P = 12;
const LOOP = 12;

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function createNoise() {
  const perm = new Uint8Array(512);
  let seed = 7;
  const p = Array.from({ length: 256 }, (_, index) => index);
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function grad(hash: number, x: number, y: number, z: number) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  function noise(x: number, y: number, z: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;
    return lerp(
      lerp(
        lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
        lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u),
        v,
      ),
      lerp(
        lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
        lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u),
        v,
      ),
      w,
    );
  }

  return { noise };
}

const { noise } = createNoise();

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const CLUSTERS = [
  { cx: 330, cy: 450, ax: 240, ay: 45, kx: 1, ky: 2, px: 0, py: 0 },
  { cx: 1010, cy: 450, ax: 280, ay: 45, kx: 1, ky: 2, px: 2, py: 1 },
  { cx: 1135, cy: 220, ax: 150, ay: 120, kx: 2, ky: 1, px: 1, py: 2.2 },
  { cx: 220, cy: 640, ax: 130, ay: 90, kx: 1, ky: 2, px: 3.3, py: 0.7 },
  { cx: 640, cy: 640, ax: 150, ay: 90, kx: 2, ky: 1, px: 4, py: 1.3 },
] as const;

function ticketPath(g: CanvasRenderingContext2D) {
  const points: ReadonlyArray<[number, number]> = [
    [TLW, 0],
    [W, 0],
    [W, SY],
    [SX, SY],
    [SX, H],
    [0, H],
    [0, TLH],
    [TLW, TLH],
  ];
  const mid = (a: readonly [number, number], b: readonly [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  g.beginPath();
  const start = mid(points[points.length - 1], points[0]);
  g.moveTo(start[0], start[1]);
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const m = mid(a, b);
    g.arcTo(a[0], a[1], m[0], m[1], R);
  }
  g.closePath();
}

function drawFrame(g: CanvasRenderingContext2D, t: number) {
  const theta = (2 * Math.PI * (t % LOOP)) / LOOP;
  g.clearRect(0, 0, W, H);
  g.save();
  ticketPath(g);
  g.clip();

  g.fillStyle = "#524ae9";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#fc5000";

  const ax = Math.cos(theta) * 0.32;
  const ay = Math.sin(theta) * 0.32;
  const bx = Math.cos(-theta) * 0.22;
  const by = Math.sin(-theta) * 0.22;

  for (let y = P / 2; y < H; y += P) {
    for (let x = P / 2; x < W; x += P) {
      const n =
        noise(x * 0.0038 + ax, y * 0.0038 + ay, 0.5) +
        0.5 * noise(x * 0.009 + bx, y * 0.009 + by, 3.7);
      const value = smoothstep(-0.18, 0.32, n);
      if (value < 0.04) continue;
      g.beginPath();
      g.arc(x, y, P * 0.62 * value, 0, 7);
      g.fill();
    }
  }

  // Five limestone balls: one per lane, on a 12s Lissajous loop.
  const T = (2 * Math.PI) / 12;
  for (const c of CLUSTERS) {
    const x = c.cx + c.ax * Math.sin(c.kx * T * t + c.px);
    const y = c.cy + c.ay * Math.sin(c.ky * T * t + c.py);
    g.fillStyle = "#f7f6f2";
    g.beginPath();
    g.arc(x, y, 14, 0, 7);
    g.fill();
  }

  g.restore();

  // Notches and tear line along the ticket seam.
  g.save();
  g.globalCompositeOperation = "destination-out";
  for (const x of [0, W]) {
    g.beginPath();
    g.arc(x, NY, NR, 0, 7);
    g.fill();
  }
  g.restore();

  g.fillStyle = "rgba(247,246,242,.85)";
  for (let x = NR + 16; x < W - NR - 12; x += 14) {
    g.beginPath();
    g.arc(x, NY, 2.2, 0, 7);
    g.fill();
  }
}

export function LandingHeroCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let startedAt = 0;
    let width = 0;
    let height = 0;
    let ratio = 1;

    const draw = (t: number) => {
      if (!width || !height) return;
      g.setTransform(ratio * (width / W), 0, 0, ratio * (height / H), 0, 0);
      drawFrame(g, t);
    };

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const tick = (now: number) => {
      draw((now - startedAt) / 1000);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      stop();
      if (motion.matches) {
        draw(1.2);
        return;
      }
      startedAt = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.round(nextWidth * ratio);
      canvas.height = Math.round(nextHeight * ratio);
      draw(performance.now() / 1000);
    };

    const onMotionChange = () => start();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    motion.addEventListener("change", onMotionChange);
    resize();
    start();

    return () => {
      stop();
      observer.disconnect();
      motion.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
