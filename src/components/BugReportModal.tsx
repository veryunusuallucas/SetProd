import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, Lightbulb, HelpCircle, X, Send, Copy, CheckCircle2, FileText } from 'lucide-react';
import { db } from '../db/db';
import { supabase } from '../lib/supabase';
import { obterEventos, coletarAmbiente } from '../lib/diagnostico';
import { useAuth } from '../hooks/useAuth';
import { MOLA, useMovimentoReduzido } from './ui/movimento';
import { useOrigemAncorada } from './ui/origemAncorada';
import { BotaoTatil } from './ui/BotaoTatil';

interface Props {
  onClose: () => void;
  /**
   * A pergunta que a IA da ajuda não soube responder.
   *
   * Chega já escrita para a pessoa não ter que redigitar — quem acabou de não
   * ser atendido não deveria pagar o preço de repetir a dúvida.
   */
  descricaoInicial?: string;
  tipoInicial?: 'bug' | 'sugestao' | 'duvida';
}

type Tipo = 'bug' | 'sugestao' | 'duvida';

export function BugReportModal({ onClose, descricaoInicial = '', tipoInicial = 'bug' }: Props) {
  /*
    QUEM RELATOU — faltava, e a falta transformava relato bom em beco.

    "Não consegui salvar" sem saber de quem: não há como voltar e perguntar o
    que a pessoa estava fazendo, nem conferir o que ela vê.

    Vão o e-mail e o id da conta. O id importa junto porque e-mail muda, e é ele
    que casa com a linha de `projeto_membros` para descobrir o PAPEL de quem
    relatou — o que explica sozinho boa parte dos "não aparece nada para mim".

    No servidor há uma segunda captura, independente desta: a coluna `usuario_id`
    tem `default auth.uid()`, então o Postgres preenche mesmo que o app mande
    nada. Uma não substitui a outra — a do app traz o e-mail legível, a do banco
    não dá para forjar.
  */
  const { user } = useAuth();
  const reduzido = useMovimentoReduzido();
  const ancora = useOrigemAncorada();

  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [descricao, setDescricao] = useState(descricaoInicial);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  /** O relógio do fechamento automático, para poder cancelá-lo ao desmontar. */
  const fechamentoAutomatico = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (fechamentoAutomatico.current) clearTimeout(fechamentoAutomatico.current);
  }, []);

  const eventos = obterEventos();
  const qtdErros = eventos.filter(e => e.nivel !== 'warn').length;

  /** Monta o pacote que vai para o Supabase (e que dá para copiar à mão). */
  const montarPacote = async () => {
    const projetoId = window.location.pathname.match(/\/projeto\/([a-zA-Z0-9-]+)/)?.[1];

    const [projetos, perfis, despesas, acertos, diarias, tasks] = await Promise.all([
      db.projetos.count(), db.perfis.count(), db.despesas.count(),
      db.acertos.count(), db.diarias.count(), db.tasks.count(),
    ]);

    const ambiente = coletarAmbiente();

    return {
      tipo,
      descricao: descricao.trim(),
      url_atual: ambiente.url_completa,
      resolucao: ambiente.tela,
      user_agent: navigator.userAgent,
      erros_console: eventos,
      // A tabela não tem colunas para tudo isso, então vai dentro de `stats` (jsonb).
      stats: {
        ambiente,
        projeto_id: projetoId || null,
        papel: localStorage.getItem('mock_papel') || null,
        usuario: user ? { id: user.id, email: user.email ?? null } : null,
        perfil_id: localStorage.getItem('mock_perfil_id') || null,
        versao_app: `v${__VERSAO_APP__}`,
        banco: { projetos, perfis, despesas, acertos, diarias, tasks },
        resumo_log: {
          total: eventos.length,
          erros: eventos.filter(e => e.nivel === 'error').length,
          avisos: eventos.filter(e => e.nivel === 'warn').length,
          nao_tratados: eventos.filter(e => e.nivel === 'uncaught').length,
          promessas: eventos.filter(e => e.nivel === 'promise').length,
        },
      },
    };
  };

  const submitFeedback = async () => {
    if (!descricao.trim()) {
      setErro('Escreva alguma coisa antes de enviar.');
      return;
    }
    setErro('');
    setEnviando(true);

    try {
      const pacote = await montarPacote();
      const { error: supaError } = await supabase.from('bug_reports').insert([pacote]);

      if (supaError) {
        // Antes isso virava um console.warn e a tela dizia "registrado, obrigado!"
        // mesmo sem ter salvo nada. Agora o erro aparece e sobra a opção de copiar.
        setErro(
          `Não foi possível enviar: ${supaError.message}. ` +
          'Use "Copiar dados" e mande o texto direto para o Lucas.'
        );
        return;
      }

      setEnviado(true);

      /*
        O fechamento é automático, mas NÃO É UMA PRISÃO DE DOIS SEGUNDOS.

        Antes o `setTimeout` era a única saída: a pessoa lia "Enviei!", entendia
        na hora, e ficava presa olhando um modal que já tinha terminado.

        O ✕ continua funcionando o tempo todo; o relógio abaixo só cuida de quem
        não fez nada. E ele é cancelado ao desmontar, senão `onClose` dispararia
        depois de o modal já ter saído.

        Clique fora este modal não tem, e é de propósito: ele guarda um texto
        digitado, e fechar sem querer custaria o relato inteiro.
      */
      fechamentoAutomatico.current = setTimeout(onClose, 2000);
    } catch (e: any) {
      setErro('Erro ao processar: ' + (e?.message || e));
    } finally {
      setEnviando(false);
    }
  };

  /** Plano B: leva tudo para a área de transferência, com ou sem Supabase. */
  const copiarDados = async () => {
    const pacote = await montarPacote();
    await navigator.clipboard.writeText(JSON.stringify(pacote, null, 2));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const TIPOS: { id: Tipo; icone: React.ReactNode; nome: string; ajuda: string }[] = [
    { id: 'bug', icone: <Bug size={18} />, nome: 'Bug', ajuda: 'Quebrou' },
    { id: 'sugestao', icone: <Lightbulb size={18} />, nome: 'Sugestão', ajuda: 'Uma ideia' },
    { id: 'duvida', icone: <HelpCircle size={18} />, nome: 'Dúvida', ajuda: 'Não entendi' },
  ];

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3200, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        ref={ancora}
        className="card"
        style={{
          width: '100%', maxWidth: '460px', maxHeight: '88vh',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bug size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <h2 className="text-lg font-bold" style={{ margin: 0, flex: 1 }}>Falar com o Viol</h2>
          <button onClick={onClose} className="btn-icon" aria-label="Fechar" style={{ flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/*
            O QUE É vem antes de DESCREVA, e não depois.

            A escolha muda o que a pessoa escreve: quem marca "dúvida" pergunta,
            quem marca "bug" conta o que aconteceu. Pedir o texto primeiro e
            classificar depois faz a pessoa reescrever.
          */}
          <div>
            <div className="text-xs text-muted uppercase tracking-widest font-bold" style={{ marginBottom: '8px' }}>O que é</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {TIPOS.map(t => {
                const ativo = tipo === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTipo(t.id)}
                    style={{
                      flex: 1, padding: '12px 6px', borderRadius: '12px', cursor: 'pointer',
                      border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border-light)'}`,
                      backgroundColor: ativo ? 'var(--bg-active)' : 'transparent',
                      color: ativo ? 'var(--accent)' : 'var(--text-muted)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                    }}
                  >
                    {t.icone}
                    <span style={{ fontSize: '12px', fontWeight: ativo ? 700 : 600 }}>{t.nome}</span>
                    <span style={{ fontSize: '10px', lineHeight: 1.2, color: 'var(--text-muted)' }}>{t.ajuda}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            {/* O rótulo muda com o tipo: "Descrição" serve para os três e não
                ajuda em nenhum. */}
            <div className="text-xs text-muted uppercase tracking-widest font-bold" style={{ marginBottom: '8px' }}>
              {tipo === 'duvida' ? 'Sua pergunta' : tipo === 'sugestao' ? 'Sua ideia' : 'O que aconteceu'}
            </div>
            <textarea
              autoFocus
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={4}
              placeholder={
                tipo === 'duvida'
                  ? 'Ex: como faço para a outra equipe ver a produção?'
                  : tipo === 'sugestao'
                    ? 'Ex: seria bom poder duplicar uma diária inteira'
                    : 'Ex: cliquei em salvar a despesa e a tela ficou parada'
              }
              style={{ width: '100%', resize: 'vertical', minHeight: '92px' }}
            />
          </div>

          {/*
            O QUE VAI JUNTO, escrito de forma legível.

            Mandar diagnóstico sem dizer o que é seria coletar às escondidas. E
            dizer também poupa trabalho de quem relata: lendo "vai a tela onde
            você está", a pessoa entende que não precisa descrever o caminho.
          */}
          <div style={{ borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', padding: '12px 14px' }}>
            <div className="text-xs text-muted uppercase tracking-widest font-bold" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={12} /> Vai junto
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <Etiqueta texto={window.location.pathname.split('/').pop() || 'início'} titulo={window.location.pathname} />
              <Etiqueta texto={`v${__VERSAO_APP__}`} />
              <Etiqueta texto="navegador e tela" />
              {user?.email && <Etiqueta texto={user.email} />}
              <Etiqueta
                texto={eventos.length === 0 ? 'log limpo' : `${eventos.length} evento(s)`}
                cor={qtdErros > 0 ? 'var(--color-warning)' : undefined}
              />
            </div>

            {eventos.length > 0 && (
              <details style={{ marginTop: '10px' }}>
                <summary className="text-xs" style={{ cursor: 'pointer', color: 'var(--accent)' }}>
                  ver os últimos erros
                </summary>
                <div style={{ maxHeight: '120px', overflowY: 'auto', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {eventos.slice(-6).reverse().map((ev, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: '10px', fontFamily: 'monospace', wordBreak: 'break-word',
                        color: ev.nivel === 'warn' ? 'var(--text-muted)' : 'var(--color-danger)',
                      }}
                    >
                      [{ev.nivel}] {ev.mensagem.slice(0, 160)}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <AnimatePresence>
            {erro && (
              <motion.div
                initial={reduzido ? { opacity: 0 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm"
                style={{ color: 'var(--color-danger)', lineHeight: 1.5 }}
              >
                {erro}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)' }}>
          <AnimatePresence mode="wait">
            {enviado ? (
              /* O sucesso OCUPA o rodapé em vez de virar mais uma linha acima
                 dele: a pessoa terminou, e o que ela precisa ver agora não é o
                 botão de enviar de novo. */
              <motion.div
                key="ok"
                initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={MOLA}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px 0', color: 'var(--color-success)' }}
              >
                <CheckCircle2 size={18} />
                <span className="text-sm font-bold">Enviei! Vai trabalhar, seu bosta!</span>
              </motion.div>
            ) : (
              <motion.div key="acoes" className="acoes-form" exit={{ opacity: 0 }}>
                <BotaoTatil onClick={copiarDados} className="btn-secondary">
                  {copiado ? <><CheckCircle2 size={15} /> Copiado</> : <><Copy size={15} /> Copiar dados</>}
                </BotaoTatil>
                <BotaoTatil
                  onClick={submitFeedback}
                  disabled={enviando || !descricao.trim()}
                  className="btn-primary"
                  style={{ cursor: enviando ? 'wait' : undefined }}
                >
                  <Send size={15} /> {enviando ? 'Enviando…' : 'Enviar'}
                </BotaoTatil>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

/** Um pedaço do que será enviado, dito de forma que dê para ler. */
function Etiqueta({ texto, titulo, cor }: { texto: string; titulo?: string; cor?: string }) {
  return (
    <span
      title={titulo}
      className="text-xs"
      style={{
        padding: '3px 9px', borderRadius: '20px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        color: cor || 'var(--text-muted)',
        whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
      }}
    >
      {texto}
    </span>
  );
}
