-- ============================================================================
-- Minhas Financas — schema de sincronizacao (OPCIONAL)
--
-- O app funciona 100% sem isto: os dados ficam no navegador.
-- Rode este SQL apenas se voce quiser os mesmos dados no celular e no PC.
--
-- Como aplicar: Supabase Studio -> SQL Editor -> cole tudo -> Run.
-- Depois, no app: Ajustes -> Sincronizacao -> Ligar sincronizacao, e cole a
-- Project URL e a chave anon public (Settings -> API). Nao precisa mexer no .env.
-- ============================================================================

create table if not exists public.financas (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  dados         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

alter table public.financas enable row level security;

-- Cada pessoa enxerga e escreve exclusivamente a propria linha.
drop policy if exists "dono le" on public.financas;
create policy "dono le" on public.financas
  for select using (auth.uid() = user_id);

drop policy if exists "dono insere" on public.financas;
create policy "dono insere" on public.financas
  for insert with check (auth.uid() = user_id);

drop policy if exists "dono atualiza" on public.financas;
create policy "dono atualiza" on public.financas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dono apaga" on public.financas;
create policy "dono apaga" on public.financas
  for delete using (auth.uid() = user_id);

-- carimba a hora do servidor a cada gravacao (o cliente usa isso pra decidir
-- qual versao e a mais nova quando voce edita em dois aparelhos)
create or replace function public.tocar_financas()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_tocar_financas on public.financas;
create trigger trg_tocar_financas
  before insert or update on public.financas
  for each row execute function public.tocar_financas();
