/**
 * The two endpoints a preview needs, shared by this repo's harness and by
 * `slots preview` in any other project — so what a designer does here and what
 * they do there land in the same files, in the same shape.
 *
 *   POST /__slots/commit   write the store through to source
 *   POST /__slots/ready    the designer says they are done
 *
 * The second one is the hinge of the loop, and it deliberately does **not**
 * commit anything. It writes a handoff file and stops. "Ready" is the designer
 * saying *I think this is right* — an intent, addressed to whoever reviews it,
 * not a write they are authorising. Nothing is held back either: the moves are
 * already in source by the time it is pressed.
 *
 * That distinction is why this is not the save button this design removed. A
 * save button withholds work until you press it. This one withholds nothing and
 * starts a conversation.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { buildManifest } from '../identity/manifest'
import { allOpenItems, assignmentsFromSource } from '../resolve/resolve'
import { diff } from '../report/diff'
import { lint } from '../lint/lint'
import { commit } from '../store/commit'
import type { Store } from '../schema'

export const READY_FILE = '.slots/ready.json'

export interface Handoff {
  version: 1
  /** Set by the caller, because the library does not read a clock. */
  at: string
  by: string
  /** What changed against source defaults, per view and per state. */
  changed: ReturnType<typeof diff>
  /** What the design costs. The designer's call, not the reviewer's. */
  costs: ReturnType<typeof allOpenItems>
  /** What is actually broken — assignments pointing at nothing. */
  broken: ReturnType<typeof lint>['dangling']
  drifted: ReturnType<typeof lint>['drift']
}

const readBody = (req: { on: (e: string, f: (c?: unknown) => void) => void }) =>
  new Promise<string>((resolve) => {
    let body = ''
    req.on('data', (c) => (body += String(c)))
    req.on('end', () => resolve(body))
  })

export function slotsDevPlugin(source: string, root = process.cwd()): Plugin {
  return {
    name: 'slots-preview-server',
    configureServer(server) {
      server.middlewares.use('/__slots/commit', (req, res) => {
        if (req.method !== 'POST') return void ((res.statusCode = 405), res.end())
        void readBody(req).then((body) => {
          res.setHeader('content-type', 'application/json')
          try {
            const store = JSON.parse(body) as Store
            const { manifest, problems } = buildManifest(source)
            res.end(JSON.stringify({ ...commit(manifest, store, root), problems }))
          } catch (err) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: String(err) }))
          }
        })
      })

      server.middlewares.use('/__slots/ready', (req, res) => {
        if (req.method !== 'POST') return void ((res.statusCode = 405), res.end())
        void readBody(req).then((body) => {
          res.setHeader('content-type', 'application/json')
          try {
            const { by = 'human', at } = JSON.parse(body || '{}') as { by?: string; at?: string }
            const { manifest } = buildManifest(source)
            const src = { manifest, assignments: assignmentsFromSource(manifest) }
            const report = lint(manifest)
            const handoff: Handoff = {
              version: 1,
              at: at ?? '',
              by,
              changed: diff(src).filter((d) => d.rows.length || d.openItems.length),
              costs: allOpenItems(src),
              broken: report.dangling,
              drifted: report.drift,
            }
            const file = path.join(root, READY_FILE)
            fs.mkdirSync(path.dirname(file), { recursive: true })
            fs.writeFileSync(file, JSON.stringify(handoff, null, 2) + '\n')
            res.end(
              JSON.stringify({
                ok: true,
                file: READY_FILE,
                costs: handoff.costs.filter((c) => !c.accepted).length,
                broken: handoff.broken.length,
              }),
            )
          } catch (err) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: String(err) }))
          }
        })
      })
    },
  }
}
