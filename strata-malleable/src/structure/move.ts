/**
 * THE MOVE — a region changes container or place, as a rewrite of the JSX.
 *
 * There is no store. The drop rewrites source, byte-spliced, and `git diff` is
 * the record: what moved, from where, to where, and nothing else. Three
 * properties carry that:
 *
 *   1. **Nothing outside the cut, the insert and the imports changes.** The
 *      element's text travels verbatim (its stamps inside it), re-indented to
 *      where it lands, and the file around it is untouched byte for byte.
 *   2. **Idempotent.** A move to where a thing already is writes nothing and
 *      records nothing; a second identical request is the first.
 *   3. **Offsets are fresh.** The structure this plans against was read from
 *      the text about to be edited — ship's discipline — so nothing stored
 *      can go stale between the read and the write.
 *
 * What it refuses is structural, by name: a thing that cannot be told apart
 * from a conditional twin, a destination inside the thing itself, a container
 * that is self-closing. What it never refuses is a move that leaves logic
 * behind: a region moved out of the component that bound its state lands, and
 * `adapt` says what to wire. Code follows design; the reviewer follows both.
 */
import path from 'node:path'
import ts from 'typescript'
import type { Container, MoveRecord, MoveRequest, MoveResult, RegionChild, Structure } from '../schema'
import {
  addImport,
  bindingsOf,
  componentAt,
  exportDeclaration,
  freeIdentifiers,
  importsOf,
  moduleOf,
  parse,
  removeImport,
  usesIdentifier,
} from './imports'

export interface Plan {
  /** Files whose text changed, by the path the structure names them by. */
  texts: Map<string, string>
  result: MoveResult
}

const lineStart = (text: string, at: number) => text.lastIndexOf('\n', at - 1) + 1
const lineOf = (text: string, at: number) => text.slice(0, at).split('\n').length
const blank = (s: string) => /^[ \t]*$/.test(s)

/** Where a node's line begins and ends when it owns its line(s); else the node's own bounds. */
function lineBounds(text: string, range: [number, number]) {
  const [start, end] = range
  const ls = lineStart(text, start)
  const before = text.slice(ls, start)
  let j = end
  while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++
  const ownsLine = blank(before) && (j >= text.length || text[j] === '\n')
  return ownsLine
    ? { start: ls, end: j < text.length ? j + 1 : j, indent: before, ownsLine }
    : { start, end, indent: '', ownsLine }
}

/** Re-indent every line after the first that carries the source indent. */
function reindent(block: string, from: string, to: string): string {
  const lines = block.split('\n')
  return lines
    .map((l, i) => (i === 0 ? l : from && l.startsWith(from) ? to + l.slice(from.length) : l))
    .join('\n')
}

const find = (s: Structure, sid: string) => s.containers.find((c) => c.sid === sid)
const childAt = (c: Container, region: string, ordinal: number) =>
  c.children.find((k) => k.component === region && k.ordinal === ordinal)
const same = (a: RegionChild | undefined, b: RegionChild | undefined) => !!a && !!b && a === b

export function planMove(
  structure: Structure,
  read: (file: string) => string | null,
  req: MoveRequest,
  by: 'human' | 'agent',
  at: string,
  /** Absolute path of a structure-relative file, for import resolution. */
  resolve: (file: string) => string = (f) => path.resolve(f),
): Plan {
  const fail = (error: string): Plan => ({ texts: new Map(), result: { ok: false, error } })

  const from = find(structure, req.what.container)
  if (!from) return fail(`no container "${req.what.container}" — run \`malleable regions\``)
  const to = find(structure, req.to.container)
  if (!to) return fail(`no container "${req.to.container}" — run \`malleable regions\``)

  const twins = from.children.filter((k) => k.component === req.what.region && k.kind === 'component')
  if (twins.length > 1 && twins.some((k) => k.condition))
    return fail(
      `${twins.length} <${req.what.region} /> under ${from.sid}, and one renders conditionally — the DOM cannot tell them apart. Move it from the terminal by line: malleable move ${req.what.region} --from ${from.file} --line <n>`,
    )
  const thing = childAt(from, req.what.region, req.what.ordinal)
  if (!thing) return fail(`no <${req.what.region} /> #${req.what.ordinal} under ${from.sid}`)
  if (thing.kind === 'list') return fail(`<${thing.component} /> is rendered from a list — its data is its order`)

  const anchor = 'end' in req.to ? null : childAt(to, ('before' in req.to ? req.to.before : req.to.after).region, ('before' in req.to ? req.to.before : req.to.after).ordinal)
  if (!('end' in req.to) && !anchor) return fail(`no such neighbour under ${to.sid}`)
  if (anchor && from.sid === to.sid && same(anchor, thing)) return fail('a region is not its own neighbour')
  if (
    (to.file === from.file && to.range[0] >= thing.range[0] && to.range[1] <= thing.range[1]) ||
    to.via.includes(thing.component)
  )
    return fail(`${to.sid} is inside <${thing.component} /> — a region cannot be dropped into itself`)
  if (to.close === null) return fail(`${to.sid} is self-closing — give it children before moving anything into it`)

  /* ---- no-op: already there ---- */
  if (from.sid === to.sid) {
    const i = from.children.indexOf(thing)
    const j = anchor ? from.children.indexOf(anchor) : -1
    const already =
      'end' in req.to ? i === from.children.length - 1 : 'before' in req.to ? j === i + 1 : j === i - 1
    if (already) {
      const record = recordFor(thing, from, to, i, by, at, read(from.file) ?? '', read(to.file) ?? '', thing.range[0])
      return { texts: new Map(), result: { ok: true, unchanged: true, edits: [], adapt: [], record } }
    }
  }

  const textA = read(from.file)
  const textB0 = read(to.file)
  if (textA === null || textB0 === null) return fail(`cannot read ${textA === null ? from.file : to.file}`)
  const sameFile = from.file === to.file

  /* ---- cut ---- */
  const cut = lineBounds(textA, thing.range)
  const block = textA.slice(thing.range[0], thing.range[1])

  /* ---- where it lands, on the original destination text ---- */
  let pos: number
  let dstIndent = ''
  let inline = false
  if (anchor) {
    const ab = lineBounds(textB0, anchor.range)
    if ('before' in req.to) {
      pos = ab.start
      dstIndent = ab.indent
      inline = !ab.ownsLine
    } else {
      pos = ab.end
      dstIndent = ab.indent
      inline = !ab.ownsLine
    }
  } else {
    const close = to.close!
    const cls = lineStart(textB0, close)
    if (blank(textB0.slice(cls, close))) {
      pos = cls
      const last = to.children[to.children.length - 1]
      const lastBounds = last ? lineBounds(textB0, last.range) : null
      dstIndent = lastBounds?.ownsLine ? lastBounds.indent : textB0.slice(cls, close) + '  '
    } else {
      pos = close
      inline = true
    }
  }
  const insertion = inline ? block : dstIndent + reindent(block, cut.indent, dstIndent) + '\n'

  /* ---- apply ---- */
  const texts = new Map<string, string>()
  const edits: MoveResult extends { ok: true; edits: infer E } ? E : never = [] as never
  const editList = edits as Array<{ file: string; what: string }>
  let outA: string
  let outB: string
  let insertedAt: number
  if (sameFile) {
    let p = pos
    if (p >= cut.end) p -= cut.end - cut.start
    const after = textA.slice(0, cut.start) + textA.slice(cut.end)
    outA = outB = after.slice(0, p) + insertion + after.slice(p)
    insertedAt = p + (inline ? 0 : dstIndent.length)
  } else {
    outA = textA.slice(0, cut.start) + textA.slice(cut.end)
    outB = textB0.slice(0, pos) + insertion + textB0.slice(pos)
    insertedAt = pos + (inline ? 0 : dstIndent.length)
  }
  editList.push({ file: from.file, what: `cut <${thing.component} /> (line ${lineOf(textA, thing.range[0])})` })
  // Reported after the imports below, which may add a line above the landing.
  const insertEdit = { file: to.file, what: '' }
  editList.push(insertEdit)
  /** Keep the landing offset honest across an edit made earlier in the same text. */
  const track = (before: string, after: string) => {
    let i = 0
    while (i < before.length && i < after.length && before[i] === after[i]) i++
    if (i <= insertedAt) insertedAt += after.length - before.length
  }

  /* ---- what the moved element still needs from where it came ---- */
  const sfA0 = parse(from.file, textA)
  const srcComponent = componentAt(sfA0, thing.range[0])
  const dstComponent = componentAt(parse(to.file, textB0), pos)
  const crossesComponent = !sameFile || (srcComponent && dstComponent && srcComponent !== dstComponent)
  const adapt = srcComponent && crossesComponent ? freeIdentifiers(sfA0, thing.range, srcComponent) : []

  /* ---- bindings ---- */
  if (!sameFile) {
    const name = thing.component
    let sfB = parse(to.file, outB)
    if (!bindingsOf(sfB).has(name)) {
      const binding = importsOf(sfA0).find((b) => b.local === name)
      const absA = resolve(from.file)
      const absB = resolve(to.file)
      let moduleAbs: string
      let imported: string | null = name
      let like: string | undefined
      if (binding && binding.spec.startsWith('.')) {
        moduleAbs = moduleOf(absA, binding.spec)
        imported = binding.imported
        like = binding.spec
      } else if (binding) {
        // A package import: the same specifier works from anywhere.
        moduleAbs = binding.spec
        imported = binding.imported
      } else {
        // Declared in the source file: export it and import it from there.
        // Parsed again, because the cut above moved every offset after it.
        const exported = exportDeclaration(outA, parse(from.file, outA), name)
        if (exported) {
          outA = exported.text
          editList.push({ file: from.file, what: exported.what })
        }
        moduleAbs = absA.replace(/\.(tsx|ts)$/, '')
      }
      const added =
        binding && !binding.spec.startsWith('.')
          ? addImport(outB, sfB, absB, name, imported, moduleAbs, undefined)
          : addImport(outB, sfB, absB, name, imported, moduleAbs, like)
      track(outB, added.text)
      outB = added.text
      editList.push({ file: to.file, what: added.what })
      sfB = parse(to.file, outB)
    }
    // The source file may no longer use the import it carried for this region.
    const sfA1 = parse(from.file, outA)
    if (importsOf(sfA1).some((b) => b.local === name) && !usesIdentifier(sfA1, name)) {
      outA = removeImport(outA, sfA1, name)
      editList.push({ file: from.file, what: `drop the unused import of ${name}` })
    }
  }

  if (outA !== textA) texts.set(from.file, outA)
  if (!sameFile && outB !== textB0) texts.set(to.file, outB)
  const landed = sameFile ? outA : outB
  insertEdit.what = `insert <${thing.component} /> ${anchor ? `${'before' in req.to ? 'before' : 'after'} <${anchor.component} />` : `at the end of <${to.tag}>`} (line ${lineOf(landed, insertedAt)})`

  /* ---- the record ---- */
  const index = anchor
    ? to.children.indexOf(anchor) + ('after' in req.to ? 1 : 0) - (sameFile && from.sid === to.sid && to.children.indexOf(anchor) > to.children.indexOf(thing) ? 1 : 0)
    : to.children.length - (from.sid === to.sid ? 1 : 0)
  const record = recordFor(thing, from, to, index, by, at, textA, landed, insertedAt, adapt)
  return { texts, result: { ok: true, edits: editList, adapt, record } }
}

function recordFor(
  thing: RegionChild,
  from: Container,
  to: Container,
  index: number,
  by: 'human' | 'agent',
  at: string,
  textA: string,
  textB: string,
  insertedAt: number,
  adapt: string[] = [],
): MoveRecord {
  return {
    what: thing.component,
    from: { file: from.file, line: lineOf(textA, thing.range[0]), container: from.sid },
    to: { file: to.file, line: lineOf(textB, insertedAt), container: to.sid, index },
    by,
    at,
    ...(adapt.length ? { adapt } : {}),
  }
}

/** A one-line description of a move, for the terminal and the status line. */
export function describeMove(r: MoveRecord): string {
  const where = r.from.container === r.to.container ? `within ${r.to.container}` : `${r.from.container} → ${r.to.container}`
  return `moved <${r.what} /> ${where} (${r.to.file}:${r.to.line})${r.adapt?.length ? ` · needs wiring at review: ${r.adapt.join(', ')}` : ''}`
}
