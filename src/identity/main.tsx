import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../tokens/primitives.css'
import '../tokens/semantic.css'
import '../site/site.css'
import './identity.css'
import { ThemeProvider } from '../theme/ThemeContext'
import { Trip } from './Trip'

/**
 * The identity, on its own page. The same ThemeProvider as every other
 * surface, so the seven seeds and the hash URL work here too: the theme changes
 * how the field is drawn, never what it holds.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Trip />
    </ThemeProvider>
  </StrictMode>,
)
