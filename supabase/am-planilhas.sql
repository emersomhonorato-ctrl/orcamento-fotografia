-- =====================================================================
-- Planilhas da AM Formaturas: relatório de pagamento (trabalhos, KM e despesas).
-- Cada relatório fica aberto até ser fechado; ao fechar, abre o próximo número.
-- Pode rodar de novo sem duplicar: só importa o relatório 010 se a tabela estiver vazia.
-- =====================================================================
create table if not exists public.am_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  number int not null unique,
  title text not null,
  status text not null default 'aberto' check (status in ('aberto', 'fechado')),
  closed_at timestamptz,
  fuel_price numeric not null default 6.3,
  km_per_liter numeric not null default 10,
  wear_per_km numeric not null default 0.25
);

create table if not exists public.am_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  report_id uuid not null references public.am_reports(id) on delete cascade,
  work_date date,
  contract text,
  place text,
  event_type text,
  amount numeric not null default 0,
  km numeric not null default 0,
  toll numeric not null default 0,
  food numeric not null default 0,
  event_id text,
  event_label text,
  note text
);
create index if not exists am_items_report_idx on public.am_items(report_id);
create index if not exists am_items_event_idx on public.am_items(event_id);

alter table public.studio_settings add column if not exists am_payment_info text;

alter table public.am_reports enable row level security;
alter table public.am_items enable row level security;
drop policy if exists "am relatorios: admin" on public.am_reports;
create policy "am relatorios: admin" on public.am_reports for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');
drop policy if exists "am trabalhos: admin" on public.am_items;
create policy "am trabalhos: admin" on public.am_items for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

-- Relatório 010 (OUTUBRO 2026), copiado da planilha enviada, ainda aberto
do $seed$
declare r uuid;
begin
  if exists (select 1 from public.am_reports) then
    return;
  end if;
  insert into public.am_reports (number, title) values (10, 'OUTUBRO 2026') returning id into r;
  insert into public.am_items (report_id, work_date, contract, place, event_type, amount, km, toll, food) values
    (r, '2026-10-14', '2683/2026', 'COCAL DO SUL', 'Fotoconvite', 350, 34, 0, 0),
    (r, '2026-10-17', '2139/2026', 'MASTER. HALL', 'Family Day', 350, 36, 0, 50),
    (r, '2026-10-17', '2139/2026', 'MASTER. HALL', 'Fotoconvite', 400, 0, 0, 0),
    (r, '2026-10-26', '1777/2026', 'SANTA ROSA', 'Fotoconvite', 350, 100, 6, 0),
    (r, '2026-10-29', '2748/2026', 'MORRO DA FUMACA', 'Fotoconvite', 350, 42, 0, 0),
    (r, '2026-10-29', '2748/2026', 'MORRO DA FUMACA', 'Fotoconvite', 350, 0, 0, 0),
    (r, '2026-10-31', '2108/2026', 'MASTER. HALL', 'Family Day', 350, 36, 0, 50),
    (r, '2026-10-31', '2108/2026', 'MASTER. HALL', 'Fotoconvite', 400, 0, 0, 0),
    (r, '2026-11-04', '2151/2026', 'AM SEDE CRICIUMA', 'Ensaio Fotoconvite', 350, 36, 0, 0),
    (r, '2026-11-06', '0003/2024', 'MASTER. HALL', 'Formatura', 600, 36, 0, 0),
    (r, '2026-11-11', '2635/2026', 'AM SEDE CRICIUMA', 'Ensaio Fotoconvite + Family Day', 400, 36, 0, 50),
    (r, '2026-11-12', '2683/2026', 'VENEZA', 'Pré-evento', 180, 54, 0, 0),
    (r, '2026-11-13', '2708/2026', 'SALETTE SCOTT', 'Pré-evento', 180, 36, 0, 0),
    (r, '2026-11-16', '2149/2026', 'AM SEDE CRICIUMA', 'Ensaio Fotoconvite', 350, 36, 0, 0),
    (r, '2026-11-16', '2149/2026', 'AM SEDE CRICIUMA', 'Family Day', 400, 0, 0, 0),
    (r, '2026-11-17', '2596/2026', 'CATEDRAL', 'AM - Missa', 200, 12, 0, 0);
end
$seed$;

select r.number, r.title, r.status, count(i.*) as trabalhos,
  round(sum(i.amount + i.km / r.km_per_liter * r.fuel_price + i.km * r.wear_per_km + i.food + i.toll), 2) as total_geral
from public.am_reports r left join public.am_items i on i.report_id = r.id
group by r.id order by r.number;
