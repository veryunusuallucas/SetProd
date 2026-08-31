import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Archive, X, AlertTriangle, Check, CircleDashed, CircleSlash, Scissors } from 'lucide-react';
import { oitavosParaPaginas } from '../lib/decupagem';
import { marcarCena, relatorioDoDia, ROTULO, MOTIVOS } from '../lib/registroSet';
import { db } from '../db/db';
import { MOLA } from './ui/ia';
import type { Cena, RegistroCena, StatusCena } from '../types';

/**
 * Fechar a diária deixa de ser só arquivar.
 *
 * O nome disto na indústria é Daily Production Report — no Brasil, relatório de
 * produção, preenchido no wrap pelo 1º AD ou pela continuísta. É o documento que
 * fecha o ciclo: o stripboard planeja, a Ordem do Dia manda para o set, e o
 * relatório diz o que de fato saiu. Sem ele o app só sabe planejar.
 *
 * A tela SUGERE a partir do que foi marcado durante o dia e pede confirmação.
 * O que ela não faz é assumir: cena escalada que ninguém marcou aparece
 * destacada, porque "não marcou" e "não gravou" são coisas diferentes — e
 * tratar uma como a outra encheria a fila de repescagem de cena que talvez
 * tenha sido gravada e ninguém anotou.
 */

interface Props {
  numero: number;
  projetoId: string;
  diariaId: string;
  cenas: Cena[];
  registros: RegistroCena[];
  meuPerfilId?: string;
  aoFechar: (notas: string) => void;
  aoCancelar: () => void;
}

const ICONE: Record<StatusCena, React.ReactNode> = {
  gravada: <Check size={14} />,
  parcial: <CircleDashed size={14} />,
  nao_gravada: <CircleSlash size={14} />,
  cortada: <Scissors size={14} />,
};

export function FechamentoDiaria({
  numero, projetoId, diariaId, cenas, registros, meuPerfilId, aoFechar, aoCancelar,
}: Props) {
  const [notas, setNotas] = useState('');
  const [fechando, setFechando] = useState(false);

  const r = relatorioDoDia(cenas, registros);

  /**
   * O que ficou para trás e ainda não tem motivo.
   *
   * ⚠️ O MOTIVO É OBRIGATÓRIO, E ESTE É O ÚNICO CAMPO DO APP QUE TRANCA UM BOTÃO.
   *
   * "Cena 12 não gravada" não serve para decidir nada — a decisão seguinte
   * depende do porquê: chuva reagenda para o mesmo set, elenco reagenda para a
   * agenda da pessoa, tempo significa que o dia foi mal dimensionado. Sem o
   * motivo, a repescagem vira uma lista de dívidas sem explicação, e daqui a
   * duas semanas ninguém lembra.
   *
   * É também o campo em que a indústria insiste no DPR, e pela mesma razão.
   */
  const semMotivo = [...r.naoGravadas, ...r.parciais].filter(cena => {
    const reg = registros.find(x => x.cena_id === cena.id);
    return !reg?.motivo;
  });
  const cumprimento = r.oitavosPrevistos > 0
    ? Math.round((r.oitavosGravados / r.oitavosPrevistos) * 100)
    : null;

  /** Resolve uma cena que ficou sem marcação, ali mesmo. */
  const resolver = async (cenaId: string, status: StatusCena) => {
    await marcarCena(projetoId, diariaId, cenaId, status, { registrado_por: meuPerfilId });
  };

  /** Grava o porquê na marcação que já existe. */
  const definirMotivo = async (cenaId: string, motivo: string) => {
    const atual = registros.find(x => x.cena_id === cenaId);
    if (atual) await db.registros_cena.update(atual.id, { motivo });
  };

  const confirmar = async () => {
    if (semMotivo.length > 0) return;
    setFechando(true);
    aoFechar(notas.trim());
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 250, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={aoCancelar}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '540px', maxHeight: '88vh', overflowY: 'auto',
          backgroundColor: 'var(--bg-surface)', borderRadius: '16px',
          border: '1px solid var(--border-color)', padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
          <div style={{ flex: 1 }}>
            <h2 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Archive size={20} /> Fechar a Diária {String(numero).padStart(2, '0')}
            </h2>
            <p className="text-sm text-muted" style={{ marginTop: '4px', lineHeight: 1.5 }}>
              Confira o que saiu hoje. O que ficou para trás vai para a fila de
              repescagem e pode ser reencaixado em outro dia.
            </p>
          </div>
          <button className="btn-icon" onClick={aoCancelar} aria-label="Cancelar"><X size={20} /></button>
        </div>

        {/* ---- números do dia ---- */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <Numero rotulo="Gravadas" valor={`${r.gravadas.length}`} />
          <Numero rotulo="Parciais" valor={`${r.parciais.length}`} />
          <Numero rotulo="Não gravadas" valor={`${r.naoGravadas.length}`} />
          <Numero
            rotulo="Páginas"
            valor={`${oitavosParaPaginas(r.oitavosGravados)} / ${oitavosParaPaginas(r.oitavosPrevistos)}`}
          />
          {cumprimento !== null && (
            <Numero
              rotulo="Do previsto"
              valor={`${cumprimento}%`}
              alerta={cumprimento < 80}
            />
          )}
        </div>

        {/*
          As cenas sem marcação vêm PRIMEIRO e destacadas.

          "Ninguém marcou" não é "não gravou". Assumir o segundo encheria a fila
          de repescagem de cena que talvez tenha saído e só não foi anotada — e
          uma fila em que não se confia é uma fila que ninguém olha.
        */}
        {r.semRegistro.length > 0 && (
          <section style={{ marginBottom: '20px', padding: '14px', borderRadius: '12px', border: '1px solid var(--color-warning, #fbbf24)', background: 'rgba(251,191,36,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <AlertTriangle size={16} style={{ color: 'var(--color-warning, #fbbf24)' }} />
              <span className="text-sm font-bold">
                {r.semRegistro.length === 1
                  ? '1 cena ficou sem marcação'
                  : `${r.semRegistro.length} cenas ficaram sem marcação`}
              </span>
            </div>
            <p className="text-xs text-muted" style={{ marginBottom: '12px', lineHeight: 1.5 }}>
              Marque agora — depois ninguém lembra. Se deixar em branco, elas ficam
              como não gravadas.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {r.semRegistro.map(cena => (
                <div key={cena.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="text-sm" style={{ flex: 1, minWidth: '120px' }}>
                    <strong>Cena {cena.numero}</strong>
                    <span className="text-muted"> · {cena.descricao}</span>
                  </span>
                  {(['gravada', 'parcial', 'nao_gravada'] as StatusCena[]).map(s => (
                    <button
                      key={s}
                      onClick={() => resolver(cena.id, s)}
                      className="text-xs"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '4px 9px', borderRadius: '20px', cursor: 'pointer',
                        border: '1px solid var(--border-light)', background: 'transparent',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {ICONE[s]} {ROTULO[s]}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- o que ficou para trás ---- */}
        {(r.naoGravadas.length > 0 || r.parciais.length > 0) && (
          <section style={{ marginBottom: '20px' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ marginBottom: '10px' }}>
              Vai para a repescagem
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[...r.naoGravadas, ...r.parciais].map(cena => {
                const reg = registros.find(x => x.cena_id === cena.id);
                return (
                  <div
                    key={cena.id}
                    style={{
                      padding: '10px 12px', borderRadius: '10px',
                      background: 'var(--bg-primary)',
                      border: `1px solid ${reg?.motivo ? 'var(--border-light)' : 'var(--color-danger)'}`,
                    }}
                  >
                    <div className="text-sm" style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{reg && ICONE[reg.status]}</span>
                      <span style={{ flex: 1 }}>
                        <strong>Cena {cena.numero}</strong> · {cena.descricao}
                        {reg?.observacao && <span className="text-muted"> ({reg.observacao})</span>}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      <span className="text-xs text-muted" style={{ alignSelf: 'center' }}>por quê:</span>
                      {MOTIVOS.map(m => {
                        const escolhido = reg?.motivo === m;
                        return (
                          <button
                            key={m}
                            onClick={() => definirMotivo(cena.id, m)}
                            className="text-xs"
                            style={{
                              padding: '3px 10px', borderRadius: '20px', cursor: 'pointer',
                              border: `1px solid ${escolhido ? 'var(--accent)' : 'var(--border-light)'}`,
                              background: escolhido ? 'var(--accent)' : 'transparent',
                              color: escolhido ? '#000' : 'var(--text-secondary)',
                            }}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>

                    {/*
                      O texto livre fica ao lado da etiqueta, não no lugar dela.

                      A etiqueta é o que o app consegue somar depois ("três dias
                      perdidos por chuva"); a frase é o que a pessoa vai ler
                      daqui a um mês. "Company move levou 90min a mais por
                      estacionamento e carga" vale muito mais que "atrasou".
                    */}
                    <input
                      defaultValue={reg?.observacao || ''}
                      onBlur={async e => {
                        if (reg && (reg.observacao || '') !== e.target.value) {
                          await db.registros_cena.update(reg.id, { observacao: e.target.value || undefined });
                        }
                      }}
                      placeholder="O que aconteceu, com detalhe (opcional)"
                      className="text-xs"
                      style={{
                        width: '100%', marginTop: '8px', padding: '6px 8px', borderRadius: '8px',
                        border: '1px solid var(--border-light)', background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">
            Notas do dia
          </label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={3}
            placeholder="O que a produção precisa saber amanhã…"
            style={{
              width: '100%', padding: '10px', borderRadius: '10px', fontSize: '14px',
              border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
              color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={aoCancelar} style={{ flex: 1, justifyContent: 'center' }}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={confirmar}
            disabled={fechando || semMotivo.length > 0}
            style={{ flex: 2, justifyContent: 'center', opacity: semMotivo.length > 0 ? 0.5 : 1 }}
            title={semMotivo.length > 0 ? 'Falta dizer por que cada cena não saiu' : undefined}
          >
            <Archive size={16} /> {fechando ? 'Fechando…' : 'Fechar e gerar o DPR'}
          </button>
        </div>

        <p className="text-xs" style={{ marginTop: '10px', textAlign: 'center', color: semMotivo.length > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
          {semMotivo.length > 0
            ? `Falta o motivo de ${semMotivo.map(c => `Cena ${c.numero}`).join(', ')}.`
            : 'A diária pode ser reaberta depois. Nada é apagado.'}
        </p>
      </motion.div>
    </div>,
    document.body
  );
}

function Numero({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div style={{
      flex: '1 1 90px', padding: '10px 12px', borderRadius: '10px',
      border: '1px solid var(--border-light)', background: 'var(--bg-primary)',
    }}>
      <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10px' }}>
        {rotulo}
      </div>
      <div className="font-bold" style={{ fontSize: '17px', marginTop: '2px', color: alerta ? 'var(--color-warning, #fbbf24)' : 'var(--text-primary)' }}>
        {valor}
      </div>
    </div>
  );
}
