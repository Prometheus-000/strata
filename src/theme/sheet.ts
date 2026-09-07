/**
 * SPREADSHEETS, READ WITHOUT A DEPENDENCY.
 *
 * A designer's copy voice is often not prose about copy — it is a column of
 * before and a column of after, hand-edited line by line. `List of Final Text
 * Substitutions.xlsx` in one portfolio is three columns: the element, the
 * original, and the revision. The direction of the edit is the taste, and it
 * is invisible to every scanner that reads text files.
 *
 * An .xlsx is a zip of XML. Node ships inflate but no zip reader, so the
 * central directory is walked here — sixty lines against a dependency that
 * would ship with every adopter.
 */
import { inflateRawSync } from 'node:zlib'

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50

/** The named entries of a zip, decompressed. Stored and deflated only. */
function unzip(buf: Buffer, want: (name: string) => boolean): Map<string, string> {
  const out = new Map<string, string>()
  // The end-of-central-directory record is last, after a comment of unknown length.
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 0xffff; i--)
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i
      break
    }
  if (eocd < 0) return out
  let at = buf.readUInt32LE(eocd + 16)
  const count = buf.readUInt16LE(eocd + 10)
  for (let i = 0; i < count && at + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(at) !== CENTRAL) break
    const method = buf.readUInt16LE(at + 10)
    const compressed = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const local = buf.readUInt32LE(at + 42)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    at += 46 + nameLen + extraLen + commentLen
    if (!want(name)) continue
    // The local header repeats the name and extra, at its own lengths.
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(dataAt, dataAt + compressed)
    try {
      out.set(name, (method === 0 ? raw : inflateRawSync(raw)).toString('utf8'))
    } catch {
      // A member this cannot read is skipped; the sheet is still worth reading.
    }
  }
  return out
}

const unescape = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, '&')

const text = (xml: string) => unescape(xml.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

/** The rows of the first sheet, as strings. Numbers and formulas are dropped. */
export function readSheet(buf: Buffer): string[][] {
  const parts = unzip(buf, (n) => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet1\.xml$/.test(n))
  const shared = [...(parts.get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => text(m[1]))
  const sheet = parts.get('xl/worksheets/sheet1.xml')
  if (!sheet) return []
  const rows: string[][] = []
  for (const r of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = []
    // A cell carries its own column in `r` ("C2"), which is the only reliable
    // placement: an empty cell is written self-closing or omitted entirely, and
    // counting cells in order silently shifts every column after the gap.
    for (const c of r[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]
      const at = column(/r="([A-Z]+)/.exec(attrs)?.[1] ?? '')
      const kind = /t="(\w+)"/.exec(attrs)?.[1]
      const body = c[2] ?? ''
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      let said = ''
      if (kind === 's' && v !== undefined) said = shared[Number(v)] ?? ''
      else if (kind === 'inlineStr' || kind === 'str') said = text(body)
      while (cells.length < at) cells.push('')
      cells[at] = said
    }
    if (cells.some((x) => x)) rows.push(cells)
  }
  return rows
}

/** "C" → 2, "AA" → 26. A spreadsheet names its columns in letters. */
function column(ref: string): number {
  let n = 0
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64)
  return Math.max(0, n - 1)
}
