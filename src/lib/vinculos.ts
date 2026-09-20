import { db } from '../db/db';
import { CAIXA_CENTRAL } from '../core/caixaCentral';

/**
 * Onde uma pessoa (ou um departamento) aparece — antes de apagar.
 *
 * O PROBLEMA (ROADMAP §10.C)
 * Nada aqui tem chave estrangeira: o Dexie não tem, e o espelho é jsonb. Apagar
 * a ficha de alguém que pagou despesa deixava a despesa apontando para um
 * fantasma — o nome virava "—" e o saldo dele continuava no cálculo, atribuído
 * a ninguém. Dava para bagunçar o financeiro sem má intenção nenhuma.
 *
 * O QUE MUDA
 * - Pessoa com vínculo é ARQUIVADA, não apagada: some das listas e dos
 *   seletores, mas continua dando nome ao histórico.
 * - Departamento com vínculo NÃO é apagado: a tela diz onde ele aparece.
 *   Departamento raramente sai de uma produção em andamento; quando sai, é
 *   depois de mover quem está nele.
 */

export interface Vinculos {
  total: number;
  /** "4 despesas e 2 diárias" — pronto para entrar numa frase. */
  frase: string;
}

function contar(partes: [number, string, string][]): Vinculos {
  const ditas = partes
    .filter(([n]) => n > 0)
    .map(([n, um, varios]) => `${n} ${n === 1 ? um : varios}`);
  const frase = ditas.length <= 1
    ? (ditas[0] ?? '')
    : `${ditas.slice(0, -1).join(', ')} e ${ditas[ditas.length - 1]}`;
  return { total: partes.reduce((s, [n]) => s + n, 0), frase };
}

export async function vinculosDaPessoa(projetoId: string, perfilId: string): Promise<Vinculos> {
  const [despesas, acertos, diarias, tasks, motoristas, projeto] = await Promise.all([
    db.despesas.where('projeto_id').equals(projetoId).toArray(),
    db.acertos.where('projeto_id').equals(projetoId).toArray(),
    db.diarias.where('projeto_id').equals(projetoId).toArray(),
    db.tasks.where('projeto_id').equals(projetoId).toArray(),
    db.motoristas.where('projeto_id').equals(projetoId).toArray(),
    db.projetos.get(projetoId),
  ]);

  const naDespesa = despesas.filter(d =>
    [...(d.pagadores || []), ...(d.devedores || [])].some(q => q.id_ref === perfilId)).length;
  const noAcerto = acertos.filter(a => a.de?.id_ref === perfilId || a.para?.id_ref === perfilId).length;
  const naDiaria = diarias.filter(d =>
    (d.equipe_escalada || []).includes(perfilId)
    || (d.comboios || []).some(c => (c.passageiros_ids || []).includes(perfilId))).length;
  const naTask = tasks.filter(t =>
    t.responsavel_id === perfilId || (t.responsaveis_ids || []).includes(perfilId)).length;
  const comoMotorista = motoristas.filter(m => m.perfil_id === perfilId).length;
  const noCredito = (projeto?.creditos || []).filter(c => c.perfil_id === perfilId).length;

  return contar([
    [naDespesa, 'despesa', 'despesas'],
    [noAcerto, 'acerto', 'acertos'],
    [naDiaria, 'diária', 'diárias'],
    [naTask, 'task', 'tasks'],
    [noCredito, 'crédito', 'créditos'],
    [comoMotorista, 'cadastro de motorista', 'cadastros de motorista'],
  ]);
}

export async function vinculosDoDepartamento(projetoId: string, departamentoId: string): Promise<Vinculos> {
  const [perfis, tasks, diariaTasks, despesas, projeto] = await Promise.all([
    db.perfis.where('projeto_id').equals(projetoId).toArray(),
    db.tasks.where('projeto_id').equals(projetoId).toArray(),
    db.diaria_tasks.where('departamento_id').equals(departamentoId).toArray(),
    db.despesas.where('projeto_id').equals(projetoId).toArray(),
    db.projetos.get(projetoId),
  ]);

  return contar([
    [perfis.filter(p => p.departamento_id === departamentoId && !p.arquivado_em).length, 'pessoa', 'pessoas'],
    [tasks.filter(t => t.departamento_id === departamentoId).length, 'task', 'tasks'],
    [diariaTasks.length, 'tarefa de diária', 'tarefas de diária'],
    [despesas.filter(d => [...(d.pagadores || []), ...(d.devedores || [])]
      .some(q => q.tipo === 'departamento' && q.id_ref === departamentoId)).length, 'despesa', 'despesas'],
    [(projeto?.creditos || []).filter(c => c.departamento_id === departamentoId).length, 'crédito', 'créditos'],
  ]);
}

/**
 * Quem conta como equipe nas listas: nem o caixa da produção, nem quem saiu —
 * nem o esboço de ficha que ainda não tem nome.
 *
 * O esboço nasce quando a camada protegida de uma ficha chega antes da parte
 * pública (ver `fichaEmCamadas.ts`). Ele é um registro legítimo à espera do
 * resto, mas não é uma pessoa: numa lista ele aparece como linha em branco.
 */
export function naEquipe(p: { id: string; arquivado_em?: number; nome?: string; _esboco?: boolean }): boolean {
  if (p.id === CAIXA_CENTRAL || p.arquivado_em) return false;
  return !p._esboco && Boolean(p.nome?.trim());
}
