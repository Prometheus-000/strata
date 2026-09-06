import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../tokens/primitives.css'
import '../tokens/semantic.css'
import '../site/site.css'
import './sky.css'
import { ThemeProvider } from '../theme/ThemeContext'
import { Sky } from './Sky'

/**
 * The sky, on its own page. The same ThemeProvider as every other surface:
 * the seven seeds and the hash URL work here too, and the panel follows the
 * page's ground while the sky keeps its own.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Sky />
    </ThemeProvider>
  </StrictMode>,
)
