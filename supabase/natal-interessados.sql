-- =====================================================================
-- Agenda online: quem deixa nome e WhatsApp para ver os valores
-- (o cliente só grava; só o estúdio lê). Pode rodar mais de uma vez.
-- =====================================================================
create table if not exists public.booking_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  campaign_id text not null references public.booking_campaigns(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 120),
  whatsapp text not null check (char_length(whatsapp) between 10 and 30)
);
alter table public.booking_leads enable row level security;
revoke all on public.booking_leads from anon;
grant insert (campaign_id, name, whatsapp) on public.booking_leads to anon;
grant select, insert, update, delete on public.booking_leads to authenticated;
drop policy if exists "interessados: cliente envia" on public.booking_leads;
create policy "interessados: cliente envia" on public.booking_leads for insert to anon
  with check (exists (select 1 from public.booking_campaigns c where c.id = campaign_id and c.active));
drop policy if exists "interessados: admin" on public.booking_leads;
create policy "interessados: admin" on public.booking_leads for all to authenticated using (public.is_studio_team()) with check (public.is_studio_team());
notify pgrst, 'reload schema';
select count(*) as interessados from public.booking_leads;
