-- =============================================================================
-- SetProd — Papéis de verdade (Etapa 4 do ROADMAP)
-- =============================================================================
--
-- O QUE ESTE ARQUIVO CONSERTA
-- Até aqui, papel era enfeite. TODA política de `registros` perguntava só
-- `e_membro()`. Um membro convidado como 'leitura' escrevia no banco igual ao
-- dono — bastava o console do navegador. Tudo o que a tela fazia com papéis era
-- decoração; quem protege é isto aqui.
--
-- COMO RODAR
-- SQL Editor do Supabase, arquivo inteiro, depois do `multiusuario.sql`.
-- É idempotente: rodar duas vezes não quebra nada.
--
-- ⚠️ ANTES DE RODAR, confira se algum membro tem papel fora da lista nova:
--
--     select distinct papel from public.projeto_membros;
--
-- Se aparecer algo que não seja dono/admin/equipe/leitura, o `check` da Parte 3
-- falha e o arquivo inteiro para. Corrija a linha antes.
--
-- ⚠️ O SQL EDITOR NÃO TEM `auth.uid()`. Todas as funções aqui perguntam quem
-- você é, então testá-las por lá devolve nulo/falso sempre. Teste pelo app.
--
-- ⚠️ RLS BARRADA NÃO DÁ ERRO. Um select bloqueado devolve VAZIO e um delete
-- bloqueado responde 204 Sucesso tendo apagado zero linhas. Se depois disto algo
-- "sumir" no app, suspeite daqui antes de suspeitar do código.


-- =============================================================================
-- PARTE 1 — Funções
-- =============================================================================
--
-- Todas `security definer` com `search_path` fixo, como no `multiusuario.sql`.
-- O `security definer` não é preferência de estilo: a política de
-- `projeto_membros` consulta `projeto_membros`, e sem ele isso entra em
-- recursão infinita. O arquivo anterior já explica esse laço.

create or replace function public.papel_no_projeto(p_projeto text)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select papel
    from public.projeto_membros
   where projeto_id = p_projeto and usuario_id = auth.uid()
   limit 1;
$$;

-- Pode escrever dado da produção?
--
-- `e_admin()` entra em todas: o super-admin enxerga e mexe em tudo sem ser
-- membro de nada. É de propósito e não muda — ver a faixa de "modo
-- administrador" prevista na Etapa 8, que existe justamente porque isso é fácil
-- de esquecer.
create or replace function public.pode_escrever(p_projeto text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(public.papel_no_projeto(p_projeto) in ('dono','admin','equipe'), false)
      or public.e_admin();
$$;

-- Pode administrar a produção — convidar, mexer em papel, expulsar?
create or replace function public.pode_gerir(p_projeto text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(public.papel_no_projeto(p_projeto) in ('dono','admin'), false)
      or public.e_admin();
$$;


-- =============================================================================
-- PARTE 2 — `registros`: escrever passa a depender do papel
-- =============================================================================
--
-- `select` continua em `e_membro()`. Leitura é global de propósito: produção de
-- cinema funciona com todo mundo enxergando a diária, o orçamento e o roteiro.
-- Restringir leitura quebraria Ordem do Dia, créditos e o cálculo de saldos, que
-- leem o projeto inteiro.
--
-- (A exceção pretendida à leitura global é a ficha da equipe — CPF, banco,
-- saúde. Ela NÃO está aqui; ver a dívida declarada no fim do arquivo.)

drop policy if exists "registros: membros criam" on public.registros;
drop policy if exists "registros: quem escreve cria" on public.registros;
create policy "registros: quem escreve cria" on public.registros
  for insert to authenticated
  with check (public.pode_escrever(projeto_id));

drop policy if exists "registros: membros alteram" on public.registros;
drop policy if exists "registros: quem escreve altera" on public.registros;
create policy "registros: quem escreve altera" on public.registros
  for update to authenticated
  using (public.pode_escrever(projeto_id))
  with check (public.pode_escrever(projeto_id));

-- Os dois `drop` acima importam: uma política antiga esquecida não é
-- substituída, ela CONVIVE. Políticas do mesmo comando se somam por OR, então a
-- velha "membros alteram" continuaria liberando geral e este arquivo não teria
-- efeito nenhum — sem erro, sem aviso.


-- =============================================================================
-- PARTE 3 — O papel vira uma lista fechada
-- =============================================================================

alter table public.projeto_membros
  drop constraint if exists papel_valido;

alter table public.projeto_membros
  add constraint papel_valido
  check (papel in ('dono','admin','equipe','leitura'));

-- ⚠️ Esta lista existe em três lugares e os três têm que concordar:
--   1. aqui;
--   2. `PAPEIS_CONVIDAVEIS` em `src/lib/permissoes.ts` (sem 'dono');
--   3. `PAPEIS_PERMITIDOS` em `supabase/functions/convite/index.ts` (sem 'dono').
-- 'dono' existe mas não se concede por convite: posse se transfere em ação
-- própria, com confirmação, e não por um link que roda no WhatsApp.


-- =============================================================================
-- PARTE 4 — O grant de coluna, que agora é crítico
-- =============================================================================
--
-- O `multiusuario.sql` já revogava o update geral e concedia só `perfil_id`.
-- Isso era higiene; agora é a trava principal. Sem ela, um membro 'leitura'
-- daria `update projeto_membros set papel = 'dono'` na própria linha — a
-- política "cada um ajusta a propria linha" o deixaria passar, porque ela olha
-- QUEM está mexendo, não QUAL coluna.
--
-- Repetido aqui de propósito: se alguém rodar um `grant update` amplo em
-- `projeto_membros` para consertar outra coisa, rodar este arquivo devolve o
-- estado correto.

revoke update on public.projeto_membros from authenticated;
grant  update (perfil_id) on public.projeto_membros to authenticated;

-- Confira depois de rodar — `papel` NÃO pode aparecer nesta lista:
--
--   select column_name, privilege_type
--     from information_schema.column_privileges
--    where table_name = 'projeto_membros' and grantee = 'authenticated';


-- =============================================================================
-- PARTE 5 — Convites: só quem administra
-- =============================================================================
--
-- Estava em `e_membro()`: qualquer convidado podia convidar mais gente, e quem
-- entrou como 'leitura' podia gerar link de acesso à produção inteira.

drop policy if exists "convites: membros convidam" on public.convites;
drop policy if exists "convites: quem gere convida" on public.convites;
create policy "convites: quem gere convida" on public.convites
  for insert to authenticated
  with check (public.pode_gerir(projeto_id));

drop policy if exists "convites: membros revogam" on public.convites;
drop policy if exists "convites: quem gere revoga" on public.convites;
create policy "convites: quem gere revoga" on public.convites
  for delete to authenticated
  using (public.pode_gerir(projeto_id));


-- =============================================================================
-- PARTE 6 — Anexos no Storage seguem o mesmo papel
-- =============================================================================
--
-- Sem isto, 'leitura' não escreveria no banco mas ainda poderia subir e apagar
-- arquivo no bucket — inclusive substituir o roteiro por outro PDF.
--
-- O caminho do arquivo é `<projeto_id>/...`, então o projeto sai do primeiro
-- pedaço do nome. Ler continua liberado para membro, como o resto.

drop policy if exists "anexos: membros enviam" on storage.objects;
drop policy if exists "anexos: quem escreve envia" on storage.objects;
create policy "anexos: quem escreve envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'anexos' and public.pode_escrever((storage.foldername(name))[1]));

drop policy if exists "anexos: membros substituem" on storage.objects;
drop policy if exists "anexos: quem escreve substitui" on storage.objects;
create policy "anexos: quem escreve substitui" on storage.objects
  for update to authenticated
  using (bucket_id = 'anexos' and public.pode_escrever((storage.foldername(name))[1]))
  with check (bucket_id = 'anexos' and public.pode_escrever((storage.foldername(name))[1]));

drop policy if exists "anexos: membros apagam" on storage.objects;
drop policy if exists "anexos: quem escreve apaga" on storage.objects;
create policy "anexos: quem escreve apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'anexos' and public.pode_escrever((storage.foldername(name))[1]));


-- =============================================================================
-- PARTE 7 — DÍVIDA TÉCNICA DECLARADA: o escopo por departamento
-- =============================================================================
--
-- O que ESTE arquivo faz valer é o PAPEL. O escopo por departamento — "cada um
-- edita o que é do seu departamento", a matriz de `src/lib/escopo.ts` — está
-- implementado SÓ NA TELA. O servidor não o conhece.
--
-- CONSEQUÊNCIA CONCRETA, sem eufemismo: um membro 'equipe' da Arte, com o
-- DevTools aberto, escreve numa task da Fotografia. A RLS não impede.
--
-- POR QUE NÃO ESTÁ AQUI — e é ordem, não preguiça:
-- O escopo departamental depende de saber qual é o departamento de quem escreve,
-- e isso sai de `projeto_membros.perfil_id` → `perfis.departamento_id`. Só que
-- `perfil_id` está vazio para praticamente todo mundo hoje: quem preenche esse
-- vínculo é a Etapa 6 do ROADMAP, que vem DEPOIS desta.
--
-- Ligar a regra agora bloquearia todo mundo para fora de `tasks`, `diaria_tasks`
-- e `perfis` — e, do jeito que a RLS falha, sem mensagem de erro: as telas
-- simplesmente parariam de salvar.
--
-- O RISCO QUE SOBRA é "colega curioso com DevTools", não "estranho na internet":
-- para chegar até aqui a pessoa já passou do `e_membro()`, ou seja, já foi
-- convidada para a produção.
--
-- COMO FECHAR, quando a Etapa 6 estiver de pé:
--   1. materializar `departamento_id` em `projeto_membros`, preenchido pela
--      Edge Function junto com `perfil_id` (mais rápido e mais fácil de auditar
--      que consultar o jsonb a cada linha);
--   2. criar `meu_departamento(p_projeto)` `stable`;
--   3. na política de update de `registros`, para as tabelas marcadas como
--      `departamental` em `escopo.ts`, exigir
--      `dados->>'departamento_id' = public.meu_departamento(projeto_id)`
--      NO `using` E NO `with check` — só com os dois é que "mover uma task para
--      fora do meu departamento" fica barrado. O `using` olha a linha velha, o
--      `with check` a nova.
--
-- =============================================================================
-- PARTE 8 — DÍVIDA TÉCNICA DECLARADA: a ficha da equipe
-- =============================================================================
--
-- CPF, RG, dados bancários, cachê e ficha médica continuam visíveis para
-- QUALQUER membro no servidor. A separação em três camadas existe em
-- `src/lib/camposSensiveis.ts` e a tela a respeita, mas o dado chega inteiro ao
-- navegador de todo mundo.
--
-- A RLS não consegue esconder CAMPO — `registros.dados` é jsonb opaco para ela;
-- ela esconde LINHA. A saída decidida é uma tabela `perfis_restritos` com
-- política própria, e ela não cabe aqui: atravessa o cadastro público, o
-- importador de CSV, a exportação, a Ordem do Dia e o backup, e é migração de
-- dado pessoal — do tipo que se faz sozinha, com backup, e não na mesma rodada
-- que mexe em RLS. Ver o bloco final de `src/lib/camposSensiveis.ts`.


-- =============================================================================
-- PARTE 9 — Como testar (pelo app, nunca pelo SQL Editor)
-- =============================================================================
--
-- 1. Convide alguém como 'leitura' e aceite o convite na outra conta.
-- 2. Nessa conta, no console do navegador:
--
--      await supabase.from('registros').insert({
--        projeto_id: '<id>', tabela: 'cenas', id: crypto.randomUUID(),
--        dados: { id: 'x' }, atualizado_em: Date.now(), deletado: false
--      })
--
--    Tem que voltar erro 42501 (violação de RLS). Se voltar sucesso, alguma
--    política antiga sobreviveu — confira com:
--
--      select policyname, cmd from pg_policies
--       where tablename = 'registros' order by cmd;
--
--    Devem existir exatamente três: um select, um insert, um update.
--
-- 3. Ainda na conta 'leitura', tente gerar um link de convite pelo app. O botão
--    não deve nem aparecer, e a inserção direta deve ser recusada.
