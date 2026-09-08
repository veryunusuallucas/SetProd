import { db } from '../db/db';
import type { Departamento, Perfil, Projeto, Credito } from '../types';

/**
 * Catálogo de departamentos e funções do audiovisual brasileiro.
 * É a espinha dorsal dos Créditos: cada departamento traz suas funções principais
 * (chefe primeiro, depois assistentes) e o usuário pode acrescentar outras.
 *
 * O mesmo catálogo cria os departamentos básicos quando um projeto nasce — por isso
 * Créditos e Departamentos falam a mesma língua e a informação é compartilhada.
 */
export interface DepartamentoPadrao {
  nome: string;
  cor: string;
  funcoes: string[];
}

export const DEPARTAMENTOS_PADRAO: DepartamentoPadrao[] = [
  {
    nome: 'Direção',
    cor: '#8884d8',
    funcoes: ['Diretor', 'Assistente de Direção', '2º Assistente de Direção', 'Continuísta'],
  },
  {
    nome: 'Produção',
    cor: '#0088FE',
    funcoes: ['Produtor Executivo', 'Produtor', 'Assistente de Produção', 'Produtor de Set', 'Produtor de Elenco'],
  },
  {
    nome: 'Roteiro',
    cor: '#a4de6c',
    funcoes: ['Roteirista', 'Argumento', 'Consultoria de Roteiro'],
  },
  {
    nome: 'Fotografia',
    cor: '#00C49F',
    funcoes: ['Diretor de Fotografia', 'Operador de Câmera', '1º Assistente de Câmera (Foquista)', '2º Assistente de Câmera', 'Still'],
  },
  {
    nome: 'Elétrica e Maquinária',
    cor: '#FFBB28',
    funcoes: ['Gaffer', 'Eletricista', 'Chefe de Maquinária', 'Maquinista'],
  },
  {
    nome: 'Arte',
    cor: '#FF8042',
    funcoes: ['Diretor de Arte', 'Produtor de Objetos', 'Assistente de Arte', 'Cenógrafo'],
  },
  {
    nome: 'Figurino',
    cor: '#ff5722',
    funcoes: ['Figurinista', 'Assistente de Figurino', 'Camareira'],
  },
  {
    nome: 'Maquiagem e Cabelo',
    cor: '#ffc658',
    funcoes: ['Maquiador', 'Assistente de Maquiagem', 'Cabeleireiro', 'Efeitos Especiais de Maquiagem'],
  },
  {
    nome: 'Som',
    cor: '#673ab7',
    funcoes: ['Técnico de Som Direto', 'Microfonista', 'Assistente de Som'],
  },
  {
    nome: 'Elenco',
    cor: '#d0ed57',
    funcoes: ['Elenco Principal', 'Elenco de Apoio', 'Figuração'],
  },
  {
    nome: 'Pós-produção',
    cor: '#4cc9f0',
    funcoes: ['Montador', 'Colorista', 'Editor de Som', 'Mixagem', 'Trilha Sonora', 'Motion / VFX'],
  },
];

/** Normaliza nomes para comparar departamentos sem tropeçar em acento/caixa. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

/**
 * Cria os departamentos básicos de um projeto. Idempotente: departamentos que já
 * existem (pelo nome) são preservados, então dá para rodar em projeto antigo.
 * Devolve quantos foram criados.
 */
export async function criarDepartamentosPadrao(projetoId: string): Promise<number> {
  const existentes = await db.departamentos.where('projeto_id').equals(projetoId).toArray();
  const jaTem = new Set(existentes.map(d => normalizar(d.nome)));

  const novos: Departamento[] = DEPARTAMENTOS_PADRAO
    .filter(d => !jaTem.has(normalizar(d.nome)))
    .map(d => ({
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      nome: d.nome,
      cor: d.cor,
    }));

  if (novos.length > 0) await db.departamentos.bulkAdd(novos);
  return novos.length;
}

/** Encontra a definição de catálogo correspondente a um departamento do projeto. */
export function catalogoDoDepartamento(departamento: Departamento): DepartamentoPadrao | undefined {
  return DEPARTAMENTOS_PADRAO.find(d => normalizar(d.nome) === normalizar(departamento.nome));
}

/**
 * Uma linha de crédito montada para a tela: junta a função (do catálogo ou
 * adicionada pelo usuário) com quem a ocupa.
 */
export interface LinhaCredito {
  chave: string;            // identificador estável da linha
  papel: string;
  credito?: Credito;        // o registro salvo, quando alguém já foi atribuído
  doCatalogo: boolean;
  /**
   * Quantas pessoas ocupam esta MESMA função no departamento.
   *
   * 1 é o caso comum — um diretor de fotografia, um continuísta. Acima disso a
   * tela precisa mostrar a variante de cada um, senão a ficha técnica lista dois
   * "Operador de Câmera" e ninguém sabe qual é a câmera A.
   */
  irmas: number;
}

/**
 * Como o crédito se chama na ficha técnica: a função, mais o que distingue.
 *
 * ⚠️ USE ISTO EM VEZ DE `credito.papel` EM QUALQUER LUGAR QUE MOSTRE O CRÉDITO
 * PARA ALGUÉM. `papel` é a função canônica — é por ele que o app casa a ficha
 * da pessoa com a vaga, e por isso ele NÃO carrega o "(B)" dentro. Quem tem que
 * juntar as duas coisas é quem escreve na tela.
 */
export function nomeDoCredito(credito: Credito): string {
  return credito.variante ? `${credito.papel} (${credito.variante})` : credito.papel;
}

/**
 * A variante sugerida para quem entra numa função que já tem gente.
 *
 * Letras, que é como um set nomeia câmera e som desde sempre: A, B, C. A pessoa
 * pode trocar por "principal", "2ª unidade" ou o que fizer sentido — o campo é
 * livre. O que não pode é a segunda pessoa entrar sem marca nenhuma, porque aí
 * a ficha técnica sai com dois nomes idênticos e nenhuma diferença entre eles.
 */
export function proximaVariante(quantosJaTem: number): string {
  const LETRAS = 'ABCDEFGHIJ';
  return LETRAS[quantosJaTem] || String(quantosJaTem + 1);
}

/**
 * Monta as linhas de um departamento: primeiro as funções do catálogo (na ordem),
 * depois os créditos extras que o usuário adicionou naquele departamento.
 */
export function linhasDoDepartamento(departamento: Departamento, creditos: Credito[]): LinhaCredito[] {
  const doDepto = creditos.filter(c => c.departamento_id === departamento.id);
  const catalogo = catalogoDoDepartamento(departamento);
  const funcoesPadrao = catalogo?.funcoes || [];

  /*
    Uma função pode ter MAIS DE UMA linha.

    Antes era `find`: uma função do catálogo, um crédito. Quem tivesse dois
    operadores de câmera via um só — o segundo ficava gravado no projeto e
    invisível na tela, porque também não caía nos "extras" (o papel dele está no
    catálogo). Agora cada pessoa na mesma função é uma linha, na ordem em que
    entraram, e a `chave` de uma linha ocupada é o id do crédito: duas linhas da
    mesma função precisam de identidades diferentes para a tela não confundi-las.
  */
  const linhas: LinhaCredito[] = funcoesPadrao.flatMap(papel => {
    const mesmos = doDepto
      .filter(c => normalizar(c.papel) === normalizar(papel))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

    if (mesmos.length === 0) {
      return [{ chave: `${departamento.id}::${papel}`, papel, doCatalogo: true, irmas: 1 }];
    }
    return mesmos.map(c => ({
      chave: c.id,
      papel,
      credito: c,
      doCatalogo: true,
      irmas: mesmos.length,
    }));
  });

  const extras = doDepto
    .filter(c => !funcoesPadrao.some(f => normalizar(f) === normalizar(c.papel)))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map(c => ({
      chave: c.id,
      papel: c.papel,
      credito: c,
      doCatalogo: false,
      irmas: 1,
    }));

  return [...linhas, ...extras];
}

/**
 * Atribui alguém a uma função de crédito. Se for um membro da equipe, o vínculo é
 * de mão dupla: o perfil passa a pertencer àquele departamento com aquela função —
 * é o que faz "Lucas em Fotografia como Operador de Câmera" valer nos dois lugares.
 */
export async function salvarCredito(params: {
  projeto: Projeto;
  departamentoId: string;
  papel: string;
  perfilId?: string;
  nomeLivre?: string;
  creditoExistente?: Credito;
  sincronizarPerfil?: boolean;
  /** O que distingue este de outro na mesma função — "A", "B", "complementar". */
  variante?: string;
}): Promise<void> {
  const { projeto, departamentoId, papel, perfilId, nomeLivre, creditoExistente, sincronizarPerfil = true, variante } = params;

  let nome = (nomeLivre || '').trim();
  if (perfilId) {
    const perfil = await db.perfis.get(perfilId);
    if (perfil) nome = `${perfil.nome} ${perfil.sobrenome || ''}`.trim();
  }
  if (!nome) return;

  const creditos = projeto.creditos || [];
  const novo: Credito = {
    id: creditoExistente?.id || crypto.randomUUID(),
    nome,
    papel,
    departamento_id: departamentoId,
    perfil_id: perfilId || undefined,
    ordem: creditoExistente?.ordem ?? creditos.length,
    padrao: creditoExistente?.padrao,
    // A variante do parâmetro ganha; sem parâmetro, a que já estava fica. É o
    // que permite trocar a pessoa de uma linha sem que ela perca o "(B)".
    variante: variante !== undefined ? (variante || undefined) : creditoExistente?.variante,
  };

  const atualizados = creditoExistente
    ? creditos.map(c => (c.id === creditoExistente.id ? novo : c))
    : [...creditos, novo];

  await db.projetos.update(projeto.id, { creditos: atualizados });

  // Reflexo no cadastro da equipe: o membro herda departamento e função.
  if (sincronizarPerfil && perfilId) {
    const perfil = await db.perfis.get(perfilId);
    if (perfil) {
      const mudancas: Partial<Perfil> = {};
      if (perfil.departamento_id !== departamentoId) mudancas.departamento_id = departamentoId;
      if (!perfil.funcao || normalizar(perfil.funcao) !== normalizar(papel)) mudancas.funcao = papel;
      if (Object.keys(mudancas).length > 0) await db.perfis.update(perfilId, mudancas);
    }
  }
}

/** Remove um crédito (não mexe no cadastro do membro). */
export async function removerCredito(projeto: Projeto, creditoId: string): Promise<void> {
  await db.projetos.update(projeto.id, {
    creditos: (projeto.creditos || []).filter(c => c.id !== creditoId),
  });
}

/**
 * Sugere, para uma função, os membros da equipe que já estão naquele departamento —
 * eles aparecem primeiro na lista de seleção.
 */
export function ordenarCandidatos(perfis: Perfil[], departamentoId: string): Perfil[] {
  return [...perfis]
    .filter(p => p.id !== 'caixa_central')
    .sort((a, b) => {
      const aNoDepto = a.departamento_id === departamentoId ? 0 : 1;
      const bNoDepto = b.departamento_id === departamentoId ? 0 : 1;
      if (aNoDepto !== bNoDepto) return aNoDepto - bNoDepto;
      return a.nome.localeCompare(b.nome);
    });
}

// ---------------------------------------------------------------------------
// A ficha preenchendo os créditos
// ---------------------------------------------------------------------------

/** Uma função vazia e quem a ficha da equipe diz que a ocupa. */
export interface SugestaoDeCredito {
  chave: string;
  departamentoId: string;
  papel: string;
  perfil: Perfil;
}

/**
 * O que a ficha da equipe já sabe e a tela de créditos ainda não mostrava.
 *
 * O vínculo sempre foi de mão dupla no PAPEL — atribuir alguém a uma função
 * grava departamento e função no cadastro dele (ver `salvarCredito`). Só que a
 * volta nunca existiu: quem preencheu a função de cada pessoa na hora de criar
 * a ficha chegava aqui e via três selects em "— vazio —", tendo que dizer de
 * novo o que já tinha dito.
 *
 * ⚠️ ESTA FUNÇÃO NÃO GRAVA NADA. Ela devolve o que DARIA para preencher, e
 * quem decide preencher é a pessoa. Créditos são a ficha técnica do filme —
 * é o que vai no papel timbrado e no fim do rolo —, e um app que escreve nomes
 * ali sozinho, ao abrir a tela, escreve errado sem ninguém ver.
 *
 * O QUE ELA SE RECUSA A ADIVINHAR
 *
 *   linha ocupada      alguém já foi atribuído ali; sugerir seria propor uma
 *                      troca, e trocar crédito não é preencher crédito.
 *   duas pessoas       duas fichas com a mesma função no mesmo departamento.
 *                      Escolher uma seria escolher por sorteio.
 *   duas funções       a função da ficha existe em mais de um departamento e a
 *                      pessoa não está em nenhum deles. "Assistente de Produção"
 *                      é de Produção ou de Direção? A ficha não disse.
 *
 * Nesses casos a lista de seleção continua ali, com quem é do departamento
 * marcado e em primeiro — que é o que a tela já fazia bem.
 */
export function sugestoesPelaFicha(
  departamentos: Departamento[],
  perfis: Perfil[],
  creditos: Credito[]
): SugestaoDeCredito[] {
  /** Todas as funções ainda vazias, de todos os departamentos. */
  const vagas = departamentos.flatMap(d =>
    linhasDoDepartamento(d, creditos)
      .filter(l => !l.credito)
      .map(l => ({ chave: l.chave, departamentoId: d.id, papel: l.papel }))
  );

  const porChave = new Map<string, SugestaoDeCredito>();
  /** Vagas que mais de uma ficha reivindica — ninguém fica com elas. */
  const disputadas = new Set<string>();

  for (const perfil of perfis) {
    if (!perfil.funcao || perfil.id === 'caixa_central') continue;

    let candidatas = vagas.filter(v => normalizar(v.papel) === normalizar(perfil.funcao!));

    /*
      Com departamento na ficha, ele manda. Sem departamento, só serve se a
      função existir num lugar só do projeto — senão a "Assistente de Produção"
      da ficha entraria no departamento errado, e ninguém repararia.
    */
    if (perfil.departamento_id) {
      candidatas = candidatas.filter(v => v.departamentoId === perfil.departamento_id);
    }
    if (candidatas.length !== 1) continue;

    const vaga = candidatas[0];
    if (porChave.has(vaga.chave)) { disputadas.add(vaga.chave); continue; }
    porChave.set(vaga.chave, { ...vaga, perfil });
  }

  for (const chave of disputadas) porChave.delete(chave);

  return [...porChave.values()];
}
