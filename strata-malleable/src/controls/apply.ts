/**
 * A prop pick, on disk. Finds the call site by (file, parent, component,
 * ordinal) against a fresh parse and writes the one attribute. The decision
 * that records who picked it wraps this call — see `decide/`.
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type { CallSite, PropRecord, PropRequest, PropResult } from '../schema'
import { callSitesOf, setProp } from './read'

export const parseTsx = (file: string, text: string) =>
  ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)

/** The call site a request names, or the reason it cannot be told apart. */
export function siteFor(sites: CallSite[], req: Pick<PropRequest, 'component' | 'parent' | 'ordinal'>): CallSite | { error: string } {
  const inParent = sites.filter((s) => s.parent === req.parent)
  if (!inParent.length) return { error: `no <${req.component}> inside ${req.parent}` }
  // One call site rendered many times is still one line in source: a pick on
  // any of its instances is a pick on the line.
  if (inParent.length === 1) return inParent[0]
  if (inParent.some((s) => s.list))
    return {
      error: `${inParent.length} <${req.component}> inside ${req.parent}, one rendered from a list — the instances cannot be told apart. Edit the call site by hand.`,
    }
  const site = inParent[req.ordinal]
  return site ?? { error: `no <${req.component}> #${req.ordinal} inside ${req.parent}` }
}

/**
 * The first candidate parent that actually calls the component. Offered
 * nearest-first by the overlay, because what renders inside a Card may have
 * been written in the Gallery that composed it.
 */
export function resolveCallSite(
  component: string,
  candidates: Array<{ parent: string; file: string; ordinal: number }>,
  read: (file: string) => string | null,
): { site: CallSite; parent: string; file: string; ordinal: number } | { error: string } {
  let lastError = `no <${component}> call site among ${candidates.map((c) => c.parent).join(', ') || 'nothing'}`
  for (const c of candidates) {
    const text = read(c.file)
    if (text === null) continue
    const found = siteFor(callSitesOf(parseTsx(c.file, text), component), { component, parent: c.parent, ordinal: c.ordinal })
    if ('error' in found) {
      if (!/^no </.test(found.error)) lastError = found.error
      continue
    }
    return { site: found, parent: c.parent, file: c.file, ordinal: c.ordinal }
  }
  return { error: lastError }
}

export function applyProp(
  req: PropRequest,
  by: 'human' | 'agent',
  at: string,
  opts: { root?: string; dryRun?: boolean } = {},
): PropResult & { written: string[] } {
  const root = opts.root ?? process.cwd()
  const abs = path.resolve(root, req.file)
  if (!fs.existsSync(abs)) return { ok: false, error: `cannot read ${req.file}`, written: [] }
  const text = fs.readFileSync(abs, 'utf8')
  const sf = parseTsx(req.file, text)
  const site = siteFor(callSitesOf(sf, req.component), req)
  if ('error' in site) return { ok: false, error: site.error, written: [] }
  const from = site.attrs[req.prop] ?? null
  const result = setProp(text, sf, site, req.prop, req.value)
  if ('error' in result) return { ok: false, error: result.error, written: [] }
  const record: PropRecord = {
    kind: 'prop',
    what: req.component,
    prop: req.prop,
    from,
    to: req.value,
    file: req.file,
    line: site.line,
    by,
    at,
  }
  if (result.text === text) return { ok: true, unchanged: true, edit: '', record, written: [] }
  if (opts.dryRun) return { ok: true, edit: result.what, record, written: [] }
  fs.writeFileSync(abs, result.text)
  return { ok: true, edit: result.what, record, written: [req.file] }
}
