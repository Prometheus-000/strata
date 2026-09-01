import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { slotsDevPlugin } from './strata-slots/src/preview/server'
import { malleableDevPlugin } from './strata-malleable/src/store/server'

/**
 * One server, four surfaces: the showcase, the personalizer, and the two
 * libraries' harnesses. They used to be three dev servers on three ports,
 * which is three places to find the same idea.
 *
 * Two things make that safe. React is deduped, because each library carries
 * its own node_modules and a harness resolving a second React copy breaks
 * every hook it calls. And the write-through plugins are the libraries' own —
 * the slot layer writes back into `strata-slots/fixtures/app` and drops its
 * handoff at `.slots/ready.json` here at the root; the malleable layer writes
 * `strata-malleable/.malleable/overrides.json`, the file its CLI ships from.
 *
 * BASE_PATH exists for a static host that serves the site under a sub-path
 * (GitHub Pages serves a project at /<repo>/); links in the site read
 * import.meta.env.BASE_URL so they follow it.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    slotsDevPlugin('strata-slots/fixtures/app'),
    malleableDevPlugin(resolve(__dirname, 'strata-malleable')),
  ],
  resolve: { dedupe: ['react', 'react-dom'] },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        personalize: resolve(__dirname, 'personalize.html'),
        slots: resolve(__dirname, 'slots.html'),
        malleable: resolve(__dirname, 'malleable.html'),
      },
    },
  },
})
