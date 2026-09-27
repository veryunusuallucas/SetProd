-- =============================================================================
-- SetProd — Tirar as políticas RLS antigas que anulam as novas
-- =============================================================================
--
-- POR QUE ESTE ARQUIVO EXISTE
-- O banco tinha duas gerações de política convivendo: as antigas, em inglês
-- (`auth_select_perfis`...), criadas no painel e nunca versionadas, e as novas,
-- em português, dos arquivos deste repositório.
--
-- No Postgres, políticas permissivas do MESMO comando se somam com OU: basta
-- uma liberar. Então `perfis: quem administra le` (fichas.sql) estava escrita,
-- mas não valia nada — `auth_select_perfis` com `using (true)` deixava qualquer
-- conta logada, de qualquer produção, ler a caixa de entrada do cadastro
-- público inteira: CPF, PIX, dados bancários e ficha médica de todo mundo que
-- já preencheu um link. Idem `bug_reports`.
--
-- Levantado pela auditoria de 27/09/2026 (AUDITORIA-supabase-rls.md) e
-- conferido contra o código:
--   · `perfis` do Supabase só é LIDA por `syncPerfisDeCadastro`, que só roda
--     no botão "puxar cadastros" — e esse botão só aparece para quem
--     administra. Quem não administra nunca lê essa tabela.
--   · o link público só faz INSERT (sem `.select()` depois), coberto por
--     `perfis: cadastro publico`.
--   · a ficha médica de emergência é `security definer` e lê do `registros`,
--     não desta tabela.
--   · as Edge Functions usam a chave secreta, que passa por cima da RLS.
--
-- COMO RODAR
-- SQL Editor. PRIMEIRO só a PARTE 1 e confira o resultado. Depois a PARTE 2.
-- Idempotente: rodar de novo não quebra nada.


-- =============================================================================
-- PARTE 1 — Conferir antes (só leitura, não muda nada)
-- =============================================================================
--
-- O que a auditoria NÃO mostrou: PARA QUEM cada política vale. Tirar uma
-- antiga que vale para `anon` deixando só uma nova que vale para
-- `authenticated` quebraria o link de cadastro (quem preenche não está logado).
--
-- O esperado, para as que FICAM:
--   perfis           · perfis: cadastro publico        · INSERT · {anon,authenticated}
--   perfis           · perfis: quem administra le      · SELECT · {authenticated}
--   bug_reports      · bugs: qualquer um relata        · INSERT · {anon,authenticated}
--   bug_reports      · bugs: so o admin le             · SELECT · {authenticated}
--   fichas_publicas  · ficha: leitura publica          · SELECT · {anon,authenticated}
--   fichas_publicas  · ficha: escrita autenticada      · INSERT · {authenticated}
--   fichas_publicas  · ficha: atualizacao autenticada  · UPDATE · {authenticated}
--
-- Se alguma dessas NÃO aparecer, ou aparecer sem `anon` onde o esperado tem
-- `anon`, PARE e não rode a parte 2.

select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename in ('perfis', 'bug_reports', 'fichas_publicas')
 order by tablename, cmd, policyname;

-- De quebra: a auditoria só é à prova de apagar se o `revoke` do
-- `auditoria.sql` rodou. O esperado é NÃO aparecer UPDATE, DELETE nem
-- TRUNCATE para `authenticated` ou `anon`.
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'auditoria'
   and grantee in ('authenticated', 'anon')
 order by grantee, privilege_type;


-- =============================================================================
-- PARTE 2 — Tirar as antigas
-- =============================================================================

-- Estas duas FECHAM VAZAMENTO.
drop policy if exists "auth_select_perfis"        on public.perfis;
drop policy if exists "auth_select_bug_reports"   on public.bug_reports;

-- Estas não mudam comportamento (a nova tem a mesma condição): é limpeza, para
-- a próxima auditoria não tropeçar nelas.
drop policy if exists "public_insert_perfis"      on public.perfis;
drop policy if exists "public_insert_bug_reports" on public.bug_reports;
drop policy if exists "auth_insert_fichas"        on public.fichas_publicas;
drop policy if exists "public_select_fichas"      on public.fichas_publicas;
drop policy if exists "auth_update_fichas"        on public.fichas_publicas;

-- A primeira versão do repositório também abria a leitura (`using (true)`).
-- O `fichas.sql` já tira; aqui fica de novo para este arquivo bastar sozinho.
drop policy if exists "perfis: leitura autenticada" on public.perfis;


-- =============================================================================
-- PARTE 3 — Conferir depois
-- =============================================================================
--
-- Rode a primeira consulta da PARTE 1 de novo. Não deve sobrar NENHUM nome em
-- inglês, e em `perfis` o único SELECT deve ser `perfis: quem administra le`.
--
-- Depois, no app:
--   1. abra o link de cadastro numa aba anônima e envie uma ficha de teste;
--   2. com a conta de quem administra, "puxar cadastros" na Equipe traz a ficha;
--   3. com uma conta que NÃO administra, o botão nem aparece — está certo.
