import { db } from '../db/db';
import { dinheiro } from './formato';
import type { Perfil } from '../types';

/**
 * Coleta e formatação dos dados do projeto para exportação (Gestão de Dados).
 * Cada conjunto vira uma tabela (colunas + linhas), que serve igualmente para
 * CSV, TXT e para alimentar a diagramação por IA.
 */

export interface Tabela {
  colunas: string[];
  linhas: string[][];
}

export interface ConjuntoDados {
  id: string;
  nome: string;
  descricao: string;
  grupo: 'Produção' | 'Financeiro' | 'Set' | 'Criativo' | 'Logística';
  /** true = contém dados pessoais sensíveis (CPF, banco, saúde). */
  sensivel?: boolean;
  carregar: (projetoId: string) => Promise<Tabela>;
}

const brl = (v?: number) => (v === undefined || v === null ? '' : `${dinheiro(v)}`);
const dataBr = (ts?: number) => (ts ? new Date(ts).toLocaleDateString('pt-BR') : '');
const dataIso = (iso?: string) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return d ? `${d}/${m}/${a}` : iso;
};

/** Nome legível de um participante (pessoa, departamento ou a produção). */
async function nomeDeQuem(tipo: string, idRef: string, perfis: Perfil[], deptos: { id: string; nome: string }[]) {
  if (tipo === 'producao') return 'Produção';
  if (tipo === 'departamento') return deptos.find(d => d.id === idRef)?.nome || 'Departamento';
  if (idRef === 'caixa_central') return 'Caixa da Produção';
  const p = perfis.find(x => x.id === idRef);
  return p ? `${p.nome} ${p.sobrenome || ''}`.trim() : '—';
}

export const CONJUNTOS: ConjuntoDados[] = [
  {
    id: 'projeto',
    nome: 'Dados da Produção',
    descricao: 'Nome, diretor, produtora, período e orçamento.',
    grupo: 'Produção',
    carregar: async (projetoId) => {
      const p = await db.projetos.get(projetoId);
      if (!p) return { colunas: [], linhas: [] };
      return {
        colunas: ['Campo', 'Valor'],
        linhas: [
          ['Nome', p.nome],
          ['Diretor', p.diretor || ''],
          ['Produtor', p.produtor || ''],
          ['Produtor Executivo', p.produtor_executivo || ''],
          ['Produtora', p.produtora || ''],
          ['Local', p.local || ''],
          ['Início', dataIso(p.data_inicio)],
          ['Fim', dataIso(p.data_fim)],
          ['Fonte do Orçamento', p.fonte_orcamento || ''],
          ['Limite de Gasto', brl(p.limite_gasto)],
          ['Nº de Diárias Planejadas', p.num_diarias ? String(p.num_diarias) : ''],
          ['Observações', p.obs || ''],
        ],
      };
    },
  },
  {
    id: 'creditos',
    nome: 'Créditos',
    descricao: 'Ficha de créditos por departamento e função.',
    grupo: 'Produção',
    carregar: async (projetoId) => {
      const p = await db.projetos.get(projetoId);
      const deptos = await db.departamentos.where('projeto_id').equals(projetoId).toArray();
      const creditos = p?.creditos || [];
      return {
        colunas: ['Departamento', 'Função', 'Nome'],
        linhas: creditos.map(c => [
          deptos.find(d => d.id === c.departamento_id)?.nome || 'Apoios e Extras',
          c.papel,
          c.nome,
        ]),
      };
    },
  },
  {
    id: 'equipe',
    nome: 'Equipe (contato)',
    descricao: 'Nome, função, departamento, telefone e e-mail.',
    grupo: 'Produção',
    carregar: async (projetoId) => {
      const perfis = await db.perfis.where('projeto_id').equals(projetoId).toArray();
      const deptos = await db.departamentos.where('projeto_id').equals(projetoId).toArray();
      return {
        colunas: ['Nome', 'Função', 'Departamento', 'Telefone', 'E-mail'],
        linhas: perfis
          .filter(p => p.id !== 'caixa_central')
          .map(p => [
            `${p.nome} ${p.sobrenome || ''}`.trim(),
            p.funcao || '',
            deptos.find(d => d.id === p.departamento_id)?.nome || '',
            p.telefone || '',
            p.email || '',
          ]),
      };
    },
  },
  {
    id: 'equipe_completa',
    nome: 'Equipe (ficha completa)',
    descricao: 'Inclui CPF, dados bancários, saúde e campos personalizados.',
    grupo: 'Produção',
    sensivel: true,
    carregar: async (projetoId) => {
      const perfis = await db.perfis.where('projeto_id').equals(projetoId).toArray();
      const deptos = await db.departamentos.where('projeto_id').equals(projetoId).toArray();
      const projeto = await db.projetos.get(projetoId);
      const custom = projeto?.campos_customizados || [];

      return {
        colunas: [
          'Nome', 'Sobrenome', 'Nome Social', 'CPF', 'RG', 'Nascimento', 'Telefone', 'E-mail',
          'Endereço', 'Função', 'Departamento', 'DRT', 'Tipo Vínculo', 'Valor Diária',
          'Chave PIX', 'Banco', 'Agência', 'Conta', 'CNPJ', 'Razão Social',
          'Contato Emergência', 'Tipo Sanguíneo', 'Alergias', 'Medicamentos', 'Restrição Alimentar', 'Plano de Saúde',
          ...custom.map(c => c.nome),
        ],
        linhas: perfis
          .filter(p => p.id !== 'caixa_central')
          .map(p => [
            p.nome, p.sobrenome || '', p.nome_social || '', p.cpf || '', p.rg || '', dataIso(p.data_nascimento),
            p.telefone || '', p.email || '', p.endereco || '', p.funcao || '',
            deptos.find(d => d.id === p.departamento_id)?.nome || '', p.drt || '',
            p.tipo_vinculo || '', brl(p.valor_diaria),
            p.chave_pix || '', p.banco || '', p.agencia || '', p.conta || '', p.cnpj || '', p.razao_social || '',
            p.contato_emergencia || '', p.tipo_sanguineo || '', p.alergias || '',
            p.medicamentos_continuos || '', p.restricao_alimentar || '', p.plano_saude || '',
            ...custom.map(c => p.custom?.[c.id] || ''),
          ]),
      };
    },
  },
  {
    id: 'departamentos',
    nome: 'Departamentos',
    descricao: 'Departamentos, orçamento e nº de pessoas.',
    grupo: 'Produção',
    carregar: async (projetoId) => {
      const deptos = await db.departamentos.where('projeto_id').equals(projetoId).toArray();
      const perfis = await db.perfis.where('projeto_id').equals(projetoId).toArray();
      return {
        colunas: ['Departamento', 'Orçamento', 'Pessoas'],
        linhas: deptos.map(d => [
          d.nome,
          brl(d.orcamento_departamento),
          String(perfis.filter(p => p.departamento_id === d.id).length),
        ]),
      };
    },
  },
  {
    id: 'entradas',
    nome: 'Entradas (aportes)',
    descricao: 'De onde veio o dinheiro do projeto.',
    grupo: 'Financeiro',
    carregar: async (projetoId) => {
      const aportes = await db.aportes.where('projeto_id').equals(projetoId).toArray();
      return {
        colunas: ['Data', 'Origem', 'Valor', 'Observação'],
        linhas: aportes
          .sort((a, b) => a.data - b.data)
          .map(a => [dataBr(a.data), a.origem, brl(a.valor), a.obs || '']),
      };
    },
  },
  {
    id: 'despesas',
    nome: 'Despesas',
    descricao: 'Todos os gastos, com quem pagou e a que diária pertencem.',
    grupo: 'Financeiro',
    carregar: async (projetoId) => {
      const despesas = await db.despesas.where('projeto_id').equals(projetoId).toArray();
      const perfis = await db.perfis.where('projeto_id').equals(projetoId).toArray();
      const deptos = await db.departamentos.where('projeto_id').equals(projetoId).toArray();

      const linhas: string[][] = [];
      for (const d of despesas.sort((a, b) => a.data - b.data)) {
        const pagadores: string[] = [];
        for (const p of d.pagadores) pagadores.push(await nomeDeQuem(p.tipo, p.id_ref, perfis, deptos));
        const devedores: string[] = [];
        for (const v of d.devedores) devedores.push(await nomeDeQuem(v.tipo, v.id_ref, perfis, deptos));

        linhas.push([
          dataIso(d.data_ocorrencia) || dataBr(d.data),
          d.descricao,
          d.categoria || '',
          d.diaria || '',
          brl(d.valor_total),
          pagadores.join(' / '),
          devedores.join(' / '),
          d.reembolsavel ? 'Sim' : 'Não',
          d.comprovante ? 'Sim' : 'Não',
        ]);
      }

      return {
        colunas: ['Data', 'Descrição', 'Categoria', 'Diária', 'Valor', 'Quem pagou', 'Quem deve', 'Reembolsável', 'Comprovante'],
        linhas,
      };
    },
  },
  {
    id: 'acertos',
    nome: 'Acertos',
    descricao: 'Pagamentos entre as pessoas e o caixa.',
    grupo: 'Financeiro',
    carregar: async (projetoId) => {
      const acertos = await db.acertos.where('projeto_id').equals(projetoId).toArray();
      const perfis = await db.perfis.where('projeto_id').equals(projetoId).toArray();
      const deptos = await db.departamentos.where('projeto_id').equals(projetoId).toArray();

      const linhas: string[][] = [];
      for (const a of acertos.sort((x, y) => x.data - y.data)) {
        linhas.push([
          dataBr(a.data),
          await nomeDeQuem(a.de.tipo, a.de.id_ref, perfis, deptos),
          await nomeDeQuem(a.para.tipo, a.para.id_ref, perfis, deptos),
          brl(a.valor),
          a.status === 'confirmado' ? 'Confirmado' : 'Pendente',
        ]);
      }
      return { colunas: ['Data', 'De', 'Para', 'Valor', 'Status'], linhas };
    },
  },
  {
    id: 'diarias',
    nome: 'Diárias',
    descricao: 'Dias de filmagem, locações, equipe escalada e gasto.',
    grupo: 'Set',
    carregar: async (projetoId) => {
      const diarias = await db.diarias.where('projeto_id').equals(projetoId).toArray();
      const locacoes = await db.locacoes.where('projeto_id').equals(projetoId).toArray();
      const despesas = await db.despesas.where('projeto_id').equals(projetoId).toArray();

      return {
        colunas: ['Diária', 'Data', 'Locações', 'Equipe escalada', 'Gasto do dia', 'Valor máximo', 'Status'],
        linhas: diarias
          .sort((a, b) => a.numero - b.numero)
          .map(d => [
            String(d.numero).padStart(2, '0'),
            dataIso(d.data),
            (d.locacoes_ids || []).map(id => locacoes.find(l => l.id === id)?.nome).filter(Boolean).join(', '),
            String((d.equipe_escalada || []).length),
            brl(despesas.filter(x => x.diaria_id === d.id).reduce((s, x) => s + x.valor_total, 0)),
            brl(d.limite_gasto),
            d.fechada ? 'Fechada' : 'Aberta',
          ]),
      };
    },
  },
  {
    id: 'locacoes',
    nome: 'Locações',
    descricao: 'Endereços, status, contatos e hospital de referência.',
    grupo: 'Logística',
    carregar: async (projetoId) => {
      const locacoes = await db.locacoes.where('projeto_id').equals(projetoId).toArray();
      const rotulo = { conversa: 'Em conversa', temos: 'Confirmada', caiu: 'Caiu' } as Record<string, string>;
      return {
        colunas: ['Nome', 'Endereço', 'Status', 'Contatos', 'Hospital', 'Telefone do hospital', 'Observações'],
        linhas: locacoes.map(l => [
          l.nome,
          l.endereco,
          rotulo[l.status || 'conversa'] || '',
          (l.contatos || []).map(c => `${c.papel}: ${c.nome} (${c.telefone})`).join(' / '),
          l.hospital_proximo || '',
          l.hospital_telefone || '',
          l.obs || '',
        ]),
      };
    },
  },
  {
    id: 'transporte',
    nome: 'Transporte',
    descricao: 'Veículos e motoristas cadastrados.',
    grupo: 'Logística',
    carregar: async (projetoId) => {
      const veiculos = await db.veiculos.where('projeto_id').equals(projetoId).toArray();
      const motoristas = await db.motoristas.where('projeto_id').equals(projetoId).toArray();
      return {
        colunas: ['Tipo', 'Nome', 'Detalhe', 'Contato'],
        linhas: [
          ...veiculos.map(v => ['Veículo', v.nome, [v.tipo, v.placa].filter(Boolean).join(' · '), motoristas.find(m => m.id === v.motorista_id)?.nome || '']),
          ...motoristas.map(m => ['Motorista', m.nome, m.cnh ? `CNH ${m.cnh}` : '', m.telefone || '']),
        ],
      };
    },
  },
  {
    id: 'tasks',
    nome: 'Tarefas',
    descricao: 'Kanban: status, responsável, departamento e prazo.',
    grupo: 'Set',
    carregar: async (projetoId) => {
      const tasks = await db.tasks.where('projeto_id').equals(projetoId).toArray();
      const perfis = await db.perfis.where('projeto_id').equals(projetoId).toArray();
      const deptos = await db.departamentos.where('projeto_id').equals(projetoId).toArray();
      const rotulo = { todo: 'A Fazer', doing: 'Fazendo', done: 'Feito' } as Record<string, string>;

      return {
        colunas: ['Tarefa', 'Status', 'Responsável', 'Departamento', 'Prazo', 'Subtarefas'],
        linhas: tasks.map(t => {
          const resp = perfis.find(p => p.id === t.responsavel_id);
          const subs = t.subtarefas || [];
          return [
            t.titulo,
            rotulo[t.status] || t.status,
            resp ? `${resp.nome} ${resp.sobrenome || ''}`.trim() : '',
            deptos.find(d => d.id === t.departamento_id)?.nome || '',
            dataIso(t.data_conclusao),
            subs.length ? `${subs.filter(s => s.concluida).length}/${subs.length}` : '',
          ];
        }),
      };
    },
  },
  {
    id: 'cenas',
    nome: 'Cenas e Planos',
    descricao: 'Decupagem: cenas, ordem de filmagem e planos.',
    grupo: 'Criativo',
    carregar: async (projetoId) => {
      const cenas = await db.cenas.where('projeto_id').equals(projetoId).toArray();
      const planos = await db.planos.where('projeto_id').equals(projetoId).toArray();
      const locacoes = await db.locacoes.where('projeto_id').equals(projetoId).toArray();

      return {
        colunas: ['Cena', 'Descrição', 'Ambiente', 'Período', 'Locação', 'Páginas', 'Estimativa', 'Planos'],
        linhas: cenas
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
          .map(c => [
            c.numero,
            c.descricao,
            (c.ambiente || '').toUpperCase(),
            c.periodo || '',
            locacoes.find(l => l.id === c.locacao_id)?.nome || '',
            c.paginas || '',
            c.estimativa || '',
            String(planos.filter(p => p.cena_id === c.id).length),
          ]),
      };
    },
  },
  {
    id: 'breakdown',
    nome: 'Breakdown do Roteiro',
    descricao: 'Elementos marcados no roteiro, por categoria.',
    grupo: 'Criativo',
    carregar: async (projetoId) => {
      const tags = await db.roteiro_tags.where('projeto_id').equals(projetoId).toArray();
      return {
        colunas: ['Categoria', 'Elemento', 'Página'],
        linhas: tags
          .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.pagina - b.pagina)
          .map(t => [t.categoria, t.texto_selecionado, String(t.pagina)]),
      };
    },
  },
  {
    id: 'documentos',
    nome: 'Documentos',
    descricao: 'Índice de arquivos e links (não inclui os arquivos em si).',
    grupo: 'Criativo',
    carregar: async (projetoId) => {
      const docs = await db.documentos.where('projeto_id').equals(projetoId).toArray();
      const pastas = await db.pastas.where('projeto_id').equals(projetoId).toArray();
      return {
        colunas: ['Pasta', 'Nome', 'Tipo', 'Origem', 'Data', 'Link'],
        linhas: docs.map(d => [
          pastas.find(p => p.id === d.pasta_id)?.nome || '',
          d.nome,
          d.tipo === 'link' ? 'Link' : 'Arquivo',
          d.origem || 'manual',
          dataBr(d.data_criacao),
          d.tipo === 'link' ? d.url : '(arquivo local)',
        ]),
      };
    },
  },
];

// ---- Formatação ----

/** Escapa um valor para CSV (aspas duplas, separador ponto e vírgula do Excel BR). */
function celulaCsv(valor: string): string {
  const v = (valor ?? '').replace(/"/g, '""');
  return `"${v}"`;
}

export function tabelaParaCSV(tabela: Tabela): string {
  const linhas = [
    tabela.colunas.map(celulaCsv).join(';'),
    ...tabela.linhas.map(l => l.map(celulaCsv).join(';')),
  ];
  // BOM para o Excel abrir acentuação corretamente.
  return '﻿' + linhas.join('\r\n');
}

/** Bloco de texto legível, com colunas alinhadas. */
export function tabelaParaTXT(titulo: string, tabela: Tabela): string {
  if (tabela.linhas.length === 0) {
    return `${titulo.toUpperCase()}\n${'='.repeat(titulo.length)}\n(sem registros)\n`;
  }

  // Formato "Campo: valor" quando é uma tabela de 2 colunas do tipo chave/valor.
  if (tabela.colunas.length === 2 && tabela.colunas[0] === 'Campo') {
    const corpo = tabela.linhas.map(([k, v]) => `  ${k}: ${v || '—'}`).join('\n');
    return `${titulo.toUpperCase()}\n${'='.repeat(titulo.length)}\n${corpo}\n`;
  }

  const larguras = tabela.colunas.map((c, i) =>
    Math.max(c.length, ...tabela.linhas.map(l => (l[i] || '').length))
  );
  const linha = (celulas: string[]) =>
    celulas.map((c, i) => (c || '').padEnd(larguras[i])).join('  |  ').trimEnd();

  const separador = larguras.map(w => '-'.repeat(w)).join('--+--');

  return [
    titulo.toUpperCase(),
    '='.repeat(titulo.length),
    linha(tabela.colunas),
    separador,
    ...tabela.linhas.map(linha),
    '',
  ].join('\n');
}

/** Dispara o download de um conteúdo de texto. */
export function baixarArquivo(nomeArquivo: string, conteudo: string, mime: string) {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Deixa o nome do arquivo seguro para qualquer sistema. */
export function nomeSeguro(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'projeto';
}
