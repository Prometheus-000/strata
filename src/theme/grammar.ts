/**
 * EVALUATORS FOR THE RULES THAT CAN HAVE ONE.
 *
 * Three of twenty-six non-invariant rules were evaluated; the rest were cited
 * into skills and read by a hand, which is a fine thing for a rule to be but a
 * poor thing for a rule to be *silently*. `check: "none"` in `rules.json` now
 * says which rules nothing can speak for. These are the ones something can.
 *
 * Every finding here is a *policy* finding: it is reported under the rule it
 * bends, with what it found, and it fails nothing. A page mid-design bends
 * half of these by definition — the point of evaluating is that a person
 * reads a sentence about it later, not that a build refuses it now.
 *
 * Where a rule is this product's taste rather than the system's, the rule
 * carries `"scope": "product"` and the report says so. An adopter replaces
 * both the rule and its evaluator.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerEvaluator, type Finding } from '@strata/substrate/evidence'
import { ROLES_AGAINST_PRIMITIVES } from './generateTheme'
import { readLedger, SEMANTIC_PATH } from './emit'
import { scanFiles } from './evaluators'

const ENGINE_MODULE = 'engine/src/generateTheme.ts'

/** Files that are allowed to say `function generateTheme` — exactly one. */
const CONSUMERS = ['src/theme/generateTheme.ts', 'strata-malleable/src/engine/generateTheme.ts']

const read = (root: string, rel: string) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '')

const policy = (rule: string, message: string, where?: string): Finding => ({ rule, authority: 'policy', message, ...(where ? { where } : {}) })

/** Every line of a file, numbered, with a matcher — the shape most of these want. */
const lines = (text: string) => text.split('\n').map((line, i) => ({ line, n: i + 1 }))

export function registerGrammarEvaluators(home: { root: string }): void {
  const root = home.root

  /**
   * The engine is the only author of the semantic tier — and for a year that
   * was true of the *values* and false of the *module*: a vendored copy sat in
   * the malleable layer, 134 diff lines from the original, with comments
   * explaining why the drift was fine. Two compilers are two authors. This
   * says so mechanically: one definition, and every consumer importing it.
   */
  registerEvaluator({
    id: 'layer0.engine-only-author',
    findings: () => {
      const out: Finding[] = []
      const engine = read(root, ENGINE_MODULE)
      if (!engine.includes('export function generateTheme'))
        out.push(policy('layer0.engine-only-author', `${ENGINE_MODULE} does not define generateTheme — the engine has moved and nothing here knows where`, ENGINE_MODULE))
      for (const consumer of CONSUMERS) {
        const text = read(root, consumer)
        if (!text) {
          out.push(policy('layer0.engine-only-author', `${consumer} is missing`, consumer))
          continue
        }
        if (/export function generateTheme/.test(text))
          out.push(policy('layer0.engine-only-author', `${consumer} defines generateTheme itself — a second compiler is a second author of the semantic tier`, consumer))
        else if (!text.includes('@strata/engine'))
          out.push(policy('layer0.engine-only-author', `${consumer} neither defines the engine nor imports @strata/engine`, consumer))
      }
      return out
    },
  })

  /**
   * Two radii: a control and a panel. `--radius-pill` is a shape held against
   * a primitive, not a third scale, so it does not count.
   */
  registerEvaluator({
    id: 'voice.two-radii',
    findings: () => {
      const ledger = readLedger(root)
      const scales = ['--radius-interactive', '--radius-surface', '--radius-overlay']
      const live = scales.filter((t) => ledger.tokens[t]?.status !== 'cut')
      if (live.length <= 2) return []
      return [
        {
          ...policy('voice.two-radii', `${live.length} radius scales are live: ${live.join(', ')}. The voice keeps two — a control and a panel — and the third is the one soft shape on an architectural page.`),
          facts: live.map((t) => ({ name: t, value: ledger.tokens[t]?.status ?? 'proposed' })),
        },
      ]
    },
  })

  /**
   * Lines, not shadows. Every level is a 1px rule and an alpha wash.
   *
   * Two things that look like shadows are not. A `box-shadow` naming an
   * elevation role is the roles doing their job — they paint nothing while
   * `--shadow-color` is cut, and become shadows again the day someone
   * reverses that. And `0 0 0 3px` is a ring: no offset, no blur, a line
   * drawn outside the border box, which is how a focus ring is drawn without
   * moving anything. A hand-written *offset* is what this reports.
   */
  registerEvaluator({
    id: 'voice.lines-not-shadows',
    findings: () => {
      const out: Finding[] = []
      for (const file of scanFiles(root)) {
        for (const { line, n } of lines(read(root, file))) {
          if (!/box-shadow\s*:/.test(line)) continue
          if (/var\(--shadow-/.test(line) || /box-shadow\s*:\s*none/.test(line)) continue
          // A ring: no offset, no blur, spread only.
          if (/box-shadow\s*:\s*(inset\s+)?0\s+0\s+0\s+[\d.]+(px|rem|em)/.test(line)) continue
          out.push(policy('voice.lines-not-shadows', `a shadow written by hand: ${line.trim()}. The elevation roles carry the offsets; --shadow-color decides whether they paint.`, `${file}:${n}`))
        }
      }
      return out
    },
  })

  /**
   * One filled action per surface. A surface is a file here, which is coarse
   * and says so: a specimen page that shows every variant at once is counted
   * like a screen. The number is the finding; the judgement is a hand's.
   */
  registerEvaluator({
    id: 'layer2.one-filled-action',
    findings: () => {
      const out: Finding[] = []
      for (const file of scanFiles(root, ['src/site', 'strata-malleable/fixtures/app'])) {
        if (!file.endsWith('.tsx')) continue
        const text = read(root, file)
        // `variant` defaults to primary, so a <Button> that names no variant is filled.
        const filled = [...text.matchAll(/<Button(\s[^>]*)?>/g)].filter((m) => !/variant=/.test(m[1] ?? '')).length + [...text.matchAll(/variant="primary"/g)].length
        if (filled > 1)
          out.push({
            ...policy('layer2.one-filled-action', `${filled} filled actions in one file. Primary is filled, Secondary is an edge, Ghost is bare text; when three calls to action carry the same chrome, the screen has no point.`, file),
            facts: [{ name: 'filled buttons', value: filled }],
          })
      }
      return out
    },
  })

  /**
   * Disabled is opacity, not a colour. A disabled rule that repaints ink or
   * ground invents a second disabled state that no theme controls.
   */
  registerEvaluator({
    id: 'layer2.disabled-is-opacity',
    findings: () => {
      const out: Finding[] = []
      for (const file of scanFiles(root).filter((f) => f.endsWith('.css'))) {
        const text = read(root, file)
        const rules = text.split('}')
        for (const rule of rules) {
          const head = rule.slice(0, rule.indexOf('{'))
          if (!/:disabled|\[disabled\]|\[aria-disabled='true'\]/.test(head)) continue
          if (/:not\(:disabled\)/.test(head)) continue
          const body = rule.slice(rule.indexOf('{') + 1)
          const repaints = [...body.matchAll(/^\s*(color|background|background-color|border-color)\s*:/gm)].map((m) => m[1])
          if (repaints.length)
            out.push(policy('layer2.disabled-is-opacity', `${head.trim()} repaints ${[...new Set(repaints)].join(', ')}. Disabled is opacity; a colour is a second disabled state no theme controls.`, file))
        }
      }
      return out
    },
  })

  /**
   * Status is an ink and a wash, together. Keeping one and cutting the other
   * leaves a recipe that can colour a word but not the ground under it, which
   * is how a status ends up as colour alone — the case that fails for anyone
   * who cannot see it.
   */
  registerEvaluator({
    id: 'layer2.status-ink-and-wash',
    findings: () => {
      const ledger = readLedger(root)
      const out: Finding[] = []
      for (const status of ['positive', 'warning', 'danger']) {
        const ink = ledger.tokens[`--${status}`]?.status ?? 'proposed'
        const wash = ledger.tokens[`--${status}-soft`]?.status ?? 'proposed'
        if ((ink === 'cut') !== (wash === 'cut'))
          out.push(policy('layer2.status-ink-and-wash', `--${status} is ${ink} and --${status}-soft is ${wash}. A status is an ink and a wash; one without the other colours a word and not the ground under it.`))
      }
      return out
    },
  })

  /**
   * A backdrop dismisses. Every element that opens over the page answers a
   * click outside it and an Escape — the two ways a person leaves without
   * hunting for a target.
   */
  registerEvaluator({
    id: 'layer1.backdrop-click',
    findings: () => {
      const out: Finding[] = []
      const files = scanFiles(root, ['src/components', 'src/behavior', 'strata-malleable/fixtures/app']).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
      for (const file of files) {
        const own = read(root, file)
        if (!/role=['"]dialog['"]|useDialog\s*\(/.test(own)) continue
        // A component that delegates to a behavior hook is answering through
        // it: the pair is the unit, so the hook's source is read too. This is
        // layer 1 working as intended — imported, never copied.
        const imported = files
          .filter((f) => new RegExp(`from ['"][^'"]*${f.split('/').pop()?.replace(/\.[jt]sx?$/, '')}['"]`).test(own))
          .map((f) => read(root, f))
          .join('\n')
        const text = `${own}\n${imported}`
        const escapes = /Escape/.test(text)
        const dismisses = /onClick|onPointerDown|onMouseDown|closeOnBackdrop|backdrop/i.test(text)
        if (escapes && dismisses) continue
        out.push(
          policy(
            'layer1.backdrop-click',
            `an overlay here answers ${escapes ? 'Escape but no click outside' : dismisses ? 'a click but no Escape' : 'neither Escape nor a click outside'}. Both are how a person leaves without hunting for a target.`,
            file,
          ),
        )
      }
      return out
    },
  })

  /**
   * Reduced motion is honoured in both layers: in the generated stylesheet,
   * for anyone who never runs the theme engine, and again at runtime, because
   * `applyTheme` sets the durations as inline properties and an inline
   * property beats a media query.
   */
  registerEvaluator({
    id: 'layer1.reduced-motion-both-layers',
    findings: () => {
      const out: Finding[] = []
      if (!/@media \(prefers-reduced-motion: reduce\)/.test(read(root, SEMANTIC_PATH)))
        out.push(policy('layer1.reduced-motion-both-layers', 'the generated stylesheet has no reduced-motion block — the layer that serves anyone who never runs the engine', SEMANTIC_PATH))
      if (!/prefers-reduced-motion/.test(read(root, 'src/theme/generateTheme.ts')))
        out.push(policy('layer1.reduced-motion-both-layers', 'applyTheme does not re-check reduced motion — it writes inline properties, and an inline property beats the media query above', 'src/theme/generateTheme.ts'))
      if (!/reducedMotion/.test(read(root, ENGINE_MODULE)))
        out.push(policy('layer1.reduced-motion-both-layers', 'the engine has no way to honour reduced motion, so no consumer can', ENGINE_MODULE))
      return out
    },
  })

  /**
   * Behavior is consumed, never copied. Roving tabindex, arrow-key order,
   * Escape and backdrop dismissal live in `src/behavior`; a component that
   * wires its own key listener has rebuilt the part everyone rebuilds badly.
   *
   * Layer 3 is exempt by definition — the fixture dialog owns its own Escape
   * on purpose, and says so in its first line — so this reads the library,
   * not the app.
   */
  registerEvaluator({
    id: 'layer1.imported-not-copied',
    findings: () => {
      const out: Finding[] = []
      for (const file of scanFiles(root, ['src/components']).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))) {
        for (const { line, n } of lines(read(root, file))) {
          if (!/addEventListener\(\s*['"]key(down|up)['"]/.test(line) && !/onKeyDown=\{?\(?\s*\(?e\)?\s*=>/.test(line)) continue
          out.push(
            policy(
              'layer1.imported-not-copied',
              `a key listener written here rather than imported from src/behavior: ${line.trim()}. This is the part everyone rebuilds badly when they eject, so it is the part that must be consumed.`,
              `${file}:${n}`,
            ),
          )
        }
      }
      return out
    },
  })

  /** Named here so the roles the engine holds against a primitive stay findable from one place. */
  void ROLES_AGAINST_PRIMITIVES
}
