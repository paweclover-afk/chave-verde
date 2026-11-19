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
function financeReceipt(month,rows,period){
 const receipt=el('section',undefined,'finance-receipt'),from=period?.from||month+'-01',to=period?.to||FinancePlan.monthDate(month,31);
 const heading=el('h3',receiptMode==='week'?'SEU CUPOM DA SEMANA':'SEU CUPOM DO MÊS');receipt.append(heading,el('p',dateLabel(from)+' a '+dateLabel(to),'receipt-date'));
 const incomes=FinancePlan.periodIncome(ledger(),from,to,(day,c)=>T.cashSummary(ledger(),day,day,c).income);
 const today=T.dateKey(new Date());
 for(const currency of T.financeCurrencies){
  const forecast=T.monthlyForecast(ledger(),from,to,currency);
  const fixed=(ledger().fixedBills||[]).filter(b=>b.currency===currency).reduce((sum,b)=>{const due=FinancePlan.monthDate(from.slice(0,7),Number(b.from.slice(8)));return sum+(b.from<=due&&(!b.to||b.to>=due)&&due>=from&&due<=to?b.amount:0);},0);
  const old={...forecast,fixed};
  const current=rows.filter(r=>r.currency===currency&&r.day>=from&&r.day<=to),late=rows.filter(r=>r.currency===currency&&r.day<from);
  const newCost=current.reduce((s,r)=>s+r.amount,0),overdue=late.reduce((s,r)=>s+r.balance,0);
  const total=old.fixed+old.expenses+old.payments+old.outstanding+newCost+overdue,income=incomes[currency],balance=income-total;
  if(!total&&!income)continue;
  const paid=old.expenses+old.payments+current.reduce((s,r)=>s+Math.min(r.paid,r.amount),0);
  const registered=old.expenses+old.payments+current.filter(r=>r.kind==='spending').reduce((s,r)=>s+r.amount,0);
  const day=(ledger().expenses||[]).filter(e=>e.currency===currency&&e.date===today&&today>=from&&today<=to).reduce((s,e)=>s+e.amount,0)+current.filter(r=>r.kind==='spending'&&r.day===today).reduce((s,r)=>s+r.amount,0);
  const lines=[['RENDA PREVISTA',income],['Gastos de hoje (incluídos abaixo)',day],['Contas fixas',old.fixed+current.filter(r=>r.kind==='account').reduce((s,r)=>s+r.amount,0)],['Compras e parcelas',old.expenses+old.payments+old.outstanding+current.filter(r=>r.kind!=='account').reduce((s,r)=>s+r.amount,0)],['Atrasos anteriores',overdue],['TOTAL DE DESPESAS',total],['Já pago no período',paid],['Ainda previsto',Math.max(0,total-paid)],['SALDO ESTIMADO',balance]];
  for(const [label,value] of lines){const line=el('div',undefined,'receipt-line'+(label==='SALDO ESTIMADO'?' receipt-total '+(balance<0?'receipt-negative':''):''));line.append(el('span',label),el('strong',money(value,currency)));receipt.append(line);}
  if(receiptMode==='month'&&income&&registered/income>=.7){
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
    const result={show:true};
    if(result.show){
     const warning=el('p','Atenção: seus gastos registrados atingiram '+level+'% da renda prevista em '+currency+'.','receipt-warning');
     warning.setAttribute('role','alert');
     $('finance-section').prepend(warning);
    }
   }catch{checkingFinanceAlerts.delete(key);}
  }
 }
}
let receiptMode='month';
let receiptStart='';
let receiptEnd='';
function financePeriodControls(parent,month){
 const mode=financeField(parent,'Ver cupom',{options:[['month','Mês'],['week','Semana']],value:receiptMode});
 mode.onchange=()=>{receiptMode=mode.value;receiptStart='';receiptEnd='';renderFinance();};
 let from=month+'-01',to=FinancePlan.monthDate(month,31);
 if(receiptMode==='week'){
  const today=T.dateKey(new Date());
  const anchor=today.startsWith(month)?today:from;
  const day=new Date(anchor+'T12:00:00Z');
  day.setUTCDate(day.getUTCDate()-(day.getUTCDay()-5+7)%7);
  from=receiptStart||day.toISOString().slice(0,10);
  const end=new Date(from+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+6);
  to=receiptEnd||end.toISOString().slice(0,10);
  const startField=financeField(parent,'Início da semana',{type:'date',value:from});
  const endField=financeField(parent,'Fechamento da semana',{type:'date',value:to});
  startField.onchange=()=>{
   if(!startField.value)return;
   receiptStart=startField.value;
   const d=new Date(receiptStart+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+6);receiptEnd=d.toISOString().slice(0,10);
   renderFinance();
  };
  endField.onchange=()=>{
   if(!endField.value||endField.value<from||endField.value>FinancePlan.monthDate(FinancePlan.nextMonth(from.slice(0,7),1),31)){toast('Escolha um fechamento após o início, até o próximo mês.');return;}
   receiptStart=from;receiptEnd=endField.value;renderFinance();
  };
  parent.append(el('p','Por padrão, a semana vai de sexta a quinta. Ajuste o início e o fechamento conforme seu recebimento.','smallnote'));
 }
 return {from,to};
}
function editDailyCost(existing){
 planEditor(existing?'Editar custo do dia':'Custo de hoje',[
 ['name','Nome',{type:'text',maxLength:160,value:existing?.name||''}],
 ['amount','Valor',{...amountField,value:existing?existing.amount/100:''}],
 ['date','Data',{type:'date',value:existing?.date||T.dateKey(new Date())}],
 ['category','Categoria',{options:simpleCategories.map(x=>[x,x]),value:existing?.category||'Café'}],
 ['method','Pagamento',{options:[['cash','Dinheiro'],['pix','Pix'],['debit','Débito'],['card','Cartão'],['other','Outro']],value:existing?.method||'cash'}],
 ['currency','Moeda',{options:currencyOptions,value:existing?.currency||'EUR'}]
 ],f=>commitFinance(next=>{
 next.spending=(next.spending||[]).filter(x=>x.id!==existing?.id);
 next.spending.push({id:existing?.id||crypto.randomUUID(),name:f.name.value.trim(),amount:cents(f.amount),date:f.date.value,category:f.category.value,method:f.method.value,currency:f.currency.value,frequency:'once',installments:1});
 }));
}
