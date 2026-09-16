import type {
  BackupDeCartao, ChecksumDeCartao, Credito, HdDeBackup, Perfil, Projeto, Take,
} from '../../types';
import { ROTULO_DO_STATUS } from './takes';
import { cartaoSeguro, cartoesConhecidos, estimativaDoCartaoGB, oQueFalta } from './backup';

/**
 * O que sai da Logagem para fora do app: o CSV e o conteúdo dos PDFs
 * (PLANO-logagem §2.11).
 *
 * Aqui mora só o CONTEÚDO — que texto vai em cada célula, como os takes se
 * agrupam, quem assina o cabeçalho. O desenho do papel fica em `pdf.tsx`, que é
 * pesado e só carrega na hora de exportar; separar os dois é o que deixa isto
 * ser testado sem renderizador nenhum.
 */

/* ───────────────────────── Opções do relatório ───────────────────────── */

/**
 * Como a claquete aparece no papel.
 *
 * - `traco`: `1-A / Tk3`, o padrão do Lumavi;
 * - `compacto`: `C1PAT3`, o que alguns montadores pedem para bater com o nome do bin;
 * - `modelo`: o que a pessoa escrever, com `{cena}`, `{plano}` e `{take}`.
 */
export type FormatoDaClaquete = 'traco' | 'compacto' | 'modelo';

/** O que abre um sub-cabeçalho novo no meio da tabela. */
export type AgruparPor = 'formato' | 'cena' | 'codec';

export type ColunaDoReport = 'arquivo' | 'status' | 'claquete' | 'camera' | 'timecode' | 'hora' | 'obs' | 'foto';

export interface OpcoesDoReport {
  claquete: FormatoDaClaquete;
  modelo: string;
  agrupar: AgruparPor;
  colunas: ColunaDoReport[];
}

/**
 * As super-colunas do camera report.
 *
 * O formato (resolução, codec, fps…) NÃO é coluna: ele se repete em quase todo
 * take, e uma coluna que diz a mesma coisa quarenta vezes rouba a largura da
 * observação, que é a coluna que o montador lê. Ele vira o sub-cabeçalho.
 */
export const COLUNAS_DO_REPORT: { id: ColunaDoReport; rotulo: string; peso: number }[] = [
  { id: 'arquivo', rotulo: 'Arquivo', peso: 13 },
  { id: 'status', rotulo: 'Status', peso: 9 },
  { id: 'claquete', rotulo: 'Claquete', peso: 10 },
  { id: 'camera', rotulo: 'Lente | ND | f/T', peso: 17 },
  { id: 'timecode', rotulo: 'Timecode', peso: 13 },
  { id: 'hora', rotulo: 'Hora', peso: 7 },
  { id: 'obs', rotulo: 'OBS', peso: 24 },
  { id: 'foto', rotulo: 'Referência', peso: 15 },
];

export const OPCOES_PADRAO: OpcoesDoReport = {
  claquete: 'traco',
  modelo: '{cena}-{plano} / Tk{take}',
  agrupar: 'formato',
  colunas: COLUNAS_DO_REPORT.map(c => c.id),
};

const CHAVE_OPCOES = 'setprod:logagem:relatorio';

/**
 * As opções ficam NO APARELHO, como no Lumavi.
 *
 * São gosto de quem exporta — o DIT que manda para um montador que quer
 * `C1PAT3` — e não uma decisão da produção. Guardar na diária obrigaria a
 * escolher de novo a cada dia; guardar no projeto imporia o gosto de um ao
 * outro.
 */
export function lerOpcoesDoReport(): OpcoesDoReport {
  try {
    const bruto = localStorage.getItem(CHAVE_OPCOES);
    if (!bruto) return { ...OPCOES_PADRAO };
    return normalizarOpcoes(JSON.parse(bruto));
  } catch {
    return { ...OPCOES_PADRAO };
  }
}

export function lembrarOpcoesDoReport(opcoes: OpcoesDoReport) {
  try { localStorage.setItem(CHAVE_OPCOES, JSON.stringify(opcoes)); } catch { /* sem localStorage: vale só agora */ }
}

/** Aceita o que estiver salvo, e joga fora o que não se reconhece. */
export function normalizarOpcoes(bruto: Partial<OpcoesDoReport> | null | undefined): OpcoesDoReport {
  const b = bruto || {};
  const colunas = Array.isArray(b.colunas)
    ? COLUNAS_DO_REPORT.map(c => c.id).filter(id => b.colunas!.includes(id))
    : OPCOES_PADRAO.colunas;
  return {
    claquete: (['traco', 'compacto', 'modelo'] as const).includes(b.claquete as FormatoDaClaquete)
      ? b.claquete as FormatoDaClaquete : OPCOES_PADRAO.claquete,
    modelo: typeof b.modelo === 'string' ? b.modelo : OPCOES_PADRAO.modelo,
    agrupar: (['formato', 'cena', 'codec'] as const).includes(b.agrupar as AgruparPor)
      ? b.agrupar as AgruparPor : OPCOES_PADRAO.agrupar,
    // Nenhuma coluna marcada daria uma tabela vazia; volta ao padrão.
    colunas: colunas.length ? colunas : OPCOES_PADRAO.colunas,
  };
}

/* ───────────────────────── Células ───────────────────────── */

const vazio = (v: unknown) => String(v ?? '').trim();

export function claqueteNoFormato(
  take: Pick<Take, 'cena' | 'plano' | 'take' | 'status'>,
  opcoes: Pick<OpcoesDoReport, 'claquete' | 'modelo'>,
): string {
  const cena = vazio(take.cena);
  const plano = vazio(take.plano);
  // O importado não tem claquete; inventar `-- / Tk0` pareceria um take de verdade.
  if (take.status === 'IMPORT' || (!cena && !plano)) return 'sem claquete';

  const tk = String(take.take ?? '');
  if (opcoes.claquete === 'compacto') return `C${cena}P${plano}T${tk}`;
  if (opcoes.claquete === 'modelo') {
    const pronto = (opcoes.modelo || '')
      .replace(/\{cena\}/gi, cena)
      .replace(/\{plano\}/gi, plano)
      .replace(/\{take\}/gi, tk)
      .trim();
    if (pronto) return pronto;
  }
  return `${cena}-${plano} / Tk${tk}`;
}

/**
 * `f/2.8` ou `T2.8`, sem dobrar o prefixo de quem já digitou com ele. Sem
 * prefixo nenhum, é f — o que o boletim sempre foi.
 */
export const aberturaLegivel = (abertura?: string) => {
  const v = vazio(abertura);
  if (!v) return '';
  if (/^t\s*\d/i.test(v)) return `T${v.replace(/^t\s*/i, '')}`;
  return `f/${v.replace(/^f\s*\/?\s*/i, '')}`;
};

/** O que cada super-coluna diz de um take. `detalhe` sai em cinza, embaixo. */
export function celulaDoTake(coluna: ColunaDoReport, take: Take, opcoes: OpcoesDoReport): { texto: string; detalhe?: string } {
  switch (coluna) {
    case 'arquivo':
      return { texto: vazio(take.arquivo) || '—', detalhe: [take.camera_id && `Cam ${take.camera_id}`, take.cartao && `Cartão ${take.cartao}`].filter(Boolean).join(' · ') || undefined };
    case 'status':
      return { texto: ROTULO_DO_STATUS[take.status] || take.status };
    case 'claquete':
      return { texto: claqueteNoFormato(take, opcoes), detalhe: [take.ambiente, take.luz].filter(Boolean).join(' / ') || undefined };
    case 'camera':
      return { texto: [vazio(take.lente) || '—', vazio(take.nd) || '—', aberturaLegivel(take.abertura) || '—'].join(' | ') };
    case 'timecode': {
      const x = take.xml;
      if (!x?.tcIn && !x?.duracao) return { texto: '—' };
      return {
        texto: `In ${x.tcIn || '—'}`,
        detalhe: [x.tcOut && `Out ${x.tcOut}`, x.duracao && `Dur ${x.duracao}`].filter(Boolean).join('\n') || undefined,
      };
    }
    case 'hora':
      return { texto: vazio(take.hora) || '—' };
    case 'obs':
      return { texto: vazio(take.obs) };
    case 'foto':
      return { texto: '' };
  }
}

/* ───────────────────────── Sub-cabeçalhos ───────────────────────── */

/** O formato de um take, na ordem em que a câmera o descreve. */
export function formatoDoTake(take: Take): string[] {
  const partes: string[] = [];
  if (take.resolucao) partes.push(take.resolucao);
  if (take.codec) partes.push(take.codec);
  if (take.fps) partes.push(/fps/i.test(take.fps) ? take.fps : `${take.fps} fps`);
  if (take.xml?.gamma) partes.push(take.xml.gamma);
  const amostra = [take.xml?.amostragem, take.xml?.bitDepth].filter(Boolean).join(' ');
  if (amostra) partes.push(amostra);
  // WB e shutter ficam de fora de propósito: mudam de um plano para o outro,
  // e cada mudança abriria um sub-cabeçalho — o papel viraria só cabeçalhos.
  if (take.iso) partes.push(`ISO ${take.iso}`);
  return partes;
}

export function chaveDoGrupo(take: Take, agrupar: AgruparPor): string {
  if (agrupar === 'cena') return `cena:${vazio(take.cena).toUpperCase()}`;
  if (agrupar === 'codec') return `codec:${vazio(take.codec)}`;
  return `formato:${formatoDoTake(take).join('|')}`;
}

export function rotuloDoGrupo(take: Take, agrupar: AgruparPor): string {
  if (agrupar === 'cena') return vazio(take.cena) ? `Cena ${take.cena}` : 'Sem cena';
  if (agrupar === 'codec') return `Codec: ${vazio(take.codec) || 'não informado'}`;
  const partes = formatoDoTake(take);
  return partes.length ? partes.join('  |  ') : 'Formato não informado';
}

export interface GrupoDoReport {
  rotulo: string;
  takes: Take[];
}

/**
 * Os takes em grupos CONSECUTIVOS, na ordem em que foram rodados.
 *
 * Consecutivos, e não reunidos: se o dia foi 4K, depois 2K para um slow, e
 * depois 4K de novo, o papel mostra três blocos. Juntar os dois 4K tiraria os
 * takes da ordem — e a ordem é o que o montador usa para achar um take.
 *
 * Todo grupo tem rótulo, inclusive o primeiro: é ele que diz em que formato o
 * dia começou.
 */
export function agruparTakes(takes: Take[], agrupar: AgruparPor): GrupoDoReport[] {
  const grupos: GrupoDoReport[] = [];
  let chaveAnterior: string | null = null;
  for (const t of ordenarTakes(takes)) {
    const chave = chaveDoGrupo(t, agrupar);
    if (chave !== chaveAnterior) grupos.push({ rotulo: rotuloDoGrupo(t, agrupar), takes: [] });
    grupos[grupos.length - 1].takes.push(t);
    chaveAnterior = chave;
  }
  return grupos;
}

/** Pela `ordem` (ver o tipo `Take`); a hora só desempata registro antigo sem ordem. */
export const ordenarTakes = (takes: Take[]) =>
  [...takes].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.hora).localeCompare(String(b.hora)));

/* ───────────────────────── Quem ───────────────────────── */

export interface EquipeDoReport {
  diretor: string;
  fotografia: string;
  operador: string;
  produtor: string;
}

const normalizar = (s?: string) =>
  (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

function quemFaz(creditos: Credito[], funcoes: string[]): string {
  const alvos = funcoes.map(normalizar);
  const achados = creditos
    .filter(c => alvos.includes(normalizar(c.papel)) && vazio(c.nome))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map(c => (c.variante ? `${c.nome} (${c.variante})` : c.nome));
  return [...new Set(achados)].join(', ');
}

/**
 * Quem assina o cabeçalho: direção, fotografia, operação e produção.
 *
 * Sai dos CRÉDITOS, que é onde a produção já escreveu isso — o mesmo caminho
 * do `acharDP` da ponte com o SetGear. Os campos soltos do projeto (`diretor`,
 * `produtor`) são o plano B de produção antiga, que nunca preencheu créditos.
 */
export function equipeDoReport(projeto: Pick<Projeto, 'creditos' | 'diretor' | 'produtor'>): EquipeDoReport {
  const cr = projeto.creditos || [];
  return {
    diretor: quemFaz(cr, ['Diretor', 'Diretora', 'Direção']) || vazio(projeto.diretor),
    fotografia: quemFaz(cr, ['Diretor de Fotografia', 'Diretora de Fotografia', 'DP', 'DoP']),
    operador: quemFaz(cr, ['Operador de Câmera', 'Operadora de Câmera']),
    produtor: quemFaz(cr, ['Produtor', 'Produtora']) || vazio(projeto.produtor) || quemFaz(cr, ['Produtor Executivo', 'Produtora Executiva']),
  };
}

export const nomeDoPerfil = (p: Pick<Perfil, 'nome' | 'sobrenome' | 'nome_social'>) =>
  (vazio(p.nome_social) || `${vazio(p.nome)} ${vazio(p.sobrenome)}`.trim());

/**
 * O nome de quem logou.
 *
 * `logado_por` guarda a FICHA da pessoa quando ela tem uma na produção, e a
 * conta quando não tem (o DIT que entrou só com o convite). A ficha dá o nome
 * que a equipe conhece; a conta dá o apelido do convite, quando se sabe.
 */
export function nomeDeQuemLogou(
  id: string | undefined,
  perfis: Pick<Perfil, 'id' | 'nome' | 'sobrenome' | 'nome_social'>[],
  membros: { usuario_id: string; perfil_id?: string | null; apelido?: string | null }[] = [],
): string {
  if (!id) return '';
  const perfil = perfis.find(p => p.id === id);
  if (perfil) return nomeDoPerfil(perfil);
  const membro = membros.find(m => m.usuario_id === id);
  if (!membro) return '';
  const fichaDoMembro = membro.perfil_id ? perfis.find(p => p.id === membro.perfil_id) : undefined;
  return fichaDoMembro ? nomeDoPerfil(fichaDoMembro) : vazio(membro.apelido);
}

/* ───────────────────────── CSV ───────────────────────── */

/**
 * As 43 colunas do CSV do Lumavi, NA MESMA ORDEM e com os mesmos nomes.
 *
 * Quem já tem uma planilha ou um script de montagem lendo o CSV antigo não
 * pode ter que refazer nada por causa da mudança de app.
 */
export const CABECALHO_DO_CSV = [
  'ID Diária', 'Projeto', 'Diretor', 'Produtor', 'Dir. Fotografia', 'Operador',
  'Arquivo', 'Status', 'REC Invertido', 'Cena', 'Plano', 'Take', 'Hora', 'Ambiente', 'Luz', 'Áudio', 'Filtro ND', 'OBS',
  'Câmera', 'Câmera (modelo)', 'Cartão/Reel', 'Posição', 'FPS', 'Resolução', 'Codec', 'Bit Depth', 'Color Sampling',
  'Gamma', 'Gamut', 'Coding', 'WB', 'Shutter', 'ISO', 'F-Stop', 'Lente', 'Lente (câmera)', 'LUT',
  'TC In', 'TC Out', 'TC FPS', 'Duração', 'Áudio Codec', 'Criado em',
] as const;

export interface ContextoDoCsv {
  diaria: string;
  projeto: string;
  equipe: EquipeDoReport;
}

export function linhaDoCsv(t: Take, ctx: ContextoDoCsv): string[] {
  const x = t.xml || {};
  const importado = t.status === 'IMPORT';
  return [
    ctx.diaria, ctx.projeto, ctx.equipe.diretor, ctx.equipe.produtor, ctx.equipe.fotografia, ctx.equipe.operador,
    t.arquivo, ROTULO_DO_STATUS[t.status] || t.status, t.status === 'RECINV' ? 'SIM' : '',
    importado ? '' : t.cena, importado ? '' : t.plano, importado ? '' : String(t.take ?? ''),
    t.hora, t.ambiente, t.luz, t.audio, t.nd, t.obs,
    t.camera_id, x.modeloCamera, t.cartao, t.posicao, t.fps, t.resolucao, t.codec, x.bitDepth, x.amostragem,
    x.gamma, x.gamut, x.coding, t.wb, t.shutter, t.iso, t.abertura, t.lente, x.modeloLente, t.lut,
    x.tcIn, x.tcOut, x.tcFps, x.duracao, x.codecAudio, x.criadoEm,
  ].map(v => String(v ?? ''));
}

/**
 * Aspas quando a célula tem separador, aspa ou quebra de linha — e também
 * quando começa com `=`, `+`, `-` ou `@`: o Excel executaria a OBS "=soma…"
 * como fórmula. O apóstrofo na frente é o jeito padrão de dizer "é texto".
 */
export function celulaDoCsv(valor: string): string {
  let v = valor;
  if (/^[=+\-@]/.test(v) && !/^-?\d/.test(v)) v = `'${v}`;
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * O CSV inteiro: `;` como separador e BOM na frente.
 *
 * O `;` é o que o Excel em português espera (a vírgula é o decimal), e sem o
 * BOM ele abre o arquivo como Latin-1 e "Câmera" vira "CÃ¢mera".
 */
export function paraCsv(takes: Take[], ctx: ContextoDoCsv): string {
  const linhas = [
    [...CABECALHO_DO_CSV],
    ...ordenarTakes(takes).map(t => linhaDoCsv(t, ctx)),
  ];
  return '\uFEFF' + linhas.map(l => l.map(celulaDoCsv).join(';')).join('\r\n');
}

/* ───────────────────────── Integridade ───────────────────────── */

export interface LinhaDaIntegridade {
  cartao: string;
  gb: number;
  takes: number;
  /** Na ordem dos HDs recebidos. */
  copiado: boolean[];
  comprovante?: ChecksumDeCartao;
  seguro: boolean;
  falta: string[];
}

export function linhasDaIntegridade(dados: {
  takes: Take[];
  hds: HdDeBackup[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
}): LinhaDaIntegridade[] {
  const hds = [...dados.hds].sort((a, b) => a.ordem - b.ordem);
  const iguais = (a: string, b: string) => vazio(a) === vazio(b);
  return cartoesConhecidos(dados).map(cartao => ({
    cartao,
    gb: estimativaDoCartaoGB(dados.takes, cartao),
    takes: dados.takes.filter(t => iguais(t.cartao, cartao)).length,
    copiado: hds.map(h => dados.backups.some(b => b.hd_id === h.id && iguais(b.cartao, cartao))),
    comprovante: [...dados.checksums]
      .filter(c => iguais(c.cartao, cartao))
      .sort((a, b) => b.anexado_em - a.anexado_em)[0],
    seguro: cartaoSeguro({ ...dados, hds, cartao }),
    falta: oQueFalta({ ...dados, hds, cartao }),
  }));
}

/** Teto de linhas por comprovante no papel. O hash impresso cobre o arquivo inteiro. */
export const TETO_DE_LINHAS = 1200;

export function linhasDoComprovante(texto: string, teto = TETO_DE_LINHAS): { linhas: string[]; cortadas: number } {
  const todas = texto.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
  return { linhas: todas.slice(0, teto), cortadas: Math.max(0, todas.length - teto) };
}

/* ───────────────────────── Nome do arquivo ───────────────────────── */

export type TipoDeRelatorio = 'camera' | 'integridade' | 'consolidado';

export const TITULO_DO_RELATORIO: Record<TipoDeRelatorio, string> = {
  camera: 'Camera Report',
  integridade: 'Relatório de Integridade',
  consolidado: 'Camera Report + Integridade',
};

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

/** `camera-report-meu-curta-d03.pdf` — sem acento, porque o arquivo viaja por e-mail e pendrive. */
export function nomeDoArquivo(tipo: TipoDeRelatorio | 'csv' | 'json', projeto: string, diaria: number | undefined): string {
  const base = tipo === 'csv' ? 'camera-log' : tipo === 'json' ? 'copia-da-logagem' : semAcento(TITULO_DO_RELATORIO[tipo]);
  const dia = diaria != null ? `d${String(diaria).padStart(2, '0')}` : 'diaria';
  const prod = semAcento(projeto) || 'producao';
  const ext = tipo === 'csv' || tipo === 'json' ? tipo : 'pdf';
  return `${base}-${prod}-${dia}.${ext}`;
}
