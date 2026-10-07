-- =============================================================================
-- SetProd — Segurança, rodada 3 (SQL que o app da rodada 3 usa)
-- =============================================================================
--
-- RODAR ANTES DE PUBLICAR o app da rodada 3. Idempotente.
--
-- POR QUÊ
-- `limparProducoesDestruidas` (src/lib/lixeira.ts) perguntava ao servidor
-- `projeto_livre_para_fundar` para saber se outra pessoa destruiu uma produção.
-- Desde a rodada 1, um id purgado NUNCA volta a ser livre (`projetos_purgados`)
-- — e a pergunta passou a responder "não" para toda produção destruída. A cópia
-- de quem não destruiu ficaria no aparelho para sempre.
--
-- Esta função responde a pergunta certa, sem reabrir a refundação.
-- Sem ela, o app novo só deixa de limpar (o erro é tratado como "não sei").

create or replace function public.projeto_foi_destruido(p_projeto text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.projetos_purgados where projeto_id = p_projeto)
      or (not exists (select 1 from public.projeto_membros where projeto_id = p_projeto)
          and not exists (select 1 from public.registros   where projeto_id = p_projeto));
$$;

revoke execute on function public.projeto_foi_destruido(text) from public, anon;
grant  execute on function public.projeto_foi_destruido(text) to authenticated;
