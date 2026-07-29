import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigurado = Boolean(supabaseUrl && supabaseKey);

if (!supabaseConfigurado) {
  console.warn('[SetProd] Supabase URL/Key ausentes. Login e sync ficam indisponíveis (configure as variáveis de ambiente no Vercel).');
}

// Usa placeholders quando as chaves faltam, para o createClient NÃO lançar
// "supabaseUrl is required" e derrubar o app inteiro (tela branca).
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);
