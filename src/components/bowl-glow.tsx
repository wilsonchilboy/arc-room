import { useEffect, useRef } from "react";

const KEYS = [
  { q: 0, tip: 0.14, half: 0.16, soft: 0.1 },
  { q: 0.03, tip: 0.2, half: 0.18, soft: 0.12 },
  { q: 0.08, tip: 0.28, half: 0.18, soft: 0.1 },
  { q: 0.18, tip: 0.36, half: 0.2, soft: 0.09 },
  { q: 0.4, tip: 0.46, half: 0.22, soft: 0.08 },
  { q: 0.66, tip: 0.54, half: 0.28, soft: 0.08 },
  { q: 0.87, tip: 0.6, half: 0.34, soft: 0.07 },
  { q: 1.15, tip: 0.68, half: 0.46, soft: 0.07 },
  { q: 1.43, tip: 0.78, half: 0.7, soft: 0.07 },
  { q: 1.8, tip: 1.05, half: 1.15, soft: 0.07 },
];

const WHITE = [255, 255, 255];
const RIM = [210, 218, 255];
const CORE = [143, 213, 241];

function smoothstep(value: number) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mix(a: number[], b: number[], t: number) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function sample(q: number) {
  if (q <= KEYS[0].q) return { ...KEYS[0] };
  const last = KEYS[KEYS.length - 1];
  if (q >= last.q) return { ...last };
  for (let i = 0; i < KEYS.length - 1; i++) {
    const left = KEYS[i];
    const right = KEYS[i + 1];
    if (q >= left.q && q <= right.q) {
      const t = (q - left.q) / (right.q - left.q);
      return {
        q,
        tip: lerp(left.tip, right.tip, t),
        half: lerp(left.half, right.half, t),
        soft: lerp(left.soft, right.soft, t),
      };
    }
  }
  return { ...last };
}

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy || 1;
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len));
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
}

export function BowlGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 60;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const image = ctx.createImageData(96, 60);
    const data = image.data;
    let frame = 0;
    const started = performance.now();
    let cur = { tip: -0.3, half: 0.3, soft: 0.1 };
    let alive = true;

    const draw = (now: number) => {
      if (!alive) return;
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      const aspect = width / height;
      const q = window.scrollY / height;
      const elapsed = (now - started) / 1000;
      const intro = elapsed < 0.25 ? 0 : elapsed < 1.3 ? smoothstep((elapsed - 0.25) / 1.05) : 1;
      const rest = sample(0);
      const target = sample(q);
      const aim = {
        tip: (intro < 1 ? lerp(-0.3, rest.tip, intro) : target.tip) + (intro === 1 ? Math.sin(now * 0.00033 + 1.3) * 0.02 : 0),
        half: (intro < 1 ? lerp(0.3, rest.half, intro) : target.half) + (intro === 1 ? Math.sin(now * 0.0005) * 0.015 : 0),
        soft: intro < 1 ? lerp(0.1, rest.soft, intro) : target.soft,
      };
      if (intro < 1) cur = aim;
      else {
        cur = {
          tip: cur.tip + (aim.tip - cur.tip) * 0.12,
          half: cur.half + (aim.half - cur.half) * 0.12,
          soft: cur.soft + (aim.soft - cur.soft) * 0.12,
        };
      }

      const tip = Math.max(0.05, cur.tip);
      const half = cur.half;
      const soft = Math.max(0.02, cur.soft);
      const pts: [number, number][] = [];
      for (let k = 0; k < 48; k++) {
        const yy = -0.3 + ((tip + 0.3) * k) / 47;
        pts.push([half * aspect * Math.max(0, 1 - yy / tip) ** 0.72, yy]);
      }

      let offset = 0;
      for (let y = 0; y < 60; y++) {
        const py = (y + 0.5) / 60;
        for (let x = 0; x < 96; x++) {
          const px = Math.abs((x + 0.5) / 96 - 0.5) * aspect;
          let dist = Infinity;
          for (let k = 0; k < pts.length - 1; k++) {
            dist = Math.min(dist, segmentDistance(px, py, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]));
          }
          const inside = py < tip && px < half * aspect * Math.max(0, 1 - py / tip) ** 0.72;
          if (inside) dist = -dist;
          dist -= 0.1;
          const g = 1 - smoothstep((dist + soft) / (2 * soft));
          const color = g < 0.38 ? mix(WHITE, RIM, smoothstep(g / 0.38)) : mix(RIM, CORE, smoothstep((g - 0.38) / 0.62));
          data[offset] = color[0];
          data[offset + 1] = color[1];
          data[offset + 2] = color[2];
          data[offset + 3] = 255;
          offset += 4;
        }
      }
      ctx.putImageData(image, 0, 0);
      host.style.backgroundImage = `url(${canvas.toDataURL()})`;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} className="atmo" aria-hidden="true" />;
}
