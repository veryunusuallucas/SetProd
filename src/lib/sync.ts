import { db } from '../db/db';
import { supabase, supabaseConfigurado } from './supabase';

export const TABELA_FICHA = 'fichas_publicas';

/** Mensagem única quando a tabela ainda não existe no Supabase. */
export const SQL_FICHA_PUBLICA = `create table fichas_publicas (
  projeto_id    text primary key,
  nome_projeto  text,
  campos        jsonb not null default '[]'::jsonb,
  obrigatorios  jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now()
);

alter table fichas_publicas enable row level security;

-- quem preenche o link NÃO está logado, por isso a leitura é pública
create policy "ficha: leitura publica" on fichas_publicas
  for select to anon, authenticated using (true);

-- só quem está logado no app publica
create policy "ficha: escrita autenticada" on fichas_publicas
  for insert to authenticated with check (true);
create policy "ficha: atualizacao autenticada" on fichas_publicas
  for update to authenticated using (true) with check (true);`;

function ehTabelaAusente(erro: any) {
  return erro?.code === 'PGRST205' || /schema cache|does not exist/i.test(erro?.message || '');
}

/**
 * Publica a definição da ficha no Supabase.
 *
 * O Construtor de Ficha grava no IndexedDB (local), mas o formulário do link
 * roda no navegador de outra pessoa, que só enxerga o Supabase — e sem estar
 * logada. Por isso a ficha vai para uma tabela dedicada, com só o que o
 * formulário precisa: expor a tabela `projetos` inteira ao público vazaria
 * orçamento, PIX do caixa e afins.
 *
 * Chamada automaticamente a cada alteração do construtor e ao copiar o link.
 */
export async function publicarFichaPublica(projetoId: string): Promise<void> {
  if (!supabaseConfigurado) {
    throw new Error('Supabase não está configurado neste ambiente.');
  }

  const projeto = await db.projetos.get(projetoId);
  if (!projeto) throw new Error('Projeto não encontrado.');

  const { error } = await supabase.from(TABELA_FICHA).upsert(
    {
      projeto_id: projeto.id,
      nome_projeto: projeto.nome,
      campos: projeto.campos_customizados || [],
      obrigatorios: projeto.campos_obrigatorios || [],
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'projeto_id' }
  );

  if (!error) return;

  console.error('[SetProd] Falha ao publicar a ficha:', error);
  if (ehTabelaAusente(error)) {
    throw new Error(`a tabela "${TABELA_FICHA}" não existe no Supabase (crie-a com o SQL da documentação).`);
  }
  throw new Error(error.message || 'não foi possível publicar no Supabase.');
}

/** Lê a definição publicada. Devolve null quando ainda não há ficha publicada. */
export async function lerFichaPublica(projetoId: string) {
  const { data, error } = await supabase
    .from(TABELA_FICHA)
    .select('campos, obrigatorios')
    .eq('projeto_id', projetoId)
    .maybeSingle();

  if (error) {
    if (ehTabelaAusente(error)) {
      console.warn(`[SetProd] Tabela "${TABELA_FICHA}" não existe no Supabase — o link mostra só os campos padrão.`);
      return null;
    }
    throw error;
  }
  return data;
}

export async function syncPerfisDeCadastro(projetoId: string) {
  try {
    // 1. Puxa todos os perfis desse projeto que estão no Supabase
    const { data: perfisRemotos, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('projeto_id', projetoId);

    if (error) {
      console.error("Erro ao puxar perfis do Supabase:", error);
      throw error;
    }

    if (!perfisRemotos) return;

    // 2. Compara com os locais e insere os que não existem (ou atualiza)
    // Dexie bulkPut faz upsert (atualiza se existir, cria se não existir)
    
    // Precisamos garantir que os dados remotos não sobrescrevam dados locais mais recentes (se tivéssemos sync bidirecional complexo).
    // Para simplificar agora, como o form público só insere, e o produtor que edita:
    // Nós faremos um bulkPut de tudo que veio, mas focando em novos cadastros.
    
    await db.perfis.bulkPut(perfisRemotos);
    
    return perfisRemotos.length;
  } catch (e) {
    console.error("Falha na sincronização:", e);
    throw e;
  }
}
