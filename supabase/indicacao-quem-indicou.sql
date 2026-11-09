-- =====================================================================
-- Orçamento: quem marcou "Indicação" pode dizer quem indicou
-- =====================================================================
alter table public.budget_requests add column if not exists referred_by text;
grant insert (referred_by) on public.budget_requests to anon;

select count(*) filter (where how_found = 'Indicação' or referral_code is not null) as pedidos_por_indicacao
  from public.budget_requests;
