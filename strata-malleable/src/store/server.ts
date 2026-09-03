/**
 * The endpoints a page needs while a designer works on it, exported as a Vite
 * plugin so a host that serves this harness beside other surfaces mounts the
 * same writer — two copies would be two places for a file path to disagree.
 *
 *   POST /__strata/decide         every write: { request, decided?, written?, reason?, dryRun? } → decide()
 *   GET  /__malleable/structure   the page's containers and regions, read fresh
 *   GET  /__malleable/callsite    where a component instance was written, and what it is passed
 *
 * One write endpoint, because there is one way anything changes. A drag, a
 * drop, a pick and "ready" each post a request; the projection's handler
 * applies it and the substrate appends the decision. The overlay says
 * `decided: human` because a pointer is a hand, and `written: human` for the
 * same reason: the hand on the mouse is the hand that chose. An agent driving
 * the same endpoint says what it is — `decided: agent` when it chose the
 * value, `decided: human` with the person's actor when it is carrying out an
 * instruction that named target and value — and nothing else differs.
 *
 * Two roots: the log lives at the product's root; `.malleable/` and the app
 * tree at the library's. A project that installs the library has one.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { decide, type Request } from '@strata/substrate/decide'
import { handText, isAuthor, isHand, type Hand } from '@strata/substrate/decision'
import { buildStructure } from '../identity/manifest'
import { resolveCallSite } from '../controls/apply'
import { registerMalleable } from '../decide'

const readBody = (req: { on: (e: string, f: (c?: unknown) => void) => void }) =>
  new Promise<string>((resolve) => {
    let body = ''
    req.on('data', (c) => (body += String(c)))
    req.on('end', () => resolve(body))
  })

export function malleableDevPlugin(root = process.cwd(), source = 'fixtures/app', logRoot = root): Plugin {
  return {
    name: 'malleable-store',
    configureServer(server) {
      registerMalleable({ root, source })
      const json = (res: { setHeader: (k: string, v: string) => void; end: (s?: string) => void; statusCode: number }, body: unknown, status = 200) => {
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(body))
      }

      server.middlewares.use('/__strata/decide', (req, res) => {
        if (req.method !== 'POST') return json(res, { ok: false, error: 'POST a { request, decided?, written?, reason? }' }, 405)
        void readBody(req).then((body) => {
          try {
            const parsed = JSON.parse(body || '{}') as {
              request?: Request
              decided?: unknown
              written?: unknown
              reason?: string
              via?: string
              dryRun?: boolean
            }
            if (!parsed.request?.kind) return json(res, { ok: false, error: 'a request needs a kind' }, 400)
            const via = parsed.via ?? 'overlay'
            // A hand may arrive as a kind ("agent") or as a named one
            // ({ kind, actor }). Anything else is refused rather than coerced.
            const hand = (v: unknown, what: string): Hand | { error: string } => {
              if (typeof v === 'string') return isAuthor(v) ? { kind: v } : { error: `${what} must be human or agent, not "${v}"` }
              if (isHand(v)) return v
              return { error: `${what} must be human, agent, or { kind, actor }` }
            }
            const decided = parsed.decided === undefined ? ({ kind: 'human' } as Hand) : hand(parsed.decided, 'decided')
            if ('error' in decided) return json(res, { ok: false, error: decided.error }, 400)
            const written = parsed.written === undefined ? decided : hand(parsed.written, 'written')
            if ('error' in written) return json(res, { ok: false, error: written.error }, 400)
            const request = parsed.reason ? { ...parsed.request, reason: parsed.reason } : parsed.request
            const result = decide(request, {
              root: logRoot,
              decided,
              written,
              via,
              because:
                parsed.decided === undefined
                  ? `decided by human — a pointer is a hand; written by human — the same hand, through the ${via}`
                  : `decided by ${handText(decided)}; written by ${handText(written)} — both stated by the ${via}`,
              dryRun: parsed.dryRun === true,
            })
            json(res, result, result.ok ? 200 : 200)
          } catch (err) {
            json(res, { ok: false, error: String(err) }, 400)
          }
        })
      })

      server.middlewares.use('/__malleable/structure', (req, res) => {
        if (req.method !== 'GET') return json(res, { ok: false }, 405)
        const cwd = process.cwd()
        try {
          process.chdir(root)
          json(res, buildStructure(source))
        } catch (err) {
          json(res, { ok: false, error: String(err) }, 500)
        } finally {
          process.chdir(cwd)
        }
      })

      // A call site as source has it now: the attributes a pick can change.
      server.middlewares.use('/__malleable/callsite', (req, res) => {
        if (req.method !== 'GET') return json(res, { ok: false }, 405)
        try {
          const q = new URL(req.url ?? '', 'http://x').searchParams
          const component = q.get('component') ?? ''
          const candidates = JSON.parse(q.get('candidates') ?? '[]') as Array<{ parent: string; file: string; ordinal: number }>
          const read = (file: string) => {
            const abs = path.resolve(root, file)
            return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null
          }
          const r = resolveCallSite(component, candidates, read)
          if ('error' in r) return json(res, { ok: false, error: r.error })
          json(res, { ok: true, parent: r.parent, file: r.file, ordinal: r.ordinal, attrs: r.site.attrs, line: r.site.line, list: r.site.list })
        } catch (err) {
          json(res, { ok: false, error: String(err) }, 500)
        }
      })
    },
  }
}
