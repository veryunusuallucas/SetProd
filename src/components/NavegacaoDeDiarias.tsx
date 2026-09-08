import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../db/db';
import { dataCurta } from '../lib/formato';

/**
 * Passar de uma diária para a outra sem voltar para a lista.
 *
 * De onde veio: um AD, depois de meia hora usando o app — *"seria dahora se eu
 * pudesse só apertar um botão ali em cima e passar da diária 1 para diária 2"*.
 * Ele estava montando várias ODs de uma vez, e cada troca custava duas telas:
 * voltar para Diárias e Eventos, achar a certa na lista, entrar.
 *
 * A ordem é a mesma da lista — por NÚMERO, que é a ordem cronológica depois da
 * renumeração por data. Seguir aqui uma ordem diferente da que ele acabou de
 * ver na lista faria "a próxima" apontar para um dia que não é o próximo.
 *
 * As setas somem nas pontas em vez de darem a volta: chegar na última diária e
 * cair na primeira é o tipo de salto que a pessoa só percebe depois de já ter
 * editado a diária errada.
 */
export function NavegacaoDeDiarias({ projetoId, diariaId }: { projetoId: string; diariaId: string }) {
  const navigate = useNavigate();

  const diarias = useLiveQuery(
    () => db.diarias.where('projeto_id').equals(projetoId).toArray(),
    [projetoId]
  );

  if (!diarias || diarias.length < 2) return null;

  const ordenadas = [...diarias].sort((a, b) => a.numero - b.numero);
  const atual = ordenadas.findIndex(d => d.id === diariaId);
  if (atual < 0) return null;

  const anterior = ordenadas[atual - 1];
  const proxima = ordenadas[atual + 1];

  const rotulo = (d: typeof ordenadas[number]) =>
    `Diária ${String(d.numero).padStart(2, '0')} · ${dataCurta(d.data)}`;

  const ir = (d?: typeof ordenadas[number]) =>
    d && navigate(`/projeto/${projetoId}/diaria/${d.id}`);

  const estilo = (ativo: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '30px', height: '30px', padding: 0,
    border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: ativo ? 'var(--text-secondary)' : 'var(--text-muted)',
    cursor: ativo ? 'pointer' : 'not-allowed',
    opacity: ativo ? 1 : 0.35,
  });

  return (
    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
      <button
        onClick={() => ir(anterior)}
        disabled={!anterior}
        style={estilo(Boolean(anterior))}
        title={anterior ? rotulo(anterior) : 'Esta é a primeira diária'}
        aria-label={anterior ? `Ir para a ${rotulo(anterior)}` : 'Esta é a primeira diária'}
      >
        <ChevronLeft size={17} />
      </button>
      <button
        onClick={() => ir(proxima)}
        disabled={!proxima}
        style={estilo(Boolean(proxima))}
        title={proxima ? rotulo(proxima) : 'Esta é a última diária'}
        aria-label={proxima ? `Ir para a ${rotulo(proxima)}` : 'Esta é a última diária'}
      >
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
