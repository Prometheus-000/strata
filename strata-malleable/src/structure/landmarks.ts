/**
 * What a landmark is. The page already says where its regions are — in the
 * elements HTML gives a role to — so this table is the whole vocabulary of
 * containers, and nothing has to be declared.
 */
import ts from 'typescript'
import type { Landmark } from '../schema'

export const TAG_LANDMARK: Record<string, Landmark> = {
  header: 'banner',
  nav: 'navigation',
  main: 'main',
  aside: 'complementary',
  footer: 'contentinfo',
  dialog: 'dialog',
}

export const ROLE_LANDMARK: Record<string, Landmark> = {
  banner: 'banner',
  navigation: 'navigation',
  search: 'search',
  main: 'main',
  complementary: 'complementary',
  contentinfo: 'contentinfo',
  dialog: 'dialog',
  alertdialog: 'dialog',
}

export const tagOf = (el: ts.JsxOpeningLikeElement, sf: ts.SourceFile) => el.tagName.getText(sf)

/** A string-valued attribute, or the expression text when it is not a string. */
export function attrText(el: ts.JsxOpeningLikeElement, name: string, sf: ts.SourceFile): string | undefined {
  for (const p of el.attributes.properties) {
    if (!ts.isJsxAttribute(p) || p.name.getText(sf) !== name) continue
    if (!p.initializer) return 'true'
    if (ts.isStringLiteral(p.initializer)) return p.initializer.text
    if (ts.isJsxExpression(p.initializer) && p.initializer.expression) {
      const e = p.initializer.expression
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text
      return e.getText(sf)
    }
  }
  return undefined
}

/** The landmark an element is, by role first and tag second. */
export function landmarkOf(el: ts.JsxOpeningLikeElement, sf: ts.SourceFile): Landmark | null {
  const role = attrText(el, 'role', sf)
  if (role && ROLE_LANDMARK[role]) return ROLE_LANDMARK[role]
  if (attrText(el, 'aria-modal', sf) === 'true') return 'dialog'
  const tag = tagOf(el, sf)
  if (tag === 'form') return role === 'search' ? 'search' : null
  return TAG_LANDMARK[tag] ?? null
}
