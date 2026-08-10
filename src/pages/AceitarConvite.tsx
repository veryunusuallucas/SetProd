import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, ShieldAlert, LogIn, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { aceitarConvite, lerConvite, type Convite } from '../lib/membros';
import { FundoEntrada } from '../components/ui/webgl/FundoEntrada';
import { MOLA } from '../components/ui/ia';

type Estado = 'lendo' | 'precisa_entrar' | 'pronto' | 'aceitando' | 'aceito' | 'ja_era' | 'erro';

/**
 * Tela que a Equipe B abre ao clicar no link de convite.
 *
 * Fica FORA do ProtectedRoute de propósito: quem chega aqui pode não estar
 * logado ainda, e mandar essa pessoa para o login sem explicar nada faria o
 * convite parecer quebrado. Aqui ela vê de que produção se trata antes de
 * decidir entrar.
 */
export function AceitarConvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [estado, setEstado] = useState<Estado>('lendo');
  const [convite, setConvite] = useState<Convite | null>(null);
  const [erro, setErro] = useState('');
  /**
   * Qual conta vai aceitar o convite.
   *
   * Fica visível o tempo todo porque o erro silencioso aqui é caro: quem já
   * estava logado entrava na hora, sem o app nunca perguntar nada — e um
   * convite mandado para o colega acabava aceito pela conta de quem estava no
   * computador. O convite gasta e não dá para desfazer.
   */
  const [contaAtual, setContaAtual] = useState<string | null>(null);
  const [projetoId, setProjetoId] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const { data: sessao } = await supabase.auth.getSession();
        const logado = Boolean(sessao?.session?.user);
        if (vivo) setContaAtual(sessao?.session?.user?.email ?? null);

        // Sem sessão, nem tenta ler o convite.
        //
        // A regra do servidor libera a leitura só para quem está logado — e um
        // SELECT barrado pela RLS não dá erro, devolve VAZIO. Ler antes de
        // entrar fazia o app concluir "este convite não existe" e mandar a
        // pessoa pedir outro link, quando o convite estava lá, intacto, só
        // esperando o login.
        if (!logado) {
          if (vivo) setEstado('precisa_entrar');
          return;
        }

        const c = await lerConvite(token!);
        if (!vivo) return;

        if (!c) {
          setErro('Este convite não existe ou já foi revogado. Peça um link novo para quem te chamou.');
          setEstado('erro');
          return;
        }
        if (new Date(c.expira_em).getTime() < Date.now()) {
          setErro('Este convite expirou. Peça um link novo.');
          setEstado('erro');
          return;
        }

        setConvite(c);
        setEstado(logado ? 'pronto' : 'precisa_entrar');
      } catch (e: any) {
        if (!vivo) return;
        // Sem estar logado, a política de leitura de convites não responde.
        // Não é erro de verdade: é o convite pedindo uma conta primeiro.
        setEstado('precisa_entrar');
        void e;
      }
    })();

    return () => { vivo = false; };
  }, [token]);

  const aceitar = async () => {
    setEstado('aceitando');
    try {
      const { projeto_id, ja_era_membro } = await aceitarConvite(token!);
      setProjetoId(projeto_id);
      // "Já era membro" merece tela própria, e não um redirecionamento mudo:
      // é o sinal de que o convite foi aberto pela conta errada.
      setEstado(ja_era_membro ? 'ja_era' : 'aceito');
      if (!ja_era_membro) setTimeout(() => navigate(`/projeto/${projeto_id}`), 900);
    } catch (e: any) {
      setErro(e?.message || 'Não consegui aceitar o convite.');
      setEstado('erro');
    }
  };

  /** Sai da conta atual e volta para cá depois de entrar na certa. */
  const trocarDeConta = async () => {
    await supabase.auth.signOut();
    navigate('/login', { state: { voltarPara: `/convite/${token}` }, replace: true });
  };

  return (
    <div style={{ minHeight: '100dvh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <FundoEntrada />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={MOLA}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: '440px',
          backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: '18px', padding: '32px',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <Users size={28} />
          <h1 className="text-2xl font-bold" style={{ marginTop: '12px' }}>
            Convite para uma produção
          </h1>
        </div>

        {estado === 'lendo' && <p className="text-sm text-muted">Conferindo o convite…</p>}

        {(estado === 'precisa_entrar' || estado === 'pronto' || estado === 'aceitando') && (
          <>
            <p className="text-sm" style={{ lineHeight: 1.5, marginBottom: '20px' }}>
              {convite?.nome_projeto ? (
                <>Você foi convidado para <strong>{convite.nome_projeto}</strong>.</>
              ) : (
                <>Você foi convidado para uma produção no SetProd.</>
              )}
              <br />
              <span className="text-muted">
                Vocês vão trabalhar na mesma produção — o que uma equipe muda, a outra vê.
              </span>
            </p>

            {estado === 'precisa_entrar' ? (
              <>
                <Link
                  to="/login"
                  state={{ voltarPara: `/convite/${token}` }}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <LogIn size={16} /> Entrar para aceitar
                </Link>
                <p className="text-xs text-muted" style={{ marginTop: '10px' }}>
                  Precisa de uma conta para o SetProd saber quem é você. Depois de
                  entrar, você volta para cá.
                </p>
              </>
            ) : (
              <>
                {/* Antes de qualquer botão: com QUAL conta isso vai acontecer.
                    Aceitar gasta o convite e não desfaz — se o link foi aberto
                    no computador de outra pessoa, o erro é definitivo. */}
                <div style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', marginBottom: '14px' }}>
                  <div className="text-xs text-muted">Entrando na produção como</div>
                  <div className="text-sm font-bold" style={{ wordBreak: 'break-all' }}>{contaAtual || 'conta desconhecida'}</div>
                  <button
                    onClick={trocarDeConta}
                    className="text-xs"
                    style={{ marginTop: '6px', background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Não é você? Entrar com outra conta
                  </button>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={aceitar}
                  disabled={estado === 'aceitando'}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {estado === 'aceitando' ? 'Entrando…' : 'Aceitar e entrar na produção'}
                </button>
              </>
            )}
          </>
        )}

        {estado === 'aceito' && (
          <p className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={18} color="var(--color-success, #4ade80)" /> Pronto! Abrindo a produção…
          </p>
        )}

        {estado === 'ja_era' && (
          <>
            <p className="text-sm" style={{ lineHeight: 1.5, marginBottom: '16px' }}>
              A conta <strong>{contaAtual}</strong> já faz parte desta produção — o convite não
              chegou a ser usado.
              <br />
              <span className="text-muted">
                Se o convite era para outra pessoa, mande o link para ela abrir na conta dela.
              </span>
            </p>
            <button onClick={() => navigate(`/projeto/${projetoId}`)} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Abrir a produção
            </button>
            <button onClick={trocarDeConta} className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
              Entrar com outra conta
            </button>
          </>
        )}

        {estado === 'erro' && (
          <>
            <p className="text-sm" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--color-danger)' }}>
              <ShieldAlert size={18} /> {erro}
            </p>
            <Link to="/" className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: '20px' }}>
              Ir para o início
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
