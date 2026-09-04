import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../tokens/primitives.css'
import '../tokens/semantic.css'
import '../site/site.css'
import './lab.css'
import { ThemeProvider } from '../theme/ThemeContext'
import { ThemeLab } from '../site/ThemeLab'

/**
 * The lab on its own, for embedding. The hub reaches the same component
 * through a page of nav, credo and gallery; a frame that only has room for
 * the instrument should not have to load the building it sits in.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ThemeLab />
    </ThemeProvider>
  </StrictMode>,
)
