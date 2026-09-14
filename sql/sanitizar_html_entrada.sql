-- Chave Verde — segunda camada anti-XSS: remove sinais de tag HTML (< >) na ENTRADA.
-- Complementa (NAO substitui) a escapagem na saida (escapeHtml), que continua sendo a
-- protecao principal. Aqui, nenhum campo de texto do usuario consegue ARMAZENAR "<" ou ">",
-- entao nenhuma tag HTML entra no banco (avaliacoes, denuncias, quartos).
--
-- Triggers NOVOS e independentes: nao tocam nos triggers existentes (anti-flood,
-- validacao de status etc.), so limpam os campos de texto antes de gravar.
--
-- Supabase: SQL Editor -> New query -> cole tudo -> Run. Idempotente.

-- Funcao utilitaria: tira < e > de um texto (null-safe)
create or replace function public.limpar_tags(txt text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(txt, ''), '[<>]', '', 'g');
$$;

-- ===== avaliacoes: nome, comentario =====
create or replace function public.sanitizar_avaliacao()
returns trigger language plpgsql as $$
begin
  new.nome       := public.limpar_tags(new.nome);
  new.comentario := public.limpar_tags(new.comentario);
  return new;
end; $$;
drop trigger if exists trg_sanitizar_avaliacao on public.avaliacoes;
create trigger trg_sanitizar_avaliacao
  before insert or update on public.avaliacoes
  for each row execute function public.sanitizar_avaliacao();

-- ===== denuncias: motivo =====
create or replace function public.sanitizar_denuncia()
returns trigger language plpgsql as $$
begin
  new.motivo := public.limpar_tags(new.motivo);
  return new;
end; $$;
drop trigger if exists trg_sanitizar_denuncia on public.denuncias;
create trigger trg_sanitizar_denuncia
  before insert or update on public.denuncias
  for each row execute function public.sanitizar_denuncia();

-- ===== quartos: titulo, descricao, nome =====
create or replace function public.sanitizar_quarto()
returns trigger language plpgsql as $$
begin
  new.titulo    := public.limpar_tags(new.titulo);
  new.descricao := public.limpar_tags(new.descricao);
  new.nome      := public.limpar_tags(new.nome);
  return new;
end; $$;
drop trigger if exists trg_sanitizar_quarto on public.quartos;
create trigger trg_sanitizar_quarto
  before insert or update on public.quartos
  for each row execute function public.sanitizar_quarto();
