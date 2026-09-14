// Código compartilhado por TODAS as páginas (index, painel, admin, redefinir-senha).
// Carregado antes do js/<pagina>.js. Tudo aqui é global.
// Alterou algo aqui? Afeta as 4 páginas.

// ======= CONFIGURAÇÃO DO SUPABASE =======
const SUPABASE_URL = 'https://jvsnugopxyjblwptgzlj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2c251Z29weHlqYmx3cHRnemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5ODYxNDEsImV4cCI6MjEwNDU2MjE0MX0.V1QJuEke7TPlNlk9fbDyJQhFUZf8TJ6PtP3JVhlp2Ew';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ======= UTILITÁRIOS =======
function togglePw(btn){
  const input = btn.previousElementSibling;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.querySelector('.eye-open').style.display = showing ? '' : 'none';
  btn.querySelector('.eye-closed').style.display = showing ? 'none' : '';
}

function getFotosArray(item){
  return (item.fotos_url || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

function formatEuro(valor){
  return (Number(valor) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDisponibilidade(item){
  if (!item.disponivel_de) return '';
  const de = new Date(item.disponivel_de + 'T00:00:00');
  let texto = 'Disponível a partir de ' + de.toLocaleDateString('pt-BR');
  if (item.disponivel_ate) {
    texto += ' até ' + new Date(item.disponivel_ate + 'T00:00:00').toLocaleDateString('pt-BR');
  } else {
    texto += ' · tempo a combinar';
  }
  return texto;
}

function isDestacado(item){
  return !!item.destaque_ate && new Date(item.destaque_ate) > new Date();
}

// Tipo de imóvel: valor salvo no banco -> nome mostrado nas telas
const TIPO_IMOVEL_LABEL = {
  'Individual': 'Quarto individual',
  'Compartilhado': 'Quarto compartilhado',
  'Studio': 'Studio',
  'Casa inteira': 'Casa inteira',
  'Apartamento inteiro': 'Apartamento inteiro'
};

function tipoImovelLabel(tipo){
  return TIPO_IMOVEL_LABEL[tipo] || tipo || '';
}

// true se o título já diz o tipo (ex: "Quarto individual em Rathmines" com tipo Individual), pra não repetir
function tituloJaTemTipo(titulo, tipo){
  // tira acentos e deixa minúsculo (códigos 768-879 são os acentos soltos depois do normalize)
  const norm = s => [...String(s || '').normalize('NFD')].filter(ch => { const n = ch.charCodeAt(0); return n < 768 || n > 879; }).join('').toLowerCase();
  const t = norm(titulo);
  return !!tipo && (t.includes(norm(tipoImovelLabel(tipo))) || t.includes(norm(tipo)));
}

// Tira do fim do título o local que o anúncio já mostra em cima (ex: "Quarto compartilhado em Dublin 3"),
// pra não repetir. Só mexe na exibição; o título salvo no banco não muda.
function tituloSemLocal(titulo, item){
  const t = String(titulo || '').trim();
  const cidade = String(item.cidade || '').trim();
  const distrito = String(item.distrito || '').trim();
  const locais = [cidade && distrito ? cidade + ' ' + distrito : '', distrito, cidade].filter(Boolean);
  for (const local of locais) {
    const sufixo = ' em ' + local;
    if (t.length > sufixo.length && t.toLowerCase().endsWith(sufixo.toLowerCase())) {
      return t.slice(0, t.length - sufixo.length).trim();
    }
  }
  return t;
}
