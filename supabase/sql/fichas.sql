-- =============================================================================
-- SetProd — A ficha da equipe em três camadas (ROADMAP, Etapa 3 §3.C)
-- =============================================================================
--
-- O PROBLEMA
-- A leitura do espelho é global: qualquer membro lia a ficha inteira de todo
-- mundo — CPF, conta bancária, cachê, remédio de uso contínuo. Pela LGPD, saúde
-- é dado pessoal sensível (art. 5º, II). A tela escondia; o banco entregava.
--
-- A SAÍDA
-- A ficha sobe em três linhas do espelho, com o mesmo id (src/lib/fichaEmCamadas.ts):
--
--     perfis            o crachá — todo membro lê
--     perfis_restritos  documento, dinheiro, vínculo — a pessoa, dono, admin
--     perfis_medicos    ficha médica — a pessoa, dono, admin, e EMERGÊNCIA
--
-- A RLS esconde LINHA. Agora há uma linha para esconder.
--
-- COMO RODAR — A ORDEM IMPORTA
--   1. O APP NOVO PRIMEIRO. Este arquivo tira o CPF de dentro da linha `perfis`
--      (Parte 5). Um aparelho com o app antigo receberia a ficha sem CPF e o
--      mostraria vazio até atualizar.
--   2. Depois do `escopo.sql` (usa `meu_perfil_id`) e do `auditoria.sql` (a
--      emergência registra lá).
--   3. SQL Editor, arquivo inteiro. Idempotente.
--
-- ⚠️ FAÇA UM BACKUP antes (Gestão de Dados → exportar, numa conta de dono).
-- A Parte 5 mexe em dado pessoal de todas as produções.


-- =============================================================================
-- PARTE 1 — Quem pode ver as camadas de uma ficha
-- =============================================================================
--
-- Espelho de `podeVerCamada` em src/lib/camposSensiveis.ts: a própria pessoa,
-- dono, admin e o super-admin. A emergência NÃO passa por aqui — ela é
-- pontual, e registrada (Parte 4).

create or replace function public.pode_ver_ficha(p_projeto text, p_perfil text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.e_admin()
      or coalesce(public.papel_no_projeto(p_projeto) in ('dono', 'admin'), false)
      or p_perfil = public.meu_perfil_id(p_projeto);
$$;


-- =============================================================================
-- PARTE 2 — A leitura do espelho passa a esconder as camadas
-- =============================================================================
--
-- Continua global para todo o resto (Ordem do Dia, créditos e o cálculo de
-- saldos leem o projeto inteiro). A exceção é só a ficha — e é a única.
-- O Realtime obedece a esta mesma política: a camada nem chega ao vivo.

drop policy if exists "registros: membros leem" on public.registros;
create policy "registros: membros leem" on public.registros
  for select to authenticated
  using (
    public.e_membro(projeto_id)
    and (
      tabela not in ('perfis_restritos', 'perfis_medicos')
      or public.pode_ver_ficha(projeto_id, id)
    )
  );


-- =============================================================================
-- PARTE 3 — A caixa de entrada do cadastro público
-- =============================================================================
--
-- ⚠️ ESTE ERA O MAIOR VAZAMENTO. A política antiga era `using (true)` para
-- qualquer conta logada: QUALQUER pessoa com conta no SetProd, de QUALQUER
-- produção, lia o CPF, o PIX e a ficha médica de todos os cadastros de todas
-- as produções. Agora só quem administra aquela produção lê a caixa dela — é
-- quem puxa os cadastros para a equipe (`syncPerfisDeCadastro`), e a tela só
-- oferece esse botão a essas pessoas.

drop policy if exists "perfis: leitura autenticada" on public.perfis;
drop policy if exists "perfis: quem administra le" on public.perfis;
create policy "perfis: quem administra le" on public.perfis
  for select to authenticated
  using (public.pode_gerir(projeto_id));


-- =============================================================================
-- PARTE 4 — Emergência: a ficha médica de quem está no set com você
-- =============================================================================
--
-- No set, com alguém passando mal, ninguém vai achar o produtor para liberar
-- uma tela. A regra (ROADMAP §3.C): quem está escalado numa diária de hoje
-- (ou de ontem/amanhã — virada de noite e fuso) abre a ficha médica de quem
-- também está escalado nela. Acesso REGISTRADO, não bloqueado: cada abertura
-- entra na `auditoria`, que ninguém apaga.
--
-- Função, e não política de leitura: a política não tem como registrar quem
-- leu. E uma política que liberasse a camada médica para a diária inteira a
-- faria descer para o aparelho de todo mundo, o tempo todo — que é o contrário
-- de pontual.

create or replace function public.ficha_medica_de_emergencia(p_projeto text, p_perfil text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eu     text := public.meu_perfil_id(p_projeto);
  v_numero text;
  v_nome   text;
  v_dados  jsonb;
begin
  if not public.e_membro(p_projeto) then
    raise exception 'Você não participa desta produção.' using errcode = '42501';
  end if;
  if v_eu is null then
    raise exception 'Diga quem você é na equipe (Quem tem acesso) para usar o acesso de emergência.'
      using errcode = '42501';
  end if;

  select r.dados->>'numero'
    into v_numero
    from public.registros r
   where r.projeto_id = p_projeto
     and r.tabela = 'diarias'
     and not r.deletado
     and r.dados->>'data' ~ '^\d{4}-\d{2}-\d{2}$'
     and (r.dados->>'data')::date between current_date - 1 and current_date + 1
     and coalesce(r.dados->'equipe_escalada', '[]'::jsonb) ? v_eu
     and coalesce(r.dados->'equipe_escalada', '[]'::jsonb) ? p_perfil
   limit 1;

  if not found then
    raise exception 'O acesso de emergência vale entre quem está escalado na mesma diária, hoje.'
      using errcode = '42501';
  end if;

  select dados into v_dados
    from public.registros
   where projeto_id = p_projeto and tabela = 'perfis_medicos' and id = p_perfil and not deletado;

  select trim(coalesce(dados->>'nome', '') || ' ' || coalesce(dados->>'sobrenome', ''))
    into v_nome
    from public.registros
   where projeto_id = p_projeto and tabela = 'perfis' and id = p_perfil;

  insert into public.auditoria (id, projeto_id, autor_id, autor_nome, acao, entidade, entidade_id, detalhes, data_hora)
  values (
    gen_random_uuid(), p_projeto, auth.uid(), auth.jwt()->>'email', 'ver', 'perfil', p_perfil,
    'Abriu a ficha médica de ' || coalesce(nullif(v_nome, ''), 'uma pessoa')
      || ' pelo acesso de emergência (diária ' || coalesce(v_numero, '?') || ').',
    (extract(epoch from now()) * 1000)::bigint
  );

  return coalesce(v_dados, '{}'::jsonb);
end;
$$;

revoke all on function public.ficha_medica_de_emergencia(text, text) from public, anon;
grant execute on function public.ficha_medica_de_emergencia(text, text) to authenticated;


-- =============================================================================
-- PARTE 5 — Repartir as fichas que já existem
-- =============================================================================
--
-- Tira os campos protegidos de dentro da linha `perfis` e cria as duas linhas
-- de camada. O `atualizado_em + 1` faz os aparelhos tomarem a versão nova como
-- mais recente (e passa pela guarda de LWW). O app novo, ao receber a linha
-- pública, NÃO apaga o CPF que já tem — ele só some de quem não pode vê-lo, na
-- limpeza local ao abrir a produção (`limparFichasQueNaoPossoVer`).

do $$
declare
  restritos text[] := array[
    'cpf', 'rg', 'data_nascimento', 'endereco', 'valor_diaria', 'tipo_vinculo',
    'chave_pix', 'banco', 'agencia', 'conta', 'cnpj', 'razao_social'
  ];
  medicos text[] := array[
    'contato_emergencia', 'info_medica', 'tipo_sanguineo', 'alergias',
    'medicamentos_continuos', 'restricao_alimentar', 'plano_saude'
  ];
begin
  insert into public.registros (projeto_id, tabela, id, dados, atualizado_em, deletado)
  select r.projeto_id, 'perfis_restritos', r.id,
         coalesce((select jsonb_object_agg(k, v) from jsonb_each(r.dados) e(k, v) where k = any(restritos)), '{}'::jsonb)
           || jsonb_build_object('id', r.id, 'projeto_id', r.projeto_id),
         r.atualizado_em + 1, false
    from public.registros r
   where r.tabela = 'perfis' and not r.deletado and r.dados ?| restritos
  on conflict (projeto_id, tabela, id) do nothing;

  insert into public.registros (projeto_id, tabela, id, dados, atualizado_em, deletado)
  select r.projeto_id, 'perfis_medicos', r.id,
         coalesce((select jsonb_object_agg(k, v) from jsonb_each(r.dados) e(k, v) where k = any(medicos)), '{}'::jsonb)
           || jsonb_build_object('id', r.id, 'projeto_id', r.projeto_id),
         r.atualizado_em + 1, false
    from public.registros r
   where r.tabela = 'perfis' and not r.deletado and r.dados ?| medicos
  on conflict (projeto_id, tabela, id) do nothing;

  update public.registros
     set dados = dados - restritos - medicos,
         atualizado_em = atualizado_em + 1
   where tabela = 'perfis' and not deletado
     and (dados ?| restritos or dados ?| medicos);
end
$$;


-- =============================================================================
-- PARTE 6 — Como conferir
-- =============================================================================
--
-- 1. Nenhuma ficha pública com campo protegido (tem que dar zero):
--      select count(*) from public.registros
--       where tabela = 'perfis' and (dados ? 'cpf' or dados ? 'chave_pix' or dados ? 'alergias');
--
-- 2. Pelo app, numa conta 'equipe' sem ser dono, no console:
--      await supabase.from('registros').select('id').eq('tabela', 'perfis_restritos')
--    Tem que voltar só a linha da própria ficha (ou nada).
--
-- 3. Caixa do cadastro público, numa conta que não administra nada:
--      await supabase.from('perfis').select('id')
--    Tem que voltar vazio.
