import { useMemo, useRef, useState } from 'react'
import { generateTheme, PRESETS, type ThemeSeeds } from '../theme/generateTheme'
import { hashFromSeeds, useTheme } from '../theme/ThemeContext'
import { compilePrompt, type Receipt } from '../theme/compilePrompt'
import { seedsFromImage } from '../theme/imageSeeds'
import { contrastRatio } from '../theme/color'
import { Avatar, Badge, Button, Card, Input, Progress, Switch } from '../components'

/* ---------- primitives ---------- */

function Slider({
  name, value, min, max, step, display, onChange, hue,
}: {
  name: string; value: number; min: number; max: number; step: number
  display: string; onChange: (v: number) => void; hue?: boolean
}) {
  return (
    <label className={`lab-slider ${hue ? 'lab-slider--hue' : ''}`}>
      <span className="lab-slider__head">
        <span className="lab-slider__name">{name}</span>
        <span className="lab-slider__value">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} aria-label={name} />
    </label>
  )
}

const jitter = (s: ThemeSeeds, t: number): ThemeSeeds => {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  const r = () => Math.random() * 2 - 1
  return {
    ...s,
    hue: (s.hue + r() * 70 * t + 360) % 360,
    chroma: clamp(s.chroma + r() * 0.07 * t, 0.02, 0.25),
    warmth: clamp(s.warmth + r() * 0.7 * t, -1, 1),
    energy: clamp(s.energy + r() * 0.5 * t, 0, 1),
  }
}

const round = (s: ThemeSeeds): ThemeSeeds => ({
  ...s,
  hue: Math.round(s.hue),
  chroma: Math.round(s.chroma * 1000) / 1000,
  warmth: Math.round(s.warmth * 100) / 100,
  energy: Math.round(s.energy * 100) / 100,
  density: Math.round(s.density * 100) / 100,
})

interface Keeper {
  seeds: ThemeSeeds
  label: string
}

/* ---------- the lab ---------- */

export function ThemeLab() {
  const { seeds, setSeeds } = useTheme()
  const [notify, setNotify] = useState(true)
  const [phrase, setPhrase] = useState('')
  const [receipts, setReceipts] = useState<Receipt[] | null>(null)
  const [unmatched, setUnmatched] = useState<string[]>([])
  const [temperature, setTemperature] = useState(0.4)
  const [wanderTick, setWanderTick] = useState(0)
  const [keepers, setKeepers] = useState<Keeper[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<ThemeSeeds>) => setSeeds((prev) => ({ ...prev, ...patch }))

  const keep = (s: ThemeSeeds, label: string) =>
    setKeepers((prev) =>
      [{ seeds: s, label }, ...prev.filter((k) => hashFromSeeds(k.seeds) !== hashFromSeeds(s))].slice(0, 8),
    )

  const adopt = (s: ThemeSeeds, label: string) => {
    setSeeds(round(s))
    keep(round(s), label)
  }

  const compile = () => {
    if (!phrase.trim()) return
    const { seeds: next, receipts: rec, unmatched: un } = compilePrompt(phrase, seeds)
    setReceipts(rec)
    setUnmatched(un)
    adopt(next, phrase.trim())
  }

  const onImage = async (file: File | undefined) => {
    if (!file) return
    try {
      const next = await seedsFromImage(file, seeds)
      setReceipts(null)
      adopt(next, `⌾ ${file.name.replace(/\.[a-z]+$/i, '')}`)
    } catch {
      /* an undecodable file simply changes nothing */
    }
  }

  // Regenerated when the center theme or temperature changes, or on reroll.
  const neighbors = useMemo(
    () => Array.from({ length: 4 }, () => round(jitter(seeds, temperature))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hashFromSeeds(seeds), temperature, wanderTick],
  )

  const t = useMemo(() => generateTheme(seeds), [seeds])

  const contrastRows = [
    { pair: 'ink on page', a: t['--ink'], b: t['--surface-page'] },
    { pair: 'muted on page', a: t['--ink-muted'], b: t['--surface-page'] },
    { pair: 'faint on page', a: t['--ink-faint'], b: t['--surface-page'] },
    { pair: 'label on accent', a: t['--accent-ink'], b: t['--accent'] },
  ].map((row) => ({ ...row, ratio: contrastRatio(row.a, row.b) }))

  const copy = async (kind: 'seeds' | 'css') => {
    const text =
      kind === 'seeds'
        ? JSON.stringify(seeds, null, 2)
        : `:root {\n${Object.entries(t).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 1400)
  }

  const activePreset = Object.entries(PRESETS).find(
    ([, p]) => JSON.stringify(p) === JSON.stringify(seeds),
  )?.[0]

  return (
    <div className="lab">
      <div className="lab__panel">
        {/* Say it — the phrase is the record, the seeds are the receipt */}
        <div className="lab-say">
          <Input
            label="Describe it"
            placeholder="neon diner, 3am, rain on the glass"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && compile()}
          />
          <div className="lab-say__acts">
            <Button size="sm" variant="secondary" onClick={compile}>Compile</Button>
            <button className="lab-say__file" onClick={() => fileRef.current?.click()}>
              or sample an image
            </button>
            <input
              ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => onImage(e.target.files?.[0])}
            />
          </div>
          {receipts && (
            <p className="lab-say__receipts" aria-live="polite">
              {receipts.map((r) => (
                <span key={r.word + r.effect}>
                  <em>«{r.word}»</em> → {r.effect}
                </span>
              ))}
              {unmatched.length > 0 && <span className="lab-say__unmatched">silent: {unmatched.join(', ')}</span>}
            </p>
          )}
        </div>

        <div className="lab__presets" role="group" aria-label="Theme presets">
          {Object.entries(PRESETS).map(([name, preset]) => (
            <button
              key={name}
              className={`lab__preset ${activePreset === name ? 'lab__preset--active' : ''}`}
              onClick={() => adopt(preset, name)}
            >
              {name}
            </button>
          ))}
        </div>

        <Slider name="Hue" value={seeds.hue} min={0} max={360} step={1} display={`${seeds.hue}°`} onChange={(hue) => set({ hue })} hue />
        <Slider name="Chroma" value={seeds.chroma} min={0} max={0.25} step={0.005} display={seeds.chroma.toFixed(3)} onChange={(chroma) => set({ chroma })} />
        <Slider name="Warmth" value={seeds.warmth} min={-1} max={1} step={0.05} display={seeds.warmth.toFixed(2)} onChange={(warmth) => set({ warmth })} />
        <Slider name="Energy" value={seeds.energy} min={0} max={1} step={0.05} display={seeds.energy.toFixed(2)} onChange={(energy) => set({ energy })} />
        <Slider name="Density" value={seeds.density} min={0.85} max={1.15} step={0.01} display={`×${seeds.density.toFixed(2)}`} onChange={(density) => set({ density })} />

        <Switch
          checked={seeds.appearance === 'dark'}
          onChange={(dark) => set({ appearance: dark ? 'dark' : 'light' })}
          label="Dark appearance"
        />

        <pre className="lab__seeds" aria-label="Current theme seeds as JSON">
          {JSON.stringify(seeds, null, 2)}
        </pre>
        <div className="lab__export">
          <Button size="sm" variant="secondary" onClick={() => copy('seeds')}>
            {copied === 'seeds' ? 'Copied' : 'Copy seeds'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => copy('css')}>
            {copied === 'css' ? 'Copied' : 'Copy CSS'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => keep(seeds, `${seeds.hue}° ${seeds.appearance}`)}>
            Keep
          </Button>
        </div>
        <p className="lab__hint">The URL is the theme — share this page and the seeds arrive with it.</p>
      </div>

      <div className="lab__preview" aria-label="Live theme preview">
        {/* Wander — sampling the neighborhood, like a generation grid */}
        <div className="lab-wander">
          <div className="lab-wander__head">
            <span className="lab-wander__title">Neighbors</span>
            <Slider
              name="Temperature" value={temperature} min={0.1} max={1} step={0.05}
              display={temperature.toFixed(2)} onChange={setTemperature}
            />
            <Button size="sm" variant="ghost" onClick={() => setWanderTick((n) => n + 1)}>Reroll</Button>
          </div>
          <div className="lab-wander__grid">
            {neighbors.map((n, i) => {
              const nt = generateTheme(n)
              return (
                <button
                  key={i}
                  className="lab-neighbor"
                  style={{ background: nt['--surface-page'], borderColor: nt['--line-strong'], borderRadius: nt['--radius-surface'] }}
                  onClick={() => adopt(n, `${n.hue}° ${n.appearance}`)}
                  aria-label={`Adopt neighbor theme, hue ${n.hue}`}
                >
                  <span className="lab-neighbor__card" style={{ background: nt['--surface-raised'], borderRadius: nt['--radius-interactive'] }}>
                    <span className="lab-neighbor__dot" style={{ background: nt['--accent'] }} />
                    <span className="lab-neighbor__aa" style={{ color: nt['--ink'] }}>Aa</span>
                  </span>
                  <span className="lab-neighbor__tag" style={{ color: nt['--ink-faint'] }}>
                    {n.hue}° · c{n.chroma.toFixed(2)}
                  </span>
                </button>
              )
            })}
          </div>
          {keepers.length > 0 && (
            <div className="lab-keepers" aria-label="Kept themes">
              {keepers.map((k) => (
                <button
                  key={hashFromSeeds(k.seeds)}
                  className="lab-keeper"
                  onClick={() => setSeeds(k.seeds)}
                  title={k.label}
                >
                  <span className="lab-keeper__dot" style={{ background: generateTheme(k.seeds)['--accent'] }} />
                  {k.label.length > 22 ? k.label.slice(0, 22) + '…' : k.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Contrast receipts — the engine's promise, measured live */}
        <div className="lab-contrast" aria-label="Live contrast ratios">
          {contrastRows.map((row) => {
            const ratio = row.ratio ?? 0
            const tone = ratio >= 4.5 ? 'positive' : ratio >= 3 ? 'warning' : 'danger'
            return (
              <div className="lab-contrast__row" key={row.pair}>
                <span className="lab-contrast__pair">{row.pair}</span>
                <span className="lab-contrast__ratio">{ratio.toFixed(1)}:1</span>
                <Badge tone={tone}>{ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'fails'}</Badge>
              </div>
            )
          })}
        </div>

        <Card title="Mission telemetry">
          <p className="st-card__body" style={{ marginBottom: 'var(--strata-space-4)' }}>
            Every surface here derives from the seeds on the left — drag, describe, sample or
            wander, and the system recomputes itself.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--stack-gap)' }}>
            <div className="spec__row">
              <Badge tone="accent">generated</Badge>
              <Badge tone="positive">AA contrast</Badge>
              <Badge tone="neutral">oklch</Badge>
            </div>
            <Progress value={68} label="Sync progress" />
            <div className="spec__row">
              <Avatar name="Ada Lovelace" />
              <Avatar name="Norma Sklarek" />
              <Avatar name="Charles Eames" />
              <Switch checked={notify} onChange={setNotify} label="Notify collaborators" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
