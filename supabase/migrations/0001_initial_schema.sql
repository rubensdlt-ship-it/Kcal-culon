-- ============================================================================
-- Kcal-culón — Initial schema (Phase 1)
-- 4 tables: profiles, daily_logs, activities, meals
-- All tables have Row Level Security ENABLED.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles  (extends auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text,
  gender             text check (gender in ('male', 'female', 'other')),
  age                int,
  height_cm          int,
  current_weight_kg  numeric,
  job_type           text check (job_type in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  activity_level     text check (activity_level in ('low', 'moderate', 'high', 'athlete')),
  health_conditions  text,
  pathologies        text,
  goal               text check (goal in ('lose', 'maintain', 'gain')),
  is_admin           boolean not null default false,
  profile_complete   boolean not null default false,
  created_at         timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. daily_logs  (one row per user per day)
-- ----------------------------------------------------------------------------
create table public.daily_logs (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles (id) on delete cascade,
  log_date                 date not null,
  weight_kg                numeric,
  bmr_calories             int,
  activity_calories        int,
  tdee_calories            int,
  total_calories_consumed  int,
  calorie_balance          int,
  hours_sedentary          numeric,
  hours_light              numeric,
  hours_sport              numeric,
  ai_advice                text,
  notes                    text,
  created_at               timestamptz not null default now(),
  unique (user_id, log_date)
);

create index daily_logs_user_id_idx on public.daily_logs (user_id);

-- ----------------------------------------------------------------------------
-- 3. activities  (children of a daily_log)
-- ----------------------------------------------------------------------------
create table public.activities (
  id                uuid primary key default gen_random_uuid(),
  daily_log_id      uuid not null references public.daily_logs (id) on delete cascade,
  activity_name     text,
  duration_minutes  int,
  intensity         text check (intensity in ('low', 'moderate', 'high')),
  calories_burned   int
);

create index activities_daily_log_id_idx on public.activities (daily_log_id);

-- ----------------------------------------------------------------------------
-- 4. meals  (children of a daily_log)
-- ----------------------------------------------------------------------------
create table public.meals (
  id                   uuid primary key default gen_random_uuid(),
  daily_log_id         uuid not null references public.daily_logs (id) on delete cascade,
  meal_type            text check (meal_type in ('breakfast', 'mid_morning', 'lunch', 'afternoon_snack', 'dinner', 'coffee', 'infusion', 'other')),
  food_name            text,
  portion_description  text,
  calories             int,
  notes                text
);

create index meals_daily_log_id_idx on public.meals (daily_log_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles   enable row level security;
alter table public.daily_logs enable row level security;
alter table public.activities enable row level security;
alter table public.meals      enable row level security;

-- Helper: is the current user an admin?
-- SECURITY DEFINER so it can read profiles without being blocked by RLS,
-- avoiding infinite recursion when used inside profiles' own policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- profiles policies
--   * a user can SELECT and UPDATE their own row (auth.uid() = id)
--   * admins can SELECT all rows
-- ----------------------------------------------------------------------------
create policy "Profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles: admin select all"
  on public.profiles for select
  using (public.is_admin());

create policy "Profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- daily_logs policies
--   * a user can SELECT/INSERT/UPDATE/DELETE their own rows (user_id = auth.uid())
--   * admins can SELECT all rows
-- ----------------------------------------------------------------------------
create policy "Daily logs: select own"
  on public.daily_logs for select
  using (user_id = auth.uid());

create policy "Daily logs: admin select all"
  on public.daily_logs for select
  using (public.is_admin());

create policy "Daily logs: insert own"
  on public.daily_logs for insert
  with check (user_id = auth.uid());

create policy "Daily logs: update own"
  on public.daily_logs for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Daily logs: delete own"
  on public.daily_logs for delete
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- activities policies
--   * a user can do ALL operations on rows whose parent daily_log belongs to them
--   * admins can SELECT all rows
-- ----------------------------------------------------------------------------
create policy "Activities: all own"
  on public.activities for all
  using (
    exists (
      select 1 from public.daily_logs dl
      where dl.id = activities.daily_log_id
        and dl.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.daily_logs dl
      where dl.id = activities.daily_log_id
        and dl.user_id = auth.uid()
    )
  );

create policy "Activities: admin select all"
  on public.activities for select
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- meals policies
--   * a user can do ALL operations on rows whose parent daily_log belongs to them
--   * admins can SELECT all rows
-- ----------------------------------------------------------------------------
create policy "Meals: all own"
  on public.meals for all
  using (
    exists (
      select 1 from public.daily_logs dl
      where dl.id = meals.daily_log_id
        and dl.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.daily_logs dl
      where dl.id = meals.daily_log_id
        and dl.user_id = auth.uid()
    )
  );

create policy "Meals: admin select all"
  on public.meals for select
  using (public.is_admin());

-- ============================================================================
-- Trigger: create a profiles row whenever a new auth user is created.
-- Sets is_admin = true for the designated admin email, otherwise false.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, is_admin)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email = 'info@rubensantaella.es'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
