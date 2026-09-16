import { useState } from 'react';
import { db } from '../../db/db';
import type { StatusTake, Take } from '../../types';
import { BotaoTatil } from '../ui/BotaoTatil';
import { confirmar } from '../ui/Confirmacao';
import { Campo, MONO, Segmentado, estiloCampo } from './pecas';
import {
  ROTULO_DO_STATUS, alvosDaCascata, aplicarMudancas, editarTake, mudancasDaCascata,
  type CampoComCascata, type EdicaoDoTake,
} from '../../lib/logagem/takes';

const STATUS_EDITAVEIS: StatusTake[] = ['OK', 'NG', 'HERO', 'RECINV'];

const NOME_DO_CAMPO: Record<CampoComCascata, string> = { cena: 'a cena', plano: 'o plano', arquivo: 'o arquivo' };

/**
 * Corrigir um take já registrado.
 *
 * Só o que se corrige de verdade depois: o status (era NG, virou OK), a
 * claquete que foi batida errada, o arquivo que a câmera numerou diferente e a
 * observação. O setup da câmera fica — é a fotografia do momento do take.
 *
 * Mudar cena, plano ou arquivo PERGUNTA se a mudança vai para os takes
 * seguintes (ver `alvosDaCascata`). A resposta padrão é "só este": propagar
 * sem querer estraga quinze linhas de uma vez.
 */
export function EditarTake({ take, aoFechar }: { take: Take; aoFechar: () => void }) {
  const [status, setStatus] = useState<StatusTake>(take.status);
  const [cena, setCena] = useState(take.cena);
  const [plano, setPlano] = useState(take.plano);
  const [numero, setNumero] = useState(String(take.take || ''));
  const [arquivo, setArquivo] = useState(take.arquivo);
  const [obs, setObs] = useState(take.obs || '');
  const [gravando, setGravando] = useState(false);

  const opcoes = (take.status === 'IMPORT' ? [...STATUS_EDITAVEIS, 'IMPORT' as StatusTake] : STATUS_EDITAVEIS)
    .map(s => ({ id: s, nome: s === 'RECINV' ? 'REC inv.' : ROTULO_DO_STATUS[s] }));

  const salvar = async () => {
    if (gravando) return;
    const mudanca: EdicaoDoTake = {};
    const limpo = (v: string) => v.trim();
    if (status !== take.status) mudanca.status = status;
    if (limpo(cena) !== take.cena) mudanca.cena = limpo(cena);
    if (limpo(plano).toUpperCase() !== take.plano) mudanca.plano = limpo(plano).toUpperCase();
    const n = Number(numero);
    if (Number.isFinite(n) && n >= 0 && n !== take.take) mudanca.take = n;
    if (limpo(arquivo) !== take.arquivo) mudanca.arquivo = limpo(arquivo);
    if (limpo(obs) !== (take.obs || '')) mudanca.obs = limpo(obs);

    if (Object.keys(mudanca).length === 0) { aoFechar(); return; }

    setGravando(true);
    try {
      await editarTake(take.id, mudanca);
      const editado: Take = { ...take, ...mudanca };

      // Cena antes de plano: a cascata do plano procura "a mesma cena", e ela
      // precisa já ser a nova.
      for (const campo of ['cena', 'plano', 'arquivo'] as CampoComCascata[]) {
        if (mudanca[campo] === undefined) continue;
        const todos = await db.log_takes.where('diaria_id').equals(take.diaria_id).toArray();
        const antigo = String(take[campo] ?? '');
        const novo = String(mudanca[campo]);
        const alvos = alvosDaCascata(todos, editado, campo, antigo);
        if (alvos.length === 0) continue;

        const lista = mudancasDaCascata(campo, alvos, novo);
        const n = alvos.length;
        const detalhe = campo === 'arquivo'
          ? `Renumera em sequência: ${alvos[0].arquivo} vira ${lista[0].mudanca.arquivo}${n > 1 ? `, até ${alvos[n - 1].arquivo} virar ${lista[n - 1].mudanca.arquivo}` : ''}.`
          : `${n === 1 ? 'O take seguinte que estava' : `Os ${n} takes seguintes que estavam`} em ${campo === 'cena' ? 'cena' : 'plano'} ${antigo || '(vazio)'} ${n === 1 ? 'passa' : 'passam'} para ${novo || '(vazio)'}.`;

        const levar = await confirmar({
          titulo: `Levar ${NOME_DO_CAMPO[campo]} para ${n === 1 ? 'o take seguinte' : `os ${n} takes seguintes`}?`,
          detalhe,
          confirmar: n === 1 ? 'Levar para ele' : `Levar para os ${n}`,
          cancelar: 'Só este take',
        });
        if (levar) await aplicarMudancas(lista);
      }
      aoFechar();
    } finally {
      setGravando(false);
    }
  };

  const campoPequeno = { ...estiloCampo, fontVariantNumeric: 'tabular-nums' as const, textAlign: 'center' as const };

  return (
    <div
      role="group"
      aria-label="Corrigir take"
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}
    >
      <Campo rotulo="Status">
        <Segmentado nome={`editar-status-${take.id}`} opcoes={opcoes} valor={status} bloqueado={gravando} aoMudar={v => setStatus(v as StatusTake)} />
      </Campo>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          <span className="text-xs font-bold text-secondary">Cena</span>
          <input value={cena} onChange={e => setCena(e.target.value)} style={campoPequeno} inputMode="text" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          <span className="text-xs font-bold text-secondary">Plano</span>
          <input value={plano} onChange={e => setPlano(e.target.value)} style={{ ...campoPequeno, textTransform: 'uppercase' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          <span className="text-xs font-bold text-secondary">Take</span>
          <input value={numero} onChange={e => setNumero(e.target.value.replace(/\D/g, ''))} style={campoPequeno} inputMode="numeric" />
        </label>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span className="text-xs font-bold text-secondary">Arquivo</span>
        <input value={arquivo} onChange={e => setArquivo(e.target.value)} spellCheck={false} style={{ ...estiloCampo, fontFamily: MONO }} />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span className="text-xs font-bold text-secondary">Observação</span>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} style={{ ...estiloCampo, resize: 'vertical' }} />
      </label>

      <p className="text-xs text-muted" style={{ margin: 0 }}>
        Mudar a cena, o plano ou o arquivo pergunta se a mudança vale para os takes seguintes.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <BotaoTatil onClick={() => void salvar()} disabled={gravando} className="btn-primary" style={{ minHeight: '44px' }}>
          {gravando ? 'Salvando…' : 'Salvar'}
        </BotaoTatil>
        <BotaoTatil onClick={aoFechar} disabled={gravando} className="btn-secondary" style={{ minHeight: '44px' }}>
          Cancelar
        </BotaoTatil>
      </div>
    </div>
  );
}
