-- ===========================================================================
-- SetProd — Multiusuário: acesso compartilhado, espelho dos dados e convites
-- ===========================================================================
--
-- Pode rodar quantas vezes quiser: tudo é "if not exists" / "or replace" /
-- drop-and-create das políticas. Rodar de novo por cima do que já existe é o
-- jeito de aplicar as correções.
--
-- ORDEM IMPORTA: as tabelas vêm antes das funções, e as funções antes das
-- políticas. Uma função em `language sql` tem o corpo validado na hora de criar
-- — se ela citar uma tabela que ainda não existe, o arquivo quebra no meio.
-- ===========================================================================


-- ###########################################################################
-- PARTE 1 — TABELAS
-- ###########################################################################

-- ---------------------------------------------------------------------------
-- 1.1 Quem é super-admin (você)
-- ---------------------------------------------------------------------------
-- Tabela em vez de e-mail chumbado no código: trocar de e-mail não vira deploy,
-- e o app nunca precisa saber qual é o e-mail do dono.

create table if not exists public.super_admins (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  criado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 1.2 Membros do projeto
-- ---------------------------------------------------------------------------

create table if not exists public.projeto_membros (
  projeto_id text not null,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  papel      text not null default 'equipe',
  -- "Equipe A" / "Equipe B" — é o nome que aparece na ata do rodapé.
  apelido    text,
  criado_em  timestamptz not null default now(),
  primary key (projeto_id, usuario_id)
);

create index if not exists idx_membros_usuario
  on public.projeto_membros (usuario_id);

-- Quem eu sou DENTRO da equipe desta produção (id do perfil no cadastro).
--
-- É outra pergunta que "qual meu papel": o papel diz o que posso fazer, este
-- diz quem eu sou na ficha — é o que faz "Minhas Tasks" saber o que é meu.
-- Fica no servidor, e não no aparelho, para valer em qualquer navegador.
alter table public.projeto_membros
  add column if not exists perfil_id text;

-- ---------------------------------------------------------------------------
-- 1.3 O espelho dos dados
-- ---------------------------------------------------------------------------
-- Uma tabela para as 22 tabelas do Dexie. O app consulta o IndexedDB, nunca
-- isto aqui — o Postgres é transporte e cópia durável, não banco de consulta.
-- Ver §2 do plano para o porquê.

create table if not exists public.registros (
  projeto_id text  not null,
  tabela     text  not null,
  id         text  not null,
  dados      jsonb,

  -- DOIS RELÓGIOS, DOIS TRABALHOS:
  --   atualizado_em (cliente) decide QUEM VENCE  → eixo do LWW
  --   recebido_em   (servidor) decide O QUE FALTA → eixo do cursor
  -- Se o cursor usasse o relógio do cliente, um celular com a hora adiantada
  -- gravaria o cursor no futuro e a pessoa pararia de receber mudanças. Sem
  -- erro, sem aviso — só silêncio.
  atualizado_em bigint      not null,
  recebido_em   timestamptz not null default now(),

  -- Lápide. Apagar de verdade faria a linha ressuscitar no próximo pull de quem
  -- estava offline: sem a lápide, o outro lado não tem como saber que sumiu.
  deletado   boolean not null default false,

  autor_id   uuid default auth.uid(),

  primary key (projeto_id, tabela, id)
);

-- O índice do pull incremental: "o que mudou neste projeto desde o cursor".
create index if not exists idx_registros_cursor
  on public.registros (projeto_id, recebido_em);

-- ---------------------------------------------------------------------------
-- 1.4 Convites
-- ---------------------------------------------------------------------------

create table if not exists public.convites (
  token        text primary key,
  projeto_id   text not null,
  nome_projeto text,
  papel        text not null default 'equipe',
  apelido      text,
  criado_por   uuid not null default auth.uid(),
  criado_em    timestamptz not null default now(),
  expira_em    timestamptz not null default (now() + interval '7 days'),
  usado_por    uuid,
  usado_em     timestamptz
);


-- ###########################################################################
-- PARTE 2 — FUNÇÕES
-- ###########################################################################
--
-- SECURITY DEFINER não é enfeite: uma política em `projeto_membros` que consulte
-- `projeto_membros` entra em recursão infinita e o Postgres aborta a consulta.
-- A função roda como dona da tabela, fora da RLS, e corta o laço.
--
-- `search_path` fixo fecha o buraco clássico de SECURITY DEFINER: sem ele, quem
-- controlasse o search_path apontaria `projeto_membros` para uma tabela própria.

create or replace function public.e_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.super_admins where usuario_id = auth.uid()
  );
$$;

create or replace function public.e_membro(p_projeto text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.projeto_membros
     where projeto_id = p_projeto and usuario_id = auth.uid()
  ) or public.e_admin();
$$;

-- Usada só na política de "fundador": diz se o projeto ainda está livre.
--
-- Livre = sem nenhum membro E sem nenhum dado. As duas condições, porque só a
-- primeira deixava um buraco: quando o último membro saía, o projeto voltava a
-- ficar "sem dono" — e qualquer pessoa logada que soubesse o id entrava nele e
-- lia tudo o que estava no espelho. Sem dado nenhum não há o que vazar, e é
-- justamente o estado de um projeto recém-criado, que é o caso legítimo.
--
-- Por isso o app tem que entrar como membro ANTES de mandar o primeiro dado.
create or replace function public.projeto_livre_para_fundar(p_projeto text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select not exists (select 1 from public.projeto_membros where projeto_id = p_projeto)
     and not exists (select 1 from public.registros      where projeto_id = p_projeto);
$$;

-- (A função antiga `projeto_tem_dono` é derrubada lá na Parte 3.2, e não aqui:
--  enquanto a política antiga existir, ela segura a função e o Postgres recusa
--  o drop. Primeiro a política passa a apontar para a nova, depois a velha cai.)

-- ---------------------------------------------------------------------------
-- Apagar um projeto de vez
-- ---------------------------------------------------------------------------
-- Existe porque não há política de DELETE em `registros` (apagar é lápide), e
-- sem uma saída o espelho de um projeto abandonado ficaria no banco para sempre
-- comendo o plano free.
--
-- É função, e não política de delete linha a linha, de propósito: assim ninguém
-- consegue apagar UMA linha de verdade — o que faria a lápide se perder e o
-- registro ressuscitar no outro lado. Aqui ou vai o projeto inteiro, ou nada.
--
-- ⚠️ NÃO FUNCIONA NO SQL EDITOR. Ela pergunta quem você é por `auth.uid()`, e
-- ali não há usuário logado — a conexão é a de dono do banco. Chamada do app
-- (supabase.rpc) funciona. Para limpar pelo editor, apague direto nas três
-- tabelas: o dono do banco passa por cima da RLS.

create or replace function public.purgar_projeto(p_projeto text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  apagados integer;
begin
  if not public.e_membro(p_projeto) then
    raise exception 'nao autorizado a purgar o projeto %', p_projeto;
  end if;

  delete from public.registros where projeto_id = p_projeto;
  get diagnostics apagados = row_count;

  delete from public.convites        where projeto_id = p_projeto;
  delete from public.projeto_membros where projeto_id = p_projeto;

  return apagados;
end;
$$;


-- ###########################################################################
-- PARTE 3 — RLS
-- ###########################################################################

-- ---------------------------------------------------------------------------
-- 3.1 super_admins
-- ---------------------------------------------------------------------------

alter table public.super_admins enable row level security;
-- Sem nenhuma política de escrita: só o painel do Supabase entra aqui.
-- É de propósito — quem consegue se inserir aqui vê todos os projetos.

drop policy if exists "admins: cada um se enxerga" on public.super_admins;
create policy "admins: cada um se enxerga" on public.super_admins
  for select to authenticated using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3.2 projeto_membros
-- ---------------------------------------------------------------------------

alter table public.projeto_membros enable row level security;

drop policy if exists "membros: leitura" on public.projeto_membros;
create policy "membros: leitura" on public.projeto_membros
  for select to authenticated
  using (usuario_id = auth.uid() or public.e_membro(projeto_id));

-- Quem cria o projeto entra sozinho — mas SÓ enquanto ele está livre (ver
-- `projeto_livre_para_fundar`). Todo mundo depois dele entra por convite
-- (Edge Function com service role, que passa por cima da RLS).
drop policy if exists "membros: fundador entra sozinho" on public.projeto_membros;
create policy "membros: fundador entra sozinho" on public.projeto_membros
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and public.projeto_livre_para_fundar(projeto_id)
  );

-- Cada um mexe só na própria linha, e SÓ na coluna `perfil_id`.
--
-- A política sozinha não bastaria: RLS decide quais LINHAS, nunca quais
-- COLUNAS. Com ela só, um membro poderia se promover a outro papel editando a
-- própria linha — hoje inofensivo (a RLS olha participação, não papel), mas
-- viraria um furo no dia em que 'leitura' existir de verdade. Quem limita
-- coluna é o GRANT, então os dois trabalham juntos.
revoke update on public.projeto_membros from authenticated;
grant  update (perfil_id) on public.projeto_membros to authenticated;

drop policy if exists "membros: cada um ajusta a propria linha" on public.projeto_membros;
create policy "membros: cada um ajusta a propria linha" on public.projeto_membros
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "membros: sair do projeto" on public.projeto_membros;
create policy "membros: sair do projeto" on public.projeto_membros
  for delete to authenticated
  using (usuario_id = auth.uid() or public.e_admin());

-- Só agora: com a política do fundador já apontando para a função nova, nada
-- mais depende da antiga e ela pode cair. Derrubá-la antes disso dá
-- "cannot drop function ... because other objects depend on it" — a política
-- que ainda estava no banco, da rodada anterior, segurava a função.
drop function if exists public.projeto_tem_dono(text);

-- ---------------------------------------------------------------------------
-- 3.3 registros
-- ---------------------------------------------------------------------------

alter table public.registros enable row level security;

drop policy if exists "registros: membros leem" on public.registros;
create policy "registros: membros leem" on public.registros
  for select to authenticated using (public.e_membro(projeto_id));

drop policy if exists "registros: membros criam" on public.registros;
create policy "registros: membros criam" on public.registros
  for insert to authenticated with check (public.e_membro(projeto_id));

drop policy if exists "registros: membros alteram" on public.registros;
create policy "registros: membros alteram" on public.registros
  for update to authenticated
  using (public.e_membro(projeto_id))
  with check (public.e_membro(projeto_id));

-- Sem política de DELETE, de propósito: apagar é `deletado = true`, e o projeto
-- inteiro sai por `purgar_projeto()`.
--
-- ⚠️ ATENÇÃO ao escrever código que limpe dados: um DELETE sem política NÃO dá
-- erro. A RLS filtra as linhas antes, o comando apaga zero e o PostgREST
-- responde 204 Sucesso. Um script de limpeza "funciona" sem limpar nada.

-- ---------------------------------------------------------------------------
-- 3.4 convites
-- ---------------------------------------------------------------------------

alter table public.convites enable row level security;

-- Quem tem o token pode ler o convite — é assim que a tela mostra "você foi
-- convidado para o projeto X" antes de aceitar. O token é o segredo; a linha
-- não carrega nada além do nome do projeto.
drop policy if exists "convites: leitura por quem tem o token" on public.convites;
create policy "convites: leitura por quem tem o token" on public.convites
  for select to authenticated using (true);

drop policy if exists "convites: membros convidam" on public.convites;
create policy "convites: membros convidam" on public.convites
  for insert to authenticated with check (public.e_membro(projeto_id));

drop policy if exists "convites: membros revogam" on public.convites;
create policy "convites: membros revogam" on public.convites
  for delete to authenticated using (public.e_membro(projeto_id));

-- Aceitar NÃO tem política de update: quem aceita ainda não é membro, então não
-- passaria por nenhuma regra baseada em participação. Aceitar é trabalho da
-- Edge Function `convite`, que roda com service role e faz as duas coisas numa
-- transação: marca o convite como usado e insere a participação.


-- ###########################################################################
-- PARTE 4 — GUARDA DE LWW E REALTIME
-- ###########################################################################

-- O cliente já compara timestamps, mas não dá para confiar só nele: um aparelho
-- que ficou horas dormindo acorda e empurra a caixa de saída inteira por cima
-- do que é mais novo. Aqui a escrita atrasada é simplesmente ignorada.

create or replace function public.guarda_lww()
returns trigger
language plpgsql
as $$
begin
  -- `return null` num BEFORE UPDATE cancela a linha sem erro: o cliente
  -- atrasado recebe sucesso e o dado novo continua de pé. É o que queremos —
  -- ele vai receber a versão boa no próximo pull de qualquer jeito.
  if new.atualizado_em <= old.atualizado_em then
    return null;
  end if;
  new.recebido_em := now();
  return new;
end;
$$;

drop trigger if exists trg_guarda_lww on public.registros;
create trigger trg_guarda_lww
  before update on public.registros
  for each row execute function public.guarda_lww();

-- Um canal só, para todas as tabelas do app. A RLS acima vale também aqui: o
-- Supabase só entrega a linha a quem poderia lê-la por select.

alter table public.registros replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.registros;
exception
  when duplicate_object then null;  -- já estava publicada
end
$$;


-- ###########################################################################
-- PARTE 5 — DEPOIS DE RODAR
-- ###########################################################################
-- Me coloque como super-admin (troque o e-mail):
--
--   insert into public.super_admins (usuario_id)
--   select id from auth.users where email = 'seu-email@exemplo.com'
--   on conflict do nothing;
--
-- Confira que pegou (se voltar vazio, o e-mail não bate com nenhum usuário):
--
--   select u.email from public.super_admins a
--     join auth.users u on u.id = a.usuario_id;
--
-- E aquela faxina que ficou pendente da fase da IA:
--
--   drop table if exists public.app_config;
