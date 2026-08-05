/**
 * Coleta de diagnóstico para o Relatar Bug.
 *
 * A versão anterior só interceptava console.error e serializava com
 * JSON.stringify — que transforma um Error em "{}". Ou seja: justamente o
 * erro mais importante chegava vazio no report. Aqui a gente:
 *   - serializa Error com nome, mensagem e stack;
 *   - captura também console.warn, erros não tratados (window.onerror) e
 *     promises rejeitadas — que é como falham Supabase, Dexie e fetch;
 *   - guarda em sessionStorage, para o log sobreviver ao reload depois de um
 *     travamento (antes, recarregar a página apagava a prova).
 */

export interface EventoLog {
  hora: string;
  nivel: 'error' | 'warn' | 'uncaught' | 'promise';
  mensagem: string;
  stack?: string;
  url: string;
}

const CHAVE_STORAGE = 'setprod_diagnostico';
const LIMITE = 40;

let eventos: EventoLog[] = [];

function carregar() {
  try {
    const bruto = sessionStorage.getItem(CHAVE_STORAGE);
    if (bruto) eventos = JSON.parse(bruto);
  } catch { /* storage indisponível: seguimos só em memória */ }
}

function salvar() {
  try {
    sessionStorage.setItem(CHAVE_STORAGE, JSON.stringify(eventos));
  } catch { /* cota estourada: ignora, o log em memória continua valendo */ }
}

/** Converte qualquer coisa em texto legível — inclusive Error, que o JSON.stringify perde. */
function descrever(valor: any): { texto: string; stack?: string } {
  if (valor instanceof Error) {
    return { texto: `${valor.name}: ${valor.message}`, stack: valor.stack };
  }
  if (typeof valor === 'string') return { texto: valor };
  if (valor === null) return { texto: 'null' };
  if (valor === undefined) return { texto: 'undefined' };

  // Erros do Supabase/PostgREST vêm como objeto simples com code/message/details.
  if (typeof valor === 'object') {
    const obj = valor as Record<string, any>;
    if (obj.message || obj.code) {
      const partes = [obj.code && `[${obj.code}]`, obj.message, obj.details, obj.hint].filter(Boolean);
      return { texto: partes.join(' ') };
    }
    try {
      return { texto: JSON.stringify(valor) };
    } catch {
      return { texto: '[objeto não serializável]' };
    }
  }
  return { texto: String(valor) };
}

function registrar(nivel: EventoLog['nivel'], args: any[]) {
  const partes = args.map(descrever);
  const stack = partes.find(p => p.stack)?.stack;

  eventos.push({
    hora: new Date().toISOString(),
    nivel,
    mensagem: partes.map(p => p.texto).join(' ').slice(0, 1500),
    stack: stack?.split('\n').slice(0, 12).join('\n'),
    url: window.location.pathname + window.location.search,
  });

  if (eventos.length > LIMITE) eventos = eventos.slice(-LIMITE);
  salvar();
}

let instalado = false;

/** Instala os interceptadores. Chamado uma vez no boot do app. */
export function instalarDiagnostico() {
  if (instalado) return;
  instalado = true;
  carregar();

  const erroOriginal = console.error;
  console.error = (...args: any[]) => {
    registrar('error', args);
    erroOriginal(...args);
  };

  const avisoOriginal = console.warn;
  console.warn = (...args: any[]) => {
    registrar('warn', args);
    avisoOriginal(...args);
  };

  // Erro não tratado: o que costuma deixar a tela branca.
  window.addEventListener('error', event => {
    if (event.error) registrar('uncaught', [event.error]);
    else registrar('uncaught', [`${event.message} (${event.filename}:${event.lineno})`]);
  });

  // Promise rejeitada sem catch: como falham Supabase, Dexie e fetch.
  window.addEventListener('unhandledrejection', event => {
    registrar('promise', [event.reason]);
  });
}

export function obterEventos(): EventoLog[] {
  return [...eventos];
}

export function limparEventos() {
  eventos = [];
  salvar();
}

/** Retrato do ambiente — o que eu preciso para reproduzir o problema. */
export function coletarAmbiente() {
  const nav = navigator as any;
  return {
    url_completa: window.location.href,
    rota: window.location.pathname,
    tela: `${window.innerWidth}x${window.innerHeight}`,
    tela_fisica: `${window.screen?.width}x${window.screen?.height}`,
    pixel_ratio: window.devicePixelRatio,
    plataforma: nav.userAgentData?.platform || nav.platform || 'desconhecida',
    mobile: !!nav.userAgentData?.mobile || /Mobi|Android/i.test(navigator.userAgent),
    idioma: navigator.language,
    fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine,
    memoria_gb: nav.deviceMemory,
    momento: new Date().toISOString(),
  };
}
