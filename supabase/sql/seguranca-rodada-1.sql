-- =============================================================================
-- SetProd — Segurança, rodada 1 (.md/PLANO-seguranca.md, passos A1–A10)
-- =============================================================================
--
-- O QUE ESTE ARQUIVO FECHA (achados da auditoria de 06/10/2026)
--   A1  #2  vínculo de ficha tomado reescrevendo o e-mail de outra ficha
--   A2  #7  qualquer conta reescrevia o cadastro público de qualquer produção
--   A3  #10 pesquisas e respostas legíveis/apagáveis por qualquer conta
--   A4  #6  lápide com conteúdo burlava a guarda do departamento
--   A5  #5  linha com `dados.id` diferente do id da linha (sync envenenado)
--   A6  #8  `lixeira_em` antigo forjado fazia o dono destruir a produção
--   A7  #4  purga deixava a caixa de cadastros e o id podia ser refundado
--   A8a #1  RPC `ler_convite` (a política de leitura só fecha na rodada 4)
--   A9      `search_path` fixo nas 4 funções que não tinham
--   A10     `anon` deixa de executar as funções SECURITY DEFINER
--
-- COMO RODAR
-- SQL Editor do Supabase, arquivo inteiro. Está numa transação: ou entra tudo,
-- ou nada. Idempotente: rodar duas vezes não quebra nada.
--
-- Conferido no banco (só leitura, 07/10) antes de escrever:
--   - 0 linhas vivas com `dados.id` ≠ id ou `dados.projeto_id` ≠ projeto_id;
--   - 0 lápides com `dados`;
--   - nenhuma política de `anon` chama função; nenhuma tela pública usa .rpc().
--
-- ⚠️ O SQL EDITOR NÃO TEM `auth.uid()`: os testes são pelo app (fim do arquivo).

begin;


-- =============================================================================
-- A1 + A4 + A5 + A6 — Um gatilho de entrada em `registros`
-- =============================================================================
--
-- Roda antes dos outros gatilhos de `registros` (ordem alfabética do nome:
-- "trg_coerencia" < "trg_guarda_*" < "trg_separar_ficha"), então a lápide já
-- chega vazia na guarda do departamento.
--
-- Erro sempre 42501: o app já trata como recusa de RLS (tira da fila, devolve a
-- versão do servidor e avisa — `empurrar()` em src/lib/sincronizacao.ts).
--
-- A1, por que não só "remover o vínculo por e-mail" como a auditoria sugeriu:
-- `EscolherMinhaFicha` deixa quem entra criar a PRÓPRIA ficha (com o e-mail da
-- conta e, às vezes, um departamento) e ser vinculado na hora. Tirar o ramo do
-- e-mail quebraria esse fluxo. O furo não está no vínculo, está em o e-mail de
-- uma ficha alheia poder ser reescrito por quem não gerencia. Fechando isso
-- (correção 2 do detalhe), o e-mail de uma ficha volta a ser algo que só quem
-- administra, a própria pessoa ou o cadastro público escreveram.

create or replace function public.coerencia_do_registro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agora bigint := (extract(epoch from now()) * 1000)::bigint;
  v_antes jsonb;
begin
  -- A4: lápide nunca carrega conteúdo.
  if new.deletado then
    new.dados := null;
    return new;
  end if;

  -- A5: o id de dentro é o id da linha, e o projeto de dentro é o da linha.
  if new.dados->>'id' is distinct from new.id
     or (new.dados ? 'projeto_id' and new.dados->>'projeto_id' is distinct from new.projeto_id)
     or (new.tabela = 'projetos' and new.id <> new.projeto_id)
  then
    raise exception 'Registro incoerente: o id ou a produção de dentro não batem com a linha.'
      using errcode = '42501';
  end if;

  -- A1: e-mail de ficha alheia só muda por quem administra.
  -- (auth.uid() nulo = Edge Function com a chave do servidor: passa.)
  if tg_op = 'UPDATE'
     and new.tabela = 'perfis'
     and auth.uid() is not null
     and nullif(lower(trim(coalesce(old.dados->>'email', ''))), '')
         is distinct from nullif(lower(trim(coalesce(new.dados->>'email', ''))), '')
     and new.id is distinct from public.meu_perfil_id(new.projeto_id)
     and not public.pode_gerir(new.projeto_id)
  then
    raise exception 'Trocar o e-mail da ficha de outra pessoa é com quem administra a produção.'
      using errcode = '42501';
  end if;

  -- A6: a hora em que a produção foi para a lixeira é a do servidor.
  if new.tabela = 'projetos' then
    v_antes := case when tg_op = 'UPDATE' and not old.deletado then old.dados else null end;

    if new.dados->'lixeira_em' is null or jsonb_typeof(new.dados->'lixeira_em') = 'null' then
      null;  -- saiu da lixeira (ou nunca esteve): passa.
    elsif v_antes is not null and jsonb_typeof(v_antes->'lixeira_em') = 'number' then
      -- Já estava na lixeira: a marca não muda (nem para trás, nem para frente).
      new.dados := new.dados
        || jsonb_build_object('lixeira_em', v_antes->'lixeira_em')
        || jsonb_build_object('lixeira_por', v_antes->'lixeira_por');
    else
      -- Entrou agora: carimba hora e autor.
      new.dados := new.dados
        || jsonb_build_object('lixeira_em', v_agora)
        || jsonb_build_object('lixeira_por', coalesce(auth.uid()::text, new.dados->>'lixeira_por'));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_coerencia_do_registro on public.registros;
create trigger trg_coerencia_do_registro
  before insert or update on public.registros
  for each row execute function public.coerencia_do_registro();


-- =============================================================================
-- A2 — Cadastro público: só quem gerencia escreve (leitura continua pública)
-- =============================================================================

drop policy if exists "ficha: escrita autenticada" on public.fichas_publicas;
create policy "ficha: escrita autenticada" on public.fichas_publicas
  for insert to authenticated
  with check (public.pode_gerir(projeto_id));

drop policy if exists "ficha: atualizacao autenticada" on public.fichas_publicas;
create policy "ficha: atualizacao autenticada" on public.fichas_publicas
  for update to authenticated
  using (public.pode_gerir(projeto_id))
  with check (public.pode_gerir(projeto_id));


-- =============================================================================
-- A3 — Pesquisas presas à produção
-- =============================================================================
-- Pesquisa é tabela "comum" no escopo (equipe escreve), por isso pode_escrever.
-- O envio anônimo confere a pesquisa em `pesquisas_publicas`, que `anon` lê.

drop policy if exists "pesquisa: escrita autenticada" on public.pesquisas_publicas;
drop policy if exists "pesquisa: atualizacao autenticada" on public.pesquisas_publicas;
drop policy if exists "pesquisa: remocao autenticada" on public.pesquisas_publicas;
drop policy if exists "pesquisa: escrita membro" on public.pesquisas_publicas;
drop policy if exists "pesquisa: atualizacao membro" on public.pesquisas_publicas;
drop policy if exists "pesquisa: remocao membro" on public.pesquisas_publicas;

create policy "pesquisa: escrita membro" on public.pesquisas_publicas
  for insert to authenticated
  with check (public.pode_escrever(projeto_id));
create policy "pesquisa: atualizacao membro" on public.pesquisas_publicas
  for update to authenticated
  using (public.pode_escrever(projeto_id))
  with check (public.pode_escrever(projeto_id));
create policy "pesquisa: remocao membro" on public.pesquisas_publicas
  for delete to authenticated
  using (public.pode_escrever(projeto_id));

drop policy if exists "resposta: envio publico" on public.respostas_pesquisa;
drop policy if exists "resposta: leitura autenticada" on public.respostas_pesquisa;
drop policy if exists "resposta: remocao autenticada" on public.respostas_pesquisa;
drop policy if exists "resposta: leitura membro" on public.respostas_pesquisa;
drop policy if exists "resposta: remocao membro" on public.respostas_pesquisa;

create policy "resposta: envio publico" on public.respostas_pesquisa
  for insert to anon, authenticated
  with check (exists (
    select 1 from public.pesquisas_publicas p
     where p.id = pesquisa_id
       and p.projeto_id = respostas_pesquisa.projeto_id
       and p.aberta
  ));
create policy "resposta: leitura membro" on public.respostas_pesquisa
  for select to authenticated
  using (public.e_membro(projeto_id));
create policy "resposta: remocao membro" on public.respostas_pesquisa
  for delete to authenticated
  using (public.pode_escrever(projeto_id));


-- =============================================================================
-- A7 — Purga completa e id aposentado
-- =============================================================================

create table if not exists public.projetos_purgados (
  projeto_id text primary key,
  purgado_em timestamptz not null default now()
);
alter table public.projetos_purgados enable row level security;
-- Sem políticas: só as funções SECURITY DEFINER abaixo mexem nela.

create or replace function public.projeto_livre_para_fundar(p_projeto text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select not exists (select 1 from public.projeto_membros   where projeto_id = p_projeto)
     and not exists (select 1 from public.registros         where projeto_id = p_projeto)
     and not exists (select 1 from public.perfis            where projeto_id = p_projeto)
     and not exists (select 1 from public.auditoria         where projeto_id = p_projeto)
     and not exists (select 1 from public.projetos_purgados where projeto_id = p_projeto);
$$;

create or replace function public.purgar_projeto(p_projeto text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  apagados integer;
begin
  if not public.pode_destruir(p_projeto) then
    raise exception 'so quem criou a producao (ou o admin) pode apaga-la de vez';
  end if;

  insert into public.projetos_purgados (projeto_id) values (p_projeto) on conflict do nothing;

  delete from public.registros where projeto_id = p_projeto;
  get diagnostics apagados = row_count;

  delete from public.convites           where projeto_id = p_projeto;
  delete from public.perfis             where projeto_id = p_projeto;
  delete from public.fichas_publicas    where projeto_id = p_projeto;
  delete from public.respostas_pesquisa where projeto_id = p_projeto;
  delete from public.pesquisas_publicas where projeto_id = p_projeto;
  delete from public.projeto_membros    where projeto_id = p_projeto;
  -- `auditoria` fica (é imutável); o id aposentado impede que alguém a herde.

  return apagados;
end;
$$;


-- =============================================================================
-- A8a — Ler um convite pelo token, sem abrir a tabela
-- =============================================================================
-- Só cria a função. A política "convites: leitura por quem tem o token"
-- (using true) continua até o app que usa esta RPC estar no ar — senão a tela
-- de aceite quebra. Fechar na rodada 4.

create or replace function public.ler_convite(p_token text)
returns table (
  token text, projeto_id text, nome_projeto text, papel text, apelido text,
  expira_em timestamptz, usado_por uuid, perfil_id text, email_esperado text,
  multiuso boolean, ativo boolean, usos integer
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select c.token, c.projeto_id, c.nome_projeto, c.papel, c.apelido, c.expira_em,
         c.usado_por, c.perfil_id, c.email_esperado, c.multiuso, c.ativo, c.usos
    from public.convites c
   where c.token = p_token;
$$;


-- =============================================================================
-- A9 — search_path fixo (advisor function_search_path_mutable)
-- =============================================================================
-- guarda_lww_acervo é do SetGear: o corpo só usa new/old/now(), fixar o
-- caminho não muda nada nele.

alter function public.guarda_lww()                 set search_path = public, pg_temp;
alter function public.guarda_lww_acervo()          set search_path = public, pg_temp;
alter function public.resumo_so_contagens(jsonb)   set search_path = public, pg_temp;
alter function public.quem_sou_eu()                set search_path = public, pg_temp;


-- =============================================================================
-- A10 — anon não executa SECURITY DEFINER (advisor, 23 funções + as novas)
-- =============================================================================
-- Revogar de `public` sozinho tiraria também de `authenticated` (as políticas
-- de registros chamam pode_escrever, escopo_permite...). Por isso: tira de
-- public e anon, devolve a authenticated. Funções de gatilho não precisam de
-- EXECUTE de ninguém — ficam só sem public/anon.
-- Só as SECURITY DEFINER: as outras rodam com o privilégio de quem chama.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura,
           p.prorettype::regtype::text in ('trigger', 'event_trigger') as de_gatilho
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', f.assinatura);
    if not f.de_gatilho then
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end;
$$;

commit;


-- =============================================================================
-- Como conferir (SQL Editor, depois de rodar)
-- =============================================================================
--
-- 1. Nenhuma SECURITY DEFINER executável por anon (tem que voltar 0 linhas):
--      select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public' and p.prosecdef
--         and has_function_privilege('anon', p.oid, 'execute');
--
-- 2. O gatilho existe:
--      select tgname from pg_trigger where tgname = 'trg_coerencia_do_registro';
--
-- 3. Advisors de segurança do Supabase: somem
--    anon_security_definer_function_executable e function_search_path_mutable.
--
-- Pelo app (conta e produção de TESTE, nunca dado real):
--
-- 4. O app continua abrindo, sincronizando e salvando normalmente (é o teste
--    de que o A10 não tirou nada de quem está logado).
-- 5. A1 — conta 'equipe' sem ficha, no console do app:
--      await supabase.from('registros').update({ dados: { ...<ficha de outro>, email: '<meu e-mail>' },
--        atualizado_em: Date.now() }).eq('tabela', 'perfis').eq('id', '<id da ficha>')
--    → erro 42501. E "Quem é você nesta produção?" → criar a própria ficha
--    continua vinculando na hora.
-- 6. A5 — gravar uma linha com dados.id diferente do id → 42501.
-- 7. A6 — mandar uma produção para a lixeira e olhar `dados->>'lixeira_em'`
--    no servidor: é a hora do servidor, não a do aparelho.
-- 8. A3 — responder uma pesquisa aberta pelo link sem login continua
--    funcionando; numa pesquisa fechada, a resposta é recusada.
-- 9. A2 — conta 'equipe' editando o cadastro público → recusado; admin → ok.
