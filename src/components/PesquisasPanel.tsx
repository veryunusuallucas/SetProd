import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Plus, Link2, RefreshCw, Trash2, ChevronDown, ChevronRight,
  Lock, Unlock, GripVertical,
} from 'lucide-react';
import { db } from '../db/db';
import type { Pesquisa, Pergunta, TipoPergunta } from '../types';
import {
  publicarPesquisa, puxarRespostas, apurar, resumirParaIA, recomendacaoDesatualizada,
  apagarPesquisaPublica, type ApuracaoPergunta,
} from '../lib/pesquisas';
import { recomendarPesquisa } from '../lib/gemini';
import { linkDoApp } from '../lib/urlPublica';
import { AIButton } from './ui/AIButton';
import { AIRecommendation, MOLA, useMovimentoReduzido } from './ui/ia';

const TIPOS: { id: TipoPergunta; rotulo: string; temOpcoes: boolean }[] = [
  { id: 'escolha_unica', rotulo: 'Escolha uma', temOpcoes: true },
  { id: 'escolha_multipla', rotulo: 'Escolha várias', temOpcoes: true },
  { id: 'sim_nao', rotulo: 'Sim ou não', temOpcoes: false },
  { id: 'texto', rotulo: 'Texto livre', temOpcoes: false },
];

/**
 * Pesquisas: criar, mandar o link e ler o resultado.
 *
 * Fica em Produção, e não junto da Equipe, porque ler resultado é atividade de
 * decisão — coisa que o produtor faz sentado, não no corre do cadastro.
 */
export function PesquisasPanel({ projetoId }: { projetoId: string }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [editando, setEditando] = useState<Pesquisa | null>(null);
  const [aviso, setAviso] = useState('');
  const [sincronizando, setSincronizando] = useState(false);

  const pesquisas = useLiveQuery(
    () => db.pesquisas.where('projeto_id').equals(projetoId).toArray(), [projetoId]
  ) || [];
  const respostas = useLiveQuery(
    () => db.respostas_pesquisa.where('projeto_id').equals(projetoId).toArray(), [projetoId]
  ) || [];

  const criar = () => {
    setEditando({
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      titulo: '',
      descricao: '',
      perguntas: [novaPergunta()],
      aberta: true,
      data_criacao: Date.now(),
    });
  };

  const atualizar = async () => {
    setSincronizando(true);
    setAviso('');
    try {
      const novas = await puxarRespostas(projetoId);
      setAviso(novas > 0 ? `${novas} resposta(s) nova(s).` : 'Nenhuma resposta nova.');
    } catch (e: any) {
      setAviso('Não foi possível buscar as respostas: ' + (e?.message || e));
    } finally {
      setSincronizando(false);
    }
  };

  const copiarLink = async (p: Pesquisa) => {
    try {
      await publicarPesquisa(p);
      const url = linkDoApp(`pesquisa/${p.id}`);
      await navigator.clipboard.writeText(url);
      setAviso('Link copiado. Mande para a equipe.');
    } catch (e: any) {
      setAviso('Não foi possível publicar: ' + (e?.message || e));
    }
  };

  const alternarAberta = async (p: Pesquisa) => {
    const nova = { ...p, aberta: !p.aberta };
    await db.pesquisas.put(nova);
    try { await publicarPesquisa(nova); } catch { /* o estado local já vale */ }
  };

  const apagar = async (p: Pesquisa) => {
    const quantas = respostas.filter(r => r.pesquisa_id === p.id).length;
    const aviso = `Apagar "${p.titulo}"?\n\n`
      + `O link para de funcionar para todo mundo`
      + (quantas ? ` e ${quantas} resposta(s) serão perdidas.` : '.');
    if (!confirm(aviso)) return;

    setAviso('');
    try {
      // O servidor primeiro. Se der errado, a pesquisa continua na sua tela —
      // que é o certo: apagar aqui e falhar lá deixaria o link no ar sem você
      // ter como voltar nele.
      await apagarPesquisaPublica(p.id);
    } catch (e: any) {
      setAviso(`Não apaguei: ${e?.message || e}`);
      return;
    }

    await db.pesquisas.delete(p.id);
    const daPesquisa = respostas.filter(r => r.pesquisa_id === p.id);
    await db.respostas_pesquisa.bulkDelete(daPesquisa.map(r => r.id));
  };

  if (editando) {
    return (
      <EditorPesquisa
        pesquisa={editando}
        onCancelar={() => setEditando(null)}
        onSalvar={async p => {
          await db.pesquisas.put(p);
          setEditando(null);
          try {
            await publicarPesquisa(p);
            setAviso('Pesquisa salva e publicada. Copie o link para enviar.');
          } catch (e: any) {
            setAviso('Salva no app, mas não publicada: ' + (e?.message || e));
          }
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 className="text-lg font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={18} /> Pesquisas
          </h3>
          <p className="text-xs text-secondary">
            Pergunte qualquer coisa à equipe por link — janta, tamanho de camiseta, o que for.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={atualizar} className="btn-chip" disabled={sincronizando}>
            <RefreshCw size={14} /> {sincronizando ? 'Buscando...' : 'Atualizar'}
          </button>
          <button onClick={criar} className="btn-chip">
            <Plus size={14} /> Nova pesquisa
          </button>
        </div>
      </div>

      <AnimatePresence>
        {aviso && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card" style={{ padding: '10px 14px', display: 'flex', gap: '10px', alignItems: 'center' }}
          >
            <span className="text-sm" style={{ flex: 1 }}>{aviso}</span>
            <button onClick={() => setAviso('')} className="btn-icon" style={{ padding: '4px' }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {pesquisas.length === 0 && (
        <div className="card text-muted text-center" style={{ padding: '32px 16px' }}>
          Nenhuma pesquisa ainda. Crie uma e mande o link para a equipe.
        </div>
      )}

      {[...pesquisas].sort((a, b) => b.data_criacao - a.data_criacao).map(p => {
        const daPesquisa = respostas.filter(r => r.pesquisa_id === p.id);
        const expandida = aberta === p.id;

        return (
          <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setAberta(expandida ? null : p.id)}
                style={{ flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left' }}
              >
                {expandida ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="font-bold">{p.titulo || '(sem título)'}</span>
                <span className="text-xs text-muted">
                  {daPesquisa.length} resposta(s) · {p.perguntas.length} pergunta(s)
                </span>
                {!p.aberta && <span className="text-xs text-muted">· encerrada</span>}
              </button>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => copiarLink(p)} className="btn-chip"><Link2 size={13} /> Link</button>
                <button onClick={() => setEditando(p)} className="btn-chip">Editar</button>
                <button onClick={() => alternarAberta(p)} className="btn-chip">
                  {p.aberta ? <><Lock size={13} /> Encerrar</> : <><Unlock size={13} /> Reabrir</>}
                </button>
                <button onClick={() => apagar(p)} className="btn-chip is-danger"><Trash2 size={13} /></button>
              </div>
            </div>

            {expandida && (
              <Resultado
                pesquisa={p}
                apuracao={apurar(p, daPesquisa)}
                totalRespostas={daPesquisa.length}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Resultado ----

function Resultado({ pesquisa, apuracao, totalRespostas }: {
  pesquisa: Pesquisa;
  apuracao: ApuracaoPergunta[];
  totalRespostas: number;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  const desatualizada = recomendacaoDesatualizada(pesquisa, totalRespostas);

  const pedirRecomendacao = async () => {
    setGerando(true);
    setErro('');
    try {
      const texto = await recomendarPesquisa(resumirParaIA(pesquisa, apuracao));
      await db.pesquisas.update(pesquisa.id, {
        recomendacao: texto,
        recomendacao_em: Date.now(),
        recomendacao_respostas: totalRespostas,
      });
    } catch (e: any) {
      setErro(e?.message || String(e));
    } finally {
      setGerando(false);
    }
  };

  if (totalRespostas === 0) {
    return (
      <div className="text-sm text-muted" style={{ paddingLeft: '24px' }}>
        Ninguém respondeu ainda. Copie o link e mande para a equipe — depois clique em Atualizar.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '24px' }}
    >
      {apuracao.map(a => <GraficoPergunta key={a.pergunta.id} apuracao={a} />)}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {pesquisa.recomendacao && !gerando && (
          <AIRecommendation>
            {pesquisa.recomendacao}
            {desatualizada && (
              <div className="text-xs text-muted" style={{ marginTop: '8px' }}>
                Chegaram respostas novas depois desta análise.
              </div>
            )}
          </AIRecommendation>
        )}

        {gerando && <AIRecommendation carregando textoCarregando="Lendo os votos e as restrições...">{null}</AIRecommendation>}

        {erro && <span className="text-sm text-danger">{erro}</span>}

        {(!pesquisa.recomendacao || desatualizada) && !gerando && (
          <div>
            <AIButton onClick={pedirRecomendacao} loading={gerando}>
              {pesquisa.recomendacao ? 'Analisar de novo' : 'Pedir recomendação à IA'}
            </AIButton>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function GraficoPergunta({ apuracao }: { apuracao: ApuracaoPergunta }) {
  const reduzido = useMovimentoReduzido();
  const { pergunta, contagens, textos, empate, totalRespostas } = apuracao;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span className="text-sm font-bold">
        {pergunta.texto}
        <span className="text-xs text-muted"> · {totalRespostas} resposta(s)</span>
        {empate && <span className="text-xs" style={{ color: 'var(--color-warning)' }}> · empate</span>}
      </span>

      {contagens && contagens.map((c, i) => (
        <div key={c.opcao} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="text-xs" style={{ width: '120px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.opcao}
          </span>
          <div style={{ flex: 1, height: '18px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div
              initial={reduzido ? { opacity: 0 } : { width: 0 }}
              animate={reduzido ? { opacity: 1, width: `${c.pct}%` } : { width: `${c.pct}%` }}
              // A barra cresce escalonada, na mesma cadência das sugestões de IA.
              transition={{ ...MOLA, delay: reduzido ? 0 : i * 0.05 }}
              style={{
                height: '100%',
                background: i === 0 && !empate
                  ? 'linear-gradient(90deg, #9d4edd, #4cc9f0)'
                  : 'var(--border-color)',
              }}
            />
          </div>
          <span className="text-xs font-bold" style={{ width: '54px', textAlign: 'right', flexShrink: 0 }}>
            {c.votos} · {c.pct}%
          </span>
        </div>
      ))}

      {textos && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {textos.map((t, i) => (
            <div key={i} className="text-sm" style={{ padding: '6px 10px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px' }}>
              {t.nome && <strong className="text-xs text-muted">{t.nome}: </strong>}
              {t.valor}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Editor ----

function novaPergunta(): Pergunta {
  return { id: crypto.randomUUID(), texto: '', tipo: 'escolha_unica', opcoes: ['', ''] };
}

function EditorPesquisa({ pesquisa, onSalvar, onCancelar }: {
  pesquisa: Pesquisa;
  onSalvar: (p: Pesquisa) => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState<Pesquisa>(pesquisa);
  const [erro, setErro] = useState('');

  const mudarPergunta = (id: string, mudanca: Partial<Pergunta>) =>
    setForm(f => ({ ...f, perguntas: f.perguntas.map(p => p.id === id ? { ...p, ...mudanca } : p) }));

  const salvar = () => {
    if (!form.titulo.trim()) return setErro('Dê um título à pesquisa.');
    const semTexto = form.perguntas.find(p => !p.texto.trim());
    if (semTexto) return setErro('Toda pergunta precisa de um enunciado.');

    const semOpcoes = form.perguntas.find(p =>
      (p.tipo === 'escolha_unica' || p.tipo === 'escolha_multipla') &&
      (p.opcoes || []).filter(o => o.trim()).length < 2
    );
    if (semOpcoes) return setErro(`"${semOpcoes.texto}" precisa de pelo menos duas opções.`);

    // Opções em branco entram no formulário público como botão vazio.
    onSalvar({
      ...form,
      perguntas: form.perguntas.map(p => ({ ...p, opcoes: (p.opcoes || []).filter(o => o.trim()) })),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 className="text-lg font-bold">{pesquisa.titulo ? 'Editar pesquisa' : 'Nova pesquisa'}</h3>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label className="text-xs text-secondary font-bold uppercase tracking-widest">Título</label>
          <input
            value={form.titulo}
            onChange={e => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex: O que vamos jantar na diária 3?"
            style={{ marginTop: '6px' }}
          />
        </div>
        <div>
          <label className="text-xs text-secondary font-bold uppercase tracking-widest">Explicação (opcional)</label>
          <textarea
            value={form.descricao || ''}
            onChange={e => setForm({ ...form, descricao: e.target.value })}
            rows={2}
            placeholder="Aparece embaixo do título, no link"
            style={{ marginTop: '6px' }}
          />
        </div>
      </div>

      {form.perguntas.map((p, i) => {
        const tipo = TIPOS.find(t => t.id === p.tipo)!;
        return (
          <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <GripVertical size={15} className="text-muted" />
              <span className="text-xs text-muted font-bold">PERGUNTA {i + 1}</span>
              {form.perguntas.length > 1 && (
                <button
                  onClick={() => setForm(f => ({ ...f, perguntas: f.perguntas.filter(x => x.id !== p.id) }))}
                  className="btn-chip is-danger"
                  style={{ marginLeft: 'auto' }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <input
              value={p.texto}
              onChange={e => mudarPergunta(p.id, { texto: e.target.value })}
              placeholder="O que você quer perguntar?"
            />

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {TIPOS.map(t => (
                <button
                  key={t.id}
                  onClick={() => mudarPergunta(p.id, { tipo: t.id })}
                  className="btn-chip"
                  style={p.tipo === t.id ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                >
                  {t.rotulo}
                </button>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginLeft: 'auto', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!p.obrigatoria}
                  onChange={e => mudarPergunta(p.id, { obrigatoria: e.target.checked })}
                  style={{ width: '15px', height: '15px', accentColor: 'var(--accent)' }}
                />
                Obrigatória
              </label>
            </div>

            {tipo.temOpcoes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(p.opcoes || []).map((o, j) => (
                  <div key={j} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={o}
                      onChange={e => {
                        const opcoes = [...(p.opcoes || [])];
                        opcoes[j] = e.target.value;
                        mudarPergunta(p.id, { opcoes });
                      }}
                      placeholder={`Opção ${j + 1}`}
                    />
                    <button
                      onClick={() => mudarPergunta(p.id, { opcoes: (p.opcoes || []).filter((_, k) => k !== j) })}
                      className="btn-chip"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => mudarPergunta(p.id, { opcoes: [...(p.opcoes || []), ''] })}
                  className="btn-chip"
                  style={{ alignSelf: 'flex-start' }}
                >
                  <Plus size={13} /> Opção
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={() => setForm(f => ({ ...f, perguntas: [...f.perguntas, novaPergunta()] }))}
        className="btn-chip"
        style={{ alignSelf: 'flex-start' }}
      >
        <Plus size={14} /> Outra pergunta
      </button>

      {erro && <span className="text-sm text-danger">{erro}</span>}

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={onCancelar} className="btn-chip" style={{ flex: 1, padding: '12px' }}>Cancelar</button>
        <button onClick={salvar} className="btn-primary" style={{ flex: 2 }}>Salvar e publicar</button>
      </div>
    </div>
  );
}
