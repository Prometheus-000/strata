/**
 * THE MALLEABLE PROJECTION'S EVALUATORS — what this layer can find out about
 * an override, a move or a pick, and about the product's drift, when asked.
 *
 * Convergence is precedent: how many distinct targets independently reached
 * the value this decision reached, counted over the record. The store adds
 * what only it knows — whether the value is snapped to a token or drifted to
 * a number, and which overrides the system has since caught up with.
 */
import fs from 'node:fs'
import path from 'node:path'
import { registerEvaluator, type Finding } from '@strata/substrate/evidence'
import type { Fact } from '@strata/substrate/format'
import { preference } from '@strata/substrate/grammar'
import { buildIndex, converge, search, valueText, PROMOTION_CANDIDATE_AT } from '@strata/substrate/precedent'
import type { Structure } from './schema'
import { readManifest, readStore, STRUCTURE_PATH } from './store/persist'
import { reconcile, describe } from './store/store'
import type { MalleableHome } from './decide'

const readStructure = (root: string): Structure | null => {
  const p = path.join(root, STRUCTURE_PATH)
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf8')) as Structure) : null
}

export function registerMalleableEvaluators(home: MalleableHome): void {
  registerEvaluator({
    id: 'override.precedent',
    kinds: ['override', 'prop'],
    evidence: (d, ctx) => {
      const facts: Fact[] = []
      if (d.kind === 'override') facts.push({ name: 'value', value: d.value ? ('token' in d.value ? `snapped to ${d.value.token}` : `drifted to ${d.value.literal}`) : '(removed)' })
      const q = d.kind === 'override' ? { property: d.property, value: valueText(d) } : d.kind === 'prop' ? { property: d.prop, value: valueText(d) } : null
      if (!q) return facts
      const r = search(buildIndex(ctx.log), q, { candidateAt: preference(ctx.rules, 'promotion.candidate-at', PROMOTION_CANDIDATE_AT) })
      const c = r.convergence[0]
      if (c) {
        facts.push({ name: 'reuse count', value: c.count, source: 'precedent' })
        facts.push({ name: 'independent', value: c.independent, source: 'precedent' })
        facts.push({ name: 'promotion candidate', value: c.candidate, source: 'precedent' })
      }
      return facts
    },
  })

  registerEvaluator({
    id: 'move.landing',
    kinds: ['move'],
    evidence: (d) => {
      if (d.kind !== 'move') return []
      const facts: Fact[] = [{ name: 'needs wiring', value: d.consequence.adapt?.length ? d.consequence.adapt.join(', ') : 'nothing' }]
      const structure = readStructure(home.root)
      const to = structure?.containers.find((c) => c.sid === d.to.container)
      if (to) facts.push({ name: 'landed in', value: `<${to.tag}> ${to.landmark} · ${to.children.length} region(s) there now` })
      const from = structure?.containers.find((c) => c.sid === d.from.container)
      if (from) facts.push({ name: 'left', value: `<${from.tag}> ${from.landmark} · ${from.children.length} region(s) remain` })
      return facts
    },
  })

  registerEvaluator({
    id: 'drift.convergence',
    findings: (ctx) => {
      const out: Finding[] = []
      const candidateAt = preference(ctx.rules, 'promotion.candidate-at', PROMOTION_CANDIDATE_AT)
      const unpromoted = search(buildIndex(ctx.log), { unpromoted: true }).decisions
      for (const c of converge(unpromoted, candidateAt))
        if (c.candidate)
          out.push({
            rule: 'drift.convergence',
            authority: 'precedent',
            where: `${c.property} = ${c.value}`,
            message: `${c.count} instances independently converged${c.views.length > 1 ? ` across ${c.views.length} views` : ''} — promotion candidate (${c.byAuthor.human} by hand, ${c.byAuthor.agent} by agent)`,
          })
      try {
        const store = readStore(home.root)
        const manifest = readManifest(home.root)
        for (const o of reconcile(store, manifest))
          out.push({ rule: 'store.redundant', authority: 'knowledge', where: o.id, message: `the system caught up with this override — ${describe(store, o)}` })
      } catch {
        /* no manifest here: nothing to reconcile against */
      }
      return out
    },
  })
}
