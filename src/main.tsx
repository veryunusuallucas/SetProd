import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './layout.css'
import App from './App.tsx'

// Global error catcher for Bug Report
declare global {
  interface Window {
    lastConsoleErrors: string[];
  }
}
window.lastConsoleErrors = [];
const originalConsoleError = console.error;
console.error = (...args) => {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  window.lastConsoleErrors.push(`[${new Date().toISOString()}] ${msg}`);
  if (window.lastConsoleErrors.length > 10) window.lastConsoleErrors.shift();
  originalConsoleError(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
