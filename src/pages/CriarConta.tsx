import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { FundoEntrada } from '../components/ui/webgl/FundoEntrada';
import { TituloSetProd } from '../components/ui/webgl/TituloSetProd';
import { MOLA } from '../components/ui/ia';
import { supabase } from '../lib/supabase';
import { sincronizarParticipacoes } from '../lib/membros';

/**
 * Criar conta.
 *
 * Até aqui as contas nasciam no painel do Supabase, uma por uma, na mão. Isso
 * não escala para além de duas equipes e trava tudo o que vem depois: sem
 * autocadastro, quem é convidado para uma produção não tem como entrar.
 *
 * A rota é `/criar-conta` e não `/cadastro` de propósito: `/cadastro/:projetoId`
 * já existe e é OUTRA coisa — o formulário público que a equipe preenche com
 * CPF, PIX e ficha médica. Duas telas chamadas "cadastro" a um caractere de
 * distância seriam confundidas por quem lê o código e por quem lê a URL.
 */
export function CriarConta() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confiraEmail, setConfiraEmail] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  /** Quem chegou por um convite volta PARA o convite, não para o início. */
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara || '/';

  const criar = async (e: React.FormEvent) => {
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

    setCarregando(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      // Vira `user_metadata.nome`. É o que vai aparecer na lista de membros de
      // uma produção — sem isso, o painel do dono mostra só um uuid.
      options: { data: { nome: nome.trim() } },
    });
    setCarregando(false);

    if (error) {
      setErro(traduzir(error.message));
      return;
    }

    /*
      Com a confirmação de e-mail LIGADA no Supabase, um e-mail já cadastrado não
      dá erro: a resposta vem como sucesso, com `identities` vazio. É de
      propósito — responder "esse e-mail já existe" transformaria a tela de
      cadastro num verificador de quem tem conta. Aqui a gente lê o sinal e
      manda a pessoa para o login, sem afirmar nada sobre o e-mail.
    */
    if (data.user && data.user.identities?.length === 0) {
      setErro('Se esse e-mail ainda não tiver conta, o link de confirmação chegou. Se já tiver, é só entrar pelo login.');
      return;
    }

    // Sessão na resposta = confirmação desligada, já pode entrar.
    if (data.session) {
      await sincronizarParticipacoes();
      navigate(voltarPara, { replace: true });
      return;
    }

    // Sem sessão = o Supabase está esperando a confirmação por e-mail. Mandar
    // para `/` aqui faria o ProtectedRoute devolver a pessoa para o login, e o
    // cadastro pareceria ter falhado bem na hora em que deu certo.
    setConfiraEmail(true);
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
            {confiraEmail ? 'Falta um passo' : 'Crie sua conta para começar'}
          </p>
        </div>

        {confiraEmail ? (
          <>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <MailCheck size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
              <p className="text-sm" style={{ margin: 0, lineHeight: 1.55 }}>
                Mandamos um link de confirmação para <strong style={{ wordBreak: 'break-all' }}>{email}</strong>.
                Abra o link e depois volte para entrar.
                <br />
                <span className="text-muted">
                  Se não chegar em alguns minutos, confira o lixo eletrônico.
                </span>
              </p>
            </div>

            <Link
              to="/login"
              state={{ voltarPara }}
              className="btn-primary"
              style={{ width: '100%', textAlign: 'center' }}
            >
              Ir para o login
            </Link>
          </>
        ) : (
          <>
            {erro && (
              <div style={{ padding: '12px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '14px', lineHeight: 1.5 }}>
                {erro}
              </div>
            )}

            <form onSubmit={criar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Nome</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Como te chamam no set"
                />
              </div>
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

              <button type="submit" disabled={carregando} className="btn-primary" style={{ marginTop: '8px' }}>
                {carregando ? 'Criando…' : 'Criar conta'}
              </button>
            </form>

            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', textAlign: 'center' }}>
              <span className="text-sm text-muted">Já tem conta? </span>
              <Link to="/login" state={{ voltarPara }} className="text-sm" style={{ color: 'var(--accent)' }}>
                Entrar
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

/** As mensagens do Supabase vêm em inglês e falam com programador. */
function traduzir(mensagem: string): string {
  if (/already registered|already exists/i.test(mensagem)) {
    return 'Já existe uma conta com esse e-mail. Entre pelo login, ou use "Esqueci a senha".';
  }
  if (/password.*at least|weak password/i.test(mensagem)) {
    return 'Essa senha é curta demais. Use pelo menos 6 caracteres.';
  }
  if (/invalid.*email|unable to validate email/i.test(mensagem)) {
    return 'Esse e-mail não parece válido. Confira se não faltou uma letra.';
  }
  if (/signups? not allowed|disabled/i.test(mensagem)) {
    return 'O cadastro está desligado no servidor. Fale com quem administra o SetProd.';
  }
  if (/rate limit|too many/i.test(mensagem)) {
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  }
  return mensagem;
}
