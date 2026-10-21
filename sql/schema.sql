-- Wildvision: схема базы для Supabase.
-- Запусти целиком в Supabase → SQL Editor → New query → Run.

-- 1. Все данные сайта (новости, участники, расписание, настройки, правила) — одна строка в jsonb
create table if not exists site_data (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  constraint single_row check (id = 1)
);
insert into site_data (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- 2. Голоса — отдельная таблица, чтобы голосовали все одновременно без потери данных
create table if not exists votes (
  participant_id text primary key,
  count int not null default 0
);

-- 3. Безопасность: читать могут все, менять — только вошедший админ
alter table site_data enable row level security;
alter table votes enable row level security;

drop policy if exists "site_read" on site_data;
drop policy if exists "site_admin_write" on site_data;
drop policy if exists "votes_read" on votes;
drop policy if exists "votes_admin_write" on votes;

create policy "site_read" on site_data for select using (true);
create policy "site_admin_write" on site_data for all to authenticated using (true) with check (true);
create policy "votes_read" on votes for select using (true);
create policy "votes_admin_write" on votes for all to authenticated using (true) with check (true);

-- 4. Голосование: зрители могут только добавить +1 за участника, и только если голосование открыто
create or replace function cast_vote(pid text)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from site_data
    where id = 1 and (data->'settings'->>'votingOpen')::boolean is true
  ) then
    raise exception 'Голосование закрыто';
  end if;

  if not exists (
    select 1 from site_data s, jsonb_array_elements(s.data->'participants') p
    where s.id = 1 and p->>'id' = pid
  ) then
    raise exception 'Такого участника нет';
  end if;

  insert into votes (participant_id, count) values (pid, 1)
  on conflict (participant_id) do update set count = votes.count + 1;
end;
$$;

grant execute on function cast_vote(text) to anon, authenticated;

-- 5. Обнуление голосов — только для админа
create or replace function reset_votes()
returns void
language sql
security definer
as $$
  delete from votes;
$$;

grant execute on function reset_votes() to authenticated;
