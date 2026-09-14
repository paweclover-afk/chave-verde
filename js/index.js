// Script da página index.html
// Depende de js/comum.js (supabaseClient, escapeHtml, formatEuro, getFotosArray,
// formatDisponibilidade, isDestacado, togglePw). CSS em css/index.css.

  let verificadoUserIds = new Set();
  async function loadVerificados(){
    const { data, error } = await supabaseClient.from('verificados').select('user_id');
    if (!error && data) verificadoUserIds = new Set(data.map(v => v.user_id));
  }

  function toggleMobileMenu(){
    const nav = document.getElementById('navLinks');
    const btn = document.querySelector('.menu-toggle');
    const aberto = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
  }
  function closeMobileMenu(){
    document.getElementById('navLinks').classList.remove('open');
    document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false');
  }

  function openAuth(tab){
    document.getElementById('authOverlay').classList.add('open');
    switchTab(tab || 'login');
  }
  function closeAuth(){
    document.getElementById('authOverlay').classList.remove('open');
  }
  function switchTab(tab){
    const isLogin = tab === 'login';
    const isSignup = tab === 'signup';
    const isForgot = tab === 'forgot';
    document.getElementById('tabLogin').classList.toggle('active', isLogin);
    document.getElementById('tabSignup').classList.toggle('active', isSignup);
    document.getElementById('loginForm').style.display = isLogin ? 'flex' : 'none';
    document.getElementById('signupForm').style.display = isSignup ? 'flex' : 'none';
    document.getElementById('forgotForm').style.display = isForgot ? 'flex' : 'none';
    document.getElementById('loginError').textContent = '';
    document.getElementById('signupError').textContent = '';
    document.getElementById('forgotError').textContent = '';
    document.getElementById('forgotSuccess').textContent = '';
    document.getElementById('authFooterNote').style.display = isForgot ? 'none' : 'block';
  }

  async function handleLogin(event){
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = 'Email ou senha incorretos. Se não lembra a senha, use "Esqueceu sua senha?" abaixo.';
      return false;
    }
    closeAuth();
    window.location.href = 'painel.html';
    return false;
  }

  async function handleSignup(event){
    event.preventDefault();
    const nome = document.getElementById('signupNome').value;
    const tipoUsuario = document.getElementById('signupTipo').value;
    const whatsapp = document.getElementById('signupWhatsapp').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const errorEl = document.getElementById('signupError');
    errorEl.textContent = '';

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { nome: formatarNome(nome), whatsapp: whatsapp, tipo_usuario: tipoUsuario } }
    });
    if (error) {
      errorEl.textContent = 'Não foi possível criar a conta: ' + error.message;
      return false;
    }
    // Se a confirmação de email estiver ligada, não há sessão ainda:
    // o usuário precisa clicar no link enviado por email antes de entrar.
    if (!data.session) {
      errorEl.style.color = '#1F4D3A';
      errorEl.textContent = 'Conta criada! Enviamos um email de confirmação para ' + email + '. Abra o email e clique no link para ativar sua conta — depois é só entrar.';
      document.getElementById('signupForm').reset();
      return false;
    }
    closeAuth();
    window.location.href = 'painel.html';
    return false;
  }

  async function handleForgotPassword(event){
    event.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const errorEl = document.getElementById('forgotError');
    const successEl = document.getElementById('forgotSuccess');
    errorEl.textContent = '';
    successEl.textContent = '';

    const redirectTo = window.location.origin + '/redefinir-senha.html';
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      errorEl.textContent = 'Não foi possível enviar o email: ' + error.message;
      return false;
    }
    successEl.textContent = 'Email enviado! Verifique sua caixa de entrada (e o spam).';
    return false;
  }

  async function handleLogout(){
    await supabaseClient.auth.signOut();
    updateAuthUI();
  }

  async function updateAuthUI(){
    const { data: { session } } = await supabaseClient.auth.getSession();
    const btn = document.getElementById('openAuthBtn');
    // seção "Meus anúncios" só pra quem está logado (visitante já tem a seção "Anunciar")
    const secaoPainel = document.getElementById('painel');
    if (secaoPainel) secaoPainel.hidden = !session;
    if (session) {
      btn.textContent = 'Meu painel';
      btn.setAttribute('href', 'painel.html');
      btn.onclick = null;
    } else {
      btn.textContent = 'Entrar';
      btn.setAttribute('href', '#');
      btn.onclick = function(e){ e.preventDefault(); openAuth('login'); };
    }
  }

  // ======= SELETOR DE CIDADE =======
  const CITY_KEY = 'chaveverde_cidade';

  function getSavedCity(){
    try { return localStorage.getItem(CITY_KEY) || ''; } catch (e) { return ''; }
  }
  function saveCity(cidade){
    try {
      if (cidade) localStorage.setItem(CITY_KEY, cidade);
      else localStorage.removeItem(CITY_KEY);
    } catch (e) {}
  }
  function openCitySelector(){
    document.getElementById('cityOverlay').classList.add('open');
  }
  function closeCitySelector(){
    document.getElementById('cityOverlay').classList.remove('open');
  }
  function updateCityPill(cidade){
    document.getElementById('cityPillLabel').textContent = cidade || 'Todas as cidades';
  }
  async function selectCity(cidade){
    saveCity(cidade);
    updateCityPill(cidade);
    closeCitySelector();
    await loadPublicListings(cidade);
  }

  // ======= LISTA PÚBLICA =======
  const listingsCache = {};

  function whatsappLink(item){
    const digits = (item.whatsapp || '').replace(/\D/g, '');
    const msg = encodeURIComponent(`Oi! Vi seu anúncio "${formatarTitulo(item.titulo)}" no Chave Verde e queria saber mais informações.`);
    return `https://wa.me/${digits}?text=${msg}`;
  }

  function whatsIconSvg(){
    return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.3-.4.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.6 1.4 5.1L2 22l5-1.3c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.3c-1.6 0-3.1-.4-4.5-1.2l-.3-.2-3 .8.8-2.9-.2-.3C4 15.1 3.5 13.6 3.5 12c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5-3.8 8.3-8.5 8.3z"/></svg>';
  }

  function isLancamentoFuturo(item){
    if (!item.disponivel_de) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return new Date(item.disponivel_de + 'T00:00:00') > hoje;
  }

  // No card só o primeiro nome; na página do anúncio (completo = true) o nome inteiro
  function renderAnunciante(item, completo){
    if (!item.nome) return '';
    const nome = completo ? formatarNome(item.nome) : primeiroNome(item.nome);
    const verificado = verificadoUserIds.has(item.user_id)
      ? `<svg class="verified-icon" viewBox="0 0 20 20" fill="none" aria-label="Anunciante verificado pela equipe Chave Verde"><title>Anunciante verificado pela equipe Chave Verde</title><circle cx="10" cy="10" r="9" fill="var(--sun)"/><path d="M6 10.3l2.6 2.6L14 7.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : '';
    return `<p class="listing-anunciante">Anunciado por ${escapeHtml(nome)}${verificado}</p>`;
  }

  function renderCardPhotoArea(item, fotos){
    const destaqueBadge = isDestacado(item) ? '<span class="badge-destaque">★ Destaque</span>' : '';
    const futuroBadge = isLancamentoFuturo(item) ? '<span class="badge-futuro">Lançamento futuro</span>' : '';
    if (fotos.length === 0) {
      return `<div class="listing-photo" data-id="${item.id}" style="background:linear-gradient(135deg,#DCA85C,#4C7A63);">${destaqueBadge}${futuroBadge}</div>`;
    }
    const alt = escapeHtml(formatarTitulo(item.titulo) || 'Foto do anúncio');
    // a 1ª imagem é a mesma foto desfocada, cobrindo as faixas pretas de fotos em pé
    const slides = fotos.map((url, i) => `
      <div class="carousel-slide">
        <img class="slide-fundo" src="${escapeHtml(url)}" loading="lazy" alt="" aria-hidden="true">
        <img src="${escapeHtml(url)}" loading="lazy" alt="${alt} — foto ${i + 1} de ${fotos.length}">
      </div>
    `).join('');
    const dots = fotos.length > 1
      ? `<div class="carousel-dots">${fotos.map((_, i) => `<span class="carousel-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>`
      : '';
    const arrows = fotos.length > 1
      ? `<button type="button" class="carousel-arrow prev" onclick="event.stopPropagation(); moveCardCarousel(${item.id}, -1)">&#8249;</button>
         <button type="button" class="carousel-arrow next" onclick="event.stopPropagation(); moveCardCarousel(${item.id}, 1)">&#8250;</button>`
      : '';
    return `
      <div class="listing-photo" data-id="${item.id}">
        ${destaqueBadge}
        ${futuroBadge}
        <div class="carousel-track" id="carouselTrack-${item.id}">${slides}</div>
        ${dots}
        ${arrows}
      </div>
    `;
  }

  function renderPublicCard(item){
    listingsCache[item.id] = item;
    const badge = item.aceita_sem_pps ? '<span class="postcard-tag">Aceita sem PPS</span>' : '';
    const genero = item.genero ? `<span class="postcard-tag">${escapeHtml(item.genero)}</span>` : '';
    const tipo = item.tipo_quarto && !tituloJaTemTipo(item.titulo, item.tipo_quarto) ? `<span class="postcard-tag">${escapeHtml(tipoImovelLabel(item.tipo_quarto))}</span>` : '';
    const fotos = getFotosArray(item);
    return `
      <article class="listing-card">
        ${renderCardPhotoArea(item, fotos)}
        <div class="listing-info">
          <p class="listing-city">${escapeHtml(item.cidade)}${item.distrito ? ' ' + escapeHtml(item.distrito) : ''}${item.eircode ? ' · ' + escapeHtml(formatarEircode(item.eircode)) : ''}</p>
          <h3 class="listing-title"><a href="?anuncio=${item.id}#anuncios" onclick="openListingDetail(${item.id}); return false;">${escapeHtml(formatarTitulo(tituloSemLocal(item.titulo, item)))}</a></h3>
          ${renderAnunciante(item)}
          ${formatDisponibilidade(item) ? `<p class="listing-disponibilidade">${formatDisponibilidade(item)}</p>` : ''}
          ${tipo || badge || genero ? `<div class="listing-tags">${tipo}${badge}${genero}</div>` : ''}
          <div class="listing-spacer"></div>
          <div class="listing-foot">
            <span class="listing-price">€${formatEuro(item.valor)} <small>/mês</small></span>
          </div>
          <a class="listing-whats-btn" href="${whatsappLink(item)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
            ${whatsIconSvg()} Falar no WhatsApp
          </a>
        </div>
      </article>
    `;
  }

  // ======= CARROSSEL DE FOTOS NOS CARDS =======
  const cardCarousels = {};

  function goToCardSlide(id, index){
    const state = cardCarousels[id];
    if (!state || state.total === 0) return;
    state.index = ((index % state.total) + state.total) % state.total;
    const track = document.getElementById('carouselTrack-' + id);
    if (track) track.style.transform = `translateX(-${state.index * 100}%)`;
    const photoEl = document.querySelector(`.listing-photo[data-id="${id}"]`);
    if (photoEl) {
      photoEl.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === state.index));
    }
  }

  function moveCardCarousel(id, delta){
    goToCardSlide(id, (cardCarousels[id]?.index || 0) + delta);
    restartCardAutoplay(id);
  }

  function restartCardAutoplay(id){
    const state = cardCarousels[id];
    if (!state || state.total <= 1) return;
    if (state.intervalId) clearInterval(state.intervalId);
    const delay = 5000 + Math.random() * 5000; // avança sozinho entre 5 e 10 segundos
    state.intervalId = setInterval(() => goToCardSlide(id, state.index + 1), delay);
  }

  function stopAllCardCarousels(){
    Object.values(cardCarousels).forEach(s => { if (s.intervalId) clearInterval(s.intervalId); });
    for (const key in cardCarousels) delete cardCarousels[key];
  }

  function initCardCarousels(){
    stopAllCardCarousels();
    document.querySelectorAll('.listing-photo[data-id]').forEach(el => {
      const id = Number(el.dataset.id);
      const track = el.querySelector('.carousel-track');
      const total = track ? track.children.length : 0;
      cardCarousels[id] = { index: 0, total, intervalId: null };
      if (total > 1) restartCardAutoplay(id);

      let startX = 0, startY = 0, dragging = false, moved = false;

      el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.carousel-arrow')) { dragging = false; return; }
        startX = e.clientX; startY = e.clientY; dragging = true; moved = false;
      });
      el.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        if (Math.abs(e.clientX - startX) > 8) moved = true;
      });
      el.addEventListener('pointerup', (e) => {
        if (e.target.closest('.carousel-arrow')) { dragging = false; return; }
        if (!dragging) return;
        dragging = false;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        if (total > 1 && Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
          moveCardCarousel(id, deltaX < 0 ? 1 : -1);
        } else if (!moved) {
          openListingDetail(id);
        }
      });
      el.addEventListener('pointercancel', () => { dragging = false; });
    });
  }

  let currentCityListings = [];
  let currentCityLabel = '';
  let currentDistritoFilter = '';
  let currentGeneroFilter = '';
  let currentFuturosFilter = false;
  let currentPrecoMax = null;

  async function loadPublicListings(cidade){
    const statusEl = document.getElementById('publicListingsStatus');
    const grid = document.getElementById('publicListingsGrid');
    let query = supabaseClient
      .from('quartos')
      .select('*')
      .eq('status', 'Ativo')
      .order('created_at', { ascending: false });
    if (cidade) query = query.eq('cidade', cidade);
    const { data, error } = await query;

    if (error) {
      statusEl.textContent = 'Não foi possível carregar os anúncios agora.';
      return;
    }

    currentCityListings = data || [];
    currentCityLabel = cidade || '';
    currentDistritoFilter = '';
    currentGeneroFilter = '';
    document.getElementById('generoFilter').value = '';
    currentPrecoMax = null;
    document.getElementById('precoFilter').value = '';
    currentFuturosFilter = false;
    document.getElementById('futurosToggle').classList.remove('active');
    populateDistritoFilter();
    renderFilteredListings();
    initCardCarousels();

    // se a URL já pede um anúncio específico (link direto/compartilhado), abre ele
    const params = new URLSearchParams(window.location.search);
    const anuncioId = params.get('anuncio');
    if (anuncioId) openListingDetail(Number(anuncioId), false);
  }

  const DUBLIN_DISTRITOS = ['1','2','3','4','5','6','6W','7','8','9','10','11','12','13','14','15','16','17','18','20','22','24'];

  function populateDistritoFilter(){
    const select = document.getElementById('distritoFilter');

    // Dublin tem uma lista oficial de distritos — mostra todos, mesmo os que ainda não têm anúncio,
    // pra pessoa poder ir trocando (Dublin 1, Dublin 2, Dublin 3...) até achar o que procura.
    if (currentCityLabel === 'Dublin') {
      select.style.display = 'inline-block';
      select.innerHTML = '<option value="">Todos os distritos</option>' +
        DUBLIN_DISTRITOS.map(d => `<option value="${d}">Dublin ${d}</option>`).join('');
      select.value = '';
      return;
    }

    // Outras cidades não têm uma lista oficial — mostra só os distritos/bairros que já existem nos anúncios.
    const distritos = Array.from(new Set(
      currentCityListings.map(item => (item.distrito || '').trim()).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

    if (distritos.length === 0) {
      select.style.display = 'none';
      select.innerHTML = '<option value="">Todos os distritos</option>';
      return;
    }
    select.style.display = 'inline-block';
    select.innerHTML = '<option value="">Todos os distritos</option>' +
      distritos.map(d => `<option value="${d}">${currentCityLabel || ''} ${d}</option>`).join('');
    select.value = '';
  }

  function applyDistritoFilter(distrito){
    currentDistritoFilter = distrito;
    renderFilteredListings();
    initCardCarousels();
  }

  function applyGeneroFilter(genero){
    currentGeneroFilter = genero;
    renderFilteredListings();
    initCardCarousels();
  }

  function toggleFuturosFilter(){
    currentFuturosFilter = !currentFuturosFilter;
    document.getElementById('futurosToggle').classList.toggle('active', currentFuturosFilter);
    renderFilteredListings();
    initCardCarousels();
  }

  function applyPrecoFilter(valor){
    currentPrecoMax = valor ? Number(valor) : null;
    renderFilteredListings();
    initCardCarousels();
  }

  function renderFilteredListings(){
    const statusEl = document.getElementById('publicListingsStatus');
    const grid = document.getElementById('publicListingsGrid');

    let data = currentCityListings;
    if (currentDistritoFilter) {
      data = data.filter(item => (item.distrito || '').trim() === currentDistritoFilter);
    }
    if (currentGeneroFilter) {
      data = data.filter(item => (item.genero || 'Misto') === currentGeneroFilter);
    }
    if (currentFuturosFilter) {
      data = data.filter(isLancamentoFuturo);
    }
    if (currentPrecoMax) {
      data = data.filter(item => (Number(item.valor) || 0) <= currentPrecoMax);
    }

    if (data.length === 0) {
      const partes = [];
      if (currentCityLabel) partes.push(currentDistritoFilter ? `${currentCityLabel} ${currentDistritoFilter}` : currentCityLabel);
      if (currentGeneroFilter) partes.push(currentGeneroFilter);
      if (currentPrecoMax) partes.push(`até €${currentPrecoMax}`);
      if (currentFuturosFilter) partes.push('lançamentos futuros');
      const ondeTexto = partes.length ? `em ${partes.join(' · ')}` : '';
      statusEl.textContent = ondeTexto
        ? `Nenhum anúncio ${ondeTexto} no momento — volte em breve ou veja outros filtros.`
        : 'Nenhum anúncio disponível no momento — volte em breve.';
      grid.innerHTML = '';
      return;
    }

    statusEl.textContent = '';
    const destacados = data
      .filter(isDestacado)
      .sort((a, b) => new Date(b.destaque_ate) - new Date(a.destaque_ate));
    const normais = data.filter(item => !isDestacado(item));
    const ordenados = destacados.concat(normais);
    grid.innerHTML = ordenados.map(renderPublicCard).join('');
  }

  // ======= PÁGINA DE DETALHES DO ANÚNCIO =======
  let detailFotos = [];

  function setDetailMainPhoto(url, index){
    const el = document.getElementById('detailMainPhoto');
    if (!url) {
      el.innerHTML = '';
      el.style.background = 'linear-gradient(135deg,#DCA85C,#4C7A63)';
      return;
    }
    el.style.background = '';
    const countBadge = detailFotos.length > 1 ? `<span class="detail-photo-count">${index + 1} / ${detailFotos.length}</span>` : '';
    el.innerHTML = `
      <img class="slide-fundo" src="${escapeHtml(url)}" alt="" aria-hidden="true">
      <img src="${escapeHtml(url)}" alt="Foto ${index + 1} de ${detailFotos.length}" onclick="openLightbox(${index})">
      ${countBadge}
    `;
  }

  function renderListingDetail(item){
    const fotos = getFotosArray(item);
    detailFotos = fotos;
    const badge = item.aceita_sem_pps ? '<span class="postcard-tag">Aceita sem PPS</span>' : '';
    const genero = item.genero ? `<span class="postcard-tag">${escapeHtml(item.genero)}</span>` : '';
    const tipo = item.tipo_quarto && !tituloJaTemTipo(item.titulo, item.tipo_quarto) ? `<span class="postcard-tag">${escapeHtml(tipoImovelLabel(item.tipo_quarto))}</span>` : '';
    const thumbs = fotos.map((url, i) => `
      <div class="detail-thumb${i === 0 ? ' active' : ''}" data-index="${i}" onclick="selectDetailThumb(this, ${i})"></div>
    `).join('');

    document.getElementById('detailContent').innerHTML = `
      <div>
        <div class="detail-gallery-main" id="detailMainPhoto"></div>
        ${fotos.length > 1 ? `<div class="detail-thumbs">${thumbs}</div>` : ''}
      </div>
      <div>
        <p class="detail-city">${escapeHtml(item.cidade)}${item.distrito ? ' ' + escapeHtml(item.distrito) : ''}${item.eircode ? ' · ' + escapeHtml(formatarEircode(item.eircode)) : ''}</p>
        <h2 class="detail-title">${escapeHtml(formatarTitulo(tituloSemLocal(item.titulo, item)))}</h2>
        <div class="detail-tags">${tipo}${badge}${genero}</div>
        ${renderAnunciante(item, true)}
        ${formatDisponibilidade(item) ? `<p class="listing-disponibilidade" style="margin-top:12px;">${formatDisponibilidade(item)}</p>` : ''}
        ${item.descricao ? `<p class="detail-desc">${escapeHtml(item.descricao)}</p>` : ''}
        <p class="detail-price">€${formatEuro(item.valor)} <span>/mês</span></p>
        <a class="btn listing-whats-btn" style="margin-top:20px;" href="${whatsappLink(item)}" target="_blank" rel="noopener">
          ${whatsIconSvg()} Falar no WhatsApp
        </a>
        <button type="button" class="report-btn" onclick="openReport(${item.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V4a1 1 0 0 1 1-1h11l-2 4 2 4H5"/></svg>
          Denunciar este anúncio
        </button>
      </div>
    `;
    // URL aplicada via JS (não interpolada no HTML) pra evitar XSS pelo campo fotos_url
    document.querySelectorAll('#detailContent .detail-thumb').forEach(el => {
      el.style.backgroundImage = 'url(' + JSON.stringify(fotos[Number(el.dataset.index)]) + ')';
    });
    setDetailMainPhoto(fotos[0], 0);
  }

  let reportAnuncioId = null;
  function openReport(anuncioId){
    reportAnuncioId = anuncioId;
    document.getElementById('reportMotivo').value = '';
    document.getElementById('reportError').textContent = '';
    document.querySelectorAll('#reportReasons .report-chip').forEach(c => c.classList.remove('active'));
    document.getElementById('reportOverlay').classList.add('open');
  }
  function closeReport(){
    document.getElementById('reportOverlay').classList.remove('open');
    reportAnuncioId = null;
  }
  function selectReportReason(btn){
    btn.classList.toggle('active');
  }
  async function enviarDenuncia(){
    const errorEl = document.getElementById('reportError');
    errorEl.textContent = '';
    if (!reportAnuncioId) {
      errorEl.textContent = 'Não foi possível identificar o anúncio. Feche e abra a denúncia de novo.';
      return;
    }
    const chips = Array.from(document.querySelectorAll('#reportReasons .report-chip.active')).map(c => c.textContent.trim());
    const texto = document.getElementById('reportMotivo').value.trim();
    let motivo = [chips.join(', '), texto].filter(Boolean).join(' — ');
    if (!motivo) {
      errorEl.textContent = 'Escolha um motivo acima ou escreva o que está errado.';
      return;
    }
    motivo = motivo.slice(0, 500); // o banco também limita (trigger + constraint)
    const { error } = await supabaseClient.from('denuncias').insert({ anuncio_id: reportAnuncioId, motivo });
    if (error) {
      errorEl.textContent = 'Não foi possível enviar agora. Tente de novo em instantes.';
      return;
    }
    closeReport();
    mostrarAviso('Denúncia enviada. Nossa equipe vai analisar. Obrigado por ajudar a manter o Chave Verde seguro!', 'sucesso');
  }

  function selectDetailThumb(el, index){
    document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    setDetailMainPhoto(detailFotos[index], index);
  }

  // ======= VISUALIZADOR DE FOTO EM TELA CHEIA =======
  let lightboxIndex = 0;

  function updateLightboxImg(){
    document.getElementById('lightboxImg').src = detailFotos[lightboxIndex];
    document.getElementById('lightboxImg').alt = 'Foto ' + (lightboxIndex + 1) + ' de ' + detailFotos.length;
    document.getElementById('lightboxCount').textContent = `${lightboxIndex + 1} / ${detailFotos.length}`;
  }

  function openLightbox(index){
    if (!detailFotos.length) return;
    lightboxIndex = index;
    updateLightboxImg();
    document.getElementById('lightboxOverlay').classList.add('open');
  }

  function closeLightbox(){
    document.getElementById('lightboxOverlay').classList.remove('open');
  }

  function moveLightbox(delta){
    lightboxIndex = ((lightboxIndex + delta) % detailFotos.length + detailFotos.length) % detailFotos.length;
    updateLightboxImg();
  }

  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('lightboxOverlay').classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') moveLightbox(-1);
    if (e.key === 'ArrowRight') moveLightbox(1);
  });

  async function openListingDetail(id, pushState){
    let item = listingsCache[id];
    if (!item && Number.isInteger(id) && id > 0) {
      // maybeSingle: anúncio inexistente/removido volta vazio em vez de erro 406
      const { data } = await supabaseClient.from('quartos').select('*').eq('id', id).eq('status', 'Ativo').maybeSingle();
      item = data;
    }
    if (!item) {
      // link antigo ou errado: tira o ?anuncio= da barra e fica na lista
      if (new URLSearchParams(window.location.search).has('anuncio')) {
        history.replaceState({}, '', window.location.pathname + '#anuncios');
      }
      return;
    }
    listingsCache[id] = item;
    renderListingDetail(item);
    document.getElementById('detailOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    if (pushState !== false) {
      history.pushState({ anuncio: id }, '', `?anuncio=${id}#anuncios`);
    }
  }

  function closeListingDetail(skipHistory){
    document.getElementById('detailOverlay').classList.remove('open');
    document.body.style.overflow = '';
    if (!skipHistory) {
      history.pushState({}, '', window.location.pathname + '#anuncios');
    }
  }

  window.addEventListener('popstate', function(){
    const params = new URLSearchParams(window.location.search);
    const anuncioId = params.get('anuncio');
    if (anuncioId) {
      openListingDetail(Number(anuncioId), false);
    } else {
      closeListingDetail(true);
    }
  });

  const savedCity = getSavedCity();
  updateCityPill(savedCity);
  updateAuthUI();
  loadVerificados().then(() => loadPublicListings(savedCity));
  loadAvaliacoes();

  // A janela de cidade não abre sozinha: quem chega vê todas as cidades e troca pelo botão "Trocar cidade".

  // ======= AVALIAÇÕES DO SITE =======
  async function loadAvaliacoes(){
    const grid = document.getElementById('avaliacoesGrid');
    const resumo = document.getElementById('avaliacoesResumo');
    if (!grid) return;
    const { data, error } = await supabaseClient
      .from('avaliacoes').select('nome, nota, comentario, criado_em')
      .eq('aprovada', true).order('criado_em', { ascending: false }).limit(12);
    if (error || !data || data.length === 0) {
      grid.innerHTML = '';
      resumo.textContent = 'Seja a primeira pessoa a avaliar o Chave Verde.';
      return;
    }
    const media = data.reduce((s, a) => s + a.nota, 0) / data.length;
    resumo.innerHTML = estrelasHtml(Math.round(media)) + ' <strong>' + media.toFixed(1) + '</strong> · ' + data.length + ' avaliaç' + (data.length === 1 ? 'ão' : 'ões');
    grid.innerHTML = data.map(a => `
      <div class="avaliacao-card">
        ${estrelasHtml(a.nota)}
        ${a.comentario ? `<p class="avaliacao-texto">${escapeHtml(a.comentario)}</p>` : ''}
        <p class="avaliacao-nome">${a.nome ? escapeHtml(formatarNome(a.nome)) : 'Anônimo'}</p>
      </div>
    `).join('');
  }

  let avaliacaoNota = 0;
  function renderEstrelaPicker(){
    const p = document.getElementById('estrelaPicker');
    p.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'estrela-btn' + (i <= avaliacaoNota ? ' ativa' : '');
      b.textContent = '\u2605';
      b.setAttribute('aria-label', i + (i > 1 ? ' estrelas' : ' estrela'));
      b.onclick = () => { avaliacaoNota = i; renderEstrelaPicker(); };
      p.appendChild(b);
    }
  }
  function openAvaliacao(){
    avaliacaoNota = 0;
    document.getElementById('avaliacaoNome').value = '';
    document.getElementById('avaliacaoComentario').value = '';
    document.getElementById('avaliacaoError').textContent = '';
    renderEstrelaPicker();
    document.getElementById('avaliacaoOverlay').classList.add('open');
  }
  function closeAvaliacao(){
    document.getElementById('avaliacaoOverlay').classList.remove('open');
  }
  async function enviarAvaliacao(){
    const err = document.getElementById('avaliacaoError');
    err.textContent = '';
    if (avaliacaoNota < 1) { err.textContent = 'Escolha de 1 a 5 estrelas.'; return; }
    const nome = document.getElementById('avaliacaoNome').value.trim().slice(0, 60);
    const comentario = document.getElementById('avaliacaoComentario').value.trim().slice(0, 500);
    if (!nome) { err.textContent = 'Escreva seu nome.'; return; }
    const { error } = await supabaseClient.from('avaliacoes').insert({ nome, nota: avaliacaoNota, comentario });
    if (error) { err.textContent = 'Não foi possível enviar agora. Tente de novo em instantes.'; return; }
    closeAvaliacao();
    mostrarAviso('Obrigado pela avaliação! Ela aparece no site após uma revisão rápida.', 'sucesso');
  }

  function toggleFaq(btn){
    const item = btn.closest('.faq-item');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
    if(!wasOpen){ item.classList.add('open'); }
  }
