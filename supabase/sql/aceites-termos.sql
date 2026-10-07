-- =============================================================================
-- SetProd — Aceite dos termos (.md/PLANO-boas-vindas.md)
-- =============================================================================
--
-- O recibo de que uma conta marcou "Li e aceito os termos", e de qual versão.
-- Só de inserção: ninguém edita nem apaga — nem a própria pessoa. É isso que
-- faz dele um registro, e não uma preferência.
--
-- A hora é a do SERVIDOR (`default now()`, sem como mandar outra): o aparelho
-- pode estar com o relógio errado, e um recibo com data inventada não vale nada.
--
-- COMO RODAR
-- SQL Editor do Supabase, arquivo inteiro. Idempotente.

create table if not exists public.aceites_termos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  versao      text not null check (length(versao) between 1 and 40),
  aceito_em   timestamptz not null default now(),
  user_agent  text check (user_agent is null or length(user_agent) <= 400)
);

create index if not exists aceites_termos_usuario_idx
  on public.aceites_termos (usuario_id, versao);

alter table public.aceites_termos enable row level security;

-- Só em nome próprio, e sem escolher a hora.
drop policy if exists "aceites: cada um registra o seu" on public.aceites_termos;
create policy "aceites: cada um registra o seu" on public.aceites_termos
  for insert to authenticated
  with check (usuario_id = auth.uid());

-- Cada um vê os próprios; o super-admin vê todos (para responder "quem aceitou?").
drop policy if exists "aceites: cada um le o seu" on public.aceites_termos;
create policy "aceites: cada um le o seu" on public.aceites_termos
  for select to authenticated
  using (usuario_id = auth.uid() or public.e_admin());

-- Sem política de update/delete: recusado para todos (a RLS nega o que não libera).
-- E a coluna da hora não aceita valor do cliente:
revoke insert on public.aceites_termos from anon, authenticated;
grant  insert (versao, user_agent) on public.aceites_termos to authenticated;
grant  select on public.aceites_termos to authenticated;
revoke update, delete, truncate on public.aceites_termos from anon, authenticated;


-- =============================================================================
-- Como conferir
-- =============================================================================
--
-- Quem aceitou qual versão (SQL Editor):
--   select a.versao, a.aceito_em, u.email
--     from public.aceites_termos a join auth.users u on u.id = a.usuario_id
--    order by a.aceito_em desc;
