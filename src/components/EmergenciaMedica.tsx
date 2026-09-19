import { useState } from 'react';
import { HeartPulse, X } from 'lucide-react';
import { supabase, supabaseConfigurado } from '../lib/supabase';
import { confirmar } from './ui/Confirmacao';
import { CAMPOS_MEDICOS } from '../lib/camposSensiveis';
import type { Diaria, Perfil } from '../types';

/**
 * A ficha médica de quem está no set com você — em emergência.
 *
 * A camada médica da ficha só desce para a própria pessoa, dono e admin
 * (`supabase/sql/fichas.sql`). Mas no set, com alguém passando mal, ninguém vai
 * achar o produtor para liberar uma tela. Então quem está escalado numa diária
 * de hoje abre a ficha médica de quem também está — pela função
 * `ficha_medica_de_emergencia`, que confere a escala no servidor e REGISTRA a
 * abertura na ata, que ninguém apaga. Acesso registrado, não bloqueado.
 *
 * Só aparece quando vale: diária de ontem, hoje ou amanhã, e eu escalado nela.
 * Quem já vê a ficha médica (dono, admin) não precisa disto.
 */

const ROTULOS: Record<string, string> = {
  contato_emergencia: 'Contato de emergência',
  info_medica: 'Informação médica',
  tipo_sanguineo: 'Tipo sanguíneo',
  alergias: 'Alergias',
  medicamentos_continuos: 'Medicamentos de uso contínuo',
  restricao_alimentar: 'Restrição alimentar',
  plano_saude: 'Plano de saúde',
};

/** A data da diária está a um dia de hoje, para qualquer lado? */
function diariaDeHoje(data?: string): boolean {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [a, m, d] = data.split('-').map(Number);
  const dia = new Date(a, m - 1, d).getTime();
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.abs(dia - hoje.getTime()) <= 36 * 60 * 60 * 1000;
}

export function EmergenciaMedica({ projetoId, diaria, escalados, meuPerfilId, jaVejo }: {
  projetoId: string;
  diaria: Diaria;
  escalados: Perfil[];
  meuPerfilId?: string;
  /** Esta conta já enxerga a camada médica (dono, admin): nada a fazer aqui. */
  jaVejo: boolean;
}) {
  const [aberta, setAberta] = useState<{ perfil: Perfil; dados: Record<string, string> } | null>(null);
  const [erro, setErro] = useState('');
  const [buscando, setBuscando] = useState<string | null>(null);

  const eu = meuPerfilId && (diaria.equipe_escalada || []).includes(meuPerfilId);
  if (!supabaseConfigurado || jaVejo || !eu || !diariaDeHoje(diaria.data)) return null;

  const colegas = escalados.filter(p => p.id !== meuPerfilId);
  if (!colegas.length) return null;

  const abrir = async (p: Perfil) => {
    const ok = await confirmar({
      titulo: `Abrir a ficha médica de ${p.nome}?`,
      detalhe: 'É para emergência. A abertura fica registrada na ata da produção, com o seu nome e a hora.',
      confirmar: 'Abrir',
      cancelar: 'Cancelar',
    });
    if (!ok) return;
    setErro('');
    setBuscando(p.id);
    const { data, error } = await supabase.rpc('ficha_medica_de_emergencia', { p_projeto: projetoId, p_perfil: p.id });
    setBuscando(null);
    if (error) { setErro(error.message); return; }
    setAberta({ perfil: p, dados: (data || {}) as Record<string, string> });
  };

  const preenchidos = aberta
    ? (CAMPOS_MEDICOS as readonly string[]).filter(c => aberta.dados[c])
    : [];

  return (
    <div className="card" style={{ borderColor: 'var(--color-danger)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <HeartPulse size={16} style={{ color: 'var(--color-danger)' }} />
        <span className="text-sm font-bold">Emergência médica</span>
      </div>
      <p className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Alguém passou mal? Toque no nome para ver alergias, remédios e contato de emergência. Fica registrado na ata.
      </p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {colegas.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => abrir(p)}
            disabled={buscando === p.id}
            className="btn-chip"
            style={{ minHeight: '36px' }}
          >
            {buscando === p.id ? 'Abrindo…' : `${p.nome} ${p.sobrenome || ''}`.trim()}
          </button>
        ))}
      </div>
      {erro && <p className="text-xs" style={{ margin: 0, color: 'var(--color-danger)' }}>{erro}</p>}

      {aberta && (
        <div role="dialog" aria-label={`Ficha médica de ${aberta.perfil.nome}`} style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong className="text-sm">{`${aberta.perfil.nome} ${aberta.perfil.sobrenome || ''}`.trim()}</strong>
            <button type="button" className="btn-icon" onClick={() => setAberta(null)} aria-label="Fechar">
              <X size={16} />
            </button>
          </div>
          {preenchidos.length === 0 ? (
            <p className="text-sm text-muted" style={{ margin: 0 }}>A ficha médica desta pessoa está em branco.</p>
          ) : (
            <dl style={{ margin: 0, display: 'grid', gap: '6px' }}>
              {preenchidos.map(c => (
                <div key={c}>
                  <dt className="text-xs text-muted">{ROTULOS[c] || c}</dt>
                  <dd className="text-sm" style={{ margin: 0 }}>{aberta.dados[c]}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
