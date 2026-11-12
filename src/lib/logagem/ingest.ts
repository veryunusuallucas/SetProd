import { db } from '../../db/db';
import type { StatusTake, Take } from '../../types';
import type { ClipeDoXml } from './nrt';
import { cameraECartaoDoNome } from './leitura';
import { chaveDoClipe } from './nomenclatura';
import { numero } from '../formato';

/**
 * Ingest: casar o que a câmera gravou com o que foi logado, e corrigir.
 *
 * A REGRA É "O XML VENCE" (PLANO-logagem §2.10). Quem logou digitou o codec
 * entre um "ação" e um "corta"; a câmera escreveu o que ela realmente fez. Onde
 * os dois discordam, a câmera está certa.
 *
 * Mas vencer não é decidir escondido: o ingest mostra cada diferença antes de
 * aplicar. Um boletim que muda sozinho é um boletim em que ninguém confia.
 */

/** Como o clipe achou (ou não achou) o take dele. */
export type Casamento =
  | { tipo: 'igual'; clipe: ClipeDoXml; take: Take; diferencas: Diferenca[] }
  | { tipo: 'sem-take'; clipe: ClipeDoXml }
  | { tipo: 'repetido'; clipe: ClipeDoXml; take: Take };

export interface Diferenca {
  campo: keyof Take | 'duracao' | 'tcIn' | 'tcOut' | 'modeloCamera' | 'bytes';
  rotulo: string;
  logado?: string;
  daCamera?: string;
}

const normalizar = (v?: string) => String(v ?? '').trim().toLowerCase();

/**
 * Qual take é este clipe.
 *
 * Três tentativas, da mais exata para a mais frouxa (`casarLog` do Lumavi):
 * o nome igual; o nome do clipe começando com o do take mais `_` (o take diz
 * `A003C030`, o arquivo é `A003C030_260912SL`); e o do take começando com o do
 * clipe (o boletim usou um nome mais longo).
 */
export function acharTake(takes: Take[], nome: string): Take | undefined {
  // Pela chave: na Blackmagic, o carimbo de hora do nome nunca bate com o do boletim.
  const alvo = chaveDoClipe(nome);
  if (!alvo) return undefined;
  const dele = (t: Take) => chaveDoClipe(t.arquivo);

  return (
    takes.find(t => dele(t) === alvo) ??
    takes.find(t => Boolean(dele(t)) && alvo.startsWith(dele(t) + '_')) ??
    takes.find(t => Boolean(dele(t)) && dele(t).startsWith(alvo))
  );
}

/**
 * O que o XML diz de diferente do que foi logado.
 *
 * Só entra na lista o campo que **tem valor no XML** e **discorda** do
 * boletim. Campo que o XML não traz não vira "diferença" — a FX30 não escreve
 * ISO, e isso não quer dizer que o ISO logado esteja errado.
 */
export function diferencasDoClipe(take: Take, clipe: ClipeDoXml): Diferenca[] {
  const lista: Diferenca[] = [];
  const comparar = (campo: Diferenca['campo'], rotulo: string, logado?: string, daCamera?: string) => {
    if (!daCamera) return;
    if (normalizar(logado) === normalizar(daCamera)) return;
    lista.push({ campo, rotulo, logado: logado || undefined, daCamera });
  };

  comparar('codec', 'Codec', take.codec, clipe.codec);
  comparar('fps', 'FPS', take.fps, clipe.fps);
  comparar('resolucao', 'Resolução', take.resolucao, clipe.resolucao);
  comparar('duracao', 'Duração', take.xml?.duracao, clipe.meta.duracao);
  comparar('tcIn', 'TC in', take.xml?.tcIn, clipe.meta.tcIn);
  comparar('tcOut', 'TC out', take.xml?.tcOut, clipe.meta.tcOut);
  comparar('modeloCamera', 'Câmera', take.xml?.modeloCamera, clipe.meta.modeloCamera);
  comparar('lente', 'Lente', take.lente, clipe.meta.modeloLente);
  // O tamanho real entra quando o take ainda não tem: é o que conserta o ~GB do Backup.
  if (clipe.meta.bytes && !take.xml?.bytes) comparar('bytes', 'Tamanho', undefined, `${numero(clipe.meta.bytes / 2 ** 30, 1)} GB`);

  return lista;
}

/**
 * O número do clipe dentro do nome: `A008C013` → 13, `C0148` → 148,
 * `DJI_0007` → 7. É a última sequência de dígitos, tirando antes o sufixo da
 * câmera (`A003C030_260912SL`) quando o que sobra ainda tem número.
 */
export function numeroDoClipe(nome: string): number | null {
  // Blackmagic (A001_10311512_C001): o clipe é o C do fim, e não o carimbo de hora.
  const bm = chaveDoClipe(nome).match(/_C(\d{3,})$/);
  if (bm) return Number(bm[1]);
  // Sony com título (FX30_261013_0001) e DJI_0007: o número é o pedaço do fim.
  const fim = chaveDoClipe(nome).match(/_(\d{4,})$/);
  if (fim) return Number(fim[1]);
  const semSufixo = nome.replace(/_[^_]*$/, '');
  const base = /\d/.test(semSufixo) ? semSufixo : nome;
  const m = base.match(/(\d+)\D*$/);
  return m ? Number(m[1]) : null;
}

/** "HH:MM:SS" (ou o ISO do XML) em segundos do dia. */
function segundosDoDia(hora?: string): number | null {
  const m = String(hora ?? '').match(/(\d{2}):(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/**
 * Quando o take pode ter sido logado em relação ao começo do clipe. Nunca
 * antes (fora 2 min de relógio desencontrado); depois, até 1 h: na Diária 1 da
 * Canção, os C013–C015 foram logados de uma vez, 12 a 18 min depois de gravados.
 */
const ANTES = 2 * 60;
const DEPOIS = 60 * 60;

/**
 * Segunda chance para o clipe que não achou take pelo nome: o MESMO número de
 * clipe, da mesma câmera, logado perto da hora em que a câmera gravou.
 *
 * É o caso do A00X errado (o boletim diz A001C013, a câmera gravou A008C013):
 * o reel mudou e o nome não bate, mas o contador de clipes e o relógio contam a
 * mesma história. Só entra take que nenhum clipe achou pelo nome, e só quando
 * a hora existe dos dois lados — o número sozinho repete de cartão em cartão.
 */
function acharPeloNumeroEHora(livres: Take[], clipe: ClipeDoXml, desvio = 0): Take | undefined {
  const numero = numeroDoClipe(clipe.nome);
  const inicio = segundosDoDia(clipe.meta.criadoEm);
  if (numero === null || inicio === null) return undefined;
  const camera = cameraECartaoDoNome(clipe.nome).camera_id;

  let melhor: { take: Take; distancia: number } | undefined;
  for (const take of livres) {
    if (numeroDoClipe(take.arquivo || '') !== numero) continue;
    if (camera && take.camera_id && take.camera_id.toUpperCase() !== camera) continue;
    const hora = segundosDoDia(take.hora);
    if (hora === null) continue;
    if (hora - desvio < inicio - ANTES || hora - desvio > inicio + DEPOIS) continue;
    const distancia = Math.abs(hora - desvio - inicio);
    if (!melhor || distancia < melhor.distancia) melhor = { take, distancia };
  }
  return melhor?.take;
}

/**
 * A diferença entre o relógio de quem loga e o da câmera: a que põe MAIS takes
 * cada um no intervalo de um clipe (do começo dele ao começo do seguinte), um
 * por clipe. Só a hora conta — o nome é justamente o que pode estar errado.
 * Abaixo de dois takes encaixados não prova nada: 0.
 */
export function desvioDoLog(takes: Pick<Take, 'hora'>[], clipes: Pick<ClipeDoXml, 'meta'>[]): number {
  const inicios = [...new Set(clipes.map(c => segundosDoDia(c.meta.criadoEm)).filter((x): x is number => x !== null))].sort((a, b) => a - b);
  const horas = takes.map(t => segundosDoDia(t.hora)).filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (inicios.length < 2 || horas.length < 2) return 0;
  const janela = (x: number) => {
    // O último clipe com começo ≤ x (busca binária): os dias têm centenas de clipes.
    let lo = 0, hi = inicios.length - 1, achou = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (inicios[m] <= x) { achou = m; lo = m + 1; } else hi = m - 1; }
    return achou >= 0 && x - inicios[achou] <= DEPOIS ? achou : -1;
  };
  let melhor = { desvio: 0, cabem: 0 };
  const tentados = new Set<number>();
  for (const i of inicios) for (const h of horas) {
    const desvio = h - i;
    if (tentados.has(desvio) || Math.abs(desvio) > 12 * 3600) continue;
    tentados.add(desvio);
    const ocupadas = new Set<number>();
    for (const x of horas) { const w = janela(x - desvio); if (w >= 0) ocupadas.add(w); }
    if (ocupadas.size > melhor.cabem || (ocupadas.size === melhor.cabem && Math.abs(desvio) < Math.abs(melhor.desvio))) melhor = { desvio, cabem: ocupadas.size };
  }
  return melhor.cabem >= 2 ? melhor.desvio : 0;
}

/**
 * Alinha as duas filas — os takes na ORDEM em que foram logados, os clipes na
 * ordem em que a câmera gravou —, como quem confere duas listas lado a lado.
 * O continuísta loga na ordem do set: o 5º take logado é o 5º clipe gravado,
 * fora takes a mais (clique duplo) ou a menos (esqueceu de logar). O nome não
 * entra: é justamente o que pode estar errado, e errado de um jeito que cresce
 * ao longo do dia. A hora só descarta o impossível (logado antes de o clipe
 * começar) e pesa o improvável (muito depois de ele acabar).
 *
 * Programação dinâmica, uma câmera de cada vez: centenas de clipes, nada.
 */
function alinharPelaOrdem(takes: Take[], clipes: ClipeDoXml[], desvio: number): Map<number, Take> {
  const par = new Map<number, Take>();
  const PULAR = 6;
  const cameras = new Set(clipes.map(c => cameraECartaoDoNome(c.nome).camera_id ?? ''));
  for (const cam of cameras) {
    const cs = clipes.map((c, i) => ({ i, ini: segundosDoDia(c.meta.criadoEm), dur: c.meta.segundos ?? 0 }))
      .filter((x): x is { i: number; ini: number; dur: number } => x.ini !== null && (cameraECartaoDoNome(clipes[x.i].nome).camera_id ?? '') === cam)
      .sort((a, b) => a.ini - b.ini);
    const ts = takes.map(t => ({ t, h: segundosDoDia(t.hora) }))
      .filter((x): x is { t: Take; h: number } => x.h !== null && !(cam && x.t.camera_id && x.t.camera_id.toUpperCase() !== cam))
      .sort((a, b) => (a.t.ordem ?? 0) - (b.t.ordem ?? 0) || a.h - b.h);
    const n = cs.length, m = ts.length;
    if (!n || !m) continue;
    const custo = (a: number, b: number) => {
      const x = ts[b].h - desvio - cs[a].ini;
      if (x < -ANTES || x > DEPOIS) return Infinity;
      // Logado até 3 min depois do fim do clipe é o normal; depois disso pesa um pouco por minuto.
      // Logado já com o PRÓXIMO clipe rodando pesa mais: o OK vem antes da próxima "ação". É o que
      // separa o take esquecido do seguinte (que senão caberia nos dois), sem barrar o lote atrasado.
      const proximoIni = a + 1 < n ? cs[a + 1].ini : Infinity;
      const depoisDoProximo = Math.max(0, ts[b].h - desvio - proximoIni);
      return Math.max(0, x - cs[a].dur - 180) / 60 * 0.2 + Math.max(0, -x) / 60 + Math.min(2, depoisDoProximo / 60 * 0.3);
    };
    const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
    const de = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 1 par · 2 pula clipe · 3 pula take
    for (let a = 1; a <= n; a++) { dp[a][0] = a * PULAR; de[a][0] = 2; }
    for (let b = 1; b <= m; b++) { dp[0][b] = b * PULAR; de[0][b] = 3; }
    for (let a = 1; a <= n; a++) for (let b = 1; b <= m; b++) {
      const casa = dp[a - 1][b - 1] + custo(a - 1, b - 1);
      const semTake = dp[a - 1][b] + PULAR, semClipe = dp[a][b - 1] + PULAR;
      if (casa <= semTake && casa <= semClipe) { dp[a][b] = casa; de[a][b] = 1; }
      else if (semTake <= semClipe) { dp[a][b] = semTake; de[a][b] = 2; }
      else { dp[a][b] = semClipe; de[a][b] = 3; }
    }
    for (let a = n, b = m; a > 0 && b > 0;) {
      if (de[a][b] === 1) { par.set(cs[a - 1].i, ts[b - 1].t); a--; b--; }
      else if (de[a][b] === 2) a--;
      else b--;
    }
  }
  return par;
}

/** O take logado no intervalo do clipe (do começo dele ao do próximo), o primeiro. */
function acharPelaHora(livres: Take[], clipe: ClipeDoXml, proximo: number | undefined, desvio: number): Take | undefined {
  const inicio = segundosDoDia(clipe.meta.criadoEm);
  if (inicio === null) return undefined;
  const camera = cameraECartaoDoNome(clipe.nome).camera_id;
  return livres
    .filter(t => !(camera && t.camera_id && t.camera_id.toUpperCase() !== camera))
    .map(t => ({ t, h: segundosDoDia(t.hora) }))
    .filter((x): x is { t: Take; h: number } => x.h !== null && x.h - desvio >= inicio && x.h - desvio < (proximo ?? inicio + DEPOIS))
    .sort((a, b) => a.h - b.h)[0]?.t;
}

/**
 * Cruza os clipes lidos com os takes da diária.
 *
 * Primeiro pelo nome; o que sobrar, pelo número do clipe e pela hora — e aí o
 * nome do arquivo aparece como diferença, para o boletim passar a usar o que
 * a câmera gravou.
 *
 * Dois clipes que casam com o MESMO take viram "repetido" em vez de os dois
 * corrigirem a mesma linha: acontece quando o boletim tem um nome curto demais,
 * e aplicar os dois em cima do outro deixaria o take com os dados de um clipe
 * qualquer dos dois — sem ninguém perceber.
 */
export function cruzar(takes: Take[], clipes: ClipeDoXml[]): Casamento[] {
  const usados = new Set<string>();
  /*
    ⚠️ O NOME NÃO BASTA (achado com os cartões reais da Diária 2, 11/11/2026).
    No set, o boletim ficou 3 arquivos à frente: o take anotado como "C004" foi
    gravado no C001. Pelo nome, 30 de 36 clipes casavam com o take ERRADO — o
    OK de um iria para o arquivo de outro. O que desmente o nome é a hora: um
    take não pode ter sido logado ANTES de o clipe dele começar. Logar DEPOIS
    vale (a Diária 1 logou três de uma vez, 18 min depois).
  */
  const desvio = desvioDoLog(takes, clipes);
  const possivel = (t: Take, c: ClipeDoXml) => {
    const h = segundosDoDia(t.hora), i = segundosDoDia(c.meta.criadoEm);
    return h === null || i === null || h - desvio >= i - ANTES;
  };
  // O começo do próximo clipe da mesma câmera: o fim do intervalo em que o take deste foi logado.
  const camera = (c: ClipeDoXml) => cameraECartaoDoNome(c.nome).camera_id ?? '';
  const proximo = (c: ClipeDoXml) => {
    const i = segundosDoDia(c.meta.criadoEm);
    if (i === null) return undefined;
    const depois = clipes.map(x => (camera(x) === camera(c) ? segundosDoDia(x.meta.criadoEm) : null)).filter((x): x is number => x !== null && x > i);
    return depois.length ? Math.min(...depois) : undefined;
  };
  /*
    O dia inteiro decide: pela hora, cada clipe tem o take logado no seu
    intervalo. Se a hora explica a maior parte do dia e os nomes discordam dela
    na maioria, o boletim está DESLOCADO (para a frente ou para trás) e a hora
    manda. Se os nomes concordam na maioria, eles mandam — e um ou outro take
    logado em lote, atrasado, continua com o seu nome.
  */
  const nomeCru = clipes.map(clipe => acharTake(takes, clipe.nome));
  const pelaHora = clipes.map(clipe => acharPelaHora(takes, clipe, proximo(clipe), desvio));
  const comHora = pelaHora.filter(Boolean).length;
  const ambos = clipes.filter((_, i) => nomeCru[i] && pelaHora[i]).length;
  const concordam = clipes.filter((_, i) => nomeCru[i] && nomeCru[i] === pelaHora[i]).length;
  // Boletim certo concorda com a hora quase sempre (fora um lote logado atrasado). Abaixo de 90%, ele deslizou.
  const horaManda = comHora >= Math.max(2, 0.6 * clipes.length) && ambos > 0 && concordam < 0.9 * ambos;

  /*
    Deslocado, o boletim costuma estar deslocado POR IGUAL ("3 pra frente" o
    dia todo). O deslocamento que mais aparece entre os pares da hora vira a
    régua: o clipe C004 é o take anotado como C007. Clipe curto e colado, em que
    a hora sozinha fica em dúvida, se acerta pela régua.
  */
  /*
    A régua é LOCAL: no set o deslocamento cresceu ao longo do dia (a cada
    clique a mais, um a mais). Cada clipe usa o deslocamento que mais aparece
    entre os vizinhos dele (quatro de cada lado, na ordem da gravação).
  */
  const ordem = clipes.map((c, i) => ({ i, t: segundosDoDia(c.meta.criadoEm) ?? 0 })).sort((a, b) => a.t - b.t).map(x => x.i);
  const deslocDe = clipes.map((c, i) => {
    const a = numeroDoClipe(pelaHora[i]?.arquivo || ''), b = numeroDoClipe(c.nome);
    return a !== null && b !== null ? a - b : null;
  });
  const reguaDe = (i: number): number | null => {
    if (!horaManda) return null;
    const p = ordem.indexOf(i);
    const conta = new Map<number, number>();
    for (const j of ordem.slice(Math.max(0, p - 4), p + 5)) {
      const d = deslocDe[j];
      if (d !== null) conta.set(d, (conta.get(d) ?? 0) + 1);
    }
    const [k, n] = [...conta.entries()].sort((x, y) => y[1] - x[1] || Math.abs(x[0]) - Math.abs(y[0]))[0] ?? [0, 0];
    return n >= 2 ? k : null;
  };
  const pelaRegua = (clipe: ClipeDoXml, i: number) => {
    const n = numeroDoClipe(clipe.nome);
    const regua = reguaDe(i);
    if (regua === null || n === null) return undefined;
    const cam = camera(clipe);
    return takes.find(t => numeroDoClipe(t.arquivo || '') === n + regua
      && !(cam && t.camera_id && t.camera_id.toUpperCase() !== cam) && possivel(t, clipe));
  };

  const alinhado = horaManda ? alinharPelaOrdem(takes, clipes, desvio) : new Map<number, Take>();
  const peloNome = clipes.map((clipe, i) => {
    if (horaManda) return alinhado.get(i) ?? pelaRegua(clipe, i) ?? pelaHora[i];
    const t = nomeCru[i];
    return t && possivel(t, clipe) ? t : undefined;
  });
  const achadosPeloNome = new Set(peloNome.filter(Boolean).map(t => t!.id));

  return clipes.map((clipe, i) => {
    const livres = takes.filter(t => !achadosPeloNome.has(t.id) && !usados.has(t.id));
    const take = peloNome[i] ?? acharPeloNumeroEHora(livres, clipe, desvio) ?? acharPelaHora(livres, clipe, proximo(clipe), desvio);
    if (!take) return { tipo: 'sem-take', clipe } as const;
    if (usados.has(take.id)) return { tipo: 'repetido', clipe, take } as const;
    usados.add(take.id);
    const diferencas = diferencasDoClipe(take, clipe);
    // O nome logado não é o do clipe (casou pela ordem, pela hora ou pelo número): aparece para corrigir.
    if (!acharTake([take], clipe.nome)) diferencas.unshift({ campo: 'arquivo', rotulo: 'Arquivo', logado: take.arquivo, daCamera: clipe.nome });
    return { tipo: 'igual', clipe, take, diferencas } as const;
  });
}

/** O que gravar no take quando o XML vence. */
export function correcaoDoTake(clipe: ClipeDoXml, xmlAnterior?: Take['xml'], arquivoLogado?: string): Partial<Take> {
  const mudanca: Partial<Take> = {
    // O bloco `xml` guarda o que veio da câmera, separado do que foi digitado:
    // é assim que dá para saber, depois, de onde cada valor veio.
    xml: { ...xmlAnterior, ...clipe.meta },
  };
  // Casou pelo número e pela hora: o nome do boletim estava errado.
  if (arquivoLogado !== undefined && !acharTake([{ arquivo: arquivoLogado } as Take], clipe.nome)) mudanca.arquivo = clipe.nome;
  if (clipe.codec) mudanca.codec = clipe.codec;
  if (clipe.fps) mudanca.fps = clipe.fps;
  if (clipe.resolucao) mudanca.resolucao = clipe.resolucao;
  return mudanca;
}

/**
 * O take que nasce de um clipe sem take (status `IMPORT`).
 *
 * A câmera gravou e ninguém logou: pode ter sido um clipe de teste, pode ter
 * sido o take que salvou o dia enquanto o 2º AC estava resolvendo outra coisa.
 * O boletim precisa dizer que ele existe — com um status que deixa claro que
 * ninguém apertou OK nele.
 */
export function takeImportado(
  clipe: ClipeDoXml,
  base: { projeto_id: string; diaria_id: string; departamento_id?: string; camera_id: string; cartao: string },
  ordem: number
): Take {
  const hora = (clipe.meta.criadoEm?.match(/T(\d{2}:\d{2}:\d{2})/) || [])[1] || '';
  return {
    id: crypto.randomUUID(),
    projeto_id: base.projeto_id,
    diaria_id: base.diaria_id,
    departamento_id: base.departamento_id,
    cena: '',
    plano: '',
    take: 0,
    status: 'IMPORT' as StatusTake,
    hora,
    ordem,
    arquivo: clipe.nome,
    camera_id: base.camera_id,
    cartao: base.cartao,
    codec: clipe.codec,
    fps: clipe.fps,
    resolucao: clipe.resolucao,
    xml: clipe.meta,
    criado_em: Date.now(),
  };
}

/**
 * Aplica o que a pessoa aprovou na tela: corrige os takes e cria os importados.
 *
 * Só recebe o que foi escolhido. A decisão de quais clipes entram (os de outro
 * dia, os com arquivo estragado) é da tela, à vista de quem está aplicando —
 * aqui não se decide nada.
 */
export async function aplicarIngest(opcoes: {
  base: { projeto_id: string; diaria_id: string; departamento_id?: string };
  corrigir: { take: Take; clipe: ClipeDoXml }[];
  importar: { clipe: ClipeDoXml; camera_id: string; cartao: string }[];
}): Promise<{ corrigidos: number; importados: number }> {
  for (const { take, clipe } of opcoes.corrigir) {
    await db.log_takes.update(take.id, correcaoDoTake(clipe, take.xml, take.arquivo));
  }

  const existentes = await db.log_takes.where('diaria_id').equals(opcoes.base.diaria_id).toArray();
  let ordem = existentes.reduce((maior, t) => Math.max(maior, t.ordem || 0), 0);
  for (const { clipe, camera_id, cartao } of opcoes.importar) {
    ordem += 1;
    await db.log_takes.add(takeImportado(clipe, { ...opcoes.base, camera_id, cartao }, ordem));
  }

  return { corrigidos: opcoes.corrigir.length, importados: opcoes.importar.length };
}
