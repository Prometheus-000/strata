import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { slotsDevPlugin } from './src/preview/server'

// This repo's own harness. `slots preview` builds the same thing for any other
// project, using the same plugin, so the two cannot behave differently.
export default defineConfig({ plugins: [react(), slotsDevPlugin('fixtures/app')] })
