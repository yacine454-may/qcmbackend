-- Supabase Postgres schema for ResicoQCM
create extension if not exists pgcrypto;

-- users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  username text unique not null,
  password_hash text not null,
  first_name text,
  last_name text,
  role text check (role in ('4A','5A','6A','RES')) default null,
  is_active boolean default false,
  is_admin boolean default false,
  last_login_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- modules
create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  level text check (level in ('4A','5A','6A','RES')),
  is_active boolean default true
);

-- qcm
create table if not exists qcm (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules(id) on delete cascade,
  question text not null,
  explanation text,
  difficulty text check (difficulty in ('Easy','Medium','Hard')),
  -- index-based correctness used by backend (/results/answer)
  answer_index integer,
  created_at timestamptz default now()
);

-- qcm_choices
create table if not exists qcm_choices (
  id uuid primary key default gen_random_uuid(),
  qcm_id uuid references qcm(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false
);

-- results
create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  module_id uuid references modules(id) on delete set null,
  mode text check (mode in ('revision','exam')) not null,
  score integer default 0,
  total integer default 0,
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- result_answers
create table if not exists result_answers (
  id uuid primary key default gen_random_uuid(),
  result_id uuid references results(id) on delete cascade,
  qcm_id uuid references qcm(id) on delete cascade,
  selected_index integer not null,
  is_correct boolean not null
);

-- user_progress
create table if not exists user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  module_id uuid references modules(id) on delete cascade,
  correct_count integer default 0,
  wrong_count integer default 0,
  last_activity_at timestamptz default now(),
  unique(user_id, module_id)
);

-- subscription_codes (optional)
create table if not exists subscription_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  role text check (role in ('4A','5A','6A','RES')) not null,
  is_active boolean default true,
  used_by uuid references users(id),
  used_at timestamptz
);

-- helpful indexes
create index if not exists idx_qcm_module_created_at on qcm(module_id, created_at);
create index if not exists idx_qcm_choices_qcm on qcm_choices(qcm_id);
create index if not exists idx_results_user_completed on results(user_id, completed_at);
create index if not exists idx_result_answers_result on result_answers(result_id);
create unique index if not exists uq_user_progress_user_module on user_progress(user_id, module_id);

-- Ensure only one subscription code can be linked per user (when used)
create unique index if not exists uq_subscription_codes_used_by on subscription_codes(used_by) where used_by is not null;
