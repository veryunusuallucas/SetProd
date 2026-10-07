/**
 * A regra de senha do app — a MESMA configurada no Supabase (Authentication →
 * Sign In / Providers → Email): pelo menos 8 caracteres, com letras e números.
 *
 * Conferir aqui antes de mandar é só para a pessoa ler o motivo em português;
 * quem barra de verdade é o servidor. Se mudar lá, mude aqui.
 *
 * A proteção contra senha vazada (HaveIBeenPwned) é do plano Pro do Supabase;
 * enquanto o projeto for gratuito, esta é a trava que existe.
 */
export const MINIMO_DA_SENHA = 8;

export function problemaNaSenha(senha: string): string | null {
  if (senha.length < MINIMO_DA_SENHA) return `A senha precisa de pelo menos ${MINIMO_DA_SENHA} caracteres.`;
  if (!/\p{L}/u.test(senha) || !/\d/.test(senha)) return 'A senha precisa ter letras e números.';
  return null;
}
