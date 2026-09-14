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

// ======= FOTOS: reduz e comprime antes de enviar =======
// Foto de celular chega com 2-5 MB; aqui vira JPEG de ~150-350 KB com o lado maior até 1600px.
const FOTO_LADO_MAX = 1600;

async function comprimirImagem(file){
  if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/gif') return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    return file; // formato que o navegador não abre (ex: HEIC): envia como veio
  }
  const escala = Math.min(1, FOTO_LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (bitmap.close) bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob || blob.size >= file.size) return file;
  const nome = file.name || 'foto';
  const ponto = nome.lastIndexOf('.');
  return new File([blob], (ponto > 0 ? nome.slice(0, ponto) : nome) + '.jpg', { type: 'image/jpeg' });
}


// ======= AVISO (toast) — substitui os alert() feios =======
function mostrarAviso(mensagem, tipo){
  tipo = tipo === 'erro' ? 'erro' : 'sucesso';
  if (!document.getElementById('aviso-estilos')) {
    const st = document.createElement('style');
    st.id = 'aviso-estilos';
    st.textContent = [
      "#avisoContainer{position:fixed;left:0;right:0;bottom:22px;z-index:200;display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none;padding:0 16px;}",
      ".aviso{pointer-events:auto;max-width:440px;width:100%;display:flex;gap:12px;align-items:flex-start;background:var(--paper,#F6F1E4);color:var(--ink,#1B2A1E);border:1px solid var(--line,rgba(27,42,30,0.14));border-left:5px solid var(--sun,#E8A33D);border-radius:10px;padding:14px 16px;box-shadow:0 10px 30px rgba(27,42,30,0.18);font-family:'Work Sans',sans-serif;font-size:0.95rem;line-height:1.4;animation:avisoIn .25s ease;}",
      ".aviso.erro{border-left-color:var(--clay,#C1502E);}",
      ".aviso .ico{flex-shrink:0;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;margin-top:1px;background:var(--pine,#1F4D3A);}",
      ".aviso.erro .ico{background:var(--clay,#C1502E);}",
      ".aviso .fechar{margin-left:auto;background:none;border:none;cursor:pointer;color:#8a8a7c;font-size:1.2rem;line-height:1;padding:0 2px;}",
      "@keyframes avisoIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}",
      "@media (prefers-reduced-motion:reduce){.aviso{animation:none;}}"
    ].join('');
    document.head.appendChild(st);
  }
  let cont = document.getElementById('avisoContainer');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'avisoContainer';
    document.body.appendChild(cont);
  }
  const el = document.createElement('div');
  el.className = 'aviso ' + tipo;
  el.setAttribute('role', 'status');
  const ico = document.createElement('span');
  ico.className = 'ico';
  ico.textContent = tipo === 'erro' ? '!' : '\u2713';
  const txt = document.createElement('span');
  txt.style.flex = '1';
  txt.textContent = mensagem;
  const btn = document.createElement('button');
  btn.className = 'fechar';
  btn.setAttribute('aria-label', 'Fechar');
  btn.textContent = '\u00d7';
  const remover = function(){ el.remove(); };
  btn.onclick = remover;
  el.appendChild(ico); el.appendChild(txt); el.appendChild(btn);
  cont.appendChild(el);
  setTimeout(remover, tipo === 'erro' ? 7000 : 5000);
}
