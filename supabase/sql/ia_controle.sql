-- Controle de uso da IA — rode uma vez no SQL Editor do Supabase.
--
-- Resolve dois problemas diferentes:
--
--  1. `ia_chamadas` é o TETO. Conta cada chamada à IA no dia. Quem impõe é a
--     Edge Function, no servidor: não adianta mexer no navegador para burlar.
--
--  2. `ia_execucoes` é a FILA. Uma análise de roteiro por vez, para duas
--     pessoas não dispararem 60 chamadas simultâneas sem querer. É também o
--     que permite mostrar "fulano está analisando, aguarde".

-- ---------- 1. Teto de chamadas ----------
create table if not exists public.ia_chamadas (
  id bigserial primary key,
  user_id uuid,
  criado_em timestamptz not null default now()
);

create index if not exists ia_chamadas_criado_em_idx on public.ia_chamadas (criado_em desc);

alter table public.ia_chamadas enable row level security;

-- Ninguém no app escreve aqui direto: só a Edge Function, que usa a chave de
-- serviço e ignora RLS. Deixamos apenas leitura, para a tela poder mostrar
-- quanto já foi usado hoje.
create policy "auth_select_ia_chamadas"
on public.ia_chamadas for select
to authenticated
using (true);

-- ---------- 2. Fila de análises ----------
create table if not exists public.ia_execucoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nome text,
  projeto text,
  status text not null default 'rodando',
  total int not null default 0,
  feito int not null default 0,
  iniciado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists ia_execucoes_status_idx on public.ia_execucoes (status, atualizado_em desc);

alter table public.ia_execucoes enable row level security;

-- Todo mundo enxerga a fila (é o ponto: saber quem está rodando).
create policy "auth_select_ia_execucoes"
on public.ia_execucoes for select
to authenticated
using (true);

-- Cada um só cria e atualiza a própria execução.
create policy "auth_insert_ia_execucoes"
on public.ia_execucoes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "auth_update_ia_execucoes"
on public.ia_execucoes for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
