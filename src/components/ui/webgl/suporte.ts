/**
 * Decide se vale ligar os efeitos WebGL da tela de entrada.
 *
 * O SetProd é usado no set, em iPad e celular que às vezes já estão velhos.
 * Um shader bonito que trava a tela de abertura é pior do que nenhum shader —
 * então o padrão é: na dúvida, não liga.
 */

let cache: boolean | null = null;

/** O navegador consegue criar um contexto WebGL de verdade? */
export function temWebGL(): boolean {
  if (cache !== null) return cache;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
    cache = !!ctx;
    // Contexto solto vaza memória de GPU; devolvemos na hora.
    (ctx as WebGLRenderingContext | null)
      ?.getExtension('WEBGL_lose_context')?.loseContext();
    return cache;
  } catch {
    cache = false;
    return false;
  }
}

export function movimentoReduzido(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Aparelho fraco demais para dois shaders ao mesmo tempo.
 *
 * `deviceMemory` e `hardwareConcurrency` não existem em todo navegador (o
 * Safari não expõe memória), então a ausência não conta como fraqueza — só o
 * valor baixo confirmado conta.
 */
export function aparelhoFraco(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return true;
  return false;
}

export interface DecisaoEfeitos {
  fundo: boolean;
  titulo: boolean;
  motivo: string;
}

/**
 * O que ligar nesta máquina.
 *
 * Em tela pequena fica só o fundo: o warp do título depende de passar o cursor,
 * gesto que não existe no toque — ali ele seria custo de GPU sem retorno.
 */
export function decidirEfeitos(largura = window.innerWidth): DecisaoEfeitos {
  if (!temWebGL()) return { fundo: false, titulo: false, motivo: 'sem WebGL' };
  if (movimentoReduzido()) return { fundo: false, titulo: false, motivo: 'movimento reduzido' };
  if (aparelhoFraco()) return { fundo: true, titulo: false, motivo: 'aparelho modesto' };
  if (largura < 720) return { fundo: true, titulo: false, motivo: 'tela pequena' };
  return { fundo: true, titulo: true, motivo: 'tudo ligado' };
}
