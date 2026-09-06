import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { applyTheme, type ThemeSeeds } from './generateTheme'
import { hashFromSeeds, parseSeedHash } from './seedHash'
import { HOUSE } from '../site/record'
import LEDGER from './ledger.json'
import type { Ledger } from './ledger'

export { hashFromSeeds, parseSeedHash } from './seedHash'

interface ThemeContextValue {
  seeds: ThemeSeeds
  setSeeds: (next: ThemeSeeds | ((prev: ThemeSeeds) => ThemeSeeds)) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  seeds: HOUSE,
  setSeeds: () => {},
})

const seedsFromHash = () => parseSeedHash(window.location.hash)

/**
 * The seeds a page opens on are the record's — the theme in force — unless
 * the address carries its own, because a link is a theme too.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [seeds, setSeeds] = useState<ThemeSeeds>(() => seedsFromHash() ?? HOUSE)

  useEffect(() => {
    applyTheme(seeds, document.documentElement, LEDGER as Ledger)
    window.history.replaceState(null, '', hashFromSeeds(seeds))
  }, [seeds])

  return <ThemeContext.Provider value={{ seeds, setSeeds }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
