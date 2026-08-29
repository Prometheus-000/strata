import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tokens/primitives.css'
import './tokens/semantic.css'
import { ThemeProvider } from './theme/ThemeContext'
import App from './site/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
