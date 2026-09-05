import { motion } from 'framer-motion';
import { GitCompare, FileText, AlertTriangle } from 'lucide-react';
import { MOLA, useMovimentoReduzido } from './ui/movimento';

/**
 * A pergunta que o app faz antes de reescrever as cenas de um projeto.
 *
 * POR QUE ELA EXISTE
 * Analisar um PDF novo pode significar duas coisas opostas, e o app não tem
 * como saber qual delas sozinho:
 *
 *   · é a v2 do MESMO roteiro — o caso comum. A cena 42 continua sendo a 42, e
 *     a ordem do stripboard, as estimativas e as diárias montadas têm que
 *     sobreviver;
 *   · é OUTRO roteiro — aí o stripboard é outro, e misturar as duas numerações
 *     produziria um filme que não existe.
 *
 * Errar para o lado da "versão nova" custa cenas atualizadas com o texto
 * errado; errar para o lado de "outro roteiro" custa a montagem inteira do
 * cronograma. Por isso a pergunta, e por isso ela vem com o número na frente.
 *
 * ⚠️ A SUGESTÃO É SUGESTÃO. O app compara quantos números de cena batem e já
 * deixa marcada a resposta provável, mas quem decide é quem está olhando: um
 * roteiro renumerado do zero continua sendo o mesmo filme, e nenhuma conta
 * percebe isso.
 */
export function EscolhaDeRoteiro({ batem, total, mesmaHistoria, aoEscolher, aoCancelar }: {
  /** Quantas cenas do PDF novo têm número que já existe no projeto. */
  batem: number;
  total: number;
  /** O que o app sugere: `true` = parece a mesma história. */
  mesmaHistoria: boolean;
  aoEscolher: (versaoNova: boolean) => void;
  aoCancelar: () => void;
}) {
  const reduzido = useMovimentoReduzido();

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={aoCancelar}
    >
      <motion.div
        initial={reduzido ? undefined : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        className="card"
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '460px', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <GitCompare size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h2 className="text-lg font-bold">Este roteiro é uma versão nova?</h2>
            <p className="text-sm text-secondary" style={{ lineHeight: 1.5, marginTop: '4px' }}>
              {batem > 0
                ? <><strong>{batem} das {total} cenas</strong> têm o mesmo número de cenas que já estão no projeto.</>
                : <>Nenhuma das <strong>{total} cenas</strong> tem número que já exista no projeto.</>}
            </p>
          </div>
        </div>

        <button
          onClick={() => aoEscolher(true)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
            padding: '14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
            border: `1px solid ${mesmaHistoria ? 'var(--accent)' : 'var(--border-light)'}`,
            backgroundColor: mesmaHistoria ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg-primary)',
          }}
        >
          <span className="font-bold text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={15} /> É uma versão nova do mesmo roteiro
            {mesmaHistoria && <span className="text-xs" style={{ color: 'var(--accent)' }}>· sugerido</span>}
          </span>
          <span className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
            A cena 42 continua sendo a 42, com o texto atualizado. A ordem do stripboard, as
            estimativas, o elenco marcado e as diárias já montadas ficam como estão. Cena que
            sumiu do roteiro sai da ordem sem ser apagada.
          </span>
        </button>

        <button
          onClick={() => aoEscolher(false)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
            padding: '14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
            border: `1px solid ${!mesmaHistoria ? 'var(--color-danger)' : 'var(--border-light)'}`,
            backgroundColor: !mesmaHistoria ? 'color-mix(in srgb, var(--color-danger) 10%, transparent)' : 'var(--bg-primary)',
          }}
        >
          <span className="font-bold text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={15} /> É outro roteiro
            {!mesmaHistoria && <span className="text-xs" style={{ color: 'var(--color-danger)' }}>· sugerido</span>}
          </span>
          <span className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
            Começa um stripboard novo, só com as cenas deste roteiro. As cenas do roteiro
            anterior continuam guardadas — e voltam se você reativar aquela versão —, mas saem
            desta ordem de filmagem.
          </span>
        </button>

        <button onClick={aoCancelar} className="text-sm text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-end', padding: '4px 8px' }}>
          Cancelar
        </button>
      </motion.div>
    </div>
  );
}
