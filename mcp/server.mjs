#!/usr/bin/env node
/**
 * THE RECORD, OVER MCP — the same door, without a terminal.
 *
 * A harness that speaks the Model Context Protocol gets the three calls that
 * matter and nothing else: read what was decided, ask why, and decide. It is
 * the same `decide()` the CLI and the overlay call, with the same handlers
 * applying the same changes to the same projections, so nothing here is a
 * second way to change anything. There is no fourth tool that edits a file.
 *
 * Two things it does differently from a CLI, both on purpose.
 *
 * A tool call carries no shell, so `CLAUDECODE` cannot speak for it and
 * nothing is inferred: every write states `decided` and `written` in its
 * arguments, and a write that does not is refused with the question it should
 * have answered. The refusal is the feature — this is the surface where an
 * agent is most likely to be acting on an instruction it was given, and most
 * likely to record itself as the author of a judgement that was not its own.
 *
 * And a decision through this door records `via: mcp:<client>`, so the record
 * says which surface wrote it, as it does for the CLI and the overlay.
 *
 * Speaks JSON-RPC 2.0 over stdio, line-delimited. No dependencies: the
 * protocol is small enough that adding one would be the larger cost.
 */
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.env.STRATA_ROOT ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const { decide } = await import(path.join(ROOT, 'substrate/src/decide.ts'))
const { readAll, current, history, byId } = await import(path.join(ROOT, 'substrate/src/log.ts'))
const { targetKey, isHand } = await import(path.join(ROOT, 'substrate/src/decision.ts'))
const { describe, formatDecision } = await import(path.join(ROOT, 'substrate/src/format.ts'))
const { explain, formatExplanation, runCheck, formatCheck } = await import(path.join(ROOT, 'substrate/src/check.ts'))
const { buildIndex, search } = await import(path.join(ROOT, 'substrate/src/precedent.ts'))
const { loadSkills, assemblePacket, formatPacket } = await import(path.join(ROOT, 'substrate/src/skills.ts'))
const { registerTheme } = await import(path.join(ROOT, 'src/theme/handlers.ts'))
const { registerMalleable } = await import(path.join(ROOT, 'strata-malleable/src/decide/index.ts'))

const MALLEABLE_ROOT = process.env.STRATA_MALLEABLE ?? path.join(ROOT, 'strata-malleable')
registerTheme({ root: ROOT })
registerMalleable({ root: MALLEABLE_ROOT, source: process.env.MALLEABLE_ROOT ?? 'fixtures/app' })

let clientName = 'unknown'

/* ---------------- the hands ---------------- */

const HAND = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['human', 'agent'] },
    actor: { type: 'string', description: 'A handle, an email, a harness id. Opaque: the record stores it and never interprets it.' },
  },
  required: ['kind'],
}

/**
 * No shell, so no inference. A CLI can read CLAUDECODE and say "an agent's
 * hand wrote this"; a tool call cannot, and guessing here would put an agent's
 * name on judgements that were not its own — which is the mistake this whole
 * split exists to undo.
 */
function handsFrom(args) {
  if (!isHand(args.decided))
    return {
      error:
        'decided is required: who could have chosen otherwise?\n' +
        '  If the target and the value were both named to you, { "kind": "human", "actor": "<their handle>" }.\n' +
        '  If you chose either of them, { "kind": "agent", "actor": "<your name>" }.\n' +
        '  Nothing is inferred here — a tool call carries no shell to read.',
    }
  const written = args.written ?? { kind: 'agent', actor: clientName }
  if (!isHand(written)) return { error: 'written must be { kind: human | agent, actor?: string }' }
  return {
    decided: args.decided,
    written,
    because:
      `decided by ${args.decided.kind}${args.decided.actor ? ` ${args.decided.actor}` : ''}; ` +
      `written by ${written.kind}${written.actor ? ` ${written.actor}` : ''} — stated in an MCP call from ${clientName}` +
      (args.decided.actor ? '' : '; no actor named for the deciding hand — precedent will count it as an unnamed one'),
  }
}

/* ---------------- the tools ---------------- */

const TOOLS = [
  {
    name: 'strata_decide',
    description:
      'Change something, on the record. The one way anything changes here: a token cut or kept or minted, a property override, a region moved, a prop picked, a seed changed, a deviation declared, a handoff. The projection applies it and the record appends the decision with who chose, who wrote, and why. Never edit src/tokens, src/theme/ledger.json or any projection by hand — a hand-edited projection fails the next check.',
    inputSchema: {
      type: 'object',
      properties: {
        request: {
          type: 'object',
          description: 'The decision to make. `kind` is one of token, override, move, prop, seed, deviation, ready. The rest of the shape is the projection\'s own vocabulary — call strata_skill for the one you want and read its typical decisions.',
          properties: { kind: { type: 'string' } },
          required: ['kind'],
        },
        reason: { type: 'string', description: 'Why, in the deciding hand\'s words. One sentence a reader can disagree with.' },
        decided: { ...HAND, description: 'Who could have chosen otherwise. Required — nothing is inferred here.' },
        written: { ...HAND, description: 'Whose hand ran the call. Defaults to this client, as an agent.' },
        dryRun: { type: 'boolean', description: 'Say what would happen and write nothing.' },
      },
      required: ['request', 'decided'],
    },
  },
  {
    name: 'strata_explain',
    description:
      'One decision as four blocks: DECISION (what and who), CONTEXT (what the record knew around it), EVIDENCE (what the evaluators find now, computed on request), CONSEQUENCE (what the operation recorded). Takes a decision id or a target key such as token:--accent-strong.',
    inputSchema: {
      type: 'object',
      properties: { what: { type: 'string', description: 'A decision id, or a target key like token:--accent-strong or move:Filters.' } },
      required: ['what'],
    },
  },
  {
    name: 'strata_precedent',
    description:
      'What has been decided before, with convergence counted. Distinct targets say a value was reached in more than one place; distinct hands say it was reached by more than one person. A convergence that meets the threshold is a candidate, which is computed — promoting it is a decision a hand makes.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Every word must appear in the reason, the target or the description.' },
        kind: { type: 'string' },
        property: { type: 'string' },
        value: { type: 'string' },
        component: { type: 'string' },
        token: { type: 'string' },
        author: { type: 'string', enum: ['human', 'agent'], description: 'The kind of hand that decided it.' },
        actor: { type: 'string', description: 'The hand that decided it, by name.' },
        since: { type: 'string', description: 'ISO date; decisions at or after it.' },
        unpromoted: { type: 'boolean', description: 'Only current instance and view overrides — what drift is made of.' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'strata_skill',
    description:
      'The packet for a piece of design work: the rules that bear on it with their reasons, the precedent the record holds, the state, the procedure, the constraints. Call this before doing the work, not after. With no name, lists the skills.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        inputs: { type: 'object', description: 'The inputs the skill declares, by name.' },
      },
    },
  },
  {
    name: 'strata_check',
    description:
      'Here is what happened: the invariants, then every finding under the authority it carries, then the rules nothing evaluates, then the handoff. Only an invariant can fail a build, and an invariant is a mechanical truth about the artifact — never a design judgement. Nothing here runs while someone is designing.',
    inputSchema: { type: 'object', properties: { json: { type: 'boolean', description: 'Return the report as data rather than as text.' } } },
  },
  {
    name: 'strata_log',
    description: 'Every decision, one line each, oldest first. Optionally narrowed to one kind, or to one target\'s history.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string' },
        target: { type: 'string', description: 'A target key: every decision about that one thing, as a chain.' },
        limit: { type: 'number' },
      },
    },
  },
]

const text = (s) => ({ content: [{ type: 'text', text: s }] })
const failed = (s) => ({ content: [{ type: 'text', text: s }], isError: true })

function call(name, args = {}) {
  switch (name) {
    case 'strata_decide': {
      const hands = handsFrom(args)
      if (hands.error) return failed(hands.error)
      const request = args.reason ? { ...args.request, reason: args.reason } : args.request
      const result = decide(request, {
        root: ROOT,
        decided: hands.decided,
        written: hands.written,
        because: hands.because,
        via: `mcp:${clientName}`,
        dryRun: args.dryRun === true,
        source: process.env.MALLEABLE_ROOT ?? 'fixtures/app',
      })
      if (!result.ok)
        return failed(`refused: ${result.error}${result.decision ? `\n\nThe attempt is on the record as ${result.decision.id} — state is unchanged.` : ''}`)
      return text(
        [
          formatDecision(result.decision),
          result.written.length ? `written: ${result.written.join(', ')}` : 'nothing written (dry run)',
          hands.because,
          result.unchanged ? 'already so — the record gained the line, the files did not change' : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
    }

    case 'strata_explain': {
      const e = explain(ROOT, args.what)
      return e ? text(formatExplanation(e)) : failed(`nothing on the record about ${args.what}`)
    }

    case 'strata_precedent': {
      const log = readAll(ROOT)
      const r = search(buildIndex(log), args)
      const limit = args.limit ?? 40
      const out = [
        r.decisions.length ? '' : 'no precedent on the record for that',
        ...r.lines.map((l) => `  ${l}`),
        '',
        ...r.decisions.slice(-limit).map((d) => `  ${d.id}  ${d.at.slice(0, 10)}  ${describe(d)}`),
        r.decisions.length > limit ? `  … ${r.decisions.length - limit} earlier` : '',
        r.decisions.length ? `\n${r.decisions.length} decision(s)` : '',
      ]
      return text(out.filter((l) => l !== '').join('\n'))
    }

    case 'strata_skill': {
      const skills = loadSkills(ROOT)
      if (!args.name) return text(skills.map((s) => `${s.name.padEnd(16)} ${s.purpose}`).join('\n') || 'no skills here')
      const skill = skills.find((s) => s.name === args.name)
      if (!skill) return failed(`no skill "${args.name}" — ${skills.map((s) => s.name).join(', ') || 'none here'}`)
      const packet = assemblePacket(skill, args.inputs ?? {}, ROOT)
      return packet.missing.length
        ? failed(`${skill.name} needs: ${packet.missing.join(', ')}\n\n${formatPacket(packet)}`)
        : text(formatPacket(packet))
    }

    case 'strata_check': {
      const r = runCheck(ROOT)
      return text(args.json ? JSON.stringify(r, null, 2) : formatCheck(r))
    }

    case 'strata_log': {
      const all = readAll(ROOT)
      if (args.target) {
        const ds = history(all, args.target)
        return ds.length ? text(ds.map((d) => formatDecision(d)).join('\n')) : failed(`nothing on the record about ${args.target}`)
      }
      const shown = all.filter((d) => !args.kind || d.kind === args.kind).slice(-(args.limit ?? 60))
      return text(shown.map((d) => `${d.id}  ${d.at.slice(0, 16)}  ${d.kind.padEnd(9)} ${describe(d)}`).join('\n') || 'nothing on the record yet')
    }

    default:
      return failed(`no tool named ${name}`)
  }
}

/* ---------------- JSON-RPC over stdio ---------------- */

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n')
const reply = (id, result) => send({ jsonrpc: '2.0', id, result })
const error = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } })

function handle(msg) {
  const { id, method, params } = msg
  switch (method) {
    case 'initialize':
      clientName = params?.clientInfo?.name ?? 'unknown'
      return reply(id, {
        protocolVersion: params?.protocolVersion ?? '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'strata', version: '0.1.0' },
        instructions:
          'The record of what this product decided, and the one way to change it. Read strata_skill before design work and strata_precedent before deciding something twice. Every write states who decided it: ask who could have chosen otherwise — if the target and the value were both named to you, the deciding hand is theirs, with their handle as the actor. Never edit a projection by hand.',
      })
    case 'notifications/initialized':
      return
    case 'tools/list':
      return reply(id, { tools: TOOLS })
    case 'tools/call': {
      try {
        return reply(id, call(params?.name, params?.arguments ?? {}))
      } catch (err) {
        return reply(id, failed(err instanceof Error ? err.message : String(err)))
      }
    }
    case 'ping':
      return reply(id, {})
    default:
      if (id !== undefined) error(id, -32601, `method not found: ${method}`)
  }
}

createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return error(null, -32700, 'parse error')
  }
  try {
    handle(msg)
  } catch (err) {
    if (msg.id !== undefined) error(msg.id, -32603, err instanceof Error ? err.message : String(err))
  }
})
