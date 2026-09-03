import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Reveal, Section } from './Section'
import { Decisions } from './Decisions'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Progress,
  Select,
  Switch,
  Tabs,
  ToastRegion,
  Tooltip,
  useToasts,
} from '../components'
import { useTheme } from '../theme/ThemeContext'
import { themeTokens, type Ledger } from '../theme/ledger'
import { generateTheme } from '../theme/generateTheme'
import LEDGER from '../theme/ledger.json'
import { ThemeLab } from './ThemeLab'
import { Console } from './Console'
import './site.css'


/* Links between pages follow the deploy base, so the same build serves at / and at /<repo>/. */
const BASE = import.meta.env.BASE_URL

/* ---------- Top bar ---------- */
/* Appearance, on a mark rather than a switch. The dot after the wordmark is
   the door and the state: faint ink when the theme is monochrome, the accent
   when there is one. One click flips the ground; the Theme Lab holds the rest. */
function AppearanceDot() {
  const { seeds, setSeeds } = useTheme()
  const dark = seeds.appearance === 'dark'
  const dot = seeds.chroma > 0
    ? themeTokens(generateTheme(seeds), LEDGER as Ledger, 'value')['--accent']
    : undefined
  return (
    <button
      className="appearance-dot"
      type="button"
      title={dark ? 'Appearance: dark — switch to light' : 'Appearance: light — switch to dark'}
      aria-label={dark ? 'Switch to light appearance' : 'Switch to dark appearance'}
      aria-pressed={!dark}
      style={dot ? ({ ['--dot' as string]: dot } as React.CSSProperties) : undefined}
      onClick={() => setSeeds((prev) => ({ ...prev, appearance: dark ? 'light' : 'dark' }))}
    >
      <span />
    </button>
  )
}

function TopBar() {
  return (
    <header className="topbar">
      <div className="wrap topbar__inner">
        <div className="topbar__brand">
          <a className="topbar__logo" href="#top">Strata</a>
          <AppearanceDot />
        </div>
        <nav className="topbar__nav" aria-label="Sections">
          <a className="topbar__link" href="#lab">Theme Lab</a>
          <a className="topbar__link" href="#console">Console</a>
          <a className="topbar__link" href="#grammar">Grammar</a>
          <a className="topbar__link" href="#decisions">Record</a>
          <a className="topbar__link" href="#components">Reference</a>
          <a className="topbar__link" href={`${BASE}malleable.html`}>Malleable</a>
        </nav>
      </div>
    </header>
  )
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__mesh" aria-hidden />
      <div className="wrap">
        <Reveal>
          <span className="hero__kicker">A design system for AI product teams · v0.2</span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="hero__title">
            Design systems for the <em>generative</em> era.
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="hero__lede">
            Strata works the way the products it serves work: six seeds, one deterministic
            derivation, endless coherent variation. Themes as sampling, not styling — a grammar
            written for product teams shipping models, and for the agents building beside them.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="hero__cta">
            <Button size="lg" onClick={() => document.getElementById('lab')?.scrollIntoView({ behavior: 'smooth' })}>
              Open the Theme Lab
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => document.getElementById('grammar')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Read the grammar
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------- Sections scaffold ---------- */

/* ---------- Surfaces — every instrument in the repo, reachable from here ---------- */
const SURFACES = [
  {
    tag: 'THEME LAB',
    what: 'Six dials, a phrase, or a dropped image. The whole page recompiles on every drag, and every compiled word shows its receipt.',
    href: '#lab',
    cta: 'on this page',
  },
  {
    tag: 'PERSONALIZE',
    what: 'The same engine scaled down to the two controls an end user actually wants: say a mood, or pick one.',
    href: `${BASE}personalize.html`,
    cta: 'open',
  },
  {
    tag: 'MALLEABLE LAYER',
    what: 'Drag a corner or an edge on a live node and answer one question — how far does this go — in four words. Drag a region into another landmark and the JSX rewrites itself; the diff is the record. Un-promoted drift is the finding, and it is counted.',
    href: `${BASE}malleable.html`,
    cta: 'open',
  },
]

function Surfaces() {
  return (
    <Section
      kicker="Surfaces"
      title="Three instruments. One record."
      sub="Each surface is a host for one library, and each library is provable without a browser. This page is the one place they are all reachable from."
      id="surfaces"
    >
      <Reveal>
        <div className="ledger">
          {SURFACES.map((s) => (
            <a className="ledger__row ledger__row--link" key={s.tag} href={s.href}>
              <span className="ledger__tag">{s.tag}</span>
              <p className="ledger__what">{s.what}</p>
              <span className="ledger__rule">{s.cta} →</span>
            </a>
          ))}
        </div>
      </Reveal>
    </Section>
  )
}

/* ---------- Credo — two commitments, stated once, enacted everywhere ---------- */
const CREDO = [
  {
    line: 'The most important design choices are what you don’t see.',
    proof:
      'The engine deepens accents on light grounds to hold AA contrast, honors reduced-motion at both the stylesheet and the runtime, and a validator reviews every diff. None of it has a UI. All of it is the design.',
  },
  {
    line: 'Less but better.',
    proof:
      'Six seeds instead of a thousand hand-picked values. One filled action per surface. Components enter the system only after proving themselves three times in the wild — the inventory stays small because everything in it was earned.',
  },
]

function Credo() {
  return (
    <section className="section credo" id="credo">
      <div className="wrap credo__grid">
        {CREDO.map((c, i) => (
          <Reveal key={c.line} delay={i * 120}>
            <blockquote className="credo__item">
              <p className="credo__line">{c.line}</p>
              <p className="credo__proof">{c.proof}</p>
            </blockquote>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ---------- The grammar — governance as a ledger, because it IS a table ---------- */
const LAYERS = [
  {
    tag: 'LAYER 0 · MEANING',
    what: 'Semantic tokens, derived by the engine from six seeds. The only hard contract — consistency is predictability of meaning, not visual sameness.',
    rule: 'strict · machine-verified · one author · never forked',
  },
  {
    tag: 'LAYER 1 · BEHAVIOR',
    what: 'Headless focus, keyboard and ARIA primitives. Correctness is not a taste question — nobody needs creative freedom over roving tabindex.',
    rule: 'shared · never forked',
  },
  {
    tag: 'LAYER 2 · RECIPES',
    what: 'Styled compositions of meaning and behavior — the twelve instruments below. Copy the source, keep the two imports, restyle freely.',
    rule: 'forkable by default · eject is a feature',
  },
  {
    tag: 'LAYER 3 · LOCAL',
    what: 'Feature-owned one-offs, like the console above. No permission required; the validator still enforces Layer 0 at the diff.',
    rule: 'free · promotion earned by reuse, never granted',
  },
  {
    tag: 'MACHINE',
    what: 'The part that makes the freedom safe: token projections regenerate from one source, undeclared drift fails CI, declared drift is logged as promotion telemetry.',
    rule: 'npm run tokens · npm run validate',
  },
]

function Grammar() {
  return (
    <Section
      kicker="The grammar"
      title="Strict where strictness is cheap. Free where freedom is the point."
      sub="Meaning, behavior and expression have wildly different half-lives — so each layer gets its own governance instead of moving at the speed of the slowest."
      id="grammar"
    >
      <Reveal>
        <div className="ledger">
          {LAYERS.map((l) => (
            <div className="ledger__row" key={l.tag}>
              <span className="ledger__tag">{l.tag}</span>
              <p className="ledger__what">{l.what}</p>
              <span className="ledger__rule">{l.rule}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  )
}

/* ---------- Foundations ---------- */
const SEMANTIC_COLORS = [
  '--surface-page',
  '--surface-raised',
  '--surface-overlay',
  '--ink',
  '--ink-muted',
  '--accent',
  '--accent-strong',
  '--positive',
  '--warning',
  '--danger',
]

function ColorFoundations() {
  const { seeds } = useTheme()
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const next: Record<string, string> = {}
    for (const name of SEMANTIC_COLORS) next[name] = style.getPropertyValue(name).trim()
    setValues(next)
  }, [seeds])
  return (
    <div className="swatch-row">
      {SEMANTIC_COLORS.map((name) => (
        <div className="swatch" key={name}>
          <div className="swatch__chip" style={{ background: `var(${name})` }} />
          <div className="swatch__meta">
            <span className="swatch__name">{name}</span>
            <span className="swatch__value">{values[name] || '…'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const TYPE_SCALE: Array<{ tag: string; size: string; text: string; display?: boolean }> = [
  { tag: 'display/4xl', size: 'var(--strata-text-4xl)', text: 'Sediment & signal', display: true },
  { tag: 'display/2xl', size: 'var(--strata-text-2xl)', text: 'Themes are data', display: true },
  { tag: 'body/lg', size: 'var(--strata-text-lg)', text: 'Legible to humans, writable by machines.' },
  { tag: 'body/md', size: 'var(--strata-text-md)', text: 'The quick brown fox jumps over the lazy dog.' },
  { tag: 'body/sm', size: 'var(--strata-text-sm)', text: 'The quick brown fox jumps over the lazy dog.' },
  // deviation: specimen renders a token value as text content, not a style
  { tag: 'mono/xs', size: 'var(--strata-text-xs)', text: 'oklch(0.930 0.000 250) → --accent' },
]

function TypeFoundations() {
  return (
    <div>
      {TYPE_SCALE.map((t) => (
        <div className="type-specimen" key={t.tag}>
          <span className="type-specimen__tag">{t.tag}</span>
          <p
            className="type-specimen__sample"
            style={{
              fontSize: t.size,
              fontFamily: t.tag.startsWith('display')
                ? 'var(--font-display)'
                : t.tag.startsWith('mono')
                  ? 'var(--font-mono)'
                  : 'var(--font-body)',
              fontWeight: t.display ? 700 : 400,
              letterSpacing: t.display ? 'var(--strata-tracking-tight)' : undefined,
              color: t.tag.startsWith('mono') ? 'var(--ink-muted)' : 'var(--ink)',
            }}
          >
            {t.text}
          </p>
        </div>
      ))}
    </div>
  )
}

function SpaceFoundations() {
  const steps = [2, 3, 4, 5, 6, 7, 8]
  return (
    <div className="space-scale">
      {steps.map((s) => (
        <div className="space-scale__row" key={s}>
          <span className="space-scale__tag">space-{s}</span>
          <div className="space-scale__bar" style={{ width: `calc(var(--strata-space-${s}) * 4)` }} />
        </div>
      ))}
    </div>
  )
}

function MotionFoundations() {
  const [running, setRunning] = useState<string | null>(null)
  const demos = [
    { name: 'fast · ease', dur: 'var(--motion-fast)', ease: 'var(--motion-ease)' },
    { name: 'base · ease', dur: 'var(--motion-base)', ease: 'var(--motion-ease)' },
    { name: 'base · emphasis', dur: 'var(--motion-base)', ease: 'var(--motion-ease-emphasis)' },
    { name: 'slow · ease', dur: 'var(--motion-slow)', ease: 'var(--motion-ease)' },
  ]
  return (
    <div className="motion-stage">
      {demos.map((d) => (
        <button
          key={d.name}
          className={`motion-card ${running === d.name ? 'motion-card--run' : ''}`}
          onClick={() => setRunning((r) => (r === d.name ? null : d.name))}
          aria-label={`Play motion demo ${d.name}`}
        >
          <div className="motion-card__track">
            <div
              className="motion-card__ball"
              style={{
                transitionProperty: 'left',
                transitionDuration: d.dur,
                transitionTimingFunction: d.ease,
              }}
            />
          </div>
          <span className="motion-card__label">{d.name} — click to run</span>
        </button>
      ))}
    </div>
  )
}

function Foundations() {
  return (
    <Section kicker="Foundations" title="Rendered live from the tokens" sub="Nothing on this page is a screenshot — swatches read their values out of the running custom properties, so they follow every seed you drag." id="foundations">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--strata-space-7)' }}>
        <Reveal><ColorFoundations /></Reveal>
        <Reveal><TypeFoundations /></Reveal>
        <Reveal><SpaceFoundations /></Reveal>
        <Reveal><MotionFoundations /></Reveal>
      </div>
    </Section>
  )
}

/* ---------- Component gallery ---------- */
function Spec({ name, badge, children }: { name: string; badge?: string; children: ReactNode }) {
  return (
    <div className="spec">
      <div className="spec__head">
        <span className="spec__name">{name}</span>
        {badge && <Badge tone="accent">{badge}</Badge>}
      </div>
      <div className="spec__stage">{children}</div>
    </div>
  )
}

function Gallery() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [switchOn, setSwitchOn] = useState(true)
  const { toasts, push } = useToasts()

  return (
    <Section kicker="Reference" title="The recipe inventory" sub="Layer 2, every variant and state — kept as specimen sheets. The console above is what they look like doing real work." id="components">
      <div className="gallery">
        <Reveal>
          <Spec name="Button" badge="4 variants · 3 sizes">
            <div className="spec__row">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="spec__row">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
            </div>
          </Spec>
        </Reveal>

        <Reveal delay={60}>
          <Spec name="Input / Select">
            <Input label="Email" type="email" placeholder="ada@studio.dev" hint="We never share this." />
            <Input label="Handle" defaultValue="not–a–handle" error="Handles may only contain letters." />
            <Select
              label="Role"
              options={[
                { value: 'designer', label: 'Product designer' },
                { value: 'engineer', label: 'Design engineer' },
                { value: 'agent', label: 'Autonomous agent' },
              ]}
            />
          </Spec>
        </Reveal>

        <Reveal delay={120}>
          <Spec name="Switch / Badge">
            <Switch checked={switchOn} onChange={setSwitchOn} label="Adaptive theming" />
            <Switch checked={false} onChange={() => {}} label="Legacy mode" disabled />
            <div className="spec__row">
              <Badge tone="neutral">draft</Badge>
              <Badge tone="accent">generated</Badge>
              <Badge tone="positive">shipped</Badge>
              <Badge tone="warning">review</Badge>
              <Badge tone="danger">breaking</Badge>
            </div>
          </Spec>
        </Reveal>

        <Reveal>
          <Spec name="Card">
            <Card title="Quiet card" interactive onClick={() => push('Card pressed', 'positive')}>
              Interactive cards lift on hover and answer to Enter and Space. Press me.
            </Card>
          </Spec>
        </Reveal>

        <Reveal delay={60}>
          <Spec name="Tabs" badge="arrow-key nav">
            <Tabs
              tabs={[
                { id: 'a', label: 'Design', content: 'Tokens first. Components speak only the semantic tier.' },
                { id: 'b', label: 'Code', content: 'React + CSS custom properties. Zero runtime styling deps.' },
                { id: 'c', label: 'Agents', content: 'tokens.json is the contract; seeds are the API.' },
              ]}
            />
          </Spec>
        </Reveal>

        <Reveal delay={120}>
          <Spec name="Dialog / Toast / Tooltip / Avatar / Progress">
            <div className="spec__row">
              <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                Open dialog
              </Button>
              <Button variant="secondary" onClick={() => push('Theme saved to tokens.json', 'positive')}>
                Push toast
              </Button>
              <Tooltip content="Tokens all the way down">
                <Button variant="ghost">Hover me</Button>
              </Tooltip>
            </div>
            <div className="spec__row">
              <Avatar name="Ada Lovelace" size="sm" />
              <Avatar name="Norma Sklarek" />
              <Avatar name="Charles Eames" size="lg" />
            </div>
            <Progress value={64} label="Adoption" />
          </Spec>
        </Reveal>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Publish theme?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setDialogOpen(false)
                push('Theme published', 'positive')
              }}
            >
              Publish
            </Button>
          </>
        }
      >
        This writes the current seed set to tokens.json and rethemes every product surface that
        subscribes to it. The action is versioned and reversible.
      </Dialog>

      <ToastRegion toasts={toasts} />
    </Section>
  )
}

/* ---------- App ---------- */
export default function App() {
  return (
    <div>
      <TopBar />
      <main>
        <Hero />
        <Surfaces />
        <Section
          kicker="Theme Lab"
          title="Six seeds in. A design system out."
          sub="Drag anything. Hue, chroma, warmth, energy and density recompute every color, radius, rhythm and easing on this page — deterministically, in OKLCH."
          id="lab"
        >
          <Reveal>
            <ThemeLab />
          </Reveal>
        </Section>
        <Section
          kicker="Proof"
          title="A generation console, composed"
          sub="Built from the recipes plus two Layer 3 locals — the stepper and the output tile. Zero new tokens, zero permission asked. Width steps by 8 because the VAE grid does; the busy tile narrates because a wait costs what it shows."
          id="console"
        >
          <Reveal>
            <Console />
          </Reveal>
        </Section>
        <Credo />
        <Grammar />
        <Decisions />
        <Foundations />
        <Gallery />
      </main>
      <footer className="footer wrap">
        <span className="footer__note">STRATA v0.2 — a grammar, not a library</span>
        <span className="footer__note">react · css custom properties · oklch · generated projections</span>
      </footer>
    </div>
  )
}
