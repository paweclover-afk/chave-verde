// Script da página painel.html
// Depende de js/comum.js (supabaseClient, escapeHtml, formatEuro, getFotosArray,
// formatDisponibilidade, isDestacado, togglePw). CSS em css/painel.css.

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
  }

  let feedbackLoaded = false;

  function switchPanelTab(tab){
    const isAnuncios = tab === 'anuncios';
    document.getElementById('panelTabAnuncios').classList.toggle('active', isAnuncios);
    document.getElementById('panelTabSugestoes').classList.toggle('active', !isAnuncios);
    document.getElementById('panelAnuncios').style.display = isAnuncios ? 'block' : 'none';
    document.getElementById('panelSugestoes').style.display = isAnuncios ? 'none' : 'block';
    if (!isAnuncios && !feedbackLoaded) loadMyFeedback();
  }

  async function handleEnviarFeedback(event){
    event.preventDefault();
    const errorEl = document.getElementById('feedbackError');
    const successEl = document.getElementById('feedbackSuccess');
    errorEl.textContent = '';
    successEl.textContent = '';
    const mensagem = document.getElementById('feedbackMensagem').value.trim();
    if (!mensagem) return false;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { errorEl.textContent = 'Sessão expirada, entre novamente.'; return false; }

    const { error } = await supabaseClient.from('feedback_mensagens').insert({ user_id: user.id, mensagem });
    if (error) {
      errorEl.textContent = 'Não foi possível enviar: ' + error.message;
      return false;
    }
    successEl.textContent = 'Sugestão enviada! Obrigado pelo feedback.';
    document.getElementById('feedbackForm').reset();
    feedbackLoaded = false;
    loadMyFeedback();
    return false;
  }

  async function loadMyFeedback(){
    const statusEl = document.getElementById('myFeedbackStatus');
    const listEl = document.getElementById('myFeedbackList');
    const { data, error } = await supabaseClient
      .from('feedback_mensagens')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) {
      statusEl.textContent = 'Não foi possível carregar suas mensagens.';
      return;
    }
    feedbackLoaded = true;
    if (!data || data.length === 0) {
      statusEl.textContent = 'Você ainda não enviou nenhuma sugestão.';
      listEl.innerHTML = '';
      return;
    }
    statusEl.textContent = '';
    listEl.innerHTML = data.map(m => `
      <div class="card">
        <p style="font-size:0.85rem; color:#5C5C50;">${new Date(m.criado_em).toLocaleDateString('pt-BR')}${m.lida ? ' · lida pela equipe' : ''}</p>
        <p style="margin-top:6px; white-space:pre-wrap;">${escapeHtml(m.mensagem)}</p>
      </div>
    `).join('');
  }

  async function handleLogin(event){
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = 'Email ou senha incorretos. Se não lembra a senha, use "Esqueceu sua senha?" acima.';
      return false;
    }
    await refreshAuthState();
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
    await refreshAuthState();
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
    window.location.href = 'index.html';
  }

  async function refreshAuthState(){
    const { data: { session } } = await supabaseClient.auth.getSession();
    const logoutBtn = document.getElementById('logoutBtn');
    const adminLink = document.getElementById('adminLink');
    if (session) {
      document.getElementById('authGate').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      logoutBtn.style.display = 'inline-flex';
      prefillWhatsappDoCadastro(session.user);
      loadMyListings();
      checkPaymentReturn();
      const { data: adminRow } = await supabaseClient
        .from('admins')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      adminLink.style.display = adminRow ? 'inline-flex' : 'none';
    } else {
      document.getElementById('authGate').style.display = 'block';
      document.getElementById('dashboard').style.display = 'none';
      logoutBtn.style.display = 'none';
      adminLink.style.display = 'none';
      switchTab('login');
    }
  }

  // ======= PUBLICAR E GERENCIAR ANÚNCIOS =======
  const FOTOS_BUCKET = 'fotos-quartos';

  async function uploadFotos(files, userId){
    const urls = [];
    for (const original of files) {
      const file = await comprimirImagem(original);
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      const { error: upErr } = await supabaseClient.storage.from(FOTOS_BUCKET).upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabaseClient.storage.from(FOTOS_BUCKET).getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  function toggleDistritoField(prefix){
    const cidade = document.getElementById(prefix + '_cidade').value;
    const isDublin = cidade === 'Dublin';
    const dublinWrap = document.getElementById(prefix + '_distrito_dublin_wrap');
    const outroWrap = document.getElementById(prefix + '_distrito_outro_wrap');
    const dublinSelect = document.getElementById(prefix + '_distrito_dublin');
    const outroInput = document.getElementById(prefix + '_distrito_outro');

    dublinWrap.style.display = isDublin ? 'block' : 'none';
    outroWrap.style.display = isDublin ? 'none' : 'flex';
    if (isDublin) {
      dublinSelect.setAttribute('required', 'required');
      outroInput.removeAttribute('required');
      outroInput.value = '';
    } else {
      outroInput.setAttribute('required', 'required');
      dublinSelect.removeAttribute('required');
      dublinSelect.value = '';
    }
  }

  function toggleTempoCombinar(prefix){
    const combinar = document.getElementById(prefix + '_tempo_combinar').checked;
    const wrap = document.getElementById(prefix + '_disponivel_ate_wrap');
    const input = document.getElementById(prefix + '_disponivel_ate');
    wrap.style.display = combinar ? 'none' : 'flex';
    if (combinar) input.value = '';
  }

  function toggleLancamentoFuturo(prefix){
    const futuro = document.getElementById(prefix + '_lancamento_futuro').checked;
    document.getElementById(prefix + '_futuro_wrap').style.display = futuro ? 'block' : 'none';
    const card = document.getElementById(prefix + '_futuro_card');
    if (card) card.classList.toggle('ativo', futuro);
    if (!futuro) {
      document.getElementById(prefix + '_disponivel_de').value = '';
      document.getElementById(prefix + '_disponivel_ate').value = '';
      document.getElementById(prefix + '_tempo_combinar').checked = false;
    }
  }

  function getDistritoValue(prefix){
    const cidade = document.getElementById(prefix + '_cidade').value;
    return cidade === 'Dublin'
      ? document.getElementById(prefix + '_distrito_dublin').value
      : document.getElementById(prefix + '_distrito_outro').value;
  }

  function setDistritoValue(prefix, cidade, distrito){
    if (cidade === 'Dublin') {
      document.getElementById(prefix + '_distrito_dublin').value = distrito || '';
    } else {
      document.getElementById(prefix + '_distrito_outro').value = distrito || '';
    }
  }

  // ======= WHATSAPP: limpeza, validação e prévia do número =======
  const WHATSAPP_PAISES = {
    '+353': { min: 9,  max: 9,  inicio: /^8/,     exemplo: '85 123 4567',   grupos: [2, 3, 4], dica: 'na Irlanda o celular tem 9 dígitos e começa com 8, ex: 85 123 4567' },
    '+55':  { min: 10, max: 11, inicio: /^[1-9]/, exemplo: '31 99999 8888', grupos: [2, 5, 4], dica: 'no Brasil é DDD + número (10 ou 11 dígitos), ex: 31 99999 8888' },
    '+351': { min: 9,  max: 9,  inicio: /^9/,     exemplo: '912 345 678',   grupos: [3, 3, 3], dica: 'em Portugal o celular tem 9 dígitos e começa com 9, ex: 912 345 678' },
    '+44':  { min: 10, max: 10, inicio: /^7/,     exemplo: '7400 123456',   grupos: [4, 6],    dica: 'no Reino Unido o celular tem 10 dígitos e começa com 7, ex: 7400 123456' }
  };

  // Tira espaços/traços, o 0 da frente e o código do país repetido (quando a pessoa cola o número inteiro)
  function limparNumeroWhatsapp(pais, valor){
    let digits = String(valor || '').replace(/\D/g, '');
    if (!pais) return digits.replace(/^00/, '');
    const code = pais.slice(1);
    if (digits.startsWith('00' + code)) digits = digits.slice(2 + code.length);
    else if (digits.startsWith(code) && digits.length > WHATSAPP_PAISES[pais].max) digits = digits.slice(code.length);
    return digits.replace(/^0+/, '');
  }

  function validarWhatsapp(pais, digits){
    if (!digits) return 'Digite seu número de WhatsApp.';
    if (!pais) {
      return digits.length >= 8 && digits.length <= 15 ? '' : 'Confere o número: digite o número completo com o código do país, ex: 1 555 123 4567.';
    }
    const cfg = WHATSAPP_PAISES[pais];
    const ok = digits.length >= cfg.min && digits.length <= cfg.max && cfg.inicio.test(digits);
    return ok ? '' : 'Confere o número: ' + cfg.dica + '.';
  }

  function formatarWhatsapp(pais, digits){
    const cfg = WHATSAPP_PAISES[pais];
    if (!cfg) return '+' + digits;
    const grupos = pais === '+55' && digits.length === 10 ? [2, 4, 4] : cfg.grupos;
    const partes = [];
    let i = 0;
    for (const g of grupos) {
      if (i >= digits.length) break;
      partes.push(digits.slice(i, i + g));
      i += g;
    }
    if (i < digits.length) partes.push(digits.slice(i));
    return pais + ' ' + partes.join(' ');
  }

  // Mostra embaixo do campo o número final + link pra testar. Erro só aparece ao sair do campo ou ao publicar.
  function updateWhatsappPreview(prefix, mostrarErro){
    const pais = document.getElementById(prefix + '_whatsapp_pais').value;
    const input = document.getElementById(prefix + '_whatsapp_numero');
    const el = document.getElementById(prefix + '_whatsapp_preview');
    const cfg = WHATSAPP_PAISES[pais];
    input.placeholder = 'Ex: ' + (cfg ? cfg.exemplo : '1 555 123 4567');
    const digits = limparNumeroWhatsapp(pais, input.value);
    const erro = validarWhatsapp(pais, digits);
    el.className = 'wa-preview';
    el.textContent = '';
    if (!digits) {
      el.textContent = cfg ? 'Pode digitar do seu jeito, com ou sem o 0 na frente.' : 'Digite o número completo, com o código do país.';
    } else if (erro) {
      if (mostrarErro) {
        el.classList.add('wa-preview-erro');
        el.textContent = erro;
      } else {
        el.textContent = 'Número: ' + formatarWhatsapp(pais, digits);
      }
    } else {
      const numero = document.createElement('strong');
      numero.textContent = formatarWhatsapp(pais, digits);
      const teste = document.createElement('a');
      teste.href = 'https://wa.me/' + (pais ? pais.slice(1) : '') + digits;
      teste.target = '_blank';
      teste.rel = 'noopener';
      teste.textContent = 'Testar no WhatsApp';
      el.append('Os interessados vão te chamar em: ', numero, ' · ', teste);
    }
    return erro;
  }

  // Ao sair do campo: deixa só os dígitos já corrigidos e avisa se estiver errado
  function normalizeWhatsappInput(prefix){
    const pais = document.getElementById(prefix + '_whatsapp_pais').value;
    const input = document.getElementById(prefix + '_whatsapp_numero');
    const digits = limparNumeroWhatsapp(pais, input.value);
    if (digits) input.value = digits;
    return updateWhatsappPreview(prefix, true);
  }

  function getWhatsappValue(prefix){
    const pais = document.getElementById(prefix + '_whatsapp_pais').value;
    const digits = limparNumeroWhatsapp(pais, document.getElementById(prefix + '_whatsapp_numero').value);
    return (pais || '+') + digits;
  }

  function setWhatsappValue(prefix, whatsapp){
    const digits = (whatsapp || '').replace(/\D/g, '');
    const matched = Object.keys(WHATSAPP_PAISES).find(p => digits.startsWith(p.slice(1)));
    const paisSelect = document.getElementById(prefix + '_whatsapp_pais');
    const numeroInput = document.getElementById(prefix + '_whatsapp_numero');
    if (matched) {
      paisSelect.value = matched;
      numeroInput.value = digits.slice(matched.length - 1);
    } else {
      paisSelect.value = '';
      numeroInput.value = digits;
    }
    updateWhatsappPreview(prefix, false);
  }

  // Preenche o WhatsApp do novo anúncio com o número informado no cadastro (só se o campo estiver vazio)
  function prefillWhatsappDoCadastro(user){
    const input = document.getElementById('f_whatsapp_numero');
    const doCadastro = user?.user_metadata?.whatsapp;
    if (!doCadastro || input.value.trim()) return;
    const digits = String(doCadastro).replace(/\D/g, '');
    const comCodigo = Object.keys(WHATSAPP_PAISES).find(p => digits.startsWith(p.slice(1)) && digits.length > WHATSAPP_PAISES[p].max);
    if (comCodigo) {
      document.getElementById('f_whatsapp_pais').value = comCodigo;
      input.value = digits.slice(comCodigo.length - 1);
    } else {
      input.value = limparNumeroWhatsapp(document.getElementById('f_whatsapp_pais').value, digits);
    }
    updateWhatsappPreview('f', false);
  }

  // ======= TÍTULO SUGERIDO (só o tipo — o bairro já aparece em cima do título no anúncio) =======
  const TITULO_MAX = 60; // igual ao maxlength do campo no HTML

  function atualizarContadorTitulo(prefix){
    const input = document.getElementById(prefix + '_titulo');
    const contador = document.getElementById(prefix + '_titulo_contador');
    if (!contador) return;
    const n = input.value.length;
    contador.textContent = n + '/' + TITULO_MAX;
    contador.classList.toggle('perto', n >= TITULO_MAX - 10);
  }

  // Só preenche se o título estiver vazio ou ainda for a nossa sugestão (nunca apaga o que a pessoa escreveu)
  function sugerirTitulo(prefix){
    const input = document.getElementById(prefix + '_titulo');
    const tipo = document.getElementById(prefix + '_tipo_quarto').value;
    const atual = input.value.trim();
    if (!tipo || (atual && atual !== input.dataset.sugerido)) return;
    const sugestao = tipoImovelLabel(tipo).slice(0, TITULO_MAX);
    input.value = sugestao;
    input.dataset.sugerido = sugestao;
    atualizarContadorTitulo(prefix);
  }

  ['f', 'el'].forEach(prefix => {
    document.getElementById(prefix + '_tipo_quarto').addEventListener('change', () => sugerirTitulo(prefix));
    document.getElementById(prefix + '_titulo').addEventListener('input', () => atualizarContadorTitulo(prefix));
    atualizarContadorTitulo(prefix);
  });

  toggleDistritoField('f');
  updateWhatsappPreview('f', false);

  async function handleNovoAnuncio(event){
    event.preventDefault();
    const errorEl = document.getElementById('novoAnuncioError');
    errorEl.textContent = '';

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      errorEl.textContent = 'Sessão expirada, entre novamente.';
      return false;
    }

    if (document.getElementById('f_lancamento_futuro').checked && !document.getElementById('f_disponivel_de').value) {
      errorEl.textContent = 'Você marcou como lançamento futuro — informe a data em que o imóvel ficará disponível.';
      return false;
    }

    // confere o WhatsApp antes de enviar fotos, pra não subir foto à toa
    const erroWhatsapp = normalizeWhatsappInput('f');
    if (erroWhatsapp) {
      errorEl.textContent = erroWhatsapp;
      document.getElementById('f_whatsapp_numero').focus();
      return false;
    }

    const fileInput = document.getElementById('f_fotos');
    const allFiles = Array.from(fileInput.files || []);
    if (allFiles.length > 10) {
      errorEl.textContent = 'Você selecionou ' + allFiles.length + ' fotos, mas o limite grátis é de 10. Publique com até 10 fotos agora — depois você pode desbloquear até 20 fotos por €5.';
      return false;
    }
    let fotosUrls = [];
    if (allFiles.length > 0) {
      errorEl.textContent = 'Enviando fotos...';
      try {
        fotosUrls = await uploadFotos(allFiles, user.id);
      } catch (err) {
        errorEl.textContent = 'Erro ao enviar fotos: ' + err.message;
        return false;
      }
      errorEl.textContent = '';
    }

    const payload = {
      user_id: user.id,
      nome: formatarNome(user.user_metadata?.nome || ''),
      whatsapp: getWhatsappValue('f'),
      cidade: document.getElementById('f_cidade').value,
      distrito: getDistritoValue('f'),
      titulo: formatarTitulo(document.getElementById('f_titulo').value),
      tipo_quarto: document.getElementById('f_tipo_quarto').value,
      valor: parseFloat(document.getElementById('f_valor').value) || 0,
      eircode: formatarEircode(document.getElementById('f_eircode').value),
      genero: document.getElementById('f_genero').value,
      aceita_sem_pps: document.getElementById('f_aceita_sem_pps').checked,
      disponivel_de: document.getElementById('f_lancamento_futuro').checked ? (document.getElementById('f_disponivel_de').value || null) : null,
      disponivel_ate: document.getElementById('f_lancamento_futuro').checked && !document.getElementById('f_tempo_combinar').checked ? (document.getElementById('f_disponivel_ate').value || null) : null,
      fotos_url: fotosUrls.join('\n'),
      descricao: document.getElementById('f_descricao').value,
      status: 'Pendente'
    };

    const { error } = await supabaseClient.from('quartos').insert([payload]);
    if (error) {
      errorEl.textContent = 'Erro ao publicar: ' + error.message;
      return false;
    }
    document.getElementById('novoAnuncioForm').reset();
    toggleDistritoField('f');
    toggleLancamentoFuturo('f');
    updateWhatsappPreview('f', false);
    atualizarContadorTitulo('f');
    prefillWhatsappDoCadastro(user);
    loadMyListings();
    return false;
  }

  function renderMyListing(item){
    const statusLabel = {
      'Ativo': 'Ativo',
      'Pausado': 'Pausado',
      'Alugado': 'Alugado',
      'Pendente': 'Aguardando revisão (nossa equipe revisa manualmente, um por um)'
    }[item.status] || item.status;

    const fotosCount = getFotosArray(item).length;
    const limiteFotos = item.fotos_extra_pagas ? 20 : 10;
    const fotosBtn = `<button class="btn btn-ghost btn-small" onclick="openEditFotos(${item.id})">Editar fotos (${fotosCount}/${limiteFotos})</button>`;
    const desbloquearFotosBtn = item.fotos_extra_pagas
      ? ''
      : `<button class="btn btn-sun btn-small" onclick="startExtraFotosCheckout(${item.id})">Desbloquear +10 fotos (€5)</button>`;

    const destacado = isDestacado(item);
    const destaqueLabel = destacado ? 'Renovar destaque' : 'Destacar';
    const destaqueBtn = `<button class="btn btn-sun btn-small" onclick="startDestaqueCheckout(${item.id})">${destaqueLabel} (€15/2 sem)</button>`;
    const destaqueInfo = destacado
      ? ` · <strong style="color:#C1502E;">★ Destaque até ${new Date(item.destaque_ate).toLocaleDateString('pt-BR')}</strong>`
      : '';

    return `
      <div class="card">
        <div class="listing-card">
          <div>
            <p style="font-weight:600; color:var(--pine-dark);">${escapeHtml(item.titulo)}</p>
            <p class="listing-status">${escapeHtml(item.cidade)}${item.distrito ? ' ' + escapeHtml(item.distrito) : ''} · €${formatEuro(item.valor)}/mês · <strong>${statusLabel}</strong>${destaqueInfo}</p>
            ${formatDisponibilidade(item) ? `<p class="listing-status">${formatDisponibilidade(item)}</p>` : ''}
            <p class="listing-status">📲 ${item.whatsapp_cliques || 0} clique${(item.whatsapp_cliques || 0) === 1 ? '' : 's'} no WhatsApp</p>
          </div>
        </div>
        <div class="listing-actions">
          ${item.status !== 'Pausado' ? `<button class="btn btn-ghost btn-small" onclick="setListingStatus(${item.id}, 'Pausado')">Pausar</button>` : ''}
          ${item.status === 'Pausado' ? `<button class="btn btn-ghost btn-small" onclick="setListingStatus(${item.id}, 'Ativo')">Reativar</button>` : ''}
          ${item.status !== 'Alugado' ? `<button class="btn btn-ghost btn-small" onclick="setListingStatus(${item.id}, 'Alugado')">Marcar como alugado</button>` : ''}
          <button class="btn btn-ghost btn-small" onclick="openEditListing(${item.id})">Editar</button>
          ${fotosBtn}
          ${desbloquearFotosBtn}
          ${destaqueBtn}
          <button class="btn btn-ghost btn-small btn-danger" onclick="deleteListing(${item.id})">Apagar</button>
        </div>
      </div>
    `;
  }

  async function startCheckout(anuncioId, tipo){
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ anuncio_id: anuncioId, tipo })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        mostrarAviso('Não foi possível iniciar o pagamento: ' + (data.error || ''), 'erro');
      }
    } catch (err) {
      mostrarAviso('Erro ao iniciar pagamento: ' + err.message, 'erro');
    }
  }

  async function startExtraFotosCheckout(anuncioId){
    return startCheckout(anuncioId, 'fotos');
  }

  async function startDestaqueCheckout(anuncioId){
    return startCheckout(anuncioId, 'destaque');
  }

  // ======= EDITAR FOTOS (apagar, reordenar, adicionar) =======
  let editingListingId = null;
  let editingFotos = [];
  let editingFotosExtraPagas = false;

  async function openEditFotos(id){
    const { data, error } = await supabaseClient.from('quartos').select('fotos_url, fotos_extra_pagas').eq('id', id).single();
    if (error || !data) { mostrarAviso('Não foi possível carregar as fotos desse anúncio.', 'erro'); return; }
    editingListingId = id;
    editingFotos = getFotosArray(data);
    editingFotosExtraPagas = !!data.fotos_extra_pagas;
    document.getElementById('editFotosError').textContent = '';
    document.getElementById('editFotosInput').value = '';
    renderEditFotosGrid();
    document.getElementById('editFotosOverlay').classList.add('open');
  }

  function closeEditFotos(){
    document.getElementById('editFotosOverlay').classList.remove('open');
    editingListingId = null;
    loadMyListings();
  }

  function renderEditFotosGrid(){
    const grid = document.getElementById('editFotosGrid');
    const emptyEl = document.getElementById('editFotosEmpty');
    const limite = editingFotosExtraPagas ? 20 : 10;
    emptyEl.style.display = editingFotos.length === 0 ? 'block' : 'none';

    grid.innerHTML = editingFotos.map((url, i) => `
      <div class="edit-fotos-item">
        ${i === 0 ? '<span class="edit-fotos-cover-badge">Capa</span>' : ''}
        <img src="${escapeHtml(url)}" alt="" loading="lazy">
        <div class="edit-fotos-actions">
          <button type="button" onclick="moveFoto(${i}, -1)" ${i === 0 ? 'disabled' : ''} aria-label="Trazer pra frente" title="Trazer pra frente">&#8249;</button>
          <button type="button" class="edit-fotos-remove" onclick="removeFoto(${i})" aria-label="Apagar foto" title="Apagar foto">&#128465;</button>
          <button type="button" onclick="moveFoto(${i}, 1)" ${i === editingFotos.length - 1 ? 'disabled' : ''} aria-label="Mandar pra trás" title="Mandar pra trás">&#8250;</button>
        </div>
      </div>
    `).join('');

    const addLabel = document.getElementById('editFotosAddLabel');
    const unlockBtn = document.getElementById('editFotosUnlockBtn');
    if (editingFotos.length >= limite) {
      addLabel.style.display = 'none';
      unlockBtn.style.display = editingFotosExtraPagas ? 'none' : 'inline-flex';
    } else {
      addLabel.style.display = 'inline-flex';
      unlockBtn.style.display = 'none';
    }
  }

  async function persistEditingFotos(resetStatus){
    const payload = { fotos_url: editingFotos.join('\n') };
    if (resetStatus) payload.status = 'Pendente';
    const { error } = await supabaseClient.from('quartos').update(payload).eq('id', editingListingId);
    if (error) { document.getElementById('editFotosError').textContent = 'Não foi possível salvar: ' + error.message; return false; }
    return true;
  }

  async function moveFoto(index, delta){
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= editingFotos.length) return;
    const [item] = editingFotos.splice(index, 1);
    editingFotos.splice(newIndex, 0, item);
    renderEditFotosGrid();
    await persistEditingFotos(false);
  }

  async function removeFoto(index){
    const ok = await confirmarAcao({ titulo: 'Apagar foto?', mensagem: 'Essa foto será removida do anúncio.', textoConfirmar: 'Apagar', textoCancelar: 'Cancelar', perigo: true });
    if (!ok) return;
    editingFotos.splice(index, 1);
    renderEditFotosGrid();
    await persistEditingFotos(false);
  }

  async function addFotosToEdit(fileList){
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const errorEl = document.getElementById('editFotosError');
    errorEl.textContent = '';

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { errorEl.textContent = 'Sessão expirada, entre novamente.'; return; }

    const limite = editingFotosExtraPagas ? 20 : 10;
    const espacoLivre = limite - editingFotos.length;
    if (espacoLivre <= 0) return;

    const aUsar = files.slice(0, espacoLivre);
    if (files.length > aUsar.length) {
      errorEl.textContent = `Só cabem mais ${aUsar.length} foto(s) nesse anúncio agora — o resto não foi enviado.`;
    }
    try {
      const novasUrls = await uploadFotos(aUsar, user.id);
      editingFotos = editingFotos.concat(novasUrls);
      renderEditFotosGrid();
      await persistEditingFotos(true);
    } catch (err) {
      errorEl.textContent = 'Erro ao enviar fotos: ' + err.message;
    }
    document.getElementById('editFotosInput').value = '';
  }

  let pagamentoVerificado = false;
  async function checkPaymentReturn(){
    if (pagamentoVerificado) return;
    const params = new URLSearchParams(window.location.search);
    const anuncioPago = params.get('anuncio_pago');
    const sessionId = params.get('session_id');
    if (!anuncioPago || !sessionId) return;
    pagamentoVerificado = true;
    // limpa a URL já aqui (antes do await) pra uma 2ª chamada não reprocessar e duplicar o aviso
    history.replaceState({}, '', window.location.pathname);
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ session_id: sessionId, anuncio_id: anuncioPago })
      });
      const data = await res.json();
      if (data.ok) {
        if (data.tipo === 'destaque') {
          mostrarAviso('Destaque ativado! Seu anúncio vai aparecer no topo da lista da sua cidade por 2 semanas.', 'sucesso');
        } else {
          mostrarAviso('Pagamento confirmado! Agora você pode adicionar até 20 fotos nesse anúncio.', 'sucesso');
        }
      } else {
        mostrarAviso('Não foi possível confirmar o pagamento: ' + (data.error || ''), 'erro');
      }
    } catch (err) {
      mostrarAviso('Erro ao confirmar pagamento: ' + err.message, 'erro');
    }
    loadMyListings();
  }

  let myListingsCache = [];

  async function loadMyListings(){
    const statusEl = document.getElementById('myListingsStatus');
    const listEl = document.getElementById('myListingsList');
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data, error } = await supabaseClient
      .from('quartos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      statusEl.textContent = 'Não foi possível carregar seus anúncios.';
      return;
    }
    myListingsCache = data || [];
    if (myListingsCache.length === 0) {
      statusEl.textContent = 'Você ainda não publicou nenhum anúncio.';
      listEl.innerHTML = '';
      return;
    }
    statusEl.textContent = '';
    listEl.innerHTML = myListingsCache.map(renderMyListing).join('');
  }

  async function setListingStatus(id, novoStatus){
    const { error } = await supabaseClient.from('quartos').update({ status: novoStatus }).eq('id', id);
    if (!error) { loadMyListings(); }
  }

  // ======= EDITAR ANÚNCIO (título, cidade, preço, descrição etc.) =======
  let editingListingRecordId = null;

  function openEditListing(id){
    const item = myListingsCache.find(a => a.id === id);
    if (!item) return;
    editingListingRecordId = id;
    document.getElementById('el_titulo').value = item.titulo || '';
    document.getElementById('el_titulo').dataset.sugerido = '';
    atualizarContadorTitulo('el');
    document.getElementById('el_cidade').value = item.cidade || 'Dublin';
    toggleDistritoField('el');
    setDistritoValue('el', item.cidade || 'Dublin', item.distrito);
    document.getElementById('el_eircode').value = item.eircode || '';
    document.getElementById('el_tipo_quarto').value = item.tipo_quarto || 'Individual';
    document.getElementById('el_valor').value = item.valor || 0;
    document.getElementById('el_genero').value = item.genero || '';
    document.getElementById('el_aceita_sem_pps').checked = !!item.aceita_sem_pps;
    document.getElementById('el_lancamento_futuro').checked = !!item.disponivel_de;
    document.getElementById('el_disponivel_de').value = item.disponivel_de || '';
    document.getElementById('el_disponivel_ate').value = item.disponivel_ate || '';
    document.getElementById('el_tempo_combinar').checked = !item.disponivel_ate && !!item.disponivel_de;
    toggleLancamentoFuturo('el');
    toggleTempoCombinar('el');
    document.getElementById('el_descricao').value = item.descricao || '';
    setWhatsappValue('el', item.whatsapp);
    document.getElementById('editListingError').textContent = '';
    document.getElementById('editListingOverlay').classList.add('open');
  }

  function closeEditListing(){
    document.getElementById('editListingOverlay').classList.remove('open');
    editingListingRecordId = null;
  }

  async function saveEditListing(event){
    event.preventDefault();
    const errorEl = document.getElementById('editListingError');
    errorEl.textContent = '';
    const erroWhatsapp = normalizeWhatsappInput('el');
    if (erroWhatsapp) {
      errorEl.textContent = erroWhatsapp;
      document.getElementById('el_whatsapp_numero').focus();
      return false;
    }
    const payload = {
      titulo: formatarTitulo(document.getElementById('el_titulo').value),
      cidade: document.getElementById('el_cidade').value,
      distrito: getDistritoValue('el'),
      eircode: formatarEircode(document.getElementById('el_eircode').value),
      tipo_quarto: document.getElementById('el_tipo_quarto').value,
      valor: parseFloat(document.getElementById('el_valor').value) || 0,
      genero: document.getElementById('el_genero').value,
      aceita_sem_pps: document.getElementById('el_aceita_sem_pps').checked,
      disponivel_de: document.getElementById('el_lancamento_futuro').checked ? (document.getElementById('el_disponivel_de').value || null) : null,
      disponivel_ate: document.getElementById('el_lancamento_futuro').checked && !document.getElementById('el_tempo_combinar').checked ? (document.getElementById('el_disponivel_ate').value || null) : null,
      descricao: document.getElementById('el_descricao').value,
      whatsapp: getWhatsappValue('el')
    };
    const { error } = await supabaseClient.from('quartos').update(payload).eq('id', editingListingRecordId);
    if (error) {
      errorEl.textContent = 'Não foi possível salvar: ' + error.message;
      return false;
    }
    closeEditListing();
    loadMyListings();
    return false;
  }

  async function deleteListing(id){
    const item = myListingsCache.find(a => a.id === id);
    const temFotosPagas = !!(item && item.fotos_extra_pagas);
    const temDestaque = !!(item && isDestacado(item));
    let pergunta;
    if (temFotosPagas && temDestaque) {
      pergunta = 'Este anúncio tem fotos extras pagas E destaque ativo. Se apagar, você perde os dois e não há reembolso.\n\nSe quiser só tirá-lo do ar por um tempo, use o botão "Pausar".';
    } else if (temFotosPagas) {
      pergunta = 'Este anúncio tem fotos extras pagas. Se apagar, você perde esse benefício e não há reembolso.\n\nSe quiser só tirá-lo do ar por um tempo, use o botão "Pausar".';
    } else if (temDestaque) {
      pergunta = 'Este anúncio tem destaque ativo (pago). Se apagar, você perde o destaque e não há reembolso.\n\nSe quiser só tirá-lo do ar por um tempo, use o botão "Pausar".';
    } else {
      pergunta = 'Essa ação não pode ser desfeita.';
    }
    const confirmou = await confirmarAcao({
      titulo: 'Apagar anúncio?',
      mensagem: pergunta,
      textoConfirmar: 'Apagar',
      textoCancelar: 'Cancelar',
      perigo: true
    });
    if (!confirmou) return;
    const { error } = await supabaseClient.from('quartos').delete().eq('id', id);
    if (!error) {
      loadMyListings();
    } else {
      mostrarAviso('Não foi possível apagar o anúncio: ' + error.message, 'erro');
    }
  }

  supabaseClient.auth.onAuthStateChange(() => refreshAuthState());
  refreshAuthState();
