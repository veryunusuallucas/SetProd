import { GitCompare, FileText, AlertTriangle } from 'lucide-react';
import { Janela } from './ui/Janela';

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
  return (
    <Janela
      titulo="Este roteiro é uma versão nova?"
      icone={<GitCompare size={18} />}
      aoFechar={aoCancelar}
      largura="460px"
      rodape={
        <button onClick={aoCancelar} className="text-sm text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
          Cancelar
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p className="text-sm text-secondary" style={{ lineHeight: 1.5, margin: 0 }}>
          {batem > 0
            ? <><strong>{batem} das {total} cenas</strong> têm número que já existe no projeto.</>
            : <>Nenhuma das <strong>{total} cenas</strong> tem número que já exista no projeto.</>}
        </p>

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

      </div>
    </Janela>
  );
}
