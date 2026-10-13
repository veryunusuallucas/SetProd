import { TODOS_OS_BLOCOS, type BlocoOD, type FormatoOD } from './tipos';

/**
 * A última escolha de formato da OD (padrão ou detalhada, e os blocos da
 * detalhada), por aparelho. A prévia ao lado da diária e a janela de exportar
 * leem e gravam o mesmo lugar: escolher num já deixa escolhido no outro.
 */
const CHAVE_FORMATO = 'setprod:od-formato';
const CHAVE_BLOCOS = 'setprod:od-blocos';

export function formatoLembrado(): FormatoOD {
  try { return localStorage.getItem(CHAVE_FORMATO) === 'detalhada' ? 'detalhada' : 'padrao'; } catch { return 'padrao'; }
}

export function lembrarFormato(f: FormatoOD) {
  try { localStorage.setItem(CHAVE_FORMATO, f); } catch { /* aba privada */ }
}

export function blocosLembrados(): BlocoOD[] {
  try {
    const salvos = JSON.parse(localStorage.getItem(CHAVE_BLOCOS) || 'null');
    if (Array.isArray(salvos)) return TODOS_OS_BLOCOS.filter(b => salvos.includes(b));
  } catch { /* sem preferência */ }
  return TODOS_OS_BLOCOS;
}

export function lembrarBlocos(blocos: BlocoOD[]) {
  try { localStorage.setItem(CHAVE_BLOCOS, JSON.stringify(blocos)); } catch { /* aba privada */ }
}
