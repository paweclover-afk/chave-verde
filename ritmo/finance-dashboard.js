'use strict';
let personalMode='month';
let personalAnchor=Tracker.dateKey(new Date());
const originalFinanceView=renderFinance;
const personalMoney=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:ledger().dashboardCurrency||'BRL'}).format(n/100);
const personalDefaults=[
 {id:'food',name:'Alimentação',color:'#ffb347',limit:0},
 {id:'home',name:'Casa e contas',color:'#77bfff',limit:0},
 {id:'fun',name:'Lazer',color:'#c99aff',limit:0},
 {id:'care',name:'Cuidados pessoais',color:'#ff94bd',limit:0},
 {id:'other',name:'Outros',color:'#7dd9ba',limit:0}
];
function personalModel(){
 const currency=ledger().dashboardCurrency||'BRL';
 const stored=ledger().dashboards?.[currency];
 if(stored)return structuredClone(stored);
 return {categories:structuredClone(personalDefaults),entries:[],alerts:[],income:null};
}
function savePersonal(change){
 commitFinance(next=>{const model=personalModel();change(model);PersonalFinance.validate(model);next.dashboards??={};next.dashboards[next.dashboardCurrency]=model;});
}
function pfButton(text,action,style='pf-secondary'){const b=el('button',text,style);b.type='button';b.onclick=action;return b;}
function pfDialog(title,build){
 const d=el('dialog',undefined,'pf-dialog'),form=el('form'),error=el('p',undefined,'pf-error'),close=pfButton('Cancelar',()=>d.close()),submit=el('button','Salvar','pf-primary');
 submit.type='submit';error.setAttribute('role','status');
 d.append(el('h2',title),form);const callback=build(form);const recover=pfButton('Atualizar registros',()=>{try{window.RitmoCloud.recoverConflict();}catch(ex){error.textContent=ex.message;}},'pf-primary');
 recover.hidden=true;form.append(error,recover,submit,close);
 form.onsubmit=e=>{e.preventDefault();try{callback();d.close();}catch(ex){error.textContent=ex.message;if(window.RitmoCloud.blocked()){recover.hidden=false;error.textContent+=' Uma cópia das alterações locais será guardada antes de atualizar. Após a atualização, abra o gasto e refaça a alteração que estava no formulário.';}}};
 d.onclose=()=>d.remove();document.body.append(d);d.showModal();
}
function pfIncome(){
 const current=personalModel().income;
 pfDialog('Sua renda',form=>{
 const frequency=financeField(form,'Você recebe por semana ou por mês?',{options:[['week','Por semana'],['month','Por mês']],value:current?.frequency||'month'});
 const amount=financeField(form,'Quanto você ganha? ('+(ledger().dashboardCurrency==='EUR'?'EUR':'BRL')+')',{...amountField,value:current?current.amount/100:''});
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
 const amount=financeField(form,'Valor de cada cobrança ('+(ledger().dashboardCurrency==='EUR'?'EUR':'BRL')+')',{...amountField,value:row?row.amount/100:''});
 const date=financeField(form,'Data / primeiro vencimento',{type:'date',value:row?.day||personalAnchor});
 const category=financeField(form,'Categoria',{options:model.categories.map(c=>[c.id,c.name]),value:row?.category||'other'});
 const type=financeField(form,'Tipo de gasto',{options:[['once','Consumo diário / avulso'],['week','Conta fixa semanal'],['month','Conta fixa mensal']],value:entry?.frequency||'once'});

 const duration=financeField(form,'Por quanto tempo?',{options:[['forever','Sem prazo para terminar'],['count','Número de cobranças'],['end','Até uma data']],value:entry?.end?'end':entry?.count?'count':'forever'});
 const count=financeField(form,'Quantidade de cobranças',{type:'number',min:1,max:1200,step:1,value:entry?.count||10});
 const end=financeField(form,'Último vencimento permitido',{type:'date',value:entry?.end||PersonalFinance.addMonths(personalAnchor,3)});
 const paid=financeField(form,'Situação desta cobrança',{options:[['no','Prevista / a pagar'],['yes','Já foi paga']],value:row?.paid?'yes':'no'});
 const scope=row?financeField(form,'Aplicar alteração',{options:[['one','Somente esta cobrança'],['next','Esta cobrança e as próximas']],value:'one'}):null;
 const preview=el('p',undefined,'pf-preview');form.append(preview);
 const update=()=>{
 const recurring=type.value!=='once';
 for(const f of [duration]){f.parentElement.hidden=!recurring;f.required=recurring;}
 count.parentElement.hidden=!recurring||duration.value!=='count';count.required=!count.parentElement.hidden;
 end.parentElement.hidden=!recurring||duration.value!=='end';end.required=!end.parentElement.hidden;
 if(!row)paid.value=recurring?'no':'yes';
 const n=1;
 preview.textContent=personalMoney(Math.round((amount.valueAsNumber||0)*100))+(recurring?' a cada '+n+(type.value==='week'?' semana(s)':' mês(es)')+(duration.value==='count'?', por '+(count.value||0)+' cobranças':duration.value==='end'?', até '+dateLabel(end.value):', sem prazo final'):' em '+dateLabel(date.value));
 };
 for(const f of [type,duration,count,end,amount,date])f.oninput=update;update();
 return ()=>{
 const first=scope?.value==='one'?entry.start:date.value,recurring=type.value!=='once',number=recurring&&duration.value==='count'?count.valueAsNumber:recurring?0:1;
 if(scope?.value==='one'&&date.value!==row.day)throw Error('Para mudar a data inicial, escolha esta cobrança e as próximas.');
 const record={id:crypto.randomUUID(),name:name.value.trim(),amount:cents(amount),start:first,category:category.value,frequency:type.value,interval:1,count:number,overrides:{}};
 if(recurring&&duration.value==='end')record.end=end.value;
 if(record.end&&record.end<record.start)throw Error('A data final precisa ser igual ou posterior ao início.');
 if(!record.name)throw Error('Informe a descrição.');
 savePersonal(next=>{
 if(row){
  const original=next.entries.find(e=>e.id===entry.id);
  original.category=record.category;
  for(const correction of Object.values(original.overrides))delete correction.category;

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
 const limit=financeField(form,'Limite por período ('+ledger().dashboardCurrency+') — 0 para desativar',{...amountField,min:0,value:(category?.limit||0)/100});
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
 if(!model.alerts.includes(key))newKeys.push(key);
 if(level===90||total/limit<.9)warnings.push({text:label+' atingiu '+level+'% '+(personalMode==='week'?'da semana':'do mês')+' de '+dateLabel(summary.from)+' a '+dateLabel(summary.to)+'.',level,fresh:!model.alerts.includes(key)});
 }
 };
 examine('income',summary.total,summary.income,'Seu total comprometido');
 for(const category of model.categories)examine(category.id,summary.rows.filter(r=>r.category===category.id).reduce((s,r)=>s+r.amount,0),category.limit,'A categoria '+category.name);
 if(newKeys.length&&!window.RitmoCloud.blocked()){
  const updated=structuredClone(model);updated.alerts=[...updated.alerts,...newKeys].slice(-1000);const current=ledger();state.finance={...current,dashboards:{...current.dashboards,[current.dashboardCurrency]:updated}};persist();
  for(const warning of warnings.filter(w=>w.fresh))if(typeof Notification!=='undefined'&&Notification.permission==='granted'){try{new Notification('Aviso financeiro',{body:warning.text,tag:period+warning.text});}catch{}}
 }
 return warnings;
}
renderFinance=function(){
 const root=$('finance-section');
 root.classList.add('pf-app');
 if(!ledger().dashboardCurrency){
  const welcome=el('section',undefined,'pf-welcome');
  welcome.append(el('span','FINANCEIRO','pf-eyebrow'),el('h2','Seu dinheiro, com clareza.'),el('p','Escolha a moeda para começar. Sua renda e seus gastos serão organizados em semanas e meses.'));
  for(const [currency,label] of [['BRL','R$ · Real'],['EUR','€ · Euro']])welcome.append(pfButton(label,()=>commitFinance(next=>{next.dashboardCurrency=currency;next.dashboards??={};}),'pf-primary'));
  root.replaceChildren(welcome);return;
 }
 const opened=new Set(Array.from(root.querySelectorAll('details[data-category][open]'),node=>node.dataset.category)),model=personalModel(),summary=PersonalFinance.summary(model,personalMode,personalAnchor);
 root.classList.add('pf-app');
 const heading=el('div',undefined,'pf-heading');heading.append(el('div','Meu financeiro','pf-title'),pfButton(model.income?'Editar renda':'Cadastrar renda',pfIncome));
 heading.append(pfButton(ledger().dashboardCurrency==='EUR'?'€ Euro':'R$ Real',()=>pfCurrency()));
 const toolbar=el('div',undefined,'pf-toolbar');
 for(const [mode,label] of [['week','Semana'],['month','Mês']])toolbar.append(pfButton(label,()=>{personalMode=mode;renderFinance();},personalMode===mode?'pf-primary':'pf-secondary'));

 toolbar.append(pfButton('← Anterior',()=>{personalAnchor=personalMode==='week'?PersonalFinance.addDays(personalAnchor,-7):PersonalFinance.addMonths(personalAnchor.slice(0,7)+'-01',-1);renderFinance();}),pfButton('Próximo →',()=>{personalAnchor=personalMode==='week'?PersonalFinance.addDays(personalAnchor,7):PersonalFinance.addMonths(personalAnchor.slice(0,7)+'-01',1);renderFinance();}));
 const periodLabel=el('p',(personalMode==='week'?'Semana de ':'Mês de ')+dateLabel(summary.from)+(personalMode==='week'?' a '+dateLabel(summary.to):''),'pf-note');
 toolbar.append(periodLabel);
 const planning=personalMode==='week'?PersonalFinance.weeklyPlan(model,personalAnchor):summary;
 const dashboard=el('section',undefined,'pf-dashboard');
 for(const [label,value,cls] of [['Renda prevista',summary.income,'income'],[personalMode==='week'?'Gastos + reserva mensal':'Gastos e contas',planning.total,'cost'],['Sobra prevista',planning.balance,planning.balance<0?'negative':'balance']]){
  const tile=el('article',undefined,'pf-metric pf-metric-'+cls);tile.append(el('small',label),el('strong',personalMoney(value)));dashboard.append(tile);
 }
 if(personalMode==='week')dashboard.append(el('p','O saldo semanal desconta os gastos da semana e a reserva proporcional das contas mensais (mensal × 12 ÷ 52).','pf-note pf-plan-note'));
 const followingAnchor=PersonalFinance.addMonths(personalAnchor.slice(0,7)+'-01',1),following=PersonalFinance.summary(model,'month',followingAnchor);
 const future=el('section',undefined,'pf-future');future.append(el('strong','Próximo mês · '+followingAnchor.slice(0,7).split('-').reverse().join('/')),el('p','Renda '+personalMoney(following.income)+' · Comprometido '+personalMoney(following.total)+' · Saldo '+personalMoney(following.balance)));
 const progress=el('progress');progress.max=100;progress.value=summary.income?Math.min(100,planning.total/planning.income*100):0;progress.setAttribute('aria-label','Percentual da renda comprometida');future.append(progress,el('small',summary.income?Math.round(planning.total/planning.income*100)+'% da renda comprometida no período selecionado':'Cadastre sua renda para calcular a proporção.'));
 const reserve=PersonalFinance.weeklyReserve(model,personalAnchor),saving=el('section',undefined,'pf-future pf-reserve');
 saving.append(el('strong','Quanto guardar por semana'),el('h2',personalMoney(reserve.weekly)),el('p','Reserva estimada para as contas mensais do mês consultado. Valor mensal × 12 ÷ 52, arredondado para cima nos centavos.','pf-note'));
 for(const bill of reserve.bills){
  const line=el('div',undefined,'pf-line');line.append(el('span',bill.name+' · '+personalMoney(bill.monthly)+'/mês'),el('strong',personalMoney(bill.weekly)+'/semana'));saving.append(line);
 }
 if(!reserve.bills.length)saving.append(el('p','Cadastre uma conta mensal, como aluguel, para calcular sua reserva.','pf-note'));
 saving.append(el('p','O vencimento continua entrando no total do período. Esta reserva serve para planejar o dinheiro a guardar.','pf-note'));
 const alerts=el('div');for(const warning of pfAlerts(model,planning)){const item=el('p',warning.text,'pf-warning pf-level-'+warning.level);item.setAttribute('role','alert');alerts.append(item);}
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
 advanced.append(el('p','Este dashboard mantém um cadastro por moeda. Consulte os registros anteriores no histórico.','pf-note'));
 advanced.append(pfButton('Consultar histórico anterior',()=>{root.classList.remove('pf-app');originalFinanceView();const back=pfButton('Voltar ao novo resumo',()=>renderFinance(),'pf-primary');root.prepend(back);}));
 if(typeof Notification!=='undefined')advanced.append(pfButton('Ativar notificações neste dispositivo',async()=>{try{const permission=await Notification.requestPermission();toast(permission==='granted'?'Notificações autorizadas.':'Os avisos continuam disponíveis dentro do app.');}catch{toast('Este navegador usa os avisos dentro do app.');}}));
 root.replaceChildren(heading,toolbar,alerts,dashboard,add,saving,future,categories,advanced);
};function pfCurrency(){
 pfDialog('Moeda do dashboard',form=>{
  const currency=financeField(form,'Trabalhar com',{options:[['BRL','Real (R$)'],['EUR','Euro (€)']],value:ledger().dashboardCurrency});
  form.append(el('p','Cada moeda mantém seus próprios valores. A troca abre o cadastro correspondente.','pf-note'));
  return ()=>commitFinance(next=>{next.dashboardCurrency=currency.value;});
 });
}
