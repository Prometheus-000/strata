/**
 * The manifest — what the codemod knows, written down for everything else.
 *
 * It joins two halves that normally never meet: the JSX node that will exist at
 * runtime, and the CSS declaration that currently gives it its value. Without
 * the join there is no base value, without a base value there is nothing to
 * override *from*, and the resolver has no bottom to its cascade.
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type { Manifest, ManifestNode, Structure, Value } from '../schema'
import { readControls } from '../controls/read'
import { CSS_TO_PROPERTY } from '../resolve/properties'
import { readStructureFrom } from '../structure/read'
import { parseRules, readValue, simpleClass, type Rule } from './css'
import { scan, stamp } from './codemod'

export const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

export function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, ext, out)
    else if (ext.test(entry.name)) out.push(p)
  }
  return out.sort()
}

const isViewFile = (file: string) => file.split(path.sep).includes('views')

/** Run the codemod across the tree. Returns the files it actually rewrote. */
export function assignIdentity(root: string): {
  written: string[]
  assigned: Array<{ file: string; nodeId: string }>
  regions: Array<{ file: string; component: string }>
  unchanged: number
} {
  const files = walk(root, /\.tsx$/)
  const taken = new Set<string>()
  for (const f of files) {
    for (const n of scan(f, fs.readFileSync(f, 'utf8'), isViewFile(f)).nodes)
      if (n.existingId) taken.add(n.existingId)
  }

  const written: string[] = []
  const assigned: Array<{ file: string; nodeId: string }> = []
  const regions: Array<{ file: string; component: string }> = []
  let unchanged = 0
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    const res = stamp(f, src, isViewFile(f), taken)
    unchanged += res.unchanged
    if (res.source !== src) {
      fs.writeFileSync(f, res.source)
      written.push(f)
    }
    for (const a of res.assigned) assigned.push({ file: f, nodeId: a.nodeId })
    for (const r of res.regions) regions.push({ file: f, component: r })
  }
  return { written, assigned, regions, unchanged }
}

/** The page's containers and regions, read from the tree as it is now. */
export function buildStructure(root: string): Structure {
  const files = walk(root, /\.tsx$/)
  return readStructureFrom(files, {
    read: (f) => (fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : null),
    relative: (f) => path.relative(process.cwd(), f),
  })
}

/**
 * Base value for one class + CSS property, or null when the stylesheet does not
 * express it in a form ship could safely write back to.
 */
function baseFor(
  rules: Array<Rule & { file: string }>,
  className: string,
  cssProperty: string,
): { value: Value; selector: string; file: string } | null {
  let found: { value: Value; selector: string; file: string } | null = null
  for (const rule of rules) {
    if (rule.condition) continue
    if (!rule.selectors.some((s) => simpleClass(s) === className)) continue
    for (const d of rule.decls) {
      if (d.property !== cssProperty) continue
      const v = readValue(d.value)
      // Last unconditional declaration wins, matching the cascade.
      if (v) found = { value: v, selector: `.${className}`, file: rule.file }
      else found = null // a shorthand later in the sheet takes the property away
    }
  }
  return found
}

export function buildManifest(root: string): Manifest {
  const tsxFiles = walk(root, /\.tsx$/)
  const cssFiles = walk(root, /\.css$/)
  const rules = cssFiles.flatMap((f) =>
    parseRules(fs.readFileSync(f, 'utf8')).map((r) => ({ ...r, file: path.relative(process.cwd(), f) })),
  )

  const nodes: ManifestNode[] = []
  const problems: string[] = []
  for (const file of tsxFiles) {
    const isView = isViewFile(file)
    const rel = path.relative(process.cwd(), file)
    const text = fs.readFileSync(file, 'utf8')
    const scanned = scan(file, text, isView)
    // What each component declared about itself, attached to its root node —
    // the node the codemod named with data-region.
    const declared = readControls(
      ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX),
      problems,
    )
    const rootInsertAt = new Map(scanned.regions.map((r) => [r.insertAt, r.component]))
    for (const n of scanned.nodes) {
      if (!n.existingId) continue // not yet stamped — run `npm run id` first
      const controls = declared.get(rootInsertAt.get(n.insertAt) ?? '')
      const primary = n.classes.find((c) => !c.includes('--')) ?? ''
      const base: Record<string, Value> = {}
      const baseFrom: Record<string, { selector: string; file: string }> = {}
      if (primary) {
        for (const [cssProperty, key] of Object.entries(CSS_TO_PROPERTY)) {
          const hit = baseFor(rules, primary, cssProperty)
          if (!hit) continue
          base[key] = hit.value
          baseFrom[key] = { selector: hit.selector, file: hit.file }
        }
      }
      nodes.push({
        nodeId: n.existingId,
        file: rel,
        component: n.component,
        layer: isView ? 'local' : 'recipe',
        tag: n.tag,
        classes: n.classes,
        viewId: n.isViewRoot ? kebab(n.component) : undefined,
        ...(n.landmark ? { landmark: n.landmark } : {}),
        ...(controls ? { controls } : {}),
        base,
        baseFrom,
      })
      for (const key of Object.keys(controls?.css ?? {}))
        if (controls!.css[key] !== false && !base[key])
          problems.push(
            `${rel}: ${n.component} declares a ${key} control, but its stylesheet gives the root node no ${key} to move — declare one in CSS first`,
          )
    }
  }
  for (const p of problems) console.error(`  ! ${p}`)

  return {
    version: 1,
    generatedFrom: [...tsxFiles, ...cssFiles].map((f) => path.relative(process.cwd(), f)),
    nodes,
  }
}
