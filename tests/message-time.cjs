const {test}=require('node:test'),assert=require('node:assert/strict');
const {dailyMessageDate}=require('../lib/ritmo.cjs');
test('API entrega mensagem anterior antes das 03h e bloqueia confirmação da próxima',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-20T02:59:59Z')});
 const {createHandler}=require('../lib/ritmo.cjs');
 const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 try{
  const config={schedule:[{id:'previous',date:'2026-11-19',text:'Anterior',requiresAck:true},{id:'next',date:'2026-11-20',text:'Nova',requiresAck:true}]};
  const db={auth:{getUser:async()=>({data:{user:{id:'test',email_confirmed_at:'2026-01-01'}}})},from(table){const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:table==='ritmo_members'?{user_id:'test'}:{revision:1,payload:{foodPlan:{message:config}}}})};return q;}};
  const handler=createHandler(()=>db);
  async function invoke(action,id){const response={setHeader(){},status(n){this.code=n;return this;},json(value){this.body=value;return this;}};await handler({method:'POST',headers:{host:'chaveverde.com',origin:'https://chaveverde.com',cookie:'__Secure-ritmo-a=test'},query:{action},body:{event:'11111111-1111-4111-8111-111111111111',id}},response);return response;}
  assert.equal((await invoke('message')).body.message.id,'previous');
  assert.equal((await invoke('ack-message','next')).code,409);
  t.mock.timers.tick(1000);
  assert.equal((await invoke('message')).body.message.id,'next');
 }finally{if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
test('mensagem diária muda somente às 03h de Londres',()=>{
 for(const [instant,expected] of [
  ['2026-11-19T00:00:00Z','2026-11-18'],
  ['2026-11-19T02:59:59Z','2026-11-18'],
  ['2026-11-19T03:00:00Z','2026-11-19'],
  ['2026-11-19T23:59:59Z','2026-11-19'],
  ['2027-01-01T02:59:59Z','2026-12-31'],
  ['2027-01-01T03:00:00Z','2027-01-01']
 ])assert.equal(dailyMessageDate(new Date(instant)),expected,instant);
});
test('corte às 03h acompanha horário de verão e suas transições',()=>{
 for(const [instant,expected] of [
  ['2027-07-19T01:59:59Z','2027-07-18'],
  ['2027-07-19T02:00:00Z','2027-07-19'],
  ['2027-03-28T01:59:59Z','2027-03-27'],
  ['2027-03-28T02:00:00Z','2027-03-28'],
  ['2027-10-31T02:59:59Z','2027-10-30'],
  ['2027-10-31T03:00:00Z','2027-10-31']
 ])assert.equal(dailyMessageDate(new Date(instant)),expected,instant);
});
