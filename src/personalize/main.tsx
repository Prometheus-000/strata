import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../tokens/primitives.css'
import '../tokens/semantic.css'
import '../site/site.css'
import './personalize.css'
import { ThemeProvider } from '../theme/ThemeContext'
import { Personalize } from './Personalize'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Personalize />
    </ThemeProvider>
  </StrictMode>,
)
