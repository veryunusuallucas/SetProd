-- =============================================================================
-- SetProd — A conta vira a pessoa da ficha (Etapa 6 do ROADMAP)
-- =============================================================================
--
-- O QUE ISTO DESTRAVA
-- `projeto_membros.perfil_id` já existia e já tinha o grant de coluna certo, mas
-- só era preenchido por um dropdown escondido dentro de "Compartilhar". Quem não
-- achasse esse dropdown ficava sem vínculo — e sem vínculo:
--
--   · "Minhas Tasks" não mostra nada, mesmo com as tasks atribuídas certinho;
--   · a pessoa não vê a PRÓPRIA ficha, porque a regra é "a própria pessoa e quem
--     administra" e o app não sabia que aquela conta era aquela pessoa;
--   · o escopo por departamento não tem de onde sair.
--
-- Agora o convite carrega quem a pessoa é, e ela entra já sabendo.
--
-- COMO RODAR
-- SQL Editor, arquivo inteiro, depois do `papeis.sql`. É idempotente.

alter table public.convites add column if not exists perfil_id     text;
alter table public.convites add column if not exists email_esperado text;

comment on column public.convites.perfil_id is
  'Quem a pessoa e na equipe desta producao. A Edge Function copia para projeto_membros.perfil_id no aceite.';

comment on column public.convites.email_esperado is
  'Para CONFERIR, nunca para travar. Se a conta que aceitou tiver outro e-mail, a tela avisa e deixa seguir. Gente usa e-mail pessoal e profissional, e convite travado por isso vira chamado de suporte.';

-- Um perfil nao pode ser reivindicado por duas contas na mesma producao.
--
-- Sem isto, duas pessoas se apontariam para o mesmo "Lucas — Fotografia" e o
-- filtro de "Minhas Tasks" mostraria as tarefas de um para o outro. O indice e
-- parcial porque `perfil_id` nulo e o caso normal de quem ainda nao vinculou —
-- e nulo nao colide com nulo em unique, mas ser explicito aqui evita surpresa.
create unique index if not exists projeto_membros_perfil_unico
  on public.projeto_membros (projeto_id, perfil_id)
  where perfil_id is not null;

-- ⚠️ Se este create falhar com "could not create unique index", já existe
-- duplicata. Ache com:
--
--   select projeto_id, perfil_id, count(*)
--     from public.projeto_membros
--    where perfil_id is not null
--    group by 1,2 having count(*) > 1;
--
-- E limpe deixando só uma conta por perfil antes de rodar de novo.
