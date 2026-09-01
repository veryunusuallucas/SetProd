import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenLine, Lock, Send, Archive, AlertTriangle, Undo2 } from 'lucide-react';
import type { Diaria } from '../types';
import {
  estadoDa, travarDiaria, despublicarDiaria, ROTULO_ESTADO, type EstadoDiaria,
} from '../lib/sincronizaOD';
import { MOLA, useMovimentoReduzido } from './ui/movimento';

/**
 * Em que ponto do ciclo a diária está, e como sair dele.
 *
 * POR QUE ISTO É UM COMPONENTE PRÓPRIO
 * O controle de estado morava dentro da faixa do stripboard — e essa faixa só
 * aparece quando a diária VEIO de uma quebra. Diária montada à mão não tinha
 * como ser publicada nem travada: o estado dela ficava em rascunho para sempre,
 * e com ele todo o ciclo da Parte 2 (congelar, registrar, fechar).
 *
 * Aqui o controle é da diária, não da origem dela.
 */

const ORDEM: EstadoDiaria[] = ['rascunho', 'travada', 'publicada'];

const DESCRICAO: Record<EstadoDiaria, string> = {
  rascunho: 'O plano está livre e acompanha o stripboard.',
  travada: 'Congelada para conferência. Ninguém de fora recebeu ainda.',
  publicada: 'A equipe está com esta OD na mão. O plano não muda mais.',
  fechada: 'O dia acabou e o relatório foi feito.',
};

const ICONE: Record<EstadoDiaria, typeof Lock> = {
  rascunho: PenLine,
  travada: Lock,
  publicada: Send,
  fechada: Archive,
};

export function EstadoDaDiaria({ diaria, podeMexer }: { diaria: Diaria; podeMexer: boolean }) {
  const reduzido = useMovimentoReduzido();
  const [confirmando, setConfirmando] = useState(false);
  const estado = estadoDa(diaria);

  // Fechada é um estado terminal, e quem reabre é o botão "Reabrir" do topo.
  // Oferecer os três aqui sugeriria que dá para voltar a rascunho sem passar
  // pelo relatório, e não dá.
  if (estado === 'fechada') return null;

  const Icone = ICONE[estado];

  const irPara = async (destino: EstadoDiaria) => {
    if (destino === estado) return;

    /*
      Sair de PUBLICADA é a única transição com confirmação.

      As outras são reversíveis sem consequência: travar e destravar não mudam
      nada fora do app. Despublicar muda — existe um PDF circulando que passa a
      mentir a partir do clique, e quem recebeu não é avisado por mágica.
    */
    if (estado === 'publicada' && destino !== 'publicada') {
      setConfirmando(true);
      return;
    }

    if (destino === 'travada') await travarDiaria(diaria.id);
    if (destino === 'rascunho') await despublicarDiaria(diaria.id);
    /*
      Publicar não é feito aqui: publicar é EXPORTAR, e exportar gera o
      documento. Um botão que publica sem gerar o papel produziria uma diária
      "publicada" que ninguém recebeu — o pior dos dois mundos.
    */
  };

  const confirmarVolta = async () => {
    await despublicarDiaria(diaria.id);
    setConfirmando(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div
          style={{ display: 'flex', gap: '2px', padding: '2px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
          {ORDEM.map(e => {
            const ativo = estado === e;
            const I = ICONE[e];
            /*
              "Publicada" não é clicável: chega-se nela exportando. Fica na
              régua mesmo assim porque é o que mostra onde a diária está no
              caminho — uma régua com o passo final escondido não é uma régua.
            */
            const clicavel = podeMexer && !ativo && e !== 'publicada';
            return (
              <button
                key={e}
                onClick={() => clicavel && irPara(e)}
                disabled={!clicavel}
                className="text-xs font-bold"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '5px 13px', borderRadius: 'var(--radius-full)', border: 'none',
                  cursor: clicavel ? 'pointer' : 'default',
                  backgroundColor: ativo ? 'var(--accent)' : 'transparent',
                  color: ativo ? '#000' : clicavel ? 'var(--text-secondary)' : 'var(--text-muted)',
                  opacity: !ativo && !clicavel ? 0.45 : 1,
                }}
                title={e === 'publicada' && !ativo
                  ? 'Publicar é exportar a OD — use o botão "Exportar e publicar"'
                  : DESCRICAO[e]}
              >
                <I size={12} /> {ROTULO_ESTADO[e]}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.5 }}>
          <Icone size={12} style={{ flexShrink: 0 }} /> {DESCRICAO[estado]}
        </span>
      </div>

      <AnimatePresence>
        {confirmando && (
          <motion.div
            initial={reduzido ? undefined : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={MOLA}
            className="card"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              borderLeft: '3px solid var(--color-danger)',
              backgroundColor: 'var(--color-danger-bg)',
            }}
          >
            <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-sm font-bold" style={{ color: 'var(--color-danger)' }}>
                Esta OD já pode estar circulando pela equipe
              </div>
              <div className="text-xs text-secondary" style={{ lineHeight: 1.6, marginTop: '4px' }}>
                A versão {diaria.versao_od || 1} foi exportada e pode estar impressa, no
                WhatsApp ou na caixa de entrada de todo mundo. Voltando para rascunho,
                esse papel passa a mentir — e ninguém é avisado disso sozinho.
                <br />
                <b>Depois de corrigir, exporte de novo</b>: a nova sai marcada v
                {(diaria.versao_od || 1) + 1}, e aí sim avise a equipe.
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button onClick={confirmarVolta} className="btn-primary text-xs" style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--color-danger)', border: 'none', color: '#fff' }}>
                  <Undo2 size={13} /> Voltar para rascunho mesmo assim
                </button>
                <button onClick={() => setConfirmando(false)} className="text-xs text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px' }}>
                  deixar como está
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
