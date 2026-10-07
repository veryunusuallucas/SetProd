-- =============================================================================
-- SetProd — Segurança, rodada 4 (.md/PLANO-seguranca.md, passos A8b, A8c, A11)
-- =============================================================================
--
-- ⚠️ SÓ DEPOIS QUE A BETA 0.19 ESTIVER NO AR. É ela que lê o convite pela
-- função `ler_convite`; o app antigo lia a tabela direto e, com a leitura
-- fechada, a tela de aceitar convite diria "convite não encontrado".
--
-- O QUE ESTE ARQUIVO FECHA
--   A8b #1  qualquer conta logada lia o token de todos os convites
--   A8c #1  convite criado em nome de outra pessoa, ou com validade sem fim
--   A11 #18 quem administra pode apagar a caixa de cadastros (o app 0.19 já
--           tenta, e hoje é recusado — a cópia do CPF/PIX ficava no servidor)
--   A11 #11 anexo de outra pessoa só é apagado/trocado por quem administra
--   A11 #12 a hora da ata (`recebido_em`) é sempre a do servidor
--   A11 #16 a fila da IA não mostra mais a todos o histórico (e o e-mail) de
--           quem rodou análise
--   A11     relato de bug não pode ser gravado em nome de outra conta
--
-- COMO RODAR
-- SQL Editor do Supabase, arquivo inteiro. Numa transação, idempotente.
--
-- Conferido no banco (só leitura, 07/10) antes de escrever:
--   - todo convite tem `criado_por` (default auth.uid(): o app não o envia);
--   - `expira_em` tem default de 7 dias, e o app sempre cria com 7;
--   - todo anexo tem `owner_id`;
--   - nenhuma tela do app 0.19 lê `convites` direto, a não ser quem administra
--     (lista de convites em Compartilhar).

begin;


-- =============================================================================
-- A8b — Convites: só quem administra lê a tabela
-- =============================================================================
-- Quem só tem o link usa `ler_convite(token)` (rodada 1), que devolve um
-- convite pelo token exato e nunca lista nada.

drop policy if exists "convites: leitura por quem tem o token" on public.convites;
drop policy if exists "convites: quem gere le" on public.convites;
create policy "convites: quem gere le" on public.convites
  for select to authenticated
  using (public.pode_gerir(projeto_id));


-- =============================================================================
-- A8c — Convite criado por quem cria, e com prazo
-- =============================================================================
-- O app sempre cria com 7 dias; a hora a mais cobre relógio adiantado.

drop policy if exists "convites: quem gere convida" on public.convites;
create policy "convites: quem gere convida" on public.convites
  for insert to authenticated
  with check (
    public.pode_gerir(projeto_id)
    and criado_por = auth.uid()
    and expira_em <= now() + interval '7 days 1 hour'
  );


-- =============================================================================
-- A11 (#18) — Caixa de cadastros: quem administra apaga o que já virou ficha
-- =============================================================================
-- `syncPerfisDeCadastro` (src/lib/sync.ts) só apaga a linha depois de ver a
-- ficha no espelho — nunca um cadastro que ainda não subiu.

drop policy if exists "perfis: quem administra apaga" on public.perfis;
create policy "perfis: quem administra apaga" on public.perfis
  for delete to authenticated
  using (public.pode_gerir(projeto_id));


-- =============================================================================
-- A11 (#11) — Anexos: trocar ou apagar o de outra pessoa é com quem administra
-- =============================================================================
-- Enviar e ler continuam iguais. Destruir a produção apaga os anexos pela conta
-- do dono, que passa por `pode_gerir`.

drop policy if exists "anexos: quem escreve apaga" on storage.objects;
create policy "anexos: quem escreve apaga" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'anexos'
    and public.pode_escrever((storage.foldername(name))[1])
    and (owner_id = auth.uid()::text or public.pode_gerir((storage.foldername(name))[1]))
  );

drop policy if exists "anexos: quem escreve substitui" on storage.objects;
create policy "anexos: quem escreve substitui" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'anexos'
    and public.pode_escrever((storage.foldername(name))[1])
    and (owner_id = auth.uid()::text or public.pode_gerir((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'anexos'
    and public.pode_escrever((storage.foldername(name))[1])
  );


-- =============================================================================
-- A11 (#12) — A hora da ata é a do servidor
-- =============================================================================
-- A ata ordena por `recebido_em` desde a 0.19. O INSERT aceitava qualquer valor
-- nessa coluna — dava para enterrar um registro "no passado".

create or replace function public.ata_na_hora_do_servidor()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.recebido_em := now();
  return new;
end;
$$;

drop trigger if exists trg_ata_na_hora_do_servidor on public.auditoria;
create trigger trg_ata_na_hora_do_servidor
  before insert on public.auditoria
  for each row execute function public.ata_na_hora_do_servidor();


-- =============================================================================
-- A11 (#16) — Fila da IA: só quem está rodando agora
-- =============================================================================
-- A fila (src/lib/filaIA.ts) só precisa ver a execução em andamento (sinal de
-- vida nos últimos 2 minutos). A leitura `true` mostrava a qualquer conta o
-- histórico inteiro: nome (às vezes o e-mail) e produção de quem usou a IA.

drop policy if exists "auth_select_ia_execucoes" on public.ia_execucoes;
create policy "auth_select_ia_execucoes" on public.ia_execucoes
  for select to authenticated
  using (
    user_id = auth.uid()
    or (status = 'rodando' and atualizado_em > now() - interval '2 minutes')
  );

-- O app gravava o e-mail quando a conta não tinha nome; tira o que ficou.
update public.ia_execucoes set nome = 'Alguém da equipe' where nome like '%@%';


-- =============================================================================
-- A11 — Relato de bug no nome de quem relata
-- =============================================================================
-- `usuario_id` tem default auth.uid() e o app não o envia; isto só impede que
-- alguém grave um relato em nome de outra conta. Sem login, fica nulo.

drop policy if exists "bugs: qualquer um relata" on public.bug_reports;
create policy "bugs: qualquer um relata" on public.bug_reports
  for insert to anon, authenticated
  with check (usuario_id is not distinct from auth.uid());

commit;


-- =============================================================================
-- Como conferir (SQL Editor)
-- =============================================================================
--
-- 1. Nenhuma política `true` em convites (tem que voltar 0 linhas):
--      select policyname from pg_policies
--       where tablename = 'convites' and (qual = 'true' or with_check = 'true');
--
-- Pelo app (conta e produção de TESTE):
--
-- 2. Criar um convite em Compartilhar → aparece na lista.
-- 3. Abrir o link numa conta de fora → a tela mostra a produção e o aceite
--    funciona (é o teste de que a 0.19 já está lendo pela função).
-- 4. Numa conta de fora, no console do app:
--      await supabase.from('convites').select('token')
--    → lista vazia.
-- 5. Relatar um bug pelo botão, logado e deslogado → chega.
-- 6. Rodar uma análise de IA → a fila continua mostrando quem está na frente.
