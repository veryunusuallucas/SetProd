import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FundoEntrada } from '../components/ui/webgl/FundoEntrada';
import { TituloSetProd } from '../components/ui/webgl/TituloSetProd';
import { MOLA } from '../components/ui/ia';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explicacaoAberta, setExplicacaoAberta] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      navigate('/');
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

        {/* Não existe autocadastro: as contas são criadas pelo Viol. Sem esta
            explicação, quem chega pela primeira vez fica procurando um botão
            de "criar conta" que nunca vai existir. */}
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={() => setExplicacaoAberta(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'underline',
            }}
          >
            Não consigo criar uma conta. Por quê?
          </button>

          {explicacaoAberta && (
            <p className="text-sm" style={{ marginTop: '12px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              A resposta é simples: você quer o cu e ainda quer raspado?? A vida não é um
              morango não! Manda mensagem pro Viol que ele olha para você.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
