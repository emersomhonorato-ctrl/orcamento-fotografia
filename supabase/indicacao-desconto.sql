-- =====================================================================
-- Indique e ganhe: link de indicação para QUALQUER cliente
-- Indicado ganha 10% de desconto; quem indicou ganha 5 fotos extras por indicação fechada.
-- =====================================================================

-- Códigos de indicação criados pelo app (além dos que já vêm da entrega de fotos)
create table if not exists public.referral_codes (
  code text primary key,
  client_id text,
  client_name text not null,
  client_whatsapp text,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
revoke all on public.referral_codes from anon;
grant select, insert, update, delete on public.referral_codes to authenticated;
drop policy if exists "indicacao: admin gerencia" on public.referral_codes;
create policy "indicacao: admin gerencia" on public.referral_codes for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

-- Página pública: descobre só o PRIMEIRO NOME de quem indicou (nada de telefone)
create or replace function public.referral_lookup(p_code text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_name text;
begin
  if v_code = '' then return json_build_object('ok', false); end if;
  select client_name into v_name from public.referral_codes where code = v_code;
  if v_name is null then
    select client_name into v_name from public.photo_deliveries where upper(referral_code) = v_code limit 1;
  end if;
  if v_name is null then return json_build_object('ok', false); end if;
  return json_build_object('ok', true, 'first_name', split_part(trim(v_name), ' ', 1), 'discount', 10);
end;
$fn$;
revoke all on function public.referral_lookup(text) from public;
grant execute on function public.referral_lookup(text) to anon, authenticated;

-- Texto mostrado na página de entrega
update public.studio_settings
   set referral_reward = 'Indique amigos com o seu código: eles ganham 10% de desconto no ensaio e você ganha 5 fotos extras no seu pacote para cada amigo que fechar. 🎁'
 where id = 1;

select 'ok' as resultado;
