-- =============================================================================
-- SetProd — As duas tabelas que vivem FORA do espelho
-- =============================================================================
--
-- POR QUE ESTE ARQUIVO EXISTE
-- Estas duas tabelas estavam em produção sem estar em lugar nenhum do
-- repositório. `fichas_publicas` vivia como string dentro de `src/lib/sync.ts`,
-- e `bug_reports` não existia em canto nenhum — só na cabeça de quem criou.
--
-- Todo o resto do app viaja pelo `registros`, o espelho genérico. Estas duas não
-- podem: as duas são lidas ou escritas por gente que NÃO ESTÁ LOGADA, e o
-- espelho inteiro é protegido por participação no projeto.
--
-- COMO RODAR
-- SQL Editor, arquivo inteiro. Idempotente — pode rodar por cima do que já
-- existe sem quebrar nada.
--
-- ⚠️ Se as tabelas já existem (e existem, em produção), este arquivo é
-- documentação executável: ele descreve o que já está lá. Rodá-lo confirma que
-- o repositório e o banco contam a mesma história.


-- =============================================================================
-- PARTE 1 — fichas_publicas
-- =============================================================================
--
-- O Construtor de Ficha grava no IndexedDB, que é local. Mas o formulário do
-- link roda no navegador de OUTRA pessoa, que só enxerga o Supabase — e sem
-- estar logada.
--
-- Por isso a ficha vai para uma tabela dedicada, com só o que o formulário
-- precisa. Expor a tabela `projetos` inteira ao público vazaria orçamento, PIX
-- do caixa e o resto.

create table if not exists public.fichas_publicas (
  projeto_id    text primary key,
  nome_projeto  text,
  campos        jsonb not null default '[]'::jsonb,
  obrigatorios  jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now()
);

alter table public.fichas_publicas enable row level security;

-- Quem preenche o link NÃO está logado — por isso a leitura é pública. A linha
-- não carrega nada além do nome do projeto e da lista de campos.
drop policy if exists "ficha: leitura publica" on public.fichas_publicas;
create policy "ficha: leitura publica" on public.fichas_publicas
  for select to anon, authenticated using (true);

drop policy if exists "ficha: escrita autenticada" on public.fichas_publicas;
create policy "ficha: escrita autenticada" on public.fichas_publicas
  for insert to authenticated with check (true);

drop policy if exists "ficha: atualizacao autenticada" on public.fichas_publicas;
create policy "ficha: atualizacao autenticada" on public.fichas_publicas
  for update to authenticated using (true) with check (true);


-- =============================================================================
-- PARTE 2 — perfis (a caixa de entrada do cadastro público)
-- =============================================================================
--
-- ⚠️ NÃO CONFUNDIR com a tabela `perfis` do Dexie. Esta aqui é uma CAIXA DE
-- ENTRADA: quem preenche o link de cadastro não está logado e só faz `insert`.
-- O produtor puxa de lá na aba Equipe (`syncPerfisDeCadastro`), e a partir dali
-- a pessoa vive no espelho como qualquer outro registro.
--
-- É por isso que `syncPerfisDeCadastro` só INSERE o que ainda não existe: esta
-- tabela é append-only por natureza, e um `put` por cima sobrescreveria a
-- correção que o produtor fez na ficha.

create table if not exists public.perfis (
  id         text primary key,
  projeto_id text not null,
  nome       text,
  criado_em  timestamptz not null default now()
);

alter table public.perfis enable row level security;

-- Insert público: é o formulário de cadastro, aberto por gente de fora.
drop policy if exists "perfis: cadastro publico" on public.perfis;
create policy "perfis: cadastro publico" on public.perfis
  for insert to anon, authenticated with check (true);

-- Leitura só para quem está logado. O cadastro traz CPF, PIX e ficha médica —
-- deixar a leitura pública transformaria o link num vazamento.
drop policy if exists "perfis: leitura autenticada" on public.perfis;
create policy "perfis: leitura autenticada" on public.perfis
  for select to authenticated using (true);

-- ⚠️ Esta tabela aceita colunas extras conforme os campos customizados da ficha.
-- Se um campo novo do Construtor não estiver aqui, o insert falha com "column
-- does not exist" — e o sintoma aparece para quem está preenchendo o formulário,
-- não para você. Ao adicionar campo fixo novo, adicione a coluna aqui.


-- =============================================================================
-- PARTE 3 — bug_reports
-- =============================================================================
--
-- O botão de relatar problema. Recebe de qualquer pessoa que esteja usando o
-- app, e por isso o insert é aberto.
--
-- A LEITURA NÃO É. Os relatos carregam `url_atual` (que tem o id da produção),
-- o user agent e as contagens do banco de quem relatou. Leitura pública faria um
-- endereço que lista as produções de todo mundo.

create table if not exists public.bug_reports (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  tipo          text not null default 'bug',
  descricao     text,
  url_atual     text,
  resolucao     text,
  user_agent    text,
  -- Os eventos capturados do console. jsonb porque o formato muda conforme o
  -- tipo de erro, e uma coluna por campo viraria migração a cada ajuste.
  erros_console jsonb default '[]'::jsonb,
  -- Tudo que não tem coluna própria: ambiente, versão do app, contagens do
  -- banco local, resumo do log. O app monta este objeto em `montarPacote()`.
  stats         jsonb default '{}'::jsonb
);

alter table public.bug_reports enable row level security;

-- Qualquer um relata — inclusive quem nem entrou na conta, que é justamente
-- quem mais precisa relatar quando o login está quebrado.
drop policy if exists "bugs: qualquer um relata" on public.bug_reports;
create policy "bugs: qualquer um relata" on public.bug_reports
  for insert to anon, authenticated with check (true);

-- Só o super-admin lê. `e_admin()` vem do `multiusuario.sql`.
drop policy if exists "bugs: so o admin le" on public.bug_reports;
create policy "bugs: so o admin le" on public.bug_reports
  for select to authenticated using (public.e_admin());

-- Sem política de update nem de delete, de propósito: relato que o relatado
-- pode editar não serve para investigar nada.


-- =============================================================================
-- PARTE 4 — Conferir
-- =============================================================================
--
--   select tablename from pg_tables
--    where schemaname = 'public'
--      and tablename in ('fichas_publicas','perfis','bug_reports');
--
-- E as políticas de cada uma:
--
--   select tablename, policyname, cmd from pg_policies
--    where tablename in ('fichas_publicas','perfis','bug_reports')
--    order by tablename, cmd;
