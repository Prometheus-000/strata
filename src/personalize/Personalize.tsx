/**
 * VISIONARY × STRATA — in-product personalization, scaled down.
 * The full Theme Lab is a designer's instrument; this is the two controls
 * an end user actually wants: say a mood, or pick one. The same engine
 * runs underneath — the product just exposes less of it.
 * "The most important design choices are what you don't see."
 */
import { useEffect, useRef, useState } from 'react'
import { PRESETS, type ThemeSeeds } from '../theme/generateTheme'
import { useTheme } from '../theme/ThemeContext'
import { compilePrompt, type Receipt } from '../theme/compilePrompt'
import { Button, Switch } from '../components'
import { Console } from '../site/Console'

const STORAGE_KEY = 'visionary-theme-seeds'

/** End users pick moods, not tokens — presets wear product names here. */
const MOODS: Array<{ name: string; seeds: ThemeSeeds }> = [
  { name: 'Obsidian', seeds: PRESETS.Obsidian },
  { name: 'Midnight', seeds: PRESETS.Midnight },
  { name: 'Polar', seeds: PRESETS.Polar },
  { name: 'Ember', seeds: PRESETS.Ember },
  { name: 'Ultraviolet', seeds: PRESETS.Ultraviolet },
  { name: 'Glacier', seeds: PRESETS.Glacier },
]

const surprise = (s: ThemeSeeds): ThemeSeeds => ({
  ...s,
  hue: Math.round(Math.random() * 360),
  chroma: Math.round((0.08 + Math.random() * 0.14) * 1000) / 1000,
  warmth: Math.round((Math.random() * 2 - 1) * 100) / 100,
  energy: Math.round(Math.random() * 100) / 100,
})

export function Personalize() {
  const { seeds, setSeeds } = useTheme()
  const [open, setOpen] = useState(true)
  const [phrase, setPhrase] = useState('')
  const [receipts, setReceipts] = useState<Receipt[] | null>(null)
  const loaded = useRef(false)

  // Per-viewer convenience: the theme survives a return visit on this device.
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    try {
      if (!window.location.hash.startsWith('#s=')) {
        const saved = window.localStorage.getItem(STORAGE_KEY)
        if (saved) setSeeds(JSON.parse(saved))
      }
    } catch {
      /* private windows and blocked storage render the default theme */
    }
  }, [setSeeds])

  useEffect(() => {
    if (!loaded.current) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds))
    } catch {
      /* nothing to do — the theme simply won't persist */
    }
  }, [seeds])

  const compile = () => {
    if (!phrase.trim()) return
    const { seeds: next, receipts: rec } = compilePrompt(phrase, seeds)
    setReceipts(rec)
    setSeeds(next)
  }

  return (
    <div className="pz">
      <header className="pz__bar">
        <span className="pz__wordmark">Visionary</span>
        <span className="pz__crumb">wan22 · character sheet</span>
        <span className="pz__spacer" />
        <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? 'Done' : 'Make it yours'}
        </Button>
      </header>

      <main className="pz__stage">
        <Console />

        {open && (
          <aside className="pz-panel" aria-label="Personalize Visionary">
            <div className="pz-panel__head">
              <h2>Make it yours</h2>
              <p>Say a mood, or pick one. Your words are kept; the theme is derived from them.</p>
            </div>

            <div className="pz-panel__say">
              <input
                className="st-input"
                placeholder="calm archive, warm paper…"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && compile()}
                aria-label="Describe a mood"
              />
              <Button size="sm" onClick={compile}>Set</Button>
            </div>
            {receipts && (
              <p className="pz-panel__receipt" aria-live="polite">
                {receipts.slice(0, 3).map((r) => `«${r.word}» ${r.effect}`).join(' · ')}
              </p>
            )}

            <div className="pz-panel__moods" role="group" aria-label="Mood presets">
              {MOODS.map((m) => (
                <button
                  key={m.name}
                  className={`pz-mood ${JSON.stringify(m.seeds) === JSON.stringify(seeds) ? 'pz-mood--active' : ''}`}
                  onClick={() => {
                    setReceipts(null)
                    setSeeds(m.seeds)
                  }}
                >
                  {m.name}
                </button>
              ))}
              <button className="pz-mood pz-mood--dice" onClick={() => setSeeds(surprise(seeds))}>
                Surprise me
              </button>
            </div>

            <div className="pz-panel__foot">
              <Switch
                checked={seeds.appearance === 'dark'}
                onChange={(dark) => setSeeds((p) => ({ ...p, appearance: dark ? 'dark' : 'light' }))}
                label="Dark"
              />
              <button className="pz-panel__reset" onClick={() => { setReceipts(null); setPhrase(''); setSeeds(PRESETS.Obsidian) }}>
                Reset
              </button>
            </div>
            <p className="pz-panel__note">Remembered on this device. The whole platform follows — every surface derives from six numbers.</p>
          </aside>
        )}
      </main>

      <footer className="pz__foot">
        <span>Personalization runs on the Strata engine — the design system stays the base; only the seeds are yours.</span>
      </footer>
    </div>
  )
}
