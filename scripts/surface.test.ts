/**
 * ONE FILLED ACTION PER SURFACE — and what a surface is.
 *
 * It was a file, which is coarser than the rule. One file in this repository
 * holds a hero, a dialog and a specimen sheet: three surfaces with one filled
 * action each, reported as seven in one place, so the finding named a fault
 * the page did not have and its owner had to read the source to dismiss it.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { findings, evalContext, resetEvaluators } from '@strata/substrate/evidence'
import { registerGrammarEvaluators } from '../src/theme/grammar'

const RULES = {
  rules: [
    { id: 'layer2.one-filled-action', authority: 'policy', scope: 'product', statement: 'One filled action per surface.', reason: 'When three calls to action carry the same chrome, the screen has no point.', source: 'GRAMMAR.md › x', check: 'layer2.one-filled-action' },
  ],
}

function product(tsx: string): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'strata-surface-')))
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'grammar'), { recursive: true })
  fs.mkdirSync(path.join(dir, '.strata'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'grammar/rules.json'), JSON.stringify(RULES))
  fs.writeFileSync(path.join(dir, '.strata/config.json'), JSON.stringify({ source: ['src'], tokens: null }))
  fs.writeFileSync(path.join(dir, 'src/App.tsx'), tsx)
  return dir
}

const said = (dir: string) => {
  resetEvaluators()
  registerGrammarEvaluators({ root: dir })
  return findings(evalContext(dir, [])).filter((f) => f.rule === 'layer2.one-filled-action')
}

test('a surface is a component, so one filled action each is not a finding', () => {
  const dir = product(`
function Hero() {
  return <div><Button>Open the Theme Lab</Button><Button variant="secondary">Read</Button></div>
}

function Footer() {
  return <div><Button>Subscribe</Button><Button variant="ghost">Later</Button></div>
}
`)
  assert.deepEqual(said(dir), [], 'two surfaces with one filled action each is the rule being kept, not broken')
})

test('a component with several is the finding, and it names which', () => {
  const dir = product(`
function Hero() {
  return <Button>One</Button>
}

function Gallery() {
  return <div><Button>A</Button><Button>B</Button><Button variant="primary">C</Button></div>
}
`)
  const out = said(dir)
  assert.equal(out.length, 1, 'the hero is not named; the gallery is')
  assert.match(out[0].message, /3 filled actions in <Gallery>/)
  assert.equal(out[0].facts?.find((f) => f.name === 'component')?.value, 'Gallery')
  assert.match(String(out[0].facts?.find((f) => f.name === 'at')?.value), /src\/App\.tsx:\d/, 'and where they are')
})

test('a component can say why it has several, and the finding carries the reason', () => {
  // Reported, not refused — the same shape as a kept token under
  // safety.contrast. The judgement was being made every time someone read the
  // finding; this puts it on the page once.
  const dir = product(`
/**
 * The recipe inventory.
 *
 * deviation: the filled buttons here are specimens, not calls to action — a
 * sheet whose job is to show every variant has as many as there are variants.
 */
function Gallery() {
  return <div><Button>A</Button><Button>B</Button></div>
}
`)
  const out = said(dir)
  assert.equal(out.length, 1, 'a declaration is a reason, not an exemption')
  assert.match(out[0].message, /Declared: the filled buttons here are specimens, not calls to action — a sheet whose job is to show every variant has as many as there are variants\./, 'read whole, across the lines the comment wraps over')
})

test('a doc comment belongs to the component it documents, not the one above it', () => {
  // Spans that began at the declaration put anything said about a component
  // into the span of the one before it, so a component could not say why.
  const dir = product(`
function Hero() {
  return <Button>One</Button>
}

/** deviation: specimens, not calls to action. */
function Gallery() {
  return <div><Button>A</Button><Button>B</Button></div>
}
`)
  const out = said(dir)
  assert.equal(out.length, 1)
  assert.match(out[0].message, /Declared: specimens, not calls to action\./)
})

test('a module with no component of its own is still counted', () => {
  const dir = product(`
export const rows = [1, 2]
render(<div><Button>A</Button><Button>B</Button></div>)
`)
  assert.match(said(dir)[0].message, /2 filled actions in <the module>/)
})
