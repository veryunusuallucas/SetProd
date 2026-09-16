import { db } from '../../db/db';
import type { BackupDeCartao, ChecksumDeCartao, HdDeBackup, StatusTake, Take } from '../../types';
import { cartaoSeguro, estimativaDoCartaoGB } from './backup';

/**
 * O resumo da Logagem para o resto do app (PLANO-logagem §7.2).
 *
 * NÚMEROS, e não a lista. É o que a produção pergunta no fim do dia — quantos
 * takes, quantas cenas saíram, os cartões já podem ser formatados? — e é o que
 * cabe no Registro do Set e no relatório de produção sem virar um segundo
 * boletim de câmera. O boletim inteiro continua na Logagem.
 *
 * Não escreve em lugar nenhum. Em particular, NÃO marca cena como gravada no
 * registro do set (§1.5): a Logagem diz o que a câmera rodou; quem diz se a
 * cena está resolvida é o AD.
 */

export interface CartaoNoResumo {
  nome: string;
  takes: number;
  gb: number;
  seguro: boolean;
}

export interface ResumoDaLogagem {
  takes: number;
  porStatus: Partial<Record<StatusTake, number>>;
  /** Cenas diferentes com pelo menos um take logado (sem contar importados). */
  cenas: number;
  /** Setups diferentes: cena + plano. */
  planos: number;
  cartoes: CartaoNoResumo[];
  seguros: number;
  pendentes: number;
  gbEstimados: number;
  /** O primeiro e o último take logado, pela hora. */
  primeiro?: string;
  ultimo?: string;
}

export function resumirLogagem(dados: {
  takes: Take[];
  hds: HdDeBackup[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
}): ResumoDaLogagem {
  const { takes } = dados;

  const porStatus: ResumoDaLogagem['porStatus'] = {};
  for (const t of takes) porStatus[t.status] = (porStatus[t.status] || 0) + 1;

  // Take importado não tem claquete: entra na contagem de takes, não na de cenas.
  const logados = takes.filter(t => t.status !== 'IMPORT' && String(t.cena ?? '').trim());
  const cenas = new Set(logados.map(t => String(t.cena).trim().toUpperCase())).size;
  const planos = new Set(logados.map(t => `${String(t.cena).trim()}|${String(t.plano).trim()}`.toUpperCase())).size;

  // Só os cartões que TÊM material: é deles que a pergunta "pode formatar?" importa.
  const nomes = [...new Set(takes.map(t => String(t.cartao ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

  const cartoes: CartaoNoResumo[] = nomes.map(nome => ({
    nome,
    takes: takes.filter(t => String(t.cartao).trim() === nome).length,
    gb: estimativaDoCartaoGB(takes, nome),
    seguro: cartaoSeguro({ hds: dados.hds, backups: dados.backups, checksums: dados.checksums, cartao: nome }),
  }));

  const horas = logados.map(t => t.hora).filter(Boolean).sort();

  return {
    takes: takes.length,
    porStatus,
    cenas,
    planos,
    cartoes,
    seguros: cartoes.filter(c => c.seguro).length,
    pendentes: cartoes.filter(c => !c.seguro).length,
    gbEstimados: cartoes.reduce((s, c) => s + c.gb, 0),
    primeiro: horas[0],
    ultimo: horas[horas.length - 1],
  };
}

export async function resumoDaLogagem(projetoId: string, diariaId: string): Promise<ResumoDaLogagem> {
  const [takes, hds, backups, checksums] = await Promise.all([
    db.log_takes.where('diaria_id').equals(diariaId).toArray(),
    db.log_hds.where('projeto_id').equals(projetoId).toArray(),
    db.log_backups.where('diaria_id').equals(diariaId).toArray(),
    db.log_checksums.where('diaria_id').equals(diariaId).toArray(),
  ]);
  return resumirLogagem({ takes, hds, backups, checksums });
}
