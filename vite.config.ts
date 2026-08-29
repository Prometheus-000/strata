import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server serves both index.html and personalize.html from root.
// Production builds are single-entry so each page inlines cleanly:
// `npm run build` → dist/ (showcase) · `npm run build:pz` → dist-pz/ (personalizer)
export default defineConfig({
  plugins: [react()],
})
