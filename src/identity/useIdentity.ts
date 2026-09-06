/**
 * The identity's state, shared by every surface that draws it: the record as
 * events, the theme as a palette, time as playback, and the one thing a
 * visitor can do — decide.
 *
 * A click appends a deviation to the state at once, so every projection
 * responds now. On the dev server it is also written through to the record
 * as a decision on `identity.html`, and the receipt then carries the id the
 * record gave it. The published site cannot write, so there the mark lives
 * for the session and the receipt says it is not on the record — and the
 * same request is composed into an issue the visitor can open to sign it
 * (`sign.ts`), which is the one road a static page has to the record.
 * Either way the state only grows.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import raw from '../../.strata/decisions.jsonl?raw'
import LEDGER from '../theme/ledger.json'
import type { Ledger } from '../theme/ledger'
import { useTheme } from '../theme/ThemeContext'
import { append, levelCount, type IdentityState, type Vec } from '@strata/identity/field'
import { IDENTITY_FILE, markValue, parseRecord, stateFrom, syntheticStream, visitorDeviation } from '@strata/identity/record'
import { paletteFrom } from './palette'
import { useReducedMotion } from './Identity'
import { usePlayback } from './usePlayback'
import { postedMark, signUrl, type PostedMark } from './sign'

// The record is imported as text at build time. On the dev server a write
// changes that text and Vite would reload this module and, with it, the
// page — mid-replay, after every click. The state already holds the mark, so
// the module accepts the update and keeps going; the next load reads the
// record with the mark in it, in the same place, because the place is the value.
if (import.meta.hot) import.meta.hot.accept()

const today = () => new Date().toISOString().slice(0, 10)

export interface IdentitySource {
  /** A synthetic record's seed, or undefined for the real one. */
  seed?: number
  /** Open settled, without the replay. */
  still?: boolean
}

export function useIdentity({ seed, still = false }: IdentitySource = {}) {
  const [state, setState] = useState<IdentityState>(() => stateFrom(seed !== undefined ? syntheticStream(seed) : parseRecord(raw)))
  const { seeds } = useTheme()
  const palette = useMemo(() => paletteFrom(seeds, LEDGER as Ledger), [seeds])
  const reduced = useReducedMotion()
  const pb = usePlayback(state.events.length, seeds.energy, reduced, !still)

  const base = useMemo(() => ({ energy: seeds.energy, density: seeds.density }), [seeds.energy, seeds.density])
  const stationOpts = useMemo(() => ({ ...base, levels: levelCount('contours', seeds.density) }), [base, seeds.density])
  const dotOpts = useMemo(() => ({ ...base, levels: levelCount('dot', seeds.density) }), [base, seeds.density])
  const heroOpts = useMemo(() => ({ ...base, levels: levelCount('hero', seeds.density), breath: pb.breath }), [base, seeds.density, pb.breath])

  // The latest state, synchronously, so two quick clicks number themselves in order.
  const latest = useRef(state)
  latest.current = state

  // On a static host: the newest mark not on the record, and how many there are. The page offers to sign the newest.
  const [unsigned, setUnsigned] = useState<{ posted: PostedMark; count: number } | null>(null)

  const pick = useCallback(
    (p: Vec) => {
      const before = latest.current
      const index = before.events.length
      const line = before.events.filter((e) => e.kind === 'deviation' && e.key.startsWith(`deviation:${IDENTITY_FILE}:`)).length + 1
      const next = append(before, visitorDeviation(p, index, today()))
      latest.current = next
      setState(next)
      pb.extendTo(next.events.length)
      if (seed !== undefined) return
      const posted = postedMark(line, markValue(p))
      if (!import.meta.env.DEV) {
        // A static host has no endpoint. The mark stays in the session, and the visitor is offered the issue that signs it.
        setUnsigned((u) => ({ posted, count: (u?.count ?? 0) + 1 }))
        return
      }
      // The dev server writes through.
      void fetch('/__strata/decide', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(posted),
      })
        .then((r) => (r.ok ? (r.json() as Promise<{ ok: boolean; decision?: { id: string } }>) : null))
        .then((res) => {
          if (!res?.ok || !res.decision) return
          const id = res.decision.id
          // The mark is on the record: let its receipt say so, by the id the record gave it.
          setState((s) => ({ events: s.events.map((e) => (e.id === `session-${index}` ? { ...e, id, receipt: { ...e.receipt, id } } : e)) }))
        })
        .catch(() => {})
    },
    [pb, seed],
  )

  /** On a static host, after a click: the link that signs the newest mark onto the record, and how many marks this session holds. */
  const sign = useMemo(() => (unsigned ? { url: signUrl(unsigned.posted), count: unsigned.count } : null), [unsigned])

  return { state, seeds, palette, reduced, pb, pick, sign, stationOpts, dotOpts, heroOpts }
}
