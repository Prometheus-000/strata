/**
 * Import surgery for a cross-file move. A region moved into a container that
 * lives in another file has to be bound there, and unbound where it left —
 * both as text splices, never as a re-printed module, so the diff shows the
 * move and nothing else.
 */
import path from 'node:path'
import ts from 'typescript'

export interface ImportBinding {
  /** The name used in this file. */
  local: string
  /** The exported name, when named; null for a default import. */
  imported: string | null
  spec: string
  decl: ts.ImportDeclaration
  element?: ts.ImportSpecifier
}

export const parse = (file: string, text: string) =>
  ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)

export function importsOf(sf: ts.SourceFile): ImportBinding[] {
  const out: ImportBinding[] = []
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !st.importClause) continue
    const spec = st.moduleSpecifier.text
    if (st.importClause.name) out.push({ local: st.importClause.name.text, imported: null, spec, decl: st })
    const nb = st.importClause.namedBindings
    if (nb && ts.isNamedImports(nb))
      for (const el of nb.elements)
        out.push({
          local: el.name.text,
          imported: (el.propertyName ?? el.name).text,
          spec,
          decl: st,
          element: el,
        })
  }
  return out
}

/** Names bound at the top level: imports and declarations. */
export function bindingsOf(sf: ts.SourceFile): Set<string> {
  const out = new Set<string>()
  for (const b of importsOf(sf)) out.add(b.local)
  for (const st of sf.statements) {
    if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) out.add(st.name.text)
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) out.add(d.name.text)
  }
  return out
}

/** The top-level statement declaring `name`, if this file declares it. */
export function declarationOf(sf: ts.SourceFile, name: string): ts.Statement | null {
  for (const st of sf.statements) {
    if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name?.text === name) return st
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations)
        if (ts.isIdentifier(d.name) && d.name.text === name) return st
  }
  return null
}

export const isExportedStatement = (st: ts.Statement) =>
  (ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined)?.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword,
  ) ?? false

/** The quote character this file's imports use; the first one decides. */
export function quoteOf(sf: ts.SourceFile, fallback = "'"): string {
  for (const st of sf.statements)
    if (ts.isImportDeclaration(st)) return st.moduleSpecifier.getText(sf)[0] ?? fallback
  return fallback
}

/** Strip a relative specifier's extension so two spellings of one module compare equal. */
const moduleKey = (abs: string) => abs.replace(/\.(tsx|ts|jsx|js)$/, '').replace(/\/index$/, '')

/** The module a relative specifier names, as an absolute extensionless key. */
export const moduleOf = (fromFile: string, spec: string) => moduleKey(path.resolve(path.dirname(fromFile), spec))

/** A relative specifier from `toFile` to a module key, keeping the extension style of `like`. */
export function specifierFrom(toFile: string, moduleAbs: string, like?: string): string {
  let rel = path.relative(path.dirname(toFile), moduleAbs).split(path.sep).join('/')
  if (!rel.startsWith('.')) rel = `./${rel}`
  const ext = like ? (/\.(tsx|ts|jsx|js)$/.exec(like)?.[0] ?? '') : ''
  return rel + ext
}

/** Does `name` appear as an identifier anywhere outside import declarations? */
export function usesIdentifier(sf: ts.SourceFile, name: string): boolean {
  let used = false
  const visit = (n: ts.Node) => {
    if (used) return
    if (ts.isImportDeclaration(n)) return
    if (ts.isIdentifier(n) && n.text === name) {
      // `a.name` is a property, not a use of the binding.
      const p = n.parent
      if (ts.isPropertyAccessExpression(p) && p.name === n) return
      used = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return used
}

const lineStart = (text: string, at: number) => text.lastIndexOf('\n', at - 1) + 1

/** Remove one binding from its import declaration — the whole line when it was the only one. */
export function removeImport(text: string, sf: ts.SourceFile, name: string): string {
  const b = importsOf(sf).find((x) => x.local === name)
  if (!b) return text
  const clause = b.decl.importClause!
  const named = clause.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings : null
  const others = (named?.elements.length ?? 0) - (b.element ? 1 : 0) + (clause.name && b.imported !== null ? 1 : 0)
  if (others === 0 || (b.imported === null && !named)) {
    // The only binding: take the statement and its line.
    const start = lineStart(text, b.decl.getStart(sf))
    let end = b.decl.getEnd()
    if (text[end] === '\n') end++
    return text.slice(0, start) + text.slice(end)
  }
  if (b.element && named) {
    const i = named.elements.indexOf(b.element)
    const el = b.element
    if (i < named.elements.length - 1) {
      // `Name, ` — take through the comma and the space after it.
      const next = named.elements[i + 1]
      return text.slice(0, el.getStart(sf)) + text.slice(next.getStart(sf))
    }
    // last: `, Name` — take from the previous element's end.
    const prev = named.elements[i - 1]
    return text.slice(0, prev.getEnd()) + text.slice(el.getEnd())
  }
  if (b.imported === null && named) {
    // `Default, { a }` → `{ a }`
    return text.slice(0, clause.name!.getStart(sf)) + text.slice(named.getStart(sf))
  }
  return text
}

/**
 * Bind `local` in this file: join an existing import of the same module, or add
 * a new declaration after the last import.
 */
export function addImport(
  text: string,
  sf: ts.SourceFile,
  file: string,
  local: string,
  imported: string | null,
  moduleAbs: string,
  like: string | undefined,
): { text: string; what: string } {
  const q = quoteOf(sf, like ? (/^["']/.exec(like)?.[0] ?? "'") : "'")
  const existing = importsOf(sf).find(
    (b) => b.spec.startsWith('.') && moduleOf(file, b.spec) === moduleAbs && b.decl.importClause?.namedBindings,
  )
  const clause = imported === null ? local : imported === local ? local : `${imported} as ${local}`
  if (existing && imported !== null) {
    const named = existing.decl.importClause!.namedBindings as ts.NamedImports
    const last = named.elements[named.elements.length - 1]
    const at = last ? last.getEnd() : named.getStart(sf) + 1
    const insert = last ? `, ${clause}` : ` ${clause} `
    return {
      text: text.slice(0, at) + insert + text.slice(at),
      what: `import ${clause} alongside ${named.elements.map((e) => e.name.text).join(', ')} from ${existing.spec}`,
    }
  }
  const spec = specifierFrom(file, moduleAbs, like)
  const line = imported === null ? `import ${local} from ${q}${spec}${q}` : `import { ${clause} } from ${q}${spec}${q}`
  // In specifier order among the relative imports, so a file that keeps its
  // imports sorted stays sorted — and a move reversed restores it exactly.
  const decls = sf.statements.filter((st): st is ts.ImportDeclaration => ts.isImportDeclaration(st))
  const after = decls.find(
    (d) => ts.isStringLiteral(d.moduleSpecifier) && d.moduleSpecifier.text.startsWith('.') && d.moduleSpecifier.text > spec,
  )
  if (after) {
    const at = lineStart(text, after.getStart(sf))
    return { text: text.slice(0, at) + line + '\n' + text.slice(at), what: line }
  }
  const last = decls[decls.length - 1]
  if (!last) {
    // No imports: after a leading comment block, if any, else the top.
    const first = sf.statements[0]
    const at = first ? lineStart(text, first.getStart(sf)) : 0
    return { text: text.slice(0, at) + line + '\n' + text.slice(at), what: line }
  }
  const at = last.getEnd()
  return { text: text.slice(0, at) + '\n' + line + text.slice(at), what: line }
}

/** `export ` in front of a top-level declaration that lacks it. */
export function exportDeclaration(text: string, sf: ts.SourceFile, name: string): { text: string; what: string } | null {
  const st = declarationOf(sf, name)
  if (!st || isExportedStatement(st)) return null
  const at = st.getStart(sf)
  return { text: text.slice(0, at) + 'export ' + text.slice(at), what: `export ${name}` }
}

/**
 * Identifiers a JSX range uses that are bound in the component around it —
 * what a moved element would lose. Property names, JSX tag and attribute
 * names, and anything declared inside the range do not count.
 */
export function freeIdentifiers(sf: ts.SourceFile, range: [number, number], component: ts.Node): string[] {
  const declaredInside = new Set<string>()
  const used = new Set<string>()
  const inRange = (n: ts.Node) => n.getStart(sf) >= range[0] && n.getEnd() <= range[1]

  const collect = (n: ts.Node) => {
    if (!inRange(n)) {
      ts.forEachChild(n, collect)
      return
    }
    if (ts.isIdentifier(n)) {
      const p = n.parent
      const isDecl =
        (ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p)) && p.name === n
      if (isDecl) declaredInside.add(n.text)
      else if (
        !(ts.isPropertyAccessExpression(p) && p.name === n) &&
        !ts.isJsxAttribute(p) &&
        !(ts.isJsxOpeningLikeElement(p) && p.tagName === n) &&
        !(ts.isJsxClosingElement(p) && p.tagName === n) &&
        !(ts.isPropertyAssignment(p) && p.name === n) &&
        !(ts.isShorthandPropertyAssignment(p) && p.name === n && false)
      )
        used.add(n.text)
    }
    ts.forEachChild(n, collect)
  }
  collect(sf)

  // Bound in the component but outside the range: parameters and local declarations.
  const bound = new Set<string>()
  const scope = (n: ts.Node) => {
    if (inRange(n)) return
    if (ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isBindingElement(n))
      if (ts.isIdentifier(n.name)) bound.add(n.name.text)
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name && n !== component) bound.add(n.name.text)
    ts.forEachChild(n, scope)
  }
  scope(component)

  return [...used].filter((u) => bound.has(u) && !declaredInside.has(u)).sort()
}

/** The top-level function or const component whose text contains `offset`. */
export function componentAt(sf: ts.SourceFile, offset: number): ts.Node | null {
  for (const st of sf.statements) {
    if (st.getStart(sf) <= offset && offset <= st.getEnd()) {
      if (ts.isFunctionDeclaration(st)) return st
      if (ts.isVariableStatement(st))
        for (const d of st.declarationList.declarations)
          if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)))
            return d.initializer
      return st
    }
  }
  return null
}
