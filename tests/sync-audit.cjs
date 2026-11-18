const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const merge=require('../ritmo/sync-merge.js');
const finance=require('../ritmo/personal-finance.js');

async function cloudHarness(statusCode){
 const elements=new Map(),storage=new Map();let requests=0,loads=0;
 const document={addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{dataset:{}});return elements.get(id);},createElement(tag){const children=new Map();return {tag,setAttribute(){},append(...nodes){for(const node of nodes)children.set(node.tag,node);},querySelector(tag){return children.get(tag);}};},body:{append(){}}};
 const ctx={document,window:{addEventListener(){}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},setTimeout(){},clearTimeout(){},setInterval(){},structuredClone,crypto:require('node:crypto').webcrypto,URL,Date,Tracker:{financeDay:'2000-01-01'},RitmoMerge:merge,fetch:async(url)=>{
  if(url.endsWith('load'))return {ok:true,json:async()=>({user:{id:'test',email:'test@example.invalid'},plan:{workouts:[]},days:[{day:'2026-11-18',revision:++loads+1,payload:{water:loads===1?9:10}}]})};
  if(url.endsWith('message'))return {ok:true,json:async()=>({message:null})};
  requests++;return {ok:false,status:statusCode,json:async()=>({error:'Valor inválido de teste'})};
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../ritmo/cloud.js'),'utf8'),ctx);
 await new Promise(resolve=>setImmediate(resolve));
 // Force a stale base to exercise a real conflicting write, not just a failed request.
 return {cloud:ctx.window.RitmoCloud,storage,elements,requests:()=>requests};
}
function backup(water){return {state:{agenda:{},water:{'2026-11-18':water},mobility:{},mealchoices:{},selections:{},notes:{}},sessions:[]};}

test('alterações independentes dos aparelhos são combinadas',()=>{
 const base={water:0,items:[{id:'a',done:false},{id:'b',done:false}]};
 const local=structuredClone(base),remote=structuredClone(base);
 local.items[0].done=true;remote.items[1].done=true;remote.water=2;
 assert.deepEqual(merge.merge(base,local,remote),{water:2,items:[{id:'a',done:true},{id:'b',done:true}]});
 assert.throws(()=>merge.merge({water:0},{water:1},{water:2}),/mesmo campo/);
});
test('recusa do servidor fica visível e mantém a fila local',async()=>{
 const h=await cloudHarness(400);h.cloud.queueState(backup(3));await h.cloud.flush();
 assert.equal(h.cloud.pending(),1);assert.equal(h.elements.get('cloudstatus').dataset.kind,'error');
 assert.match(h.elements.get('cloudstatus').textContent,/Valor inválido de teste/);
 assert.equal(JSON.parse(h.storage.get('ritmo-pending-test')).pending['2026-11-18'].payload.water,3);
});
test('conflito preserva inclusive alterações feitas depois do bloqueio',async()=>{
 const h=await cloudHarness(409);h.cloud.queueState(backup(3));
 await h.cloud.flush();
 assert.equal(h.cloud.blocked(),true);
 h.cloud.queueState(backup(4));
 assert.equal(JSON.parse(h.storage.get('ritmo-pending-test')).pending['2026-11-18'].payload.water,4);
 assert.equal(h.cloud.pending(),1);
});
test('aluguel sem prazo aparece nos meses futuros e reserva semanal é proporcional',()=>{
 const model={income:{frequency:'week',amount:80000},categories:[],alerts:[],entries:[{id:'rent',name:'Aluguel',amount:80000,start:'2026-11-30',frequency:'month',interval:1,count:0,category:'home',overrides:{}}]};
 for(const anchor of ['2026-12-01','2027-02-01','2028-02-01']){
  assert.equal(finance.summary(model,'month',anchor).total,80000);
  assert.equal(finance.weeklyPlan(model,anchor).reserve,18462);
 }
 assert.equal(finance.addMonths('2027-01-31',1),'2027-02-28');
 assert.equal(finance.addMonths('2028-01-31',1),'2028-02-29');
 model.entries[0].overrides['2026-12-30']={paid:true};
 assert.equal(finance.summary(model,'month','2026-12-01').total,80000);
 assert.equal(finance.summary(model,'month','2026-12-01').paid,80000);
});
test('parcelas semanais terminam na quantidade e mês corretos',()=>{
 const entry={id:'phone',name:'Celular',amount:10000,start:'2026-11-20',frequency:'week',interval:1,count:10,overrides:{}};
 const rows=finance.occurrences([entry],'2026-11-01','2027-12-31');
 assert.equal(rows.length,10);assert.equal(rows.at(-1).day,'2027-01-22');
});
test('quanto guardar inclui parcelas semanais sem duplicar saldo e termina junto das parcelas',()=>{
 const model={income:{frequency:'week',amount:80000},entries:[
  {id:'rent',name:'Aluguel',amount:80000,start:'2026-11-30',frequency:'month',interval:1,count:0,overrides:{}},
  {id:'phone',name:'Celular',amount:13400,start:'2026-12-04',frequency:'week',interval:1,count:4,overrides:{}}
 ]};
 assert.equal(finance.weeklyCommitments(model,'2026-12-01','month').total,31862);
 assert.equal(finance.weeklyCommitments(model,'2026-12-04','week').total,31862);
 assert.equal(finance.weeklyPlan(model,'2026-12-04').total,31862);
 assert.equal(finance.weeklyPlan(model,'2026-12-04').balance,48138);
 model.entries[1].overrides['2026-12-04']={paid:true};
 assert.equal(finance.weeklyCommitments(model,'2026-12-04','week').total,31862);
 assert.equal(finance.summary(model,'month','2026-12-01').total,133600);
 assert.equal(finance.weeklyCommitments(model,'2027-01-01','month').total,18462);
 assert.equal(finance.weeklyCommitments(model,'2027-01-04','week').weeklyInstallments,0);
 model.entries[1].overrides['2026-12-11']={deleted:true};
 assert.equal(finance.weeklyCommitments(model,'2026-12-11','week').weeklyInstallments,0);
});
