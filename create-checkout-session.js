const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      res.status(401).json({ error: 'Sessão inválida' });
      return;
    }

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { anuncio_id, tipo } = req.body || {};

    if (!anuncio_id) {
      res.status(400).json({ error: 'anuncio_id é obrigatório' });
      return;
    }

    const { data: anuncio, error: anuncioErr } = await supabaseAdmin
      .from('quartos')
      .select('id, user_id')
      .eq('id', anuncio_id)
      .maybeSingle();

    if (anuncioErr) throw anuncioErr;
    if (!anuncio || anuncio.user_id !== callerData.user.id) {
      res.status(403).json({ error: 'Esse anúncio não pertence a essa conta' });
      return;
    }

    const tipoFinal = tipo === 'destaque' ? 'destaque' : 'fotos';
    const produtos = {
      fotos: { name: 'Fotos extras no anúncio (até 20 fotos)', unit_amount: 500 },
      destaque: { name: 'Destaque do anúncio (2 semanas no topo da cidade)', unit_amount: 1500 },
    };
    const produto = produtos[tipoFinal];

    const siteUrl = process.env.SITE_URL || 'https://chave-verde.vercel.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: produto.name },
            unit_amount: produto.unit_amount,
          },
          quantity: 1,
        },
      ],
      metadata: { anuncio_id: String(anuncio_id), tipo: tipoFinal },
      success_url: `${siteUrl}/painel.html?anuncio_pago=${anuncio_id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/painel.html?anuncio_cancelado=${anuncio_id}`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
