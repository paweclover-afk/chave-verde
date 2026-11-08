'use strict';

let financeMonth = '';
function ledger() {
  return state.finance || {debts: [], expenses: []};
}
function commitFinance(change) {
  if (window.RitmoCloud.blocked()) throw Error('Há um conflito de sincronização. Baixe o backup e recarregue antes de alterar os registros.');
  const next = structuredClone(ledger());
  change(next);
  T.validateFinance(next);
  const record = {finance:next};
  if (new TextEncoder().encode(JSON.stringify(record)).length > 145000) {
    throw Error('O limite de registros financeiros foi atingido. Baixe um backup.');
  }
  state.finance = record.finance;
  persist();
  renderFinance();
}
function money(cents, currency) {
  return new Intl.NumberFormat('pt-BR', {style:'currency', currency}).format(cents / 100);
}
function cents(field) {
  const value = field.valueAsNumber;
  if (!Number.isFinite(value) || value <= 0) throw Error('Informe um valor maior que zero.');
  return Math.round(value * 100);
}
function dueList() {
  return ledger().debts.map(debt => ({debt, due:T.debtDue(debt)}))
    .filter(item => item.due)
    .sort((a,b) => a.due.day.localeCompare(b.due.day));
}
function dueLine(item) {
  const today = T.dateKey(new Date());
  const when = item.due.day < today ? 'Vencido em ' + dateLabel(item.due.day)
    : item.due.day === today ? 'Vence hoje' : 'Vence em ' + dateLabel(item.due.day);
  return when + ' · ' + money(item.due.due, item.debt.currency);
}
function showFinanceReminders() {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const upcoming = dueList().filter(item => item.due.day <= T.dateKey(nextWeek));
  const dialog = $('finance-reminders');
  if (!upcoming.length || dialog.open) return;
  const list = el('ul', undefined, 'finance-reminder-list');
  for (const item of upcoming) {
    const line = el('li');
    line.append(el('strong', 'Pagar ' + item.debt.name), el('p', dueLine(item), 'smallnote'));
    list.append(line);
  }
  const view = el('button', 'Abrir Financeiro', 'primary');
  view.onclick = () => {
    dialog.close();
    switchView('finance');
  };
  const close = el('button', 'Fechar', 'secondary');
  close.onclick = () => dialog.close();
  const title = el('h2', 'Contas a pagar');
  title.id = 'finance-reminder-title';
  const actions = el('div', undefined, 'finance-actions');
  actions.append(view, close);
  dialog.replaceChildren(title, el('p', 'Vencidos e próximos 7 dias.', 'smallnote'), list, actions);
  dialog.showModal();
}
function financeCard(title) {
  const card = el('section', undefined, 'card finance-card');
  card.append(el('h3', title));
  return card;
}
function financeField(form, labelText, config = {}) {
  const label = el('label', labelText);
  const field = el(config.options ? 'select' : 'input');
  if (config.options) {
    for (const [value,text] of config.options) {
      const option = el('option', text);
      option.value = value;
      field.append(option);
    }
  } else {
    for (const name of ['type','min','max','step','maxLength','placeholder']) {
      if (config[name] !== undefined) field[name] = config[name];
    }
  }
  if (config.value !== undefined) field.value = config.value;
  field.required = true;
  label.append(field);
  form.append(label);
  return field;
}
function financeForm(card, buttonText) {
  const form = el('form', undefined, 'finance-form');
  const button = el('button', buttonText, 'primary');
  button.type = 'submit';
  card.append(form);
  return {form,button};
}
const currencyOptions = [['EUR','EUR · Euro'],['BRL','BRL · Real'],['GBP','GBP · Libra']];
const amountField = {type:'number',min:'0.01',max:'999999999.99',step:'0.01'};
function addDebtForm(existing) {
  const card = financeCard(existing ? 'Editar acordo' : 'Cadastrar dívida ou consórcio');
  const {form,button} = financeForm(card,existing ? 'Salvar acordo' : 'Salvar dívida');
  const kind = financeField(form,'Tipo',{options:[['debt','Dívida'],['consortium','Consórcio']]});
  const name = financeField(form,'Para quem devo ou nome do consórcio',{type:'text',maxLength:100,placeholder:'Ex.: Mãe, irmã ou consórcio do carro'});
  const currency = financeField(form,'Moeda',{options:currencyOptions});
  const amount = financeField(form,'Valor total',amountField);
  const frequency = financeField(form,'Frequência',{options:[['once','Pagamento único'],['week','Semanal'],['month','Mensal']]});
  const interval = financeField(form,'Pagar a cada quantas semanas ou meses?',{type:'number',min:1,max:52,step:1,value:1});
  const installment = financeField(form,'Valor de cada parcela',amountField);
  const date = financeField(form,existing ? 'Data base do próximo vencimento' : 'Data base do primeiro vencimento',{type:'date'});
  const preview = el('p',undefined,'smallnote');
  form.append(preview);
  const updatePreview = () => {
    preview.textContent = date.value ? 'Pagamento na sexta-feira, '+dateLabel(T.fridayOnOrAfter(date.value))+'.' : 'Selecione uma data base para calcular a sexta-feira.';
  };
  date.oninput = updatePreview;
  const adjustFields = () => {
    const recurring = frequency.value !== 'once';
    for (const field of [interval,installment]) { field.parentElement.hidden = !recurring; field.required = recurring; }
    const today = new Date(), next = new Date(today);
    if (frequency.value === 'month') {
      next.setDate(1);next.setMonth(next.getMonth()+1);
      next.setDate(Math.min(today.getDate(),new Date(next.getFullYear(),next.getMonth()+1,0).getDate()));
    }
    date.value = T.dateKey(next);
    updatePreview();
  };
  frequency.onchange = adjustFields;
  adjustFields();
  if (existing) {
    kind.value = existing.kind;
    name.value = existing.name;
    currency.value = existing.currency;
    currency.disabled = existing.payments.length > 0;
    amount.value = (existing.amount / 100).toFixed(2);
    amount.readOnly = true;
    frequency.value = existing.frequency;
    adjustFields();
    interval.value = existing.interval;
    installment.value = (existing.installment / 100).toFixed(2);
    date.value = T.debtDue(existing).nominalDay;
    updatePreview();
  }
  form.append(button);
  form.onsubmit = e => {
    e.preventDefault();
    try {
      const total = cents(amount), recurring = frequency.value !== 'once';
      const terms = {kind:kind.value,name:name.value.trim(),currency:currency.value,amount:total,frequency:frequency.value,interval:recurring?Number(interval.value):1,installment:recurring?cents(installment):total,firstDue:date.value};
      commitFinance(next => {
        if (!existing) {
          next.debts.push({...terms,id:crypto.randomUUID(),payments:[]});
          return;
        }
        const current = next.debts.find(d => d.id === existing.id);
        const scheduleChanged = terms.firstDue !== T.debtDue(current).nominalDay ||
          ['frequency','interval','installment'].some(field => terms[field] !== current[field]);
        if (!scheduleChanged) terms.firstDue = current.firstDue;
        Object.assign(current, terms);
        if (scheduleChanged) current.scheduleBase = T.paidAmount(current);
      });
      card.closest('dialog')?.close();
      toast(existing ? 'Acordo atualizado.' : 'Dívida cadastrada.');
    } catch (error) { toast(error.message); }
  };
  return card;
}
function payDebt(debt) {
  const due = T.debtDue(debt);
  if (!due) return;
  const dialog = el('dialog',undefined,'finance-dialog');
  const title = el('h2','Registrar pagamento');
  title.id = 'finance-payment-title';
  dialog.setAttribute('aria-labelledby',title.id);
  dialog.append(title,el('p',debt.name+' · saldo '+money(due.balance,debt.currency),'smallnote'));
  const {form,button} = financeForm(dialog,'Abater do saldo');
  const amount = financeField(form,'Valor pago ('+debt.currency+')',{...amountField,max:(due.balance/100).toFixed(2),value:(due.due/100).toFixed(2)});
  const date = financeField(form,'Data do pagamento',{type:'date',value:T.dateKey(new Date()),max:T.dateKey(new Date())});
  const cancel = el('button','Cancelar','secondary');
  cancel.type = 'button';
  cancel.onclick = () => dialog.close();
  form.append(button,cancel);
  form.onsubmit = e => {
    e.preventDefault();
    try {
      const value = cents(amount);
      commitFinance(next => {
        const current = next.debts.find(d => d.id === debt.id);
        if (!current || value > current.amount-T.paidAmount(current)) throw Error('O pagamento não pode ultrapassar o saldo.');
        current.payments.push({id:crypto.randomUUID(),amount:value,date:date.value});
      });
      dialog.close();
      toast('Pagamento registrado e abatido do saldo.');
    } catch (error) { toast(error.message); }
  };
  dialog.onclose = () => dialog.remove();
  document.body.append(dialog);
  dialog.showModal();
}
function debtsCard() {
  const card = financeCard('Dívidas e consórcios');
  const ordered = [...dueList().map(item => item.debt), ...ledger().debts.filter(debt => !T.debtDue(debt))];
  if (!ordered.length) card.append(el('p','Nenhuma dívida cadastrada.','smallnote'));
  for (const debt of ordered) {
    const due = T.debtDue(debt), row = el('article',undefined,'finance-row');
    row.append(el('h4',debt.name),el('p',debt.kind==='consortium'?'Consórcio':'Dívida','smallnote'));
    row.append(el('strong',due?'Saldo de '+money(due.balance,debt.currency):'Quitado'));
    row.append(el('p','Valor inicial '+money(debt.amount,debt.currency)+' · Pago '+money(T.paidAmount(debt),debt.currency),'smallnote'));
    if (due) {
      row.append(el('p',dueLine({debt,due}),'finance-due'));
      if (debt.frequency!=='once') row.append(el('p','Parcela de '+money(debt.installment,debt.currency)+' a cada '+debt.interval+' '+(debt.frequency==='week'?(debt.interval===1?'semana':'semanas'):(debt.interval===1?'mês':'meses')),'smallnote'));
      const pay = el('button','Registrar pagamento','primary');
      pay.onclick = () => payDebt(debt);
      const edit = el('button','Editar acordo','secondary');
      edit.onclick = () => {
        const dialog = el('dialog',undefined,'finance-dialog');
        dialog.setAttribute('aria-label','Editar acordo');
        const formCard = addDebtForm(debt);
        const close = el('button','Cancelar','secondary');
        close.onclick = () => dialog.close();
        dialog.append(formCard,close);
        dialog.onclose = () => dialog.remove();
        document.body.append(dialog);
        dialog.showModal();
      };
      row.append(pay,edit);
    }
    if (debt.payments.length) {
      const details = el('details');
      details.append(el('summary','Histórico de pagamentos'));
      const list = el('ul');
      for (const p of [...debt.payments].reverse()) list.append(el('li',dateLabel(p.date)+' · '+money(p.amount,debt.currency)));
      details.append(list);
      const undo = el('button','Estornar último registro','secondary');
      undo.onclick = () => {
        if (!confirm('Estornar o último pagamento registrado de '+debt.name+'?')) return;
        try { commitFinance(next => {
          const current=next.debts.find(d=>d.id===debt.id);
          current.payments.pop();
          if(current.scheduleBase!==undefined)current.scheduleBase=Math.min(current.scheduleBase,T.paidAmount(current));
        }); toast('Pagamento estornado.'); }
        catch (error) { toast(error.message); }
      };
      details.append(undo);
      row.append(details);
    } else {
      const remove = el('button','Remover registro','secondary');
      remove.onclick = () => {
        if (!confirm('Remover o registro de '+debt.name+'?')) return;
        try { commitFinance(next => { next.debts=next.debts.filter(d=>d.id!==debt.id); }); }
        catch (error) { toast(error.message); }
      };
      row.append(remove);
    }
    card.append(row);
  }
  return card;
}
function addExpenseForm() {
  const card = financeCard('Registrar despesa');
  const {form,button} = financeForm(card,'Salvar despesa');
  const category = financeField(form,'Categoria',{options:T.expenseCategories.map(x=>[x,x])});
  const name = financeField(form,'Descrição',{type:'text',maxLength:160,placeholder:'Ex.: compras da semana'});
  const currency = financeField(form,'Moeda',{options:currencyOptions});
  const amount = financeField(form,'Valor',amountField);
  const date = financeField(form,'Data da despesa',{type:'date',value:T.dateKey(new Date())});
  form.append(button);
  form.onsubmit = e => {
    e.preventDefault();
    try {
      financeMonth = date.value.slice(0,7);
      commitFinance(next=>next.expenses.push({id:crypto.randomUUID(),name:name.value.trim(),category:category.value,currency:currency.value,amount:cents(amount),date:date.value}));
      toast('Despesa registrada.');
    } catch (error) { toast(error.message); }
  };
  return card;
}
function expensesCard() {
  const card = financeCard('Despesas do mês');
  const month = financeField(card,'Mês',{type:'month',value:financeMonth || T.dateKey(new Date()).slice(0,7)});
  month.onchange = () => { financeMonth=month.value; renderFinance(); };
  const expenses = ledger().expenses.filter(x=>x.date.startsWith(month.value)).sort((a,b)=>b.date.localeCompare(a.date));
  if (!expenses.length) card.append(el('p','Nenhuma despesa neste mês.','smallnote'));
  for (const currency of T.financeCurrencies) {
    const items = expenses.filter(x=>x.currency===currency);
    if (items.length) card.append(el('p','Total '+currency+' · '+money(items.reduce((sum,x)=>sum+x.amount,0),currency),'finance-due'));
  }
  for (const expense of expenses) {
    const row = el('article',undefined,'finance-row');
    row.append(el('strong',expense.name+' · '+money(expense.amount,expense.currency)),el('p',dateLabel(expense.date)+' · '+expense.category,'smallnote'));
    const remove = el('button','Remover despesa','secondary');
    remove.onclick = () => {
      if (!confirm('Remover a despesa '+expense.name+'?')) return;
      try { commitFinance(next => { next.expenses=next.expenses.filter(x=>x.id!==expense.id); }); }
      catch (error) { toast(error.message); }
    };
    row.append(remove);
    card.append(row);
  }
  return card;
}
function renderFinance() {
  const root = $('finance-section');
  const hint = el('p','Registre despesas, acompanhe o saldo de cada dívida e veja os próximos vencimentos. O vencimento cai na sexta-feira da data escolhida ou na seguinte. A próxima parcela aparece após quitar o valor previsto.','smallnote');
  const grid = el('div',undefined,'finance-grid');
  const debts = el('div'), expenses = el('div');
  debts.append(debtsCard(),addDebtForm());
  expenses.append(expensesCard(),addExpenseForm());
  grid.append(debts,expenses);
  root.replaceChildren(hint,forecastCard(),grid);
}

function forecastCard() {
  const card = financeCard('Próximos 30 dias');
  const now = new Date(), end = new Date(now);
  end.setDate(end.getDate()+29);
  const today = T.dateKey(now), until = T.dateKey(end), rows = [];
  for (const debt of ledger().debts) {
    const first = T.debtDue(debt);
    if (!first) continue;
    const paidBefore = index => index === 0 ? 0 : first.due+(index-1)*debt.installment;
    let low = 0, high = debt.frequency === 'once' ? 1 : Math.ceil(first.balance/debt.installment)+1;
    while(low<high) {
      const mid=Math.floor((low+high)/2), due=T.debtDue(debt,paidBefore(mid));
      if(due && due.day<today) low=mid+1;
      else high=mid;
    }
    let projected=Math.min(first.balance,paidBefore(low));
    if (projected) rows.push({debt,due:{...first,due:projected},overdue:low});
    while(projected<first.balance) {
      const due=T.debtDue(debt,projected);
      if(!due || due.day>until) break;
      rows.push({debt,due});
      projected+=due.due;
    }
  }
  rows.sort((a,b)=>a.due.day.localeCompare(b.due.day));
  card.append(el('p','Previsão de '+dateLabel(today)+' a '+dateLabel(until)+', incluindo parcelas em atraso.','smallnote'));
  if (!rows.length) card.append(el('p','Nenhuma parcela prevista nesse período.','smallnote'));
  for (const currency of T.financeCurrencies) {
    const total=rows.filter(x=>x.debt.currency===currency).reduce((sum,x)=>sum+x.due.due,0);
    if(total)card.append(el('p','A separar · '+money(total,currency),'finance-due'));
  }
  if(rows.length){
    const details=el('details');
    details.append(el('summary','Ver parcelas por vencimento'));
    const list=el('ul',undefined,'finance-reminder-list');
    for(const item of rows){const line=el('li');line.append(el('strong',item.debt.name),el('p',item.overdue>1?item.overdue+' parcelas em atraso · '+money(item.due.due,item.debt.currency):dueLine(item),'smallnote'));list.append(line);}
    details.append(list);
    card.append(details);
  }
  return card;
}
