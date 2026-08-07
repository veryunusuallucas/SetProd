import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, Copy, Check, Trash2, Users, ShieldAlert, UserCheck } from 'lucide-react';
import { db } from '../db/db';
import {
  criarConvite, convitesDoProjeto, revogarConvite, linkDoConvite,
  membrosDoProjeto, definirMeuPerfil, sincronizarParticipacoes, participacaoLocal,
  type Convite, type Participacao,
} from '../lib/membros';
import { supabaseConfigurado } from '../lib/supabase';
import { MOLA } from './ui/ia';

interface Props {
  projetoId: string;
  nomeProjeto: string;
  aoFechar: () => void;
}

/**
 * Compartilhar a produção com outra equipe.
 *
 * O modelo é o da spec: A e B são dois membros do MESMO projeto, no mesmo
 * nível — não existe "cópia da A" e "cópia da B". Por isso a tela fala de
 * "quem tem acesso", e não de enviar nada para alguém.
 */
export function CompartilharModal({ projetoId, nomeProjeto, aoFechar }: Props) {
  const [membros, setMembros] = useState<Participacao[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState('');
  const [gerando, setGerando] = useState(false);

  const perfis = useLiveQuery(
    () => db.perfis.where('projeto_id').equals(projetoId).toArray(),
    [projetoId]
  ) || [];

  const minhaParticipacao = participacaoLocal(projetoId);

  const recarregar = async () => {
    try {
      setErro('');
      const [m, c] = await Promise.all([membrosDoProjeto(projetoId), convitesDoProjeto(projetoId)]);
      setMembros(m);
      setConvites(c.filter(x => !x.usado_por));
    } catch (e: any) {
      setErro(e?.message || 'Não consegui ler quem tem acesso.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    sincronizarParticipacoes().then(recarregar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);

  const gerarLink = async () => {
    setGerando(true);
    try {
      setErro('');
      const convite = await criarConvite(projetoId, nomeProjeto, `Equipe ${String.fromCharCode(65 + membros.length)}`);
      await navigator.clipboard.writeText(linkDoConvite(convite.token)).catch(() => {});
      setCopiado(convite.token);
      setTimeout(() => setCopiado(''), 2500);
      await recarregar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui criar o convite.');
    } finally {
      setGerando(false);
    }
  };

  const copiar = async (token: string) => {
    await navigator.clipboard.writeText(linkDoConvite(token));
    setCopiado(token);
    setTimeout(() => setCopiado(''), 2500);
  };

  const derrubar = async (token: string) => {
    try {
      await revogarConvite(token);
      await recarregar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui revogar.');
    }
  };

  const trocarPerfil = async (perfilId: string) => {
    try {
      await definirMeuPerfil(projetoId, perfilId || null);
      await recarregar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar quem você é na equipe.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }}
      onClick={aoFechar}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px', maxHeight: '86vh', overflowY: 'auto',
          backgroundColor: 'var(--bg-surface)', borderRadius: '16px',
          border: '1px solid var(--border-color)', padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <h2 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} /> Quem tem acesso
            </h2>
            <p className="text-sm text-muted" style={{ marginTop: '4px' }}>
              Todo mundo aqui trabalha na <strong>mesma</strong> produção — não são cópias.
              O que uma equipe muda, a outra vê.
            </p>
          </div>
          <button className="btn-icon" onClick={aoFechar} aria-label="Fechar"><X size={20} /></button>
        </div>

        {!supabaseConfigurado && (
          <div style={avisoEstilo}>
            <ShieldAlert size={16} /> Sem conexão com o servidor configurada — compartilhar precisa dela.
          </div>
        )}

        {erro && <div style={{ ...avisoEstilo, color: 'var(--color-danger)' }}><ShieldAlert size={16} /> {erro}</div>}

        {/* ---- quem eu sou na equipe ---- */}
        {minhaParticipacao && (
          <section style={{ marginBottom: '24px' }}>
            <h3 style={tituloSecao}><UserCheck size={14} /> Eu, nesta produção</h3>
            <select
              value={minhaParticipacao.perfil_id || ''}
              onChange={e => trocarPerfil(e.target.value)}
              style={campoEstilo}
            >
              <option value="">— não sou da equipe cadastrada —</option>
              {perfis.filter(p => p.id !== 'caixa_central').map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome} {p.sobrenome || ''} {p.funcao ? `(${p.funcao})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted" style={{ marginTop: '6px' }}>
              É o que faz “Minhas Tasks” saber o que é seu. Fica salvo na sua conta,
              então vale em qualquer aparelho.
            </p>
          </section>
        )}

        {/* ---- membros ---- */}
        <section style={{ marginBottom: '24px' }}>
          <h3 style={tituloSecao}><Users size={14} /> Equipes com acesso</h3>
          {carregando ? (
            <p className="text-sm text-muted">Consultando…</p>
          ) : membros.length === 0 ? (
            <p className="text-sm text-muted">
              Ninguém ainda — nem você. Este projeto existe só neste navegador.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {membros.map(m => (
                <div key={m.usuario_id} style={linhaEstilo}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-sm font-bold">{m.apelido || 'Equipe'}</div>
                    <div className="text-xs text-muted">
                      {m.papel === 'dono' ? 'criou a produção' : m.papel}
                      {m.usuario_id === minhaParticipacao?.usuario_id && ' · você'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---- convites ---- */}
        <section>
          <h3 style={tituloSecao}><Link2 size={14} /> Convidar outra equipe</h3>

          <AnimatePresence>
            {convites.map(c => (
              <motion.div
                key={c.token}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={MOLA}
                style={{ ...linhaEstilo, marginBottom: '8px' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-sm font-bold">{c.apelido || 'Convite'}</div>
                  <div className="text-xs text-muted">
                    vale até {new Date(c.expira_em).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <button className="btn-icon" onClick={() => copiar(c.token)} title="Copiar link">
                  {copiado === c.token ? <Check size={16} color="var(--color-success, #4ade80)" /> : <Copy size={16} />}
                </button>
                <button className="btn-icon" onClick={() => derrubar(c.token)} title="Revogar">
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          <button
            className="btn btn-primary"
            onClick={gerarLink}
            disabled={gerando || !supabaseConfigurado || !minhaParticipacao}
            style={{ width: '100%', marginTop: convites.length ? '8px' : 0 }}
          >
            <Link2 size={16} /> {gerando ? 'Criando…' : 'Criar link de convite'}
          </button>

          <p className="text-xs text-muted" style={{ marginTop: '8px', lineHeight: 1.4 }}>
            O link vale por 7 dias e serve <strong>uma vez só</strong>. Quem abrir
            precisa entrar com uma conta — e quem tiver o link entra, então mande
            por um canal privado.
          </p>
        </section>
      </motion.div>
    </div>
  );
}

const tituloSecao: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px',
};

const linhaEstilo: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '10px 12px', borderRadius: '10px',
  backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)',
};

const campoEstilo: React.CSSProperties = {
  width: '100%', padding: '10px', borderRadius: '10px',
  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
  fontSize: '14px', color: 'var(--text-primary)',
};

const avisoEstilo: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '10px 12px', borderRadius: '10px', marginBottom: '16px',
  backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)',
  fontSize: '13px',
};
