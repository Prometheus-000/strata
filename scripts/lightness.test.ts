import assert from 'node:assert/strict'
import { test } from 'node:test'
import { problemsWith } from '@strata/substrate/decision'
import { flipAppearance, generateTheme, OBSIDIAN, PRESETS, SEED_RANGE } from '../src/theme/generateTheme'
import { hashFromSeeds, parseSeedHash } from '../src/theme/seedHash'

const L = (css: string) => Number(/oklch\(([\d.]+)/.exec(css)?.[1])

test('the seventh seed is optional, and absent means lightness zero: the ground a record without it always had', () => {
  for (const seeds of [PRESETS.Ember, PRESETS.Meadow]) {
    const withZero = generateTheme({ ...seeds, lightness: 0 })
    const without = generateTheme({ ...seeds, lightness: undefined })
    assert.deepEqual(withZero, without)
  }
  assert.equal(L(generateTheme({ ...OBSIDIAN, appearance: 'dark', lightness: 0 })['--surface-page']), 0.17)
  assert.equal(L(generateTheme({ ...OBSIDIAN, appearance: 'light', lightness: 0 })['--surface-page']), 0.97)
  assert.deepEqual(SEED_RANGE.lightness, [-1, 1])
})

test("the house is Visionary's ground: black at the dark pole, paper-white at the light one, warmth zero, and the flip mirrors lightness", () => {
  assert.equal(OBSIDIAN.warmth, 0)
  assert.equal(OBSIDIAN.lightness, 1)
  assert.equal(L(generateTheme(PRESETS.Obsidian)['--surface-page']), 0.07, "Visionary's --bg is #010102, L 0.069")
  assert.equal(L(generateTheme(PRESETS.Gallery)['--surface-page']), 0.985, "Visionary's Polar --bg is L 0.985")
  assert.deepEqual(flipAppearance(PRESETS.Gallery), PRESETS.Obsidian)
  assert.deepEqual(flipAppearance(PRESETS.Obsidian), PRESETS.Gallery)
  assert.deepEqual(flipAppearance({ ...OBSIDIAN, appearance: 'dark', lightness: -0.4 }).lightness, 0.4)
  assert.equal(flipAppearance({ ...OBSIDIAN, lightness: 0 }).lightness, 0, 'zero mirrors to zero, never to minus zero')
})

test('lightness moves the ground within its appearance, and every surface keeps its step off the ground', () => {
  for (const appearance of ['dark', 'light'] as const) {
    let last = -1
    for (const lightness of [-1, -0.5, 0, 0.5, 1]) {
      const t = generateTheme({ ...OBSIDIAN, appearance, lightness })
      const page = L(t['--surface-page'])
      assert.ok(page > last, `${appearance} ground rises with lightness (${lightness})`)
      last = page
      const sunken = L(t['--surface-sunken'])
      const raised = L(t['--surface-raised'])
      const overlay = L(t['--surface-overlay'])
      assert.ok(sunken < page && page < raised && raised <= overlay, `${appearance} at ${lightness}: sunken ${sunken} < page ${page} < raised ${raised} <= overlay ${overlay}`)
      assert.ok(page >= 0.04 && overlay <= 1, 'inside the gamut of lightness')
    }
    // The bands: black to charcoal, bone to paper-white.
    const lo = L(generateTheme({ ...OBSIDIAN, appearance, lightness: -1 })['--surface-page'])
    const hi = L(generateTheme({ ...OBSIDIAN, appearance, lightness: 1 })['--surface-page'])
    if (appearance === 'dark') assert.ok(lo <= 0.07 && hi >= 0.26, `dark spans ${lo}…${hi}`)
    else assert.ok(lo <= 0.89 && hi >= 0.98, `light spans ${lo}…${hi}`)
  }
  // Out of range is clamped, never refused: a seed is a dial, and a dial has ends.
  assert.deepEqual(generateTheme({ ...OBSIDIAN, lightness: 5 }), generateTheme({ ...OBSIDIAN, lightness: 1 }))
})

test('the hash carries lightness only when it is not the house, so every older link still reads and still means what it meant', () => {
  const six = hashFromSeeds({ ...PRESETS.Ember, lightness: 0 })
  assert.equal(six.split(',').length, 6)
  assert.equal(hashFromSeeds(PRESETS.Ember), six, 'a preset without the seed writes the same link it always wrote')
  const seven = hashFromSeeds({ ...PRESETS.Ember, lightness: -0.4 })
  assert.equal(seven.split(',').length, 7)
  assert.deepEqual(parseSeedHash(seven), { ...PRESETS.Ember, lightness: -0.4 })
  assert.deepEqual(parseSeedHash(six), { ...PRESETS.Ember, lightness: 0 })
  assert.equal(parseSeedHash('#s=250,0,-0.6,0.35,1,light,nope'), null)
  assert.equal(parseSeedHash('#s=1,2,3'), null)
})

test('the substrate accepts a seed decision with or without lightness, and refuses one where it is not a number', () => {
  const six = { hue: 1, chroma: 0, warmth: 0, energy: 0.5, density: 1, appearance: 'dark' as const }
  const decision = (seeds: unknown) => ({ kind: 'seed', seeds, id: 'd000000000-0000', at: '2026-09-06T00:00:00.000Z', decided: { kind: 'human' }, written: { kind: 'human' }, via: 'test', consequence: {} })
  assert.deepEqual(problemsWith(decision(six)), [])
  assert.deepEqual(problemsWith(decision({ ...six, lightness: -0.3 })), [])
  assert.ok(problemsWith(decision({ ...six, lightness: 'deep' })).length > 0)
})
