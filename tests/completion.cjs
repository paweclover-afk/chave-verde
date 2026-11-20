const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../ritmo/completion.js'),T=require('../ritmo/tracker.js');
const item=done=>({id:'a',name:'Tarefa',time:'08:00',category:'health',details:'',done});
test('100% exige uma lista não vazia e todas as tarefas realmente marcadas',()=>{
 assert.equal(C.complete([]),false);assert.equal(C.complete([item(false)]),false);
 assert.equal(C.complete([item(true),item(false)]),false);assert.equal(C.complete([item(true)]),true);
});
test('sequência soma somente datas consecutivas completas, sem criar dias',()=>{
 const days={'2026-11-18':{items:[item(true)]},'2026-11-19':{items:[item(true)]},'2026-11-20':{items:[item(true)]}};
 assert.equal(C.streak(days,'2026-11-20'),3);assert.equal(Object.keys(days).length,3);
 days['2026-11-19'].items[0].done=false;assert.equal(C.streak(days,'2026-11-20'),1);
 assert.equal(C.streak(days,'2026-11-21'),0);
});
test('sequência atravessa meses e anos; mensagens valorizam 2, 3 e mais dias',()=>{
 const days={'2026-12-31':{items:[item(true)]},'2027-01-01':{items:[item(true)]}};
 assert.equal(C.streak(days,'2027-01-01'),2);assert.match(C.message(2),/Dois dias/);assert.match(C.message(3),/Três dias/);assert.match(C.message(7),/7 dias/);
});
test('marcador de comemoração é aceito no backup e exige booleano',()=>{
 assert.doesNotThrow(()=>T.validateDaybyday({items:[item(true)],celebrated:true}));
 assert.throws(()=>T.validateDaybyday({items:[item(true)],celebrated:'true'}));
});
