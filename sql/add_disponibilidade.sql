-- Chave Verde — adiciona os campos de disponibilidade futura
-- Rode isso uma vez no Supabase: Dashboard → SQL Editor → New query → cole tudo → Run

alter table public.quartos add column if not exists disponivel_de date;
alter table public.quartos add column if not exists disponivel_ate date;

-- disponivel_de = null           -> anúncio já disponível agora (comportamento de sempre)
-- disponivel_de = uma data futura -> aparece como "Lançamento futuro" na busca
-- disponivel_ate = null           -> "tempo a combinar" (sem data de saída definida)
-- disponivel_ate = uma data       -> período com fim definido
