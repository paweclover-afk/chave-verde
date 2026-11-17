'use strict';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = value => typeof value === 'string' && uuid.test(value);

async function supportChat(req, res, db, userId, side) {
  const member = await db.from('support_chat_members').select('user_id').eq('side',side).eq('user_id',userId).maybeSingle();
  if (member.error) throw member.error;
  if (!member.data) return res.status(403).json({error:'Suporte privado indisponível nesta conta.'});

  const peer = side === 'ritmo' ? 'daybyday' : 'ritmo';
  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.operation === 'send') {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!validId(body.id) || !text || text.length > 2000) {
        return res.status(400).json({error:'Escreva uma mensagem de até 2.000 caracteres.'});
      }
      const sent = await db.from('support_chat_messages').upsert(
        {id:body.id,sender:side,body:text},
        {onConflict:'sender,id',ignoreDuplicates:true}
      );
      if (sent.error) throw sent.error;
    } else if (body.operation === 'read' && Array.isArray(body.ids) && body.ids.length > 0 && body.ids.length <= 100 && body.ids.every(validId)) {
      const read = await db.from('support_chat_messages').update({read_at:new Date().toISOString()})
        .eq('sender',peer).is('read_at',null).in('id',body.ids);
      if (read.error) throw read.error;
    } else {
      return res.status(400).json({error:'Operação inválida.'});
    }
    return res.json({ok:true});
  }

  const messages = await db.from('support_chat_messages').select('id,sender,body,created_at,read_at')
    .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
  if (messages.error) throw messages.error;
  return res.json({messages:messages.data.reverse()});
}

module.exports = {supportChat};
