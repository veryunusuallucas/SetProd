import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './layout.css'
import App from './App.tsx'
import { instalarDiagnostico } from './lib/diagnostico'
import { aplicarTema } from './lib/preferencias'
// A trava de escrita local se instala no banco ao ser importada. Ver o arquivo.
import './lib/travaDeEscrita'

// Precisa vir antes do render para não perder erros do boot.
instalarDiagnostico();
// O tema antes do primeiro desenho: senão quem usa o claro vê um clarão escuro.
aplicarTema();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
