-- =============================================================================
-- SetProd — Escopo por área e por departamento (ROADMAP, Etapa 4 §3.5)
-- =============================================================================
--
-- O QUE ESTE ARQUIVO FECHA
-- O `papeis.sql` fez valer o PAPEL: 'leitura' não escreve. Mas um membro
-- 'equipe' ainda escrevia em QUALQUER tabela — lançava despesa, fechava diária,
-- mexia na task da Arte sendo da Fotografia. A regra do app é outra:
--
--     Todo mundo vê tudo. Cada um edita o que é do seu departamento.
--     Dinheiro e a espinha da produção são de quem administra.
--
-- Isto é a mesma regra de `src/lib/escopo.ts` (`negacaoDaEscrita`), agora no
-- servidor, que é onde ela protege de verdade.
--
-- ⚠️ ESPELHO. As listas de tabelas abaixo e as de `escopo.ts` (`ESCOPO`) têm que
-- concordar. Se divergirem, a tela deixa editar e o servidor recusa — e a recusa
-- volta para a pessoa como aviso "não deu para alterar", sem ela ter feito nada
-- de errado. Mudou lá, muda aqui.
--
-- COMO RODAR
-- SQL Editor do Supabase, arquivo inteiro, DEPOIS do `papeis.sql`.
-- Idempotente: rodar duas vezes não quebra nada.
--
-- ⚠️ ANTES DE RODAR — isto muda o que 'equipe' pode fazer. Quem trabalha na
-- produção (produtor, 1º AD, continuísta) e hoje é 'equipe' deixa de poder criar
-- e fechar diária, lançar despesa, marcar presença no Registro do Set. Essas
-- pessoas precisam virar 'admin' ANTES (Quem tem acesso → papel). Para ver quem
-- é quem em cada produção:
--
--     select projeto_id, usuario_id, papel, apelido
--       from public.projeto_membros order by projeto_id, papel;
--
-- ⚠️ O SQL EDITOR NÃO TEM `auth.uid()`: teste pelo app (Parte 5).


-- =============================================================================
-- PARTE 1 — Quem sou eu nesta produção
-- =============================================================================

-- A ficha vinculada à minha conta (Etapa 6 do ROADMAP).
create or replace function public.meu_perfil_id(p_projeto text)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select perfil_id
    from public.projeto_membros
   where projeto_id = p_projeto and usuario_id = auth.uid()
   limit 1;
$$;

-- O departamento da minha ficha. Lido do espelho na hora, e não materializado
-- em `projeto_membros` (como o ROADMAP sugeria): assim, quando quem administra
-- muda o departamento de alguém na ficha, o escopo muda junto, sem uma segunda
-- cópia para esquecer de atualizar. A consulta vai pela chave primária.
create or replace function public.meu_departamento(p_projeto text)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select nullif(r.dados->>'departamento_id', '')
    from public.registros r
   where r.projeto_id = p_projeto
     and r.tabela = 'perfis'
     and r.id = public.meu_perfil_id(p_projeto)
     and not r.deletado
   limit 1;
$$;


-- =============================================================================
-- PARTE 2 — A matriz (espelho de `ESCOPO` em src/lib/escopo.ts)
-- =============================================================================

create or replace function public.escopo_da_tabela(p_tabela text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_tabela in (
      'projetos', 'configuracoes', 'despesas', 'aportes', 'acertos',
      'diarias', 'departamentos', 'registros_cena', 'registros_plano'
    ) then 'restrito'
    when p_tabela in (
      'perfis', 'tasks', 'diaria_tasks',
      'log_takes', 'log_estado', 'log_kits', 'log_hds', 'log_backups', 'log_checksums'
    ) then 'departamental'
    else 'comum'
  end;
$$;


-- =============================================================================
-- PARTE 3 — A regra por linha
-- =============================================================================
--
-- "Posso mexer numa linha NESTE estado?" A política pergunta duas vezes: no
-- `using`, com a linha como está (a velha); no `with check`, com a linha como
-- vai ficar (a nova). Só com as duas é que "mover uma task da Fotografia para a
-- Arte" fica barrado — e "trazer uma task da Arte para mim" também.
--
-- Em ordem, como em `negacaoDaEscrita`:
--   1. super-admin, dono e admin: tudo;
--   2. quem não é 'equipe' (leitura, não-membro): nada;
--   3. restrito: não; comum: sim;
--   4. departamental:
--      - Logagem: quem o dono liberou (`Projeto.logagem_liberados`) escreve;
--      - a própria ficha, sempre (a troca do próprio departamento é barrada
--        pelo trigger da Parte 4 — a política não vê as duas versões juntas);
--      - quem ainda não tem ficha pode ter a sua, com o e-mail da conta;
--      - linha sem departamento é de todo mundo;
--      - linha com departamento: só o meu.

create or replace function public.escopo_permite(
  p_projeto text, p_tabela text, p_id text, p_dados jsonb
)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_papel  text;
  v_escopo text;
  v_depto  text;
  v_perfil text;
begin
  if public.e_admin() then return true; end if;

  v_papel := public.papel_no_projeto(p_projeto);
  if v_papel in ('dono', 'admin') then return true; end if;
  if v_papel is distinct from 'equipe' then return false; end if;

  -- As camadas protegidas da ficha (`fichas.sql`): documento, dinheiro e saúde
  -- de alguém só são escritos por essa pessoa — dono e admin já passaram acima.
  -- É a mesma regra de quem as LÊ; ver `pode_ver_ficha`.
  if p_tabela in ('perfis_restritos', 'perfis_medicos') then
    return p_id = public.meu_perfil_id(p_projeto);
  end if;

  v_escopo := public.escopo_da_tabela(p_tabela);
  if v_escopo = 'restrito' then return false; end if;
  if v_escopo = 'comum' then return true; end if;

  -- departamental daqui para baixo

  if p_tabela like 'log\_%' and exists (
    select 1 from public.registros p
     where p.projeto_id = p_projeto and p.tabela = 'projetos' and p.id = p_projeto
       and coalesce(p.dados->'logagem_liberados', '[]'::jsonb) ? auth.uid()::text
  ) then
    return true;
  end if;

  v_perfil := public.meu_perfil_id(p_projeto);

  if p_tabela = 'perfis' then
    if v_perfil is not null and p_id = v_perfil then return true; end if;
    if v_perfil is null
       and p_dados is not null
       and lower(trim(coalesce(p_dados->>'email', ''))) = lower(coalesce(auth.jwt()->>'email', '#'))
    then
      return true;
    end if;
  end if;

  -- Lápide (dados nulo) não tem departamento para conferir: quem decide é o
  -- `using`, que olhou a linha viva antes de ela virar lápide.
  if p_dados is null then return true; end if;

  v_depto := nullif(p_dados->>'departamento_id', '');
  if v_depto is null then return true; end if;
  return v_depto = public.meu_departamento(p_projeto);
end;
$$;


-- As políticas de `registros`: o papel (papeis.sql) E o escopo.
--
-- O `using` recebe a linha velha: se ela for lápide, não há dono a conferir e a
-- nova versão (o `with check`) decide — é o caso de recriar algo apagado.

drop policy if exists "registros: quem escreve cria" on public.registros;
create policy "registros: quem escreve cria" on public.registros
  for insert to authenticated
  with check (
    public.pode_escrever(projeto_id)
    and public.escopo_permite(projeto_id, tabela, id, case when deletado then null else dados end)
  );

drop policy if exists "registros: quem escreve altera" on public.registros;
create policy "registros: quem escreve altera" on public.registros
  for update to authenticated
  using (
    public.pode_escrever(projeto_id)
    and public.escopo_permite(projeto_id, tabela, id, case when deletado then null else dados end)
  )
  with check (
    public.pode_escrever(projeto_id)
    and public.escopo_permite(projeto_id, tabela, id, case when deletado then null else dados end)
  );

-- ⚠️ Sobre lápides: apagar é um UPDATE para `deletado = true, dados = null`. O
-- `with check` deixa passar (não há departamento na lápide), mas o `using` já
-- exigiu que a linha VIVA fosse minha. É isso que impede a Fotografia de apagar
-- a task da Arte.


-- =============================================================================
-- PARTE 4 — Não trocar o próprio departamento
-- =============================================================================
--
-- A exceção "cada um edita a própria ficha" (sem ela ninguém atualiza o próprio
-- PIX) não pode virar "cada um escolhe de que departamento é" — senão bastava
-- trocar o departamento na própria ficha para passar a editar as tasks da Arte.
-- A política não enxerga a versão velha e a nova ao mesmo tempo; o trigger sim.

create or replace function public.guarda_departamento_da_ficha()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Só a PRÓPRIA ficha. Nas outras, a política já cuida: a velha e a nova têm
  -- de ser do meu departamento (ou de nenhum), igual a `negacaoDaEscrita`.
  if new.tabela = 'perfis'
     and not new.deletado
     and not public.pode_gerir(new.projeto_id)
     and new.id = public.meu_perfil_id(new.projeto_id)
     and nullif(old.dados->>'departamento_id', '') is distinct from nullif(new.dados->>'departamento_id', '')
  then
    raise exception 'Trocar o departamento de uma ficha é com quem administra a produção.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guarda_departamento_da_ficha on public.registros;
create trigger trg_guarda_departamento_da_ficha
  before update on public.registros
  for each row execute function public.guarda_departamento_da_ficha();

-- O errcode 42501 é o mesmo da recusa de RLS de propósito: o app já sabe tratar
-- (tira da fila, devolve a versão do servidor e avisa — `empurrar()` em
-- src/lib/sincronizacao.ts). Outro código travaria a fila daquele aparelho.


-- =============================================================================
-- PARTE 5 — Como testar (pelo app, nunca pelo SQL Editor)
-- =============================================================================
--
-- Numa conta 'equipe' com ficha vinculada à Fotografia, no console do app:
--
--   1. despesa (restrito) — tem que voltar erro 42501:
--        await supabase.from('registros').insert({ projeto_id: '<id>',
--          tabela: 'despesas', id: crypto.randomUUID(), dados: { id: 'x' },
--          atualizado_em: Date.now(), deletado: false })
--
--   2. task da Arte — 42501:
--        ... tabela: 'tasks', dados: { id: 'x', departamento_id: '<id da Arte>' }
--
--   3. task da Fotografia — sucesso:
--        ... tabela: 'tasks', dados: { id: 'x', departamento_id: '<id da Fotografia>' }
--
--   4. locação (comum) — sucesso.
--
-- E pela tela: o botão "Criar Diária" não aparece para essa conta, e aparece
-- para quem é 'admin'. Se a tela mostrar e o servidor recusar, as duas listas
-- (aqui e escopo.ts) divergiram.
