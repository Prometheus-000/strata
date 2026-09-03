/**
 * THE RECORD, on the hub. Every current decision, read from
 * `.strata/decisions.jsonl` at build time and rendered through the same
 * blocks the CLI prints — DECISION and CONSEQUENCE. The static site cannot
 * evaluate (evidence needs the filesystem) and cannot write; it shows what
 * was decided, by whom, and why, which is the part a reader came for.
 */
import raw from '../../.strata/decisions.jsonl?raw'
import type { Decision } from '@strata/substrate/decision'
import { current } from '@strata/substrate/fold'
import { describe, rows } from '@strata/substrate/format'
import { Section } from './Section'

const LOG: Decision[] = raw
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as Decision)

/** Latest first. */
const CURRENT = [...current(LOG).values()].reverse()

const consequence = (d: Decision): Array<[string, string]> => {
  const c = d.consequence
  const out: Array<[string, string]> = []
  if (c.refused) out.push(['refused', c.refused])
  if (c.collapsesTo) out.push(['fallback', c.collapsesTo])
  if (c.absorbed?.length) out.push(['absorbed', String(c.absorbed.length)])
  if (c.adapt?.length) out.push(['needs wiring', c.adapt.join(', ')])
  if (c.affected !== undefined) out.push(['affected', String(c.affected)])
  if (c.written?.length) out.push(['written', c.written.join(', ')])
  return out
}

export function Decisions() {
  const counts = CURRENT.reduce<Record<string, number>>((n, d) => ({ ...n, [d.kind]: (n[d.kind] ?? 0) + 1 }), {})
  return (
    <Section
      kicker="The record"
      title="What this product decided."
      sub={`${LOG.length} decisions on the record, ${CURRENT.length} current — ${Object.entries(counts)
        .map(([k, n]) => `${n} ${k}`)
        .join(' · ')}. Each one carries a hand, a reason and what followed; the CLI prints the same blocks with evidence beside them.`}
      id="decisions"
    >
      {/* Not wrapped in a reveal: thirty-odd rows never reach the observer's threshold at once, and a list that never appears is worse than one that does not fade in. */}
      <div className="ledger decisions">
          {CURRENT.map((d) => (
            <details className="decisions__row" key={d.id}>
              <summary className="ledger__row decisions__summary">
                <span className="ledger__tag">{d.kind}</span>
                <p className="ledger__what">{describe(d)}</p>
                <span className="ledger__rule">
                  {d.by} · {d.at.slice(0, 10)}
                </span>
              </summary>
              <div className="decisions__box">
                <div className="decisions__block">
                  <span className="decisions__head">Decision</span>
                  <dl>
                    {rows(d).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                    <div>
                      <dt>Id</dt>
                      <dd>
                        {d.id}
                        {d.supersedes ? ` · supersedes ${d.supersedes}` : ''} · via {d.via}
                      </dd>
                    </div>
                  </dl>
                </div>
                {consequence(d).length > 0 && (
                  <div className="decisions__block">
                    <span className="decisions__head">Consequence</span>
                    <dl>
                      {consequence(d).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>→ {v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </details>
          ))}
      </div>
    </Section>
  )
}
