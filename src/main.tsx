import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './layout.css'
import App from './App.tsx'
import { instalarDiagnostico } from './lib/diagnostico'

// Precisa vir antes do render para não perder erros do boot.
instalarDiagnostico();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
