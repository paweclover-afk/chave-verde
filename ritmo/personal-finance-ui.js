'use strict';
let personalMode='month';
let personalAnchor=T.dateKey(new Date());
const originalFinanceView=renderFinance;
const personalMoney=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
const personalDefaults=[
 {id:'food',name:'Alimentação',color:'#ffb347',limit:0},
 {id:'home',name:'Casa e contas',color:'#77bfff',limit:0},
 {id:'fun',name:'Lazer',color:'#c99aff',limit:0},
 {id:'care',name:'Cuidados pessoais',color:'#ff94bd',limit:0},
 {id:'other',name:'Outros',color:'#7dd9ba',limit:0}
];
function personalModel(){
 if(ledger().personal)return structuredClone(ledger().personal);
 const model={categories:structuredClone(personalDefaults),entries:[],alerts:[],income:null};
 const old=ledger(),payments=old.billPayments||[];
 const push=(id,name,amount,start,frequency,count,category='other',overrides={})=>{
  model.entries.push({id,name,amount,start,frequency,count,category,interval:1,overrides});
 };
 for(const expense of old.expenses.filter(e=>e.currency==='BRL'))push('expense-'+expense.id,expense.name,expense.amount,expense.date,'once',1);
 for(const a of (old.accounts||[]).filter(e=>e.currency==='BRL')){
  const overrides={};
  for(const row of FinancePlan.occurrences({...old,accounts:[a],cards:[],spending:[]},PersonalFinance.addMonths(personalAnchor,120).slice(0,7))){
   if(row.paid>=row.amount)overrides[row.day]={paid:true};
  }
  push('account-'+a.id,a.name,a.amount,a.start,a.frequency,a.installments||0,'home',overrides);
  if(a.end)model.entries.at(-1).end=a.end;
 }
 for(const purchase of (old.spending||[]).filter(e=>e.currency==='BRL')){
  const total=purchase.frequency==='once'?1:purchase.installments,base=Math.floor(purchase.amount/total),overrides={};
  for(let i=0;i<total;i++){
   const day=purchase.frequency==='month'?PersonalFinance.addMonths(purchase.date,i):purchase.frequency==='week'?PersonalFinance.addDays(purchase.date,i*7):purchase.date;
   const amount=base+(i<purchase.amount%total?1:0),paid=payments.filter(p=>p.ref===purchase.id+'@'+day).reduce((s,p)=>s+p.amount,0);
   overrides[day]={amount,paid:purchase.frequency==='once'||paid>=amount};
  }
  push('purchase-'+purchase.id,purchase.name,Math.max(1,base),purchase.date,purchase.frequency,total,'other',overrides);
 }
 for(const bill of (old.fixedBills||[]).filter(e=>e.currency==='BRL')){
  push('fixed-'+bill.id,bill.name,bill.amount,bill.from,'month',0,'home');
  if(bill.to)model.entries.at(-1).end=bill.to;
 }
 for(const debt of old.debts.filter(d=>d.currency==='BRL')){
  let due=T.debtDue(debt),projected=0,index=0;
  while(due&&index<1200){
   push('debt-'+debt.id+'-'+index,debt.name,due.due,due.day,'month',1,'home');
   projected+=due.due;due=T.debtDue(debt,projected);index++;
  }
 }
 const cardRows=FinancePlan.occurrences({...old,accounts:[],spending:[]},PersonalFinance.addMonths(personalAnchor,120).slice(0,7));
 for(const row of cardRows.filter(r=>r.currency==='BRL'))push('invoice-'+row.ref,row.name,row.amount,row.day,'month',1,'other',{[row.day]:{paid:row.balance===0}});
 const income=(old.salary||[]).filter(r=>r.currency==='BRL'&&r.from<=personalAnchor).sort((a,b)=>a.from.localeCompare(b.from)).at(-1);
 const weekly=(old.income||[]).filter(r=>r.currency==='BRL'&&r.from<=personalAnchor).sort((a,b)=>a.from.localeCompare(b.from)).at(-1);
 if(income)model.income={amount:income.amount,frequency:income.frequency};else if(weekly)model.income={amount:weekly.amount,frequency:'week'};
 return model;
}
function savePersonal(change){
 commitFinance(next=>{const model=personalModel();change(model);PersonalFinance.validate(model);next.personal=model;});
}
function pfButton(text,action,style='pf-secondary'){const b=el('button',text,style);b.type='button';b.onclick=action;return b;}
function pfDialog(title,build){
 const d=el('dialog',undefined,'pf-dialog'),form=el('form'),error=el('p',undefined,'pf-error'),close=pfButton('Cancelar',()=>d.close()),submit=el('button','Salvar','pf-primary');
 submit.type='submit';error.setAttribute('role','status');
 d.append(el('h2',title),form);const callback=build(form);form.append(error,submit,close);
 form.onsubmit=e=>{e.preventDefault();try{callback();d.close();}catch(ex){error.textContent=ex.message;}};
 d.onclose=()=>d.remove();document.body.append(d);d.showModal();
}
function pfIncome(){
 const current=personalModel().income;
 pfDialog('Sua renda',form=>{
 const frequency=financeField(form,'Você recebe por semana ou por mês?',{options:[['week','Por semana'],['month','Por mês']],value:current?.frequency||'month'});
 const amount=financeField(form,'Quanto você ganha? (R$)',{...amountField,value:current?current.amount/100:''});
 const preview=el('p',undefined,'pf-note');form.append(preview);
 const update=()=>{const n=Math.round((amount.valueAsNumber||0)*100);preview.textContent=frequency.value==='week'?'Estimativa mensal: '+personalMoney(Math.round(n*52/12)):'Estimativa semanal: '+personalMoney(Math.round(n*12/52));};
 amount.oninput=frequency.onchange=update;update();
 return ()=>savePersonal(model=>{model.income={frequency:frequency.value,amount:cents(amount)};});
 });
}
function pfExpense(row){
 const model=personalModel(),entry=row?.source;
 pfDialog(row?'Editar gasto':'Adicionar gasto',form=>{
 const name=financeField(form,'Descrição',{type:'text',maxLength:160,value:row?.name||''});
 const amount=financeField(form,'Valor de cada cobrança (R$)',{...amountField,value:row?row.amount/100:''});
 const date=financeField(form,'Data / primeiro vencimento',{type:'date',value:row?.day||personalAnchor});
 const category=financeField(form,'Categoria',{options:model.categories.map(c=>[c.id,c.name]),value:row?.category||'other'});
 const type=financeField(form,'Tipo de gasto',{options:[['once','Consumo diário / avulso'],['week','Conta fixa semanal'],['month','Conta fixa mensal']],value:entry?.frequency||'once'});
 const interval=financeField(form,'Repetir a cada quantas semanas ou meses?',{type:'number',min:1,max:120,step:1,value:entry?.interval||1});
 const duration=financeField(form,'Por quanto tempo?',{options:[['forever','Sem prazo para terminar'],['count','Número de cobranças'],['end','Até uma data']],value:entry?.end?'end':entry?.count?'count':'forever'});
 const count=financeField(form,'Quantidade de cobranças',{type:'number',min:1,max:1200,step:1,value:entry?.count||10});
 const end=financeField(form,'Último vencimento permitido',{type:'date',value:entry?.end||PersonalFinance.addMonths(personalAnchor,3)});
 const paid=financeField(form,'Situação desta cobrança',{options:[['no','Prevista / a pagar'],['yes','Já foi paga']],value:row?.paid?'yes':'no'});
 const scope=row?financeField(form,'Aplicar alteração',{options:[['one','Somente esta cobrança'],['next','Esta cobrança e as próximas']],value:'one'}):null;
 const preview=el('p',undefined,'pf-preview');form.append(preview);
 const update=()=>{
 const recurring=type.value!=='once';
 for(const f of [interval,duration]){f.parentElement.hidden=!recurring;f.required=recurring;}
 count.parentElement.hidden=!recurring||duration.value!=='count';count.required=!count.parentElement.hidden;
 end.parentElement.hidden=!recurring||duration.value!=='end';end.required=!end.parentElement.hidden;
 if(!row)paid.value=recurring?'no':'yes';
 const n=interval.valueAsNumber||1;
 preview.textContent=personalMoney(Math.round((amount.valueAsNumber||0)*100))+(recurring?' a cada '+n+(type.value==='week'?' semana(s)':' mês(es)')+(duration.value==='count'?', por '+(count.value||0)+' cobranças':duration.value==='end'?', até '+dateLabel(end.value):', sem prazo final'):' em '+dateLabel(date.value));
 };
 for(const f of [type,interval,duration,count,end,amount,date])f.oninput=update;update();
 return ()=>{
 const first=scope?.value==='one'?entry.start:date.value,recurring=type.value!=='once',number=recurring&&duration.value==='count'?count.valueAsNumber:recurring?0:1;
 if(scope?.value==='one'&&date.value!==row.day)throw Error('Para mudar a data inicial, escolha esta cobrança e as próximas.');
 const record={id:crypto.randomUUID(),name:name.value.trim(),amount:cents(amount),start:first,category:category.value,frequency:type.value,interval:recurring?interval.valueAsNumber:1,count:number,overrides:{}};
 if(recurring&&duration.value==='end')record.end=end.value;
 if(record.end&&record.end<record.start)throw Error('A data final precisa ser igual ou posterior ao início.');
 if(!record.name)throw Error('Informe a descrição.');
 savePersonal(next=>{
 if(row){
  const original=next.entries.find(e=>e.id===entry.id);
  if(scope.value==='one'){original.overrides[row.day]={...original.overrides[row.day],name:record.name,amount:record.amount,category:record.category,paid:paid.value==='yes'};return;}
  if(record.start<row.day)throw Error('A nova sequência precisa começar nesta cobrança ou depois dela.');
  original.end=PersonalFinance.addDays(row.day,-1);
  if(original.end<original.start)next.entries=next.entries.filter(e=>e.id!==original.id);
 }
 record.overrides[record.start]={paid:paid.value==='yes'};
 next.entries.push(record);
 });
 };
 });
}
function pfCategory(category){
 pfDialog(category?'Editar categoria':'Nova categoria',form=>{
 const name=financeField(form,'Nome',{type:'text',maxLength:80,value:category?.name||''});
 const color=financeField(form,'Cor',{type:'color',value:category?.color||'#77bfff'});
 const limit=financeField(form,'Limite por período (R$) — 0 para desativar',{...amountField,min:0,value:(category?.limit||0)/100});
 return ()=>savePersonal(model=>{
 const record={id:category?.id||crypto.randomUUID(),name:name.value.trim(),color:color.value,limit:Math.round(limit.valueAsNumber*100)};
 if(!record.name)throw Error('Informe o nome.');
 model.categories=model.categories.filter(c=>c.id!==record.id);model.categories.push(record);
 });
 });
}
function pfRemove(row){
 pfDialog('Excluir gasto',form=>{
 const scope=financeField(form,'O que excluir?',{options:[['one','Somente esta cobrança'],['next','Esta cobrança e as próximas']]});
 form.append(el('p','Confirme em Salvar para excluir.','pf-note'));
 return ()=>savePersonal(model=>{
 const entry=model.entries.find(e=>e.id===row.source.id);
 if(scope.value==='one')entry.overrides[row.day]={...entry.overrides[row.day],deleted:true};
 else{entry.end=PersonalFinance.addDays(row.day,-1);if(entry.end<entry.start)model.entries=model.entries.filter(e=>e.id!==entry.id);}
 });
 });
}
function pfAlerts(model,summary){
 const period=personalMode+':'+summary.from;
 const warnings=[],newKeys=[];
 const examine=(scope,total,limit,label)=>{
 if(!limit)return;
 for(const level of [80,90])if(total/limit>=level/100){
 const key=period+':'+scope+':'+level;
 if(!model.alerts.includes(key)){newKeys.push(key);warnings.push({text:label+' atingiu '+level+'% no período de '+dateLabel(summary.from)+' a '+dateLabel(summary.to)+'.',level});}
 }
 };
 examine('income',summary.total,summary.income,'Seu total comprometido');
 for(const category of model.categories)examine(category.id,summary.rows.filter(r=>r.category===category.id).reduce((s,r)=>s+r.amount,0),category.limit,'A categoria '+category.name);
 if(newKeys.length&&!window.RitmoCloud.blocked()){
  const updated=structuredClone(model);updated.alerts=[...updated.alerts,...newKeys].slice(-1000);state.finance={...ledger(),personal:updated};persist();
  for(const warning of warnings)if(typeof Notification!=='undefined'&&Notification.permission==='granted'){try{new Notification('Aviso financeiro',{body:warning.text,tag:period+warning.text});}catch{}}
 }
 return warnings;
}
renderFinance=function(){
 const root=$('finance-section'),opened=new Set(Array.from(root.querySelectorAll('details[data-category][open]'),node=>node.dataset.category)),model=personalModel(),summary=PersonalFinance.summary(model,personalMode,personalAnchor);
 root.classList.add('pf-app');
 const heading=el('div',undefined,'pf-heading');heading.append(el('div','Meu dinheiro','pf-title'),pfButton(model.income?'Editar renda':'Cadastrar renda',pfIncome));
 const toolbar=el('div',undefined,'pf-toolbar');
 for(const [mode,label] of [['week','Semana'],['month','Mês']])toolbar.append(pfButton(label,()=>{personalMode=mode;renderFinance();},personalMode===mode?'pf-primary':'pf-secondary'));
 const date=financeField(toolbar,'Consultar data',{type:'date',value:personalAnchor});date.onchange=()=>{if(date.value){personalAnchor=date.value;renderFinance();}};
 const receipt=el('section',undefined,'pf-receipt');receipt.append(el('h2','SEU CUPOM '+(personalMode==='week'?'DA SEMANA':'DO MÊS')),el('p',dateLabel(summary.from)+' a '+dateLabel(summary.to),'pf-receipt-date'));
 for(const [label,value,style] of [['Renda '+(model.income?.frequency!==personalMode?'estimada':'informada'),summary.income,'pf-income'],['Gastos avulsos',summary.spent,''],['Contas fixas previstas',summary.fixed,''],['TOTAL COMPROMETIDO',summary.total,'pf-committed'],['Já pago',summary.paid,''],['Ainda a pagar',summary.total-summary.paid,''],['SALDO DISPONÍVEL',summary.balance,summary.balance<0?'pf-negative':'pf-positive']]){
 const line=el('div',undefined,'pf-line '+style);line.append(el('span',label),el('strong',personalMoney(value)));receipt.append(line);
 }
 receipt.append(el('p','Projeção: semana × 52 ÷ 12 ou mês × 12 ÷ 52. Contas pagas entram uma vez no total.','pf-note'));
 const alerts=el('div');for(const warning of pfAlerts(model,summary)){const item=el('p',warning.text,'pf-warning pf-level-'+warning.level);item.setAttribute('role','alert');alerts.append(item);}
 const add=pfButton('+ Adicionar gasto',()=>pfExpense(),'pf-primary pf-add');
 const categories=el('section',undefined,'pf-categories');categories.append(el('h2','Por categoria'));
 for(const category of model.categories){
 const rows=summary.rows.filter(r=>r.category===category.id),total=rows.reduce((s,r)=>s+r.amount,0),card=el('details',undefined,'pf-category');card.style.setProperty('--category',category.color);card.dataset.category=category.id;card.open=opened.has(category.id);
 const title=el('summary');title.append(el('strong',category.name),el('span',personalMoney(total)+' · '+(summary.income?Math.round(total/summary.income*100)+'% da renda':'Cadastre sua renda')));
 card.append(title,pfButton('Editar categoria',()=>pfCategory(category)));
 if(category.limit)card.append(el('p','Limite do período: '+personalMoney(category.limit),'pf-note'));
 for(const row of rows){
 const item=el('article',undefined,'pf-item');item.append(el('strong',row.name),el('p',dateLabel(row.day)+' · '+personalMoney(row.amount)+' · '+(row.paid?'Pago':'A pagar')));
 item.append(pfButton('Editar',()=>pfExpense(row)),pfButton('Excluir',()=>pfRemove(row)),pfButton(row.paid?'Desmarcar pagamento':'Marcar como pago',()=>savePersonal(next=>{const e=next.entries.find(e=>e.id===row.source.id);e.overrides[row.day]={...e.overrides[row.day],paid:!row.paid};})));
 card.append(item);
 }
 if(!rows.length)card.append(el('p','Sem gastos neste período.','pf-note'));categories.append(card);
 }
 categories.append(pfButton('+ Nova categoria',()=>pfCategory()));
 const advanced=el('details',undefined,'pf-help');advanced.append(el('summary','Histórico anterior e notificações'));
 advanced.append(el('p','Valores em reais nesta área. Os registros anteriores em outras moedas continuam disponíveis no histórico.','pf-note'));
 advanced.append(pfButton('Consultar histórico anterior',()=>{root.classList.remove('pf-app');originalFinanceView();const back=pfButton('Voltar ao novo resumo',()=>renderFinance(),'pf-primary');root.prepend(back);}));
 if(typeof Notification!=='undefined')advanced.append(pfButton('Ativar notificações neste dispositivo',async()=>{try{const permission=await Notification.requestPermission();toast(permission==='granted'?'Notificações autorizadas.':'Os avisos continuam disponíveis dentro do app.');}catch{toast('Este navegador usa os avisos dentro do app.');}}));
 root.replaceChildren(heading,toolbar,alerts,receipt,add,categories,advanced);
};
