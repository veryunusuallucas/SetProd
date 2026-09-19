-- =============================================================================
-- SetProd — Auditoria que não pode ser apagada (ROADMAP, Etapa 7)
-- =============================================================================
--
-- O PROBLEMA
-- `logs` viajava pelo espelho (`registros`) como qualquer tabela. Então quem
-- apagava o próprio log aqui mandava a lápide para o servidor, e o registro
-- sumia PARA TODO MUNDO. Log que o auditado apaga não é auditoria — e num app
-- que cuida de dinheiro, essa diferença deixa de ser acadêmica no primeiro
-- desentendimento sobre um pagamento.
--
-- A SAÍDA
-- Uma tabela só de inserção. Ninguém autenticado altera nem apaga — nem o dono.
-- É o ponto: se o dono pudesse limpar, voltaríamos ao começo.
--
-- COMO RODAR
-- SQL Editor, arquivo inteiro. Idempotente. Pode rodar antes ou depois do
-- `escopo.sql`; não depende dele. A Parte 3 copia os logs que já existem.


-- =============================================================================
-- PARTE 1 — A tabela
-- =============================================================================

create table if not exists public.auditoria (
  -- Gerado no aparelho: um log criado sem sinal sobe mais tarde, talvez duas
  -- vezes (a rede cai no meio). O id repetido é o que faz a segunda ser ignorada.
  id          uuid primary key,
  projeto_id  text not null,
  autor_id    uuid default auth.uid(),
  autor_nome  text,
  acao        text not null,
  entidade    text not null,
  entidade_id text,
  detalhes    text,
  -- Quando aconteceu (relógio do aparelho) e quando chegou (do servidor). O
  -- cursor de leitura usa o do servidor, pelo mesmo motivo do `registros`.
  data_hora   bigint not null,
  recebido_em timestamptz not null default now()
);

create index if not exists idx_auditoria_cursor
  on public.auditoria (projeto_id, recebido_em);


-- =============================================================================
-- PARTE 2 — Quem faz o quê
-- =============================================================================

alter table public.auditoria enable row level security;

-- Ler: quem é da produção. A ata é de todo mundo.
drop policy if exists "auditoria: membros leem" on public.auditoria;
create policy "auditoria: membros leem" on public.auditoria
  for select to authenticated
  using (public.e_membro(projeto_id));

-- Escrever: só em nome de si mesmo. Sem o `autor_id = auth.uid()`, qualquer
-- membro assinaria um log com o nome de outro.
drop policy if exists "auditoria: cada um registra o seu" on public.auditoria;
create policy "auditoria: cada um registra o seu" on public.auditoria
  for insert to authenticated
  with check (public.e_membro(projeto_id) and autor_id = auth.uid());

-- E nada de update nem delete. Não basta não ter política: tira o privilégio,
-- para que um `grant` amplo rodado por outro motivo não reabra a porta.
revoke update, delete, truncate on public.auditoria from authenticated, anon;

-- O `on conflict do nothing` do app (reenvio do mesmo log) não precisa de
-- update: ele só precisa de insert. Por isso o revoke acima não o quebra.


-- =============================================================================
-- PARTE 3 — Trazer os logs que já existiam no espelho
-- =============================================================================
--
-- Só os vivos, só os que têm id no formato certo. `autor_id` antigo pode ser
-- 'offline_user' (log feito sem conta): esse entra sem autor, com o nome.

insert into public.auditoria (id, projeto_id, autor_id, autor_nome, acao, entidade, entidade_id, detalhes, data_hora, recebido_em)
select
  (r.dados->>'id')::uuid,
  r.projeto_id,
  case when r.dados->>'autor_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       then (r.dados->>'autor_id')::uuid end,
  r.dados->>'autor_nome',
  coalesce(r.dados->>'acao', 'editar'),
  coalesce(r.dados->>'entidade', 'projeto'),
  r.dados->>'entidade_id',
  r.dados->>'detalhes',
  coalesce((r.dados->>'data_hora')::bigint, r.atualizado_em),
  r.recebido_em
from public.registros r
where r.tabela = 'logs'
  and not r.deletado
  and r.dados->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict (id) do nothing;

-- As linhas de `logs` no `registros` ficam onde estão: o app novo não as lê
-- mais, e apagá-las seria justamente o que esta etapa existe para impedir.


-- =============================================================================
-- PARTE 4 — Como conferir
-- =============================================================================
--
-- Pelo app, numa conta qualquer da produção, no console:
--
--   await supabase.from('auditoria').delete().eq('projeto_id', '<id>')
--
-- Tem que voltar SEM apagar nada (erro de permissão, ou sucesso com zero
-- linhas — RLS barrada não dá erro). Conte antes e depois:
--
--   select count(*) from public.auditoria where projeto_id = '<id>';
