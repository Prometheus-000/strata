import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { malleableDevPlugin } from './strata-malleable/src/store/server'

/**
 * One server, four surfaces: the showcase, the personalizer, the malleable
 * layer's harness, and the lab on its own for embedding. They used to be
 * separate dev servers on separate ports, which is several places to find the
 * same idea.
 *
 * Two things make that safe. React is deduped, because the library carries
 * its own node_modules and a harness resolving a second React copy breaks
 * every hook it calls. And the write-through plugin is the library's own: every
 * write from the overlay is one request to `/__strata/decide`; the handler
 * writes `strata-malleable/.malleable/overrides.json` or rewrites
 * `strata-malleable/fixtures/app` in place, and the decision is appended to
 * this repo's `.strata/decisions.jsonl` — one record for the whole product.
 *
 * BASE_PATH exists for a static host that serves the site under a sub-path
 * (GitHub Pages serves a project at /<repo>/); links in the site read
 * import.meta.env.BASE_URL so they follow it.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), malleableDevPlugin(resolve(__dirname, 'strata-malleable'), 'fixtures/app', __dirname)],
  resolve: { dedupe: ['react', 'react-dom'] },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        personalize: resolve(__dirname, 'personalize.html'),
        malleable: resolve(__dirname, 'malleable.html'),
        lab: resolve(__dirname, 'lab.html'),
      },
    },
  },
})
