-- Chave Verde — fecha a exposicao da funcao limpar_tags via RPC.
-- Antes: os triggers de sanitizacao chamavam public.limpar_tags(text), que ficava
-- chamavel via /rest/v1/rpc/limpar_tags pelo anon (inofensiva, mas exposicao desnecessaria).
-- Agora: o regex fica INLINE dentro de cada trigger e a funcao limpar_tags e' apagada.
-- A sanitizacao continua 100% ativa; nada quebra (os triggers ja existem e apontam
-- para estas funcoes, que sao substituidas em lugar).
--
-- Supabase: SQL Editor -> New query -> cole tudo -> Run. Idempotente.

create or replace function public.sanitizar_avaliacao()
returns trigger language plpgsql as $$
begin
  new.nome       := regexp_replace(coalesce(new.nome,''), '[<>]', '', 'g');
  new.comentario := regexp_replace(coalesce(new.comentario,''), '[<>]', '', 'g');
  return new;
end; $$;

create or replace function public.sanitizar_denuncia()
returns trigger language plpgsql as $$
begin
  new.motivo := regexp_replace(coalesce(new.motivo,''), '[<>]', '', 'g');
  return new;
end; $$;

create or replace function public.sanitizar_quarto()
returns trigger language plpgsql as $$
begin
  new.titulo    := regexp_replace(coalesce(new.titulo,''), '[<>]', '', 'g');
  new.descricao := regexp_replace(coalesce(new.descricao,''), '[<>]', '', 'g');
  new.nome      := regexp_replace(coalesce(new.nome,''), '[<>]', '', 'g');
  return new;
end; $$;

-- ja sem dependencia, remove a funcao exposta
drop function if exists public.limpar_tags(text);
