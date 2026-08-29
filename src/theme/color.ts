/**
 * LAYER 0 UTILITIES — OKLCH ↔ sRGB, and WCAG contrast.
 * Used by the lab for contrast receipts and image sampling.
 * Reference implementation of the OKLab transforms (Björn Ottosson).
 */

export interface Oklch {
  L: number
  C: number
  H: number
  alpha: number
}

export function parseOklch(str: string): Oklch | null {
  const m = str.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/)
  if (!m) return null
  return { L: +m[1], C: +m[2], H: +m[3], alpha: m[4] !== undefined ? +m[4] : 1 }
}

const gamma = (x: number) => {
  x = Math.min(1, Math.max(0, x))
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}
const degamma = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))

/** OKLCH → sRGB, each channel 0–1 (gamut-clipped). */
export function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
  const hr = (H * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

/** sRGB (0–1) → OKLCH. */
export function rgbToOklch(r: number, g: number, b: number): Oklch {
  const rl = degamma(r)
  const gl = degamma(g)
  const bl = degamma(b)
  const l = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl)
  const m = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl)
  const s = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.sqrt(a * a + bb * bb)
  let H = (Math.atan2(bb, a) * 180) / Math.PI
  if (H < 0) H += 360
  return { L, C, H, alpha: 1 }
}

/** WCAG 2.1 contrast ratio between two OKLCH token strings (alpha ignored). */
export function contrastRatio(tokenA: string, tokenB: string): number | null {
  const A = parseOklch(tokenA)
  const B = parseOklch(tokenB)
  if (!A || !B) return null
  const lum = (c: Oklch) => {
    const [r, g, b] = oklchToRgb(c.L, c.C, c.H)
    return 0.2126 * degamma(r) + 0.7152 * degamma(g) + 0.0722 * degamma(b)
  }
  const l1 = lum(A)
  const l2 = lum(B)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
