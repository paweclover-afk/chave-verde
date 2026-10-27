'use strict';
const crypto=require('node:crypto');
const Tracker=require('../daybyday/tracker.js');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validDay(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
function validateDay(day,p){
 if(!validDay(day))throw Error('Data inválida.');
 Tracker.validateDaybyday(p);
 if(p.monthly!==undefined&&!day.endsWith('-01'))throw Error('Checklist mensal deve pertencer ao primeiro dia do mês.');
 if(Buffer.byteLength(JSON.stringify(p))>150000)throw Error('Dia excede o limite de tamanho.');
 return p;
}
function cookies(req){const out={};for(const part of (req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)try{out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1));}catch{}}return out;}
function setSession(res,session){const base='; Path=/api/daybyday; HttpOnly; Secure; SameSite=Strict';res.setHeader('Set-Cookie',[
 `__Secure-daybyday-a=${session?encodeURIComponent(session.access_token):''}; Max-Age=${session?3600:0}${base}`,
 `__Secure-daybyday-r=${session?encodeURIComponent(session.refresh_token):''}; Max-Age=${session?2592000:0}${base}`
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
    if(['recover','resend'].includes(action)){
      if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
      const email=req.body?.email;
      if(typeof email!=='string'||email.length>254||!email.trim().includes('@'))return res.status(400).json({error:'Informe seu e-mail.'});
      const hash=crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
      const allowed=await db.from('daybyday_members').select('email_hash').eq('email_hash',hash).eq('active',true).maybeSingle();
      if(allowed.error)throw Error('database');
      if(!allowed.data)return res.json({ok:true});
      const result=action==='recover'
        ?await identity.auth.resetPasswordForEmail(email.trim(),{redirectTo:'https://chaveverde.com/redefinir-senha.html'})
        :await identity.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:'https://chaveverde.com/daybyday/'}});
      if(result.error)return res.status(result.error.status===429?429:400).json({error:result.error.status===429?'Aguarde alguns minutos antes de pedir outro e-mail.':'Não foi possível enviar agora. Aguarde um minuto e tente novamente.'});
      return res.json({ok:true});
    }
    if(action==='register'){
      if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
      const {email,password}=req.body||{};
      if(typeof email!=='string'||email.length>254||typeof password!=='string'||password.length<8||password.length>1024)return res.status(400).json({error:'Informe e-mail e senha de pelo menos 8 caracteres.'});
      const hash=crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
      const allowed=await db.from('daybyday_members').select('email_hash').eq('email_hash',hash).eq('active',true).maybeSingle();
      if(allowed.error)throw Error('database');
      if(!allowed.data)return res.status(403).json({error:'Este e-mail não está habilitado para o DayByDay.'});
      const result=await identity.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:'https://chaveverde.com/daybyday/'}});
      if(result.error)return res.status(400).json({error:'Não foi possível criar a conta. Se já possui conta no Chave Verde, entre com sua senha existente.'});
      return res.json({ok:true,confirmationRequired:true});
    }
    if(action==='logout'){
      if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
      const token=cookies(req)['__Secure-daybyday-a'];if(token)await db.auth.admin.signOut(token,'local');setSession(res,null);return res.json({ok:true});
    }
    let user,session;
    if(action==='login'){
      if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
      const {email,password}=req.body||{};
      if(typeof email!=='string'||email.length>254||typeof password!=='string'||password.length>1024)return res.status(400).json({error:'Informe e-mail e senha.'});
      const result=await identity.auth.signInWithPassword({email:email.trim(),password});
      if(result.error?.code==='email_not_confirmed')return res.status(403).json({code:'email_not_confirmed',error:'Seu e-mail ainda não foi confirmado. Abra o link de confirmação ou toque em Reenviar confirmação.'});
      if(result.error?.status===429)return res.status(429).json({error:'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'});
      if(result.error||!result.data?.session)return res.status(401).json({code:'invalid_credentials',error:'E-mail ou senha não conferem. Se já tem conta no Chave Verde, use a senha dessa conta ou toque em Esqueci minha senha.'});
      user=result.data.user;session=result.data.session;
    }else{
      const c=cookies(req),access=c['__Secure-daybyday-a'],refresh=c['__Secure-daybyday-r'];
      if(access){const result=await identity.auth.getUser(access);if(!result.error)user=result.data?.user;}
      if(!user&&refresh){const result=await identity.auth.refreshSession({refresh_token:refresh});if(!result.error){user=result.data?.user;session=result.data?.session;}}
      if(!user)return res.status(401).json({error:'Entre na sua conta para continuar.'});
    }
    if(!user.email_confirmed_at)return res.status(403).json({error:'Acesso não autorizado.'});
    const hash=crypto.createHash('sha256').update(user.email.trim().toLowerCase()).digest('hex');
    const member=await db.from('daybyday_members').select('user_id').eq('email_hash',hash).eq('active',true).maybeSingle();
    if(member.error)throw Error('database');
    if(!member.data||member.data.user_id&&member.data.user_id!==user.id){setSession(res,null);return res.status(403).json({error:'Esta conta não tem acesso ao DayByDay.'});}
    if(!member.data.user_id){const claimed=await db.from('daybyday_members').update({user_id:user.id}).eq('email_hash',hash).is('user_id',null).select('user_id').maybeSingle();if(claimed.error||claimed.data?.user_id!==user.id)throw Error('membership');}
    if(session)setSession(res,session);
    if(action==='login')return res.json({ok:true});
    if(action==='audit'){
      if(!validDay(req.query.day))return res.status(400).json({error:'Data inválida.'});
      const data=await db.from('daybyday_changes').select('revision,created_at,payload').eq('user_id',user.id).eq('day',req.query.day).order('revision',{ascending:false}).limit(200);
      if(data.error)throw Error('database');return res.json({changes:data.data});
    }
    if(action==='load'){
      if(req.method!=='GET')return res.status(405).json({error:'Use GET.'});
      const days=[];for(let from=0;;from+=500){const page=await db.from('daybyday_days').select('day,payload,revision,updated_at').eq('user_id',user.id).order('day',{ascending:true}).range(from,from+499);if(page.error)throw Error('database');days.push(...page.data);if(page.data.length<500)break;}
      return res.json({user:{id:user.id,email:user.email},days});
    }
    if(action==='save'){
      if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
      const {day,payload,revision,event}=req.body||{};
      if(!uuid.test(event)||!Number.isSafeInteger(revision)||revision<0)return res.status(400).json({error:'Revisão inválida.'});
      let normalized;try{normalized=validateDay(day,payload);}catch(e){return res.status(400).json({error:e.message});}
      const saved=await db.rpc('daybyday_save_day',{p_user:user.id,p_day:day,p_expected:revision,p_payload:normalized,p_event:event});
      if(saved.error)throw Error('database');if(saved.data.conflict)return res.status(409).json({error:'Este dia foi alterado em outro aparelho. Exporte seu backup e recarregue antes de continuar.',conflict:true});
      return res.json({ok:true,...saved.data});
    }
    return res.status(404).json({error:'Ação não encontrada.'});
  }catch(e){const incident=crypto.randomUUID();console.error('daybyday request failed',incident);return res.status(503).json({error:'Não foi possível acessar seus registros agora. Tente novamente.',incident});}
};}
module.exports={createHandler,validateDay,validDay,sameOrigin};
