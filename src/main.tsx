import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { applyTheme, readSettings } from './lib/settings'

applyTheme(readSettings().theme) // before first paint, so the login screen respects it too

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
