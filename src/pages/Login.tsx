import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FundoEntrada } from '../components/ui/webgl/FundoEntrada';
import { TituloSetProd } from '../components/ui/webgl/TituloSetProd';
import { MOLA } from '../components/ui/ia';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { sincronizarParticipacoes } from '../lib/membros';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Para onde ir depois de entrar.
   *
   * Quem chegou por um link de convite tem que voltar PARA O CONVITE, e não
   * para o início — senão a pessoa entra na conta e o convite simplesmente
   * some, sem explicação.
   */
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara || '/';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate(voltarPara, { replace: true });
      }
    });
  }, [navigate, voltarPara]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(traduzirErro(error.message));
    } else {
      // De quais projetos esta conta participa. Sem isto, quem acabou de
      // entrar veria o app como se não fosse membro de nada.
      await sincronizarParticipacoes();
      navigate(voltarPara, { replace: true });
    }
    setLoading(false);
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
      {/* Mesma identidade da tela inicial: as duas são a porta do app. */}
      <FundoEntrada />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={MOLA}
        className="card"
        style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', zIndex: 1 }}
      >
        {/* O título com warp também aqui: o login é a primeira coisa que a
            pessoa vê do app. O easter egg fica só na tela inicial — repetido nos
            dois lugares ele deixaria de ser achado e viraria botão. */}
        <div style={{ textAlign: 'center' }}>
          <TituloSetProd tamanho={52} interativo={false} />
          <p className="text-sm text-secondary" style={{ marginTop: '-4px' }}>
            Faça login para acessar suas produções
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">E-mail</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Senha</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1 }}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>

        {/* Antes daqui vivia a piada do "não consigo criar uma conta, por quê?".
            Ela existia porque autocadastro não existia — agora existe, e manter
            a piada seria esconder o botão que a resposta dela mandava procurar. */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <div className="text-sm">
            <span className="text-muted">Ainda não tem conta? </span>
            <Link to="/criar-conta" state={{ voltarPara }} style={{ color: 'var(--accent)' }}>
              Criar conta
            </Link>
          </div>

          <Link to="/esqueci-senha" className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Esqueci a senha
          </Link>

          {/*
            A VERSÃO, na porta de entrada.

            É a primeira pergunta de todo suporte — "qual versão você está?" — e
            até agora a resposta exigia entrar, achar o selo na tela inicial e
            ler. Quem está travado no login não consegue fazer nada disso, e é
            justamente quem mais precisa responder.

            Discreta de propósito: informação de rodapé, não convite.
          */}
          <div className="text-xs text-muted" style={{ letterSpacing: '0.06em', opacity: 0.7 }}>
            versão {__VERSAO_APP__}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * As mensagens do Supabase vêm em inglês e falam com programador.
 *
 * "Invalid login credentials" é a que mais aparece, e ela é DELIBERADAMENTE
 * vaga: o Supabase não diz se o e-mail não existe ou se a senha está errada,
 * porque distinguir os dois transformaria a tela de login num verificador de
 * quem tem conta. A tradução mantém essa vagueza — e acrescenta o que fazer,
 * que é o que faltava.
 */
function traduzirErro(mensagem: string): string {
  if (/invalid login credentials/i.test(mensagem)) {
    return 'E-mail ou senha não conferem. Se não lembra a senha, use "Esqueci a senha" logo abaixo — e confira se o e-mail é mesmo o da conta do SetProd.';
  }
  if (/email not confirmed/i.test(mensagem)) {
    return 'Esta conta ainda não foi confirmada. Procure o e-mail de confirmação (veja o lixo eletrônico) e abra o link antes de entrar.';
  }
  if (/rate limit|too many/i.test(mensagem)) {
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  }
  if (/failed to fetch|network/i.test(mensagem)) {
    return 'Não consegui falar com o servidor. Confira a internet e tente de novo.';
  }
  return mensagem;
}
