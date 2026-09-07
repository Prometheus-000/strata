/**
 * The substrate's own commands — the ones that read the record and need no
 * projection: the log, a target's history. `explain`, `check`, `precedent`
 * and `skill` join here as the evaluators and the index arrive.
 */
import { decide, type DecideContext } from './decide.ts'
import { targetKey } from './decision.ts'
import { authorFrom } from './author.ts'
import { band, clip, describe, fold, formatDecision, formatHandoff, hang } from './format.ts'
import { byId, collapseReversals, current, history, pending, readAll, since } from './log.ts'
import { importAll, rebuild, registeredProjections } from './projection.ts'
import { buildIndex, search, PROMOTION_CANDIDATE_AT } from './precedent.ts'
import { enforced, explain, formatCheck, formatExplanation, runCheck } from './check.ts'
import { assemblePacket, formatPacket, loadSkills } from './skills.ts'
import type { Author, Kind } from './decision.ts'

export const SUBSTRATE_COMMANDS = ['log', 'history', 'show', 'ready', 'handoff', 'import', 'rebuild', 'precedent', 'check', 'explain', 'skill'] as const

/** What an empty record says when asked about a target: not "no such thing", which is what a typo says. */
export const EMPTY_RECORD = 'the record is empty — nothing has been decided here yet. The first decision is usually the theme: strata retheme --hue … --why "…"'

export interface CliIo {
  out: (s: string) => void
  err: (s: string) => void
}

export function runSubstrate(argv: string[], home: { root: string }, env: Record<string, string | undefined> = process.env, io: CliIo = { out: console.log, err: console.error }): number {
  const [cmd, ...rest] = argv
  const flag = (n: string) => {
    const i = rest.indexOf(`--${n}`)
    return i === -1 ? undefined : rest[i + 1]
  }
  const has = (n: string) => rest.includes(`--${n}`)
  const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')))
  const fail = (msg: string) => {
    io.err(`\n  ${msg}\n`)
    return 1
  }

  switch (cmd) {
    case 'log': {
      const all = readAll(home.root)
      const kind = flag('kind')
      const shown = all.filter((d) => !kind || d.kind === kind)
      if (!shown.length) io.out('\n  nothing on the record yet\n')
      // One line each, and it has to be true to be worth anything: a reason is
      // a paragraph, and seventy-two decisions printed whole came to three
      // hundred wrapped lines, which is a dump rather than an index. The reason
      // is last, so the cut lands there — the id is on the line to reach the
      // rest with.
      if (shown.length) io.out('')
      for (const d of shown) {
        // The kind is its own column, so a description that opens with it is
        // saying it twice: "deviation  deviation src/sky/scene.ts:125".
        const said = describe(d, { brief: true })
          .replace(/\s+/g, ' ')
          .replace(new RegExp(`^${d.kind}\\b\\s*`), '')
          .replace(/^· /, '')
        const line = `  ${d.id}  ${d.at.slice(0, 10)}  ${d.kind.padEnd(9)} ${said}${d.consequence.refused ? '  (refused)' : ''}`
        io.out(clip(line))
      }
      if (shown.length) io.out(`\n  ${shown.length} decision(s)${kind ? ` of kind ${kind}` : ''} · strata show <id> for one in full\n`)
      return 0
    }

    case 'history': {
      const [key] = positional
      if (!key) return fail('usage: history <targetKey>   e.g. token:--accent-strong, move:Filters')
      const all = readAll(home.root)
      if (!all.length) return fail(EMPTY_RECORD)
      const ds = history(all, key)
      if (!ds.length) return fail(`nothing on the record about ${key}`)
      for (const d of ds) io.out(formatDecision(d))
      return 0
    }

    case 'show': {
      const [id] = positional
      const all = readAll(home.root)
      if (id && !all.length) return fail(EMPTY_RECORD)
      const d = id ? byId(all, id) : undefined
      if (!d) return fail(id ? `no decision ${id}` : 'usage: show <decision id>')
      io.out(formatDecision(d))
      const prior = d.supersedes ? byId(all, d.supersedes) : undefined
      if (prior) io.out(`supersedes ${prior.id}: ${describe(prior)}\n`)
      io.out(`target: ${targetKey(d)}\n`)
      return 0
    }

    case 'ready': {
      const who = authorFrom(rest, env)
      if ('error' in who) return fail(who.error)
      const ctx: DecideContext = { root: home.root, decided: who.decided, written: who.written, via: 'cli', because: who.because, dryRun: has('dry') }
      const result = decide({ kind: 'ready', reason: flag('why') }, ctx)
      if (!result.ok) return fail(result.error)
      io.out(`\n  ${describe(result.decision)} · ${result.decision.consequence.affected ?? 0} change(s) handed off\n  ${who.because}\n`)
      return 0
    }

    case 'handoff': {
      // Handed off means nothing has happened since the last ready; otherwise
      // the ready is stale and the list is what is pending.
      const all = readAll(home.root)
      const ready = since(all, 'ready').length === 0 ? (current(all).get('ready') ?? null) : null
      io.out(formatHandoff(collapseReversals(pending(all)), ready))
      return 0
    }

    case 'import': {
      // An import is a claim about who decided the things in an old file, and
      // it is made once, over every line. It is stated, never inferred.
      const who = authorFrom(rest, env)
      if ('error' in who) return fail(who.error)
      const { imported, skipped } = importAll(home.root, {
        dryRun: has('dry'),
        decided: who.decided,
        written: who.written,
        because: `${who.because}; brought onto the record by import — the old file recorded a channel, not a judgement, so the deciding hand is the one this import stated`,
      })
      for (const d of imported) io.out(`  + ${d.id}  ${d.at.slice(0, 10)}  ${describe(d)}`)
      for (const s of skipped) io.out(`  · ${s} is already on the record`)
      io.out(`\n  ${imported.length} decision(s) imported from ${registeredProjections().join(', ') || 'no projection'}${has('dry') ? ' (dry run — nothing written)' : ''}`)
      if (imported.length) io.out(`  ${who.because}`)
      if (imported.length && !has('dry')) io.out('  next: strata rebuild — so every projected line points at its decision\n')
      return 0
    }

    case 'rebuild': {
      const check = has('check') || has('dry')
      const r = rebuild(home.root, { dryRun: check })
      if (!r.files.length) return fail('no projection is registered here')
      for (const f of r.files) io.out(`  ${r.changed.includes(f) ? (check ? '≠' : '~') : '='} ${f}`)
      if (check && r.changed.length) {
        io.err(`\n  ${r.changed.length} projection(s) do not match the record — run strata rebuild\n`)
        return 1
      }
      io.out(check ? '\n  every projection matches the record\n' : `\n  ${r.written.length} file(s) rewritten from the record\n`)
      return 0
    }

    case 'precedent': {
      const q = {
        kind: flag('kind') as Kind | undefined,
        property: flag('property'),
        value: flag('value'),
        component: flag('component'),
        token: flag('token'),
        author: flag('author') as Author | undefined,
        actor: flag('actor'),
        since: flag('since'),
        unpromoted: has('unpromoted'),
        text: positional.join(' ') || undefined,
      }
      const candidateAt = flag('at') ? Number(flag('at')) : PROMOTION_CANDIDATE_AT
      const r = search(buildIndex(readAll(home.root)), q, { candidateAt })
      io.out('')
      if (!r.decisions.length) {
        io.out('  no precedent on the record for that')
        io.out('')
        return 0
      }
      // The verdict first: whether anything crossed the bar, and where the bar
      // is. Without the threshold a list of single reaches reads like findings.
      const candidates = r.convergence.filter((c) => c.candidate).length
      const most = r.convergence.reduce((m, c) => Math.max(m, c.count), 0)
      for (const l of fold(
        `${r.decisions.length} decision(s) matched  ·  ` +
          (candidates
            ? `${candidates} candidate(s) for promotion — promoting one is a hand's decision`
            : `no candidates yet — ${candidateAt} independent reaches is what this grammar prefers${most > 1 ? `, and the most any value has is ${most}` : ''}`),
        2,
      ))
        io.out(`  ${l}`)
      io.out('')
      if (r.lines.length) {
        for (const line of band('CONVERGENCE', 'a count of what the record already holds')) io.out(line)
        for (const line of r.lines) for (const l of hang(line, 4)) io.out(`  ${l}`)
        io.out('')
      }
      const limit = Number(flag('limit') ?? 40)
      for (const line of band('DECISIONS', 'what the search matched, newest last')) io.out(line)
      if (r.decisions.length > limit) io.out(`  … ${r.decisions.length - limit} earlier, not shown`)
      // An index, like the log: one line each, cut at a word, with the id to reach the rest.
      for (const d of r.decisions.slice(-limit)) io.out(clip(`  ${d.id}  ${d.at.slice(0, 10)}  ${describe(d, { brief: true }).replace(/\s+/g, ' ')}`))
      io.out('')
      return 0
    }

    case 'check': {
      const r = runCheck(home.root)
      if (has('json')) io.out(JSON.stringify(r, null, 2))
      else io.out(formatCheck(r))
      return has('enforce') && !enforced(r) ? 1 : 0
    }

    case 'explain': {
      const [what] = positional
      if (!what) return fail('usage: explain <decision id | targetKey>   e.g. explain token:--accent-strong')
      if (!readAll(home.root).length) return fail(EMPTY_RECORD)
      const e = explain(home.root, what)
      if (!e) return fail(`nothing on the record about ${what}`)
      if (has('json')) io.out(JSON.stringify(e, null, 2))
      else io.out(formatExplanation(e))
      return 0
    }

    case 'skill': {
      const skills = loadSkills(home.root)
      const [name] = positional
      if (!name) {
        if (!skills.length) return fail("no skills here — a skill is skills/<name>/SKILL.md or .claude/skills/<name>/SKILL.md, and strata init installs Strata's")
        io.out('')
        // A purpose is a sentence, and these run to two hundred and fifty
        // characters. Folded under the name column they read as a list — the
        // purpose alone is folded, so the first line gets the same room as the
        // rest rather than the name eating into it.
        const NAME = 16
        for (const s of skills) {
          const [first, ...rest] = fold(s.purpose, NAME + 4)
          io.out(`  ${s.name.padEnd(NAME)}  ${first}`)
          for (const l of rest) io.out(`  ${' '.repeat(NAME)}  ${l}`)
        }
        io.out('')
        for (const l of fold('strata skill <name> [--<input> value …] assembles the packet the harness performs', 2)) io.out(`  ${l}`)
        io.out('')
        return 0
      }
      const skill = skills.find((s) => s.name === name)
      if (!skill) return fail(`no skill "${name}" — ${skills.map((s) => s.name).join(', ') || 'none here'}`)
      const inputs: Record<string, string> = {}
      for (const k of skill.inputs) {
        const v = flag(k)
        if (v !== undefined) inputs[k] = v
      }
      const packet = assemblePacket(skill, inputs, home.root)
      if (has('json')) io.out(JSON.stringify(packet, null, 2))
      else io.out(formatPacket(packet))
      return packet.missing.length ? 1 : 0
    }

    default:
      return cmd ? 1 : 0
  }
}
