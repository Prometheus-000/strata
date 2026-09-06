/**
 * The six seeds as controls — the picker every surface shares. The Theme Lab
 * grew these first; the identity page draws the same ones, because a second
 * picker would be a second place for a range to disagree with the engine.
 * Ranges are the engine's own (`SEED_RANGE`), read rather than restated.
 */
import { SEED_RANGE, type ThemeSeeds } from '../theme/generateTheme'

export function Ground({ value, onChange }: { value: ThemeSeeds['appearance']; onChange: (a: ThemeSeeds['appearance']) => void }) {
  return (
    <div className="lab-ground">
      <span className="lab-ground__name">Ground</span>
      <div className="lab-ground__switch" role="group" aria-label="Ground">
        {(['dark', 'light'] as const).map((a) => (
          <button key={a} type="button" aria-pressed={value === a} onClick={() => onChange(a)}>
            {a === 'dark' ? 'Dark' : 'Light'}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Slider({
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

const range = (k: keyof typeof SEED_RANGE, fallback: [number, number]) => SEED_RANGE[k] ?? fallback

/** Five sliders and the ground: the whole theme, as the engine reads it. */
export function SeedDials({ seeds, onChange }: { seeds: ThemeSeeds; onChange: (next: ThemeSeeds) => void }) {
  const set = (patch: Partial<ThemeSeeds>) => onChange({ ...seeds, ...patch })
  const [h0, h1] = range('hue', [0, 360])
  const [c0, c1] = range('chroma', [0, 0.25])
  const [w0, w1] = range('warmth', [-1, 1])
  const [e0, e1] = range('energy', [0, 1])
  const [d0, d1] = range('density', [0.85, 1.15])
  return (
    <>
      <Slider name="Hue" value={seeds.hue} min={h0} max={h1} step={1} display={`${seeds.hue}°`} onChange={(hue) => set({ hue })} hue />
      <Slider name="Chroma" value={seeds.chroma} min={c0} max={c1} step={0.005} display={seeds.chroma.toFixed(3)} onChange={(chroma) => set({ chroma })} />
      <Slider name="Warmth" value={seeds.warmth} min={w0} max={w1} step={0.05} display={seeds.warmth.toFixed(2)} onChange={(warmth) => set({ warmth })} />
      <Slider name="Energy" value={seeds.energy} min={e0} max={e1} step={0.05} display={seeds.energy.toFixed(2)} onChange={(energy) => set({ energy })} />
      <Slider name="Density" value={seeds.density} min={d0} max={d1} step={0.01} display={`×${seeds.density.toFixed(2)}`} onChange={(density) => set({ density })} />
      <Ground value={seeds.appearance} onChange={(appearance) => set({ appearance })} />
    </>
  )
}
