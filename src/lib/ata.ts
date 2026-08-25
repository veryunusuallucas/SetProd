import { db } from '../db/db';
import { participacoesLocais } from './membros';
import { supabase } from './supabase';
import type { AcaoLog, AuditLog, EntidadeLog } from '../types';

/**
 * A ata: o histórico do projeto em linguagem de gente.
 *
 * O log de auditoria guarda `{acao: 'editar', entidade: 'despesa'}`. Isso serve
 * para depurar, não para alguém entender o que a outra equipe andou fazendo. A
 * spec (§3.5) pede o contrário: nome de quem mexeu, onde mexeu, quando — e mais
 * nada. Esta é a camada de tradução.
 */

/** Onde a pessoa estava, do ponto de vista de quem usa o app. */
const PAGINA: Record<EntidadeLog, string> = {
  projeto: 'Produção',
  perfil: 'Equipe',
  departamento: 'Equipe',
  despesa: 'Financeiro',
  acerto: 'Financeiro',
  configuracao: 'Configurações',
  diaria: 'Diárias / OD',
  locacao: 'Locações',
  equipamento: 'Equipamentos',
  task: 'Tasks',
};

const VERBO: Record<AcaoLog, string> = {
  criar: 'adicionou algo em',
  editar: 'mexeu em',
  deletar: 'apagou algo em',
};

export interface LinhaDaAta {
  id: string;
  quem: string;
  /** Frase pronta: "Maira mexeu em Financeiro". */
  frase: string;
  detalhe: string;
  quando: number;
  souEu: boolean;
}

/**
 * Quem é quem, pelo NOME da pessoa.
 *
 * Antes isto devolvia o apelido da participação — "Equipe A", "Equipe B" —, que
 * era herança de quando o app tinha só dois lados e duas máquinas. Numa produção
 * de verdade ninguém se chama assim, e o rótulo ainda roubava o nome do conceito
 * que existe de fato no set: a segunda unidade de filmagem.
 *
 * A fonte certa passou a existir com o vínculo conta ↔ ficha
 * (`projeto_membros.perfil_id`): dá para dizer "Maira mexeu em Financeiro".
 *
 * O e-mail continua fora. O log guarda o e-mail de quem agiu, e jogá-lo na tela
 * exporia o endereço de todo mundo para todo mundo, sem ninguém ter pedido.
 */
async function nomesDeQuemMexeu(projetoId: string): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();

  // As fichas da equipe já estão neste aparelho — vieram pelo espelho. É de lá
  // que sai o nome, e não de uma consulta nova.
  const perfis = await db.perfis.where('projeto_id').equals(projetoId).toArray().catch(() => []);
  const porPerfil = new Map(perfis.map(p => [p.id, `${p.nome} ${p.sobrenome || ''}`.trim()]));

  const anotar = (usuarioId: string, perfilId?: string | null, apelido?: string | null) => {
    const nome = (perfilId && porPerfil.get(perfilId)) || apelido;
    if (nome) mapa.set(usuarioId, nome);
  };

  for (const p of participacoesLocais()) {
    if (p.projeto_id === projetoId) anotar(p.usuario_id, p.perfil_id, p.apelido);
  }

  // A cópia local só tem a MINHA participação; a das outras pessoas mora no
  // servidor. Sem isto, a ata chamaria todo mundo de "outra pessoa".
  try {
    const { data } = await supabase
      .from('projeto_membros')
      .select('usuario_id, perfil_id, apelido')
      .eq('projeto_id', projetoId);
    for (const m of data || []) anotar(m.usuario_id, m.perfil_id, m.apelido);
  } catch {
    // Offline: fica com o que já se sabe.
  }

  return mapa;
}

/** Monta a ata do projeto, da mais recente para a mais antiga. */
export async function montarAta(projetoId: string, limite = 60): Promise<LinhaDaAta[]> {
  const registros = await db.logs.where('projeto_id').equals(projetoId).toArray();
  registros.sort((a, b) => b.data_hora - a.data_hora);

  const nomes = await nomesDeQuemMexeu(projetoId);
  const { data: sessao } = await supabase.auth.getSession();
  const eu = sessao?.session?.user?.id;

  return registros.slice(0, limite).map((log: AuditLog) => {
    const souEu = Boolean(eu && log.autor_id === eu);
    // Sem nome conhecido, "Outra pessoa" — nunca o e-mail. O log guarda o
    // e-mail de quem agiu, e jogá-lo na tela expõe o endereço de todo mundo
    // para todo mundo, sem que ninguém tenha pedido isso.
    const quem = souEu ? 'Você' : (nomes.get(log.autor_id) || 'Outra pessoa');
    const onde = PAGINA[log.entidade] || log.entidade;
    const verbo = VERBO[log.acao] || 'mexeu em';

    return {
      id: log.id,
      quem,
      frase: `${quem} ${verbo} ${onde}`,
      detalhe: log.detalhes || '',
      quando: log.data_hora,
      souEu,
    };
  });
}

/** "agora", "há 5 min", "ontem 14:32" — a precisão que a pessoa precisa. */
export function quandoFoi(momento: number): string {
  const segundos = Math.floor((Date.now() - momento) / 1000);
  if (segundos < 60) return 'agora';
  if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;

  const data = new Date(momento);
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const hoje = new Date();
  const mesmoDia = data.toDateString() === hoje.toDateString();
  if (mesmoDia) return hora;

  const ontem = new Date(hoje.getTime() - 86400000);
  if (data.toDateString() === ontem.toDateString()) return `ontem ${hora}`;

  return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`;
}
