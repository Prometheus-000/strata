/**
 * A literal evaluator over the TypeScript AST.
 *
 * View declarations are read, not executed. A codemod that imports the source
 * it is analysing runs arbitrary code at build time and inherits every import
 * cycle in the project; reading the object literal costs forty lines and has
 * neither problem. The cost is that a declaration must *be* a literal — which
 * is the right constraint anyway, since a view computed at runtime is not a
 * declaration.
 */
import ts from 'typescript'

export type Literal = string | number | boolean | null | Literal[] | { [k: string]: Literal }

export function literalOf(node: ts.Node): Literal | undefined {
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
      const key = ts.isIdentifier(prop.name)
        ? prop.name.text
        : ts.isStringLiteral(prop.name)
          ? prop.name.text
          : undefined
      if (key === undefined) return undefined
      const v = literalOf(prop.initializer)
      if (v === undefined) return undefined
      out[key] = v
    }
    return out
  }
  return undefined
}

/** The single argument of the first `defineView(...)` call in a source file. */
export function findDefineViewArgument(sf: ts.SourceFile): ts.Node | undefined {
  let found: ts.Node | undefined
  const visit = (node: ts.Node) => {
    if (found) return
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineView' &&
      node.arguments.length === 1
    ) {
      found = node.arguments[0]
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}
