import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { FundoEntrada } from '../components/ui/webgl/FundoEntrada';
import { TituloSetProd } from '../components/ui/webgl/TituloSetProd';
import { MOLA } from '../components/ui/ia';
import { supabase } from '../lib/supabase';
import { linkDoApp } from '../lib/urlPublica';

/**
 * "Esqueci a senha."
 *
 * Existe para não virar chamado: sem isto, cada senha esquecida é uma mensagem
 * para o Viol e uma troca manual no painel do Supabase.
 */
export function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pedir = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    // `linkDoApp` e não `window.location.origin`: numa pré-visualização da
    // Vercel o link nasceria apontando para um endereço protegido por login da
    // própria Vercel, e a pessoa não conseguiria abrir. Ver `urlPublica.ts`.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: linkDoApp('nova-senha'),
    });
    setCarregando(false);

    if (error) {
      setErro(/rate limit|too many/i.test(error.message)
        ? 'Muitos pedidos seguidos. Espere um minuto e tente de novo.'
        : error.message);
      return;
    }

    // Sempre a mesma resposta, tenha ou não conta com esse e-mail. Dizer "esse
    // e-mail não existe" transformaria a tela num verificador de quem tem conta.
    setEnviado(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
      <FundoEntrada />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={MOLA}
        className="card"
        style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', zIndex: 1 }}
      >
        <div style={{ textAlign: 'center' }}>
          <TituloSetProd tamanho={52} interativo={false} />
          <p className="text-sm text-secondary" style={{ marginTop: '-4px' }}>
            Recuperar o acesso
          </p>
        </div>

        {enviado ? (
          <>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <MailCheck size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
              <p className="text-sm" style={{ margin: 0, lineHeight: 1.55 }}>
                Se houver uma conta com <strong style={{ wordBreak: 'break-all' }}>{email}</strong>, o
                link para trocar a senha já está a caminho.
                <br />
                <span className="text-muted">O link vale por pouco tempo — use assim que chegar.</span>
              </p>
            </div>
            <Link to="/login" className="btn-primary" style={{ width: '100%', textAlign: 'center' }}>
              Voltar para o login
            </Link>
          </>
        ) : (
          <>
            {erro && (
              <div style={{ padding: '12px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '14px' }}>
                {erro}
              </div>
            )}

            <form onSubmit={pedir} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">E-mail da conta</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              <button type="submit" disabled={carregando} className="btn-primary" style={{ marginTop: '8px' }}>
                {carregando ? 'Enviando…' : 'Mandar link de recuperação'}
              </button>
            </form>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', textAlign: 'center' }}>
              <Link to="/login" className="text-sm" style={{ color: 'var(--accent)' }}>
                Voltar para o login
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
