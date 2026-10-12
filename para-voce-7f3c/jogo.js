(() => {
  'use strict';
  // 12/10/2026, 17h em Dublin (UTC+1). Data fixa: não reinicia no dia seguinte.
  const revealAt = Date.parse('2026-10-12T17:00:00+01:00');
  const storageKey = 'pequena-missao-7f3c-v2';
  const steps = [
    { icon: '🕵️', title: 'Leonarda, você foi convocada.', text: 'O Departamento de Assuntos Absolutamente Desnecessários precisa de você. São 7 etapas. Zero preparo físico. Questionável utilidade.', choices: ['Aceitar a missão 😎', 'Eu nem fiz inscrição 🤨'], replies: ['Excelente. Seu salário será de zero euros.', 'O recrutamento foi feito com critérios rigorosos: eu quis.'] },
    { icon: '🤖', title: 'Confirme que você é a Leonarda.', text: 'Uma torradeira está tentando roubar sua identidade. Precisamos de uma prova definitiva.', choices: ['Sou eu, infelizmente para vocês 💅', 'Depende. Tem boleto envolvido? 🧾', 'Bip bip. Quer dizer… oi 🤖'], replies: ['Essa energia de protagonista confere. Acesso liberado.', 'Não. Aqui a única cobrança é de paciência.', 'Suspeito. Mas a torradeira não teria esse carisma.'] },
    { icon: '⚖️', title: 'Tribunal da falta de noção.', text: 'O criador deste site se declara oficialmente um bocó e pede desculpas. Qual a sentença?', choices: ['Multa de um lanche 🍟', 'Serviço comunitário: parar de ser bocó 🧹', 'As duas. Próximo caso. 🔨'], replies: ['Sentença registrada. O réu sentiu no bolso imaginário.', 'Pena educativa. O réu já começou a atualização do sistema.', 'A juíza não veio para brincar. Quer dizer… veio sim.'] },
    { icon: '🦆', title: 'Emergência no departamento.', text: 'Um pato de óculos escuros bloqueou a passagem. Como você resolve?', choices: ['Peço licença. Tenho educação 💅', 'Ofereço um pão e negocio 🍞', 'Faço quá mais alto e imponho respeito 🦆'], replies: ['O pato pediu desculpas e te chamou de senhora. Ousado.', 'Ele aceitou. Você acaba de virar ministra das Relações com Patos.', 'Funcionou. Agora você é a líder deles. Parabéns, eu acho.'] },
    { icon: '🧠', title: 'Teste de conhecimento inútil.', text: 'Se eu disser “vou falar só uma coisinha”, quanto tempo você reserva?', choices: ['Uns 30 segundos. Sou otimista ⏱️', 'Três dias úteis 📅', 'Já coloco o celular para carregar 🔌'], replies: ['Que bonito ver alguém ainda acreditando na humanidade.', 'Resposta aceita pelo sindicato de quem me aguenta.', 'Essa mulher não tem um cérebro. Tem uma central de estratégia.'] },
    { icon: '🏆', title: 'Seu prêmio foi aprovado.', text: 'Por chegar até aqui sem jogar o celular longe, você ganhou um título. Escolha com responsabilidade nenhuma.', choices: ['Doutora em Aturar Esse Menino 🎓', 'CEO da Paciência Limitada 💼', 'Lenda Viva e Humilde Também 👑'], replies: ['Diploma reconhecido pelo MEC: Ministério das Escolhas Caóticas.', 'Primeira decisão da CEO: cortar meu orçamento de besteira.', 'Humildade tão grande que mal cabe nesta tela.'] },
    { icon: '🚨', title: 'Botão muito importante.', text: 'A missão termina aqui. Falta apertar um botão. O orçamento não permitiu efeitos especiais, então faça “tcharam” com a boca.', choices: ['TCHARAM 🎉', 'Apertei em silêncio. Sou rebelde 😎', 'Quero falar com o gerente 📣'], replies: ['Efeito sonoro impecável. Hollywood perdeu um talento.', 'Rebeldia registrada. O sistema ficou levemente intimidado.', 'O gerente sou eu. Por isso o atendimento está assim.'] }
  ];
  const el = id => document.getElementById(id);
  let current = 0;
  let revealed = false;
  try { const saved = Number(localStorage.getItem(storageKey)); if (Number.isInteger(saved) && saved >= 0 && saved <= 7) current = saved; } catch (_) { /* Continua normalmente sem armazenamento. */ }
  function save() { try { localStorage.setItem(storageKey, String(current)); } catch (_) {} }
  function showStep(focus = false) {
    el('scene').hidden = current === 7;
    el('waiting').hidden = current !== 7;
    el('step').textContent = current === 7 ? 'MISSÃO CONCLUÍDA · AGUARDE O PLOT TWIST' : `PASSO ${current + 1} DE 7`;
    el('bar').style.width = `${Math.min(current + 1, 7) / 7 * 100}%`;
    document.querySelector('.progress').setAttribute('aria-valuenow', String(Math.min(current + 1, 7)));
    if (current === 7) return;
    const step = steps[current];
    el('symbol').textContent = step.icon;
    el('title').textContent = step.title;
    el('description').textContent = step.text;
    el('reply').textContent = '';
    el('next').hidden = true;
    el('next').textContent = current === 6 ? 'Liberar o plot twist →' : 'Continuar →';
    el('choices').replaceChildren();
    step.choices.forEach((label, index) => {
      const button = document.createElement('button');
      button.className = 'choice';
      button.textContent = label;
      button.addEventListener('click', () => {
        el('choices').querySelectorAll('button').forEach(choice => { choice.disabled = true; });
        button.classList.add('selected');
        el('reply').textContent = step.replies[index];
        el('next').hidden = false;
        el('next').focus();
      });
      el('choices').append(button);
    });
    if (focus) el('title').focus();
  }
  function tick() {
    const remaining = Math.max(0, revealAt - Date.now());
    if (remaining === 0 && !revealed) {
      revealed = true;
      el('scene').hidden = true;
      el('waiting').hidden = true;
      el('surprise').hidden = false;
      el('step').textContent = 'OPERAÇÃO ARMÁRIO: LIBERADA';
      el('bar').style.width = '100%';
      document.querySelector('.progress').setAttribute('aria-valuenow', '7');
      el('surprise-title').focus();
    }
    const total = Math.ceil(remaining / 1000);
    el('hours').textContent = String(Math.floor(total / 3600)).padStart(2, '0');
    el('minutes').textContent = String(Math.floor(total % 3600 / 60)).padStart(2, '0');
    el('seconds').textContent = String(total % 60).padStart(2, '0');
  }
  el('next').addEventListener('click', () => { if (revealed) return; current = Math.min(current + 1, 7); save(); showStep(true); tick(); });
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('pageshow', tick);
  showStep();
  tick();
  setInterval(tick, 1000);
})();
