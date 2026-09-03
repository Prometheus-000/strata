/**
 * The endpoints a page needs while a designer works on it, exported as a Vite
 * plugin so a host that serves this harness beside other surfaces mounts the
 * same writer — two copies would be two places for a file path to disagree.
 *
 *   POST /__malleable/store       the override store → .malleable/overrides.json
 *   GET  /__malleable/structure   the page's containers and regions, read fresh
 *   POST /__malleable/move        a region changes place → the JSX is rewritten
 *   GET  /__malleable/callsite    where a component instance was written, and what it is passed
 *   POST /__malleable/prop        a pick from a component's options → one attribute rewritten
 *   POST /__malleable/ready       the designer says they are done → the receipt
 *
 * The store has to outlive the tab: "come back later and promote it" is half
 * the premise. A move goes further — it does not persist anywhere but source,
 * because a moved region is a diff, and git is where diffs live. And "ready"
 * commits nothing: the moves are already in source by the time it is pressed;
 * it stamps the receipt and starts the review.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { writeStore } from './persist'
import type { MoveRequest, PropRequest, Store } from '../schema'
import { buildStructure } from '../identity/manifest'
import { applyProp, resolveCallSite } from '../controls/apply'
import { applyMove } from '../structure/apply'
import { markReady, readReceipt, writeReceipt, READY_PATH } from '../structure/receipt'

const readBody = (req: { on: (e: string, f: (c?: unknown) => void) => void }) =>
  new Promise<string>((resolve) => {
    let body = ''
    req.on('data', (c) => (body += String(c)))
    req.on('end', () => resolve(body))
  })

export function malleableDevPlugin(root = process.cwd(), source = 'fixtures/app'): Plugin {
  return {
    name: 'malleable-store',
    configureServer(server) {
      const json = (res: { setHeader: (k: string, v: string) => void; end: (s?: string) => void; statusCode: number }, body: unknown, status = 200) => {
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(body))
      }

      server.middlewares.use('/__malleable/store', (req, res) => {
        if (req.method !== 'POST') return json(res, { ok: false }, 405)
        void readBody(req).then((body) => {
          try {
            const parsed = JSON.parse(body) as Store
            writeStore(parsed, root)
            json(res, { ok: true, overrides: parsed.overrides?.length ?? 0 })
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

      server.middlewares.use('/__malleable/move', (req, res) => {
        if (req.method !== 'POST') return json(res, { ok: false }, 405)
        void readBody(req).then((body) => {
          const cwd = process.cwd()
          try {
            const parsed = JSON.parse(body) as MoveRequest
            process.chdir(root)
            const result = applyMove(source, parsed, parsed.by ?? 'human', new Date().toISOString(), { root })
            json(res, result)
          } catch (err) {
            json(res, { ok: false, error: String(err) }, 400)
          } finally {
            process.chdir(cwd)
          }
        })
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

      server.middlewares.use('/__malleable/prop', (req, res) => {
        if (req.method !== 'POST') return json(res, { ok: false }, 405)
        void readBody(req).then((body) => {
          try {
            const parsed = JSON.parse(body) as PropRequest
            json(res, applyProp(parsed, parsed.by ?? 'human', new Date().toISOString(), { root }))
          } catch (err) {
            json(res, { ok: false, error: String(err) }, 400)
          }
        })
      })

      server.middlewares.use('/__malleable/ready', (req, res) => {
        if (req.method !== 'POST') return json(res, { ok: false }, 405)
        void readBody(req).then((body) => {
          try {
            const { by = 'human', at } = JSON.parse(body || '{}') as { by?: 'human' | 'agent'; at?: string }
            const receipt = markReady(readReceipt(root), by, at ?? new Date().toISOString())
            writeReceipt(receipt, root)
            json(res, { ok: true, file: READY_PATH, moves: receipt.moves.length })
          } catch (err) {
            json(res, { ok: false, error: String(err) }, 400)
          }
        })
      })
    },
  }
}
