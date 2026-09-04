/**
 * LAYER 3 — LOCAL. A generation console composed from Strata recipes,
 * plus two feature-owned locals (the stepper, the output tile).
 * Nothing here asked permission, and nothing enforced anything: a raw value in
 * this file would be reported like a raw value anywhere else.
 * If the stepper shows up in two more features, it's a promotion candidate.
 */
import { useState } from 'react'
import { Badge, Button, Progress, Select, Tabs } from '../components'

function Stepper({
  label,
  value,
  step,
  hint,
  format,
  onChange,
}: {
  label: string
  value: number
  step: number
  hint?: string
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  const fmt = format ?? ((v: number) => String(v))
  return (
    <div className="console-field">
      <span className="console-field__label">{label}</span>
      <div className="console-step">
        <button aria-label={`Decrease ${label}`} onClick={() => onChange(value - step)}>−</button>
        <span className="console-step__value">{fmt(value)}</span>
        <button aria-label={`Increase ${label}`} onClick={() => onChange(value + step)}>+</button>
      </div>
      {hint && <span className="console-field__hint">{hint}</span>}
    </div>
  )
}

const LORAS = ['k3nan', 'film-grain-04', 'dusk-palette']

export function Console() {
  const [width, setWidth] = useState(1024)
  const [shift, setShift] = useState(1.15)
  const [loras, setLoras] = useState(LORAS.slice(0, 2))

  return (
    <div className="console">
      <header className="console__head">
        <div>
          <h3 className="console__title">character sheet · session 12</h3>
          <span className="console__meta">Krea 2 · 61 groups on volume</span>
        </div>
        <div className="console__head-acts">
          <Badge tone="accent">generating</Badge>
          <Button variant="ghost" size="sm">Stop</Button>
        </div>
      </header>

      <div className="console__prompt">
        <span className="console__prompt-text">
          empty diner, 3am — k3nan at the counter, steam off the coffee
        </span>
        <div className="console__prompt-row">
          {loras.map((l) => (
            <button
              key={l}
              className="console-pill"
              onClick={() => setLoras((prev) => prev.filter((x) => x !== l))}
              aria-label={`Remove ${l}`}
            >
              {l} ✕
            </button>
          ))}
          {loras.length < LORAS.length && (
            <button className="console-pill console-pill--add" onClick={() => setLoras(LORAS)}>
              + LoRA
            </button>
          )}
          <span className="console__spacer" />
          <Button variant="ghost" size="sm">Enhance</Button>
        </div>
      </div>

      <div className="console__params">
        <Tabs
          tabs={[
            { id: 'still', label: 'Still', content: 'Krea 2 — guidance-distilled, CFG fixed at 1.0. The controls follow the model.' },
            { id: '5s', label: '5s', content: 'MiniMax-H3 — image and video share the prompt; motion and audio come along.' },
            { id: '10s', label: '10s', content: 'MiniMax-H3, long form — same prompt, same canvas, only duration changed.' },
          ]}
        />
        <div className="console__fields">
          <Select
            label="Sampler"
            options={[
              { value: 'res_2s', label: 'res_2s' },
              { value: 'euler', label: 'euler' },
            ]}
          />
          <Stepper
            label="Width"
            value={width}
            step={8}
            hint="steps by 8 — the VAE grid"
            onChange={setWidth}
          />
          <Stepper
            label="Shift"
            value={shift}
            step={0.05}
            format={(v) => v.toFixed(2)}
            hint="useful range 1.0–1.4"
            onChange={(v) => setShift(Math.round(v * 100) / 100)}
          />
        </div>
      </div>

      <div className="console__acts">
        <Button>Generate</Button>
        <Button variant="ghost">Queue</Button>
        <span className="console__seed">seed 84021 · {width}×576 · shift {shift.toFixed(2)}</span>
      </div>

      <div className="console__out">
        <figure className="console-tile console-tile--keeper">
          <div className="console-tile__art console-tile__art--a" />
          <figcaption>keeper · cannot be demoted</figcaption>
        </figure>
        <figure className="console-tile">
          <div className="console-tile__art console-tile__art--b" />
          <figcaption>marked</figcaption>
        </figure>
        <figure className="console-tile console-tile--busy">
          <div className="console-tile__art">
            <span className="console-tile__narration">denoising 14/30</span>
          </div>
          <Progress value={46} label="Generation progress" />
          <figcaption>a wait costs what it shows</figcaption>
        </figure>
        <button className="console-tile console-tile--drop">
          <span>Drop a reference</span>
        </button>
      </div>
    </div>
  )
}
