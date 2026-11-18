'use strict';
function editSimpleIncome(){
 const existing=(ledger().salary||[]).filter(r=>r.from<=financeMonth+'-01').at(-1);
 planEditor('Renda prevista',[
 ['frequency','Como recebe?',{options:[['week','Por semana (aproximado)'],['month','Por mês']],value:existing?.frequency||'week'}],
 ['amount','Valor líquido recebido',{...amountField,value:existing?existing.amount/100:''}],
 ['currency','Moeda',{options:currencyOptions,value:existing?.currency||'GBP'}],
 ['month','A partir do mês',{type:'month',value:financeMonth}]
 ],f=>commitFinance(next=>{
  const from=f.month.value+'-01';
  next.salary=(next.salary||[]).filter(r=>r.currency!==f.currency.value||r.from!==from);
  next.salary.push({id:crypto.randomUUID(),amount:cents(f.amount),currency:f.currency.value,frequency:f.frequency.value,from});
 }));
}
const simpleCategories=['Alimentação','Café','Roupas','Unhas','Lazer','Cinema','Celular','Moradia','Transporte','Suplementos','Outros'];
function editSimpleSpending(existing){
 const parts=existing?.installments||1;
 const dialog=el('dialog',undefined,'support-dialog'),form=el('form'),heading=el('h2',existing?'Editar gasto':'Adicionar gasto');
 dialog.append(heading,form);
 const name=financeField(form,'Descrição',{type:'text',maxLength:160,value:existing?.name||''});
 const amount=financeField(form,'Valor',{...amountField,value:existing?existing.amount/100:''});
 const basis=financeField(form,'Esse valor é',{options:[['total','Total da compra'],['part','Valor de cada parcela']]});
 const date=financeField(form,'Data da compra / primeira parcela',{type:'date',value:existing?.date||T.dateKey(new Date())});
 const category=financeField(form,'Categoria',{options:simpleCategories.map(x=>[x,x]),value:existing?.category||'Alimentação'});
 const method=financeField(form,'Forma de pagamento',{options:[['card','Cartão de crédito'],['debit','Cartão de débito'],['pix','Pix'],['cash','Dinheiro'],['other','Outro']],value:existing?.method||'cash'});
 const currency=financeField(form,'Moeda',{options:currencyOptions,value:existing?.currency||'GBP'});
 const frequency=financeField(form,'Pagamento',{options:[['once','À vista / já pago'],['month','Parcelas mensais'],['week','Parcelas semanais']],value:existing?.frequency||'once'});
 const count=financeField(form,'Quantidade de parcelas',{type:'number',min:1,max:1200,step:1,value:parts});
 const note=el('p','A data define o primeiro vencimento. Se já cadastrou esta compra nas faturas do cartão, edite o registro existente para evitar duplicidade.','smallnote');
 const toggle=()=>{count.parentElement.hidden=frequency.value==='once';basis.parentElement.hidden=frequency.value==='once';};
 frequency.onchange=toggle;toggle();
 const submit=el('button','Salvar gasto','primary'),cancel=el('button','Cancelar','secondary');
 submit.type='submit';cancel.type='button';cancel.onclick=()=>dialog.close();form.append(note,submit,cancel);
 form.onsubmit=e=>{e.preventDefault();try{
  const installments=frequency.value==='once'?1:count.valueAsNumber;
  let value=cents(amount);
  if(frequency.value!=='once'&&basis.value==='part')value*=installments;
  commitFinance(next=>{
   if(existing&&(next.billPayments||[]).some(p=>p.ref.startsWith(existing.id+'@')))throw Error('Desfaça os pagamentos vinculados antes de corrigir as parcelas.');
   next.spending=(next.spending||[]).filter(p=>p.id!==existing?.id);
   next.spending.push({id:existing?.id||crypto.randomUUID(),name:name.value.trim(),amount:value,date:date.value,category:category.value,method:method.value,currency:currency.value,frequency:frequency.value,installments});
  });dialog.close();
 }catch(error){toast(error.message);}};
 dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
}
function financeReceipt(month,rows){
 const receipt=el('section',undefined,'finance-receipt'),from=month+'-01',to=FinancePlan.monthDate(month,31);
 const heading=el('h3','SEU CUPOM DO MÊS');receipt.append(heading,el('p',month.split('-').reverse().join('/'),'receipt-date'));
 const incomes=FinancePlan.incomeTotal(ledger(),month,c=>T.cashSummary(ledger(),from,to,c).income);
 const today=T.dateKey(new Date());
 for(const currency of T.financeCurrencies){
  const old=T.monthlyForecast(ledger(),from,to,currency),current=rows.filter(r=>r.currency===currency&&r.day>=from),late=rows.filter(r=>r.currency===currency&&r.day<from);
  const newCost=current.reduce((s,r)=>s+r.amount,0),overdue=late.reduce((s,r)=>s+r.balance,0);
  const total=old.fixed+old.expenses+old.payments+old.outstanding+newCost+overdue,income=incomes[currency],balance=income-total;
  if(!total&&!income)continue;
  const paid=old.expenses+old.payments+current.reduce((s,r)=>s+Math.min(r.paid,r.amount),0);
  const registered=old.expenses+old.payments+current.filter(r=>r.kind==='spending').reduce((s,r)=>s+r.amount,0);
  const day=(ledger().expenses||[]).filter(e=>e.currency===currency&&e.date===today&&today.startsWith(month)).reduce((s,e)=>s+e.amount,0)+current.filter(r=>r.kind==='spending'&&r.day===today).reduce((s,r)=>s+r.amount,0);
  const lines=[['RENDA PREVISTA',income],['Gastos de hoje (incluídos abaixo)',day],['Contas fixas',old.fixed+current.filter(r=>r.kind==='account').reduce((s,r)=>s+r.amount,0)],['Compras e parcelas',old.expenses+old.payments+old.outstanding+current.filter(r=>r.kind!=='account').reduce((s,r)=>s+r.amount,0)],['Atrasos anteriores',overdue],['TOTAL DE DESPESAS',total],['Já pago neste mês',paid],['Ainda previsto',Math.max(0,total-paid)],['SALDO ESTIMADO',balance]];
  for(const [label,value] of lines){const line=el('div',undefined,'receipt-line'+(label==='SALDO ESTIMADO'?' receipt-total '+(balance<0?'receipt-negative':''):''));line.append(el('span',label),el('strong',money(value,currency)));receipt.append(line);}
  if(income&&registered/income>=.7){
   const level=registered/income>=.9?90:70;
   receipt.append(el('p','Atenção: gastos registrados atingiram '+level+'% da renda '+currency+'.','receipt-warning'));
  }
 }
 receipt.append(el('p','Valores estimados. Contas e parcelas entram no mês do vencimento. Atrasos anteriores entram pelo saldo pendente.','smallnote'));
 return receipt;
}
const checkingFinanceAlerts=new Set();
async function checkFinanceThresholds(month,rows){
 if(month!==T.dateKey(new Date()).slice(0,7))return;
 const from=month+'-01',to=FinancePlan.monthDate(month,31);
 const income=FinancePlan.incomeTotal(ledger(),month,c=>T.cashSummary(ledger(),from,to,c).income);
 for(const currency of T.financeCurrencies){
  if(!income[currency])continue;
  const old=T.cashSummary(ledger(),from,to,currency);
  const registered=old.expenses+old.payments+rows.filter(r=>r.currency===currency&&r.day.startsWith(month)&&r.kind==='spending').reduce((sum,r)=>sum+r.amount,0);
  for(const level of [70,90]){
   if(registered/income[currency]<level/100)continue;
   const key=month+currency+level;
   if(checkingFinanceAlerts.has(key))continue;
   checkingFinanceAlerts.add(key);
   try{
    const response=await fetch('/api/ritmo?action=finance-alert',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({month,currency,level})});
    if(!response.ok)throw Error('Alerta indisponível');
    const result=await response.json();
    if(result.show){
     const warning=el('p','Atenção: seus gastos registrados atingiram '+level+'% da renda prevista em '+currency+'.','receipt-warning');
     warning.setAttribute('role','alert');
     $('finance-section').prepend(warning);
    }
   }catch{checkingFinanceAlerts.delete(key);}
  }
 }
}
