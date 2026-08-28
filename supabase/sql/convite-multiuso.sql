-- =============================================================================
-- SetProd — Link de convite reutilizável, com interruptor
-- =============================================================================
--
-- O QUE MUDA
-- Até aqui todo convite era de uso único: a Edge Function gravava `usado_por` e
-- o link morria. A intenção era boa — link vaza fácil, e um link por pessoa
-- limita o estrago de um encaminhamento.
--
-- Só que o caso real é outro: mandar um link no grupo da produção, cinco pessoas
-- entrarem, e desligar. Com uso único isso vira cinco links, cinco mensagens e
-- cinco chances de mandar o errado para a pessoa errada.
--
-- Agora os dois modos convivem. O de uso único continua sendo o padrão.
--
-- COMO RODAR
-- SQL Editor, arquivo inteiro. É idempotente e não mexe em nenhuma política.

alter table public.convites add column if not exists multiuso boolean not null default false;
alter table public.convites add column if not exists ativo    boolean not null default true;
alter table public.convites add column if not exists usos     integer not null default 0;

comment on column public.convites.multiuso is
  'true = o link nao queima ao ser usado. Aceita quantas pessoas entrarem enquanto ativo=true e nao expirar.';

comment on column public.convites.ativo is
  'O interruptor. Desligar para de aceitar sem apagar o convite - o historico de quantos entraram continua.';

comment on column public.convites.usos is
  'Quantas pessoas entraram por este link. Em convite de uso unico vai a 1 e para.';

-- O `update` de quem aceita continua sendo feito SÓ pela Edge Function, com
-- service role. Nenhuma política nova é necessária, e é de propósito: se o
-- cliente pudesse escrever aqui, ele poderia religar um convite desligado.
--
-- Desligar e religar passam pelo `update` do dono, que a política de convites
-- ainda não permite — por isso a Parte 2.

-- =============================================================================
-- PARTE 2 — Quem administra pode ligar e desligar
-- =============================================================================
--
-- ⚠️ O GRANT DE COLUNA É A TRAVA. Sem ele, "pode dar update em convites" seria
-- "pode editar QUALQUER coluna de convites" — inclusive `papel` (transformar um
-- convite de leitura em admin depois de mandá-lo) e `usado_por` (destravar um
-- convite de uso único já gasto). O mesmo raciocínio do `perfil_id` em
-- `projeto_membros`.

revoke update on public.convites from authenticated;
grant  update (ativo) on public.convites to authenticated;

drop policy if exists "convites: quem gere liga e desliga" on public.convites;
create policy "convites: quem gere liga e desliga" on public.convites
  for update to authenticated
  using (public.pode_gerir(projeto_id))
  with check (public.pode_gerir(projeto_id));

-- Confira depois de rodar — só `ativo` pode aparecer:
--
--   select column_name, privilege_type
--     from information_schema.column_privileges
--    where table_name = 'convites' and grantee = 'authenticated'
--      and privilege_type = 'UPDATE';
