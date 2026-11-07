create table if not exists tokens (
  mint text primary key,
  launch_time timestamptz not null,
  launch_time_source text not null,
  creator text,
  pair_address text,
  discovered_at timestamptz not null default now(),
  snapshot_due_at timestamptz not null,
  last_snapshot_at timestamptz,
  outcome_checked_at timestamptz
);

create table if not exists snapshots (
  mint text primary key references tokens(mint),
  decision_time timestamptz not null,
  provider_observed_at timestamptz not null,
  features jsonb not null,
  raw_provider_refs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists labels (
  mint text primary key references tokens(mint),
  label integer,
  status text not null,
  reason_code text,
  label_rules_version text not null,
  peak_liquidity_usd numeric,
  value_at_30d numeric,
  labelled_at timestamptz not null default now()
);

create table if not exists known_bad (
  address text primary key,
  address_type text not null check (address_type in ('creator', 'funder')),
  generated_from text not null,
  generated_at timestamptz not null
);

create index if not exists tokens_snapshot_due_idx on tokens(snapshot_due_at)
  where last_snapshot_at is null;
create index if not exists tokens_outcome_idx on tokens(launch_time)
  where outcome_checked_at is null;
