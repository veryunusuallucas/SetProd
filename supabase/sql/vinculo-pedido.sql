-- =============================================================================
-- VÍNCULO COM A FICHA: quem administra confirma
-- =============================================================================
--
-- O FURO
-- `projeto_membros.perfil_id` diz "esta conta é esta ficha". Desde o
-- `fichas.sql`, é ele que libera CPF, conta e ficha médica: a própria pessoa vê
-- a própria ficha inteira. E cada membro podia escrever o próprio `perfil_id`
-- (o grant de coluna do `multiusuario.sql`). Bastava escolher "Vitória Faria"
-- em "Eu, nesta produção" para ler o CPF e a ficha médica da Vitória.
--
-- O QUE MUDA
-- O membro não escreve mais `perfil_id`. Ele escreve `perfil_pedido` — "eu sou
-- esta" —, e o pedido só vira vínculo em três casos:
--
--   1. quem pede é dono ou admin: já vê todas as fichas, não ganha nada;
--   2. a pessoa ainda não tinha ficha e o e-mail da ficha é o da conta: é ela
--      mesma, e ninguém precisa confirmar o óbvio;
--   3. quem administra confirma, em Quem tem acesso (Edge Function `membros`,
--      ação `vincular_perfil`, que zera o pedido).
--
-- Enquanto isso, o pedido não dá direito a nada: `pode_ver_ficha` e o escopo
-- por departamento continuam lendo só `perfil_id`.
--
-- COMO RODAR
-- SQL Editor, arquivo inteiro, depois do `fichas.sql`. Idempotente.
-- O app que escreve `perfil_pedido` sai junto: até atualizar, quem estiver no
-- app antigo recebe um erro ao escolher a própria ficha — e é o certo.

alter table public.projeto_membros add column if not exists perfil_pedido text;

-- O membro mexe na própria linha só por esta coluna agora.
revoke update on public.projeto_membros from authenticated;
grant  update (perfil_pedido) on public.projeto_membros to authenticated;


create or replace function public.guarda_vinculo_da_ficha()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email_conta text;
  v_email_ficha text;
begin
  -- Service role (Edge Functions) e quem mexe na linha de outro: não é o
  -- membro falando de si, e o grant/RLS já cuidam do resto.
  if auth.uid() is null or new.usuario_id <> auth.uid() then
    return new;
  end if;

  -- O vínculo nunca muda por aqui. O grant já impede; isto é a segunda tranca.
  new.perfil_id := old.perfil_id;
  new.papel     := old.papel;

  if new.perfil_pedido is null
     or new.perfil_pedido is not distinct from old.perfil_pedido then
    return new;
  end if;

  -- Pedir a ficha que já é sua não é pedido.
  if new.perfil_pedido = old.perfil_id then
    new.perfil_pedido := null;
    return new;
  end if;

  -- Ficha de outra conta não se pede.
  if exists (
    select 1 from public.projeto_membros
     where projeto_id = new.projeto_id
       and perfil_id = new.perfil_pedido
       and usuario_id <> new.usuario_id
  ) then
    raise exception 'Esta ficha já é de outra pessoa da produção.' using errcode = '42501';
  end if;

  -- 1. Quem administra já vê tudo.
  if old.papel in ('dono', 'admin') then
    new.perfil_id := new.perfil_pedido;
    new.perfil_pedido := null;
    return new;
  end if;

  -- 2. Primeira ficha, e com o e-mail da própria conta.
  if old.perfil_id is null then
    select lower(trim(email)) into v_email_conta from auth.users where id = auth.uid();
    select lower(trim(dados ->> 'email')) into v_email_ficha
      from public.registros
     where projeto_id = new.projeto_id and tabela = 'perfis'
       and id = new.perfil_pedido and not deletado;

    if v_email_conta is not null and v_email_conta <> '' and v_email_ficha = v_email_conta then
      new.perfil_id := new.perfil_pedido;
      new.perfil_pedido := null;
    end if;
  end if;

  -- 3. O resto espera quem administra.
  return new;
end;
$$;

drop trigger if exists trg_guarda_vinculo_da_ficha on public.projeto_membros;
create trigger trg_guarda_vinculo_da_ficha
  before update on public.projeto_membros
  for each row execute function public.guarda_vinculo_da_ficha();


-- =============================================================================
-- Como conferir
-- =============================================================================
--
-- 1. A coluna e o trigger existem (os dois têm que dar true):
--      select
--        exists (select 1 from information_schema.columns
--                 where table_name = 'projeto_membros' and column_name = 'perfil_pedido') as coluna_ok,
--        exists (select 1 from pg_trigger where tgname = 'trg_guarda_vinculo_da_ficha') as trigger_ok;
--
-- 2. Numa conta 'equipe', escolher em "Eu, nesta produção" a ficha de OUTRA
--    pessoa: aparece "aguardando confirmação", e o CPF dela continua escondido.
--    Em Quem tem acesso, a conta de admin vê o pedido e confirma ou recusa.
--
-- 3. Quem já estava vinculado a uma ficha errada: o vínculo antigo continua.
--    Confira a lista em Quem tem acesso e corrija lá, se precisar.
