/**
 * THE SURVEY — what a product already said about its own design.
 *
 * The values a stylesheet sets are what a product did; these are the nearest
 * thing to why. Every case here is one a real repository produced: the tests
 * exist because running the scan against a portfolio and a platform broke it
 * five separate ways, and each fix is pinned below so it cannot come back.
 */
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { survey } from '../src/theme/survey'
import { readSheet } from '../src/theme/sheet'

function dir(): string {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'strata-survey-')))
  fs.mkdirSync(path.join(d, 'src'), { recursive: true })
  return d
}

const put = (root: string, rel: string, text: string | Buffer) => {
  fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}

const said = (root: string) => survey(root).quoted.map((q) => q.text)
const from = (root: string, file: string) => survey(root).quoted.filter((q) => q.file === file)

/* ---------------- a spreadsheet, written byte by byte ---------------- */

/**
 * A zip of the two parts an .xlsx is read from. Written here rather than
 * committed as a binary so the awkward shapes — a row with a gap, a cell that
 * closes itself — can be produced on purpose; a real sheet may have neither.
 */
function xlsx(rows: Array<Array<string | null>>): Buffer {
  const strings: string[] = []
  const idx = (s: string) => {
    const at = strings.indexOf(s)
    return at < 0 ? strings.push(s) - 1 : at
  }
  const body = rows
    .map((cells, r) => {
      const inner = cells
        .map((c, i) => {
          const ref = `${String.fromCharCode(65 + i)}${r + 1}`
          // A null cell is written self-closing, the way a spreadsheet writes an empty one.
          return c === null ? `<c r="${ref}"/>` : `<c r="${ref}" t="s"><v>${idx(c)}</v></c>`
        })
        .join('')
      return `<row r="${r + 1}">${inner}</row>`
    })
    .join('')
  const parts: Array<[string, string]> = [
    ['xl/sharedStrings.xml', `<sst>${strings.map((s) => `<si><t>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</t></si>`).join('')}</sst>`],
    ['xl/worksheets/sheet1.xml', `<worksheet><sheetData>${body}</sheetData></worksheet>`],
  ]
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let at = 0
  for (const [name, xml] of parts) {
    const raw = Buffer.from(xml, 'utf8')
    const deflated = deflateRawSync(raw)
    const n = Buffer.from(name, 'utf8')
    const local = Buffer.alloc(30 + n.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt32LE(deflated.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(n.length, 26)
    n.copy(local, 30)
    const c = Buffer.alloc(46 + n.length)
    c.writeUInt32LE(0x02014b50, 0)
    c.writeUInt16LE(8, 10)
    c.writeUInt32LE(deflated.length, 20)
    c.writeUInt32LE(raw.length, 24)
    c.writeUInt16LE(n.length, 28)
    c.writeUInt32LE(at, 42)
    n.copy(c, 46)
    central.push(c)
    locals.push(local, deflated)
    at += local.length + deflated.length
  }
  const dirBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(parts.length, 8)
  end.writeUInt16LE(parts.length, 10)
  end.writeUInt32LE(dirBuf.length, 12)
  end.writeUInt32LE(at, 16)
  return Buffer.concat([...locals, dirBuf, end])
}

/* ---------------- the sheet reader ---------------- */

test('a spreadsheet is read without a dependency, and a gap does not shift the columns after it', () => {
  const rows = readSheet(xlsx([
    ['Selector', 'Original Copy', 'Suggested Revision'],
    ['h1', 'Turned my chair around.', 'Co-designing with infrastructure teams.'],
    // The middle cell is empty. Counting cells in order would move the third
    // into the second's place and pair the wrong two lines together.
    ['p.sub', null, 'Sole design ownership.'],
  ]))
  assert.equal(rows.length, 3)
  assert.deepEqual(rows[0], ['Selector', 'Original Copy', 'Suggested Revision'])
  assert.deepEqual(rows[1], ['h1', 'Turned my chair around.', 'Co-designing with infrastructure teams.'])
  assert.deepEqual(rows[2], ['p.sub', '', 'Sole design ownership.'], 'the empty cell holds its place')
})

test('something that is not a spreadsheet is no rows, not a crash', () => {
  assert.deepEqual(readSheet(Buffer.from('this is not a zip')), [])
  assert.deepEqual(readSheet(Buffer.alloc(0)), [])
})

/* ---------------- what the scan reads ---------------- */

test('a stylesheet gives up its reasons, and its dividers and rule-offs are not reasons', () => {
  const root = dir()
  put(root, 'src/app.css', [
    '/* ===================== */',
    '/* the live prompt — the one red mark on the page, and the only thing moving */',
    '.a { color: red }',
    '/* short */',
  ].join('\n'))
  const q = said(root)
  assert.ok(q.some((t) => t.includes('the one red mark on the page')), 'the reason is read')
  assert.ok(!q.some((t) => /^=+$/.test(t)), 'a divider is not a reason')
  assert.ok(!q.some((t) => t === 'short'), 'four words are not a reason')
})

test('a page that carries its whole stylesheet inline is read, and the line is the line in the page', () => {
  // One portfolio is a single 366KB index.html with one <style>. Reading only
  // .css files found nothing in it at all.
  const root = dir()
  put(root, 'index.html', ['<!doctype html>', '<head>', '<style>', '/* a quiet strip under the work, not competing with it */', '</style>'].join('\n'))
  const q = from(root, 'index.html')
  assert.equal(q.length, 1)
  assert.match(q[0].text, /a quiet strip under the work/)
  assert.equal(q[0].line, 4, 'the line is counted in the page, not in the style block')
})

test('a stylesheet is found wherever the product keeps it, not only under the configured source', () => {
  // A platform kept its CSS at web/src/styles/. Scanning only the configured
  // source dir made its three hundred richest comments invisible.
  const root = dir()
  put(root, 'web/src/styles/ui.css', '/* A value is a decision, and a decision typed twice is a decision that will diverge. */')
  assert.ok(said(root).some((t) => t.includes('typed twice')))
})

/* ---------------- which prose counts ---------------- */

test('a file about design gives up its prose; one that is not gives up none', () => {
  const root = dir()
  // Named for it.
  put(root, 'docs/design-notes/frame.md', 'The frame stays quiet so the work inside it can carry material and light.')
  // Thick with it, though nothing in the path says so.
  put(root, 'taste.md', 'Restraint reads as seniority here. The typography is monospace and the hierarchy comes from weight, never from size. Colour is information, never decoration.')
  // A long file that mentions colour twice and is about neither.
  put(root, 'backend.md', `Queues and workers.${' The retry budget is a fact about the class of job.'.repeat(60)} One colour of log line. Another colour.`)
  const files = new Set(survey(root).quoted.map((q) => q.file))
  assert.ok(files.has('docs/design-notes/frame.md'), 'named for design')
  assert.ok(files.has('taste.md'), 'thick with design')
  assert.ok(!files.has('backend.md'), 'a long file with a few mentions is not about design')
})

test('CLAUDE.md is read: it is where a designer writes the rules an agent works under', () => {
  const root = dir()
  put(root, 'CLAUDE.md', 'The accent is surgical: red exists only on mechanical states, never on headings or decoration.')
  assert.deepEqual(said(root), ['The accent is surgical: red exists only on mechanical states, never on headings or decoration.'])
})

test('a note is a note whether or not it is markdown', () => {
  // One portfolio keeps its designer's verbatim direction in a .txt, and three
  // of its sharpest rules live nowhere else.
  const root = dir()
  put(
    root,
    'highlight-reel.txt',
    'Consider the restraint of Dieter Rams and the sparse economy of Hemingway. When everything flashes red it becomes a marketing banner and the accent stops being information. The typography stays monospace and the hierarchy comes from weight. Spacing is the primary tool and the layout keeps its whitespace.',
  )
  assert.ok(said(root).some((t) => t.includes('marketing banner')))
})

test('a file wrapped in one unclosed fence is a document, not code', () => {
  // A 294-line note on copy opened with ```markdown and never closed. Honouring
  // the fence read it as an empty file and lost every line of it.
  const root = dir()
  const body = 'The aesthetic is monochrome typography and restraint. Avoid marketing buzzwords or corporate tech jargon. The layout keeps its hierarchy in weight.'
  put(root, 'feedback.md', `\`\`\`markdown\n${body}\n`)
  assert.ok(said(root).some((t) => t.includes('buzzwords')), 'an unbalanced fence does not swallow the file')

  const fenced = dir()
  put(fenced, 'notes.md', `The aesthetic is monochrome typography and restraint here.\n\n\`\`\`\nconst radius = 12 // colour contrast spacing layout\n\`\`\`\n`)
  assert.ok(!said(fenced).some((t) => t.includes('const radius')), 'a closed fence is still code')
})

/* ---------------- what is not this product's ---------------- */

test("someone else's repository is not this product's taste", () => {
  // A portfolio with Fluent UI vendored beside it would otherwise survey Microsoft.
  const root = dir()
  put(root, 'vendored/.git/HEAD', 'ref: refs/heads/main\n')
  put(root, 'vendored/docs/design.md', 'Their elevation ramp is four shadows and their palette is twelve hues.')
  put(root, 'docs/design.md', 'Our elevation is one rule and an alpha wash, and the palette is one accent.')
  const files = new Set(survey(root).quoted.map((q) => q.file))
  assert.ok(files.has('docs/design.md'))
  assert.ok(![...files].some((f) => f.startsWith('vendored/')), 'a directory with its own .git is skipped')
})

/* ---------------- references ---------------- */

test('a folder of references is a taste with no prose in it', () => {
  // Names in a directory are the only statement some influences ever get, and
  // the folder is spelled by hand — this one was "inspriration".
  const root = dir()
  fs.mkdirSync(path.join(root, 'swiss design inspriration', 'Deiter rams'), { recursive: true })
  fs.mkdirSync(path.join(root, 'swiss design inspriration', 'sagmeister walsh'), { recursive: true })
  put(root, 'swiss design inspriration/Deiter rams/braun.jpg', 'not an image, and it does not matter')
  assert.deepEqual(survey(root).references.sort(), ['Deiter rams', 'sagmeister walsh'])
})

/* ---------------- the copy a product settled on ---------------- */

test('a column heading does not say which line won; the page does', () => {
  // The sheet is headed "Suggested Revision", and the portfolio it came from
  // ships the revision on one row and the original on the next. Trusting the
  // heading would teach the voice backwards on half of them.
  const root = dir()
  put(root, 'index.html', '<h1>Co-designing with infrastructure teams.</h1><p>Ten years designing AI products, end to end.</p>')
  put(root, 'copy/edits.xlsx', xlsx([
    ['Selector', 'Original Copy', 'Suggested Revision'],
    ['h1', 'Turned my chair around.', 'Co-designing with infrastructure teams.'],
    ['p.sub', 'Ten years designing AI products, end to end.', 'A decade shaping AI interfaces from inception.'],
    ['p.foot', 'Neither of these is on the page.', 'Nor is this one anywhere at all.'],
  ]))
  const q = from(root, 'copy/edits.xlsx').map((x) => x.text)
  assert.ok(
    q.some((t) => t.includes('chose “Co-designing with infrastructure teams.” over “Turned my chair around.”')),
    'the revision shipped, so the revision is the decision',
  )
  assert.ok(
    q.some((t) => t.includes('chose “Ten years designing AI products, end to end.” over “A decade shaping AI interfaces from inception.”')),
    'the original shipped on this row, and the heading is not consulted',
  )
  assert.ok(
    q.some((t) => t.startsWith('two lines written for the same place, neither confirmed here')),
    'where neither is on a surface, no direction is claimed',
  )
})
