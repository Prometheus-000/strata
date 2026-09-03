import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { applyTheme, OBSIDIAN, type ThemeSeeds } from './generateTheme'
import LEDGER from './ledger.json'
import type { Ledger } from './ledger'

interface ThemeContextValue {
  seeds: ThemeSeeds
  setSeeds: (next: ThemeSeeds | ((prev: ThemeSeeds) => ThemeSeeds)) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  seeds: OBSIDIAN,
  setSeeds: () => {},
})

/** A theme is six numbers, so a theme fits in a URL. #s=hue,chroma,warmth,energy,density,appearance */
function seedsFromHash(): ThemeSeeds | null {
  const m = window.location.hash.match(/^#s=([^&]+)/)
  if (!m) return null
  const parts = m[1].split(',')
  if (parts.length !== 6) return null
  const [hue, chroma, warmth, energy, density] = parts.slice(0, 5).map(Number)
  if ([hue, chroma, warmth, energy, density].some(Number.isNaN)) return null
  const appearance = parts[5] === 'light' ? 'light' : 'dark'
  return { hue, chroma, warmth, energy, density, appearance }
}

export function hashFromSeeds(s: ThemeSeeds): string {
  return `#s=${s.hue},${s.chroma},${s.warmth},${s.energy},${s.density},${s.appearance}`
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [seeds, setSeeds] = useState<ThemeSeeds>(() => seedsFromHash() ?? OBSIDIAN)

  useEffect(() => {
    applyTheme(seeds, document.documentElement, LEDGER as Ledger)
    window.history.replaceState(null, '', hashFromSeeds(seeds))
  }, [seeds])

  return <ThemeContext.Provider value={{ seeds, setSeeds }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
