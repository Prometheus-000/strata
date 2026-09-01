import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The store has to outlive the tab. "Come back later and promote it" is half
 * the premise, and a design decision that only exists in localStorage is a
 * design decision `npm run ship` cannot see. So the dev server writes the same
 * file the CLI reads.
 */
function storeWriter(): Plugin {
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
            const parsed = JSON.parse(body)
            const file = path.resolve('.malleable/overrides.json')
            fs.mkdirSync(path.dirname(file), { recursive: true })
            fs.writeFileSync(file, JSON.stringify(parsed, null, 2) + '\n')
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

export default defineConfig({ plugins: [react(), storeWriter()] })
