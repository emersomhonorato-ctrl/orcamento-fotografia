-- =====================================================================
-- Contrato assinado online: o cliente abre o link, lê e aceita.
-- Fica registrado nome, CPF, data/hora, IP e navegador do aceite.
-- =====================================================================
create table if not exists public.contract_shares (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique,
  event_id text not null unique,
  snapshot jsonb not null,
  status text not null default 'enviado' check (status in ('enviado', 'assinado')),
  views int not null default 0,
  last_viewed_at timestamptz,
  signed_at timestamptz,
  signed_name text,
  signed_cpf text,
  signed_ip text,
  signed_agent text,
  text_hash text
);
alter table public.contract_shares enable row level security;
drop policy if exists "contratos link: equipe" on public.contract_shares;
create policy "contratos link: equipe" on public.contract_shares for all to authenticated
  using (public.is_studio_team())
  with check (public.is_studio_team());

create or replace function public.get_contract_share(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  c public.contract_shares;
begin
  select * into c from public.contract_shares where slug = lower(trim(p_slug));
  if not found then return json_build_object('status', 'not_found'); end if;
  update public.contract_shares set views = views + 1, last_viewed_at = now() where id = c.id;
  return json_build_object('status', c.status, 'snapshot', c.snapshot, 'signed_at', c.signed_at,
    'signed_name', c.signed_name, 'text_hash', c.text_hash);
end;
$fn$;

create or replace function public.sign_contract_share(p_slug text, p_name text, p_cpf text, p_agree boolean)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  c public.contract_shares;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_headers json;
  v_ip text;
  v_hash text;
begin
  select * into c from public.contract_shares where slug = lower(trim(p_slug)) for update;
  if not found then raise exception 'Contrato não encontrado.'; end if;
  if c.status = 'assinado' then raise exception 'Este contrato já foi assinado.'; end if;
  if not coalesce(p_agree, false) then raise exception 'Marque que leu e concorda com o contrato.'; end if;
  if coalesce(p_name, '') !~ '[^[:space:]]{2,}[[:space:]]+[^[:space:]]{2,}' then
    raise exception 'Informe seu nome completo.';
  end if;
  if length(v_cpf) <> 11 then raise exception 'Informe um CPF válido (11 números).'; end if;

  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then v_headers := null;
  end;
  v_ip := split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1);
  v_hash := encode(extensions.digest(coalesce(c.snapshot ->> 'contractText', ''), 'sha256'), 'hex');

  update public.contract_shares
     set status = 'assinado', signed_at = now(), updated_at = now(),
         signed_name = left(trim(p_name), 120), signed_cpf = v_cpf,
         signed_ip = left(nullif(trim(v_ip), ''), 60),
         signed_agent = left(coalesce(v_headers ->> 'user-agent', ''), 300),
         text_hash = v_hash
   where id = c.id;

  begin
    execute 'select private.notify_whatsapp($1)' using
      format('✍️ Contrato ASSINADO online: %s — %s', coalesce(c.snapshot->>'clientName', ''), coalesce(c.snapshot->>'eventType', ''));
  exception when others then null;
  end;

  return json_build_object('status', 'assinado', 'signed_at', now(), 'text_hash', v_hash);
end;
$fn$;

revoke all on function public.get_contract_share(text) from public;
revoke all on function public.sign_contract_share(text, text, text, boolean) from public;
grant execute on function public.get_contract_share(text) to anon, authenticated;
grant execute on function public.sign_contract_share(text, text, text, boolean) to anon, authenticated;

select count(*) as contratos_link from public.contract_shares;
