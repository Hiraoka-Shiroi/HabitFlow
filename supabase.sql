-- HabitFlow database schema
-- Run in Supabase Dashboard -> SQL Editor.

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8b7cf6',
  frequency text not null default 'daily' check (frequency in ('daily','weekly')),
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

-- Personal planner: tasks, reminders and deadlines.
create table if not exists public.planner_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  due_date date,
  due_time time,
  category text not null default 'Личное',
  priority text not null default 'normal' check (priority in ('normal','important')),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Add the optional time field when upgrading an earlier database.
alter table public.planner_tasks add column if not exists due_time time;

create table if not exists public.planner_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  amount numeric(14,2) not null check (amount > 0),
  kind text not null check (kind in ('income','expense')),
  category text not null default 'Другое',
  transaction_date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.planner_tasks enable row level security;
alter table public.planner_transactions enable row level security;

drop policy if exists "Users manage own habits" on public.habits;
create policy "Users manage own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own logs" on public.habit_logs;
create policy "Users manage own logs" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own planner tasks" on public.planner_tasks;
create policy "Users manage own planner tasks" on public.planner_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists habit_logs_user_date_idx
  on public.habit_logs(user_id, log_date);
create index if not exists planner_tasks_user_date_idx
  on public.planner_tasks(user_id, due_date);

drop policy if exists "Users manage own planner transactions" on public.planner_transactions;
create policy "Users manage own planner transactions" on public.planner_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists planner_transactions_user_date_idx
  on public.planner_transactions(user_id, transaction_date desc);
