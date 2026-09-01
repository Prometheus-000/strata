import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { malleableDevPlugin } from './src/store/server'

// This repo's own harness. The root of the Strata repo serves the same harness
// beside the other surfaces, using the same plugin, so the two cannot differ.
export default defineConfig({ plugins: [react(), malleableDevPlugin()] })
