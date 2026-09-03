/**
 * THE RECEIPT — who moved what, for the reviewer.
 *
 * The JSX is the record: a move is a diff, and git already knows who committed
 * it. What git cannot say is which hand made each move before the commit —
 * the designer's or the agent's — and that is the one thing a reviewer needs
 * that the diff does not carry. So every move appends a line here, and
 * "ready" stamps the handoff. Nothing in this file is ever a decision;
 * delete it once the review has happened.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { MoveRecord, PropRecord, Receipt } from '../schema'

export const READY_PATH = '.malleable/ready.json'

export const emptyReceipt = (): Receipt => ({ version: 1, ready: null, moves: [], props: [] })

export function readReceipt(root = process.cwd()): Receipt {
  const p = path.join(root, READY_PATH)
  if (!fs.existsSync(p)) return emptyReceipt()
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as Receipt
    return { version: 1, ready: parsed.ready ?? null, moves: parsed.moves ?? [], props: parsed.props ?? [] }
  } catch {
    return emptyReceipt()
  }
}

export function writeReceipt(receipt: Receipt, root = process.cwd()) {
  const p = path.join(root, READY_PATH)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(receipt, null, 2) + '\n')
}

/**
 * Append a move. A move that exactly reverses the one before it is not two
 * moves, it is a change of mind, and the receipt says nothing about it. A move
 * after "ready" reopens the handoff.
 */
export function appendMove(receipt: Receipt, move: MoveRecord): Receipt {
  const last = receipt.moves[receipt.moves.length - 1]
  const reverses =
    last &&
    last.what === move.what &&
    last.from.container === move.to.container &&
    last.to.container === move.from.container &&
    last.from.line === move.to.line
  return {
    ...receipt,
    ready: null,
    moves: reverses ? receipt.moves.slice(0, -1) : [...receipt.moves, move],
  }
}

/**
 * Append a prop pick. Picking a value back is a change of mind, like a move
 * reversed; two picks on the same attribute collapse to the last one, with the
 * first pick's `from` kept — the reviewer wants where it started, not the path.
 */
export function appendProp(receipt: Receipt, pick: PropRecord): Receipt {
  const props = receipt.props ?? []
  const i = props.findIndex((p) => p.file === pick.file && p.line === pick.line && p.what === pick.what && p.prop === pick.prop)
  if (i === -1) return { ...receipt, ready: null, props: [...props, pick] }
  const first = props[i]
  const rest = props.filter((_, j) => j !== i)
  if (first.from === pick.to) return { ...receipt, ready: null, props: rest }
  return { ...receipt, ready: null, props: [...rest, { ...pick, from: first.from }] }
}

export const markReady = (receipt: Receipt, by: 'human' | 'agent', at: string): Receipt => ({
  ...receipt,
  ready: { by, at },
})

export function formatReceipt(r: Receipt): string {
  const out: string[] = ['']
  const line = (s = '') => out.push(s)
  if (!r.moves.length && !(r.props ?? []).length) line('  nothing changed since the last review')
  for (const m of r.moves) {
    const where =
      m.from.container === m.to.container ? `within ${m.to.container}` : `${m.from.container} → ${m.to.container}`
    line(`  <${m.what} />  ${where}   ${m.to.file}:${m.to.line} · ${m.by}`)
    if (m.adapt?.length) line(`      needs wiring: ${m.adapt.join(', ')}`)
  }
  for (const p of r.props ?? [])
    line(`  <${p.what} ${p.prop}>  ${p.from ?? '(default)'} → ${p.to ?? '(default)'}   ${p.file}:${p.line} · ${p.by}`)
  line('')
  line(r.ready ? `ready for review — ${r.ready.by}, ${r.ready.at}` : 'not yet handed off')
  line('')
  return out.join('\n')
}
