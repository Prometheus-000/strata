/**
 * IMAGE → SEEDS
 * Sample a dropped image into a seed set: dominant high-chroma hue becomes
 * the accent, mean lightness picks the appearance, and the neutral cast
 * of the image sets warmth. Runs entirely in the browser on a 48px canvas.
 */
import { rgbToOklch } from './color'
import type { ThemeSeeds } from './generateTheme'

export function seedsFromImage(file: File, base: ThemeSeeds): Promise<ThemeSeeds> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const size = 48
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no 2d context'))
      ctx.drawImage(img, 0, 0, size, size)
      const { data } = ctx.getImageData(0, 0, size, size)

      const bins = new Array(24).fill(0)
      const binChroma = new Array(24).fill(0)
      let lightSum = 0
      let count = 0
      let warmVotes = 0
      let coolVotes = 0

      for (let i = 0; i < data.length; i += 4) {
        const { L, C, H } = rgbToOklch(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255)
        lightSum += L
        count++
        if (C > 0.04) {
          const bin = Math.floor(H / 15) % 24
          bins[bin] += C
          binChroma[bin] += C
        } else {
          // near-neutral pixels vote on warmth by their faint cast
          if (Math.abs(H - 95) < 50) warmVotes++
          if (Math.abs(H - 245) < 50) coolVotes++
        }
      }

      const peak = bins.indexOf(Math.max(...bins))
      const hasColor = bins[peak] > 0
      const meanL = lightSum / count
      const neutralTotal = warmVotes + coolVotes

      const seeds: ThemeSeeds = {
        ...base,
        hue: hasColor ? peak * 15 + 7.5 : base.hue,
        chroma: hasColor ? Math.min(0.22, Math.max(0.06, (binChroma[peak] / Math.max(1, bins[peak])) * 1.1)) : 0.05,
        warmth: neutralTotal > count * 0.05 ? Math.max(-1, Math.min(1, (warmVotes - coolVotes) / neutralTotal)) : base.warmth,
        appearance: meanL > 0.58 ? 'light' : 'dark',
      }
      resolve(seeds)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image failed to decode'))
    }
    img.src = url
  })
}
