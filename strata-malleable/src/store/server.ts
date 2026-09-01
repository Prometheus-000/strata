/**
 * The one endpoint a preview needs. The store has to outlive the tab: "come
 * back later and promote it" is half the premise, and a design decision that
 * only exists in localStorage is a design decision `npm run ship` cannot see.
 * So the dev server writes the same file the CLI reads.
 *
 * Exported as a plugin rather than inlined in vite.config so a host that
 * serves this harness beside other surfaces mounts the same writer — two
 * copies of this would be two places for the file path to disagree.
 */
import type { Plugin } from 'vite'
import { writeStore } from './persist'
import type { Store } from '../schema'

export function malleableDevPlugin(root = process.cwd()): Plugin {
  return {
    name: 'malleable-store',
    configureServer(server) {
      server.middlewares.use('/__malleable/store', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body) as Store
            writeStore(parsed, root)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ ok: true, overrides: parsed.overrides?.length ?? 0 }))
          } catch (err) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })
      })
    },
  }
}
