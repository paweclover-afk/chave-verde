(() => {
  'use strict';
  const app = document.currentScript.dataset.app;
  const shell = document.getElementById('app-shell');
  const button = document.getElementById('support-open');
  const notice = document.getElementById('support-notice');
  const peer = app === 'ritmo' ? 'Suporte' : 'Leonarda';
  const dialog = document.createElement('dialog');
  dialog.className = 'support-dialog';
  dialog.setAttribute('aria-labelledby','support-title');
  dialog.innerHTML = '<header><h2 id="support-title">Suporte</h2><button type="button" class="secondary" aria-label="Fechar suporte">×</button></header><ol class="support-messages" aria-label="Mensagens"></ol><p class="support-status" role="status"></p><form><label for="support-text"></label><textarea id="support-text" rows="3" maxlength="2000" required></textarea><button type="submit" class="primary">Enviar</button></form>';
  document.body.append(dialog);
  const list = dialog.querySelector('ol');
  const status = dialog.querySelector('.support-status');
  const form = dialog.querySelector('form');
  const field = dialog.querySelector('textarea');
  const submit = form.querySelector('button');
  const time = new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'});
  const label = dialog.querySelector('label');
  label.textContent = app === 'ritmo' ? 'Relate seu problema' : 'Escreva para Leonarda';
  if (app === 'ritmo') {
    const guidance = document.createElement('p');
    guidance.id = 'support-guidance';
    guidance.textContent = 'Seja direta e objetiva. Diga em qual tela o problema aconteceu, o que você tentou fazer e o que apareceu. Se houver uma mensagem de erro, copie o texto aqui.';
    label.after(guidance);
    field.setAttribute('aria-describedby',guidance.id);
  }
  dialog.querySelector('header button').onclick = () => dialog.close();

  async function request(body) {
    const response = await fetch('/api/' + app + '?action=support',{
      cache:'no-store',
      credentials:'same-origin',
      ...(body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {})
    });
    if (!response.ok) throw Error('Suporte indisponível agora. Tente novamente.');
    return response.json();
  }

  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('chaveverde-support') : null;
  let polling = false;
  let refreshQueued = false;
  let latest = '';
  let draft;
  function render(messages) {
    const version = JSON.stringify(messages);
    if (version === latest) return;
    latest = version;
    const end = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    const items = messages.map(message => {
      const item = document.createElement('li');
      const meta = document.createElement('small');
      const text = document.createElement('p');
      item.className = message.sender === app ? 'support-own' : '';
      meta.textContent = (message.sender === app ? 'Você' : peer) + ' · ' + time.format(new Date(message.created_at));
      text.textContent = message.body;
      item.append(meta,text);
      return item;
    });
    list.replaceChildren(...items);
    if (end) list.scrollTop = list.scrollHeight;
  }

  function showUnread(hasUnread) {
    button.textContent = hasUnread ? 'Suporte · Nova mensagem' : 'Suporte';
    if (app === 'ritmo') button.toggleAttribute('data-unread',hasUnread);
    if (notice) notice.hidden = !hasUnread;
  }

  async function sync() {
    if (polling || shell.hidden || document.hidden) return;
    polling = true;
    try {
      const {messages} = await request();
      if (shell.hidden) return;
      button.hidden = false;
      const unread = messages.filter(message => message.sender !== app && !message.read_at);
      showUnread(unread.length > 0);
      render(messages);
      if (dialog.open && !document.hidden && unread.length) {
        await request({operation:'read',ids:unread.map(message => message.id)});
        showUnread(false);
      }
      if (!submit.disabled) status.textContent = messages.length ? '' : 'A conversa começa aqui.';
    } catch (error) {
      if (dialog.open && !submit.disabled) status.textContent = error.message;
    } finally {
      polling = false;
      if (refreshQueued) {
        refreshQueued = false;
        sync();
      }
    }
  }

  function refreshNow() {
    if (polling) refreshQueued = true;
    else sync();
  }

  if (channel) channel.onmessage = refreshNow;
  function openChat() {
    dialog.showModal();
    list.scrollTop = list.scrollHeight;
    refreshNow();
  }
  button.onclick = openChat;
  if (notice) notice.onclick = openChat;
  form.onsubmit = async event => {
    event.preventDefault();
    const text = field.value.trim();
    if (!text || submit.disabled) return;
    if (draft?.text !== text) draft = {operation:'send',id:crypto.randomUUID(),text};
    submit.disabled = true;
    status.textContent = 'Enviando…';
    try {
      await request(draft);
      channel?.postMessage('refresh');
      draft = undefined;
      field.value = '';
      status.textContent = '';
    } catch {
      status.textContent = 'Envio sem confirmação. Toque em Enviar para tentar novamente.';
      return;
    } finally {
      submit.disabled = false;
    }
    refreshNow();
  };

  new MutationObserver(sync).observe(shell,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('focus',sync);
  setInterval(sync,1000);
  sync();
})();
