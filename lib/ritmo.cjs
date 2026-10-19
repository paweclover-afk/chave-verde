'use strict';
const crypto=require('node:crypto');
const Tracker=require('../ritmo/tracker.js');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validDay(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
function validateDay(day,p,plan){
  if(!validDay(day)||!p||typeof p!=='object'||Array.isArray(p)||typeof p.notes!=='string'||p.notes.length>2000||!Array.isArray(p.sessions)||!Array.isArray(p.agenda)||!Array.isArray(p.mobility)||p.mobility.length!==6||!Array.isArray(p.mealchoices)||p.mealchoices.length!==4||p.mealchoices.some((n,i)=>![i*2,i*2+1].includes(n))||!Number.isInteger(p.water)||p.water<0||p.water>1000||!['off',...plan.workouts.map(w=>w.id)].includes(p.selection)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.trainingTime))throw Error('Dados do dia inválidos.');
  const state={agenda:{[day]:p.agenda},water:{[day]:p.water},mobility:{[day]:p.mobility},mealchoices:{[day]:p.mealchoices},selections:{[day]:p.selection},trainingTime:p.trainingTime};
  Tracker.validateBackup({app:'ritmo-leonarda',version:2,state,sessions:p.sessions,legacy:{days:{}}},plan);
  if(p.sessions.some(s=>s.date!==day))throw Error('Uma série pertence a outra data.');
  if(p.agenda.some(e=>typeof e.done!=='boolean'))throw Error('Marcação de atividade inválida.');
  if(Buffer.byteLength(JSON.stringify(p))>250000)throw Error('Dia excede o limite de tamanho.');
  return {...p,sessions:p.sessions.map(s=>({...s,rows:Tracker.normalize(s.rows,plan.workouts.flatMap(w=>w.exercises).find(e=>e.id===s.exercise).timed)}))};
}
function cookies(req){const out={};for(const part of (req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)try{out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1));}catch{}}return out;}
function setSession(res,session){const base='; Path=/api/ritmo; HttpOnly; Secure; SameSite=Strict';res.setHeader('Set-Cookie',[
 `__Secure-ritmo-a=${session?encodeURIComponent(session.access_token):''}; Max-Age=${session?3600:0}${base}`,
 `__Secure-ritmo-r=${session?encodeURIComponent(session.refresh_token):''}; Max-Age=${session?2592000:0}${base}`
]);}
function sameOrigin(req){try{return new URL(req.headers.origin).host===req.headers.host&&new URL(req.headers.origin).protocol==='https:';}catch{return false;}}
function createHandler(makeClient){return async function(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Cookie');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Método não permitido.'});}
  const action=String(req.query?.action||'load');
  if(req.method==='POST'&&!sameOrigin(req))return res.status(403).json({error:'Origem inválida.'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'Armazenamento indisponível.'});
  const db=makeClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const identity=makeClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  try{
    if(action==='logout'){
      if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
      const token=cookies(req)['__Secure-ritmo-a'];if(token)await db.auth.admin.signOut(token,'local');setSession(res,null);return res.json({ok:true});
    }
    let user,session;
    if(action==='login'){
      if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
      const {email,password}=req.body||{};
      if(typeof email!=='string'||email.length>254||typeof password!=='string'||password.length>1024)return res.status(400).json({error:'Informe e-mail e senha.'});
      const result=await identity.auth.signInWithPassword({email:email.trim(),password});
      if(result.error||!result.data?.session)return res.status(401).json({error:'Não foi possível entrar. Confira o e-mail e a senha.'});
      user=result.data.user;session=result.data.session;
    }else{
      const c=cookies(req),access=c['__Secure-ritmo-a'],refresh=c['__Secure-ritmo-r'];
      if(access){const result=await identity.auth.getUser(access);if(!result.error)user=result.data?.user;}
      if(!user&&refresh){const result=await identity.auth.refreshSession({refresh_token:refresh});if(!result.error){user=result.data?.user;session=result.data?.session;}}
      if(!user)return res.status(401).json({error:'Entre na sua conta para continuar.'});
    }
    if(!user.email_confirmed_at)return res.status(403).json({error:'Acesso não autorizado.'});
    const member=await db.from('ritmo_members').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle();
    if(member.error)throw Error('database');
    if(!member.data){if(action==='login'&&session)await db.auth.admin.signOut(session.access_token,'local');setSession(res,null);return res.status(403).json({error:'Esta conta não tem acesso à área privada.'});}
    if(session)setSession(res,session);
    if(action==='login')return res.json({ok:true});
    if(action==='file'){
      if(req.method!=='GET')return res.status(405).json({error:'Use GET.'});
      const name=String(req.query?.name||'');if(!['treino.pdf','mobilidade.pdf','alimentacao.pdf','mobilidade.png'].includes(name))return res.status(404).json({error:'Arquivo não encontrado.'});
      const file=await db.storage.from('ritmo-private').download(user.id+'/'+name);if(file.error)return res.status(404).json({error:'Arquivo indisponível.'});
      res.setHeader('Content-Type',name.endsWith('.pdf')?'application/pdf':'image/png');res.setHeader('Content-Disposition','inline; filename="'+name+'"');return res.send(Buffer.from(await file.data.arrayBuffer()));
    }
    if(action==='audit'){
      if(!validDay(req.query.day))return res.status(400).json({error:'Data inválida.'});
      const data=await db.from('ritmo_changes').select('revision,created_at,payload').eq('user_id',user.id).eq('day',req.query.day).order('revision',{ascending:false}).limit(200);
      if(data.error)throw Error('database');return res.json({changes:data.data});
    }
    const plan=await db.from('ritmo_plans').select('payload').eq('user_id',user.id).single();if(plan.error)throw Error('database');
    if(action==='load'){
      if(req.method!=='GET')return res.status(405).json({error:'Use GET.'});
      const days=[];for(let from=0;;from+=500){const page=await db.from('ritmo_days').select('day,payload,revision,updated_at').eq('user_id',user.id).order('day',{ascending:true}).range(from,from+499);if(page.error)throw Error('database');days.push(...page.data);if(page.data.length<500)break;}
      return res.json({user:{id:user.id,email:user.email},plan:plan.data.payload,days});
    }
    if(action==='save'){
      if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
      const {day,payload,revision,event}=req.body||{};
      if(!uuid.test(event)||!Number.isSafeInteger(revision)||revision<0)return res.status(400).json({error:'Revisão inválida.'});
      let normalized;try{normalized=validateDay(day,payload,plan.data.payload);}catch(e){return res.status(400).json({error:e.message});}
      const saved=await db.rpc('ritmo_save_day',{p_user:user.id,p_day:day,p_expected:revision,p_payload:normalized,p_event:event});
      if(saved.error)throw Error('database');if(saved.data.conflict)return res.status(409).json({error:'Este dia foi alterado em outro aparelho. Exporte seu backup e recarregue antes de continuar.',conflict:true});
      return res.json({ok:true,...saved.data});
    }
    return res.status(404).json({error:'Ação não encontrada.'});
  }catch(e){const incident=crypto.randomUUID();console.error('ritmo request failed',incident);return res.status(503).json({error:'Não foi possível acessar seus registros agora. Tente novamente.',incident});}
};}
module.exports={createHandler,validateDay,validDay,sameOrigin};
