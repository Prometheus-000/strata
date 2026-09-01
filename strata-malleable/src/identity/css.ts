/**
 * A stylesheet reader, deliberately small and deliberately strict.
 *
 * It reads exactly the shape a base value is allowed to have: a single-class
 * selector, unconditional, one value. Anything else — a shorthand with two
 * lengths, a rule inside `@media`, a compound selector — is not extracted, and
 * the property is simply not malleable on that node. That is the honest answer:
 * ship has to write these back into source, and a value it cannot address
 * unambiguously is a value it must not offer to change.
 */

export interface Decl {
  property: string
  value: string
  /** Absolute offsets of the value text, so ship can rewrite it in place. */
  valueStart: number
  valueEnd: number
}

export interface Rule {
  selectors: string[]
  decls: Decl[]
  /** Set when the rule sits inside an at-rule. Not eligible as a base. */
  condition?: string
  /** Byte range of the rule body, for ship's write-back. */
  bodyStart: number
  bodyEnd: number
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))

export function parseRules(css: string): Rule[] {
  const src = stripComments(css)
  const rules: Rule[] = []

  const walk = (start: number, end: number, condition?: string) => {
    let i = start
    let preludeStart = i
    while (i < end) {
      const ch = src[i]
      if (ch === '{') {
        const prelude = src.slice(preludeStart, i).trim()
        // Find the matching close brace.
        let depth = 1
        let j = i + 1
        while (j < end && depth > 0) {
          if (src[j] === '{') depth++
          else if (src[j] === '}') depth--
          j++
        }
        const bodyStart = i + 1
        const bodyEnd = j - 1
        if (prelude.startsWith('@')) {
          // An at-rule with a block: descend, carrying the condition so the
          // rules inside are visible but ineligible.
          if (/^@(media|supports|container|layer)/.test(prelude))
            walk(bodyStart, bodyEnd, condition ? `${condition} and ${prelude}` : prelude)
        } else if (prelude) {
          rules.push({
            selectors: prelude.split(',').map((s) => s.trim()).filter(Boolean),
            decls: parseDecls(src.slice(bodyStart, bodyEnd), bodyStart),
            condition,
            bodyStart,
            bodyEnd,
          })
        }
        i = j
        preludeStart = i
        continue
      }
      if (ch === '}') {
        i++
        preludeStart = i
        continue
      }
      i++
    }
  }

  walk(0, src.length)
  return rules
}

function parseDecls(body: string, offset: number): Decl[] {
  const out: Decl[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ';' && depth === 0) {
      push(start, i)
      start = i + 1
    }
  }
  push(start, body.length)
  return out

  function push(from: number, to: number) {
    const chunk = body.slice(from, to)
    if (!chunk.trim()) return
    const c = chunk.indexOf(':')
    if (c < 0) return
    const rawValue = chunk.slice(c + 1)
    const lead = rawValue.length - rawValue.trimStart().length
    const trail = rawValue.length - rawValue.trimEnd().length
    out.push({
      property: chunk.slice(0, c).trim(),
      value: rawValue.trim(),
      valueStart: offset + from + c + 1 + lead,
      valueEnd: offset + to - trail,
    })
  }
}

/** `.st-card` → `st-card`. Null for anything more complicated. */
export function simpleClass(selector: string): string | null {
  return /^\.([A-Za-z0-9_-]+)$/.exec(selector.trim())?.[1] ?? null
}

/** A single-value declaration, as a token reference or a bare length. */
export function readValue(value: string): { token: string } | { literal: string } | null {
  const v = value.trim()
  const token = /^var\(\s*(--[A-Za-z0-9-]+)\s*\)$/.exec(v)
  if (token) return { token: token[1] }
  if (/^(-?\d*\.?\d+)(px|rem|em)$/.test(v) || v === '0') return { literal: v }
  return null // shorthand, calc, multiple values — not addressable
}
