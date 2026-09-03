/**
 * Reading controls and call sites out of source, and writing a prop pick back.
 *
 * A prop control is applied where the component is *used*, not where it is
 * defined — `tone="accent"` lives on `<Badge tone="accent">` in Gallery.tsx.
 * So the reader knows two things: what each component declared, and every
 * place each component is called from, in source order, with the attributes
 * it is passed. A pick splices one attribute value; nothing else in the file
 * moves. The same discipline as identity and as a move: offsets come from the
 * text about to be edited, and the rest of the file is untouched byte for byte.
 */
import ts from 'typescript'
import { PROPERTIES } from '../resolve/properties'
import type { CallSite, Controls, CssControl, PropControl, PropValue } from '../schema'

type Literal = string | number | boolean | null | Literal[] | { [k: string]: Literal }

function literalOf(node: ts.Node): Literal | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = literalOf(node.operand)
    return typeof inner === 'number' ? -inner : undefined
  }
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))
    return literalOf(node.expression)
  if (ts.isArrayLiteralExpression(node)) {
    const out: Literal[] = []
    for (const el of node.elements) {
      const v = literalOf(el)
      if (v === undefined) return undefined
      out.push(v)
    }
    return out
  }
  if (ts.isObjectLiteralExpression(node)) {
    const out: Record<string, Literal> = {}
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) return undefined
      const key = ts.isIdentifier(prop.name) ? prop.name.text : ts.isStringLiteral(prop.name) ? prop.name.text : undefined
      if (key === undefined) return undefined
      const v = literalOf(prop.initializer)
      if (v === undefined) return undefined
      out[key] = v
    }
    return out
  }
  return undefined
}

const isRecord = (v: Literal | undefined): v is { [k: string]: Literal } =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** `defineControls(Name, {...})` calls in a file: component → what it declared. */
export function readControls(sf: ts.SourceFile, problems: string[] = []): Map<string, Controls> {
  const out = new Map<string, Controls>()
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineControls' &&
      node.arguments.length === 2 &&
      ts.isIdentifier(node.arguments[0])
    ) {
      const component = node.arguments[0].text
      const spec = literalOf(node.arguments[1])
      if (!isRecord(spec)) {
        problems.push(`${sf.fileName}: defineControls(${component}, …) needs a plain object literal — controls are data, not a computation`)
        return
      }
      const controls: Controls = { css: {}, props: {} }
      for (const [key, v] of Object.entries(spec)) {
        if (v === false) {
          if (key in PROPERTIES) controls.css[key] = false
          else problems.push(`${sf.fileName}: ${component}.${key}: only a CSS property (${Object.keys(PROPERTIES).join(', ')}) can be switched off`)
          continue
        }
        if (!isRecord(v)) {
          problems.push(`${sf.fileName}: ${component}.${key}: expected an object or false`)
          continue
        }
        if (Array.isArray(v.options)) {
          const options = v.options.filter((o): o is string => typeof o === 'string')
          if (options.length < 2) problems.push(`${sf.fileName}: ${component}.${key}: options needs at least two strings`)
          else controls.props[key] = { kind: 'options', options } satisfies PropControl
          continue
        }
        if (v.toggle === true) {
          controls.props[key] = { kind: 'toggle', default: v.default === true } satisfies PropControl
          continue
        }
        const range =
          Array.isArray(v.range) && v.range.length === 2 && v.range.every((n) => typeof n === 'number')
            ? ([v.range[0] as number, v.range[1] as number] as [number, number])
            : null
        if (!(key in PROPERTIES) && range) {
          controls.props[key] = { kind: 'number', range, step: typeof v.step === 'number' && v.step > 0 ? v.step : 1 } satisfies PropControl
          continue
        }
        if (key in PROPERTIES) {
          const c: CssControl = {}
          if (Array.isArray(v.range) && v.range.length === 2 && v.range.every((n) => typeof n === 'number'))
            c.range = [v.range[0] as number, v.range[1] as number]
          if (Array.isArray(v.snap)) c.snap = v.snap.filter((s): s is string => typeof s === 'string')
          controls.css[key] = c
          continue
        }
        problems.push(`${sf.fileName}: ${component}.${key}: neither a CSS property nor a prop with options, toggle, or range`)
      }
      out.set(component, controls)
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

/* ---------------- call sites ---------------- */

/** Nearest enclosing capitalised function or const. */
function parentOf(node: ts.Node): string {
  let n: ts.Node | undefined = node.parent
  while (n) {
    if (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text)) return n.name.text
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && /^[A-Z]/.test(n.name.text)) return n.name.text
    n = n.parent
  }
  return ''
}

/**
 * Rendered from a `.map` anywhere up to the component that owns it — through
 * enclosing elements and attributes too, because `footer={<Button />}` inside
 * a mapped `<Card>` is still one line rendering many buttons.
 */
function inList(n: ts.Node): boolean {
  let p: ts.Node | undefined = n.parent
  while (p) {
    if (ts.isFunctionDeclaration(p)) return false
    if (
      (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
      ts.isVariableDeclaration(p.parent) &&
      ts.isIdentifier(p.parent.name) &&
      /^[A-Z]/.test(p.parent.name.text)
    )
      return false
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && p.expression.name.text === 'map') return true
    p = p.parent
  }
  return false
}

/** Every `<Component …>` in a file, in source order, with ordinals per enclosing component. */
export function callSitesOf(sf: ts.SourceFile, component: string): CallSite[] {
  const out: CallSite[] = []
  const counters = new Map<string, number>()
  const visit = (node: ts.Node) => {
    const el = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
    if (el && el.tagName.getText(sf) === component) {
      const parent = parentOf(node)
      const ordinal = counters.get(parent) ?? 0
      counters.set(parent, ordinal + 1)
      const attrs: Record<string, PropValue> = {}
      for (const a of el.attributes.properties) {
        if (!ts.isJsxAttribute(a)) continue
        attrs[a.name.getText(sf)] = attrValue(a)
      }
      out.push({
        component,
        parent,
        ordinal,
        line: sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1,
        range: [node.getStart(sf), node.getEnd()],
        insertAt: el.tagName.getEnd(),
        attrs,
        list: inList(node),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

/** What an attribute states, when it states a literal. A bare attribute is `true`. */
function attrValue(a: ts.JsxAttribute): PropValue {
  const init = a.initializer
  if (!init) return true
  if (ts.isStringLiteral(init)) return init.text
  if (!ts.isJsxExpression(init) || !init.expression) return null
  const e = init.expression
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text
  if (ts.isNumericLiteral(e)) return Number(e.text)
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(e.operand)) return -Number(e.operand.text)
  if (e.kind === ts.SyntaxKind.TrueKeyword) return true
  if (e.kind === ts.SyntaxKind.FalseKeyword) return false
  return null
}

/** The attribute text for a value: `="str"`, `={12}`, bare for true, `={false}`. */
const attrText = (prop: string, value: Exclude<PropValue, null>) =>
  typeof value === 'string' ? `${prop}="${value.replace(/"/g, '&quot;')}"` : value === true ? prop : `${prop}={${String(value)}}`

/**
 * Write one attribute on one call site. Replaces a literal value, adds the
 * attribute when absent, removes it when `value` is null. An attribute whose
 * value is an expression is left alone and refused by name — the code decides
 * that one, not a pick.
 */
export function setProp(
  text: string,
  sf: ts.SourceFile,
  site: CallSite,
  prop: string,
  value: PropValue,
): { text: string; what: string } | { error: string } {
  const found: { el: ts.JsxOpeningLikeElement | null } = { el: null }
  const find = (n: ts.Node) => {
    if (found.el) return
    const o = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null
    if (o && n.getStart(sf) === site.range[0]) {
      found.el = o
      return
    }
    ts.forEachChild(n, find)
  }
  find(sf)
  if (!found.el) return { error: `no <${site.component}> at line ${site.line} any more — re-read` }
  const opening: ts.JsxOpeningLikeElement = found.el
  const attr = opening.attributes.properties.find(
    (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText(sf) === prop,
  )
  const where = `on <${site.component}> (line ${site.line})`
  const show = (v: PropValue) => (v === null ? '(default)' : typeof v === 'string' ? v : String(v))
  if (attr) {
    const from = attrValue(attr)
    if (attr.initializer && from === null)
      return { error: `${prop} ${where} is an expression (${attr.initializer.getText(sf)}) — the code decides it, not a pick` }
    if (from === value) return { text, what: '' }
    // Take the whole attribute, and the one space before it, then put the new one back.
    let start = attr.getStart(sf)
    if (text[start - 1] === ' ') start--
    const end = attr.getEnd()
    if (value === null) return { text: text.slice(0, start) + text.slice(end), what: `drop ${prop} ${where}` }
    return { text: text.slice(0, start) + ' ' + attrText(prop, value) + text.slice(end), what: `${prop}: ${show(from)} → ${show(value)} ${where}` }
  }
  if (value === null) return { text, what: '' }
  const at = site.insertAt
  return { text: text.slice(0, at) + ' ' + attrText(prop, value) + text.slice(at), what: `${prop}: (default) → ${show(value)} ${where}` }
}
