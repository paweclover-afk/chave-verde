-- Chave Verde — contador de cliques no botão "Falar no WhatsApp" (por anúncio)
-- Rode uma vez no Supabase: Dashboard -> SQL Editor -> New query -> cole tudo -> Run.
-- Seguro rodar de novo (idempotente).

-- 1) coluna do contador no anúncio
alter table public.quartos
  add column if not exists whatsapp_cliques int not null default 0;

-- 2) função que incrementa o contador.
--    O visitante (anon) não pode dar UPDATE no anúncio direto (RLS), então ele chama
--    esta função, que roda com privilégio de dono (security definer) e só soma 1.
--    Só conta clique de anúncio que existe e está Ativo.
create or replace function public.registrar_clique_whatsapp(p_anuncio_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quartos
     set whatsapp_cliques = coalesce(whatsapp_cliques, 0) + 1
   where id = p_anuncio_id and status = 'Ativo';
end;
$$;

-- 3) libera a função para visitantes e usuários logados
grant execute on function public.registrar_clique_whatsapp(bigint) to anon, authenticated;
