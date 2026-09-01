/**
 * SCOPE PROMOTION — one control, four words, no panel.
 *
 * It appears under the thing that was just changed and asks the only question
 * that matters: how far does this go. The answer is a single click, and the
 * control shows where the value currently lives so the question is never asked
 * blind.
 *
 * "The system" is deliberately the slow one. It cannot write a token, so it
 * asks the engine for a seed instead and shows what that seed drags along with
 * it before anything is applied. Widening to the whole system should feel like
 * a decision, because it is one.
 */
import { useEffect, useState } from 'react'
import { useMalleable } from '../runtime/MalleableProvider'
import { SCOPES, type NodeAddress, type Scope } from '../schema'
import type { SeedProposal } from '../engine/invert'
import { toPx } from '../engine/scales'

const WORDS: Record<Scope, string> = {
  instance: 'just this',
  view: 'all here',
  component: 'the component',
  system: 'the system',
}

export function Promote({
  address,
  property,
  element,
}: {
  address: NodeAddress
  property: string
  element: HTMLElement
}) {
  const { read, rescope, previewScope } = useMalleable()
  const [pending, setPending] = useState<{ proposal: SeedProposal } | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const resolution = read(address, property)
  useEffect(() => {
    setPending(null)
    setNote(null)
  }, [address.nodeId, address.instancePath, address.viewId, property])

  if (!resolution) return null
  const rect = element.getBoundingClientRect()
  const current = resolution.source

  const choose = (scope: Scope) => {
    setNote(null)
    if (scope === 'system' && !pending) {
      const preview = previewScope(address, property, 'system')
      if (preview.refused) return setNote(preview.refused)
      if (preview.proposal) return setPending({ proposal: preview.proposal })
    }
    const change = rescope(address, property, scope)
    setPending(null)
    if (change.refused) setNote(change.refused)
  }

  return (
    <div
      className="mv__promote"
      data-malleable-chrome
      style={{ left: rect.left, top: rect.bottom + 10 }}
    >
      <div className="mv__promote-row">
        <span className="mv__promote-lede">
          {property}
          <em>{'token' in resolution.value ? ' snapped' : ' drifted'}</em>
        </span>
        {SCOPES.map((scope) => (
          <button
            key={scope}
            type="button"
            className={`mv__seg ${current === scope ? 'is-current' : ''} ${
              scope === 'system' && pending ? 'is-armed' : ''
            }`}
            onClick={() => choose(scope)}
          >
            {scope === 'system' && pending ? 'apply' : WORDS[scope]}
          </button>
        ))}
      </div>

      {pending && <Proposal proposal={pending.proposal} onCancel={() => setPending(null)} />}
      {note && <p className="mv__promote-note">{note}</p>}
    </div>
  )
}

/**
 * What the seed change costs, stated before it is made. Energy is motion as
 * well as shape; density is every control height in the product. A designer who
 * only sees the radius they asked for has been misled by omission.
 */
function Proposal({ proposal, onCancel }: { proposal: SeedProposal; onCancel: () => void }) {
  const notable = proposal.sideEffects.filter((s) => !s.token.startsWith('--control-'))
  return (
    <div className="mv__proposal">
      <p className="mv__proposal-head">
        seed <strong>{proposal.seed}</strong> {proposal.from} → <strong>{proposal.to}</strong>
        {!proposal.exact && (
          <em> — {proposal.targetPx}px is out of range; nearest is {proposal.achievedPx.toFixed(1)}px</em>
        )}
      </p>
      <p className="mv__proposal-cost">
        also moves {proposal.sideEffects.length} token{proposal.sideEffects.length === 1 ? '' : 's'}:
      </p>
      <ul className="mv__proposal-list">
        {notable.slice(0, 5).map((s) => (
          <li key={s.token}>
            <code>{s.token}</code>
            <span>
              {s.from} → {s.to}
              {describeShift(s.from, s.to)}
            </span>
          </li>
        ))}
        {notable.length > 5 && <li className="mv__proposal-more">+{notable.length - 5} more</li>}
      </ul>
      <button type="button" className="mv__seg mv__seg--quiet" onClick={onCancel}>
        never mind
      </button>
    </div>
  )
}

function describeShift(from: string, to: string): string {
  const a = toPx(from) ?? numeric(from)
  const b = toPx(to) ?? numeric(to)
  if (a === null || b === null || a === 0) return ''
  const pct = Math.round(((b - a) / a) * 100)
  return pct === 0 ? '' : ` (${pct > 0 ? '+' : ''}${pct}%)`
}

const numeric = (v: string): number | null => {
  const m = /^(-?\d*\.?\d+)ms$/.exec(v.trim())
  return m ? Number(m[1]) : null
}
