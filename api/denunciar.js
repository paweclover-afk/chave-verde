const { createClient } = require('@supabase/supabase-js');

// Recebe uma denúncia anônima, mas só grava se passar no CAPTCHA (Turnstile).
// Assim a denúncia continua sem login, e bots não conseguem floodar.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { anuncio_id, motivo, token } = req.body || {};

    if (!anuncio_id || !Number.isInteger(Number(anuncio_id))) {
      res.status(400).json({ error: 'anuncio_id inválido' });
      return;
    }
    const motivoLimpo = String(motivo || '').trim().slice(0, 500);
    if (!motivoLimpo) {
      res.status(400).json({ error: 'Motivo é obrigatório' });
      return;
    }
    if (!token) {
      res.status(400).json({ error: 'Verificação anti-robô ausente' });
      return;
    }

    // 1) Confirma com o Cloudflare que quem enviou é humano
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    const verifyData = await verify.json();
    if (!verifyData.success) {
      res.status(403).json({ error: 'Verificação anti-robô falhou. Recarregue a página e tente de novo.' });
      return;
    }

    // 2) Grava a denúncia com a service role (ignora RLS)
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabaseAdmin
      .from('denuncias')
      .insert({ anuncio_id: Number(anuncio_id), motivo: motivoLimpo });
    if (error) throw error;

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('denunciar:', err);
    res.status(500).json({ error: 'Erro ao enviar a denúncia. Tente novamente.' });
  }
};
