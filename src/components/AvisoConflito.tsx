import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GitMerge, X } from 'lucide-react';
import { EVENTO_CONFLITO, type Conflito } from '../lib/sincronizacao';
import { MOLA, MOLA_GESTO, useMovimentoReduzido } from './ui/ia';

/**
 * "Outra equipe alterou isto enquanto você editava."
 *
 * O espelho guarda a linha inteira, então quem grava por último leva tudo. Duas
 * pessoas na mesma diária — uma no transporte, outra nos horários — e uma das
 * duas perde o trabalho inteiro. Isto não conserta o problema; conserta o pior
 * dele, que é acontecer sem ninguém ver. A pessoa via o próprio texto mudar
 * sozinho na tela e achava que o app tinha bugado.
 *
 * O tratamento de verdade (merge por campo) é a §10.A do ROADMAP.
 */

/** Quanto tempo o aviso fica antes de sair sozinho. */
const DURACAO_MS = 9_000;

/**
 * Quantos avisos ao mesmo tempo.
 *
 * Uma sincronização de reconexão pode trazer dezenas de linhas de uma vez. Vinte
 * cartões empilhados não informam nada e ainda cobrem a tela — três, e o resto
 * vira contagem.
 */
const MAXIMO = 3;

/** Nome de tabela → o que a pessoa chama aquilo. */
const NOMES: Record<string, string> = {
  projetos: 'a produção',
  perfis: 'uma ficha da equipe',
  departamentos: 'um departamento',
  despesas: 'uma despesa',
  aportes: 'um aporte',
  acertos: 'um acerto',
  diarias: 'uma diária',
  diaria_tasks: 'uma tarefa da diária',
  tasks: 'uma tarefa',
  cenas: 'uma cena',
  locacoes: 'uma locação',
  elementos: 'um elemento de cena',
  documentos: 'um documento',
  veiculos: 'um veículo',
  motoristas: 'um motorista',
  roteiro_tags: 'uma marcação do roteiro',
  stripboard_itens: 'o stripboard',
  configuracoes: 'as configurações',
  notificacoes: 'uma notificação',
  pesquisas: 'uma pesquisa',
  respostas_pesquisa: 'uma resposta de pesquisa',
};

const comoSeChama = (tabela: string) => NOMES[tabela] || 'um registro';

interface Aviso {
  chave: string;
  texto: string;
}

export function AvisoConflito({ projetoId }: { projetoId?: string }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [engolidos, setEngolidos] = useState(0);
  const reduzido = useMovimentoReduzido();

  useEffect(() => {
    const aoConflitar = (e: Event) => {
      const lista = (e as CustomEvent<Conflito[]>).detail || [];
      // Só o que é da produção aberta: avisar sobre outra que a pessoa nem está
      // olhando é ruído puro.
      const meus = projetoId ? lista.filter(c => c.projeto_id === projetoId) : lista;
      if (!meus.length) return;

      // Um aviso por TIPO de coisa, não por linha. Reescalar dez pessoas de uma
      // diária dispara dez conflitos da mesma tabela, e dez cartões dizendo a
      // mesma frase não acrescentam nada ao primeiro.
      const porTabela = [...new Set(meus.map(c => c.tabela))];

      setAvisos(atuais => {
        const novos = porTabela
          .filter(t => !atuais.some(a => a.chave.startsWith(`${t}:`)))
          .map(t => ({ chave: `${t}:${Date.now()}`, texto: comoSeChama(t) }));

        const juntos = [...atuais, ...novos];
        if (juntos.length > MAXIMO) {
          setEngolidos(n => n + juntos.length - MAXIMO);
          return juntos.slice(-MAXIMO);
        }
        return juntos;
      });
    };

    window.addEventListener(EVENTO_CONFLITO, aoConflitar);
    return () => window.removeEventListener(EVENTO_CONFLITO, aoConflitar);
  }, [projetoId]);

  // Cada aviso se despede sozinho. Um relógio por aviso, e não um só para a
  // pilha, senão o último a chegar herdaria o tempo já gasto pelo primeiro.
  useEffect(() => {
    if (!avisos.length) return;
    const relogio = window.setTimeout(() => {
      setAvisos(atuais => atuais.slice(1));
      setEngolidos(0);
    }, DURACAO_MS);
    return () => window.clearTimeout(relogio);
  }, [avisos]);

  const fechar = (chave: string) => setAvisos(atuais => atuais.filter(a => a.chave !== chave));

  // Canto inferior esquerdo: o superior direito é do aviso do J. Martins, e o
  // rodapé do sync fica na barra lateral. Aqui não briga com nenhum dos dois.
  return createPortal(
    <div style={{
      position: 'fixed', bottom: '20px', left: '20px', zIndex: 3900,
      display: 'flex', flexDirection: 'column', gap: '10px',
      width: 'min(320px, calc(100vw - 40px))', pointerEvents: 'none',
    }}>
      <AnimatePresence initial={false}>
        {avisos.map(aviso => (
          <motion.div
            key={aviso.chave}
            layout={!reduzido}
            initial={reduzido ? { opacity: 0 } : { opacity: 0, x: -30, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduzido ? { opacity: 0 } : { opacity: 0, x: -20, scale: 0.98 }}
            transition={MOLA}
            style={{
              pointerEvents: 'auto',
              borderRadius: '14px', overflow: 'hidden',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '13px 12px 13px 14px',
            }}
          >
            <GitMerge size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.45, color: 'var(--text-primary)' }}>
                Outra equipe alterou <strong>{aviso.texto}</strong> enquanto você editava.
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                A versão do servidor ficou. Confira antes de continuar.
              </p>
            </div>

            <motion.button
              onClick={() => fechar(aviso.chave)}
              aria-label="Fechar aviso"
              whileTap={reduzido ? undefined : { scale: 0.9, transition: MOLA_GESTO }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', padding: '2px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={14} />
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>

      {engolidos > 0 && (
        <span style={{
          pointerEvents: 'none', fontSize: '11px', color: 'var(--text-secondary)',
          paddingLeft: '4px',
        }}>
          e mais {engolidos} alteração(ões) de fora
        </span>
      )}
    </div>,
    document.body
  );
}
