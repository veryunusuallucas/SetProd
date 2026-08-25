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

/**
 * Traz para a Equipe os cadastros feitos pelo formulário público.
 *
 * A tabela `perfis` do Supabase NÃO é um par do motor de sincronização: é uma
 * caixa de entrada. Quem preenche o link não está logado e só faz `insert` —
 * nunca edita o que já mandou. Preencher a ficha duas vezes cria uma linha
 * nova, com outro id, não uma correção da anterior.
 *
 * Por isso a regra aqui é: **só entra o que ainda não existe deste lado.**
 * Nada de `bulkPut`. Duas razões, ambas já custaram dado:
 *
 * 1. `put` sobrescreve. O produtor corrige o PIX que a pessoa digitou errado,
 *    e a próxima puxada traz a versão original de volta por cima — em silêncio.
 * 2. `put` numa linha que não mudou ainda assim dispara o hook `updating`, que
 *    recarimba `atualizado_em = agora` e joga o perfil na caixa de saída. Cada
 *    puxada reenviava a equipe inteira ao servidor como se fosse edição local,
 *    e essas linhas voltavam sempre "mais novas" — o LWW desta tabela morria.
 *
 * O que NÃO fazer aqui: `marcarTransacaoComoRemota()`. Seria o reflexo certo em
 * qualquer outro lugar, mas estas linhas não vêm do espelho — vêm de fora dele.
 * Silenciar o hook faria o cadastro novo entrar só neste aparelho e nunca subir
 * para `registros`, e as outras equipes jamais veriam a pessoa. Cadastro que
 * chega é dado novo, e dado novo tem que ser enfileirado como qualquer outro.
 *
 * Devolve quantos cadastros novos entraram — zero é a resposta normal.
 */
export async function syncPerfisDeCadastro(projetoId: string): Promise<number> {
  const { data: perfisRemotos, error } = await supabase
    .from('perfis')
    .select('*')
    .eq('projeto_id', projetoId);

  if (error) {
    console.error('[SetProd] Erro ao puxar cadastros do Supabase:', error);
    throw error;
  }
  if (!perfisRemotos?.length) return 0;

  const jaTemos = new Set(
    await db.perfis.where('id').anyOf(perfisRemotos.map(p => p.id)).primaryKeys()
  );
  const novos = perfisRemotos.filter(p => !jaTemos.has(p.id));
  if (!novos.length) return 0;

  // `bulkAdd`, não `bulkPut`: se algo escapou do filtro acima, quero o erro,
  // não uma sobrescrita silenciosa. O hook `creating` carimba a hora e enfileira
  // para o espelho, que é como o cadastro chega às outras equipes.
  await db.perfis.bulkAdd(novos as any);
  return novos.length;
}
