-- Pesquisas para a equipe — rode uma vez no SQL Editor do Supabase.
--
-- Mesmo desenho da tabela `fichas_publicas`: quem responde pelo link NÃO está
-- logado, então precisa ler a pesquisa e gravar a resposta sem autenticação.
-- Por isso as duas tabelas são dedicadas e carregam só o necessário — expor as
-- tabelas do app ao público vazaria orçamento, PIX e a ficha da equipe.

-- ---------- Definição da pesquisa (o que o link mostra) ----------
create table if not exists public.pesquisas_publicas (
  id            text primary key,
  projeto_id    text not null,
  nome_projeto  text,
  titulo        text not null,
  descricao     text,
  perguntas     jsonb not null default '[]'::jsonb,
  aberta        boolean not null default true,
  atualizado_em timestamptz not null default now()
);

alter table public.pesquisas_publicas enable row level security;

-- Leitura pública: é o link que a equipe abre.
create policy "pesquisa: leitura publica"
on public.pesquisas_publicas for select
to anon, authenticated using (true);

-- Só quem está logado no app cria ou altera.
create policy "pesquisa: escrita autenticada"
on public.pesquisas_publicas for insert
to authenticated with check (true);

create policy "pesquisa: atualizacao autenticada"
on public.pesquisas_publicas for update
to authenticated using (true) with check (true);

create policy "pesquisa: remocao autenticada"
on public.pesquisas_publicas for delete
to authenticated using (true);

-- ---------- Respostas ----------
create table if not exists public.respostas_pesquisa (
  id          text primary key,
  pesquisa_id text not null,
  projeto_id  text not null,
  nome        text,
  respostas   jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now()
);

create index if not exists respostas_pesquisa_projeto_idx
  on public.respostas_pesquisa (projeto_id, pesquisa_id);

alter table public.respostas_pesquisa enable row level security;

-- Qualquer um responde pelo link...
create policy "resposta: envio publico"
on public.respostas_pesquisa for insert
to anon, authenticated with check (true);

-- ...mas só a produção lê o resultado. Sem isto, quem tem o link enxergaria o
-- que os colegas responderam, e enquete de equipe deixa de ser honesta.
create policy "resposta: leitura autenticada"
on public.respostas_pesquisa for select
to authenticated using (true);

create policy "resposta: remocao autenticada"
on public.respostas_pesquisa for delete
to authenticated using (true);
