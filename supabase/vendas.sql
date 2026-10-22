-- =====================================================================
-- Vendas: álbuns/impressões e "Indique e ganhe" na entrega + aprovação de orçamento pelo link
-- =====================================================================

-- ---------- Álbuns, impressões e indicação ----------
alter table public.studio_settings
  add column if not exists products jsonb not null default '[]'::jsonb,
  add column if not exists referral_reward text;

update public.studio_settings
   set referral_reward = coalesce(referral_reward, 'Para cada amigo que fechar um ensaio com o seu código, você ganha 3 fotos extras no seu próximo ensaio. 🎁'),
       products = case when products = '[]'::jsonb then
         '[{"name":"Álbum fotográfico","description":"Capa personalizada, folhas em papel fotográfico premium. Para guardar a vida toda.","price":"a partir de R$ 390"},
           {"name":"Quadro decorativo","description":"Sua foto preferida impressa com acabamento de galeria, pronta para pendurar.","price":"a partir de R$ 180"},
           {"name":"Fotos impressas","description":"Kit de fotos reveladas em papel fotográfico profissional.","price":"a partir de R$ 6 cada"}]'::jsonb
         else products end
 where id = 1;

alter table public.photo_deliveries add column if not exists referral_code text unique;
alter table public.budget_requests add column if not exists referral_code text;
grant insert (referral_code) on public.budget_requests to anon;

create or replace function public.get_delivery(p_slug text, p_pin text default null)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d public.photo_deliveries;
  st public.studio_settings;
  v_code text;
begin
  select * into d from public.photo_deliveries where slug = lower(trim(p_slug)) and active;
  if not found then
    return json_build_object('status', 'not_found');
  end if;
  if d.expires_at is not null and d.expires_at < (now() at time zone 'America/Sao_Paulo')::date then
    return json_build_object('status', 'expired', 'client_name', d.client_name, 'title', d.title);
  end if;
  if coalesce(d.pin, '') <> '' and coalesce(trim(p_pin), '') <> d.pin then
    return json_build_object('status', case when coalesce(p_pin, '') = '' then 'need_pin' else 'wrong_pin' end,
      'client_name', d.client_name, 'title', d.title, 'cover_url', d.cover_url);
  end if;

  v_code := d.referral_code;
  if v_code is null then
    loop
      v_code := upper(substr(regexp_replace(split_part(d.client_name, ' ', 1), '[^A-Za-z]', '', 'g'), 1, 5))
                || lpad((floor(random() * 900) + 100)::int::text, 3, '0');
      exit when not exists (select 1 from public.photo_deliveries where referral_code = v_code);
    end loop;
  end if;

  update public.photo_deliveries
     set views = views + 1, last_viewed_at = now(), first_viewed_at = coalesce(first_viewed_at, now()),
         referral_code = v_code
   where id = d.id;

  select * into st from public.studio_settings where id = 1;

  return json_build_object('status', 'ok', 'title', d.title, 'client_name', d.client_name,
    'event_date', d.event_date, 'drive_url', d.drive_url, 'cover_url', d.cover_url,
    'message', d.message, 'expires_at', d.expires_at, 'review_url', st.google_review_url,
    'products', coalesce(st.products, '[]'::jsonb), 'referral_reward', st.referral_reward,
    'referral_code', v_code);
end;
$fn$;

-- ---------- Aprovação de orçamento pelo link ----------
create table if not exists public.budget_shares (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique,
  event_id text not null unique,
  snapshot jsonb not null,
  expires_at date,
  status text not null default 'enviado' check (status in ('enviado', 'aprovado', 'recusado')),
  views int not null default 0,
  last_viewed_at timestamptz,
  responded_at timestamptz,
  approved_name text,
  approved_cpf text,
  response_note text,
  applied_at timestamptz
);
alter table public.budget_shares enable row level security;
drop policy if exists "orcamentos link: admin" on public.budget_shares;
create policy "orcamentos link: admin" on public.budget_shares for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'emersomhonorato@gmail.com');

create or replace function public.get_budget_share(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  b public.budget_shares;
  v_expired boolean;
begin
  select * into b from public.budget_shares where slug = lower(trim(p_slug));
  if not found then return json_build_object('status', 'not_found'); end if;
  v_expired := b.status = 'enviado' and b.expires_at is not null
               and b.expires_at < (now() at time zone 'America/Sao_Paulo')::date;
  update public.budget_shares set views = views + 1, last_viewed_at = now() where id = b.id;
  return json_build_object('status', case when v_expired then 'expired' else b.status end,
    'snapshot', b.snapshot, 'expires_at', b.expires_at, 'responded_at', b.responded_at,
    'approved_name', b.approved_name);
end;
$fn$;

create or replace function public.respond_budget_share(
  p_slug text, p_accept boolean, p_name text default null, p_cpf text default null, p_note text default null
) returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare
  b public.budget_shares;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  select * into b from public.budget_shares where slug = lower(trim(p_slug)) for update;
  if not found then raise exception 'Orçamento não encontrado.'; end if;
  if b.status <> 'enviado' then raise exception 'Este orçamento já foi respondido.'; end if;
  if b.expires_at is not null and b.expires_at < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Este orçamento venceu. Fale comigo pelo WhatsApp que eu atualizo pra você.';
  end if;
  if p_accept then
    if coalesce(p_name, '') !~ '[^[:space:]]{2,}[[:space:]]+[^[:space:]]{2,}' then
      raise exception 'Informe seu nome completo.';
    end if;
    if length(v_cpf) <> 11 then raise exception 'Informe um CPF válido (11 números).'; end if;
  end if;

  update public.budget_shares
     set status = case when p_accept then 'aprovado' else 'recusado' end,
         responded_at = now(), updated_at = now(),
         approved_name = case when p_accept then left(trim(p_name), 120) else null end,
         approved_cpf = case when p_accept then v_cpf else null end,
         response_note = left(nullif(trim(coalesce(p_note, '')), ''), 500)
   where id = b.id;

  begin
    execute 'select private.notify_whatsapp($1)' using
      case when p_accept
        then format('✅ Orçamento APROVADO pelo link: %s — %s', coalesce(b.snapshot->>'clientName', ''), coalesce(b.snapshot->>'eventType', ''))
        else format('❌ Orçamento recusado pelo link: %s — %s', coalesce(b.snapshot->>'clientName', ''), coalesce(nullif(trim(coalesce(p_note, '')), ''), 'sem motivo'))
      end;
  exception when others then null;
  end;

  return json_build_object('status', case when p_accept then 'aprovado' else 'recusado' end);
end;
$fn$;

revoke all on function public.get_budget_share(text) from public;
revoke all on function public.respond_budget_share(text, boolean, text, text, text) from public;
grant execute on function public.get_budget_share(text) to anon, authenticated;
grant execute on function public.respond_budget_share(text, boolean, text, text, text) to anon, authenticated;

select (select jsonb_array_length(products) from public.studio_settings where id = 1) as produtos,
       (select count(*) from public.budget_shares) as links;
