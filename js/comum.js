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

// ======= MAIÚSCULAS / MINÚSCULAS (formata pra exibir e ao salvar) =======
const PARTICULAS_NOME = ['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'van', 'von'];
const NOMES_PROPRIOS = { dublin: 'Dublin', cork: 'Cork', galway: 'Galway', limerick: 'Limerick', irlanda: 'Irlanda', luas: 'Luas', dart: 'DART', pps: 'PPS' };

function capitalizar(palavra){
  return palavra ? palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1) : '';
}

function juntarEspacos(texto){
  return String(texto || '').trim().split(' ').filter(Boolean).join(' ');
}

// "adilson mariano batista" -> "Adilson Mariano Batista"; "JOÃO DA SILVA" -> "João da Silva"
function formatarNome(nome){
  return juntarEspacos(nome).toLocaleLowerCase('pt-BR').split(' ').map((palavra, i) => {
    if (i > 0 && PARTICULAS_NOME.includes(palavra)) return palavra;
    return palavra.split('-').map(parte => parte.split("'").map(capitalizar).join("'")).join('-');
  }).join(' ');
}

// Só o primeiro nome, pro card ficar curto ("Adilson")
function primeiroNome(nome){
  return formatarNome(nome).split(' ')[0] || '';
}

// Título: TUDO EM MAIÚSCULAS vira frase normal, sempre começa com maiúscula e nomes de lugar ficam certos
function formatarTitulo(titulo){
  let t = juntarEspacos(titulo);
  const letras = t.split('').filter(ch => ch.toLocaleLowerCase('pt-BR') !== ch.toLocaleUpperCase('pt-BR'));
  const maiusculas = letras.filter(ch => ch === ch.toLocaleUpperCase('pt-BR')).length;
  if (letras.length >= 4 && maiusculas / letras.length > 0.8) t = t.toLocaleLowerCase('pt-BR');
  t = t.split(' ').map(palavra => NOMES_PROPRIOS[palavra.toLocaleLowerCase('pt-BR')] || palavra).join(' ');
  return capitalizar(t);
}

// "d060766" -> "D06 0766"
function formatarEircode(eircode){
  const original = juntarEspacos(eircode).toLocaleUpperCase('pt-BR');
  const limpo = original.split('').filter(ch => (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')).join('');
  return limpo.length === 7 ? limpo.slice(0, 3) + ' ' + limpo.slice(3) : original;
}
