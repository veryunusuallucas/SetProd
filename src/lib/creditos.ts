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
}

/**
 * Monta as linhas de um departamento: primeiro as funções do catálogo (na ordem),
 * depois os créditos extras que o usuário adicionou naquele departamento.
 */
export function linhasDoDepartamento(departamento: Departamento, creditos: Credito[]): LinhaCredito[] {
  const doDepto = creditos.filter(c => c.departamento_id === departamento.id);
  const catalogo = catalogoDoDepartamento(departamento);
  const funcoesPadrao = catalogo?.funcoes || [];

  const linhas: LinhaCredito[] = funcoesPadrao.map(papel => ({
    chave: `${departamento.id}::${papel}`,
    papel,
    credito: doDepto.find(c => normalizar(c.papel) === normalizar(papel)),
    doCatalogo: true,
  }));

  const extras = doDepto
    .filter(c => !funcoesPadrao.some(f => normalizar(f) === normalizar(c.papel)))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map(c => ({
      chave: c.id,
      papel: c.papel,
      credito: c,
      doCatalogo: false,
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
}): Promise<void> {
  const { projeto, departamentoId, papel, perfilId, nomeLivre, creditoExistente, sincronizarPerfil = true } = params;

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
