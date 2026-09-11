const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { anuncio_id, tipo } = req.body || {};

    if (!anuncio_id) {
      res.status(400).json({ error: 'anuncio_id é obrigatório' });
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
