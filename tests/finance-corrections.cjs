const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../ritmo/personal-finance.js');
function model(entries){return {income:{amount:80000,frequency:'week'},categories:[{id:'home',name:'Casa',color:'#123456',limit:0}],alerts:[],entries};}
function bill(changes={}){return {id:'a',name:'Conta',amount:10000,start:'2026-11-20',frequency:'week',interval:1,count:6,category:'home',overrides:{},...changes};}
test('edição preserva quantidade restante, quitação e cancelamento futuros',()=>{
 const m=model([bill({overrides:{'2026-12-11':{paid:true},'2026-12-18':{deleted:true}}})]);
 const row=P.occurrences(m.entries,'2026-12-04','2026-12-04')[0];
 const record=bill({id:'b',amount:15000,start:row.day,count:row.source.count-row.index,overrides:{[row.day]:{paid:false}}});
 P.editFollowing(m,row,record);P.validate(m);
 const rows=P.occurrences(m.entries,'2026-11-01','2027-12-31');
 assert.equal(rows.length,5);assert.equal(rows.at(-1).day,'2026-12-25');
 assert.equal(rows.find(r=>r.day==='2026-12-11').paid,true);
 assert.equal(rows.find(r=>r.day==='2026-12-11').amount,10000);
 assert.equal(rows.find(r=>r.day==='2026-12-25').amount,15000);
 assert.equal(Object.keys(m.entries[0].overrides).length,0);
});
test('não permite retirar do calendário uma parcela paga',()=>{
 const m=model([bill({overrides:{'2026-12-11':{paid:true}}})]);
 const row=P.occurrences(m.entries,'2026-12-04','2026-12-04')[0];
 assert.throws(()=>P.editFollowing(m,row,bill({id:'b',start:row.day,count:1})),/paga/);
 assert.equal(m.entries[0].end,undefined);
 assert.throws(()=>P.editFollowing(m,row,bill({id:'b',start:'2026-12-05',count:4})),/paga/);
});
test('editar mensal no fevereiro curto preserva vencimento no dia 31',()=>{
 const m=model([bill({start:'2027-01-31',frequency:'month',count:4})]);
 const row=P.occurrences(m.entries,'2027-02-01','2027-02-28')[0];
 P.editFollowing(m,row,bill({id:'b',start:row.day,frequency:'month',count:3}));P.validate(m);
 assert.deepEqual(P.occurrences(m.entries,'2027-01-01','2027-12-31').map(r=>r.day),['2027-01-31','2027-02-28','2027-03-31','2027-04-30']);
});
test('reserva e total são iguais para todos os dias da mesma semana',()=>{
 const m=model([bill({start:'2026-11-29',frequency:'month',count:0,amount:80000}),bill({id:'b',start:'2026-12-04',frequency:'month',count:0,amount:30000})]);
 const ref=P.weeklyPlan(m,'2026-11-30');
 for(let i=0;i<7;i++){const day=P.addDays('2026-11-30',i),current=P.weeklyPlan(m,day);assert.equal(current.total,ref.total);assert.equal(current.reserve,ref.reserve);assert.equal(P.weeklyCommitments(m,day).weekly,ref.reserve);}
 assert.equal(ref.rows.reduce((sum,r)=>sum+r.amount,0),ref.total);
});
test('correções inválidas são rejeitadas sem esconder gastos das categorias',()=>{
 for(const change of [{category:'ghost'},{name:123},{name:''},{amount:-1},{paid:'yes'},{deleted:1},{unknown:true},[]]){
  const m=model([bill({overrides:{'2026-11-20':change}})]);assert.throws(()=>P.validate(m));
 }
 const m=model([bill({overrides:{'2026-11-20':{name:'Valor corrigido',category:'home',amount:9000,paid:true}}})]);assert.doesNotThrow(()=>P.validate(m));
});
