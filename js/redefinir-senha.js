// Script da página redefinir-senha.html
// Depende de js/comum.js (supabaseClient, escapeHtml, formatEuro, getFotosArray,
// formatDisponibilidade, isDestacado, togglePw). CSS em css/redefinir-senha.css.

  function showState(id){
    ['loadingState', 'formState', 'successState', 'invalidState'].forEach(s => {
      document.getElementById(s).style.display = s === id ? 'block' : 'none';
    });
  }

  let recoveryReady = false;

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      recoveryReady = true;
      showState('formState');
    }
  });

  // Se o link já foi processado antes do listener acima ser registrado,
  // uma sessão válida vinda do hash da URL também libera o formulário.
  (async () => {
    await new Promise(r => setTimeout(r, 400));
    if (recoveryReady) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    const hash = window.location.hash || '';
    if (session && hash.includes('type=recovery')) {
      showState('formState');
    } else if (!hash.includes('access_token')) {
      showState('invalidState');
    }
  })();

  async function handleReset(event){
    event.preventDefault();
    const novaSenha = document.getElementById('novaSenha').value;
    const confirmaSenha = document.getElementById('confirmaSenha').value;
    const errorEl = document.getElementById('resetError');
    const btn = document.getElementById('resetBtn');
    errorEl.textContent = '';

    if (novaSenha !== confirmaSenha) {
      errorEl.textContent = 'As senhas não coincidem.';
      return false;
    }

    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const { error } = await supabaseClient.auth.updateUser({ password: novaSenha });

    if (error) {
      errorEl.textContent = 'Não foi possível salvar a nova senha: ' + error.message;
      btn.disabled = false;
      btn.textContent = 'Salvar nova senha';
      return false;
    }

    showState('successState');
    setTimeout(() => { window.location.href = 'painel.html'; }, 1800);
    return false;
  }
