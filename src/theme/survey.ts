/**
 * THE SURVEY — what a product's stylesheets already decided, before anyone
 * writes it down.
 *
 * Context precedes judgment, and for a product that exists, the context is
 * in the CSS: which faces it sets, how many radii it uses, whether it paints
 * shadows, how many raw colours it carries and which ones it keeps reaching
 * for. The survey counts those and says nothing about them; `write-grammar`
 * reads it and asks which were decided and which were accidents. On a
 * product with no stylesheet yet it says so, because the voice of a new
 * product starts from references and rejections rather than from evidence.
 */
import { COLUMNS, fold } from '@strata/substrate/format'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { readSheet } from './sheet'
import { join, relative } from 'node:path'
import { COLOR_LITERAL } from './handlers'
import { literals, scanFiles } from './evaluators'

/** A sentence this product already wrote about its own design, and where. */
export interface Quotation {
  file: string
  line: number
  text: string
}

export interface Survey {
  stylesheets: number
  sources: number
  colours: { count: number; declared: number; top: Array<[string, number]> }
  fonts: Array<[string, number]>
  radii: Array<[string, number]>
  shadows: number
  durations: Array<[string, number]>
  /**
   * Who this product looks at. A folder of images named for a designer is a
   * reference with no prose in it, and references are what a voice is written
   * from when a product has no stylesheet worth surveying yet.
   */
  references: string[]
  /**
   * What the product already said about its design, in its own words. The
   * values above are what it did; these are the nearest thing to why, and a
   * rule wants both. Quotations, never conclusions — which of these were
   * decided is a hand's to say.
   */
  quoted: Quotation[]
}

/**
 * The words that mark prose as being about the frame.
 *
 * These are the names of things a stylesheet sets, and they are the wrong
 * instrument for a sentence. "As little design as possible" and "products are
 * tools, not decorative objects" are the most valuable taste a repository
 * holds and contain none of them — a Dieter Rams file scanned this way yielded
 * twelve sentences and kept none. So the words judge the *file*, not the
 * sentence: a file that is about design gives up its prose, and one that is
 * not gives up nothing.
 */
const DESIGN_WORDS =
  /\b(radius|radii|corner|shadow|elevation|colou?r|palette|hue|contrast|font|typeface|weight|spacing|padding|margin|grid|border|opacity|motion|easing|transition|accent|muted|surface|ink|tone|ramp|density|monochrome|aesthetic|restraint|minimal|typography|typographic|visual|hierarchy|layout|legib\w*|whitespace|understated|monospace|wordmark)\b/gi

/** A path that says the file is about design before a word of it is read. */
const DESIGN_PATH = /(design|grammar|voice|brand|aesthetic|principle|style-?guide|\bux\b|\bui\b|typography|(^|\/)(CLAUDE|AGENTS)\.md$)/i

/**
 * How thick the vocabulary has to be, per thousand characters, for a file whose
 * path says nothing to count as being about design.
 *
 * A count on its own does not separate them: a 63KB back-end rules file
 * mentions colour twenty-six times and is not about design, while a 1.7KB note
 * on Dieter Rams mentions it three times and is nothing else. Measured against
 * length the two gems in one portfolio read 3.3 and 1.8, and every file that
 * was flooding the survey reads under 0.8.
 */
const DESIGN_DENSITY = 1.2

/** Whether a markdown file is about this product's design: named for it, or thick with it. */
function isAboutDesign(file: string, text: string): boolean {
  if (DESIGN_PATH.test(file)) return true
  const hits = (text.match(DESIGN_WORDS) ?? []).length
  return hits >= 5 && hits / (text.length / 1000) >= DESIGN_DENSITY
}

/** A divider, a rule-off, a license header: punctuation pretending to be prose. */
const isOrnament = (t: string) => t.replace(/[=\-*_~#/\s]/g, '').length < 20

const clean = (t: string) => t.replace(/\s+/g, ' ').trim()

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length

/** Every comment in a stylesheet, which is prose about the stylesheet by definition. */
function commentsIn(text: string, file: string): Quotation[] {
  const out: Quotation[] = []
  for (const m of text.matchAll(/\/\*([\s\S]*?)\*\//g)) {
    const said = clean(m[1].replace(/^\s*\*+/gm, ' '))
    if (said.length < 25 || isOrnament(said)) continue
    out.push({ file, line: lineOf(text, m.index ?? 0), text: said })
  }
  return out
}

/**
 * The prose in a markdown file that is about design.
 *
 * The file has already been judged; within one, a sentence of ordinary length
 * that is not a heading, a table row or code is taken as it stands. Capped, so
 * a hundred-page plan does not become the whole survey.
 */
function sentencesIn(text: string, file: string, cap = 25): Quotation[] {
  if (!isAboutDesign(file, text)) return []
  const out: Quotation[] = []
  const lines = text.split('\n')
  // A file wrapped in a single unclosed fence is a document someone pasted, not
  // code. Honouring the fence there swallows everything after line one — which
  // is how a 294-line note on copy, ending in "avoid marketing buzzwords or
  // corporate tech jargon", read as an empty file.
  const balanced = lines.filter((l) => /^\s*```/.test(l)).length % 2 === 0
  let fenced = false
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      if (balanced) fenced = !fenced
      continue
    }
    if (fenced || /^\s*[#>|]/.test(lines[i]) || !lines[i].trim()) continue
    // Paragraphs are wrapped, so a sentence is gathered across the lines it spans.
    const start = i
    let para = ''
    while (i < lines.length && lines[i].trim() && !/^\s*```/.test(lines[i])) para += ` ${lines[i++]}`
    for (const said of clean(para).replace(/^[*\-+]\s+/, '').split(/(?<=[.!?])\s+/)) {
      const text = said.replace(/^[*\-+]\s+/, '').trim()
      if (text.length < 40 || text.length > 300) continue
      if (/^!?\[|^https?:\/\//.test(text)) continue
      out.push({ file, line: start + 1, text })
    }
  }
  // Over the cap, take a spread rather than the opening. The sentence that
  // mattered most in one note on copy — "avoid marketing buzzwords or corporate
  // tech jargon" — was its last line, and reading the first twenty-five lost it.
  if (out.length <= cap) return out
  const step = out.length / cap
  return Array.from({ length: cap }, (_, i) => out[Math.floor(i * step)])
}

/**
 * The edits in a spreadsheet, as the pair that was written for one line.
 *
 * A column header does not say which one won. In one portfolio the sheet is
 * titled "Suggested Revision (Minimal & Present Tense)" and the page ships the
 * revision on one row and the original on the next — so trusting the header
 * would teach the voice backwards on half the rows, which is the one mistake
 * worth avoiding here.
 *
 * The page is the evidence. Where one side of a pair is on the product's own
 * surfaces and the other is not, that is a decision and it is reported as one.
 * Where neither is, or both, the pair is reported with no direction claimed.
 */
function editsIn(buf: Buffer, file: string, shipped: string, cap = 20): Quotation[] {
  let rows: string[][]
  try {
    rows = readSheet(buf)
  } catch {
    return []
  }
  if (rows.length < 2) return []
  const head = rows[0].map((c) => c.toLowerCase())
  const from = head.findIndex((c) => /origin|before|current|old/.test(c))
  const to = head.findIndex((c) => /revis|after|new|final|suggest/.test(c))
  if (from < 0 || to < 0) return []
  const out: Quotation[] = []
  for (let i = 1; i < rows.length && out.length < cap; i++) {
    const was = (rows[i][from] ?? '').trim()
    const now = (rows[i][to] ?? '').trim()
    if (was.length < 8 || now.length < 8 || was === now) continue
    const wasLive = shipped.includes(was.toLowerCase())
    const nowLive = shipped.includes(now.toLowerCase())
    const text =
      wasLive === nowLive
        ? `two lines written for the same place, neither confirmed here: “${now}” / “${was}”`
        : nowLive
          ? `chose “${now}” over “${was}”`
          : `chose “${was}” over “${now}”`
    out.push({ file, line: i + 1, text })
  }
  return out
}

/** A stylesheet a page carries inline. A portfolio can be one file and one <style>. */
function stylesIn(text: string): Array<{ css: string; at: number }> {
  const out: Array<{ css: string; at: number }> = []
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) out.push({ css: m[1], at: lineOf(text, m.index ?? 0) })
  return out
}

const top = (m: Map<string, number>, n = 5): Array<[string, number]> => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n)
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

export function survey(root: string): Survey {
  const files = scanFiles(root)
  const css = files.filter((f) => f.endsWith('.css'))
  const fonts = new Map<string, number>()
  const radii = new Map<string, number>()
  const durations = new Map<string, number>()
  const colours = new Map<string, number>()
  let shadows = 0
  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8')
    for (const m of text.matchAll(/font-family\s*:\s*([^;}]+)/g)) bump(fonts, m[1].trim().replace(/\s+/g, ' '))
    for (const m of text.matchAll(/fontFamily\s*:\s*['"`]([^'"`]+)['"`]/g)) bump(fonts, m[1].trim())
    for (const m of text.matchAll(/border-radius\s*:\s*([^;}]+)/g)) bump(radii, m[1].trim())
    for (const m of text.matchAll(/box-shadow\s*:\s*([^;}]+)/g)) if (!/^\s*none\b/.test(m[1])) shadows++
    for (const m of text.matchAll(/(?:transition|animation)(?:-duration)?\s*:\s*[^;}]*?(\d+(?:\.\d+)?m?s)/g)) bump(durations, m[1])
    for (const line of text.split('\n')) if (!line.includes('data:image/')) for (const m of line.matchAll(new RegExp(COLOR_LITERAL.source, 'g'))) bump(colours, m[0])
  }
  const { undeclared, declared } = literals(root)

  // What the product already said about its design. A stylesheet comment is
  // about the stylesheet; a markdown sentence has to name something in the
  // frame to count. GRAMMAR.md is skipped — init writes it, so it is this
  // system talking, not the product.
  const quoted: Quotation[] = []
  // Comments are prose, so they are found the way the other prose is: by
  // walking the repository. Counting values stays inside the configured source
  // — those are this product's own — but a stylesheet's reasoning is worth
  // reading wherever it sits, and a real product's CSS is rarely under `src`.
  for (const file of cssIn(root)) quoted.push(...commentsIn(readFileSync(join(root, file), 'utf8'), file))
  // A page can carry its whole stylesheet inline, and a portfolio often is one
  // file and one <style>. Reading only .css files misses all of it.
  for (const file of htmlIn(root)) {
    const text = readFileSync(join(root, file), 'utf8')
    for (const { css: block, at } of stylesIn(text)) for (const q of commentsIn(block, file)) quoted.push({ ...q, line: q.line + at - 1 })
  }
  for (const file of markdownIn(root)) quoted.push(...sentencesIn(readFileSync(join(root, file), 'utf8'), file))
  // What the product actually ships, so a pair of candidate lines can be told
  // apart by which one is on a surface rather than by a column heading.
  const shipped = [...cssIn(root), ...htmlIn(root)]
    .map((f) => {
      try {
        return readFileSync(join(root, f), 'utf8').toLowerCase()
      } catch {
        return ''
      }
    })
    .join(' ')
  for (const file of sheetsIn(root)) quoted.push(...editsIn(readFileSync(join(root, file)), file, shipped))

  return {
    stylesheets: css.length,
    sources: files.length,
    colours: { count: undeclared.length + declared.length, declared: declared.length, top: top(colours) },
    fonts: top(fonts),
    radii: top(radii),
    shadows,
    durations: top(durations),
    references: referencesIn(root),
    quoted,
  }
}

/** Skipped wholesale: not this product's prose, or not prose at all. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'vendor', '.next', 'out'])

/** A directory named for what it collects: the folders inside it are references. */
const REFERENCE_DIR = /(insp|reference|moodboard|influence|swipe|precedent)/i

/**
 * Someone else's repository, vendored in. A checkout with its own `.git` is not
 * this product's taste however much design prose it carries — a portfolio with
 * Fluent UI beside it would otherwise survey Microsoft.
 */
const isVendored = (abs: string) => existsSync(join(abs, '.git'))
const SKIP_FILES = new Set(['GRAMMAR.md', 'CHANGELOG.md', 'LICENSE.md', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SECURITY.md'])

/**
 * The names inside a folder of references. A designer keeping a directory of
 * Rams, Sagmeister and Swiss design has stated a taste no text scan can reach,
 * and `write-grammar` asks for references first when there is no stylesheet
 * worth surveying.
 */
function referencesIn(root: string, dir = '.', depth = 3): string[] {
  if (depth < 0) return []
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(join(root, dir))
  } catch {
    return out
  }
  for (const name of entries) {
    if (name.startsWith('.') || SKIP_DIRS.has(name)) continue
    const rel = dir === '.' ? name : `${dir}/${name}`
    try {
      if (!statSync(join(root, rel)).isDirectory() || isVendored(join(root, rel))) continue
    } catch {
      continue
    }
    if (REFERENCE_DIR.test(name)) {
      for (const inner of readdirSync(join(root, rel))) {
        if (inner.startsWith('.')) continue
        try {
          if (statSync(join(root, rel, inner)).isDirectory()) out.push(inner)
        } catch {
          continue
        }
      }
    } else out.push(...referencesIn(root, rel, depth - 1))
  }
  return [...new Set(out)]
}

/** Every stylesheet in the repository, wherever the product keeps it. */
const cssIn = (root: string) => filesIn(root, /\.css$/, '.', 4)

/** Every page a product wrote, four deep — a stylesheet may live inside one. */
const htmlIn = (root: string) => filesIn(root, /\.html?$/, '.', 4)

/**
 * Every note a product wrote, four deep. `.txt` counts: one portfolio keeps
 * its designer's verbatim direction in a plain text file, and three of its
 * sharpest rules — "when everything flashes red, it becomes a marketing
 * banner" among them — live nowhere else.
 */
const markdownIn = (root: string) => filesIn(root, /\.(md|txt)$/, '.', 4)

/** Every spreadsheet, where a hand-edited column of copy may be the voice. */
const sheetsIn = (root: string) => filesIn(root, /\.xlsx$/, '.', 4)

function filesIn(root: string, ext: RegExp, dir = '.', depth = 4): string[] {
  if (depth < 0) return []
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(join(root, dir))
  } catch {
    return out
  }
  for (const name of entries) {
    // Dot-directories are tooling, with one exception: `.claude` is where a
    // product keeps the rules and skills it wrote for an agent.
    if ((name.startsWith('.') && name !== '.claude') || SKIP_DIRS.has(name)) continue
    if (dir === '.claude' && name === 'skills') continue // init writes these; they are the system's, not the product's
    const rel = dir === '.' ? name : `${dir}/${name}`
    let isDir = false
    try {
      isDir = statSync(join(root, rel)).isDirectory()
    } catch {
      continue
    }
    if (isDir) {
      if (isVendored(join(root, rel))) continue
      out.push(...filesIn(root, ext, rel, depth - 1))
    }
    else if (ext.test(name) && !SKIP_FILES.has(name)) out.push(rel)
  }
  return out
}

/**
 * A `·`-joined list, packed into lines that fit — broken between facts, never
 * inside one. Plain word-wrapping split "3 radii" across two lines, which
 * leaves a number stranded from its unit.
 */
function packFacts(facts: string[], indent: number, width = COLUMNS): string[] {
  const room = Math.max(24, width - indent)
  const out: string[] = []
  let line = ''
  for (const f of facts) {
    const next = line ? `${line} · ${f}` : f
    if (line && next.length > room) {
      out.push(`${line} ·`)
      line = f
    } else line = next
  }
  if (line) out.push(line)
  return out
}

export function formatSurvey(s: Survey): string {
  if (s.sources === 0) return '  no stylesheets or components under the source yet — nothing to survey; the voice starts from references and rejections'
  const facts = [
    `${s.stylesheets} stylesheet(s) in ${s.sources} file(s)`,
    `${s.colours.count} raw colour(s)${s.colours.declared ? ` (${s.colours.declared} declared)` : ''}`,
    `${s.fonts.length} font famil${s.fonts.length === 1 ? 'y' : 'ies'}`,
    `${s.radii.length} radi${s.radii.length === 1 ? 'us' : 'i'}`,
    `${s.shadows} shadow(s)`,
  ]
  const rows = (name: string, xs: Array<[string, number]>) => (xs.length ? [`  ${name}`, ...xs.map(([k, n]) => `    ${String(n).padStart(3)} × ${k}`)] : [])
  return [
    ...packFacts([`found ${facts[0]}`, ...facts.slice(1)], 2).map((l) => `  ${l}`),
    ...rows('fonts', s.fonts),
    ...rows('radii', s.radii),
    ...rows('colours reached for most', s.colours.top),
    ...rows('durations', s.durations),
    s.colours.count ? fold('npx strata check lists every raw colour with the way to declare it; /write-grammar asks which of these were decided', 2).map((l) => `  ${l}`).join('\n') : '',
    ...(s.quoted.length
      ? [
          `  ${s.quoted.length} thing(s) this product already said about its design`,
          ...s.quoted.slice(0, 6).flatMap((q) => [`    ${q.file}:${q.line}`, ...fold(q.text.length > 200 ? `${q.text.slice(0, 200)}…` : q.text, 6).map((l) => `      ${l}`)]),
          s.quoted.length > 6 ? `    … ${s.quoted.length - 6} more; /write-grammar reads them all` : '',
        ].filter(Boolean)
      : []),
  ]
    .filter(Boolean)
    .join('\n')
}
