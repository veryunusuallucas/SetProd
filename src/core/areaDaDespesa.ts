import type { Despesa } from '../types';

/**
 * De que departamento é esta despesa — a resposta ÚNICA do app.
 *
 * O PROBLEMA (relato do Lucas, 27/09/2026)
 * O formulário tinha DOIS campos de departamento: "De qual área é este gasto"
 * (`departamento_id`) e, dentro de "Gasto direto da produção", um seletor
 * antigo que gravava o departamento como DEVEDOR. Cada tela lia um: o painel
 * do departamento e o "Gasto por área" liam o primeiro; o gráfico "Gastos por
 * departamento" lia o segundo. Um microfone lançado com a área em Fotografia
 * (pré-marcada: era o departamento de quem lançou) e o seletor em Som não
 * aparecia no painel do Som — e o gráfico ao lado dizia que era do Som.
 *
 * A REGRA
 * A área (`departamento_id`) é a verdade. O devedor-departamento só vale como
 * resposta quando a área está vazia: são as despesas lançadas antes de a área
 * existir, e sem isto elas contariam como "da produção" para sempre.
 */
export function areaDaDespesa(d: Pick<Despesa, 'departamento_id' | 'devedores'>): string | undefined {
  if (d.departamento_id) return d.departamento_id;
  return (d.devedores || []).find(x => x.tipo === 'departamento')?.id_ref || undefined;
}
