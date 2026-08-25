import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { UserCheck, Plus, X } from 'lucide-react';
import { db } from '../db/db';
import { definirMeuPerfil, perfisJaVinculados } from '../lib/membros';
import { notificar } from '../lib/notificacoes';
import { MOLA } from './ui/ia';
import type { Perfil, Departamento } from '../types';

/**
 * "Quem é você nesta produção?"
 *
 * Sem esta resposta, três coisas ficam quebradas de um jeito que não parece
 * quebrado:
 *
 *   · "Minhas Tasks" não mostra nada, mesmo com as tasks atribuídas certinho;
 *   · a pessoa não vê a PRÓPRIA ficha — a regra é "a própria pessoa e quem
 *     administra", e o app não sabia que aquela conta era aquela pessoa;
 *   · sem departamento, ela fica fora do escopo departamental inteiro.
 *
 * O vínculo vai para `projeto_membros.perfil_id`, que é da CONTA e não do
 * aparelho: quem responder no computador continua sendo a mesma pessoa no
 * celular.
 *
 * DEIXA PULAR, de propósito. Travar alguém na porta do app é pior que um escopo
 * reduzido — quem pula entra e o aviso continua ali para quando quiser.
 */

interface Props {
  projetoId: string;
  /** Nome da conta logada, para o app já sugerir a ficha certa. */
  meuEmail?: string | null;
  aoResolver: (perfilId: string | null) => void;
  aoPular: () => void;
}

export function EscolherMinhaFicha({ projetoId, meuEmail, aoResolver, aoPular }: Props) {
  const [perfis, setPerfis] = useState<Perfil[] | null>(null);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Criar ficha nova
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [ps, ds] = await Promise.all([
        db.perfis.where('projeto_id').equals(projetoId).toArray(),
        db.departamentos.where('projeto_id').equals(projetoId).toArray(),
      ]);
      if (!vivo) return;
      setPerfis(ps.filter(p => p.id !== 'caixa_central'));
      setDepartamentos(ds);

      // Quem já tem dono some da lista. O índice único do banco recusaria a
      // colisão, e a pessoa levaria um erro sem entender o motivo.
      try {
        const tomados = await perfisJaVinculados(projetoId);
        if (vivo) setOcupados(new Set(tomados));
      } catch {
        // Sem rede: mostra todo mundo. O banco ainda protege se houver colisão.
      }
    })();
    return () => { vivo = false; };
  }, [projetoId]);

  const vincular = async (perfilId: string) => {
    setSalvando(true);
    setErro('');
    try {
      await definirMeuPerfil(projetoId, perfilId);
      aoResolver(perfilId);
    } catch (e: any) {
      setErro(
        /duplicate|unique/i.test(e?.message || '')
          ? 'Alguém já se vinculou a essa ficha. Escolha outra ou fale com a produção.'
          : (e?.message || 'Não consegui salvar.')
      );
      setSalvando(false);
    }
  };

  const criarEVincular = async () => {
    if (!nome.trim()) { setErro('Escreva pelo menos o seu nome.'); return; }
    setSalvando(true);
    setErro('');
    try {
      const partes = nome.trim().split(/\s+/);
      const perfil: Perfil = {
        id: crypto.randomUUID(),
        projeto_id: projetoId,
        nome: partes[0],
        sobrenome: partes.slice(1).join(' ') || undefined,
        funcao: funcao.trim() || undefined,
        departamento_id: departamentoId || undefined,
        email: meuEmail || undefined,
      };

      // Registro normal do Dexie: sobe pelo sync como qualquer outro, e o dono
      // vê a pessoa aparecer na ficha da equipe sozinha.
      await db.perfis.add(perfil);
      await definirMeuPerfil(projetoId, perfil.id);

      // Sem isto a equipe ganha gente sem ninguém perceber.
      await notificar(projetoId, `${perfil.nome} entrou na produção e criou a própria ficha.`, {
        perfil_id: perfil.id,
      }).catch(() => {});

      aoResolver(perfil.id);
    } catch (e: any) {
      setErro(e?.message || 'Não consegui criar a ficha.');
      setSalvando(false);
    }
  };

  const livres = (perfis || []).filter(p => !ocupados.has(p.id));

  // Se a conta tem e-mail e existe ficha com o mesmo e-mail, ela vem primeiro:
  // é quase sempre a resposta certa, e poupa a pessoa de procurar na lista.
  const ordenados = [...livres].sort((a, b) => {
    const ma = meuEmail && a.email?.toLowerCase() === meuEmail.toLowerCase() ? 0 : 1;
    const mb = meuEmail && b.email?.toLowerCase() === meuEmail.toLowerCase() ? 0 : 1;
    return ma - mb || (a.nome || '').localeCompare(b.nome || '');
  });

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '16px',
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        style={{
          width: '100%', maxWidth: '460px', maxHeight: '86vh', overflowY: 'auto',
          backgroundColor: 'var(--bg-surface)', borderRadius: '16px',
          border: '1px solid var(--border-color)', padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
          <div style={{ flex: 1 }}>
            <h2 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={20} /> Quem é você nesta produção?
            </h2>
            <p className="text-sm text-muted" style={{ marginTop: '6px', lineHeight: 1.5 }}>
              É o que faz “Minhas Tasks” saber o que é seu, e o que deixa você ver
              a sua própria ficha. Fica salvo na sua conta, então vale em qualquer
              aparelho.
            </p>
          </div>
          <button className="btn-icon" onClick={aoPular} aria-label="Agora não"><X size={20} /></button>
        </div>

        {erro && (
          <div style={{ padding: '10px 12px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            {erro}
          </div>
        )}

        {perfis === null ? (
          <p className="text-sm text-muted">Carregando a equipe…</p>
        ) : criando ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Seu nome</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome e sobrenome" autoFocus />
            </div>
            <div>
              <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Departamento</label>
              <select value={departamentoId} onChange={e => setDepartamentoId(e.target.value)} style={campo}>
                <option value="">— escolher depois —</option>
                {departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Função (opcional)</label>
              <input value={funcao} onChange={e => setFuncao(e.target.value)} placeholder="Operador de Câmera, Contrarregra…" />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn" onClick={() => { setCriando(false); setErro(''); }} disabled={salvando} style={{ flex: 1, justifyContent: 'center' }}>
                Voltar
              </button>
              <button className="btn btn-primary" onClick={criarEVincular} disabled={salvando} style={{ flex: 2, justifyContent: 'center' }}>
                {salvando ? 'Salvando…' : 'Entrar como esta pessoa'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {ordenados.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                {ordenados.map(p => {
                  const ehMeuEmail = Boolean(meuEmail && p.email?.toLowerCase() === meuEmail.toLowerCase());
                  return (
                    <button
                      key={p.id}
                      onClick={() => vincular(p.id)}
                      disabled={salvando}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                        padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                        backgroundColor: 'var(--bg-primary)',
                        border: `1px solid ${ehMeuEmail ? 'var(--accent)' : 'var(--border-light)'}`,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-sm font-bold">{p.nome} {p.sobrenome || ''}</div>
                        <div className="text-xs text-muted">
                          {p.funcao || 'sem função definida'}
                          {p.email ? ` · ${p.email}` : ''}
                        </div>
                      </div>
                      {ehMeuEmail && (
                        <span className="text-xs" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                          é o seu e-mail
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted" style={{ marginBottom: '14px' }}>
                {perfis.length === 0
                  ? 'A equipe desta produção ainda não foi cadastrada.'
                  : 'Todas as fichas da equipe já têm conta vinculada.'}
              </p>
            )}

            <button className="btn" onClick={() => setCriando(true)} style={{ width: '100%', justifyContent: 'center' }}>
              <Plus size={16} /> Não estou na lista
            </button>

            <button
              onClick={aoPular}
              className="text-xs"
              style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Agora não — decidir depois
            </button>
          </>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

const campo: React.CSSProperties = {
  width: '100%', padding: '10px', borderRadius: '10px',
  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
  fontSize: '14px', color: 'var(--text-primary)',
};
