import { useState } from 'react';
import { Janela as JanelaBase } from './ui/Janela';
import { usarAviso, URGENCIA } from './avisos/CentralDeAvisos';
import { FaixaDeAviso } from './avisos/FaixaDeAviso';
import { useLiveQuery } from 'dexie-react-hooks';
import { GitMerge, Check, Trash2 } from 'lucide-react';
import { db, escreverGanhandoDe } from '../db/db';
import { dinheiro } from '../lib/formato';
import type { ConflitoGuardado } from '../types';

/**
 * O que foi substituído, e a chance de trazer de volta.
 *
 * O passo 2 do PLANO-conflitos-sync guarda a nossa versão antes de o LWW passar
 * por cima. Este é o passo 3: mostrar as duas e deixar escolher. Sem ele, o dado
 * está salvo num canto do banco que ninguém abre — o que, para quem usa, é a
 * mesma coisa que ter sumido.
 *
 * A escolha é do REGISTRO INTEIRO, de propósito. Mesclar campo a campo exige a
 * versão base (passo 4), que ainda não existe; oferecer uma mescla sem base é
 * como inventar qual dos dois lados tinha razão.
 */

/** O nome que a pessoa usa para aquele registro, não o id. */
function comoChamar(tabela: string, r: Record<string, unknown> | null): string {
  if (!r) return 'um registro apagado';
  const numero = r.numero ? `Diária ${r.numero}` : null;
  const nome = [r.nome, r.sobrenome].filter(Boolean).join(' ').trim();
  return (numero || nome || (r.descricao as string) || (r.titulo as string) || (r.local_base as string) || tabela);
}

const ROTULO: Record<string, string> = {
  diarias: 'diária', tasks: 'task', despesas: 'despesa', perfis: 'ficha',
  locacoes: 'locação', documentos: 'documento', cenas: 'cena', eventos: 'evento',
};

/** O nome do campo como a pessoa o vê na tela, não como ele é no banco. */
const CAMPO: Record<string, string> = {
  local_base: "Local base", observacoes: "Observações", equipe_escalada: "Escala",
  data: "Data", numero: "Número", descricao: "Descrição", valor_total: "Valor",
  categoria: "Categoria", status: "Status", titulo: "Título", nome: "Nome",
  funcao: "Função", departamento_id: "Departamento", responsavel_id: "Responsável",
  responsaveis_ids: "Responsáveis", prazo: "Prazo", hora_inicio: "Início",
  hora_fim: "Fim", endereco: "Endereço", telefone: "Telefone", email: "E-mail",
};
const nomeDoCampo = (c: string) => CAMPO[c] || c.replace(/_/g, " ");

/** Campos em que "1500" sem R$ na frente engana quem lê depressa. */
const EH_DINHEIRO = new Set(['valor', 'valor_total', 'valor_ideal', 'limite_gasto', 'valor_diaria', 'orcamento_departamento']);

/** Um valor de campo em uma linha legível. */
function mostrar(v: unknown, campo?: string): string {
  if (campo && EH_DINHEIRO.has(campo) && typeof v === "number") return dinheiro(v);
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? `${v.length} item(ns)` : 'vazio';
  if (typeof v === 'object') return '(dados)';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  return String(v);
}

/** O conflito é "um apagou, o outro editou" — não uma briga de campos. */
const ehApagar = (c: ConflitoGuardado) => c.campos_em_disputa.includes('apagado');

export function ConflitosPanel({ projetoId }: { projetoId: string }) {
  const [aberto, setAberto] = useState(false);
  const conflitos = useLiveQuery(
    async () => (await db.conflitos.where('projeto_id').equals(projetoId).toArray())
      .filter(c => !c.resolvido_em)
      .sort((a, b) => b.detectado_em - a.detectado_em),
    [projetoId]
  ) || [];

  /*
    O aviso vai para a central (leva de UI 3): ela decide quem aparece quando há
    mais de um. Este é o mais urgente de todos — é dado do trabalho em risco.
  */
  usarAviso('conflitos', URGENCIA.dadoEmRisco, conflitos.length ? `${conflitos.length}` : null, () => (
    <FaixaDeAviso
      icone={<GitMerge size={18} />}
      acao={<button className="btn btn-primary" onClick={() => setAberto(true)} style={{ flexShrink: 0 }}>Ver e escolher</button>}
    >
      {conflitos.length === 1
        ? <>Uma alteração sua foi substituída pela de outra pessoa. <strong>Ela não se perdeu</strong> — dá para ver e escolher.</>
        : <><strong>{conflitos.length} alterações suas</strong> foram substituídas pelas de outras pessoas. Elas não se perderam.</>}
    </FaixaDeAviso>
  ));

  return aberto ? <Janela conflitos={conflitos} aoFechar={() => setAberto(false)} /> : null;
}

function Janela({ conflitos, aoFechar }: { conflitos: ConflitoGuardado[]; aoFechar: () => void }) {
  const [erro, setErro] = useState('');
  const [mexendo, setMexendo] = useState('');

  /*
    "Usar a minha" reescreve o registro com a versão guardada e carimbo de
    agora: o hook do Dexie a põe na fila e ela sobe como qualquer edição. Não é
    um caminho especial de sincronização — é uma edição normal, feita pela
    pessoa, que por acaso tem o conteúdo antigo.
  */
  const escolher = async (c: ConflitoGuardado, escolha: 'minha' | 'servidor' | 'apagar') => {
    setMexendo(c.id);
    setErro('');
    try {
      /*
        APAGOU × EDITOU. O sync já trouxe o registro de volta — editar ganha de
        apagar, porque ressuscitar incomoda e perder custa. Aqui a pessoa
        confirma: fica, ou some de vez.
      */
      if (escolha === 'apagar') {
        await db.table(c.tabela).delete(c.registro_id);
        await db.conflitos.update(c.id, { resolvido_em: Date.now(), escolha: 'servidor' });
        return;
      }

      if (escolha === 'minha' && c.versao_local) {
        const dados = { ...(c.versao_local as Record<string, unknown>) };
        delete dados.atualizado_em;
        // Tem que ganhar do carimbo que está valendo, senão a volta seria
        // descartada pelo mesmo LWW — inclusive com o relógio do outro
        // aparelho adiantado.
        const doServidor = Number((c.versao_remota as { atualizado_em?: number } | null)?.atualizado_em ?? 0);
        escreverGanhandoDe(doServidor);
        await db.table(c.tabela).put(dados);
      }
      await db.conflitos.update(c.id, { resolvido_em: Date.now(), escolha });
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não consegui aplicar a sua versão.');
    } finally {
      setMexendo('');
    }
  };

  return (
    <JanelaBase titulo="O que foi substituído" icone={<GitMerge size={20} />} aoFechar={aoFechar} largura="640px">
        <p className="text-xs text-muted" style={{ marginBottom: '18px', lineHeight: 1.5 }}>
          Duas pessoas mexeram no mesmo registro. A versão de quem salvou por último
          ficou valendo, e a sua foi guardada aqui, neste aparelho.
        </p>

        {erro && (
          <div style={{ padding: '10px 12px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            {erro}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {conflitos.map(c => {
            const local = c.versao_local as Record<string, unknown>;
            const remota = c.versao_remota as Record<string, unknown> | null;
            return (
              <div key={c.id} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <div className="text-sm font-bold" style={{ marginBottom: '2px' }}>
                  {ROTULO[c.tabela] || c.tabela} · {comoChamar(c.tabela, remota || local)}
                </div>
                <div className="text-xs text-muted" style={{ marginBottom: '12px' }}>
                  {new Date(c.detectado_em).toLocaleString('pt-BR')}
                </div>

                {ehApagar(c) ? (
                  <p className="text-sm" style={{ margin: '0 0 14px', lineHeight: 1.5 }}>
                    {local
                      ? <>Outra pessoa <strong>apagou</strong> isto enquanto você editava. O registro continua aqui, com a sua edição — é a regra: editar ganha de apagar, e pergunta.</>
                      : <>Você apagou isto, e outra pessoa <strong>editou</strong> ao mesmo tempo. O registro voltou, com a edição dela.</>}
                  </p>
                ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {c.campos_em_disputa.length === 0 && (
                    <span className="text-sm text-muted">Nada em disputa além do carimbo de hora.</span>
                  )}
                  {c.campos_em_disputa.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) 1fr 1fr', gap: '8px' }}>
                      <span />
                      <span className="text-xs font-bold" style={{ color: 'var(--color-warning)' }}>a sua</span>
                      <span className="text-xs text-muted">a que está valendo</span>
                    </div>
                  )}
                  {c.campos_em_disputa.map(campo => (
                    <div key={campo} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) 1fr 1fr', gap: '8px', alignItems: 'baseline' }}>
                      <span className="text-xs text-muted">{nomeDoCampo(campo)}</span>
                      <span className="text-sm" style={{ color: 'var(--color-warning)' }}>{mostrar(local?.[campo], campo)}</span>
                      <span className="text-sm text-secondary">{mostrar(remota?.[campo], campo)}</span>
                    </div>
                  ))}
                </div>
                )}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {ehApagar(c) ? (
                    <>
                      <button className="btn btn-primary" disabled={mexendo === c.id} onClick={() => escolher(c, 'servidor')}>
                        <Check size={14} style={{ marginRight: '6px' }} /> Manter o registro
                      </button>
                      <button className="btn text-danger" disabled={mexendo === c.id} onClick={() => escolher(c, 'apagar')}>
                        <Trash2 size={14} style={{ marginRight: '6px' }} /> Apagar mesmo assim
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-primary" disabled={mexendo === c.id} onClick={() => escolher(c, 'minha')}>
                        Usar a minha de volta
                      </button>
                      <button className="btn" disabled={mexendo === c.id} onClick={() => escolher(c, 'servidor')}>
                        <Check size={14} style={{ marginRight: '6px' }} /> Manter a que está valendo
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
    </JanelaBase>
  );
}
