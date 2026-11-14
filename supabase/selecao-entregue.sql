-- Marcação de entrega (só para o admin): digital entregue e reveladas entregues
alter table public.photo_selections add column if not exists digital_delivered_at timestamptz;
alter table public.photo_selections add column if not exists prints_delivered_at timestamptz;
