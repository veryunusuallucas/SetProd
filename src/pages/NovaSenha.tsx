import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ShieldAlert } from 'lucide-react';
import { FundoEntrada } from '../components/ui/webgl/FundoEntrada';
import { TituloSetProd } from '../components/ui/webgl/TituloSetProd';
import { MOLA } from '../components/ui/ia';
import { supabase } from '../lib/supabase';

type Estado = 'conferindo' | 'pronto' | 'sem_link' | 'salvo';

/**
 * Onde o link de recuperação desemboca.
 *
 * O token não vem num campo: o Supabase o entrega na própria URL, e o
 * `supabase-js` o troca por uma sessão sozinho ao carregar a página. Por isso
 * aqui não se lê token nenhum — espera-se a sessão aparecer.
 *
 * Essa troca é assíncrona, e é a origem do único jeito de esta tela errar:
 * perguntar pela sessão cedo demais e concluir "link inválido" quando ele estava
 * certo, só ainda em trânsito. Daí a espera com prazo, em vez de uma leitura só.
 */
export function NovaSenha() {
  const [estado, setEstado] = useState<Estado>('conferindo');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let vivo = true;

    // Assina ANTES de perguntar: se a troca terminar entre as duas linhas, o
    // evento seria perdido e a tela ficaria esperando para sempre.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (vivo && sessao) setEstado('pronto');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (vivo && session) setEstado('pronto');
    });

    // O prazo. Sem ele, um link já usado ou expirado deixa a tela em
    // "Conferindo…" para sempre, sem dizer o que houve.
    const prazo = window.setTimeout(() => {
      if (vivo) setEstado(atual => (atual === 'conferindo' ? 'sem_link' : atual));
    }, 4_000);

    return () => {
      vivo = false;
      subscription.unsubscribe();
      window.clearTimeout(prazo);
    };
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha precisa de pelo menos 6 caracteres.');
      return;
    }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro(/same as the old|should be different/i.test(error.message)
        ? 'Essa é a senha que você já usava. Escolha outra.'
        : error.message);
      return;
    }

    setEstado('salvo');
    // O link de recuperação já deixa a pessoa logada, então não há por que
    // pedir a senha nova em seguida — seria pedir para provar o que ela acabou
    // de fazer.
    setTimeout(() => navigate('/', { replace: true }), 1_200);
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
            Escolher uma senha nova
          </p>
        </div>

        {estado === 'conferindo' && <p className="text-sm text-muted">Conferindo o link…</p>}

        {estado === 'sem_link' && (
          <>
            <p className="text-sm" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--color-danger)', lineHeight: 1.5 }}>
              <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              Este link não vale mais. Eles duram pouco de propósito, e cada um
              serve uma vez só.
            </p>
            <Link to="/esqueci-senha" className="btn-primary" style={{ width: '100%', textAlign: 'center' }}>
              Pedir um link novo
            </Link>
          </>
        )}

        {estado === 'salvo' && (
          <p className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={18} color="var(--color-success, #4ade80)" /> Senha trocada. Abrindo o app…
          </p>
        )}

        {estado === 'pronto' && (
          <>
            {erro && (
              <div style={{ padding: '12px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '14px' }}>
                {erro}
              </div>
            )}

            <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Senha nova</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="pelo menos 6 caracteres"
                />
              </div>
              <div>
                <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Repita a senha</label>
                <input
                  type="password"
                  required
                  value={confirmacao}
                  onChange={e => setConfirmacao(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" disabled={salvando} className="btn-primary" style={{ marginTop: '8px' }}>
                {salvando ? 'Salvando…' : 'Salvar senha nova'}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
