'use strict';
let financeFilter='all';
function planEditor(title,fields,save){
 const dialog=el('dialog',undefined,'support-dialog'),form=el('form');
 dialog.append(el('h2',title),form);
 const inputs={};
 for(const [id,label,config] of fields)inputs[id]=financeField(form,label,config);
 const submit=el('button','Salvar','primary'),cancel=el('button','Cancelar','secondary');
 submit.type='submit';cancel.type='button';cancel.onclick=()=>dialog.close();form.append(submit,cancel);
 form.onsubmit=e=>{e.preventDefault();try{save(inputs);dialog.close();}catch(error){toast(error.message);}};
 dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
}
function editPlanAccount(account){
 planEditor(account?'Editar conta':'Adicionar conta',[
 ['name','Nome',{type:'text',maxLength:160,value:account?.name||''}],
 ['amount','Valor', {...amountField,value:account?account.amount/100:''}],
 ['currency','Moeda',{options:currencyOptions,value:account?.currency||'GBP'}],
 ['frequency','Frequência',{options:[['week','Semanal'],['month','Mensal'],['once','Uma vez']],value:account?.frequency||'month'}],
 ['start','Primeiro vencimento',{type:'date',value:account?.start||T.dateKey(new Date())}]
 ],f=>commitFinance(next=>{
 const record={id:account?.id||crypto.randomUUID(),name:f.name.value.trim(),amount:cents(f.amount),currency:f.currency.value,frequency:f.frequency.value,start:f.start.value};
 const payments=(next.billPayments||[]).filter(p=>p.ref.startsWith(record.id+'@'));
 if(account&&payments.length&&(record.start!==account.start||record.frequency!==account.frequency||record.currency!==account.currency))throw Error('Esta conta tem pagamentos. Mantenha moeda, frequência e primeiro vencimento para preservar os registros.');
 if(payments.some(p=>record.amount<(next.billPayments||[]).filter(x=>x.ref===p.ref).reduce((sum,x)=>sum+x.amount,0)))throw Error('Valor menor que pagamentos já registrados.');
 next.accounts??=[];next.accounts=next.accounts.filter(a=>a.id!==record.id);next.accounts.push(record);
 }));
}
function editPlanCard(card){
 planEditor(card?'Editar cartão':'Adicionar cartão',[
 ['name','Nome do cartão',{type:'text',maxLength:160,value:card?.name||''}],
 ['currency','Moeda',{options:currencyOptions,value:card?.currency||'GBP'}],
 ['closing','Dia de fechamento',{type:'number',min:1,max:31,step:1,value:card?.closing||5}],
 ['due','Dia de vencimento',{type:'number',min:1,max:31,step:1,value:card?.due||15}]
 ],f=>commitFinance(next=>{
 const record={id:card?.id||crypto.randomUUID(),name:f.name.value.trim(),currency:f.currency.value,closing:f.closing.valueAsNumber,due:f.due.valueAsNumber};
 if(card&&(next.billPayments||[]).some(p=>p.ref.startsWith(card.id+'@'))&&(record.closing!==card.closing||record.due!==card.due||record.currency!==card.currency))throw Error('Este cartão tem faturas pagas. Preserve moeda e datas do histórico.');
 next.cards=(next.cards||[]).filter(c=>c.id!==record.id);next.cards.push(record);
 }));
}
function editPlanPurchase(purchase){
 if(!(ledger().cards||[]).length){editPlanCard();return;}
 planEditor(purchase?'Editar compra':'Compra no cartão',[
 ['name','Descrição',{type:'text',maxLength:160,value:purchase?.name||''}],
 ['card','Cartão',{options:ledger().cards.map(c=>[c.id,c.name]),value:purchase?.card}],
 ['amount','Valor total da compra',{...amountField,value:purchase?purchase.amount/100:''}],
 ['date','Data da compra',{type:'date',value:purchase?.date||T.dateKey(new Date())}],
 ['installments','Quantidade de parcelas',{type:'number',min:1,max:120,step:1,value:purchase?.installments||1}]
 ],f=>commitFinance(next=>{
 if(purchase&&(next.billPayments||[]).some(p=>p.ref.startsWith(purchase.card+'@')))throw Error('Para corrigir esta compra, desfaça os pagamentos da fatura vinculada primeiro.');
 next.purchases=(next.purchases||[]).filter(p=>p.id!==purchase?.id);
 next.purchases.push({id:purchase?.id||crypto.randomUUID(),name:f.name.value.trim(),card:f.card.value,amount:cents(f.amount),date:f.date.value,installments:f.installments.valueAsNumber});
 }));
}
function planPayment(row){
 planEditor('Registrar pagamento',[
 ['amount','Valor pago',{...amountField,max:row.balance/100,value:row.balance/100}],
 ['date','Data do pagamento',{type:'date',value:T.dateKey(new Date())}]
 ],f=>commitFinance(next=>{
 const value=cents(f.amount),fresh=FinancePlan.occurrences(next,financeMonth).find(x=>x.ref===row.ref);
 if(!fresh||value>fresh.balance)throw Error('O valor ultrapassa o saldo pendente.');
 next.billPayments??=[];next.billPayments.push({id:crypto.randomUUID(),ref:row.ref,date:f.date.value,amount:value});
 }));
}

renderFinance=function(){
 const root=$('finance-section'),month=financeMonth||T.dateKey(new Date()).slice(0,7);
 financeMonth=month;
 const from=month+'-01',to=FinancePlan.monthDate(month,31),rows=FinancePlan.occurrences(ledger(),month),today=T.dateKey(new Date());
 const header=financeCard('Seu mês financeiro');
 const picker=financeField(header,'Mês',{type:'month',value:month});
 picker.onchange=()=>{if(picker.value){financeMonth=picker.value;renderFinance();}};
 const summaries=el('div',undefined,'finance-grid fixed-budget');
 for(const currency of T.financeCurrencies){
  const old=T.monthlyForecast(ledger(),from,to,currency);
  const current=rows.filter(r=>r.currency===currency&&r.day>=from).reduce((s,r)=>s+r.amount,0);
  const overdue=rows.filter(r=>r.currency===currency&&r.day<from).reduce((s,r)=>s+r.balance,0);
  const cost=old.fixed+old.expenses+old.payments+old.outstanding+current+overdue,balance=old.income-cost;
  if(!cost&&!old.income)continue;
  for(const [label,value,style] of [['Ganho mensal previsto',old.income,'fixed-income'],['Custo mensal total',cost,'fixed-cost'],['Saldo previsto no fim do mês',balance,balance<0?'fixed-deficit':'fixed-balance']]){
   const tile=el('section',undefined,'finance-row '+style);tile.append(el('small',label+' · '+currency),el('h3',money(value,currency)));summaries.append(tile);
  }
 }
 header.append(summaries,el('p','Ganho previsto − custo mensal total = saldo previsto. Inclui contas e faturas do mês, gastos registrados, pagamentos e parcelas de acordos. Pendências anteriores entram pelo saldo ainda devido.','smallnote'));
 const actions=el('div',undefined,'finance-actions');
 for(const [label,action] of [['Adicionar conta',()=>editPlanAccount()],['Compra no cartão',()=>editPlanPurchase()],['Adicionar cartão',()=>editPlanCard()],['Gasto avulso',()=>{const d=el('dialog',undefined,'support-dialog');d.append(addExpenseForm());const close=el('button','Fechar','secondary');close.onclick=()=>d.close();d.append(close);document.body.append(d);d.onclose=()=>d.remove();d.showModal();}]]){const b=el('button',label,'secondary');b.onclick=action;actions.append(b);}
 const list=financeCard('Contas e compromissos');
 const filter=financeField(list,'Mostrar',{options:[['all','Todas'],['pending','Pendentes'],['paid','Pagas'],['overdue','Atrasadas']],value:financeFilter});
 filter.onchange=()=>{financeFilter=filter.value;renderFinance();};
 for(const row of rows){
  const status=row.balance===0?'paid':row.day<today?'overdue':'pending';
  if(financeFilter!=='all'&&financeFilter!==status)continue;
  const article=el('article',undefined,'finance-row');
  article.append(el('strong',row.name+' · '+money(row.amount,row.currency)),el('p',dateLabel(row.day)+' · '+({week:'Semanal',month:'Mensal',once:'Única'}[row.frequency])+' · '+({paid:'Paga',pending:'Pendente',overdue:'Atrasada'}[status]),'smallnote'));
  if(row.day<from)article.append(el('p','Pendência de mês anterior','smallnote'));
  if(row.paid)article.append(el('p','Pago '+money(row.paid,row.currency)+' · Falta '+money(row.balance,row.currency)));
  if(row.balance){const pay=el('button','Registrar pagamento','primary');pay.onclick=()=>planPayment(row);article.append(pay);}
  const edit=el('button',row.kind==='card'?'Editar cartão':'Editar conta','secondary');edit.onclick=()=>row.kind==='card'?editPlanCard(row.source):editPlanAccount(row.source);article.append(edit);
  if(row.kind==='account'){
   const remove=el('button','Excluir conta','secondary');
   remove.onclick=()=>{if(confirm('Excluir esta conta e seus pagamentos?'))commitFinance(next=>{next.accounts=next.accounts.filter(a=>a.id!==row.id);next.billPayments=(next.billPayments||[]).filter(p=>!p.ref.startsWith(row.id+'@'));});};article.append(remove);
  }
  for(const payment of (ledger().billPayments||[]).filter(p=>p.ref===row.ref)){
   const undo=el('button','Desfazer '+money(payment.amount,row.currency)+' de '+dateLabel(payment.date),'secondary');
   undo.onclick=()=>{if(confirm('Desfazer este pagamento?'))commitFinance(next=>{next.billPayments=next.billPayments.filter(p=>p.id!==payment.id);});};article.append(undo);
  }
  list.append(article);
 }
 if(!rows.length)list.append(el('p','Adicione contas semanais, mensais e compras no cartão. Os acordos e gastos existentes estão abaixo.','smallnote'));
 const cards=el('details',undefined,'card');cards.append(el('summary','Cartões e compras'));
 for(const card of ledger().cards||[]){
  const line=el('p',card.name+' · fecha '+card.closing+' · vence '+card.due);
  const edit=el('button','Editar cartão','secondary');edit.onclick=()=>editPlanCard(card);const remove=el('button','Excluir cartão','secondary');
  remove.onclick=()=>{if(!confirm('Excluir este cartão?'))return;try{if((ledger().purchases||[]).some(p=>p.card===card.id))throw Error('Exclua as compras vinculadas antes de excluir o cartão.');commitFinance(next=>{next.cards=next.cards.filter(c=>c.id!==card.id);});}catch(e){toast(e.message);}};
  cards.append(line,edit,remove);
 }
 for(const purchase of ledger().purchases||[]){
  const line=el('p',purchase.name+' · '+purchase.installments+' parcelas');
  const edit=el('button','Editar compra','secondary');edit.onclick=()=>editPlanPurchase(purchase);
  const remove=el('button','Excluir compra','secondary');remove.onclick=()=>{if(!confirm('Excluir esta compra?'))return;try{if((ledger().billPayments||[]).some(p=>p.ref.startsWith(purchase.card+'@')))throw Error('Desfaça os pagamentos da fatura antes de excluir a compra.');commitFinance(next=>{next.purchases=next.purchases.filter(p=>p.id!==purchase.id);});}catch(e){toast(e.message);}};cards.append(line,edit,remove);
 }
 const existing=el('details',undefined,'card');existing.append(el('summary','Acordos, despesas e recebimentos já cadastrados'),budgetCard(),debtsCard(),addDebtForm(),expensesCard(),addExpenseForm());
 root.replaceChildren(header,actions,list,cards,existing);
};
