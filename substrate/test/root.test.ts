/**
 * WHERE THE PRODUCT IS — the two roots, kept apart.
 *
 * For a year they were one directory: the CLI rooted itself where its own
 * code lived, so run from any other repository it read and wrote Strata's
 * own record while saying nothing about it. Silence is the part that made it
 * worse than an error.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { findProductRoot, productRoot, NOT_A_PRODUCT, PRODUCT_DIR } from '../src/root.ts'

const real = (p: string) => fs.realpathSync(p)

test('a product is found from anywhere inside it, and nowhere outside it', () => {
  const tmp = real(fs.mkdtempSync(path.join(os.tmpdir(), 'strata-root-')))
  const product = path.join(tmp, 'product')
  const deep = path.join(product, 'src', 'features', 'gallery')
  fs.mkdirSync(deep, { recursive: true })
  fs.mkdirSync(path.join(product, PRODUCT_DIR))

  assert.equal(findProductRoot(product), product, 'the product root is its own')
  assert.equal(findProductRoot(deep), product, 'and is found from a directory deep inside it, as git finds .git')
  assert.equal(findProductRoot(tmp), undefined, 'a directory above it is not in a product')

  // A nested product wins over the one containing it: the nearest record is
  // the one this work belongs to.
  const inner = path.join(product, 'packages', 'ui')
  fs.mkdirSync(path.join(inner, PRODUCT_DIR), { recursive: true })
  assert.equal(findProductRoot(inner), inner)
})

test('STRATA_ROOT names the product outright, and nothing is guessed when there is none', () => {
  const tmp = real(fs.mkdtempSync(path.join(os.tmpdir(), 'strata-root-')))
  assert.equal(productRoot({ STRATA_ROOT: tmp }, '/'), tmp)
  assert.equal(productRoot({ STRATA_ROOT: path.join(tmp, 'x', '..') }, '/'), tmp, 'and it is resolved, so a relative one still names one directory')
  assert.equal(productRoot({}, tmp), undefined)
  // The sentence a verb prints instead: what is missing, and the one command
  // that fixes it. Not "no such file".
  assert.match(NOT_A_PRODUCT, /npx strata init/)
})
