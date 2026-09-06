/**
 * THE TIME MODEL, and the only requestAnimationFrame in this repository.
 *
 * Time is sequence: `t` counts events arrived, continuously, from 0 to the
 * length of the state. Playing advances it at one event per interval and
 * stops at the end. It never restarts on its own — a loop returns to its
 * origin and a record does not — so the only way back is the scrubber. After
 * the end, `breath` counts seconds of equilibrium for the hero's aperiodic
 * drift, and the pointer's weight is eased here so presence arrives and
 * leaves softly.
 *
 * Under reduced motion none of that runs: no frame is ever requested, play
 * is not offered, `t` moves in whole events, presence is on or off, and
 * `breath` stays undefined. The engine makes the same promise at both layers
 * (`layer1.reduced-motion-both-layers`); this is the runtime half for the
 * identity.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { lerp, type Vec } from '@strata/identity/field'

export interface Playback {
  t: number
  setT: (t: number) => void
  playing: boolean
  play: () => void
  pause: () => void
  step: (dir: 1 | -1) => void
  /** Seconds since the last event settled; undefined until then or under reduced motion. */
  breath: number | undefined
  /** The pointer, eased. */
  presence: { p: Vec; w: number } | null
  setPointer: (p: Vec | null) => void
  /** Move the end out (an event was appended) and keep going. */
  extendTo: (max: number) => void
}

/** Milliseconds per event: a calm theme takes most of a second, a kinetic one a quarter. */
export const intervalFor = (energy: number) => lerp(900, 250, energy)
const FPS_CAP = 30

export function usePlayback(max: number, energy: number, reduced: boolean, autoplay = true): Playback {
  const [t, setTState] = useState(() => (reduced || !autoplay ? max : 0))
  const [playing, setPlaying] = useState(() => !reduced && autoplay)
  const [breath, setBreath] = useState<number | undefined>(undefined)
  const [presence, setPresence] = useState<{ p: Vec; w: number } | null>(null)
  const target = useRef<{ p: Vec; w: number } | null>(null)
  const maxRef = useRef(max)
  maxRef.current = max
  const tRef = useRef(t)
  tRef.current = t
  const settledAt = useRef<number | null>(null)

  const setT = useCallback((v: number) => {
    setPlaying(false)
    settledAt.current = null
    setBreath(undefined)
    setTState(Math.max(0, Math.min(maxRef.current, v)))
  }, [])

  const play = useCallback(() => {
    if (reduced) return
    settledAt.current = null
    setBreath(undefined)
    setPlaying(true)
  }, [reduced])
  const pause = useCallback(() => setPlaying(false), [])
  const step = useCallback((dir: 1 | -1) => {
    setPlaying(false)
    settledAt.current = null
    setBreath(undefined)
    setTState((v) => Math.max(0, Math.min(maxRef.current, Math.round(v) + dir)))
  }, [])
  const extendTo = useCallback(
    (m: number) => {
      maxRef.current = m
      settledAt.current = null
      setBreath(undefined)
      if (reduced) setTState(m)
      else setPlaying(true)
    },
    [reduced],
  )

  const setPointer = useCallback(
    (p: Vec | null) => {
      if (p) target.current = { p, w: 1 }
      else if (target.current) target.current = { p: target.current.p, w: 0 }
      if (reduced) setPresence(p ? { p, w: 1 } : null)
    },
    [reduced],
  )

  useEffect(() => {
    if (reduced) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = now - last
      if (dt < 1000 / FPS_CAP) return
      last = now
      // Time.
      if (playing) {
        const next = tRef.current + dt / intervalFor(energy)
        if (next >= maxRef.current) {
          tRef.current = maxRef.current
          setTState(maxRef.current)
          setPlaying(false)
          settledAt.current = now
        } else {
          tRef.current = next
          setTState(next)
        }
      } else if (tRef.current >= maxRef.current && settledAt.current !== null) {
        setBreath((now - settledAt.current) / 1000)
      } else if (tRef.current >= maxRef.current && settledAt.current === null) {
        settledAt.current = now
      }
      // Presence, eased toward its target: quick to arrive, slower to leave.
      const tg = target.current
      setPresence((cur) => {
        if (!tg) return cur
        const rate = tg.w > (cur?.w ?? 0) ? 0.35 : 0.12
        const w = lerp(cur?.w ?? 0, tg.w, rate)
        if (w < 0.01 && tg.w === 0) {
          target.current = null
          return null
        }
        return { p: tg.p, w }
      })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, energy, reduced])

  return { t, setT, playing, play, pause, step, breath, presence, setPointer, extendTo }
}
