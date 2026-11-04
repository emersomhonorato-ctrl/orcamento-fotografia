-- =====================================================================
-- Sinal não pago no prazo: o sistema NÃO exclui mais sozinho.
-- O app mostra um aviso e o estúdio decide (cobrar, dar mais prazo ou excluir).
-- Pode rodar mais de uma vez.
-- =====================================================================
alter table public.bookings add column if not exists hold_extended_at timestamptz;

create or replace function public.release_unpaid_bookings()
returns int
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- continua conferindo pagamentos por cartão pendentes no Mercado Pago
  begin
    perform public.mp_sync_pending();
  exception when others then null;
  end;
  return 0;
end;
$fn$;
revoke all on function public.release_unpaid_bookings() from public, anon, authenticated;
notify pgrst, 'reload schema';
select count(*) as aguardando_sinal from public.bookings where status = 'aguardando_sinal';
