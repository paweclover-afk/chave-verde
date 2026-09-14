// Script da página admin.html
// Depende de js/comum.js (supabaseClient, escapeHtml, formatEuro, getFotosArray,
// formatDisponibilidade, isDestacado, togglePw). CSS em css/admin.css.

  function switchTab(tab){
    const isLogin = tab === 'login';
    document.getElementById('loginForm').style.display = isLogin ? 'flex' : 'none';
    document.getElementById('forgotForm').style.display = isLogin ? 'none' : 'flex';
    document.getElementById('loginError').textContent = '';
    document.getElementById('forgotError').textContent = '';
    document.getElementById('forgotSuccess').textContent = '';
  }

  async function handleLogin(event){
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = 'Email ou senha incorretos.';
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
    successEl.textContent = 'Email enviado! Verifique sua caixa de entrada.';
    return false;
  }

  async function handleLogout(){
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  }

  let isAdmin = false;

  async function refreshAuthState(){
    const { data: { session } } = await supabaseClient.auth.getSession();
    const logoutBtn = document.getElementById('logoutBtn');

    if (!session) {
      document.getElementById('authGate').style.display = 'block';
      document.getElementById('deniedState').style.display = 'none';
      document.getElementById('dashboard').style.display = 'none';
      logoutBtn.style.display = 'none';
      switchTab('login');
      return;
    }

    logoutBtn.style.display = 'inline-flex';

    const { data: adminRow } = await supabaseClient
      .from('admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    isAdmin = !!adminRow;

    if (!isAdmin) {
      document.getElementById('authGate').style.display = 'none';
      document.getElementById('deniedState').style.display = 'block';
      document.getElementById('dashboard').style.display = 'none';
      return;
    }

    document.getElementById('authGate').style.display = 'none';
    document.getElementById('deniedState').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    loadAnuncios();
    loadMensagens();
    loadDenuncias();
  }

  function switchAdminTab(tab){
    document.getElementById('tabAnuncios').classList.toggle('active', tab === 'anuncios');
    document.getElementById('tabUsuarios').classList.toggle('active', tab === 'usuarios');
    document.getElementById('tabAdmins').classList.toggle('active', tab === 'admins');
    document.getElementById('tabMensagens').classList.toggle('active', tab === 'mensagens');
    document.getElementById('tabDenuncias').classList.toggle('active', tab === 'denuncias');
    document.getElementById('panelAnuncios').style.display = tab === 'anuncios' ? 'block' : 'none';
    document.getElementById('panelUsuarios').style.display = tab === 'usuarios' ? 'block' : 'none';
    document.getElementById('panelAdmins').style.display = tab === 'admins' ? 'block' : 'none';
    document.getElementById('panelMensagens').style.display = tab === 'mensagens' ? 'block' : 'none';
    document.getElementById('panelDenuncias').style.display = tab === 'denuncias' ? 'block' : 'none';
    if (tab === 'usuarios') loadUsuarios();
    if (tab === 'admins') loadAdmins();
    if (tab === 'mensagens') loadMensagens();
    if (tab === 'denuncias') loadDenuncias();
  }

  function toggleTempoCombinar(prefix){
    const combinar = document.getElementById(prefix + '_tempo_combinar').checked;
    const wrap = document.getElementById(prefix + '_disponivel_ate_wrap');
    const input = document.getElementById(prefix + '_disponivel_ate');
    wrap.style.display = combinar ? 'none' : 'flex';
    if (combinar) input.value = '';
  }

  // ======= ANÚNCIOS =======
  let allAnuncios = [];
  let statusFilter = 'Pendente';

  function setStatusFilter(status){
    statusFilter = status;
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.toggle('active', b.dataset.status === status));
    renderAnunciosList();
  }

  async function loadAnuncios(){
    const statusEl = document.getElementById('anunciosStatus');
    statusEl.textContent = 'Carregando...';
    const { data, error } = await supabaseClient
      .from('quartos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      statusEl.textContent = 'Não foi possível carregar os anúncios: ' + error.message;
      return;
    }
    allAnuncios = data || [];
    const pendCount = allAnuncios.filter(a => a.status === 'Pendente').length;
    document.getElementById('countPendente').textContent = pendCount ? `(${pendCount})` : '';
    renderAnunciosList();
  }

  function renderAnunciosList(){
    const statusEl = document.getElementById('anunciosStatus');
    const listEl = document.getElementById('anunciosList');
    const search = (document.getElementById('anunciosSearch').value || '').toLowerCase();

    let items = allAnuncios;
    if (statusFilter) items = items.filter(a => a.status === statusFilter);
    if (search) {
      items = items.filter(a =>
        (a.titulo || '').toLowerCase().includes(search) ||
        (a.cidade || '').toLowerCase().includes(search) ||
        (a.distrito || '').toLowerCase().includes(search) ||
        (a.whatsapp || '').toLowerCase().includes(search) ||
        (a.nome || '').toLowerCase().includes(search)
      );
    }

    if (items.length === 0) {
      statusEl.textContent = 'Nenhum anúncio encontrado com esse filtro.';
      listEl.innerHTML = '';
      return;
    }
    statusEl.textContent = '';
    listEl.innerHTML = items.map(renderAnuncioCard).join('');
  }

  function renderAnuncioCard(item){
    const fotosCount = getFotosArray(item).length;
    const criado = item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '';
    return `
      <div class="admin-card">
        <div class="admin-card-top">
          <div>
            <span class="status-badge status-${item.status}">${escapeHtml(item.status)}</span>
            <div class="admin-card-title">${item.titulo ? escapeHtml(item.titulo) : '(sem título)'}</div>
            <div class="admin-card-meta">
              ${escapeHtml(item.cidade)}${item.distrito ? ' ' + escapeHtml(item.distrito) : ''} · €${formatEuro(item.valor)}/mês · ${fotosCount} foto(s)
              ${item.fotos_extra_pagas ? '<span class="fotos-pagas-tag">· fotos extras pagas</span>' : ''}
            </div>
            <div class="admin-card-meta">${item.nome ? escapeHtml(item.nome) : 'sem nome'} · ${item.whatsapp ? escapeHtml(item.whatsapp) : 'sem WhatsApp'} · publicado em ${criado}</div>
            ${formatDisponibilidade(item) ? `<div class="admin-card-meta">${formatDisponibilidade(item)}</div>` : ''}
          </div>
        </div>
        <div class="admin-card-actions">
          ${item.status === 'Pendente' ? `<button class="btn btn-primary btn-small" onclick="quickSetStatus(${item.id}, 'Ativo')">Aprovar</button>` : ''}
          ${item.status !== 'Pausado' ? `<button class="btn btn-ghost btn-small" onclick="quickSetStatus(${item.id}, 'Pausado')">Pausar</button>` : ''}
          ${item.status === 'Pausado' ? `<button class="btn btn-ghost btn-small" onclick="quickSetStatus(${item.id}, 'Ativo')">Reativar</button>` : ''}
          ${item.status !== 'Alugado' ? `<button class="btn btn-ghost btn-small" onclick="quickSetStatus(${item.id}, 'Alugado')">Marcar alugado</button>` : ''}
          <button class="btn btn-ghost btn-small" onclick="openEditListing(${item.id})">Editar</button>
          <button class="btn btn-ghost btn-small" onclick="openEditFotos(${item.id})">Editar fotos</button>
          <button class="btn btn-ghost btn-small btn-danger" onclick="deleteAnuncio(${item.id})">Apagar</button>
        </div>
      </div>
    `;
  }

  async function quickSetStatus(id, status){
    const { error } = await supabaseClient.from('quartos').update({ status }).eq('id', id);
    if (error) { alert('Não foi possível atualizar: ' + error.message); return; }
    loadAnuncios();
  }

  async function deleteAnuncio(id){
    if (!confirm('Apagar esse anúncio permanentemente?')) return;
    const { error } = await supabaseClient.from('quartos').delete().eq('id', id);
    if (error) { alert('Não foi possível apagar: ' + error.message); return; }
    loadAnuncios();
  }

  // ======= EDITAR ANÚNCIO =======
  let editingListingRecordId = null;

  function toggleDistritoField(prefix){
    const cidade = document.getElementById(prefix + '_cidade').value;
    const isDublin = cidade === 'Dublin';
    document.getElementById(prefix + '_distrito_dublin_wrap').style.display = isDublin ? 'flex' : 'none';
    document.getElementById(prefix + '_distrito_outro_wrap').style.display = isDublin ? 'none' : 'flex';
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

  function openEditListing(id){
    const item = allAnuncios.find(a => a.id === id);
    if (!item) return;
    editingListingRecordId = id;
    document.getElementById('el_titulo').value = item.titulo || '';
    document.getElementById('el_cidade').value = item.cidade || 'Dublin';
    toggleDistritoField('el');
    setDistritoValue('el', item.cidade || 'Dublin', item.distrito);
    document.getElementById('el_eircode').value = item.eircode || '';
    document.getElementById('el_tipo_quarto').value = item.tipo_quarto || 'Individual';
    document.getElementById('el_valor').value = item.valor || 0;
    document.getElementById('el_genero').value = item.genero || '';
    document.getElementById('el_status').value = item.status || 'Pendente';
    document.getElementById('el_aceita_sem_pps').checked = !!item.aceita_sem_pps;
    document.getElementById('el_fotos_extra_pagas').checked = !!item.fotos_extra_pagas;
    document.getElementById('el_disponivel_de').value = item.disponivel_de || '';
    document.getElementById('el_disponivel_ate').value = item.disponivel_ate || '';
    document.getElementById('el_tempo_combinar').checked = !item.disponivel_ate && !!item.disponivel_de;
    toggleTempoCombinar('el');
    document.getElementById('el_nome').value = item.nome || '';
    document.getElementById('el_whatsapp').value = item.whatsapp || '';
    document.getElementById('el_descricao').value = item.descricao || '';
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
    const payload = {
      titulo: document.getElementById('el_titulo').value,
      cidade: document.getElementById('el_cidade').value,
      distrito: getDistritoValue('el'),
      eircode: document.getElementById('el_eircode').value,
      tipo_quarto: document.getElementById('el_tipo_quarto').value,
      valor: parseFloat(document.getElementById('el_valor').value) || 0,
      genero: document.getElementById('el_genero').value,
      status: document.getElementById('el_status').value,
      aceita_sem_pps: document.getElementById('el_aceita_sem_pps').checked,
      fotos_extra_pagas: document.getElementById('el_fotos_extra_pagas').checked,
      disponivel_de: document.getElementById('el_disponivel_de').value || null,
      disponivel_ate: document.getElementById('el_tempo_combinar').checked ? null : (document.getElementById('el_disponivel_ate').value || null),
      nome: document.getElementById('el_nome').value,
      whatsapp: document.getElementById('el_whatsapp').value,
      descricao: document.getElementById('el_descricao').value
    };
    const { error } = await supabaseClient.from('quartos').update(payload).eq('id', editingListingRecordId);
    if (error) {
      errorEl.textContent = 'Não foi possível salvar: ' + error.message;
      return false;
    }
    closeEditListing();
    loadAnuncios();
    return false;
  }

  // ======= EDITAR FOTOS =======
  const FOTOS_BUCKET = 'fotos-quartos';
  let editingListingId = null;
  let editingFotos = [];

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

  function openEditFotos(id){
    const item = allAnuncios.find(a => a.id === id);
    if (!item) return;
    editingListingId = id;
    editingFotos = getFotosArray(item);
    document.getElementById('editFotosError').textContent = '';
    document.getElementById('editFotosInput').value = '';
    renderEditFotosGrid();
    document.getElementById('editFotosOverlay').classList.add('open');
  }

  function closeEditFotos(){
    document.getElementById('editFotosOverlay').classList.remove('open');
    editingListingId = null;
    loadAnuncios();
  }

  function renderEditFotosGrid(){
    const grid = document.getElementById('editFotosGrid');
    const emptyEl = document.getElementById('editFotosEmpty');
    emptyEl.style.display = editingFotos.length === 0 ? 'block' : 'none';
    grid.innerHTML = editingFotos.map((url, i) => `
      <div class="edit-fotos-item">
        ${i === 0 ? '<span class="edit-fotos-cover-badge">Capa</span>' : ''}
        <img src="${escapeHtml(url)}" alt="" loading="lazy">
        <div class="edit-fotos-actions">
          <button type="button" onclick="moveFoto(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Trazer pra frente">&#8249;</button>
          <button type="button" class="edit-fotos-remove" onclick="removeFoto(${i})" title="Apagar foto">&#128465;</button>
          <button type="button" onclick="moveFoto(${i}, 1)" ${i === editingFotos.length - 1 ? 'disabled' : ''} title="Mandar pra trás">&#8250;</button>
        </div>
      </div>
    `).join('');
  }

  async function persistEditingFotos(){
    const { error } = await supabaseClient.from('quartos').update({ fotos_url: editingFotos.join('\n') }).eq('id', editingListingId);
    if (error) { document.getElementById('editFotosError').textContent = 'Não foi possível salvar: ' + error.message; return false; }
    return true;
  }

  async function moveFoto(index, delta){
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= editingFotos.length) return;
    const [item] = editingFotos.splice(index, 1);
    editingFotos.splice(newIndex, 0, item);
    renderEditFotosGrid();
    await persistEditingFotos();
  }

  async function removeFoto(index){
    if (!confirm('Apagar essa foto?')) return;
    editingFotos.splice(index, 1);
    renderEditFotosGrid();
    await persistEditingFotos();
  }

  async function addFotosToEdit(fileList){
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const errorEl = document.getElementById('editFotosError');
    errorEl.textContent = '';
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { errorEl.textContent = 'Sessão expirada, entre novamente.'; return; }
    try {
      const novasUrls = await uploadFotos(files, user.id);
      editingFotos = editingFotos.concat(novasUrls);
      renderEditFotosGrid();
      await persistEditingFotos();
    } catch (err) {
      errorEl.textContent = 'Erro ao enviar fotos: ' + err.message;
    }
    document.getElementById('editFotosInput').value = '';
  }

  // ======= USUÁRIOS =======
  let allUsuarios = [];
  let usuariosLoaded = false;
  let verificadosSet = new Set();

  async function loadVerificados(){
    const { data, error } = await supabaseClient.from('verificados').select('user_id');
    if (!error && data) verificadosSet = new Set(data.map(v => v.user_id));
  }

  async function loadUsuarios(){
    const statusEl = document.getElementById('usuariosStatus');
    statusEl.textContent = 'Carregando...';
    document.getElementById('usuariosList').innerHTML = '';
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch('/api/admin-users', {
        headers: { Authorization: 'Bearer ' + session.access_token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar usuários');
      allUsuarios = data.users || [];
      await loadVerificados();
      usuariosLoaded = true;
      renderUsuariosList();
    } catch (err) {
      statusEl.textContent = 'Não foi possível carregar os usuários: ' + err.message;
    }
  }

  async function toggleSelo(id){
    const u = allUsuarios.find(x => x.id === id);
    const jaTem = verificadosSet.has(id);
    const nome = u?.nome || u?.email || 'essa conta';
    if (!confirm(jaTem
      ? `Remover o selo de verificado de "${nome}"?`
      : `Dar o selo de verificado pra "${nome}"? Isso mostra pra quem procura que a equipe confirmou que essa pessoa é confiável.`)) return;
    try {
      if (jaTem) {
        const { error } = await supabaseClient.from('verificados').delete().eq('user_id', id);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from('verificados').insert({ user_id: id });
        if (error) throw error;
      }
      await loadVerificados();
      renderUsuariosList();
    } catch (err) {
      alert('Não foi possível atualizar o selo: ' + err.message);
    }
  }

  function renderUsuariosList(){
    const statusEl = document.getElementById('usuariosStatus');
    const listEl = document.getElementById('usuariosList');
    const search = (document.getElementById('usuariosSearch').value || '').toLowerCase();

    let items = allUsuarios;
    if (search) {
      items = items.filter(u =>
        (u.nome || '').toLowerCase().includes(search) ||
        (u.email || '').toLowerCase().includes(search) ||
        (u.whatsapp || '').toLowerCase().includes(search)
      );
    }

    if (items.length === 0) {
      statusEl.textContent = 'Nenhum usuário encontrado.';
      listEl.innerHTML = '';
      return;
    }
    statusEl.textContent = '';
    const tipoLabel = { landlord: 'Landlord', repassando: 'Repassando vaga' };
    listEl.innerHTML = items.map(u => {
      const verificado = verificadosSet.has(u.id);
      return `
      <div class="admin-card">
        <div class="admin-card-top">
          <div>
            <div class="admin-card-title">
              ${u.nome ? escapeHtml(u.nome) : '(sem nome)'}
              ${verificado ? '<span style="color:#B8860B; font-size:0.82rem; font-weight:700;">✓ Verificado</span>' : ''}
            </div>
            <div class="admin-card-meta">${u.email ? escapeHtml(u.email) : 'sem email'} · ${u.whatsapp ? escapeHtml(u.whatsapp) : 'sem WhatsApp'}</div>
            <div class="admin-card-meta">${tipoLabel[u.tipo_usuario] || 'tipo não informado'} · cadastrado em ${u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '—'}</div>
          </div>
        </div>
        <div class="admin-card-actions">
          <button class="btn btn-ghost btn-small" onclick="openEditUser('${u.id}')">Editar</button>
          <button class="btn btn-ghost btn-small" onclick="toggleSelo('${u.id}')">${verificado ? 'Remover selo' : 'Dar selo'}</button>
          <button class="btn btn-ghost btn-small" onclick="promoteToAdmin('${u.id}')">Tornar admin</button>
          <button class="btn btn-ghost btn-small btn-danger" onclick="deleteUsuario('${u.id}')">Remover</button>
        </div>
      </div>
      `;
    }).join('');
  }

  let editingUserId = null;

  function openEditUser(id){
    const u = allUsuarios.find(x => x.id === id);
    if (!u) return;
    editingUserId = id;
    document.getElementById('eu_nome').value = u.nome || '';
    document.getElementById('eu_email').value = u.email || '';
    document.getElementById('eu_whatsapp').value = u.whatsapp || '';
    document.getElementById('editUserError').textContent = '';
    document.getElementById('editUserOverlay').classList.add('open');
  }

  function closeEditUser(){
    document.getElementById('editUserOverlay').classList.remove('open');
    editingUserId = null;
  }

  async function saveEditUser(event){
    event.preventDefault();
    const errorEl = document.getElementById('editUserError');
    errorEl.textContent = '';
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({
          action: 'update',
          user_id: editingUserId,
          email: document.getElementById('eu_email').value,
          nome: document.getElementById('eu_nome').value,
          whatsapp: document.getElementById('eu_whatsapp').value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      closeEditUser();
      loadUsuarios();
    } catch (err) {
      errorEl.textContent = err.message;
    }
    return false;
  }

  async function promoteToAdmin(id){
    const u = allUsuarios.find(x => x.id === id);
    if (!confirm(`Tornar "${u?.nome || u?.email || 'essa conta'}" administrador do painel?`)) return;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ action: 'promote_admin', user_id: id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao tornar admin');
      alert('Pronto! Essa conta agora tem acesso ao painel admin.');
    } catch (err) {
      alert('Não foi possível tornar admin: ' + err.message);
    }
  }

  async function deleteUsuario(id){
    if (!confirm('Remover essa conta permanentemente? Os anúncios publicados por ela vão continuar existindo, mas sem dono.')) return;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ action: 'delete', user_id: id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover');
      loadUsuarios();
    } catch (err) {
      alert('Não foi possível remover: ' + err.message);
    }
  }

  // ======= ADMINISTRADORES =======
  async function handleCreateAdmin(event){
    event.preventDefault();
    const errorEl = document.getElementById('createAdminError');
    const successEl = document.getElementById('createAdminSuccess');
    errorEl.textContent = '';
    successEl.textContent = '';
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({
          action: 'create_admin',
          nome: document.getElementById('ca_nome').value,
          email: document.getElementById('ca_email').value,
          whatsapp: document.getElementById('ca_whatsapp').value,
          password: document.getElementById('ca_senha').value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar administrador');
      successEl.textContent = 'Administrador criado! Passe o email e a senha pra pessoa.';
      document.getElementById('ca_nome').value = '';
      document.getElementById('ca_email').value = '';
      document.getElementById('ca_whatsapp').value = '';
      document.getElementById('ca_senha').value = '';
      loadAdmins();
    } catch (err) {
      const jaExiste = /already been registered|already exists/i.test(err.message);
      errorEl.textContent = jaExiste
        ? 'Essa pessoa já tem uma conta no site. Vá na aba "Usuários" e clique em "Tornar admin" ao lado do nome dela.'
        : err.message;
    }
    return false;
  }

  async function loadAdmins(){
    const statusEl = document.getElementById('adminsStatus');
    const tableWrap = document.getElementById('adminsTableWrap');
    statusEl.textContent = 'Carregando...';
    tableWrap.style.display = 'none';
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch('/api/admin-users?scope=admins', {
        headers: { Authorization: 'Bearer ' + session.access_token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar administradores');
      const admins = data.admins || [];
      if (admins.length === 0) {
        statusEl.textContent = 'Nenhum administrador encontrado.';
        return;
      }
      statusEl.textContent = '';
      tableWrap.style.display = 'block';
      document.getElementById('adminsTableBody').innerHTML = admins.map(a => `
        <tr>
          <td>${a.nome ? escapeHtml(a.nome) : '—'}</td>
          <td>${escapeHtml(a.email)}</td>
          <td>${a.criado_em ? new Date(a.criado_em).toLocaleDateString('pt-BR') : '—'}</td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-small btn-danger" onclick="removeAdminRole('${a.user_id}')">Remover admin</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      statusEl.textContent = 'Não foi possível carregar os administradores: ' + err.message;
    }
  }

  async function removeAdminRole(user_id){
    if (!confirm('Remover o acesso de administrador dessa pessoa? A conta dela continua existindo, só perde o acesso ao painel admin.')) return;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ action: 'remove_admin', user_id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover');
      loadAdmins();
    } catch (err) {
      alert('Não foi possível remover: ' + err.message);
    }
  }

  // ======= MENSAGENS / SUGESTÕES =======
  async function loadMensagens(){
    const statusEl = document.getElementById('mensagensStatus');
    const listEl = document.getElementById('mensagensList');
    try {
      const { data, error } = await supabaseClient
        .from('feedback_mensagens')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;

      if (!usuariosLoaded) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const res = await fetch('/api/admin-users', { headers: { Authorization: 'Bearer ' + session.access_token } });
        const usersData = await res.json();
        if (res.ok) { allUsuarios = usersData.users || []; usuariosLoaded = true; }
      }
      const userMap = {};
      allUsuarios.forEach(u => { userMap[u.id] = u; });

      const naoLidas = (data || []).filter(m => !m.lida).length;
      document.getElementById('countMensagensNaoLidas').textContent = naoLidas ? `(${naoLidas})` : '';

      if (!data || data.length === 0) {
        statusEl.textContent = 'Nenhuma mensagem por enquanto.';
        listEl.innerHTML = '';
        return;
      }
      statusEl.textContent = '';
      listEl.innerHTML = data.map(m => {
        const u = userMap[m.user_id];
        return `
          <div class="admin-card">
            <div class="admin-card-meta">${u ? escapeHtml(u.nome || u.email) : 'usuário removido'} · ${new Date(m.criado_em).toLocaleDateString('pt-BR')}${!m.lida ? ' · <strong style="color:#C1502E;">não lida</strong>' : ''}</div>
            <p style="margin-top:8px; white-space:pre-wrap;">${escapeHtml(m.mensagem)}</p>
            ${!m.lida ? `<div class="admin-card-actions"><button class="btn btn-ghost btn-small" onclick="marcarMensagemLida(${m.id})">Marcar como lida</button></div>` : ''}
          </div>
        `;
      }).join('');
    } catch (err) {
      statusEl.textContent = 'Não foi possível carregar as mensagens: ' + err.message;
    }
  }

  async function marcarMensagemLida(id){
    const { error } = await supabaseClient.from('feedback_mensagens').update({ lida: true }).eq('id', id);
    if (!error) loadMensagens();
  }

  // ======= DENÚNCIAS =======
  async function loadDenuncias(){
    const statusEl = document.getElementById('denunciasStatus');
    const listEl = document.getElementById('denunciasList');
    try {
      const { data, error } = await supabaseClient
        .from('denuncias')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;

      const anuncioMap = {};
      allAnuncios.forEach(a => { anuncioMap[a.id] = a; });

      const abertas = (data || []).filter(d => !d.resolvida).length;
      document.getElementById('countDenunciasAbertas').textContent = abertas ? `(${abertas})` : '';

      if (!data || data.length === 0) {
        statusEl.textContent = 'Nenhuma denúncia por enquanto.';
        listEl.innerHTML = '';
        return;
      }
      statusEl.textContent = '';
      listEl.innerHTML = data.map(d => {
        const a = anuncioMap[d.anuncio_id];
        const titulo = a ? escapeHtml(a.titulo || '(sem título)') : `anúncio #${d.anuncio_id} (removido)`;
        return `
          <div class="admin-card">
            <div class="admin-card-meta">Anúncio: <strong>${titulo}</strong> · ${new Date(d.criado_em).toLocaleDateString('pt-BR')}${!d.resolvida ? ' · <strong style="color:#C1502E;">aberta</strong>' : ' · resolvida'}</div>
            <p style="margin-top:8px; white-space:pre-wrap;">${escapeHtml(d.motivo)}</p>
            <div class="admin-card-actions">
              ${a ? `<button class="btn btn-ghost btn-small" onclick="openEditListing(${d.anuncio_id})">Ver anúncio</button>` : ''}
              ${!d.resolvida ? `<button class="btn btn-ghost btn-small" onclick="resolverDenuncia(${d.id})">Marcar como resolvida</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      statusEl.textContent = 'Não foi possível carregar as denúncias: ' + err.message;
    }
  }

  async function resolverDenuncia(id){
    const { error } = await supabaseClient.from('denuncias').update({ resolvida: true }).eq('id', id);
    if (!error) loadDenuncias();
  }

  supabaseClient.auth.onAuthStateChange(() => refreshAuthState());
  refreshAuthState();
